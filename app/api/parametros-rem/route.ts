// app/api/parametros-rem/route.ts
import { createServerSupabase } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const DEFAULTS = {
  afp_pct: 10.00, afp_comision_pct: 1.44, salud_pct: 7.00,
  afc_trabajador_pct: 0.60, afc_empleador_pct: 2.40,
  uf_valor: 39000, utm_valor: 68000, tope_imponible_uf: 87.80,
  gratificacion_tope: 209396, colacion_default: 0, movilizacion_default: 0,
}

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('parametros_remuneracion')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Si no existe, devolver defaults (sin guardar aún)
  return NextResponse.json(data ?? { ...DEFAULTS })
}

export async function PUT(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { id, created_at, user_id, ...payload } = body

  const { data, error } = await supabase
    .from('parametros_remuneracion')
    .upsert({ ...payload, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
