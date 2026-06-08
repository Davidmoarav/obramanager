'use client'
// app/(protected)/catalogo-partidas/page.tsx

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Btn, FormInput, FormSelect, Modal, SectionTitle, MetricCard } from '@/components/ui'
import { fmt } from '@/lib/format'
import { UNIDADES } from '@/types/cotizaciones'
import type { CatalogoPartida } from '@/types/catalogo-partida'

export default function CatalogoPartidasPage() {
  const [allItems, setAllItems] = useState<CatalogoPartida[]>([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [modal, setModal]       = useState<{ type: 'padre' | 'hijo' | 'editar'; parentId?: string } | null>(null)
  const [form, setForm]         = useState<any>({})
  const [saving, setSaving]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res  = await fetch('/api/catalogo-partidas')
    const data = await res.json()
    setAllItems(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const padres = useMemo(() => {
    const ps = allItems.filter(p => !p.parent_id).sort((a, b) => a.orden - b.orden)
    return ps.map(padre => ({
      ...padre,
      children: allItems.filter(h => h.parent_id === padre.id).sort((a, b) => a.orden - b.orden),
    }))
  }, [allItems])

  const upd = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
  const toggle = (id: string) => {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const save = async () => {
    if (!form.descripcion) { alert('La descripción es obligatoria'); return }
    setSaving(true)
    const method = modal?.type === 'editar' ? 'PUT' : 'POST'
    const body = {
      ...form,
      parent_id: modal?.type === 'hijo' ? modal.parentId : (form.parent_id || null),
    }
    await fetch('/api/catalogo-partidas', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    await load()
    setSaving(false)
    setModal(null)
  }

  const del = async (id: string) => {
    if (!confirm('¿Eliminar esta partida del catálogo y todas sus sub-partidas?')) return
    await fetch('/api/catalogo-partidas', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await load()
  }

  const openNewPadre = () => {
    setForm({ descripcion: '', unidad: 'gl', precio_unitario_ref: 0, orden: padres.length })
    setModal({ type: 'padre' })
  }
  const openNewHijo = (parentId: string, childCount: number) => {
    setForm({ descripcion: '', unidad: 'gl', precio_unitario_ref: 0, orden: childCount })
    setModal({ type: 'hijo', parentId })
  }
  const openEdit = (p: CatalogoPartida) => {
    setForm({ ...p })
    setModal({ type: 'editar' })
  }

  const totalPadres = padres.length
  const totalHijos  = allItems.filter(i => i.parent_id).length

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <SectionTitle>Catálogo de partidas</SectionTitle>
        <Btn variant="primary" onClick={openNewPadre}>+ Nueva partida</Btn>
      </div>

      <p style={{ fontSize: 13, color: '#6b7a8d', marginBottom: 20 }}>
        Define tus partidas tipo con sus sub-partidas. Al crear una cotización o proyecto, podrás importarlas directamente sin volver a escribirlas.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        <MetricCard label="Partidas principales" value={totalPadres} />
        <MetricCard label="Sub-partidas"         value={totalHijos} />
        <MetricCard label="Total ítems"          value={allItems.length} />
      </div>

      {loading
        ? <p style={{ color: '#6b7a8d', textAlign: 'center', padding: 30 }}>Cargando catálogo...</p>
        : padres.length === 0
        ? <div style={{ background: '#f8fafc', border: '1px dashed #d1d9e6', borderRadius: 10, padding: 36, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2535', marginBottom: 6 }}>Tu catálogo está vacío</div>
            <div style={{ fontSize: 12, color: '#6b7a8d', marginBottom: 14 }}>
              Agrega partidas comunes como "Obra Gruesa", "Instalaciones Eléctricas", "Terminaciones", etc.
              Luego podrás importarlas a cualquier cotización o proyecto con un clic.
            </div>
            <Btn variant="primary" onClick={openNewPadre}>+ Crear primera partida</Btn>
          </div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {padres.map((padre, idx) => {
              const isOpen = expanded.has(padre.id)
              return (
                <div key={padre.id} style={{ border: '1px solid #e4e9f0', borderRadius: 10, overflow: 'hidden' }}>

                  {/* CABECERA PADRE */}
                  <div
                    onClick={() => toggle(padre.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px', cursor: 'pointer',
                      background: isOpen ? '#f4f7fb' : '#fff',
                      borderLeft: '4px solid #1e6bb8',
                    }}
                  >
                    <span style={{ fontSize: 12, color: '#6b7a8d', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>▶</span>

                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1e6bb8', background: '#e8f1fb', padding: '2px 8px', borderRadius: 4, flexShrink: 0 }}>
                      {idx + 1}
                    </span>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2535' }}>{padre.descripcion}</div>
                      <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#6b7a8d', marginTop: 2 }}>
                        <span>{padre.unidad}</span>
                        {padre.precio_unitario_ref > 0 && <span>P.U ref: {fmt(padre.precio_unitario_ref)}</span>}
                        <span>{padre.children.length} sub-partida{padre.children.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(padre)} style={miniBtn('#6b7a8d', '#f0f4f8')}>✎</button>
                      <button onClick={() => del(padre.id)} style={miniBtn('#b0401a', '#fdecea')}>✕</button>
                    </div>
                  </div>

                  {/* SUB-PARTIDAS */}
                  {isOpen && (
                    <div style={{ padding: '12px 16px 14px 36px', background: '#fafbfc', borderTop: '1px solid #e4e9f0' }}>
                      {padre.children.length === 0 && (
                        <p style={{ fontSize: 12, color: '#6b7a8d', textAlign: 'center', padding: '6px 0' }}>
                          Sin sub-partidas definidas aún.
                        </p>
                      )}

                      {padre.children.map((hijo, hIdx) => (
                        <div key={hijo.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 0',
                          borderBottom: hIdx < padre.children.length - 1 ? '1px solid #e4e9f0' : 'none',
                        }}>
                          <span style={{ fontSize: 11, color: '#6b7a8d', fontWeight: 600, minWidth: 30 }}>
                            {idx + 1}.{hIdx + 1}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#1a2535' }}>{hijo.descripcion}</div>
                            <div style={{ fontSize: 11, color: '#6b7a8d' }}>
                              {hijo.unidad}{hijo.precio_unitario_ref > 0 ? ` · P.U ref: ${fmt(hijo.precio_unitario_ref)}` : ''}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 3 }}>
                            <button onClick={() => openEdit(hijo)} style={miniBtn('#6b7a8d', '#f0f4f8')}>✎</button>
                            <button onClick={() => del(hijo.id)} style={miniBtn('#b0401a', '#fdecea')}>✕</button>
                          </div>
                        </div>
                      ))}

                      <button onClick={() => openNewHijo(padre.id, padre.children.length)}
                        style={{
                          width: '100%', padding: '8px 0', marginTop: 8,
                          background: '#fff', border: '1px dashed #d1d9e6', borderRadius: 6,
                          fontSize: 12, color: '#1e6bb8', fontWeight: 600, cursor: 'pointer',
                        }}>
                        + Agregar sub-partida a "{padre.descripcion}"
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      {/* MODAL */}
      {modal && (
        <Modal
          title={
            modal.type === 'padre' ? 'Nueva partida en catálogo' :
            modal.type === 'hijo'  ? 'Nueva sub-partida' : 'Editar partida'
          }
          onClose={() => setModal(null)}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <FormInput label="Descripción *" value={form.descripcion || ''} onChange={v => upd('descripcion', v)}
                placeholder={modal.type === 'hijo' ? 'Ej: Excavación de fundaciones' : 'Ej: Obra Gruesa'} required />
            </div>
            <FormSelect label="Unidad" value={form.unidad || 'gl'} onChange={v => upd('unidad', v)} options={UNIDADES} />
            <FormInput label="Precio unitario referencial" value={form.precio_unitario_ref ?? 0} onChange={v => upd('precio_unitario_ref', v)} type="number"
              placeholder="Precio estimado (se puede ajustar al usar)" />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            <Btn onClick={() => setModal(null)}>Cancelar</Btn>
            <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Btn>
          </div>
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
