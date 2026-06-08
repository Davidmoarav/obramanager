'use client'
// app/(protected)/cotizaciones/page.tsx — v5 con CONVERSIÓN

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Btn, FormInput, FormSelect, MetricCard, SectionTitle, Table, Td, Th } from '@/components/ui'
import { fmt, fmtM } from '@/lib/format'
import { UNIDADES, type Cotizacion, type PartidaCotizacion } from '@/types/cotizaciones'
import type { Cliente } from '@/types/cliente'
import DescargarPDFBtn from '@/components/DescargarPDFBtn'
import ConvertirBtn from '@/components/ConvertirBtn'   // ← NUEVO

const IVA = 0.19

const EMPTY_COTIZACION: any = {
  numero: '', cliente_id: '', cliente: '', proyecto_nombre: '', descripcion: '',
  fecha: new Date().toISOString().split('T')[0],
  validez_dias: 30, estado: 'borrador', notas: '', partidas: [],
}

const EMPTY_PARTIDA = (): PartidaCotizacion => ({
  id: crypto.randomUUID(), orden: 0, descripcion: '', unidad: 'un',
  cantidad: 1, precio_unitario: 0,
})

const ESTADO_COTIZ: Record<string, { label: string; bg: string; color: string }> = {
  borrador:   { label: 'Borrador',   bg: '#f0f4f8', color: '#6b7a8d' },
  enviada:    { label: 'Enviada',    bg: '#e8f1fb', color: '#1e6bb8' },
  aprobada:   { label: 'Aprobada',   bg: '#e6f4ed', color: '#1a7a4a' },
  rechazada:  { label: 'Rechazada',  bg: '#fdecea', color: '#b0401a' },
  convertida: { label: 'Convertida', bg: '#eeedfe', color: '#534ab7' },
}

