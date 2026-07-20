// app/api/partida-materiales/route.ts
// Materiales (rendimientos) de las partidas de obra.
//   rendimiento = consumo de material por unidad de la partida
//   cantidad necesaria = cantidad_partida x rendimiento
import { createServerSupabase } from '@/lib/supabase-server'
import { guardEscritura, getOwnerId } from '@/lib/roles'
import { NextResponse, type NextRequest } from 'next/server'

// ─── GET: materiales de una partida (partida_id) o de todo un proyecto (proyecto_id) ───
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id

  const partidaId  = req.nextUrl.searchParams.get('partida_id')
  const proyectoId = req.nextUrl.searchParams.get('proyecto_id')

  // Por partida puntual
  if (partidaId) {
    const { data, error } = await supabase
      .from('partida_materiales')
      .select('*')
      .eq('partida_id', partidaId)
      .eq('user_id', ownerId)
      .order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  }

  // En lote: todos los materiales de las partidas de un proyecto
  if (proyectoId) {
    const { data: parts } = await supabase
      .from('partidas_proyecto')
      .select('id')
      .eq('proyecto_id', proyectoId)
      .eq('user_id', ownerId)
    const ids = (parts ?? []).map(p => p.id)
    if (ids.length === 0) return NextResponse.json([])

    const { data, error } = await supabase
      .from('partida_materiales')
      .select('*')
      .in('partida_id', ids)
      .eq('user_id', ownerId)
      .order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  }

  return NextResponse.json({ error: 'Falta partida_id o proyecto_id' }, { status: 400 })
}

// ─── POST: crear material ─────────────────────────────────
export async function POST(req: Request) {
  const supabase = await createServerSupabase()
  const ro = await guardEscritura(supabase, 'obra')
  if (ro) return ro
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id

  const body = await req.json()
  if (!body.partida_id) return NextResponse.json({ error: 'Falta partida_id' }, { status: 400 })

  const { data, error } = await supabase
    .from('partida_materiales')
    .insert({
      partida_id:      body.partida_id,
      material:        body.material,
      unidad:          body.unidad || 'un',
      rendimiento:     Number(body.rendimiento) || 0,
      precio_unitario: Number(body.precio_unitario) || 0,
      notas:           body.notas || null,
      user_id:         user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// ─── PUT: actualizar material ─────────────────────────────
export async function PUT(req: Request) {
  const supabase = await createServerSupabase()
  const ro = await guardEscritura(supabase, 'obra')
  if (ro) return ro
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id

  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  // Solo campos editables (no se toca partida_id ni user_id)
  const update = {
    material:        body.material,
    unidad:          body.unidad || 'un',
    rendimiento:     Number(body.rendimiento) || 0,
    precio_unitario: Number(body.precio_unitario) || 0,
    notas:           body.notas ?? null,
  }

  const { data, error } = await supabase
    .from('partida_materiales')
    .update(update)
    .eq('id', body.id)
    .eq('user_id', ownerId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// ─── DELETE ───────────────────────────────────────────────
export async function DELETE(req: Request) {
  const supabase = await createServerSupabase()
  const ro = await guardEscritura(supabase, 'obra')
  if (ro) return ro
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id

  const { id } = await req.json()
  const { error } = await supabase
    .from('partida_materiales')
    .delete()
    .eq('id', id)
    .eq('user_id', ownerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}