// app/api/proveedor-productos/route.ts
// Catálogo de productos por proveedor: CRUD + carga masiva (CSV) + búsqueda.
import { createServerSupabase } from '@/lib/supabase-server'
import { guardEscritura, getOwnerId } from '@/lib/roles'
import { NextResponse } from 'next/server'

const COLS = 'id, proveedor_id, codigo, descripcion, unidad, precio, created_at'

export async function GET(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id

  const sp = req.url ? new URL(req.url).searchParams : new URLSearchParams()
  const proveedorId = sp.get('proveedor_id')
  const buscar = sp.get('buscar')

  let q = supabase.from('proveedor_productos').select(COLS).eq('user_id', ownerId)
  if (proveedorId) q = q.eq('proveedor_id', proveedorId)
  if (buscar) {
    const term = buscar.trim().replace(/[,()%*\\]/g, '')
    if (term) q = q.or(`descripcion.ilike.%${term}%,codigo.ilike.%${term}%`)
  }
  q = q.order('descripcion', { ascending: true }).limit(buscar ? 40 : 1000)

  const { data, error } = await q
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

  // ── Carga masiva (CSV) ──
  if (Array.isArray(body?.productos)) {
    const proveedorId = body.proveedor_id
    if (!proveedorId) return NextResponse.json({ error: 'Falta proveedor_id' }, { status: 400 })

    // Reemplazo total si se pide (para re-subir el catálogo limpio)
    if (body.reemplazar) {
      await supabase.from('proveedor_productos').delete().eq('proveedor_id', proveedorId).eq('user_id', ownerId)
    }

    const filas = body.productos
      .filter((p: any) => (p.descripcion || '').trim())
      .map((p: any) => ({
        proveedor_id: proveedorId,
        codigo:      (p.codigo || '').trim() || null,
        descripcion: (p.descripcion || '').trim(),
        unidad:      (p.unidad || 'un').trim(),
        precio:      Math.round(Number(p.precio) || 0),
        user_id:     user.id,
      }))

    if (filas.length === 0) return NextResponse.json({ ok: true, insertados: 0 })
    const { error } = await supabase.from('proveedor_productos').insert(filas)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, insertados: filas.length })
  }

  // ── Alta individual ──
  if (!body?.proveedor_id || !(body.descripcion || '').trim()) {
    return NextResponse.json({ error: 'Faltan proveedor y descripción' }, { status: 400 })
  }
  const row = {
    proveedor_id: body.proveedor_id,
    codigo:      (body.codigo || '').trim() || null,
    descripcion: (body.descripcion || '').trim(),
    unidad:      (body.unidad || 'un').trim(),
    precio:      Math.round(Number(body.precio) || 0),
    user_id:     user.id,
  }
  const { data, error } = await supabase.from('proveedor_productos').insert(row).select(COLS).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: Request) {
  const supabase = await createServerSupabase()
  const ro = await guardEscritura(supabase, 'obra')
  if (ro) return ro
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id

  const { id, ...rest } = await req.json()
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })
  const update: any = {}
  if (rest.codigo !== undefined) update.codigo = (rest.codigo || '').trim() || null
  if (rest.descripcion !== undefined) update.descripcion = (rest.descripcion || '').trim()
  if (rest.unidad !== undefined) update.unidad = (rest.unidad || 'un').trim()
  if (rest.precio !== undefined) update.precio = Math.round(Number(rest.precio) || 0)

  const { data, error } = await supabase
    .from('proveedor_productos').update(update).eq('id', id).eq('user_id', ownerId).select(COLS).single()
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

  const { id, proveedor_id, todos } = await req.json()

  // Vaciar el catálogo completo de un proveedor
  if (todos && proveedor_id) {
    const { error } = await supabase.from('proveedor_productos').delete().eq('proveedor_id', proveedor_id).eq('user_id', ownerId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })
  const { error } = await supabase.from('proveedor_productos').delete().eq('id', id).eq('user_id', ownerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}