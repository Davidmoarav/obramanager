'use client'
// components/SWRProvider.tsx
// Configuración global de SWR para toda la app protegida.
import { SWRConfig } from 'swr'
import { fetcher } from '@/lib/fetcher'

export default function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,  // no re-fetch cada vez que vuelves a la pestaña
        dedupingInterval: 5000,    // dedupe de llamadas idénticas dentro de 5s
        keepPreviousData: true,    // mantiene la data previa mientras carga la nueva
      }}
    >
      {children}
    </SWRConfig>
  )
}