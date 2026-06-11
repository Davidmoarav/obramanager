// app/api/iva/route.ts
// Devuelve resumen de IVA por período: débito (ventas) vs crédito (compras)
import { createServerSupabase } from '@/lib/supabase-server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: facturas, error } = await supabase
    .from('facturas')
    .select('*')
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const arr = facturas ?? []

  // Agrupar por periodo
  const periodos: Record<string, {
    periodo: string
    iva_debito: number
    iva_credito: number
    neto_ventas: number
    neto_compras: number
    n_ventas: number
    n_compras: number
  }> = {}

  for (const f of arr) {
    const per = f.periodo || (f.emision ? f.emision.slice(0, 7) : 'sin-periodo')
    if (!periodos[per]) {
      periodos[per] = { periodo: per, iva_debito: 0, iva_credito: 0, neto_ventas: 0, neto_compras: 0, n_ventas: 0, n_compras: 0 }
    }
    const iva = Number(f.iva) || 0
    const neto = Number(f.neto) || 0
    if (f.tipo === 'compra') {
      periodos[per].iva_credito += iva
      periodos[per].neto_compras += neto
      periodos[per].n_compras += 1
    } else {
      periodos[per].iva_debito += iva
      periodos[per].neto_ventas += neto
      periodos[per].n_ventas += 1
    }
  }

  const resumen = Object.values(periodos)
    .map(p => ({ ...p, iva_a_pagar: p.iva_debito - p.iva_credito }))
    .sort((a, b) => b.periodo.localeCompare(a.periodo))

  return NextResponse.json(resumen)
}
