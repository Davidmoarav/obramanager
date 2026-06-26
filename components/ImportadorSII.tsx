'use client'
// components/ImportadorSII.tsx
// Sube el CSV del Registro de Compras y Ventas del SII, lo parsea,
// detecta columnas por nombre, identifica tipo de documento y previsualiza.

import { useState } from 'react'
import { Btn, Modal } from '@/components/ui'
import { fmt } from '@/lib/format'

// Mapeo de código de tipo de documento SII → nuestro doc_tipo
const TIPO_DOC_SII: Record<string, string> = {
  '33': 'factura', '34': 'factura', '56': 'nota_debito', '61': 'nota_credito',
  '39': 'factura', '41': 'factura', '46': 'factura', '110': 'factura',
}

interface FilaSII {
  numero: string
  contraparte: string
  rut: string
  neto: number
  exento?: number
  iva: number
  total: number
  emision: string | null
  periodo: string | null
  doc_tipo: string
}

interface Props {
  onImported?: () => void
}

export default function ImportadorSII({ onImported }: Props) {
  const [open, setOpen]       = useState(false)
  const [tipo, setTipo]       = useState<'compra' | 'venta'>('compra')
  const [filas, setFilas]     = useState<FilaSII[]>([])
  const [nombreArchivo, setNombreArchivo] = useState('')
  const [importing, setImporting] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [error, setError]     = useState('')
  // Cuando el archivo es SOLO notas (sin columna Tipo Doc), forzar el tipo
  const [docForzado, setDocForzado] = useState<'auto' | 'nota_credito' | 'nota_debito'>('auto')

  // Parsea fecha SII (DD-MM-AA o DD-MM-AAAA) → YYYY-MM-DD
  const parseFecha = (s: string): string | null => {
    if (!s) return null
    const limpio = s.trim().split(' ')[0]  // quitar hora si viene
    const partes = limpio.split(/[-/]/)
    if (partes.length !== 3) return null
    let [d, m, a] = partes
    if (a.length === 2) a = '20' + a
    return `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // Normaliza nombre de columna para buscar (sin tildes, minúsculas)
  const norm = (s: string) => s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')

  const procesarArchivo = (file: File) => {
    setError(''); setResultado(null)
    setNombreArchivo(file.name)

    // Detectar tipo por nombre de archivo
    if (/venta/i.test(file.name)) setTipo('venta')
    else if (/compra/i.test(file.name)) setTipo('compra')

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const texto = e.target?.result as string
        const lineas = texto.split(/\r?\n/).filter(l => l.trim())
        if (lineas.length < 2) { setError('El archivo está vacío o no tiene datos'); return }

        // Detectar separador (; o ,)
        const sep = lineas[0].includes(';') ? ';' : ','
        const header = lineas[0].split(sep).map(h => norm(h))

        // Buscar índices de columnas por nombre (flexible)
        const idx = (nombres: string[]) => {
          for (const n of nombres) {
            const i = header.findIndex(h => h.includes(norm(n)))
            if (i >= 0) return i
          }
          return -1
        }

        const iFolio  = idx(['folio'])
        const iRut    = idx(['rutproveedor', 'rutcliente', 'rut'])
        const iRazon  = idx(['razonsocial', 'razon'])
        const iFecha  = idx(['fechadocto', 'fechaemision', 'fecha'])
        const iNeto   = idx(['montoneto', 'neto'])
        const iExento = idx(['montoexento', 'exento'])
        const iIva    = idx(['montoivarecuperable', 'ivarecuperable', 'montoiva', 'iva'])
        const iTotal  = idx(['montototal', 'total'])
        const iTipoDoc= idx(['tipodoc', 'tipodte', 'tipodocumento'])

        if (iNeto < 0 || iTotal < 0) {
          setError('No se reconocen las columnas del archivo. ¿Es un RCV del SII?')
          return
        }

        const parsed: FilaSII[] = []
        for (let i = 1; i < lineas.length; i++) {
          const c = lineas[i].split(sep)
          const neto = Number((c[iNeto] || '0').replace(/[^\d-]/g, '')) || 0
          const exento = iExento >= 0 ? (Number((c[iExento] || '0').replace(/[^\d-]/g, '')) || 0) : 0
          const total = Number((c[iTotal] || '0').replace(/[^\d-]/g, '')) || 0
          if (neto === 0 && total === 0 && exento === 0) continue

          const emision = iFecha >= 0 ? parseFecha(c[iFecha]) : null
          const codTipo = iTipoDoc >= 0 ? (c[iTipoDoc] || '').trim() : '33'

          parsed.push({
            numero: iFolio >= 0 ? (c[iFolio] || '').trim() : '',
            contraparte: iRazon >= 0 ? (c[iRazon] || '').trim() : 'Sin nombre',
            rut: iRut >= 0 ? (c[iRut] || '').trim() : '',
            neto: neto + exento,   // el neto total incluye lo exento (sin IVA)
            exento,
            iva: iIva >= 0 ? (Number((c[iIva] || '0').replace(/[^\d-]/g, '')) || 0) : 0,
            total,
            emision,
            periodo: emision ? emision.slice(0, 7) : null,
            doc_tipo: TIPO_DOC_SII[codTipo] || 'factura',
          })
        }

        if (parsed.length === 0) { setError('No se encontraron facturas válidas en el archivo'); return }
        setFilas(parsed)
      } catch (err: any) {
        setError('Error al leer el archivo: ' + (err?.message || 'desconocido'))
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const totales = filas.reduce((acc, f) => ({
    neto: acc.neto + f.neto,
    iva: acc.iva + f.iva,
    total: acc.total + f.total,
    nc: acc.nc + (f.doc_tipo === 'nota_credito' ? 1 : 0),
    nd: acc.nd + (f.doc_tipo === 'nota_debito' ? 1 : 0),
  }), { neto: 0, iva: 0, total: 0, nc: 0, nd: 0 })

  const confirmar = async () => {
    setImporting(true); setError('')
    // Si el usuario forzó un tipo (archivo solo de notas), aplicarlo a todas
    const filasFinal = docForzado === 'auto'
      ? filas
      : filas.map(f => ({ ...f, doc_tipo: docForzado }))
    const res = await fetch('/api/importar-sii', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filas: filasFinal, tipo }),
    })
    const data = await res.json()
    setImporting(false)
    if (!res.ok) { setError(data.error || 'Error al importar'); return }
    setResultado(data)
    onImported?.()
  }

  const reset = () => { setFilas([]); setNombreArchivo(''); setResultado(null); setError(''); setDocForzado('auto') }

  return (
    <>
      <Btn onClick={() => setOpen(true)} style={{ background: '#e6f4ed', borderColor: '#b9e0c9', color: '#1a7a4a', fontWeight: 700 }}>
        📥 Importar del SII
      </Btn>

      {open && (
        <Modal title="Importar Registro de Compras/Ventas (SII)" onClose={() => { setOpen(false); reset() }}>
          {!resultado ? (
            <>
              <p className="text-[13px] text-muted mb-4">
                Sube el archivo CSV que descargaste del SII (Registro de Compras y Ventas). El sistema detecta las columnas automáticamente.
              </p>

              {/* Tipo */}
              <div className="mb-4">
                <label className="label-base">Tipo de registro</label>
                <div className="flex gap-2">
                  <button onClick={() => setTipo('compra')}
                    className={`flex-1 py-2.5 rounded-lg border-[1.5px] text-[13px] font-bold transition ${tipo === 'compra' ? 'border-accent bg-accent-bg text-accent' : 'border-line2 text-muted'}`}>
                    📥 Compras (IVA crédito)
                  </button>
                  <button onClick={() => setTipo('venta')}
                    className={`flex-1 py-2.5 rounded-lg border-[1.5px] text-[13px] font-bold transition ${tipo === 'venta' ? 'border-success bg-success-bg text-success' : 'border-line2 text-muted'}`}>
                    📤 Ventas (IVA débito)
                  </button>
                </div>
              </div>

              {/* Carga de archivo */}
              <label className="block border-2 border-dashed border-line2 rounded-xl p-6 text-center cursor-pointer hover:border-brand hover:bg-brand-bg/30 transition mb-4">
                <input type="file" accept=".csv" className="hidden"
                  onChange={e => e.target.files?.[0] && procesarArchivo(e.target.files[0])} />
                <div className="text-3xl mb-2">📄</div>
                <div className="text-[13px] font-semibold text-ink">{nombreArchivo || 'Haz clic para elegir el CSV del SII'}</div>
                <div className="text-[11px] text-muted mt-1">Archivo .csv separado por ; o ,</div>
              </label>

              {error && (
                <div className="bg-danger-bg border border-[#f5c6c2] text-danger px-3 py-2.5 rounded-lg text-[12px] mb-4">{error}</div>
              )}

              {/* Previsualización */}
              {filas.length > 0 && (
                <>
                  <div className="bg-canvas border border-line rounded-xl p-4 mb-4">
                    <div className="text-[11px] font-bold text-muted uppercase tracking-wide mb-3">Resumen del archivo</div>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div><div className="text-[11px] text-muted">Documentos</div><div className="text-base font-bold text-ink">{filas.length}</div></div>
                      <div><div className="text-[11px] text-muted">Neto</div><div className="text-base font-bold text-ink">{fmt(totales.neto)}</div></div>
                      <div><div className="text-[11px] text-muted">IVA {tipo === 'compra' ? 'crédito' : 'débito'}</div><div className="text-base font-bold" style={{ color: tipo === 'compra' ? '#1a7a4a' : '#1e6bb8' }}>{fmt(totales.iva)}</div></div>
                    </div>
                    {(totales.nc > 0 || totales.nd > 0) && (
                      <div className="flex gap-3 text-[11px] text-muted pt-2 border-t border-line">
                        {totales.nc > 0 && <span>➖ {totales.nc} nota(s) de crédito</span>}
                        {totales.nd > 0 && <span>➕ {totales.nd} nota(s) de débito</span>}
                      </div>
                    )}
                  </div>

                  {/* Forzar tipo de documento (para archivos de solo notas sin columna Tipo Doc) */}
                  <div className="bg-canvas border border-line rounded-xl p-4 mb-4">
                    <label className="label-base">¿Qué tipo de documento contiene este archivo?</label>
                    <select value={docForzado} onChange={e => setDocForzado(e.target.value as any)} className="input-base cursor-pointer">
                      <option value="auto">Detectar automático (facturas, o por código si existe)</option>
                      <option value="nota_credito">➖ Todo son notas de CRÉDITO</option>
                      <option value="nota_debito">➕ Todo son notas de DÉBITO</option>
                    </select>
                    <p className="text-[11px] text-muted mt-1.5">
                      Si el SII te entrega las notas en un archivo separado (sin columna de tipo), elige aquí qué son.
                    </p>
                  </div>

                  {/* Primeras filas */}
                  <div className="max-h-[160px] overflow-y-auto mb-4 border border-line rounded-lg">
                    <table className="w-full text-[11px]">
                      <thead className="bg-canvas sticky top-0">
                        <tr><th className="text-left px-2 py-1.5 text-muted font-semibold">Folio</th><th className="text-left px-2 py-1.5 text-muted font-semibold">Proveedor/Cliente</th><th className="text-right px-2 py-1.5 text-muted font-semibold">Neto</th><th className="text-right px-2 py-1.5 text-muted font-semibold">IVA</th></tr>
                      </thead>
                      <tbody>
                        {filas.slice(0, 30).map((f, i) => (
                          <tr key={i} className="border-t border-[#f0f4f8]">
                            <td className="px-2 py-1.5">{f.numero}</td>
                            <td className="px-2 py-1.5 truncate max-w-[140px]">{f.contraparte}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(f.neto)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(f.iva)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filas.length > 30 && <div className="text-center text-[10px] text-muted py-1.5">… y {filas.length - 30} más</div>}
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Btn onClick={reset}>Cambiar archivo</Btn>
                    <Btn variant="primary" onClick={confirmar} disabled={importing}>
                      {importing ? 'Importando…' : `Importar ${filas.length} documentos`}
                    </Btn>
                  </div>
                </>
              )}
            </>
          ) : (
            /* Resultado */
            <div className="text-center py-4">
              <div className="text-4xl mb-3">✅</div>
              <div className="text-base font-bold text-ink mb-2">Importación completada</div>
              <div className="text-[13px] text-muted mb-1">{resultado.insertadas} factura(s) importada(s)</div>
              {resultado.duplicadas > 0 && (
                <div className="text-[12px] text-warning mb-4">{resultado.duplicadas} ya existían (omitidas)</div>
              )}
              <div className="flex gap-2 justify-center mt-4">
                <Btn onClick={reset}>Importar otro archivo</Btn>
                <Btn variant="primary" onClick={() => { setOpen(false); reset() }}>Listo</Btn>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
