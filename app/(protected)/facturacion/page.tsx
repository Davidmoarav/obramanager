'use client'
// app/(protected)/facturacion/page.tsx

import { useState, useEffect, useCallback } from 'react'
import { Badge, Btn, FormInput, FormSelect, MetricCard, Modal, SectionTitle, Table, Td, Th, fmt, fmtM } from '@/components/ui'
import type { Factura } from '@/types'

const EMPTY: Omit<Factura,'id'|'created_at'|'user_id'> = { numero:'', cliente:'', proyecto:'', monto:0, emision:'', vencimiento:'', estado:'pendiente' }

export default function FacturacionPage() {
  const [items, setItems]   = useState<Factura[]>([])
  const [modal, setModal]   = useState(false)
  const [form, setForm]     = useState<any>({})
  const [filtro, setFiltro] = useState('todos')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/facturas')
    setItems(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const upd = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.cliente) return
    setSaving(true)
    await fetch('/api/facturas', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...form, monto: Number(form.monto) }) })
    await load(); setSaving(false); setModal(false)
  }

  const setEstado = async (id: string, estado: string) => {
    await fetch('/api/facturas', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, estado }) })
    await load()
  }

  const filtered = filtro === 'todos' ? items : items.filter(i => i.estado === filtro)

  const cobrado   = items.filter(f=>f.estado==='pagada').reduce((s,f)=>s+f.monto,0)
  const pendiente = items.filter(f=>f.estado==='pendiente').reduce((s,f)=>s+f.monto,0)
  const vencido   = items.filter(f=>f.estado==='vencida').reduce((s,f)=>s+f.monto,0)

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <SectionTitle>Facturación</SectionTitle>
        <Btn variant="primary" onClick={() => { setForm({ ...EMPTY, emision: new Date().toISOString().split('T')[0] }); setModal(true) }}>+ Nueva factura</Btn>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        <MetricCard label="Total cobrado"  value={fmtM(cobrado)}   sub="Facturas pagadas"   subColor="#1a7a4a" />
        <MetricCard label="Por cobrar"     value={fmtM(pendiente)} sub="Facturas pendientes" subColor="#b07d1a" />
        <MetricCard label="Vencidas"       value={fmtM(vencido)}   sub="Gestión urgente"    subColor="#b0401a" />
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {['todos','pagada','pendiente','vencida'].map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            style={{ padding:'5px 14px', borderRadius:20, border:'1px solid', fontSize:12, fontWeight:600, cursor:'pointer',
              borderColor: filtro===f ? '#1e6bb8':'#d1d9e6', background: filtro===f ? '#1e6bb8':'#fff', color: filtro===f ? '#fff':'#6b7a8d' }}>
            {f==='todos'?'Todas': f==='pagada'?'Pagadas': f==='pendiente'?'Pendientes':'Vencidas'}
          </button>
        ))}
      </div>

      <div style={{ background:'#fff', border:'1px solid #e4e9f0', borderRadius:12, padding:18 }}>
        {loading
          ? <p style={{ color:'#6b7a8d', textAlign:'center', padding:40 }}>Cargando...</p>
          : filtered.length === 0
          ? <p style={{ color:'#6b7a8d', textAlign:'center', padding:40 }}>Sin facturas en este filtro</p>
          : (
          <Table>
            <thead><tr>
              <Th>N° Factura</Th><Th>Cliente</Th><Th>Proyecto</Th><Th>Monto</Th><Th>Emisión</Th><Th>Vencimiento</Th><Th>Estado</Th><Th></Th>
            </tr></thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.id}>
                  <Td><span style={{ fontFamily:'monospace', fontWeight:700, color:'#1e6bb8' }}>{f.numero||'—'}</span></Td>
                  <Td style={{ fontWeight:600 }}>{f.cliente}</Td>
                  <Td style={{ color:'#6b7a8d' }}>{f.proyecto||'—'}</Td>
                  <Td style={{ fontWeight:700 }}>{fmt(f.monto)}</Td>
                  <Td style={{ color:'#6b7a8d' }}>{f.emision||'—'}</Td>
                  <Td style={{ color:'#6b7a8d' }}>{f.vencimiento||'—'}</Td>
                  <Td><Badge estado={f.estado} tipo="factura" /></Td>
                  <Td>
                    <select value={f.estado} onChange={e => setEstado(f.id, e.target.value)}
                      style={{ fontSize:11, padding:'3px 6px', border:'1px solid #d1d9e6', borderRadius:5, cursor:'pointer' }}>
                      <option value="pendiente">Pendiente</option>
                      <option value="pagada">Pagada</option>
                      <option value="vencida">Vencida</option>
                    </select>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      {modal && (
        <Modal title="Nueva factura" onClose={() => setModal(false)}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <FormInput label="Cliente"       value={form.cliente||''}     onChange={v=>upd('cliente',v)} required />
            <FormInput label="Proyecto"      value={form.proyecto||''}    onChange={v=>upd('proyecto',v)} />
            <FormInput label="N° Factura"    value={form.numero||''}      onChange={v=>upd('numero',v)} />
            <FormInput label="Monto (CLP)"   value={form.monto||''}       onChange={v=>upd('monto',v)} type="number" />
            <FormInput label="Fecha emisión" value={form.emision||''}     onChange={v=>upd('emision',v)} type="date" />
            <FormInput label="Vencimiento"   value={form.vencimiento||''} onChange={v=>upd('vencimiento',v)} type="date" />
            <FormSelect label="Estado" value={form.estado||'pendiente'} onChange={v=>upd('estado',v)}
              options={[{value:'pendiente',label:'Pendiente'},{value:'pagada',label:'Pagada'},{value:'vencida',label:'Vencida'}]} />
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
            <Btn onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn variant="primary" onClick={save} disabled={saving}>{saving?'Guardando...':'Guardar'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
