'use client'
// app/(protected)/contratos/page.tsx

import { useState, useEffect, useCallback } from 'react'
import { Badge, Btn, FormInput, FormSelect, MetricCard, Modal, SectionTitle, Table, Td, Th, fmt, fmtM } from '@/components/ui'
import type { Contrato } from '@/types'

const EMPTY: Omit<Contrato,'id'|'created_at'|'user_id'> = { numero:'', contraparte:'', tipo:'Suma alzada', valor:0, inicio:'', fin:'', estado:'ejecucion' }

export default function ContratosPage() {
  const [items, setItems]   = useState<Contrato[]>([])
  const [modal, setModal]   = useState<'nuevo'|'editar'|null>(null)
  const [form, setForm]     = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/contratos')
    setItems(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const upd = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.contraparte) return
    setSaving(true)
    const method = modal === 'nuevo' ? 'POST' : 'PUT'
    await fetch('/api/contratos', { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...form, valor: Number(form.valor) }) })
    await load(); setSaving(false); setModal(null)
  }

  const del = async (id: string) => {
    if (!confirm('¿Eliminar contrato?')) return
    await fetch('/api/contratos', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
    await load()
  }

  const totalCartera = items.reduce((s,c) => s+c.valor, 0)

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <SectionTitle>Contratos</SectionTitle>
        <Btn variant="primary" onClick={() => { setForm({ ...EMPTY }); setModal('nuevo') }}>+ Nuevo contrato</Btn>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        <MetricCard label="Contratos vigentes" value={items.filter(c=>c.estado==='ejecucion').length} />
        <MetricCard label="Cartera total"       value={fmtM(totalCartera)} sub="Suma alzada + serie" />
        <MetricCard label="Liquidados"          value={items.filter(c=>c.estado==='liquidado').length} sub="Este año" subColor="#1a7a4a" />
      </div>

      <div style={{ background:'#fff', border:'1px solid #e4e9f0', borderRadius:12, padding:18 }}>
        {loading
          ? <p style={{ color:'#6b7a8d', textAlign:'center', padding:40 }}>Cargando...</p>
          : items.length === 0
          ? <p style={{ color:'#6b7a8d', textAlign:'center', padding:40 }}>Sin contratos aún</p>
          : (
          <Table>
            <thead><tr><Th>N° Contrato</Th><Th>Contraparte</Th><Th>Tipo</Th><Th>Valor</Th><Th>Vigencia</Th><Th>Estado</Th><Th></Th></tr></thead>
            <tbody>
              {items.map(c => (
                <tr key={c.id}>
                  <Td><span style={{ fontFamily:'monospace', fontWeight:700, color:'#1e6bb8', fontSize:12 }}>{c.numero||'—'}</span></Td>
                  <Td style={{ fontWeight:600 }}>{c.contraparte}</Td>
                  <Td style={{ color:'#6b7a8d' }}>{c.tipo}</Td>
                  <Td style={{ fontWeight:700 }}>{fmt(c.valor)}</Td>
                  <Td style={{ fontSize:12, color:'#6b7a8d' }}>{c.inicio||'—'} → {c.fin||'—'}</Td>
                  <Td><Badge estado={c.estado} tipo="contrato" /></Td>
                  <Td>
                    <div style={{ display:'flex', gap:4 }}>
                      <Btn onClick={() => { setForm({ ...c }); setModal('editar') }} style={{ fontSize:11, padding:'4px 8px' }}>Editar</Btn>
                      <Btn variant="danger" onClick={() => del(c.id)} style={{ fontSize:11, padding:'4px 8px' }}>✕</Btn>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      {modal && (
        <Modal title={modal==='nuevo'?'Nuevo contrato':'Editar contrato'} onClose={() => setModal(null)}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <FormInput label="N° Contrato"    value={form.numero||''}      onChange={v=>upd('numero',v)} />
            <FormInput label="Contraparte"    value={form.contraparte||''} onChange={v=>upd('contraparte',v)} required />
            <FormSelect label="Tipo" value={form.tipo||'Suma alzada'} onChange={v=>upd('tipo',v)}
              options={[{value:'Suma alzada',label:'Suma alzada'},{value:'Serie de precios',label:'Serie de precios'},{value:'Administración delegada',label:'Administración delegada'}]} />
            <FormInput label="Valor (CLP)"   value={form.valor||''}  onChange={v=>upd('valor',v)} type="number" />
            <FormInput label="Fecha inicio"  value={form.inicio||''} onChange={v=>upd('inicio',v)} type="date" />
            <FormInput label="Fecha fin"     value={form.fin||''}    onChange={v=>upd('fin',v)}    type="date" />
            <FormSelect label="Estado" value={form.estado||'ejecucion'} onChange={v=>upd('estado',v)}
              options={[{value:'ejecucion',label:'En ejecución'},{value:'liquidado',label:'Liquidado'},{value:'pendiente',label:'Pendiente'}]} />
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
            <Btn onClick={() => setModal(null)}>Cancelar</Btn>
            <Btn variant="primary" onClick={save} disabled={saving}>{saving?'Guardando...':'Guardar'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
