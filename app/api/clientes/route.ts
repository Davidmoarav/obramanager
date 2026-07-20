// app/api/clientes/route.ts
import { createServerSupabase } from '@/lib/supabase-server'
import { getOwnerId } from '@/lib/roles'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id

  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('user_id', ownerId)
    .order('razon_social', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id

  const body = await req.json()
  const { data, error } = await supabase
    .from('clientes')
    .insert({ ...body, user_id: ownerId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id

  const body = await req.json()
  const { id, created_at, user_id, ...rest } = body
  const { data, error } = await supabase
    .from('clientes')
    .update(rest)
    .eq('id', id)
    .eq('user_id', ownerId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id

  const { id } = await req.json()
  const { error } = await supabase
    .from('clientes')
    .delete()
    .eq('id', id)
    .eq('user_id', ownerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}