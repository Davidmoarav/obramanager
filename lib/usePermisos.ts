'use client'
// lib/usePermisos.ts
// Saber, en el cliente, si el usuario puede editar el módulo de obra.
// El permiso REAL se aplica en el servidor; esto solo ajusta la interfaz.

import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'

// Espejo de SOLO_LECTURA en lib/roles.ts
const SOLO_LECTURA: Record<string, string[]> = {
  obra: ['contador'],
}

export function usePermisos(modulo = 'obra') {
  const { data } = useSWR<any>('/api/mi-rol', fetcher)
  const rol = data?.rol || 'admin'
  const soloLectura = (SOLO_LECTURA[modulo] ?? []).includes(rol)
  return {
    rol,
    soloLectura,
    puedeEditar: !soloLectura,
    esAdmin: rol === 'admin',
    cargando: !data,
  }
}