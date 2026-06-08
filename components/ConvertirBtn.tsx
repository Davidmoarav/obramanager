'use client'
// components/ConvertirBtn.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Cotizacion } from '@/types/cotizaciones'

interface Props {
  cotizacion: Cotizacion
  onSuccess?: () => void
}

export default function ConvertirBtn({ cotizacion, onSuccess }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // Condiciones para mostrar/habilitar
  const yaConvertida = cotizacion.estado === 'convertida'
  const sinPartidas  = !cotizacion.partidas || cotizacion.partidas.length === 0
  const sinCliente   = !cotizacion.cliente_id && !cotizacion.cliente

  // Si ya está convertida, mostrar link al proyecto
  if (yaConvertida && cotizacion.proyecto_id) {
    return (
      <button
        onClick={() => router.push('/proyectos')}
        title="Ver proyecto creado"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 10px', background: '#eeedfe', color: '#534ab7',
          border: '1px solid #ccc5fc', borderRadius: 5,
          fontSize: 11, fontWeight: 700, cursor: 'pointer',
        }}>
        → Proyecto
      </button>
    )
  }

  // Si no se puede convertir, mostrar deshabilitado con tooltip
  if (sinPartidas || sinCliente) {
    const motivo = sinCliente ? 'Asigna un cliente primero' : 'Agrega al menos una partida'
    return (
      <button disabled title={motivo}
        style={{
          padding: '4px 10px', background: '#f0f4f8', color: '#a0aab8',
          border: '1px solid #d1d9e6', borderRadius: 5,
          fontSize: 11, fontWeight: 700, cursor: 'not-allowed',
        }}>
        ↗ Convertir
      </button>
    )
  }

  const convertir = async () => {
    const partidas = cotizacion.partidas?.length ?? 0
    const ok = confirm(
      `¿Convertir esta cotización en proyecto?\n\n` +
      `Cliente: ${cotizacion.cliente}\n` +
      `Partidas: ${partidas}\n\n` +
      `Se creará un proyecto activo con avance 0% y la cotización quedará bloqueada en estado "convertida".`
    )
    if (!ok) return

    setLoading(true)
    try {
      const res = await fetch('/api/cotizaciones/convertir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cotizacion_id: cotizacion.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert('Error: ' + data.error)
        setLoading(false)
        return
      }

      // Éxito: refrescar lista y ofrecer ir al proyecto
      onSuccess?.()
      const irAlProyecto = confirm(
        '✓ Proyecto creado correctamente.\n\n' +
        '¿Quieres ir al módulo de Proyectos para verlo?'
      )
      if (irAlProyecto) router.push('/proyectos')
    } catch (err: any) {
      alert('Error de red: ' + (err?.message || err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={convertir}
      disabled={loading}
      title="Convertir esta cotización en proyecto activo"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '4px 10px',
        background: loading ? '#a0aab8' : '#534ab7',
        color: '#fff', border: 'none', borderRadius: 5,
        fontSize: 11, fontWeight: 700,
        cursor: loading ? 'default' : 'pointer',
        opacity: loading ? 0.7 : 1,
      }}>
      {loading ? '...' : '↗ Convertir'}
    </button>
  )
}
