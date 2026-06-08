'use client'
// app/(protected)/proveedores/page.tsx

import { useState, useEffect, useCallback } from 'react'
import { Badge, Btn, FormInput, FormSelect, Modal, SectionTitle, Table, Td, Th, fmt } from '@/components/ui'
import type { Proveedor } from '@/types'

const EMPTY: Omit<Proveedor,'id'|'created_at'|'user_id'> = { nombre:'', rut:'', rubro:'', contacto:'', telefono:'', monto3m:0, estado:'activo' }

export default function ProveedoresPage() {
  const [items, setItems]   = useState<Proveedor[]>([])
  const [modal, setModal]   = useState<'nuevo'|'editar'|null>(null)
  const [form, setForm]     = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/proveedores')
    setItems(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const upd = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.nombre) return
    setSaving(true)
    const method = modal === 'nuevo' ? 'POST' : 'PUT'
    await fetch('/api/proveedores', { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...form, monto3m: Number(form.monto3m) }) })
    await load(); setSaving(false); setModal(null)
  }

  const del = async (id: string) => {
    if (!confirm('¿Eliminar proveedor?')) return
    await fetch('/api/proveedores', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
    await load()
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <SectionTitle>Proveedores</SectionTitle>
        <Btn variant="primary" onClick={() => { setForm({ ...EMPTY }); setModal('nuevo') }}>+ Agregar proveedor</Btn>
      </div>

      <div style={{ background:'#fff', border:'1px solid #e4e9f0', borderRadius:12, padding:18 }}>
        {loading
          ? <p style={{ color:'#6b7a8d', textAlign:'center', padding:40 }}>Cargando...</p>
          : items.length === 0
          ? <p style={{ color:'#6b7a8d', textAlign:'center', padding:40 }}>Sin proveedores aún</p>
          : (
          <Table>
            <thead><tr><Th>Proveedor</Th><Th>Rubro</Th><Th>Contacto</Th><Th>Últimos 3 meses</Th><Th>Estado</Th><Th></Th></tr></thead>
            <tbody>
              {items.map(p => (
                <tr key={p.id}>
                  <Td>
                    <div style={{ fontWeight:700 }}>{p.nombre}</div>
                    <div style={{ fontSize:11, color:'#6b7a8d', fontFamily:'monospace' }}>{p.rut}</div>
                  </Td>
                  <Td style={{ color:'#6b7a8d' }}>{p.rubro}</Td>
                  <Td>
                    <div style={{ fontSize:12 }}>{p.contacto}</div>
                    <div style={{ fontSize:11, color:'#1e6bb8' }}>{p.telefono}</div>
                  </Td>
                  <Td style={{ fontWeight:700 }}>{fmt(p.monto3m)}</Td>
                  <Td><Badge estado={p.estado} tipo="proveedor" /></Td>
                  <Td>
                    <div style={{ display:'flex', gap:4 }}>
                      <Btn onClick={() => { setForm({ ...p }); setModal('editar') }} style={{ fontSize:11, padding:'4px 8px' }}>Editar</Btn>
                      <Btn variant="danger" onClick={() => del(p.id)} style={{ fontSize:11, padding:'4px 8px' }}>✕</Btn>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      {modal && (
        <Modal title={modal==='nuevo'?'Nuevo proveedor':'Editar proveedor'} onClose={() => setModal(null)}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <FormInput label="Razón social"       value={form.nombre||''}   onChange={v=>upd('nombre',v)} required />
            <FormInput label="RUT"                value={form.rut||''}      onChange={v=>upd('rut',v)} />
            <FormInput label="Rubro"              value={form.rubro||''}    onChange={v=>upd('rubro',v)} />
            <FormInput label="Contacto"           value={form.contacto||''} onChange={v=>upd('contacto',v)} />
            <FormInput label="Teléfono"           value={form.telefono||''} onChange={v=>upd('telefono',v)} />
            <FormInput label="Compras últimos 3m" value={form.monto3m||''}  onChange={v=>upd('monto3m',v)} type="number" />
            <FormSelect label="Estado" value={form.estado||'activo'} onChange={v=>upd('estado',v)}
              options={[{value:'activo',label:'Activo'},{value:'cotizacion',label:'En cotización'}]} />
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
