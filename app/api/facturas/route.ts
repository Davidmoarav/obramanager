// app/api/facturas/route.ts
import { createServerSupabase } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const sp = new URL(req.url).searchParams
  const resumen = sp.get('resumen')
  const periodo = sp.get('periodo')
  const tipo    = sp.get('tipo')
  const buscar  = sp.get('buscar')
  const docTipo = sp.get('doc_tipo')
  const folios  = sp.get('folios')   // lista de folios a resolver (numero -> id)

  // ── Resumen agregado, calculado en el servidor (no trae filas al cliente) ──
  if (resumen) {
    let q = supabase.from('facturas').select('tipo, estado, monto').eq('user_id', user.id)
    if (periodo) q = q.eq('periodo', periodo)
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const rows = data ?? []
    const ventas  = rows.filter((r: any) => (r.tipo || 'venta') !== 'compra')
    const compras = rows.filter((r: any) => r.tipo === 'compra')
    const sum = (arr: any[]) => arr.reduce((s, r) => s + (Number(r.monto) || 0), 0)
    return NextResponse.json({
      ventas: {
        cobrado:   sum(ventas.filter((r: any) => r.estado === 'pagada')),
        pendiente: sum(ventas.filter((r: any) => r.estado === 'pendiente')),
        vencido:   sum(ventas.filter((r: any) => r.estado === 'vencida')),
        total:     sum(ventas),
        count:     ventas.length,
      },
      compras: { total: sum(compras), count: compras.length },
    })
  }

  // Columnas específicas (evita traer '*')
  const COLS = 'id, numero, cliente, tipo, doc_tipo, factura_ref, neto, iva, monto, emision, periodo, estado, created_at'

  // ── Resolver folios a facturas (para pre-llenar la asociación de notas) ──
  if (folios !== null) {
    const lista = folios.split(',').map(s => s.trim()).filter(Boolean).slice(0, 200)
    if (lista.length === 0) return NextResponse.json([])
    let q = supabase.from('facturas').select('id, numero, cliente, tipo').eq('user_id', user.id).in('numero', lista)
    if (tipo) q = q.eq('tipo', tipo)
    if (docTipo) q = q.eq('doc_tipo', docTipo)
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  }

  // ── Búsqueda server-side (para asociar notas a su factura) ──
  if (buscar !== null) {
    let q = supabase.from('facturas').select(COLS).eq('user_id', user.id)
    if (tipo) q = q.eq('tipo', tipo)
    if (docTipo) q = q.eq('doc_tipo', docTipo)
    const term = buscar.trim().replace(/[,()%*\\]/g, '')   // sanitizar para el filtro PostgREST
    if (term) q = q.or(`numero.ilike.%${term}%,cliente.ilike.%${term}%`)
    const { data, error } = await q.order('emision', { ascending: false }).limit(40)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  }

  // ── Lista: por período (mes) o, sin período, solo las recientes con tope ──
  let q = supabase.from('facturas').select(COLS).eq('user_id', user.id)
  if (periodo) q = q.eq('periodo', periodo)
  if (tipo) q = q.eq('tipo', tipo)
  q = q.order('emision', { ascending: false })
  if (!periodo) q = q.limit(300)   // sin período no cargamos todo el histórico
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json()
  const { data, error } = await supabase.from('facturas').insert({ ...body, user_id: user.id }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json()
  const { id, ...rest } = body
  const { data, error } = await supabase.from('facturas').update(rest).eq('id', id).eq('user_id', user.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await req.json()
  const { error } = await supabase.from('facturas').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}