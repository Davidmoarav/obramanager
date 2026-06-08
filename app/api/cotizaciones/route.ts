// app/api/cotizaciones/route.ts
import { createServerSupabase } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// ─── GET: lista cotizaciones con sus partidas ─────────────
export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('cotizaciones')
    .select('*, partidas:partidas_cotizacion(*)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Ordenar las partidas dentro de cada cotización
  const result = (data ?? []).map((c: any) => ({
    ...c,
    partidas: (c.partidas ?? []).sort((a: any, b: any) => a.orden - b.orden),
  }))

  return NextResponse.json(result)
}

// ─── POST: crear cotización con sus partidas ──────────────
export async function POST(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { partidas = [], ...cabecera } = body

  // 1. Insertar cabecera
  const { data: cot, error: e1 } = await supabase
    .from('cotizaciones')
    .insert({ ...cabecera, user_id: user.id })
    .select()
    .single()

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

  // 2. Insertar partidas (si hay)
  if (partidas.length > 0) {
    const filas = partidas.map((p: any, i: number) => ({
      cotizacion_id:   cot.id,
      orden:           p.orden ?? i,
      descripcion:     p.descripcion,
      unidad:          p.unidad || 'un',
      cantidad:        Number(p.cantidad) || 0,
      precio_unitario: Number(p.precio_unitario) || 0,
    }))

    const { error: e2 } = await supabase.from('partidas_cotizacion').insert(filas)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  }

  return NextResponse.json(cot)
}

// ─── PUT: actualizar cotización + reemplazar partidas ─────
export async function PUT(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { id, partidas = [], created_at, user_id, ...cabecera } = body

  // 1. Actualizar cabecera
  const { error: e1 } = await supabase
    .from('cotizaciones')
    .update(cabecera)
    .eq('id', id)
    .eq('user_id', user.id)

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

  // 2. Borrar partidas anteriores
  const { error: e2 } = await supabase
    .from('partidas_cotizacion')
    .delete()
    .eq('cotizacion_id', id)

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

  // 3. Insertar partidas actualizadas
  if (partidas.length > 0) {
    const filas = partidas.map((p: any, i: number) => ({
      cotizacion_id:   id,
      orden:           p.orden ?? i,
      descripcion:     p.descripcion,
      unidad:          p.unidad || 'un',
      cantidad:        Number(p.cantidad) || 0,
      precio_unitario: Number(p.precio_unitario) || 0,
    }))

    const { error: e3 } = await supabase.from('partidas_cotizacion').insert(filas)
    if (e3) return NextResponse.json({ error: e3.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// ─── DELETE: la FK con ON DELETE CASCADE limpia las partidas
export async function DELETE(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await req.json()
  const { error } = await supabase
    .from('cotizaciones')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
