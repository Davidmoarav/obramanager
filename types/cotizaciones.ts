// types/cotizaciones.ts  — REEMPLAZAR ARCHIVO EXISTENTE

export type EstadoCotizacion = 'borrador' | 'enviada' | 'aprobada' | 'rechazada' | 'convertida'

export interface PartidaCotizacion {
  id: string
  cotizacion_id?: string
  orden: number
  descripcion: string
  unidad: string
  cantidad: number
  precio_unitario: number
  created_at?: string
}

export interface Cotizacion {
  id: string
  numero?: string
  cliente_id?: string
  cliente: string
  proyecto_nombre?: string
  proyecto_id?: string          // ← NUEVO: vínculo al proyecto creado
  descripcion?: string
  fecha?: string
  validez_dias: number
  estado: EstadoCotizacion
  notas?: string
  user_id?: string
  created_at?: string
  partidas?: PartidaCotizacion[]
}

export const UNIDADES = [
  { value: 'un', label: 'unidad' },
  { value: 'm2', label: 'm²' },
  { value: 'm3', label: 'm³' },
  { value: 'ml', label: 'ml (metro lineal)' },
  { value: 'kg', label: 'kg' },
  { value: 'gl', label: 'global' },
  { value: 'hh', label: 'HH (hora hombre)' },
  { value: 'dia', label: 'día' },
  { value: 'mes', label: 'mes' },
]
