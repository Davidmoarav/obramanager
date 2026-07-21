// app/api/partidas-proyecto/aplicar-matriz/route.ts
// Aplica una MATRIZ de distribución partida × beneficiario en un solo lote.
// Cada fila es una partida (categoría + descripción + costos maestros) y sus
// "celdas" indican la cantidad que aplica a cada beneficiario (subproyecto).
//   cantidad > 0  → crea la partida bajo ese beneficiario, o la actualiza si ya existe.
//   cantidad = 0  → si existía, la elimina (deja de aplicar a ese beneficiario).
// Al final recalcula el avance de grupos y del proyecto.
import { createServerSupabase } from '@/lib/supabase-server'
import { guardEscritura, getOwnerId } from '@/lib/roles'
import { NextResponse } from 'next/server'

interface Fila {
  categoria?: string
  descripcion: string
  unidad?: string
  costo_material_unit?: number
  costo_mo_unit?: number
  markup_pct?: number | null
  celdas: Record<string, number>   // benefId -> cantidad
}

// ─── Recalcular avances (mismo criterio que partidas-proyecto/route.ts) ───
function valorNodo(nodo: any, hijosDe: (id: string) => any[]): number {
  const h = hijosDe(nodo.id)
  if (h.length === 0) return (Number(nodo.cantidad) || 0) * (Number(nodo.precio_unitario) || 0)
  return h.reduce((s, c) => s + valorNodo(c, hijosDe), 0)
}
function avanceNodo(nodo: any, hijosDe: (id: string) => any[]): number {
  const h = hijosDe(nodo.id)
  if (h.length === 0) return Number(nodo.avance) || 0
  const pesos = h.map(c => valorNodo(c, hijosDe))
  const tot = pesos.reduce((a, b) => a + b, 0)
  if (tot > 0) return h.reduce((s, c, i) => s + avanceNodo(c, hijosDe) * (pesos[i] / tot), 0)
  return h.reduce((s, c) => s + avanceNodo(c, hijosDe), 0) / h.length
}
async function recalcTodo(supabase: any, proyectoId: string, userId: string) {
  const { data: todas } = await supabase
    .from('partidas_proyecto').select('*')
    .eq('proyecto_id', proyectoId).eq('user_id', userId)
  if (!todas || todas.length === 0) {
    await supabase.from('proyectos').update({ avance: 0 }).eq('id', proyectoId).eq('user_id', userId)
    return
  }
  const hijosDe = (id: string) => todas.filter((p: any) => p.parent_id === id)
  const raices  = todas.filter((p: any) => !p.parent_id)
  for (const nodo of todas) {
    if (hijosDe(nodo.id).length > 0) {
      const av = Math.round(avanceNodo(nodo, hijosDe))
      if (av !== (Number(nodo.avance) || 0)) {
        await supabase.from('partidas_proyecto').update({ avance: av }).eq('id', nodo.id).eq('user_id', userId)
      }
    }
  }
  let totalValor = 0, totalPond = 0
  for (const r of raices) {
    const v = valorNodo(r, hijosDe)
    totalValor += v
    totalPond  += v * avanceNodo(r, hijosDe) / 100
  }
  const avanceProyecto = totalValor > 0 ? Math.round((totalPond / totalValor) * 100) : 0
  await supabase.from('proyectos').update({ avance: avanceProyecto }).eq('id', proyectoId).eq('user_id', userId)
}

const norm = (s: any) => String(s ?? '').trim()

export async function POST(req: Request) {
  const supabase = await createServerSupabase()
  const ro = await guardEscritura(supabase, 'obra')
  if (ro) return ro
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id

  const body = await req.json()
  const { proyecto_id, filas, markup = 20 } = body as { proyecto_id: string; filas: Fila[]; markup: number }
  if (!proyecto_id || !Array.isArray(filas)) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  // Estado actual del proyecto
  const { data: actuales, error: eLoad } = await supabase
    .from('partidas_proyecto').select('*')
    .eq('proyecto_id', proyecto_id).eq('user_id', ownerId)
  if (eLoad) return NextResponse.json({ error: eLoad.message }, { status: 500 })

  const todas = actuales || []
  const rootIds = new Set(todas.filter((p: any) => !p.parent_id).map((p: any) => p.id))
  const hojasDe = (benefId: string) =>
    todas.filter((p: any) => p.parent_id === benefId && !p.es_grupo)
  // Cuántas hojas tiene cada beneficiario (para asignar 'orden' a las nuevas)
  const ordenBase: Record<string, number> = {}
  for (const id of rootIds) ordenBase[id as string] = hojasDe(id as string).length

  const aInsertar: any[] = []
  const aBorrar: string[] = []
  let updates = 0, inserts = 0, borrados = 0

  try {
    for (const fila of filas) {
      const desc = norm(fila.descripcion)
      if (!desc) continue
      const categoria = norm(fila.categoria)
      const unidad = norm(fila.unidad) || 'm2'
      const mat = Math.round(Number(fila.costo_material_unit) || 0)
      const mo  = Math.round(Number(fila.costo_mo_unit) || 0)
      const costo = mat + mo
      const mk = fila.markup_pct == null ? Number(markup) : Number(fila.markup_pct)
      const precio = Math.round(costo * (1 + mk / 100))

      for (const [benefId, cantRaw] of Object.entries(fila.celdas || {})) {
        if (!rootIds.has(benefId)) continue   // seguridad: solo beneficiarios reales
        const cant = Number(cantRaw) || 0
        const existente = hojasDe(benefId).find(
          (l: any) => norm(l.descripcion) === desc && norm(l.notas) === categoria
        )
        if (cant > 0) {
          if (existente) {
            const { error } = await supabase.from('partidas_proyecto').update({
              cantidad: cant, unidad,
              costo_material_unit: mat, costo_mo_unit: mo, costo_unitario: costo,
              markup_pct: mk, precio_unitario: precio,
            }).eq('id', existente.id).eq('user_id', ownerId)
            if (error) throw error
            updates++
          } else {
            aInsertar.push({
              proyecto_id, parent_id: benefId, nivel: 2, es_grupo: false,
              descripcion: desc.slice(0, 200), unidad: unidad.slice(0, 20),
              cantidad: cant, costo_material_unit: mat, costo_mo_unit: mo, costo_unitario: costo,
              markup_pct: mk, precio_unitario: precio, avance: 0,
              orden: ordenBase[benefId]++, notas: categoria.slice(0, 200) || null,
              user_id: ownerId,
            })
          }
        } else if (existente) {
          aBorrar.push(existente.id)
        }
      }
    }

    // Inserciones por lote
    for (let i = 0; i < aInsertar.length; i += 100) {
      const lote = aInsertar.slice(i, i + 100)
      const { error } = await supabase.from('partidas_proyecto').insert(lote)
      if (error) throw error
      inserts += lote.length
    }
    // Borrados en bloque
    if (aBorrar.length > 0) {
      const { error } = await supabase.from('partidas_proyecto')
        .delete().in('id', aBorrar).eq('user_id', ownerId)
      if (error) throw error
      borrados = aBorrar.length
    }
  } catch (err: any) {
    return NextResponse.json({ error: 'Error al aplicar la distribución: ' + (err.message || 'desconocido') }, { status: 500 })
  }

  await recalcTodo(supabase, proyecto_id, ownerId)
  return NextResponse.json({ ok: true, inserts, updates, borrados })
}