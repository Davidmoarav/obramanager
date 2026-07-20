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
  let creados = 0
  let ordenBenef = 0

  // Inserta un nodo y devuelve su id
  const insertarNodo = async (fila: any): Promise<string> => {
    const { data, error } = await supabase.from('partidas_proyecto')
      .insert({ ...fila, proyecto_id, user_id: ownerId }).select('id').single()
    if (error) throw error
    creados++
    return data!.id
  }

  try {
    for (const benef of beneficiarios) {
      // Nivel 1: el beneficiario (agrupador)
      const idBenef = await insertarNodo({
        parent_id: null, nivel: 1, es_grupo: true,
        descripcion: String(benef.nombre || 'Beneficiario').slice(0, 200),
        unidad: 'gl', cantidad: 0, costo_unitario: 0, precio_unitario: 0, avance: 0, orden: ordenBenef++,
      })

      let ordenSol = 0
      for (const sol of (benef.soluciones || [])) {
        // Nivel 2: solución constructiva (agrupador)
        const idSol = await insertarNodo({
          parent_id: idBenef, nivel: 2, es_grupo: true,
          descripcion: String(sol.nombre || 'Solución').slice(0, 200),
          unidad: 'gl', cantidad: 0, costo_unitario: 0, precio_unitario: 0, avance: 0, orden: ordenSol++,
        })

        let ordenEt = 0
        for (const et of (sol.etapas || [])) {
          // Nivel 3: etapa (agrupador)
          const idEt = await insertarNodo({
            parent_id: idSol, nivel: 3, es_grupo: true,
            descripcion: String(et.nombre || 'Etapa').slice(0, 200),
            unidad: 'gl', cantidad: 0, costo_unitario: 0, precio_unitario: 0, avance: 0, orden: ordenEt++,
          })

          // Nivel 4 (hojas): partidas reales, insertadas por lote
          const filas = (et.partidas || []).map((p: any, i: number) => {
            const mat = Math.round(Number(p.material) || 0)
            const mo  = Math.round(Number(p.mano_obra) || 0)
            const costo = mat + mo
            return {
              proyecto_id, parent_id: idEt, nivel: 4, es_grupo: false,
              descripcion: String(p.descripcion || 'Partida').slice(0, 200),
              unidad: String(p.unidad || 'm2').slice(0, 20),
              cantidad: Number(p.cantidad) || 0,
              costo_material_unit: mat, costo_mo_unit: mo, costo_unitario: costo,
              markup_pct: Number(markup), precio_unitario: Math.round(costo * factor),
              avance: 0, orden: i, user_id: ownerId,
            }
          })
          // Insertar en lotes de 100 (evita payloads gigantes)
          for (let i = 0; i < filas.length; i += 100) {
            const lote = filas.slice(i, i + 100)
            const { error } = await supabase.from('partidas_proyecto').insert(lote)
            if (error) throw error
            creados += lote.length
          }
        }
      }
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