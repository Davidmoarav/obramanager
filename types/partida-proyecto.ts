// types/partida-proyecto.ts

export interface PartidaProyecto {
  id: string
  proyecto_id: string
  parent_id?: string | null    // null = partida padre, uuid = sub-partida
  orden: number
  descripcion: string
  unidad: string
  cantidad: number
  precio_unitario: number
  avance: number
  notas?: string
  user_id?: string
  created_at?: string
  children?: PartidaProyecto[] // sub-partidas (solo en frontend)
}
