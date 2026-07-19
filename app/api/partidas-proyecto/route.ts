// app/api/partidas-proyecto/route.ts
import { createServerSupabase } from '@/lib/supabase-server'
import { guardEscritura } from '@/lib/roles'
import { NextResponse, type NextRequest } from 'next/server'

// ─── Recalcular avances (hojas → grupos → proyecto), N niveles ────
// El avance de un grupo (subproyecto/etapa) = promedio de sus hijos PONDERADO
// por valor. Se propaga hacia arriba a cualquier profundidad.
// DEBE coincidir con presupuesto/route.ts y estados-pago/route.ts.

// Valor de un nodo: hoja = cantidad×precio; grupo = suma de hijos.
function valorNodo(nodo: any, hijosDe: (id: string) => any[]): number {
  const h = hijosDe(nodo.id)
  if (h.length === 0) return (Number(nodo.cantidad) || 0) * (Number(nodo.precio_unitario) || 0)
  return h.reduce((s, c) => s + valorNodo(c, hijosDe), 0)
}

// Avance de un nodo: hoja = su avance; grupo = ponderado por valor de hijos.
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

  // 1. Persistir el avance calculado de cada GRUPO (los que tienen hijos)
  for (const nodo of todas) {
    if (hijosDe(nodo.id).length > 0) {
      const av = Math.round(avanceNodo(nodo, hijosDe))
      if (av !== (Number(nodo.avance) || 0)) {
        await supabase.from('partidas_proyecto').update({ avance: av }).eq('id', nodo.id).eq('user_id', userId)
      }
    }
  }

  // 2. Avance del proyecto = ponderado por valor de las raíces
  let totalValor = 0, totalPond = 0
  for (const r of raices) {
    const v = valorNodo(r, hijosDe)
    totalValor += v
    totalPond  += v * avanceNodo(r, hijosDe) / 100
  }
  const avanceProyecto = totalValor > 0 ? Math.round((totalPond / totalValor) * 100) : 0

  await supabase.from('proyectos').update({ avance: avanceProyecto }).eq('id', proyectoId).eq('user_id', userId)
}

// ─── GET ──────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const proyectoId = req.nextUrl.searchParams.get('proyecto_id')
  if (!proyectoId) return NextResponse.json({ error: 'Falta proyecto_id' }, { status: 400 })

  const { data, error } = await supabase
    .from('partidas_proyecto')
    .select('*')
    .eq('proyecto_id', proyectoId)
    .eq('user_id', user.id)
    .order('orden', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// ─── POST ─────────────────────────────────────────────────
export async function POST(req: Request) {
  const supabase = await createServerSupabase()
  const ro = await guardEscritura(supabase, 'obra')
  if (ro) return ro
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabase
    .from('partidas_proyecto')
    .insert({
      proyecto_id:     body.proyecto_id,
      parent_id:       body.parent_id || null,
      orden:           Number(body.orden) || 0,
      descripcion:     body.descripcion,
      unidad:          body.unidad || 'gl',
      cantidad:        Number(body.cantidad) || 1,
      costo_unitario:  Number(body.costo_unitario) || 0,
      markup_pct:      body.markup_pct ?? null,
      precio_unitario: Number(body.precio_unitario) || 0,
      avance:          Number(body.avance) || 0,
      notas:           body.notas || null,
      user_id:         user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await recalcTodo(supabase, body.proyecto_id, user.id)
  return NextResponse.json(data)
}

// ─── PUT ──────────────────────────────────────────────────
export async function PUT(req: Request) {
  const supabase = await createServerSupabase()
  const ro = await guardEscritura(supabase, 'obra')
  if (ro) return ro
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { id, created_at, user_id, children, ...rest } = body

  const { data, error } = await supabase
    .from('partidas_proyecto')
    .update({
      ...rest,
      cantidad:        Number(rest.cantidad) || 1,
      precio_unitario: Number(rest.precio_unitario) || 0,
      avance:          Math.min(100, Math.max(0, Number(rest.avance) || 0)),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (rest.proyecto_id) await recalcTodo(supabase, rest.proyecto_id, user.id)
  return NextResponse.json(data)
}

// ─── DELETE ───────────────────────────────────────────────
export async function DELETE(req: Request) {
  const supabase = await createServerSupabase()
  const ro = await guardEscritura(supabase, 'obra')
  if (ro) return ro
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id, proyecto_id } = await req.json()
  // CASCADE borra los hijos automáticamente
  const { error } = await supabase
    .from('partidas_proyecto')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (proyecto_id) await recalcTodo(supabase, proyecto_id, user.id)
  return NextResponse.json({ ok: true })
}