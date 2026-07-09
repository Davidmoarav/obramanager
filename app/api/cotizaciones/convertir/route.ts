// app/api/cotizaciones/convertir/route.ts
//
// Convierte una cotización en proyecto:
// 1. Crea el proyecto con valor total (con IVA)
// 2. COPIA la jerarquía COMPLETA de partidas (padres + sub-partidas) con avance 0%
// 3. Marca la cotización como 'convertida'
// 4. Transaccional con rollback manual

import { createServerSupabase } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const IVA = 0.19

export async function POST(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { cotizacion_id } = await req.json()
  if (!cotizacion_id) return NextResponse.json({ error: 'Falta cotizacion_id' }, { status: 400 })

  // 1. Cargar cotización con sus partidas
  const { data: cot, error: e1 } = await supabase
    .from('cotizaciones')
    .select('*, partidas:partidas_cotizacion(*)')
    .eq('id', cotizacion_id)
    .eq('user_id', user.id)
    .single()

  if (e1 || !cot) {
    return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
  }

  // 2. Validaciones
  if (cot.estado === 'convertida' && cot.proyecto_id) {
    return NextResponse.json({
      error: 'Esta cotización ya fue convertida a proyecto',
      proyecto_id: cot.proyecto_id,
    }, { status: 400 })
  }
  if (!cot.cliente_id && !cot.cliente) {
    return NextResponse.json({ error: 'La cotización no tiene cliente asignado' }, { status: 400 })
  }

  const partidasCot = (cot.partidas ?? []).sort((a: any, b: any) => a.orden - b.orden)
  if (partidasCot.length === 0) {
    return NextResponse.json({ error: 'La cotización no tiene partidas' }, { status: 400 })
  }

  // Las partidas de la cotización son los PADRES (títulos).
  const padres = partidasCot

  // Buscar sub-partidas en el CATÁLOGO para las partidas que tengan catalogo_id.
  // Así el desglose siempre viene del catálogo (fuente única de verdad).
  const catalogoIds = padres.map((p: any) => p.catalogo_id).filter(Boolean)
  let subPartidasCatalogo: any[] = []
  if (catalogoIds.length > 0) {
    const { data: subs } = await supabase
      .from('catalogo_partidas')
      .select('*')
      .in('parent_id', catalogoIds)
      .eq('user_id', user.id)
    subPartidasCatalogo = subs ?? []
  }

  // 3. Valor total CON IVA = solo padres (los hijos son desglose del padre)
  //    Si una partida padre NO tiene hijos, su propio valor cuenta.
  //    Si tiene hijos, el valor del padre ya representa el total de la partida.
  const neto = padres.reduce((s: number, p: any) =>
    s + (Number(p.cantidad) || 0) * (Number(p.precio_unitario) || 0), 0)
  const valorTotal = Math.round(neto * (1 + IVA))

  // 4. Descripción del proyecto (solo títulos padre)
  const descripcionPartidas = padres
    .map((p: any, i: number) => `${i + 1}. ${p.descripcion}`)
    .join(' · ')
  const descripcion = cot.descripcion
    ? `${cot.descripcion}\n\n${descripcionPartidas}`
    : descripcionPartidas

  const nombreProyecto = cot.proyecto_nombre
    || `Proyecto cotización ${cot.numero || cot.id.slice(0, 8)}`

  // 5. Crear el proyecto
  const { data: proyecto, error: e2 } = await supabase
    .from('proyectos')
    .insert({
      nombre:        nombreProyecto,
      cliente:       cot.cliente,
      descripcion:   descripcion.slice(0, 2000),
      valor:         valorTotal,
      avance:        0,
      estado:        'activo',
      inicio:        new Date().toISOString().split('T')[0],
      fin:           null,
      cliente_id:    cot.cliente_id || null,
      cotizacion_id: cot.id,
      user_id:       user.id,
    })
    .select()
    .single()

  if (e2) {
    return NextResponse.json({ error: 'Error al crear proyecto: ' + e2.message }, { status: 500 })
  }

  // 6. Copiar PADRES primero, guardando el mapeo idViejo → idNuevo
  const mapaIds: Record<string, string> = {}
  let totalCopiadas = 0

  for (let i = 0; i < padres.length; i++) {
    const p = padres[i]
    const { data: nuevoPadre, error: ep } = await supabase
      .from('partidas_proyecto')
      .insert({
        proyecto_id:     proyecto.id,
        parent_id:       null,
        orden:           p.orden ?? i,
        descripcion:     p.descripcion,
        unidad:          p.unidad || 'gl',
        cantidad:        Number(p.cantidad) || 1,
        precio_unitario: Number(p.precio_unitario) || 0,
        avance:          0,
        user_id:         user.id,
      })
      .select()
      .single()

    if (ep || !nuevoPadre) {
      await supabase.from('partidas_proyecto').delete().eq('proyecto_id', proyecto.id).eq('user_id', user.id)
      await supabase.from('proyectos').delete().eq('id', proyecto.id).eq('user_id', user.id)
      return NextResponse.json({ error: 'Error al copiar partida: ' + (ep?.message || '') }, { status: 500 })
    }
    mapaIds[p.id] = nuevoPadre.id
    // mapear también por catalogo_id para conectar las sub-partidas del catálogo
    if (p.catalogo_id) mapaIds['cat_' + p.catalogo_id] = nuevoPadre.id
    totalCopiadas++
  }

  // 7. Copiar SUB-PARTIDAS desde el catálogo, apuntando al nuevo padre
  if (subPartidasCatalogo.length > 0) {
    const filasHijos = subPartidasCatalogo
      .map((sub: any, i: number) => {
        const padreNuevoId = mapaIds['cat_' + sub.parent_id]
        if (!padreNuevoId) return null
        return {
          proyecto_id:     proyecto.id,
          parent_id:       padreNuevoId,
          orden:           sub.orden ?? i,
          descripcion:     sub.descripcion,
          unidad:          sub.unidad || 'gl',
          cantidad:        1,
          precio_unitario: Number(sub.precio_unitario_ref) || 0,
          avance:          0,
          user_id:         user.id,
        }
      })
      .filter(Boolean)

    if (filasHijos.length > 0) {
      const { error: eh } = await supabase
        .from('partidas_proyecto')
        .insert(filasHijos)

      if (eh) {
        await supabase.from('partidas_proyecto').delete().eq('proyecto_id', proyecto.id).eq('user_id', user.id)
        await supabase.from('proyectos').delete().eq('id', proyecto.id).eq('user_id', user.id)
        return NextResponse.json({ error: 'Error al copiar sub-partidas: ' + eh.message }, { status: 500 })
      }
      totalCopiadas += filasHijos.length
    }
  }

  // 8. Marcar cotización como convertida
  const { error: e4 } = await supabase
    .from('cotizaciones')
    .update({ estado: 'convertida', proyecto_id: proyecto.id })
    .eq('id', cot.id)
    .eq('user_id', user.id)

  if (e4) {
    await supabase.from('partidas_proyecto').delete().eq('proyecto_id', proyecto.id).eq('user_id', user.id)
    await supabase.from('proyectos').delete().eq('id', proyecto.id).eq('user_id', user.id)
    return NextResponse.json({ error: 'Error al actualizar cotización: ' + e4.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    proyecto_id: proyecto.id,
    proyecto,
    partidas_copiadas: totalCopiadas,
    padres: padres.length,
    sub_partidas: subPartidasCatalogo.length,
  })
}