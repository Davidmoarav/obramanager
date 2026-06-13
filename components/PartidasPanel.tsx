'use client'
// components/PartidasPanel.tsx — v3 con IMPORTAR DEL CATÁLOGO (auto-contenido)

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Btn, FormInput, FormSelect, Modal } from '@/components/ui'
import { fmt } from '@/lib/format'
import { UNIDADES } from '@/types/cotizaciones'
import type { PartidaProyecto } from '@/types/partida-proyecto'
import type { CatalogoPartida } from '@/types/catalogo-partida'

const colorAvance = (pct: number) => {
  if (pct === 0) return '#d1d9e6'
  if (pct < 50) return '#e09820'
  if (pct < 100) return '#1e6bb8'
  return '#1a7a4a'
}

interface Props {
  proyectoId: string
  markupGlobal?: number
  onAvanceChange?: () => void
}

export default function PartidasPanel({ proyectoId, markupGlobal = 20, onAvanceChange }: Props) {
  const [allItems, setAllItems] = useState<PartidaProyecto[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState<{ type: 'padre' | 'hijo' | 'editar'; parentId?: string } | null>(null)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  const [showImport, setShowImport] = useState(false)
  const [catalogo, setCatalogo] = useState<CatalogoPartida[]>([])
  const [catLoading, setCatLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/partidas-proyecto?proyecto_id=${proyectoId}`)
    const data = await res.json()
    setAllItems(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [proyectoId])

  useEffect(() => { load() }, [load])

  const padres = useMemo(() => {
    const ps = allItems.filter(p => !p.parent_id).sort((a, b) => a.orden - b.orden)
    return ps.map(padre => ({
      ...padre,
      children: allItems.filter(h => h.parent_id === padre.id).sort((a, b) => a.orden - b.orden),
    }))
  }, [allItems])

  const avanceGeneral = useMemo(() => {
    if (padres.length === 0) return 0
    let totalValor = 0, totalPond = 0, suma = 0
    for (const p of padres) {
      const av = p.children.length > 0
        ? Math.round(p.children.reduce((s, h) => s + h.avance, 0) / p.children.length)
        : p.avance
      const valor = p.cantidad * p.precio_unitario
      totalValor += valor
      totalPond += valor * av / 100
      suma += av
    }
    return totalValor > 0 ? Math.round((totalPond / totalValor) * 100) : padres.length > 0 ? Math.round(suma / padres.length) : 0
  }, [padres])

  const upd = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
  const toggle = (id: string) => {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  // Precio de venta calculado en vivo (markup de la partida o el global)
  const mkActual = form.markup_pct ?? markupGlobal
  const precioVentaCalc = Math.round((Number(form.costo_unitario) || 0) * (1 + (Number(mkActual) || 0) / 100))

  const save = async () => {
    if (!form.descripcion) { alert('La descripción es obligatoria'); return }
    setSaving(true)
    const method = modal?.type === 'editar' ? 'PUT' : 'POST'
    // El precio_unitario (venta) se calcula desde costo + markup
    const esPadre = modal?.type === 'padre' || (modal?.type === 'editar' && !form.parent_id)
    const payload = {
      ...form,
      proyecto_id: proyectoId,
      parent_id: modal?.type === 'hijo' ? modal.parentId : (form.parent_id || null),
      // Solo recalcular precio en partidas padre (las que tienen costo)
      ...(esPadre ? { precio_unitario: precioVentaCalc } : {}),
    }
    const res = await fetch('/api/partidas-proyecto', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert('No se pudo guardar: ' + (err.error || 'error desconocido') +
        '\n\nSi menciona "costo_unitario" o "markup_pct", ejecuta el SQL 13_presupuesto_margen.sql en Supabase.')
      return
    }
    await load(); onAvanceChange?.(); setModal(null)
  }

  const updateAvance = async (partida: PartidaProyecto, nuevoAvance: number) => {
    setAllItems(prev => prev.map(p => p.id === partida.id ? { ...p, avance: nuevoAvance } : p))
    await fetch('/api/partidas-proyecto', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: partida.id, proyecto_id: proyectoId, avance: nuevoAvance }),
    })
    await load(); onAvanceChange?.()
  }

  const del = async (id: string) => {
    if (!confirm('¿Eliminar esta partida y todas sus sub-partidas?')) return
    await fetch('/api/partidas-proyecto', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, proyecto_id: proyectoId }),
    })
    await load(); onAvanceChange?.()
  }

  const openNewPadre = () => {
    setForm({ descripcion: '', unidad: 'gl', cantidad: 1, precio_unitario: 0, avance: 0, notas: '', orden: padres.length })
    setModal({ type: 'padre' })
  }
  const openNewHijo = (parentId: string, childCount: number) => {
    setForm({ descripcion: '', unidad: 'gl', cantidad: 1, precio_unitario: 0, avance: 0, notas: '', orden: childCount })
    setModal({ type: 'hijo', parentId })
  }
  const openEdit = (p: PartidaProyecto) => { setForm({ ...p }); setModal({ type: 'editar' }) }

  // ═══ IMPORTAR DEL CATÁLOGO ═══
  const openImport = async () => {
    setShowImport(true)
    setCatLoading(true)
    setSelected(new Set())
    const res = await fetch('/api/catalogo-partidas')
    const data = await res.json()
    setCatalogo(Array.isArray(data) ? data : [])
    setCatLoading(false)
  }

  const catalogoPadres = useMemo(() => {
    const ps = catalogo.filter(c => !c.parent_id).sort((a, b) => a.orden - b.orden)
    return ps.map(p => ({
      ...p,
      children: catalogo.filter(h => h.parent_id === p.id).sort((a, b) => a.orden - b.orden),
    }))
  }, [catalogo])

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const doImport = async () => {
    if (selected.size === 0) { alert('Selecciona al menos una partida'); return }
    setImporting(true)
    const seleccionados = catalogoPadres.filter(p => selected.has(p.id))
    for (let i = 0; i < seleccionados.length; i++) {
      const cat = seleccionados[i]
      const res = await fetch('/api/partidas-proyecto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: proyectoId, parent_id: null, descripcion: cat.descripcion,
          unidad: cat.unidad, cantidad: 1, precio_unitario: cat.precio_unitario_ref || 0, avance: 0, orden: padres.length + i,
        }),
      })
      const padreCreado = await res.json()
      if (padreCreado?.id && cat.children.length > 0) {
        for (let j = 0; j < cat.children.length; j++) {
          const sub = cat.children[j]
          await fetch('/api/partidas-proyecto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              proyecto_id: proyectoId, parent_id: padreCreado.id, descripcion: sub.descripcion,
              unidad: sub.unidad, cantidad: 1, precio_unitario: sub.precio_unitario_ref || 0, avance: 0, orden: j,
            }),
          })
        }
      }
    }
    await load(); onAvanceChange?.(); setImporting(false); setShowImport(false)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3.5">
        <div>
          <div className="text-sm font-bold text-ink">Control de obra ({padres.length} partida{padres.length !== 1 ? 's' : ''})</div>
          {padres.length > 0 && (
            <div className="text-[12px] text-muted mt-0.5">
              Avance general: <span className="font-bold" style={{ color: colorAvance(avanceGeneral) }}>{avanceGeneral}%</span>
            </div>
          )}
        </div>
        <div className="flex gap-1.5">
          <Btn onClick={openImport} style={{ fontSize: 12, padding: '5px 12px', background: '#eeedfe', borderColor: '#ccc5fc', color: '#534ab7', fontWeight: 700 }}>
            📋 Importar del catálogo
          </Btn>
          <Btn variant="primary" onClick={openNewPadre} style={{ fontSize: 12, padding: '5px 12px' }}>+ Nueva partida</Btn>
        </div>
      </div>

      {padres.length > 0 && (
        <div className="h-2.5 bg-[#e8edf2] rounded-full overflow-hidden mb-4">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${avanceGeneral}%`, background: colorAvance(avanceGeneral) }} />
        </div>
      )}

      {loading
        ? <p className="text-center py-5 text-muted">Cargando...</p>
        : padres.length === 0
        ? <div className="bg-canvas border border-dashed border-line2 rounded-lg p-7 text-center text-[12px] text-muted">
            Sin partidas de obra. Agrega una manualmente o importa desde tu catálogo.
          </div>
        : (
          <div className="flex flex-col gap-2">
            {padres.map((padre, idx) => {
              const isOpen = expanded.has(padre.id)
              const avancePadre = padre.children.length > 0
                ? Math.round(padre.children.reduce((s, h) => s + h.avance, 0) / padre.children.length)
                : padre.avance
              return (
                <div key={padre.id} className="border border-line rounded-card overflow-hidden">
                  <div onClick={() => toggle(padre.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer',
                    background: isOpen ? '#f4f7fb' : '#fff', borderLeft: `4px solid ${colorAvance(avancePadre)}`,
                  }}>
                    <span style={{ fontSize: 12, color: '#6b7a8d', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>▶</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1e6bb8', background: '#e8f1fb', padding: '2px 8px', borderRadius: 4, flexShrink: 0 }}>{idx + 1}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2535' }}>{padre.descripcion}</div>
                      <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#6b7a8d', marginTop: 2 }}>
                        <span>{padre.children.length} sub-partida{padre.children.length !== 1 ? 's' : ''}</span>
                        {padre.precio_unitario > 0 && <span>P.U: {fmt(padre.precio_unitario)}</span>}
                      </div>
                    </div>
                    <div style={{ width: 100, flexShrink: 0 }}>
                      <div style={{ height: 6, background: '#e8edf2', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${avancePadre}%`, background: colorAvance(avancePadre), borderRadius: 3 }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: colorAvance(avancePadre), minWidth: 42, textAlign: 'right', flexShrink: 0 }}>{avancePadre}%</span>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(padre)} style={miniBtn('#6b7a8d', '#f0f4f8')}>✎</button>
                      <button onClick={() => del(padre.id)} style={miniBtn('#b0401a', '#fdecea')}>✕</button>
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ padding: '12px 16px 14px 36px', background: '#fafbfc', borderTop: '1px solid #e4e9f0' }}>
                      {padre.children.length === 0 && <p style={{ fontSize: 12, color: '#6b7a8d', textAlign: 'center', padding: '6px 0' }}>Sin sub-partidas.</p>}
                      {padre.children.map((hijo, hIdx) => (
                        <div key={hijo.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: hIdx < padre.children.length - 1 ? '1px solid #e4e9f0' : 'none' }}>
                          <span style={{ fontSize: 11, color: '#6b7a8d', fontWeight: 600, minWidth: 30 }}>{idx + 1}.{hIdx + 1}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#1a2535' }}>{hijo.descripcion}</div>
                            {hijo.notas && <div style={{ fontSize: 10, color: '#6b7a8d', fontStyle: 'italic' }}>{hijo.notas}</div>}
                          </div>
                          <div style={{ width: 130, flexShrink: 0 }}>
                            <input type="range" min={0} max={100} step={5} value={hijo.avance}
                              onChange={e => setAllItems(prev => prev.map(x => x.id === hijo.id ? { ...x, avance: Number(e.target.value) } : x))}
                              onMouseUp={e => updateAvance(hijo, Number((e.target as HTMLInputElement).value))}
                              onTouchEnd={e => updateAvance(hijo, Number((e.target as HTMLInputElement).value))}
                              style={{ width: '100%', accentColor: colorAvance(hijo.avance), cursor: 'pointer' }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: colorAvance(hijo.avance), minWidth: 38, textAlign: 'right', flexShrink: 0 }}>{hijo.avance}%</span>
                          <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                            <button onClick={() => openEdit(hijo)} style={miniBtn('#6b7a8d', '#f0f4f8')}>✎</button>
                            <button onClick={() => del(hijo.id)} style={miniBtn('#b0401a', '#fdecea')}>✕</button>
                          </div>
                        </div>
                      ))}
                      <button onClick={() => openNewHijo(padre.id, padre.children.length)}
                        style={{ width: '100%', padding: '8px 0', marginTop: 8, background: '#fff', border: '1px dashed #d1d9e6', borderRadius: 6, fontSize: 12, color: '#1e6bb8', fontWeight: 600, cursor: 'pointer' }}>
                        + Agregar sub-partida
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      {/* MODAL NUEVA/EDITAR */}
      {modal && (
        <Modal title={modal.type === 'padre' ? 'Nueva partida' : modal.type === 'hijo' ? 'Nueva sub-partida' : 'Editar partida'} onClose={() => setModal(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <FormInput label="Descripción *" value={form.descripcion || ''} onChange={v => upd('descripcion', v)} required
                placeholder={modal.type === 'hijo' ? 'Ej: Excavación' : 'Ej: Obra Gruesa'} />
            </div>
            {(modal.type === 'padre' || (modal.type === 'editar' && !form.parent_id)) && (
              <>
                <FormSelect label="Unidad" value={form.unidad || 'gl'} onChange={v => upd('unidad', v)} options={UNIDADES} />
                <FormInput label="Cantidad" value={form.cantidad ?? 1} onChange={v => upd('cantidad', v)} type="number" />
                <div className="mb-3">
                  <label className="label-base">Costo unitario ($)</label>
                  <input type="number" value={form.costo_unitario || ''}
                    onChange={e => upd('costo_unitario', e.target.value === '' ? 0 : Number(e.target.value))}
                    className="input-base" placeholder="0" />
                </div>
                <div className="mb-3">
                  <label className="label-base">Markup / ganancia (%)</label>
                  <input type="number" value={form.markup_pct ?? ''}
                    onChange={e => upd('markup_pct', e.target.value === '' ? null : Number(e.target.value))}
                    className="input-base" placeholder={`Global: ${markupGlobal}%`} />
                </div>
                {/* Precio de venta calculado */}
                <div className="col-span-2 bg-brand-bg border border-[#b5d4f4] rounded-lg px-4 py-3 flex justify-between items-center">
                  <div>
                    <div className="text-[11px] text-[#0c447c] font-semibold">Precio de venta (calculado)</div>
                    <div className="text-[10px] text-muted">costo × (1 + markup%)</div>
                  </div>
                  <div className="text-lg font-extrabold text-brand">{fmt(precioVentaCalc)}</div>
                </div>
              </>
            )}
            <div style={{ gridColumn: '1/-1' }}>
              <FormInput label="Notas (opcional)" value={form.notas || ''} onChange={v => upd('notas', v)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            <Btn onClick={() => setModal(null)}>Cancelar</Btn>
            <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Btn>
          </div>
        </Modal>
      )}

      {/* MODAL IMPORTAR DEL CATÁLOGO */}
      {showImport && (
        <Modal title="Importar partidas del catálogo" onClose={() => setShowImport(false)}>
          {catLoading
            ? <p style={{ color: '#6b7a8d', textAlign: 'center', padding: 20 }}>Cargando catálogo...</p>
            : catalogoPadres.length === 0
            ? <div style={{ textAlign: 'center', padding: 20 }}>
                <p style={{ fontSize: 13, color: '#6b7a8d', marginBottom: 10 }}>Tu catálogo está vacío.</p>
                <p style={{ fontSize: 12, color: '#6b7a8d' }}>Ve a <strong>Admin → Catálogo de partidas</strong> para crear tus partidas tipo.</p>
              </div>
            : (
              <>
                <p style={{ fontSize: 12, color: '#6b7a8d', marginBottom: 14 }}>
                  Selecciona las partidas que quieres agregar. Se importarán con todas sus sub-partidas y avance 0%.
                </p>
                <div style={{ maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {catalogoPadres.map(cp => {
                    const isSel = selected.has(cp.id)
                    return (
                      <div key={cp.id} onClick={() => toggleSelect(cp.id)} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                        border: `1.5px solid ${isSel ? '#1e6bb8' : '#e4e9f0'}`,
                        background: isSel ? '#e8f1fb' : '#fff', borderRadius: 8, cursor: 'pointer',
                      }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: 4, border: `2px solid ${isSel ? '#1e6bb8' : '#d1d9e6'}`,
                          background: isSel ? '#1e6bb8' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0,
                        }}>{isSel ? '✓' : ''}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2535' }}>{cp.descripcion}</div>
                          <div style={{ fontSize: 11, color: '#6b7a8d', marginTop: 2 }}>
                            {cp.children.length} sub-partida{cp.children.length !== 1 ? 's' : ''}
                            {cp.children.length > 0 && ': ' + cp.children.map(h => h.descripcion).join(', ')}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                  <span style={{ fontSize: 12, color: '#6b7a8d' }}>{selected.size} seleccionada{selected.size !== 1 ? 's' : ''}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn onClick={() => setShowImport(false)}>Cancelar</Btn>
                    <Btn variant="primary" onClick={doImport} disabled={importing || selected.size === 0}>
                      {importing ? 'Importando...' : `Importar ${selected.size}`}
                    </Btn>
                  </div>
                </div>
              </>
            )}
        </Modal>
      )}
    </div>
  )
}

const miniBtn = (color: string, bg: string): React.CSSProperties => ({
  width: 24, height: 24, borderRadius: 5, border: 'none',
  background: bg, color, fontSize: 11, fontWeight: 700,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
})
