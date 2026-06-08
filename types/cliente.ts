// types/cliente.ts

export interface Cliente {
  id: string
  razon_social: string
  rut?: string
  giro?: string
  contacto?: string
  email?: string
  telefono?: string
  direccion?: string
  comuna?: string
  ciudad?: string
  notas?: string
  user_id?: string
  created_at?: string
}
