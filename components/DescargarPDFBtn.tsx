'use client'
// components/DescargarPDFBtn.tsx
//
// Botón que descarga el PDF de una cotización.
// Carga empresa + cliente + URL del logo justo antes de generar.

import { useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase'
import { CotizacionPDF } from './CotizacionPDF'
import type { Cotizacion } from '@/types/cotizaciones'

interface Props {
  cotizacion: Cotizacion
}

export default function DescargarPDFBtn({ cotizacion }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const generar = async () => {
    setLoading(true)
    try {
      // 1. Cargar config de empresa
      const resEmp = await fetch('/api/empresa')
      const empresa = await resEmp.json()

      // 2. Cargar cliente (si está vinculado)
      let cliente = null
      if (cotizacion.cliente_id) {
        const resCli = await fetch('/api/clientes')
        const all = await resCli.json()
        cliente = Array.isArray(all) ? all.find((c: any) => c.id === cotizacion.cliente_id) : null
      }

      // 3. Obtener URL pública del logo
      let logoUrl: string | null = null
      if (empresa?.logo_path) {
        const { data: { publicUrl } } = supabase.storage.from('empresa-logos').getPublicUrl(empresa.logo_path)
        // Convertir a base64 para evitar problemas de CORS al renderizar el PDF
        try {
          const r = await fetch(publicUrl)
          const blob = await r.blob()
          logoUrl = await new Promise<string>(resolve => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
        } catch {
          logoUrl = publicUrl  // Fallback a URL directa
        }
      }

      // 4. Generar PDF
      const blob = await pdf(
        <CotizacionPDF
          cotizacion={cotizacion}
          cliente={cliente}
          empresa={empresa}
          logoUrl={logoUrl}
        />
      ).toBlob()

      // 5. Descargar
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const nombreArchivo = `Cotizacion_${cotizacion.numero || cotizacion.id.slice(0, 8)}_${(cliente?.razon_social || cotizacion.cliente || 'cliente').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
      a.download = nombreArchivo
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert('Error al generar PDF: ' + (err?.message || err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={generar}
      disabled={loading}
      title="Descargar cotización en PDF"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        background: loading ? '#a0aab8' : '#1a7a4a',
        color: '#fff',
        border: 'none',
        borderRadius: 5,
        fontSize: 11,
        fontWeight: 700,
        cursor: loading ? 'default' : 'pointer',
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? '...' : '↓ PDF'}
    </button>
  )
}
