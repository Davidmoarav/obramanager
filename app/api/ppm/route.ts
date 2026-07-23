// app/api/ppm/route.ts
// Configuración de PPM (tasa + régimen) por período. Editable por el usuario,
// ya que el SII asigna/reliquida la tasa de forma particular a cada contribuyente.
import { createServerSupabase } from '@/lib/supabase-server'
import { guardModulo, getOwnerId } from '@/lib/roles'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const denied = await guardModulo(supabase, 'ppm')
  if (denied) return denied
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id

  const { data, error } = await supabase
    .from('ppm_config')
    .select('*')
    .eq('user_id', ownerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function PUT(req: NextRequest) {
  const supabase = await createServerSupabase()
  const denied = await guardModulo(supabase, 'ppm')
  if (denied) return denied
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id

  const body = await req.json()
  const periodo = body.periodo
  const regimen = body.regimen ?? 'pro_pyme_general'
  const tasa = Number(body.tasa) || 0

  if (!periodo) return NextResponse.json({ error: 'periodo es requerido' }, { status: 400 })

  const { data, error } = await supabase
    .from('ppm_config')
    .upsert(
      { user_id: ownerId, periodo, regimen, tasa, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,periodo' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}