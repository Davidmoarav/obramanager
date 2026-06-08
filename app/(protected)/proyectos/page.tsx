'use client'
// app/(protected)/proyectos/page.tsx — v3 con PARTIDAS + DOCUMENTOS

import { useState, useEffect, useCallback } from 'react'
import { Badge, Btn, FormInput, FormSelect, Modal, ProgressBar, SectionTitle, fmtM } from '@/components/ui'
import type { Proyecto } from '@/types'
import DocumentosPanel from '@/components/DocumentosPanel'
import PartidasPanel from '@/components/PartidasPanel'

const EMPTY: Omit<Proyecto, 'id'|'created_at'|'user_id'> = { nombre:'', cliente:'', descripcion:'', valor:0, avance:0, estado:'cotizacion', inicio:'', fin:'' }

export default function ProyectosPage() {
  const [items, setItems]           = useState<Proyecto[]>([])
  const [modal, setModal]           = useState<'nuevo'|'editar'|null>(null)
  const [detailProject, setDetail]  = useState<Proyecto | null>(null)
  const [detailTab, setDetailTab]   = useState<'partidas'|'documentos'>('partidas')
  const [form, setForm]             = useState<any>({})
  const [filtro, setFiltro]         = useState('todos')
  const [saving, setSaving]         = useState(false)
  const [loading, setLoading]       = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/proyectos')
    const data = await res.json()
    setItems(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const upd = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  const openNew = () => { setForm({ ...EMPTY }); setModal('nuevo') }
  const openEdit = (p: Proyecto) => { setForm({ ...p }); setModal('editar') }

  const save = async () => {
    if (!form.nombre || !form.cliente) return
    setSaving(true)
    const method = modal === 'nuevo' ? 'POST' : 'PUT'
    await fetch('/api/proyectos', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, valor: Number(form.valor), avance: Number(form.avance) }) })
    await load()
    setSaving(false)
    setModal(null)
  }

  const del = async (id: string) => {
    if (!confirm('¿Eliminar este proyecto y todos sus documentos y partidas?')) return
    await fetch('/api/proyectos', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await load()
  }

  // Refrescar proyecto individual después de cambio de avance
  const refreshDetail = async () => {
    await load()
    if (detailProject) {
      const res = await fetch('/api/proyectos')
      const all = await res.json()
      const updated = Array.isArray(all) ? all.find((p: any) => p.id === detailProject.id) : null
      if (updated) setDetail(updated)
    }
  }

  const filtered = filtro === 'todos' ? items : items.filter(i => i.estado === filtro)

  const ESTADOS = [
    { value: 'cotizacion', label: 'En cotización' },
    { value: 'activo',     label: 'En curso' },
    { value: 'terminado',  label: 'Terminado' },
  ]
  const COLORS: Record<string, string> = { activo: '#1e6bb8', terminado: '#1a7a4a', cotizacion: '#b07d1a' }
  const LABELS: Record<string, string> = { activo: 'EN CURSO', terminado: 'TERMINADO', cotizacion: 'EN COTIZACIÓN' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <SectionTitle>Proyectos</SectionTitle>
        <Btn variant="primary" onClick={openNew}>+ Nuevo proyecto</Btn>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {['todos', 'activo', 'terminado', 'cotizacion'].map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            style={{ padding: '5px 14px', borderRadius: 20, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              borderColor: filtro === f ? '#1e6bb8' : '#d1d9e6', background: filtro === f ? '#1e6bb8' : '#fff', color: filtro === f ? '#fff' : '#6b7a8d' }}>
            {f === 'todos' ? 'Todos' : LABELS[f]}
          </button>
        ))}
      </div>

      {loading
        ? <p style={{ color: '#6b7a8d', textAlign: 'center', padding: 40 }}>Cargando...</p>
        : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          {filtered.map(p => (
            <div key={p.id} style={{ background: '#fff', border: '1px solid #e4e9f0', borderTop: `3px solid ${COLORS[p.estado] || '#aaa'}`, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS[p.estado], marginBottom: 6 }}>{LABELS[p.estado]}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2535', marginBottom: 2 }}>{p.nombre}</div>
              <div style={{ fontSize: 12, color: '#6b7a8d', marginBottom: 10 }}>{p.cliente}</div>
              {p.estado !== 'cotizacion' && <div style={{ marginBottom: 10 }}><ProgressBar pct={p.avance} /></div>}
              {p.descripcion && <div style={{ fontSize: 12, color: '#1a2535', marginBottom: 10, maxHeight: 40, overflow: 'hidden' }}>{p.descripcion}</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 12 }}>
                <span style={{ fontWeight: 700 }}>{fmtM(p.valor)}</span>
                <span style={{ color: '#6b7a8d' }}>{p.fin ? `Vence: ${p.fin}` : '—'}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {/* BOTÓN ABRIR DETALLE (partidas + docs) */}
                <Btn onClick={() => { setDetail(p); setDetailTab('partidas') }}
                  style={{ fontSize: 12, padding: '5px 10px', background: '#e8f1fb', borderColor: '#b5d4f4', color: '#1e6bb8', fontWeight: 700 }}>
                  ⚙ Control
                </Btn>
                <Btn onClick={() => { setDetail(p); setDetailTab('documentos') }}
                  style={{ fontSize: 12, padding: '5px 10px', background: '#f0f4f8', borderColor: '#d1d9e6' }}>
                  📎 Docs
                </Btn>
                <Btn onClick={() => openEdit(p)} style={{ fontSize: 12, padding: '5px 10px' }}>Editar</Btn>
                <Btn variant="danger" onClick={() => del(p.id)} style={{ fontSize: 12, padding: '5px 10px' }}>✕</Btn>
              </div>
            </div>
          ))}

          <div onClick={openNew} style={{ background: '#f8fafc', border: '2px dashed #d1d9e6', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', minHeight: 160 }}>
            <div style={{ fontSize: 28, color: '#d1d9e6' }}>+</div>
            <div style={{ fontSize: 13, color: '#6b7a8d' }}>Nuevo proyecto</div>
          </div>
        </div>
      )}

      {/* ── MODAL EDITAR/NUEVO ── */}
      {modal && (
        <Modal title={modal === 'nuevo' ? 'Nuevo proyecto' : 'Editar proyecto'} onClose={() => setModal(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}><FormInput label="Nombre del proyecto" value={form.nombre || ''} onChange={v => upd('nombre', v)} required /></div>
            <FormInput label="Cliente"      value={form.cliente || ''}   onChange={v => upd('cliente', v)} />
            <FormInput label="Valor (CLP)"  value={form.valor || ''}     onChange={v => upd('valor', v)} type="number" />
            <FormInput label="Fecha inicio" value={form.inicio || ''}    onChange={v => upd('inicio', v)} type="date" />
            <FormInput label="Fecha fin"    value={form.fin || ''}       onChange={v => upd('fin', v)} type="date" />
            <FormSelect label="Estado"      value={form.estado || 'cotizacion'} onChange={v => upd('estado', v)} options={ESTADOS} />
            <FormInput label="Avance %"     value={form.avance ?? 0}     onChange={v => upd('avance', v)} type="number" />
            <div style={{ gridColumn: '1/-1' }}><FormInput label="Descripción" value={form.descripcion || ''} onChange={v => upd('descripcion', v)} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn onClick={() => setModal(null)}>Cancelar</Btn>
            <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Btn>
          </div>
        </Modal>
      )}

      {/* ── MODAL DETALLE: PARTIDAS + DOCUMENTOS CON TABS ── */}
      {detailProject && (
        <ModalGrande
          title={detailProject.nombre}
          subtitle={`${detailProject.cliente} · ${fmtM(detailProject.valor)} · Avance: ${detailProject.avance}%`}
          onClose={() => setDetail(null)}
        >
          {/* TABS */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 18, borderBottom: '1px solid #e4e9f0' }}>
            {[
              { key: 'partidas' as const,    label: '⚙ Partidas de obra' },
              { key: 'documentos' as const,  label: '📎 Documentos' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setDetailTab(tab.key)}
                style={{
                  padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: 'none', background: 'transparent',
                  borderBottom: detailTab === tab.key ? '2px solid #1e6bb8' : '2px solid transparent',
                  color: detailTab === tab.key ? '#1e6bb8' : '#6b7a8d',
                }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* CONTENIDO */}
          {detailTab === 'partidas' && (
            <PartidasPanel proyectoId={detailProject.id} onAvanceChange={refreshDetail} />
          )}
          {detailTab === 'documentos' && (
            <DocumentosPanel proyectoId={detailProject.id} proyectoNombre={detailProject.nombre} />
          )}
        </ModalGrande>
      )}
    </div>
  )
}

function ModalGrande({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, maxWidth: 860, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1a2535', margin: 0 }}>{title}</h3>
            {subtitle && <div style={{ fontSize: 12, color: '#6b7a8d', marginTop: 4 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7a8d', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
