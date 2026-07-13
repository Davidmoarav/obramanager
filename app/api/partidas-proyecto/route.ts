// app/api/partidas-proyecto/route.ts
import { createServerSupabase } from '@/lib/supabase-server'
import { guardEscritura } from '@/lib/roles'
import { NextResponse, type NextRequest } from 'next/server'

// ─── Recalcular avances (hijos → padre → proyecto) ────────
async function recalcTodo(supabase: any, proyectoId: string, userId: string) {
  // 1. Traer todas las partidas del proyecto
  const { data: todas } = await supabase
    .from('partidas_proyecto')
    .select('*')
    .eq('proyecto_id', proyectoId)
    .eq('user_id', userId)

  if (!todas || todas.length === 0) {
    await supabase.from('proyectos').update({ avance: 0 }).eq('id', proyectoId).eq('user_id', userId)
    return
  }

  const padres = todas.filter((p: any) => !p.parent_id)
  const hijos  = todas.filter((p: any) => p.parent_id)

  // 2. Para cada padre: avance = promedio simple de sus hijos
  for (const padre of padres) {
    const hijosDelPadre = hijos.filter((h: any) => h.parent_id === padre.id)
    if (hijosDelPadre.length > 0) {
      const sumaAvance = hijosDelPadre.reduce((s: number, h: any) => s + (Number(h.avance) || 0), 0)
      const avancePadre = Math.round(sumaAvance / hijosDelPadre.length)
      await supabase
        .from('partidas_proyecto')
        .update({ avance: avancePadre })
        .eq('id', padre.id)
        .eq('user_id', userId)
      padre.avance = avancePadre  // actualizar en memoria para el cálculo del proyecto
    }
    // Si el padre no tiene hijos, su avance se mantiene tal cual
  }

  // 3. Avance del proyecto = ponderado por valor de los padres (o promedio simple si todo es $0)
  let totalValor = 0
  let totalAvancePond = 0
  let sumaAvancePadres = 0

  for (const padre of padres) {
    const valor = (Number(padre.cantidad) || 0) * (Number(padre.precio_unitario) || 0)
    totalValor       += valor
    totalAvancePond  += valor * (Number(padre.avance) || 0) / 100
    sumaAvancePadres += (Number(padre.avance) || 0)
  }

  const avanceProyecto = padres.length === 0 ? 0
    : totalValor > 0
      ? Math.round((totalAvancePond / totalValor) * 100)
      : Math.round(sumaAvancePadres / padres.length)

  await supabase
    .from('proyectos')
    .update({ avance: avanceProyecto })
    .eq('id', proyectoId)
    .eq('user_id', userId)
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