// app/api/documentos/route.ts
import { createServerSupabase } from '@/lib/supabase-server'
import { NextResponse, type NextRequest } from 'next/server'

// ─── GET: listar documentos (opcionalmente filtrar por proyecto_id) ──
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const proyectoId = req.nextUrl.searchParams.get('proyecto_id')

  let query = supabase
    .from('documentos')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (proyectoId) {
    query = query.eq('proyecto_id', proyectoId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// ─── POST: registrar documento (el archivo ya fue subido al Storage) ──
export async function POST(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabase
    .from('documentos')
    .insert({ ...body, user_id: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// ─── DELETE: eliminar documento + archivo de Storage ──
export async function DELETE(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await req.json()

  // 1. Obtener path del archivo
  const { data: doc, error: e1 } = await supabase
    .from('documentos')
    .select('archivo_path')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (e1 || !doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  // 2. Eliminar archivo de Storage
  await supabase.storage.from('proyecto-docs').remove([doc.archivo_path])

  // 3. Eliminar registro de la BD
  const { error: e2 } = await supabase
    .from('documentos')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
