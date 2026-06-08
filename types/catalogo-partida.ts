// types/catalogo-partida.ts

export interface CatalogoPartida {
  id: string
  parent_id?: string | null
  descripcion: string
  unidad: string
  precio_unitario_ref: number
  orden: number
  user_id?: string
  created_at?: string
  children?: CatalogoPartida[]
}
