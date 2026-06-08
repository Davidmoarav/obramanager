// app/api/cotizaciones/convertir/route.ts
//
// Convierte una cotización en proyecto:
// 1. Crea el proyecto
// 2. COPIA las partidas de cotización a partidas_proyecto (con avance 0%)
// 3. Marca la cotización como 'convertida'

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

  const partidas = (cot.partidas ?? []).sort((a: any, b: any) => a.orden - b.orden)
  if (partidas.length === 0) {
    return NextResponse.json({ error: 'La cotización no tiene partidas' }, { status: 400 })
  }

  // 3. Calcular valor total CON IVA
  const neto = partidas.reduce((s: number, p: any) =>
    s + (Number(p.cantidad) || 0) * (Number(p.precio_unitario) || 0), 0)
  const valorTotal = Math.round(neto * (1 + IVA))

  // 4. Descripción
  const descripcionPartidas = partidas
    .map((p: any, i: number) => `${i + 1}. ${p.descripcion} (${p.cantidad} ${p.unidad})`)
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

  // ═══════════════════════════════════════════════════════════
  // 6. COPIAR PARTIDAS DE COTIZACIÓN → PARTIDAS DE PROYECTO
  // ═══════════════════════════════════════════════════════════
  const partidasProyecto = partidas.map((p: any, i: number) => ({
    proyecto_id:     proyecto.id,
    orden:           p.orden ?? i,
    descripcion:     p.descripcion,
    unidad:          p.unidad || 'un',
    cantidad:        Number(p.cantidad) || 0,
    precio_unitario: Number(p.precio_unitario) || 0,
    avance:          0,    // ← empiezan en 0%
    notas:           null,
    user_id:         user.id,
  }))

  const { error: e3 } = await supabase
    .from('partidas_proyecto')
    .insert(partidasProyecto)

  if (e3) {
    // Rollback: eliminar el proyecto que se creó
    await supabase.from('proyectos').delete().eq('id', proyecto.id)
    return NextResponse.json({ error: 'Error al copiar partidas: ' + e3.message }, { status: 500 })
  }

  // 7. Actualizar la cotización: estado convertida + vínculo
  const { error: e4 } = await supabase
    .from('cotizaciones')
    .update({
      estado:      'convertida',
      proyecto_id: proyecto.id,
    })
    .eq('id', cot.id)
    .eq('user_id', user.id)

  if (e4) {
    // Rollback
    await supabase.from('partidas_proyecto').delete().eq('proyecto_id', proyecto.id)
    await supabase.from('proyectos').delete().eq('id', proyecto.id)
    return NextResponse.json({ error: 'Error al actualizar cotización: ' + e4.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    proyecto_id: proyecto.id,
    proyecto,
    partidas_copiadas: partidasProyecto.length,
  })
}