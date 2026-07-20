'use client'
// components/ImportarExcelPartidas.tsx
// Lee un Excel de análisis económico (subproyecto en col A, etapa en col C,
// partida en col F, con material y HH) y crea el árbol de 3 niveles.
// Usa SheetJS (xlsx) que corre en el navegador.

import { useState } from 'react'
import { Btn, Modal } from '@/components/ui'
import { fmt } from '@/lib/format'

// Mapeo de columnas (índice base 0). Ajustable si tu planilla cambia.
const COL = { sub: 0, etapa: 2, partida: 5, unidad: 6, cantidad: 8, material: 10, hh: 12 }

interface Sub { nombre: string; etapas: { nombre: string; partidas: any[] }[] }

export default function ImportarExcelPartidas({ proyectoId, markup = 20, onImported, onClose }: {
  proyectoId: string
  markup?: number
  onImported: () => void
  onClose: () => void
}) {
  const [parsed, setParsed] = useState<Sub[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [expandido, setExpandido] = useState<number | null>(0)

  const num = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n }

  const leerArchivo = async (file: File) => {
    setError(''); setParsed(null); setFileName(file.name)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })

      // Elegir la hoja con más filas (la del análisis, no las de listas)
      let hoja = wb.SheetNames[0]
      let maxRows = 0
      for (const nombre of wb.SheetNames) {
        const rng = XLSX.utils.decode_range(wb.Sheets[nombre]['!ref'] || 'A1')
        if (rng.e.r > maxRows) { maxRows = rng.e.r; hoja = nombre }
      }
      const ws = wb.Sheets[hoja]
      const filas: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true })

      // Detectar la fila de encabezado (la que dice PARTIDA / U/M) para empezar debajo
      let inicio = 2
      for (let i = 0; i < Math.min(filas.length, 10); i++) {
        const rowText = (filas[i] || []).map(c => String(c || '').toUpperCase()).join(' ')
        if (rowText.includes('PARTIDA') && (rowText.includes('U/M') || rowText.includes('CANT'))) {
          inicio = i + 1; break
        }
      }

      // Parsear con arrastre de subproyecto (A) y etapa (C)
      const subs: Sub[] = []
      let curSub: Sub | null = null
      let curEtapa: { nombre: string; partidas: any[] } | null = null

      for (let r = inicio; r < filas.length; r++) {
        const row = filas[r] || []
        const a = String(row[COL.sub] || '').trim()
        const c = String(row[COL.etapa] || '').trim()
        const f = String(row[COL.partida] || '').trim()

        if (a) { curSub = { nombre: a, etapas: [] }; subs.push(curSub); curEtapa = null }
        if (c && curSub) { curEtapa = { nombre: c, partidas: [] }; curSub.etapas.push(curEtapa) }
        if (!f || !curSub) continue

        // Partida sin etapa explícita: crear una etapa "General"
        if (!curEtapa) { curEtapa = { nombre: 'General', partidas: [] }; curSub.etapas.push(curEtapa) }

        curEtapa.partidas.push({
          descripcion: f,
          unidad: String(row[COL.unidad] || 'm2').trim(),
          cantidad: num(row[COL.cantidad]),
          material: num(row[COL.material]),
          mano_obra: num(row[COL.hh]),
        })
      }

      const conPartidas = subs.filter(s => s.etapas.some(e => e.partidas.length > 0))
      if (conPartidas.length === 0) {
        setError('No se reconocieron partidas. Verifica que la planilla tenga el subproyecto en la columna A, la etapa en la C y la partida en la F.')
        return
      }
      setParsed(conPartidas)
    } catch (e: any) {
      setError('No se pudo leer el archivo: ' + (e.message || 'formato no válido'))
    }
  }

  const totales = parsed ? {
    subs: parsed.length,
    partidas: parsed.reduce((s, sub) => s + sub.etapas.reduce((a, e) => a + e.partidas.length, 0), 0),
    costo: parsed.reduce((s, sub) => s + sub.etapas.reduce((a, e) =>
      a + e.partidas.reduce((x, p) => x + p.cantidad * (p.material + p.mano_obra), 0), 0), 0),
  } : null

  const confirmar = async () => {
    if (!parsed) return
    setImporting(true); setError('')
    const res = await fetch('/api/partidas-proyecto/importar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proyecto_id: proyectoId, subproyectos: parsed, markup }),
    })
    const data = await res.json()
    setImporting(false)
    if (!res.ok) { setError(data.error || 'Error al importar'); return }
    onImported(); onClose()
  }

  return (
    <Modal title="Importar partidas desde Excel" onClose={onClose}>
      {!parsed ? (
        <div>
          <p className="text-[13px] text-muted mb-3">
            Sube tu planilla de análisis económico. Debe tener el <strong>subproyecto</strong> en la columna A,
            la <strong>etapa</strong> en la C, y la <strong>partida</strong> en la F (con unidad, cantidad, material y HH).
          </p>
          <label className="block border-2 border-dashed border-line rounded-xl p-8 text-center cursor-pointer hover:border-brand hover:bg-brand-bg/30 transition">
            <input type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) leerArchivo(f) }} />
            <div className="text-3xl mb-2">📊</div>
            <div className="text-[13px] font-semibold text-brand">Elegir archivo Excel</div>
            <div className="text-[11px] text-muted mt-1">.xlsx o .xls</div>
          </label>
          {fileName && !error && <p className="text-[12px] text-muted mt-2">Leyendo: {fileName}…</p>}
          {error && <p className="text-[12px] text-danger mt-3 bg-danger-bg rounded-lg p-2.5">{error}</p>}
        </div>
      ) : (
        <div>
          {/* Resumen */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-canvas rounded-lg p-2.5 text-center">
              <div className="text-lg font-extrabold text-ink">{totales!.subs}</div>
              <div className="text-[10px] text-muted">Subproyectos</div>
            </div>
            <div className="bg-canvas rounded-lg p-2.5 text-center">
              <div className="text-lg font-extrabold text-ink">{totales!.partidas}</div>
              <div className="text-[10px] text-muted">Partidas</div>
            </div>
            <div className="bg-canvas rounded-lg p-2.5 text-center">
              <div className="text-sm font-extrabold text-ink">{fmt(totales!.costo)}</div>
              <div className="text-[10px] text-muted">Costo total</div>
            </div>
          </div>

          {/* Vista previa del árbol */}
          <div className="text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">Vista previa</div>
          <div className="max-h-[280px] overflow-y-auto flex flex-col gap-1 mb-3">
            {parsed.map((sub, i) => {
              const npart = sub.etapas.reduce((a, e) => a + e.partidas.length, 0)
              const abierto = expandido === i
              return (
                <div key={i} className="border border-line rounded-lg overflow-hidden">
                  <button onClick={() => setExpandido(abierto ? null : i)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-white text-left">
                    <span className="text-[10px] text-muted" style={{ transform: abierto ? 'rotate(90deg)' : 'none' }}>▶</span>
                    <span className="text-[11px] font-bold text-brand bg-[#e8f1fb] px-1.5 py-0.5 rounded">{i + 1}</span>
                    <span className="text-[12px] font-bold text-ink flex-1 truncate">{sub.nombre}</span>
                    <span className="text-[10px] text-muted">{sub.etapas.length} etapas · {npart} partidas</span>
                  </button>
                  {abierto && (
                    <div className="px-3 py-2 bg-[#fafbfc] border-t border-line2">
                      {sub.etapas.map((et, j) => (
                        <div key={j} className="mb-1.5">
                          <div className="text-[11px] font-semibold text-ink">{i + 1}.{j + 1} {et.nombre}</div>
                          {et.partidas.map((p, k) => (
                            <div key={k} className="flex justify-between text-[10px] text-muted pl-3 py-0.5">
                              <span className="truncate">• {p.descripcion} ({p.cantidad} {p.unidad})</span>
                              <span className="flex-shrink-0 ml-2">{fmt(p.cantidad * (p.material + p.mano_obra))}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <p className="text-[11px] text-muted mb-2">
            Se crearán como árbol de 3 niveles. El precio de venta se calcula con tu markup ({markup}%).
            Podrás editar todo después.
          </p>
          {error && <p className="text-[12px] text-danger mb-2 bg-danger-bg rounded-lg p-2.5">{error}</p>}

          <div className="flex gap-2 justify-end">
            <Btn onClick={() => { setParsed(null); setFileName('') }}>Elegir otro</Btn>
            <Btn variant="primary" onClick={confirmar} disabled={importing}>
              {importing ? 'Importando…' : `Importar ${totales!.partidas} partidas`}
            </Btn>
          </div>
        </div>
      )}
    </Modal>
  )
}