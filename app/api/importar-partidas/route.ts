// app/api/importar-partidas/route.ts
// Importa partidas de obra desde un Excel con estructura de 3 niveles:
//   Columna A = subproyecto (M1, M4...) — solo en la 1ª fila del bloque
//   Columna C = etapa / capítulo — se hereda hacia abajo
//   Columna F = partida (actividad real)
//   G unidad · I cantidad · K costo material/u · M costo mano de obra/u
//
// El cliente envía las filas ya parseadas (parseo del .xlsx en el navegador).
import { createServerSupabase } from '@/lib/supabase-server'
import { guardEscritura, getOwnerId } from '@/lib/roles'
import { NextResponse } from 'next/server'

interface FilaImport {
  subproyecto?: string
  etapa?: string
  partida?: string
  unidad?: string
  cantidad?: number
  costo_material?: number
  costo_mo?: number
}

export async function POST(req: Request) {
  const supabase = await createServerSupabase()
  const ro = await guardEscritura(supabase, 'obra')
  if (ro) return ro
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id

  const body = await req.json()
  const proyectoId: string = body.proyecto_id
  const filas: FilaImport[] = body.filas || []
  const markup: number = Number(body.markup) || 20
  const reemplazar: boolean = !!body.reemplazar

  if (!proyectoId) return NextResponse.json({ error: 'Falta el proyecto' }, { status: 400 })
  if (filas.length === 0) return NextResponse.json({ error: 'No hay filas para importar' }, { status: 400 })

  // Verificar que el proyecto es de la organización
  const { data: proy } = await supabase.from('proyectos').select('id').eq('id', proyectoId).maybeSingle()
  if (!proy) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  const factor = 1 + markup / 100
  const precioVenta = (costo: number) => Math.round(costo * factor)

  // Opcional: borrar las partidas existentes del proyecto antes de importar
  if (reemplazar) {
    await supabase.from('partidas_proyecto').delete().eq('proyecto_id', proyectoId).eq('user_id', ownerId)
  }

  // Reconstruir la jerarquía arrastrando subproyecto/etapa hacia abajo
  let subProyActual = ''
  let etapaActual = ''
  const arbol: { nombre: string; etapas: { nombre: string; partidas: FilaImport[] }[] }[] = []

  for (const f of filas) {
    if (f.subproyecto && f.subproyecto.trim()) subProyActual = f.subproyecto.trim()
    if (f.etapa && f.etapa.trim()) etapaActual = f.etapa.trim()
    if (!f.partida || !f.partida.trim()) continue          // fila sin partida real → se salta
    if (!subProyActual) subProyActual = 'General'

    let sp = arbol.find(s => s.nombre === subProyActual)
    if (!sp) { sp = { nombre: subProyActual, etapas: [] }; arbol.push(sp) }

    const etapaNombre = etapaActual || '(sin etapa)'
    let et = sp.etapas.find(e => e.nombre === etapaNombre)
    if (!et) { et = { nombre: etapaNombre, partidas: [] }; sp.etapas.push(et) }

    et.partidas.push(f)
  }

  // Insertar en 3 niveles, encadenando parent_id
  let creadas = 0, gruposSub = 0, gruposEtapa = 0
  let ordenSub = 0

  for (const sp of arbol) {
    const { data: nodoSub, error: eSub } = await supabase
      .from('partidas_proyecto')
      .insert({
        proyecto_id: proyectoId, user_id: ownerId, parent_id: null,
        descripcion: sp.nombre, nivel: 1, es_grupo: true, orden: ordenSub++,
        cantidad: 0, precio_unitario: 0, costo_unitario: 0, avance: 0,
      })
      .select('id').single()
    if (eSub) return NextResponse.json({ error: `Error creando subproyecto "${sp.nombre}": ${eSub.message}` }, { status: 500 })
    gruposSub++

    let ordenEt = 0
    for (const et of sp.etapas) {
      const { data: nodoEt, error: eEt } = await supabase
        .from('partidas_proyecto')
        .insert({
          proyecto_id: proyectoId, user_id: ownerId, parent_id: nodoSub!.id,
          descripcion: et.nombre, nivel: 2, es_grupo: true, orden: ordenEt++,
          cantidad: 0, precio_unitario: 0, costo_unitario: 0, avance: 0,
        })
        .select('id').single()
      if (eEt) return NextResponse.json({ error: `Error creando etapa "${et.nombre}": ${eEt.message}` }, { status: 500 })
      gruposEtapa++

      // Partidas reales (nivel 3) en lote
      const filasPartidas = et.partidas.map((p, i) => {
        const cMat = Math.round(Number(p.costo_material) || 0)
        const cMo  = Math.round(Number(p.costo_mo) || 0)
        const costo = cMat + cMo
        return {
          proyecto_id: proyectoId, user_id: ownerId, parent_id: nodoEt!.id,
          descripcion: (p.partida || '').trim(),
          unidad: (p.unidad || 'm2').trim() || 'm2',
          cantidad: Number(p.cantidad) || 0,
          nivel: 3, es_grupo: false,
          costo_material_unit: cMat,
          costo_mo_unit: cMo,
          costo_unitario: costo,
          markup_pct: markup,
          precio_unitario: precioVenta(costo),
          avance: 0, orden: i,
        }
      })
      if (filasPartidas.length > 0) {
        const { error: ePart } = await supabase.from('partidas_proyecto').insert(filasPartidas)
        if (ePart) return NextResponse.json({ error: `Error creando partidas de "${et.nombre}": ${ePart.message}` }, { status: 500 })
        creadas += filasPartidas.length
      }
    }
  }

  return NextResponse.json({
    ok: true,
    subproyectos: gruposSub,
    etapas: gruposEtapa,
    partidas: creadas,
    mensaje: `Se importaron ${creadas} partidas en ${gruposSub} subproyecto(s) y ${gruposEtapa} etapa(s).`,
  })
}