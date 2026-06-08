// app/api/empresa/route.ts
import { createServerSupabase } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// ─── GET: obtener la config de la empresa del usuario ─────
export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('empresa_config')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Si no hay registro, devuelve null (no es error)
  return NextResponse.json(data)
}

// ─── PUT: upsert (crea si no existe, actualiza si sí) ─────
export async function PUT(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  // Limpiar campos que no deben venir del cliente
  const { id, created_at, user_id, ...payload } = body

  const { data, error } = await supabase
    .from('empresa_config')
    .upsert(
      { ...payload, user_id: user.id, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
