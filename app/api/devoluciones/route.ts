// app/api/devoluciones/route.ts
// Registra y lista las devoluciones (liberaciones) de retención y anticipo
// que el mandante entrega al contratista a lo largo de la obra.
import { createServerSupabase } from '@/lib/supabase-server'
import { guardEscritura, getOwnerId } from '@/lib/roles'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id

  const proyectoId = req.nextUrl.searchParams.get('proyecto_id')
  let query = supabase.from('devoluciones').select('*').eq('user_id', ownerId)
  if (proyectoId) query = query.eq('proyecto_id', proyectoId)

  const { data, error } = await query.order('fecha', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const supabase = await createServerSupabase()
  const ro = await guardEscritura(supabase, 'obra')
  if (ro) return ro
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id

  const body = await req.json()
  const { proyecto_id, tipo, monto, fecha, glosa } = body
  if (!proyecto_id || !tipo) return NextResponse.json({ error: 'proyecto_id y tipo son requeridos' }, { status: 400 })
  if (!['retencion', 'anticipo'].includes(tipo)) return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })

  const { data, error } = await supabase
    .from('devoluciones')
    .insert({
      user_id: ownerId,
      proyecto_id,
      tipo,
      monto: Number(monto) || 0,
      fecha: fecha || new Date().toISOString().split('T')[0],
      glosa: glosa || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const supabase = await createServerSupabase()
  const ro = await guardEscritura(supabase, 'obra')
  if (ro) return ro
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await supabase.from('devoluciones').delete().eq('id', id).eq('user_id', ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}