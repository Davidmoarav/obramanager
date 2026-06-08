// types/documento.ts

export type CategoriaDocumento = 'plano' | 'foto' | 'contrato' | 'permiso' | 'especificacion' | 'presupuesto' | 'general'

export interface Documento {
  id: string
  proyecto_id: string
  nombre: string
  descripcion?: string
  categoria: CategoriaDocumento
  archivo_path: string
  archivo_tipo?: string
  archivo_size: number
  user_id?: string
  created_at?: string
}

export const CATEGORIAS_DOC: { value: CategoriaDocumento; label: string; icon: string }[] = [
  { value: 'plano',          label: 'Plano / DWG',      icon: '📐' },
  { value: 'foto',           label: 'Foto de obra',     icon: '📷' },
  { value: 'contrato',       label: 'Contrato',         icon: '📄' },
  { value: 'permiso',        label: 'Permiso / DOM',    icon: '🏛' },
  { value: 'especificacion', label: 'Especificación',   icon: '📋' },
  { value: 'presupuesto',    label: 'Presupuesto',      icon: '💰' },
  { value: 'general',        label: 'General',          icon: '📁' },
]
