// types/finanzas.ts

export interface ParametrosRemuneracion {
  id?: string
  user_id?: string
  afp_pct: number
  afp_comision_pct: number
  salud_pct: number
  afc_trabajador_pct: number
  afc_empleador_pct: number
  uf_valor: number
  utm_valor: number
  tope_imponible_uf: number
  gratificacion_tope: number
  colacion_default: number
  movilizacion_default: number
  updated_at?: string
}

export interface EmpleadoPrevisional {
  id: string
  nombre: string
  rut?: string
  cargo?: string
  sueldo: number
  horas_extra: number
  estado: string
  tipo: string
  // Previsional
  afp_nombre?: string
  afp_pct_custom?: number | null
  salud_sistema?: 'Fonasa' | 'Isapre'
  salud_pct_custom?: number | null
  salud_uf?: number
  contrato_tipo?: 'indefinido' | 'plazo_fijo' | 'obra_faena'
  colacion?: number
  movilizacion?: number
  bono_imponible?: number
  otros_descuentos?: number
}

export interface Liquidacion {
  id: string
  empleado_id: string
  periodo: string
  sueldo_base: number
  horas_extra_monto: number
  gratificacion: number
  bono_imponible: number
  colacion: number
  movilizacion: number
  total_imponible: number
  total_haberes: number
  desc_afp: number
  desc_salud: number
  desc_afc: number
  otros_descuentos: number
  total_descuentos: number
  liquido_pagar: number
  estado: 'borrador' | 'pagada'
  user_id?: string
  created_at?: string
  empleado?: EmpleadoPrevisional
}

export interface FacturaIVA {
  id: string
  numero?: string
  cliente: string
  proyecto?: string
  tipo: 'venta' | 'compra'
  neto: number
  iva: number
  monto: number
  emision?: string
  vencimiento?: string
  periodo?: string
  estado: string
}

// ─── Cálculo de liquidación (función pura, reutilizable) ──
export function calcularLiquidacion(
  emp: EmpleadoPrevisional,
  params: ParametrosRemuneracion
) {
  const sueldoBase = Number(emp.sueldo) || 0

  // Horas extra: valor hora = sueldo/30/8 * 1.5 (recargo 50%)
  const valorHora = sueldoBase / 30 / 8
  const horasExtraMonto = Math.round(valorHora * 1.5 * (Number(emp.horas_extra) || 0))

  const bonoImponible = Number(emp.bono_imponible) || 0

  // Gratificación legal: 25% de lo devengado con tope
  const baseGrat = sueldoBase + horasExtraMonto + bonoImponible
  const gratificacion = Math.min(Math.round(baseGrat * 0.25), params.gratificacion_tope)

  // Total imponible (con tope)
  const topeImponible = Math.round(params.tope_imponible_uf * params.uf_valor)
  const totalImponibleSinTope = sueldoBase + horasExtraMonto + bonoImponible + gratificacion
  const totalImponible = Math.min(totalImponibleSinTope, topeImponible)

  // Descuentos previsionales
  const afpPct = emp.afp_pct_custom ?? params.afp_pct
  const afpComision = params.afp_comision_pct
  const descAfp = Math.round(totalImponible * (afpPct + afpComision) / 100)

  // Salud
  let descSalud = 0
  if (emp.salud_sistema === 'Isapre' && (emp.salud_uf || 0) > 0) {
    descSalud = Math.round((emp.salud_uf || 0) * params.uf_valor)
  } else {
    const saludPct = emp.salud_pct_custom ?? params.salud_pct
    descSalud = Math.round(totalImponible * saludPct / 100)
  }

  // AFC (seguro cesantía) - solo si contrato indefinido
  const descAfc = emp.contrato_tipo === 'indefinido'
    ? Math.round(totalImponible * params.afc_trabajador_pct / 100)
    : 0

  const otrosDescuentos = Number(emp.otros_descuentos) || 0

  const totalDescuentos = descAfp + descSalud + descAfc + otrosDescuentos

  // No imponibles
  const colacion = Number(emp.colacion) || 0
  const movilizacion = Number(emp.movilizacion) || 0

  const totalHaberes = totalImponible + colacion + movilizacion
  const liquidoPagar = totalHaberes - totalDescuentos

  return {
    sueldo_base: sueldoBase,
    horas_extra_monto: horasExtraMonto,
    gratificacion,
    bono_imponible: bonoImponible,
    colacion,
    movilizacion,
    total_imponible: totalImponible,
    total_haberes: totalHaberes,
    desc_afp: descAfp,
    desc_salud: descSalud,
    desc_afc: descAfc,
    otros_descuentos: otrosDescuentos,
    total_descuentos: totalDescuentos,
    liquido_pagar: liquidoPagar,
  }
}
