// app/api/remuneraciones/route.ts
// Genera/guarda liquidaciones de un período
import { createServerSupabase } from '@/lib/supabase-server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const periodo = req.nextUrl.searchParams.get('periodo')

  let query = supabase
    .from('liquidaciones')
    .select('*, empleado:empleados(*)')
    .eq('user_id', user.id)

  if (periodo) query = query.eq('periodo', periodo)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// Guardar una liquidación calculada (upsert por empleado+periodo)
export async function POST(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()

  // Verificar si ya existe liquidación para ese empleado+periodo
  const { data: existing } = await supabase
    .from('liquidaciones')
    .select('id')
    .eq('empleado_id', body.empleado_id)
    .eq('periodo', body.periodo)
    .eq('user_id', user.id)
    .maybeSingle()

  let result
  if (existing) {
    const { data, error } = await supabase
      .from('liquidaciones')
      .update({ ...body, user_id: user.id })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    result = data
  } else {
    const { data, error } = await supabase
      .from('liquidaciones')
      .insert({ ...body, user_id: user.id })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    result = data
  }

  return NextResponse.json(result)
}

// Marcar como pagada / cambiar estado
export async function PUT(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id, estado } = await req.json()
  const { data, error } = await supabase
    .from('liquidaciones')
    .update({ estado })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
