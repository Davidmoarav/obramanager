// app/api/empleados/route.ts
// Datos de personal (incluye sueldos) → módulo rrhh: admin y contador.
import { createServerSupabase } from '@/lib/supabase-server'
import { guardModulo, getOwnerId } from '@/lib/roles'
import { EmpleadoSchema, validar, validarParcial } from '@/lib/validar'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createServerSupabase()
  const denied = await guardModulo(supabase, 'rrhh')
  if (denied) return denied
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id
  const { data, error } = await supabase.from('empleados').select('*').eq('user_id', ownerId).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = await createServerSupabase()
  const denied = await guardModulo(supabase, 'rrhh')
  if (denied) return denied
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id
  const v = validar(EmpleadoSchema, await req.json())
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  const { data, error } = await supabase.from('empleados').insert({ ...v.data, user_id: ownerId }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: Request) {
  const supabase = await createServerSupabase()
  const denied = await guardModulo(supabase, 'rrhh')
  if (denied) return denied
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id
  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })
  const v = validarParcial(EmpleadoSchema, body)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  const { data, error } = await supabase.from('empleados').update(v.data).eq('id', body.id).eq('user_id', ownerId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const supabase = await createServerSupabase()
  const denied = await guardModulo(supabase, 'rrhh')
  if (denied) return denied
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id
  const { id } = await req.json()
  const { error } = await supabase.from('empleados').delete().eq('id', id).eq('user_id', ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
