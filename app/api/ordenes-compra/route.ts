// app/api/ordenes-compra/route.ts
// Órdenes de compra: cabecera + líneas.
//   ?sugerir=1&proyecto_id=X  → agrega materiales del proyecto (cantidad x rendimiento)
//                               con precio desde los rendimientos, para pre-llenar la OC.
//   ?id=X                     → una OC con sus líneas
//   (sin params)              → lista de OCs
import { createServerSupabase } from '@/lib/supabase-server'
import { NextResponse, type NextRequest } from 'next/server'

const IVA = 0.19

// ─── GET ──────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const sugerir = sp.get('sugerir')
  const proyectoId = sp.get('proyecto_id')
  const id = sp.get('id')

  // ── Sugerencia: materiales agregados del proyecto ──
  if (sugerir && proyectoId) {
    const [{ data: partidas }, { data: mats }] = await Promise.all([
      supabase.from('partidas_proyecto').select('id, cantidad').eq('proyecto_id', proyectoId).eq('user_id', user.id),
      // materiales de las partidas de este proyecto
      supabase.from('partida_materiales').select('*').eq('user_id', user.id),
    ])
    const cantPorPartida: Record<string, number> = {}
    for (const p of partidas ?? []) cantPorPartida[p.id] = Number(p.cantidad) || 0
    const idsProyecto = new Set(Object.keys(cantPorPartida))

    // Agrupar por material + unidad
    const grupos: Record<string, { material: string; unidad: string; cantidad: number; precio_unitario: number }> = {}
    for (const m of mats ?? []) {
      if (!idsProyecto.has(m.partida_id)) continue
      const necesario = (cantPorPartida[m.partida_id] || 0) * (Number(m.rendimiento) || 0)
      if (necesario <= 0) continue
      const key = `${(m.material || '').trim().toLowerCase()}|${m.unidad || 'un'}`
      if (!grupos[key]) {
        grupos[key] = { material: m.material, unidad: m.unidad || 'un', cantidad: 0, precio_unitario: 0 }
      }
      grupos[key].cantidad += necesario
      // precio: el mayor no-cero visto (deberían coincidir entre partidas)
      grupos[key].precio_unitario = Math.max(grupos[key].precio_unitario, Number(m.precio_unitario) || 0)
    }

    const lineas = Object.values(grupos).map(g => ({
      material: g.material,
      unidad: g.unidad,
      cantidad: Math.round(g.cantidad * 100) / 100,
      precio_unitario: g.precio_unitario,
      subtotal: Math.round(g.cantidad * g.precio_unitario),
    }))
    return NextResponse.json({ lineas })
  }

  // ── Una OC con sus líneas ──
  if (id) {
    const { data: oc, error } = await supabase
      .from('ordenes_compra').select('*').eq('id', id).eq('user_id', user.id).single()
    if (error) return NextResponse.json({ error: error.message }, { status: 404 })
    const { data: lineas } = await supabase
      .from('orden_compra_lineas').select('*').eq('orden_id', id).eq('user_id', user.id).order('created_at', { ascending: true })
    return NextResponse.json({ ...oc, lineas: lineas ?? [] })
  }

  // ── Lista de OCs ──
  const { data, error } = await supabase
    .from('ordenes_compra').select('*').eq('user_id', user.id).order('numero', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// ── Helper: calcula subtotales + totales desde las líneas ──
function calcTotales(lineasIn: any[]) {
  const lineas = (lineasIn ?? []).map(l => {
    const cantidad = Number(l.cantidad) || 0
    const precio = Number(l.precio_unitario) || 0
    return {
      material: l.material,
      unidad: l.unidad || 'un',
      cantidad,
      precio_unitario: precio,
      subtotal: Math.round(cantidad * precio),
    }
  })
  const neto = lineas.reduce((s, l) => s + l.subtotal, 0)
  const iva = Math.round(neto * IVA)
  const total = neto + iva
  return { lineas, neto, iva, total }
}

// ─── POST: crear OC ───────────────────────────────────────
export async function POST(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { lineas, neto, iva, total } = calcTotales(body.lineas)

  // Correlativo por usuario
  const { data: ultima } = await supabase
    .from('ordenes_compra').select('numero').eq('user_id', user.id).order('numero', { ascending: false }).limit(1).maybeSingle()
  const numero = (ultima?.numero || 0) + 1

  const { data: oc, error } = await supabase
    .from('ordenes_compra')
    .insert({
      numero,
      proveedor_id: body.proveedor_id || null,
      proveedor:    body.proveedor || null,
      proyecto_id:  body.proyecto_id || null,
      proyecto:     body.proyecto || null,
      fecha:        body.fecha || new Date().toISOString().split('T')[0],
      estado:       body.estado || 'borrador',
      neto, iva, total,
      notas:        body.notas || null,
      user_id:      user.id,
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (lineas.length > 0) {
    const rows = lineas.map(l => ({ ...l, orden_id: oc.id, user_id: user.id }))
    const { error: eL } = await supabase.from('orden_compra_lineas').insert(rows)
    if (eL) return NextResponse.json({ error: eL.message }, { status: 500 })
  }

  return NextResponse.json({ ...oc, lineas })
}

// ─── PUT: actualizar OC (estado, datos y/o líneas) ────────
export async function PUT(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const update: any = {}
  if (body.proveedor_id !== undefined) update.proveedor_id = body.proveedor_id || null
  if (body.proveedor    !== undefined) update.proveedor    = body.proveedor || null
  if (body.proyecto_id  !== undefined) update.proyecto_id  = body.proyecto_id || null
  if (body.proyecto     !== undefined) update.proyecto     = body.proyecto || null
  if (body.fecha        !== undefined) update.fecha        = body.fecha
  if (body.estado       !== undefined) update.estado       = body.estado
  if (body.notas        !== undefined) update.notas        = body.notas ?? null

  // Si vienen líneas, se reemplazan y se recalculan los totales
  if (Array.isArray(body.lineas)) {
    const { lineas, neto, iva, total } = calcTotales(body.lineas)
    update.neto = neto; update.iva = iva; update.total = total

    await supabase.from('orden_compra_lineas').delete().eq('orden_id', body.id).eq('user_id', user.id)
    if (lineas.length > 0) {
      const rows = lineas.map(l => ({ ...l, orden_id: body.id, user_id: user.id }))
      const { error: eL } = await supabase.from('orden_compra_lineas').insert(rows)
      if (eL) return NextResponse.json({ error: eL.message }, { status: 500 })
    }
  }

  const { data, error } = await supabase
    .from('ordenes_compra').update(update).eq('id', body.id).eq('user_id', user.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// ─── DELETE ───────────────────────────────────────────────
export async function DELETE(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await req.json()
  const { error } = await supabase.from('ordenes_compra').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}