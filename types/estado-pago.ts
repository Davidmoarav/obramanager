// types/estado-pago.ts

export interface EstadoPagoDetalle {
  id?: string
  estado_pago_id?: string
  partida_id: string
  descripcion: string
  valor_partida: number
  avance_anterior: number
  avance_actual: number
  avance_periodo: number
  monto: number
}

export interface EstadoPago {
  id: string
  proyecto_id: string
  numero: number
  periodo?: string
  fecha?: string
  monto_neto: number
  retencion_pct: number
  retencion_monto: number
  anticipo_desc: number
  monto_pagar: number
  iva: number
  total: number
  estado: 'borrador' | 'presentado' | 'aprobado' | 'pagado' | 'rechazado'
  factura_id?: string | null
  notas?: string
  user_id?: string
  created_at?: string
  detalle?: EstadoPagoDetalle[]
}

export const ESTADO_EP: Record<string, { label: string; bg: string; color: string }> = {
  borrador:   { label: 'Borrador',   bg: '#f0f4f8', color: '#6b7a8d' },
  presentado: { label: 'Presentado', bg: '#e8f1fb', color: '#1e6bb8' },
  aprobado:   { label: 'Aprobado',   bg: '#e6f4ed', color: '#1a7a4a' },
  pagado:     { label: 'Pagado',     bg: '#eeedfe', color: '#534ab7' },
  rechazado:  { label: 'Rechazado',  bg: '#fdecea', color: '#b0401a' },
}
