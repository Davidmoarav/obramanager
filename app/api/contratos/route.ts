// app/api/contratos/route.ts
import { createServerSupabase } from '@/lib/supabase-server'
import { getOwnerId } from '@/lib/roles'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id
  const { data, error } = await supabase.from('contratos').select('*').eq('user_id', ownerId).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const contratos = data ?? []
  // Ejecutado (facturado) de cada contrato enlazado, desde los estados de pago del proyecto
  const proyectoIds = [...new Set(contratos.filter((c: any) => c.proyecto_id).map((c: any) => c.proyecto_id))]
  const ejecutado: Record<string, number> = {}
  if (proyectoIds.length) {
    const { data: eps } = await supabase
      .from('estados_pago').select('proyecto_id, bruto').eq('user_id', ownerId).in('proyecto_id', proyectoIds as string[])
    for (const ep of eps ?? []) ejecutado[ep.proyecto_id] = (ejecutado[ep.proyecto_id] || 0) + (Number(ep.bruto) || 0)
  }

  const result = contratos.map((c: any) => ({
    ...c,
    ejecutado: c.proyecto_id ? (ejecutado[c.proyecto_id] || 0) : null,
  }))
  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id
  const body = await req.json()
  const { data, error } = await supabase.from('contratos').insert({ ...body, user_id: ownerId }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id
  const body = await req.json()
  const { id, ...rest } = body
  const { data, error } = await supabase.from('contratos').update(rest).eq('id', id).eq('user_id', ownerId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id
  const { id } = await req.json()
  const { error } = await supabase.from('contratos').delete().eq('id', id).eq('user_id', ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}