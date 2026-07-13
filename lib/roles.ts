// lib/roles.ts
// Resolución de rol del usuario actual y control de acceso por módulo.
import { NextResponse } from 'next/server'

export type Rol = 'admin' | 'contador' | 'jefe_obra'

// Módulos restringidos y qué roles pueden acceder (autoritativo, server-side).
// Lo que no esté acá, lo pueden ver todos los roles.
export const MODULOS_POR_ROL: Record<string, Rol[]> = {
  facturacion:    ['admin', 'contador'],
  finanzas:       ['admin', 'contador'],
  iva:            ['admin', 'contador'],
  ppm:            ['admin', 'contador'],
  remuneraciones: ['admin', 'contador'],
  usuarios:       ['admin'],
  config_empresa: ['admin'],
}

export function rolPermiteModulo(rol: Rol, modulo: string): boolean {
  const permitidos = MODULOS_POR_ROL[modulo]
  return !permitidos || permitidos.includes(rol)
}

// Devuelve { userId, email, rol, ownerId } del usuario actual.
// Si tiene membresía activa → usa su rol y el dueño de esa organización.
// Si no → es dueño de su propia organización (admin).
export async function getRolActual(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: m } = await supabase
    .from('miembros')
    .select('rol, owner_id')
    .eq('member_user_id', user.id)
    .eq('estado', 'activo')
    .maybeSingle()
  if (m) return { userId: user.id, email: user.email, rol: m.rol as Rol, ownerId: m.owner_id }
  return { userId: user.id, email: user.email, rol: 'admin' as Rol, ownerId: user.id }
}

// Guarda de módulo para endpoints sensibles. Devuelve una respuesta 401/403
// si el usuario no puede, o null si tiene permiso.
export async function guardModulo(supabase: any, modulo: string) {
  const info = await getRolActual(supabase)
  if (!info) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!rolPermiteModulo(info.rol, modulo)) {
    return NextResponse.json({ error: 'No tienes permiso para este módulo' }, { status: 403 })
  }
  return null
}