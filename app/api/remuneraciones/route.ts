// app/api/remuneraciones/route.ts
// Genera/guarda liquidaciones de un período
import { createServerSupabase } from '@/lib/supabase-server'
import { guardModulo } from '@/lib/roles'
import { NextResponse, type NextRequest } from 'next/server'

// Sincroniza el gasto de mano de obra: si el empleado está asignado a una obra,
// su liquidación cuenta como gasto de esa obra (idempotente por liquidacion_id).
async function syncGastoManoObra(supabase: any, userId: string, liq: any) {
  const { data: emp } = await supabase
    .from('empleados').select('proyecto_id, nombre').eq('id', liq.empleado_id).eq('user_id', userId).maybeSingle()
  const { data: existing } = await supabase
    .from('gastos_obra').select('id').eq('liquidacion_id', liq.id).eq('user_id', userId).maybeSingle()

  if (emp?.proyecto_id && (Number(liq.total_haberes) || 0) > 0) {
    const row = {
      proyecto_id: emp.proyecto_id,
      partida_id: null,
      fecha: `${liq.periodo}-01`,
      categoria: 'mano de obra',
      descripcion: `Sueldo ${emp.nombre || ''} · ${liq.periodo}`,
      monto: Math.round(Number(liq.total_haberes) || 0),
      liquidacion_id: liq.id,
      user_id: userId,
    }
    if (existing) await supabase.from('gastos_obra').update(row).eq('id', existing.id).eq('user_id', userId)
    else await supabase.from('gastos_obra').insert(row)
  } else if (existing) {
    await supabase.from('gastos_obra').delete().eq('id', existing.id).eq('user_id', userId)
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const denied = await guardModulo(supabase, 'remuneraciones')
  if (denied) return denied
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
  const denied = await guardModulo(supabase, 'remuneraciones')
  if (denied) return denied
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

  await syncGastoManoObra(supabase, user.id, result)
  return NextResponse.json(result)
}

// Marcar como pagada / cambiar estado
export async function PUT(req: Request) {
  const supabase = await createServerSupabase()
  const denied = await guardModulo(supabase, 'remuneraciones')
  if (denied) return denied
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