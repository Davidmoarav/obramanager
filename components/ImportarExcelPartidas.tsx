// app/api/partidas-proyecto/importar-programa/route.ts
// Importa un PROGRAMA con varios beneficiarios (grilla horizontal).
// Cada beneficiario se crea como subproyecto (nivel 1), y adentro va su
// estructura de soluciones (nivel 2) → etapas... → partidas (nivel hoja).
import { createServerSupabase } from '@/lib/supabase-server'
import { guardEscritura, getOwnerId } from '@/lib/roles'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createServerSupabase()
  const ro = await guardEscritura(supabase, 'obra')
  if (ro) return ro
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id

  const body = await req.json()
  const { proyecto_id, beneficiarios, markup = 20, reemplazar = false } = body
  if (!proyecto_id || !Array.isArray(beneficiarios)) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  // Si se pide reemplazar, borrar TODAS las partidas actuales del proyecto
  // (evita acumular partidas de importaciones previas)
  if (reemplazar) {
    const { error: eDel } = await supabase
      .from('partidas_proyecto')
      .delete()
      .eq('proyecto_id', proyecto_id)
      .eq('user_id', ownerId)
    if (eDel) return NextResponse.json({ error: 'No se pudieron limpiar las partidas previas: ' + eDel.message }, { status: 500 })
  }

  const factor = 1 + Number(markup) / 100

  // Estrategia robusta: generamos los IDs aquí (no dependemos de que la base los
  // devuelva tras cada insert, que con RLS puede fallar y dejar partidas sueltas).
  // Construimos TODOS los nodos con su parent_id ya resuelto y los insertamos por lote.
  const uuid = () => (globalThis.crypto?.randomUUID?.() ?? require('crypto').randomUUID())
  const nodos: any[] = []
  let ordenBenef = 0

  for (const benef of beneficiarios) {
    const idBenef = uuid()
    nodos.push({
      id: idBenef, proyecto_id, parent_id: null, nivel: 1, es_grupo: true,
      descripcion: String(benef.nombre || 'Beneficiario').slice(0, 200),
      unidad: 'gl', cantidad: 0, costo_unitario: 0, precio_unitario: 0, avance: 0,
      orden: ordenBenef++, user_id: ownerId,
    })

    let ordenSol = 0
    for (const sol of (benef.soluciones || [])) {
      const idSol = uuid()
      nodos.push({
        id: idSol, proyecto_id, parent_id: idBenef, nivel: 2, es_grupo: true,
        descripcion: String(sol.nombre || 'Solución').slice(0, 200),
        unidad: 'gl', cantidad: 0, costo_unitario: 0, precio_unitario: 0, avance: 0,
        orden: ordenSol++, user_id: ownerId,
      })

      let ordenEt = 0
      for (const et of (sol.etapas || [])) {
        const idEt = uuid()
        nodos.push({
          id: idEt, proyecto_id, parent_id: idSol, nivel: 3, es_grupo: true,
          descripcion: String(et.nombre || 'Etapa').slice(0, 200),
          unidad: 'gl', cantidad: 0, costo_unitario: 0, precio_unitario: 0, avance: 0,
          orden: ordenEt++, user_id: ownerId,
        })

        for (const [i, p] of (et.partidas || []).entries()) {
          const mat = Math.round(Number(p.material) || 0)
          const mo  = Math.round(Number(p.mano_obra) || 0)
          const costo = mat + mo
          nodos.push({
            id: uuid(), proyecto_id, parent_id: idEt, nivel: 4, es_grupo: false,
            descripcion: String(p.descripcion || 'Partida').slice(0, 200),
            unidad: String(p.unidad || 'm2').slice(0, 20),
            cantidad: Number(p.cantidad) || 0,
            costo_material_unit: mat, costo_mo_unit: mo, costo_unitario: costo,
            markup_pct: Number(markup), precio_unitario: Math.round(costo * factor),
            avance: 0, orden: i, user_id: ownerId,
          })
        }
      }
    }
  }

  let creados = 0
  try {
    // Insertar por lotes de 200. Como los IDs y parent_id ya están fijados,
    // el orden de inserción no afecta el anidamiento.
    for (let i = 0; i < nodos.length; i += 200) {
      const lote = nodos.slice(i, i + 200)
      const { error } = await supabase.from('partidas_proyecto').insert(lote)
      if (error) throw error
      creados += lote.length
    }
  } catch (err: any) {
    return NextResponse.json({
      error: 'Error al importar: ' + (err.message || 'desconocido') +
        (String(err.message || '').includes('nivel') || String(err.message || '').includes('es_grupo')
          ? '. Ejecuta el SQL 28_partidas_tres_niveles.sql en Supabase.' : ''),
      creados,
    }, { status: 500 })
  }

  return NextResponse.json({ ok: true, creados, beneficiarios: beneficiarios.length })
}