'use client'
// components/PartidasPanel.tsx — v3 con IMPORTAR DEL CATÁLOGO (auto-contenido)

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Btn, FormInput, FormSelect, Modal } from '@/components/ui'
import SelectorCatalogo from '@/components/SelectorCatalogo'
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

  // Materiales (rendimientos) por partida
  const [materiales, setMateriales] = useState<any[]>([])
  const [modalMat, setModalMat]     = useState<{ partida: PartidaProyecto } | null>(null)
  const [matForm, setMatForm]       = useState<any>({})
  const [matEditId, setMatEditId]   = useState<string | null>(null)
  const [savingMat, setSavingMat]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [data, mats] = await Promise.all([
      fetch(`/api/partidas-proyecto?proyecto_id=${proyectoId}`).then(r => r.json()).catch(() => []),
      fetch(`/api/partida-materiales?proyecto_id=${proyectoId}`).then(r => r.json()).catch(() => []),
    ])
    setAllItems(Array.isArray(data) ? data : [])
    setMateriales(Array.isArray(mats) ? mats : [])
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

  // ═══ MATERIALES (rendimientos) ═══
  const materialesDe = (partidaId: string) => materiales.filter(m => m.partida_id === partidaId)

  const openNewMat = (padre: PartidaProyecto) => {
    setMatEditId(null)
    setMatForm({ material: '', unidad: 'un', rendimiento: '', precio_unitario: '' })
    setModalMat({ partida: padre })
  }
  const openEditMat = (padre: PartidaProyecto, m: any) => {
    setMatEditId(m.id)
    setMatForm({ material: m.material, unidad: m.unidad, rendimiento: m.rendimiento, precio_unitario: m.precio_unitario })
    setModalMat({ partida: padre })
  }
  const saveMat = async () => {
    if (!modalMat) return
    if (!matForm.material) { alert('El nombre del material es obligatorio'); return }
    setSavingMat(true)
    const method = matEditId ? 'PUT' : 'POST'
    const base = {
      material: matForm.material,
      unidad: matForm.unidad || 'un',
      rendimiento: Number(matForm.rendimiento) || 0,
      precio_unitario: Number(matForm.precio_unitario) || 0,
    }
    const payload = matEditId ? { id: matEditId, ...base } : { partida_id: modalMat.partida.id, ...base }
    const res = await fetch('/api/partida-materiales', {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    setSavingMat(false)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert('No se pudo guardar el material: ' + (err.error || 'error desconocido') +
        '\n\nSi menciona "partida_materiales", ejecuta el SQL 14_partida_materiales.sql en Supabase.')
      return
    }
    await load(); setModalMat(null)
  }
  const delMat = async (id: string) => {
    if (!confirm('¿Eliminar este material?')) return
    await fetch('/api/partida-materiales', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
    })
    await load()
  }

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
                  <div
                    onClick={() => toggle(padre.id)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-l-4 ${isOpen ? 'bg-[#f4f7fb]' : 'bg-white'}`}
                    style={{ borderLeftColor: colorAvance(avancePadre) }}
                  >
                    <span
                      className="text-[12px] text-muted flex-shrink-0 transition-transform duration-150"
                      style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}
                    >▶</span>
                    <span className="text-[11px] font-bold text-brand bg-[#e8f1fb] px-2 py-0.5 rounded flex-shrink-0">{idx + 1}</span>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-[#1a2535]">{padre.descripcion}</div>
                      <div className="flex gap-2.5 text-[11px] text-muted mt-0.5">
                        <span>{padre.children.length} sub-partida{padre.children.length !== 1 ? 's' : ''}</span>
                        {padre.precio_unitario > 0 && <span>P.U: {fmt(padre.precio_unitario)}</span>}
                      </div>
                    </div>
                    <div className="w-[100px] flex-shrink-0">
                      <div className="h-1.5 bg-[#e8edf2] rounded-[3px] overflow-hidden">
                        <div className="h-full rounded-[3px]" style={{ width: `${avancePadre}%`, background: colorAvance(avancePadre) }} />
                      </div>
                    </div>
                    <span
                      className="text-sm font-extrabold min-w-[42px] text-right flex-shrink-0"
                      style={{ color: colorAvance(avancePadre) }}
                    >{avancePadre}%</span>
                    <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(padre)} className="w-6 h-6 rounded-[5px] border-none bg-canvas text-muted text-[11px] font-bold cursor-pointer flex items-center justify-center">✎</button>
                      <button onClick={() => del(padre.id)} className="w-6 h-6 rounded-[5px] border-none bg-danger-bg text-danger text-[11px] font-bold cursor-pointer flex items-center justify-center">✕</button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="pl-9 pr-4 pt-3 pb-3.5 bg-[#fafbfc] border-t border-[#e4e9f0]">
                      {padre.children.length === 0 && <p className="text-[12px] text-muted text-center py-1.5">Sin sub-partidas.</p>}
                      {padre.children.map((hijo, hIdx) => (
                        <div
                          key={hijo.id}
                          className={`flex items-center gap-2.5 py-2 ${hIdx < padre.children.length - 1 ? 'border-b border-[#e4e9f0]' : ''}`}
                        >
                          <span className="text-[11px] text-muted font-semibold min-w-[30px]">{idx + 1}.{hIdx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-semibold text-[#1a2535]">{hijo.descripcion}</div>
                            {hijo.notas && <div className="text-[10px] text-muted italic">{hijo.notas}</div>}
                          </div>
                          <div className="w-[130px] flex-shrink-0">
                            <input type="range" min={0} max={100} step={5} value={hijo.avance}
                              onChange={e => setAllItems(prev => prev.map(x => x.id === hijo.id ? { ...x, avance: Number(e.target.value) } : x))}
                              onMouseUp={e => updateAvance(hijo, Number((e.target as HTMLInputElement).value))}
                              onTouchEnd={e => updateAvance(hijo, Number((e.target as HTMLInputElement).value))}
                              className="w-full cursor-pointer"
                              style={{ accentColor: colorAvance(hijo.avance) }} />
                          </div>
                          <span
                            className="text-[13px] font-bold min-w-[38px] text-right flex-shrink-0"
                            style={{ color: colorAvance(hijo.avance) }}
                          >{hijo.avance}%</span>
                          <div className="flex gap-[3px] flex-shrink-0">
                            <button onClick={() => openEdit(hijo)} className="w-6 h-6 rounded-[5px] border-none bg-canvas text-muted text-[11px] font-bold cursor-pointer flex items-center justify-center">✎</button>
                            <button onClick={() => del(hijo.id)} className="w-6 h-6 rounded-[5px] border-none bg-danger-bg text-danger text-[11px] font-bold cursor-pointer flex items-center justify-center">✕</button>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => openNewHijo(padre.id, padre.children.length)}
                        className="w-full py-2 mt-2 bg-white border border-dashed border-[#d1d9e6] rounded-[6px] text-[12px] text-brand font-semibold cursor-pointer"
                      >
                        + Agregar sub-partida
                      </button>

                      {/* Materiales / rendimientos */}
                      <div className="mt-3.5 pt-3 border-t border-[#e4e9f0]">
                        <div className="text-[10px] font-bold text-muted uppercase tracking-wide mb-1.5">Materiales (rendimientos)</div>
                        {materialesDe(padre.id).length === 0
                          ? <p className="text-[11px] text-muted py-0.5">Sin materiales. Agrega el consumo por {padre.unidad} para calcular compras.</p>
                          : <div className="flex flex-col gap-1.5">
                              {materialesDe(padre.id).map(m => {
                                const necesario = (Number(padre.cantidad) || 0) * (Number(m.rendimiento) || 0)
                                const costo = necesario * (Number(m.precio_unitario) || 0)
                                return (
                                  <div key={m.id} className="flex items-center gap-2 py-1.5 px-2.5 bg-white border border-[#e4e9f0] rounded-[6px]">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[12px] font-semibold text-[#1a2535]">{m.material}</div>
                                      <div className="text-[10px] text-muted">
                                        {m.rendimiento} {m.unidad}/{padre.unidad}
                                        {m.precio_unitario > 0 && ` · ${fmt(m.precio_unitario)}/${m.unidad}`}
                                      </div>
                                    </div>
                                    <div className="text-right flex-shrink-0 mr-1">
                                      <div className="text-[12px] font-bold text-brand tabular-nums">
                                        {necesario.toLocaleString('es-CL', { maximumFractionDigits: 2 })} {m.unidad}
                                      </div>
                                      {costo > 0 && <div className="text-[10px] text-muted">{fmt(Math.round(costo))}</div>}
                                    </div>
                                    <div className="flex gap-[3px] flex-shrink-0">
                                      <button onClick={() => openEditMat(padre, m)} className="w-6 h-6 rounded-[5px] border-none bg-canvas text-muted text-[11px] font-bold cursor-pointer flex items-center justify-center">✎</button>
                                      <button onClick={() => delMat(m.id)} className="w-6 h-6 rounded-[5px] border-none bg-danger-bg text-danger text-[11px] font-bold cursor-pointer flex items-center justify-center">✕</button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>}
                        <button
                          onClick={() => openNewMat(padre)}
                          className="w-full py-2 mt-2 bg-white border border-dashed border-[#d1d9e6] rounded-[6px] text-[12px] text-brand font-semibold cursor-pointer"
                        >
                          + Agregar material
                        </button>
                      </div>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-full">
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
            <div className="col-span-full">
              <FormInput label="Notas (opcional)" value={form.notas || ''} onChange={v => upd('notas', v)} />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-3.5">
            <Btn onClick={() => setModal(null)}>Cancelar</Btn>
            <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Btn>
          </div>
        </Modal>
      )}

      {/* MODAL MATERIAL (rendimiento) */}
      {modalMat && (
        <Modal title={`${matEditId ? 'Editar' : 'Nuevo'} material · ${modalMat.partida.descripcion}`} onClose={() => setModalMat(null)}>
          <div className="flex flex-col gap-3">
            <SelectorCatalogo
              mostrarSiempre
              label="🔎 Elegir material del catálogo (autocompleta precio)"
              onPick={p => setMatForm((f: any) => ({ ...f, material: p.descripcion, unidad: p.unidad || f.unidad || 'un', precio_unitario: Number(p.precio) || 0 }))}
            />
            <FormInput label="Material *" value={matForm.material || ''} onChange={v => setMatForm((f: any) => ({ ...f, material: v }))} placeholder="Ej: Adhesivo EIFS" />
            <div className="grid grid-cols-2 gap-3">
              <FormSelect label="Unidad del material" value={matForm.unidad || 'un'} onChange={v => setMatForm((f: any) => ({ ...f, unidad: v }))} options={UNIDADES} />
              <FormInput label={`Rendimiento (por ${modalMat.partida.unidad})`} type="number" value={matForm.rendimiento ?? ''} onChange={v => setMatForm((f: any) => ({ ...f, rendimiento: v }))} placeholder="4" />
            </div>
            <FormInput label="Precio unitario del material ($, opcional)" type="number" value={matForm.precio_unitario ?? ''} onChange={v => setMatForm((f: any) => ({ ...f, precio_unitario: v }))} placeholder="0" />
            <div className="bg-canvas border border-line rounded-lg px-3 py-2.5 text-[12px] text-muted">
              Necesario para {modalMat.partida.cantidad} {modalMat.partida.unidad}:{' '}
              <strong className="text-brand">
                {((Number(modalMat.partida.cantidad) || 0) * (Number(matForm.rendimiento) || 0)).toLocaleString('es-CL', { maximumFractionDigits: 2 })} {matForm.unidad || 'un'}
              </strong>
              {Number(matForm.precio_unitario) > 0 && (
                <> · <strong className="text-brand">{fmt(Math.round((Number(modalMat.partida.cantidad) || 0) * (Number(matForm.rendimiento) || 0) * (Number(matForm.precio_unitario) || 0)))}</strong></>
              )}
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-3.5">
            <Btn onClick={() => setModalMat(null)}>Cancelar</Btn>
            <Btn variant="primary" onClick={saveMat} disabled={savingMat}>{savingMat ? 'Guardando...' : 'Guardar'}</Btn>
          </div>
        </Modal>
      )}

      {/* MODAL IMPORTAR DEL CATÁLOGO */}
      {showImport && (
        <Modal title="Importar partidas del catálogo" onClose={() => setShowImport(false)}>
          {catLoading
            ? <p className="text-muted text-center p-5">Cargando catálogo...</p>
            : catalogoPadres.length === 0
            ? <div className="text-center p-5">
                <p className="text-[13px] text-muted mb-2.5">Tu catálogo está vacío.</p>
                <p className="text-[12px] text-muted">Ve a <strong>Admin → Catálogo de partidas</strong> para crear tus partidas tipo.</p>
              </div>
            : (
              <>
                <p className="text-[12px] text-muted mb-3.5">
                  Selecciona las partidas que quieres agregar. Se importarán con todas sus sub-partidas y avance 0%.
                </p>
                <div className="max-h-[400px] overflow-y-auto flex flex-col gap-1.5">
                  {catalogoPadres.map(cp => {
                    const isSel = selected.has(cp.id)
                    return (
                      <div
                        key={cp.id}
                        onClick={() => toggleSelect(cp.id)}
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg cursor-pointer border-[1.5px] ${isSel ? 'border-brand bg-[#e8f1fb]' : 'border-[#e4e9f0] bg-white'}`}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-white text-[12px] font-bold border-2 ${isSel ? 'bg-brand border-brand' : 'bg-white border-[#d1d9e6]'}`}>
                          {isSel ? '✓' : ''}
                        </div>
                        <div className="flex-1">
                          <div className="text-[13px] font-bold text-[#1a2535]">{cp.descripcion}</div>
                          <div className="text-[11px] text-muted mt-0.5">
                            {cp.children.length} sub-partida{cp.children.length !== 1 ? 's' : ''}
                            {cp.children.length > 0 && ': ' + cp.children.map(h => h.descripcion).join(', ')}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-2 justify-between items-center mt-3.5">
                  <span className="text-[12px] text-muted">{selected.size} seleccionada{selected.size !== 1 ? 's' : ''}</span>
                  <div className="flex gap-2">
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