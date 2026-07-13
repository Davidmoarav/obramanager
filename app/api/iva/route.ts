// app/api/iva/route.ts
// Resumen de IVA por período considerando notas de crédito y débito, más PPM.
//
//   IVA Débito (ventas)  = IVA facturas venta + IVA notas débito venta − IVA notas crédito venta
//   IVA Crédito (compras)= IVA facturas compra + IVA notas débito compra − IVA notas crédito compra
//   IVA a pagar = Débito − Crédito
//   PPM = tasa% (editable, según lo informado por el SII a cada contribuyente) × ventas netas del mes
//   Total a pagar al SII = IVA a pagar + PPM
import { createServerSupabase } from '@/lib/supabase-server'
import { guardModulo } from '@/lib/roles'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const denied = await guardModulo(supabase, 'finanzas')
  if (denied) return denied
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const [{ data: facturas, error }, { data: ppmRows }] = await Promise.all([
    supabase.from('facturas').select('*').eq('user_id', user.id),
    supabase.from('ppm_config').select('*').eq('user_id', user.id),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const arr = facturas ?? []
  const ppmPorPeriodo: Record<string, { regimen: string; tasa: number }> = {}
  for (const row of ppmRows ?? []) {
    ppmPorPeriodo[row.periodo] = { regimen: row.regimen, tasa: Number(row.tasa) || 0 }
  }

  type Periodo = {
    periodo: string
    iva_debito: number
    iva_credito: number
    neto_ventas: number
    neto_compras: number
    n_ventas: number
    n_compras: number
    iva_nc_venta: number   // notas crédito venta (restan débito)
    iva_nd_venta: number   // notas débito venta (suman débito)
    iva_nc_compra: number
    iva_nd_compra: number
  }

  const periodos: Record<string, Periodo> = {}

  for (const f of arr) {
    const per = f.periodo || (f.emision ? f.emision.slice(0, 7) : 'sin-periodo')
    if (!periodos[per]) {
      periodos[per] = {
        periodo: per, iva_debito: 0, iva_credito: 0,
        neto_ventas: 0, neto_compras: 0, n_ventas: 0, n_compras: 0,
        iva_nc_venta: 0, iva_nd_venta: 0, iva_nc_compra: 0, iva_nd_compra: 0,
      }
    }
    const p = periodos[per]
    const iva = Number(f.iva) || 0
    const neto = Number(f.neto) || 0
    const docTipo = f.doc_tipo || 'factura'
    const esVenta = f.tipo !== 'compra'

    if (docTipo === 'nota_credito') {
      // Nota de crédito: resta del IVA de su tipo
      if (esVenta) { p.iva_debito -= iva; p.iva_nc_venta += iva }
      else         { p.iva_credito -= iva; p.iva_nc_compra += iva }
    } else if (docTipo === 'nota_debito') {
      // Nota de débito: suma al IVA de su tipo
      if (esVenta) { p.iva_debito += iva; p.iva_nd_venta += iva }
      else         { p.iva_credito += iva; p.iva_nd_compra += iva }
    } else {
      // Factura normal
      if (esVenta) { p.iva_debito += iva; p.neto_ventas += neto; p.n_ventas += 1 }
      else         { p.iva_credito += iva; p.neto_compras += neto; p.n_compras += 1 }
    }
  }

  // Se procesa en orden cronológico para arrastrar el remanente de crédito fiscal:
  // si el crédito supera al débito, el excedente NO se paga negativo, pasa al mes
  // siguiente. El PPM se paga siempre.
  let remanenteAcum = 0
  const resumen = Object.values(periodos)
    .sort((a, b) => a.periodo.localeCompare(b.periodo))   // ascendente para arrastrar
    .map(p => {
      const cfg = ppmPorPeriodo[p.periodo] ?? { regimen: 'pro_pyme_general', tasa: 0 }
      const ppm = Math.round(p.neto_ventas * (cfg.tasa / 100))

      const ivaDeterminado = p.iva_debito - p.iva_credito       // débito − crédito del mes
      const posicion = ivaDeterminado - remanenteAcum           // descontando remanente previo
      let iva_a_pagar: number
      let remanente: number
      if (posicion > 0) { iva_a_pagar = posicion; remanente = 0 }
      else              { iva_a_pagar = 0;        remanente = -posicion }

      const remanente_usado = remanenteAcum > 0 && posicion !== ivaDeterminado
        ? Math.min(remanenteAcum, Math.max(0, ivaDeterminado))
        : 0
      remanenteAcum = remanente   // arrastra al mes siguiente

      return {
        ...p,
        iva_determinado: ivaDeterminado,
        remanente_usado,
        remanente,                 // remanente de crédito que pasa al mes siguiente
        iva_a_pagar,
        ppm_tasa: cfg.tasa,
        ppm_regimen: cfg.regimen,
        ppm,
        total_a_pagar: iva_a_pagar + ppm,   // el PPM se paga aunque el IVA quede en 0
      }
    })
    .sort((a, b) => b.periodo.localeCompare(a.periodo))   // descendente para mostrar

  return NextResponse.json(resumen)
}