function BadgeCotiz({ estado }: { estado: string }) {
  const s = ESTADO_COTIZ[estado] ?? { label: estado, bg: '#eee', color: '#555' }
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

export default function CotizacionesPage() {
  const [items, setItems]       = useState<Cotizacion[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [modal, setModal]       = useState<'nuevo' | 'editar' | 'ver' | null>(null)
  const [form, setForm]         = useState<any>(EMPTY_COTIZACION)
  const [filtro, setFiltro]     = useState('todos')
  const [saving, setSaving]     = useState(false)
  const [loading, setLoading]   = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setApiError(null)
    try {
      const [resCot, resCli] = await Promise.all([
        fetch('/api/cotizaciones'),
        fetch('/api/clientes'),
      ])
      const dataCot = await resCot.json()
      const dataCli = await resCli.json()

      if (!Array.isArray(dataCot)) {
        setApiError(dataCot?.error || 'Respuesta inesperada del servidor')
        setItems([])
      } else {
        setItems(dataCot)
      }
      setClientes(Array.isArray(dataCli) ? dataCli : [])
    } catch (err: any) {
      setApiError('Error de red: ' + (err?.message ?? err))
      setItems([])
      setClientes([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const upd = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  const handleClienteChange = (cliente_id: string) => {
    const c = clientes.find(x => x.id === cliente_id)
    setForm((f: any) => ({
      ...f,
      cliente_id,
      cliente: c?.razon_social || '',
    }))
  }

  const addPartida = () => {
    setForm((f: any) => ({
      ...f,
      partidas: [...(f.partidas ?? []), { ...EMPTY_PARTIDA(), orden: (f.partidas?.length ?? 0) }]
    }))
  }
  const updPartida = (idx: number, k: string, v: any) => {
    setForm((f: any) => ({
      ...f,
      partidas: f.partidas.map((p: any, i: number) => i === idx ? { ...p, [k]: v } : p)
    }))
  }
  const delPartida = (idx: number) => {
    setForm((f: any) => ({
      ...f,
      partidas: f.partidas.filter((_: any, i: number) => i !== idx)
    }))
  }

  const totales = useMemo(() => {
    const partidas = form.partidas ?? []
    const neto = partidas.reduce((s: number, p: any) => s + (Number(p.cantidad) || 0) * (Number(p.precio_unitario) || 0), 0)
    const iva = Math.round(neto * IVA)
    return { neto: Math.round(neto), iva, total: Math.round(neto) + iva }
  }, [form.partidas])

  const metricas = useMemo(() => {
    const arr = Array.isArray(items) ? items : []
    const calc = (c: Cotizacion) => (c.partidas ?? []).reduce((s, p) => s + p.cantidad * p.precio_unitario, 0)
    return {
      total:       arr.length,
      aprobadas:   arr.filter(c => c.estado === 'aprobada').length,
      convertidas: arr.filter(c => c.estado === 'convertida').length,
      monto:       arr.filter(c => c.estado !== 'rechazada').reduce((s, c) => s + calc(c), 0),
    }
  }, [items])

  const save = async () => {
    if (!form.cliente_id && !form.cliente) {
      alert('Debes seleccionar un cliente'); return
    }
    setSaving(true)
    const method = modal === 'nuevo' ? 'POST' : 'PUT'
    const res = await fetch('/api/cotizaciones', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) {
      const { error } = await res.json()
      alert('Error: ' + error)
      setSaving(false); return
    }
    await load(); setSaving(false); setModal(null)
  }

  const del = async (id: string) => {
    if (!confirm('¿Eliminar cotización?')) return
    await fetch('/api/cotizaciones', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await load()
  }

  const filtered = !Array.isArray(items)
    ? []
    : filtro === 'todos' ? items : items.filter(i => i.estado === filtro)

  const calcTotal = (c: Cotizacion) => {
    const neto = (c.partidas ?? []).reduce((s, p) => s + p.cantidad * p.precio_unitario, 0)
    return Math.round(neto * (1 + IVA))
  }

  // ¿La cotización en el modal está bloqueada para editar?
  const esConvertida = modal === 'editar' && form.estado === 'convertida'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <SectionTitle>Cotizaciones</SectionTitle>
        <Btn variant="primary" onClick={() => { setForm({ ...EMPTY_COTIZACION, partidas: [] }); setModal('nuevo') }}>
          + Nueva cotización
        </Btn>
      </div>

      {apiError && (
        <div style={{ background: '#fdecea', border: '1px solid #f5c6c2', color: '#b0401a', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          <strong>Error de la API:</strong> {apiError}
        </div>
      )}

      {!loading && clientes.length === 0 && (
        <div style={{ background: '#e8f1fb', border: '1px solid #b5d4f4', color: '#0c447c', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          💡 Aún no tienes clientes guardados. <Link href="/clientes" style={{ color: '#0c447c', textDecoration: 'underline', fontWeight: 600 }}>Crea uno aquí</Link> antes de hacer una cotización.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <MetricCard label="Total cotizaciones" value={metricas.total} />
        <MetricCard label="Aprobadas"          value={metricas.aprobadas}   sub="Listas para convertir" subColor="#1a7a4a" />
        <MetricCard label="Convertidas"        value={metricas.convertidas} sub="Ya son proyecto"        subColor="#534ab7" />
        <MetricCard label="Monto en cartera"   value={fmtM(metricas.monto)} sub="Excluye rechazadas" />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['todos', 'borrador', 'enviada', 'aprobada', 'rechazada', 'convertida'].map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            style={{
              padding: '5px 14px', borderRadius: 20, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              borderColor: filtro === f ? '#1e6bb8' : '#d1d9e6',
              background:  filtro === f ? '#1e6bb8' : '#fff',
              color:       filtro === f ? '#fff'    : '#6b7a8d',
            }}>
            {f === 'todos' ? 'Todas' : ESTADO_COTIZ[f]?.label}
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e4e9f0', borderRadius: 12, padding: 18 }}>
        {loading
          ? <p style={{ color: '#6b7a8d', textAlign: 'center', padding: 40 }}>Cargando...</p>
          : filtered.length === 0
          ? <p style={{ color: '#6b7a8d', textAlign: 'center', padding: 40 }}>Sin cotizaciones en este filtro</p>
          : (
            <Table>
              <thead><tr>
                <Th>N°</Th><Th>Cliente</Th><Th>Proyecto</Th><Th>Fecha</Th><Th>Partidas</Th><Th>Total (con IVA)</Th><Th>Estado</Th><Th>Acciones</Th>
              </tr></thead>
              <tbody>
                {filtered.map(c => {
                  const cli = clientes.find(x => x.id === c.cliente_id)
                  const bloqueada = c.estado === 'convertida'
                  return (
                    <tr key={c.id}>
                      <Td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e6bb8', fontSize: 12 }}>{c.numero || '—'}</span></Td>
                      <Td>
                        <div style={{ fontWeight: 600 }}>{c.cliente}</div>
                        {cli?.rut && <div style={{ fontSize: 11, color: '#6b7a8d', fontFamily: 'monospace' }}>{cli.rut}</div>}
                      </Td>
                      <Td style={{ color: '#6b7a8d' }}>{c.proyecto_nombre || '—'}</Td>
                      <Td style={{ color: '#6b7a8d' }}>{c.fecha || '—'}</Td>
                      <Td style={{ textAlign: 'center', color: '#6b7a8d' }}>{c.partidas?.length ?? 0}</Td>
                      <Td style={{ fontWeight: 700 }}>{fmt(calcTotal(c))}</Td>
                      <Td><BadgeCotiz estado={c.estado} /></Td>
                      <Td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
                          <DescargarPDFBtn cotizacion={c} />
                          <ConvertirBtn cotizacion={c} onSuccess={load} />
                          <Btn
                            onClick={() => { setForm({ ...c, partidas: c.partidas ?? [] }); setModal(bloqueada ? 'ver' : 'editar') }}
                            style={{ fontSize: 11, padding: '4px 8px' }}>
                            {bloqueada ? 'Ver' : 'Editar'}
                          </Btn>
                          {!bloqueada && (
                            <Btn variant="danger" onClick={() => del(c.id)} style={{ fontSize: 11, padding: '4px 8px' }}>✕</Btn>
                          )}
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          )}
      </div>

      {/* ══════ MODAL ══════ */}
      {modal && (
        <ModalAncho
          title={modal === 'nuevo' ? 'Nueva cotización' : modal === 'ver' ? 'Cotización convertida (solo lectura)' : 'Editar cotización'}
          onClose={() => setModal(null)}
        >
          {/* AVISO si está convertida */}
          {esConvertida || modal === 'ver' ? (
            <div style={{ background: '#eeedfe', border: '1px solid #ccc5fc', color: '#534ab7', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
              🔒 Esta cotización ya fue convertida a proyecto. No se puede editar para mantener la trazabilidad.
              {form.proyecto_id && (
                <>
                  {' '}
                  <Link href="/proyectos" style={{ color: '#534ab7', textDecoration: 'underline', fontWeight: 700 }}>
                    Ver el proyecto creado
                  </Link>
                </>
              )}
            </div>
          ) : null}

          <fieldset disabled={modal === 'ver'} style={{ border: 'none', padding: 0, margin: 0, opacity: modal === 'ver' ? 0.85 : 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormInput label="N° cotización" value={form.numero || ''} onChange={v => upd('numero', v)} placeholder="Ej: COT-2026-015" />

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7a8d', marginBottom: 4 }}>
                  Cliente *
                </label>
                <select
                  value={form.cliente_id || ''}
                  onChange={e => handleClienteChange(e.target.value)}
                  disabled={modal === 'ver'}
                  style={{
                    width: '100%', padding: '8px 11px', border: '1px solid #d1d9e6',
                    borderRadius: 7, fontSize: 13, background: '#fafbfc', outline: 'none',
                  }}
                >
                  <option value="">— Selecciona un cliente —</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.razon_social}{c.rut ? ` · ${c.rut}` : ''}
                    </option>
                  ))}
                </select>
                {modal !== 'ver' && (
                  <div style={{ marginTop: 4 }}>
                    <Link href="/clientes" target="_blank" style={{ fontSize: 11, color: '#1e6bb8', textDecoration: 'underline' }}>
                      + Crear cliente nuevo (en otra pestaña)
                    </Link>
                  </div>
                )}
              </div>

              <FormInput label="Proyecto"        value={form.proyecto_nombre || ''}  onChange={v => upd('proyecto_nombre', v)} />
              <FormInput label="Fecha"           value={form.fecha || ''}            onChange={v => upd('fecha', v)} type="date" />
              <FormInput label="Validez (días)"  value={form.validez_dias ?? 30}     onChange={v => upd('validez_dias', v)} type="number" />
              <FormSelect label="Estado"         value={form.estado || 'borrador'}   onChange={v => upd('estado', v)}
                options={[
                  { value: 'borrador',   label: 'Borrador' },
                  { value: 'enviada',    label: 'Enviada' },
                  { value: 'aprobada',   label: 'Aprobada' },
                  { value: 'rechazada',  label: 'Rechazada' },
                  { value: 'convertida', label: 'Convertida' },
                ]} />
              <div style={{ gridColumn: '1/-1' }}>
                <FormInput label="Descripción general (aparece como intro en el PDF)" value={form.descripcion || ''} onChange={v => upd('descripcion', v)} placeholder="Junto con saludar, envío la siguiente cotización por..." />
              </div>
            </div>

            <div style={{ marginTop: 20, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2535' }}>Partidas ({form.partidas?.length ?? 0})</div>
              {modal !== 'ver' && (
                <Btn variant="primary" onClick={addPartida} style={{ fontSize: 12, padding: '5px 12px' }}>+ Agregar partida</Btn>
              )}
            </div>

            {form.partidas?.length === 0 && (
              <div style={{ background: '#f8fafc', border: '1px dashed #d1d9e6', borderRadius: 8, padding: 28, textAlign: 'center', fontSize: 12, color: '#6b7a8d' }}>
                Sin partidas aún.
              </div>
            )}

            {form.partidas?.map((p: any, idx: number) => {
              const subtotal = (Number(p.cantidad) || 0) * (Number(p.precio_unitario) || 0)
              return (
                <div key={p.id || idx} style={{ background: '#fafbfc', border: '1px solid #e4e9f0', borderRadius: 8, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1e6bb8', background: '#e8f1fb', padding: '2px 8px', borderRadius: 4 }}>
                      PARTIDA {idx + 1}
                    </div>
                    {modal !== 'ver' && (
                      <button onClick={() => delPartida(idx)} title="Eliminar partida"
                        style={{ background: 'transparent', border: 'none', color: '#b0401a', cursor: 'pointer', fontSize: 13, padding: 4, fontWeight: 600 }}>
                        ✕ Eliminar
                      </button>
                    )}
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={lblStyle}>Descripción</label>
                    <input value={p.descripcion}
                      onChange={e => updPartida(idx, 'descripcion', e.target.value)}
                      style={{ ...inputStyle, width: '100%' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.3fr 1.2fr', gap: 10 }}>
                    <div>
                      <label style={lblStyle}>Unidad</label>
                      <select value={p.unidad} onChange={e => updPartida(idx, 'unidad', e.target.value)} style={inputStyle}>
                        {UNIDADES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lblStyle}>Cantidad</label>
                      <input type="number" step="0.01" value={p.cantidad}
                        onChange={e => updPartida(idx, 'cantidad', e.target.value)}
                        style={{ ...inputStyle, textAlign: 'right' }} />
                    </div>
                    <div>
                      <label style={lblStyle}>Precio unitario</label>
                      <input type="number" value={p.precio_unitario}
                        onChange={e => updPartida(idx, 'precio_unitario', e.target.value)}
                        style={{ ...inputStyle, textAlign: 'right' }} />
                    </div>
                    <div>
                      <label style={lblStyle}>Subtotal</label>
                      <div style={{
                        padding: '8px 10px', background: '#fff', border: '1px solid #d1d9e6',
                        borderRadius: 6, fontSize: 13, fontWeight: 700, textAlign: 'right', color: '#1a2535',
                      }}>{fmt(subtotal)}</div>
                    </div>
                  </div>
                </div>
              )
            })}

            {form.partidas?.length > 0 && (
              <div style={{ marginTop: 14, padding: 16, background: '#f0f4f8', borderRadius: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: '#6b7a8d' }}>Neto</span>
                  <span style={{ fontWeight: 600 }}>{fmt(totales.neto)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: '#6b7a8d' }}>IVA (19%)</span>
                  <span style={{ fontWeight: 600 }}>{fmt(totales.iva)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, paddingTop: 8, borderTop: '1px solid #d1d9e6' }}>
                  <span style={{ fontWeight: 700 }}>Total</span>
                  <span style={{ fontWeight: 700, color: '#1e6bb8' }}>{fmt(totales.total)}</span>
                </div>
              </div>
            )}

            <div style={{ marginTop: 14 }}>
              <FormInput label="Notas / términos (opcional, aparecen al pie del PDF)" value={form.notas || ''} onChange={v => upd('notas', v)} />
            </div>
          </fieldset>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            <Btn onClick={() => setModal(null)}>{modal === 'ver' ? 'Cerrar' : 'Cancelar'}</Btn>
            {modal !== 'ver' && (
              <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Btn>
            )}
          </div>
        </ModalAncho>
      )}
    </div>
  )
}

function ModalAncho({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, maxWidth: 760, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1a2535', margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7a8d', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '8px 10px', border: '1px solid #d1d9e6', borderRadius: 6,
  fontSize: 13, background: '#fff', color: '#1a2535', outline: 'none',
  width: '100%', boxSizing: 'border-box',
}

const lblStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7a8d',
  marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3,
}
