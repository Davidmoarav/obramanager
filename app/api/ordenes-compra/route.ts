// app/api/ordenes-compra/route.ts
// Órdenes de compra: cabecera + líneas.
//   ?sugerir=1&proyecto_id=X  → agrega materiales del proyecto (cantidad x rendimiento)
//                               con precio desde los rendimientos, para pre-llenar la OC.
//   ?id=X                     → una OC con sus líneas
//   (sin params)              → lista de OCs
import { createServerSupabase } from '@/lib/supabase-server'
import { guardEscritura } from '@/lib/roles'
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
    const { data: partidas } = await supabase
      .from('partidas_proyecto').select('id, cantidad').eq('proyecto_id', proyectoId).eq('user_id', user.id)
    const cantPorPartida: Record<string, number> = {}
    for (const p of partidas ?? []) cantPorPartida[p.id] = Number(p.cantidad) || 0
    const partIds = Object.keys(cantPorPartida)

    // Solo los materiales de las partidas de este proyecto (no todos los del usuario)
    const { data: mats } = partIds.length
      ? await supabase.from('partida_materiales')
          .select('material, unidad, rendimiento, precio_unitario, partida_id')
          .in('partida_id', partIds).eq('user_id', user.id)
      : { data: [] as any[] }

    // Agrupar por material + unidad
    const grupos: Record<string, { material: string; unidad: string; cantidad: number; precio_unitario: number }> = {}
    for (const m of mats ?? []) {
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

  // ── Resumen agregado para las métricas (usa el total guardado) ──
  if (sp.get('resumen')) {
    const { data, error } = await supabase
      .from('ordenes_compra').select('estado, total').eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const rows = data ?? []
    return NextResponse.json({
      total_count: rows.length,
      borrador:    rows.filter((o: any) => o.estado === 'borrador').length,
      recibidas:   rows.filter((o: any) => o.estado === 'recibida').length,
      monto_total: rows.filter((o: any) => o.estado !== 'anulada').reduce((s: number, o: any) => s + (Number(o.total) || 0), 0),
    })
  }

  // ── Lista de OCs (paginada / con búsqueda server-side) ──
  const buscar = sp.get('buscar')
  const limit = Math.min(Number(sp.get('limit')) || 60, 500)
  let q = supabase.from('ordenes_compra').select('*').eq('user_id', user.id)
  if (buscar) {
    const term = buscar.trim().replace(/[,()%*\\]/g, '')
    if (term) q = q.or(`proveedor.ilike.%${term}%,proyecto.ilike.%${term}%`)
  }
  q = q.order('numero', { ascending: false }).limit(buscar ? 40 : limit)
  const { data, error } = await q
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

// Sincroniza el gasto asociado a una OC: crea/actualiza al "recibir", lo elimina si no.
async function syncGastoOC(supabase: any, userId: string, oc: any) {
  const { data: existing } = await supabase
    .from('gastos_obra').select('id').eq('orden_compra_id', oc.id).eq('user_id', userId).maybeSingle()

  if (oc?.estado === 'recibida' && oc?.proyecto_id && !oc?.factura_id) {
    const row = {
      proyecto_id: oc.proyecto_id,
      partida_id: null,
      fecha: oc.fecha || new Date().toISOString().split('T')[0],
      descripcion: `OC #${oc.numero}${oc.proveedor ? ' · ' + oc.proveedor : ''}`,
      monto: Number(oc.neto) || 0,
      orden_compra_id: oc.id,
      user_id: userId,
    }
    if (existing) await supabase.from('gastos_obra').update(row).eq('id', existing.id).eq('user_id', userId)
    else await supabase.from('gastos_obra').insert(row)
  } else if (existing) {
    await supabase.from('gastos_obra').delete().eq('id', existing.id).eq('user_id', userId)
  }
}

// ─── POST: crear OC ───────────────────────────────────────
export async function POST(req: Request) {
  const supabase = await createServerSupabase()
  const ro = await guardEscritura(supabase, 'obra')
  if (ro) return ro
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

  await syncGastoOC(supabase, user.id, oc)
  return NextResponse.json({ ...oc, lineas })
}

// ─── PUT: actualizar OC (estado, datos y/o líneas) ────────
export async function PUT(req: Request) {
  const supabase = await createServerSupabase()
  const ro = await guardEscritura(supabase, 'obra')
  if (ro) return ro
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
  if (body.factura_id   !== undefined) update.factura_id   = body.factura_id || null

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

  // Al asociar una factura, atribuirla al proyecto de la OC (así cuenta en su gasto)
  if (data?.factura_id && data?.proyecto) {
    await supabase.from('facturas')
      .update({ proyecto: data.proyecto })
      .eq('id', data.factura_id).eq('user_id', user.id)
  }

  await syncGastoOC(supabase, user.id, data)
  return NextResponse.json(data)
}

// ─── DELETE ───────────────────────────────────────────────
export async function DELETE(req: Request) {
  const supabase = await createServerSupabase()
  const ro = await guardEscritura(supabase, 'obra')
  if (ro) return ro
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await req.json()
  // Quita el gasto asociado (si la OC estaba recibida) antes de borrarla
  await supabase.from('gastos_obra').delete().eq('orden_compra_id', id).eq('user_id', user.id)
  const { error } = await supabase.from('ordenes_compra').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}