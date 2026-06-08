'use client'
// app/(protected)/rrhh/page.tsx

import { useState, useEffect, useCallback } from 'react'
import { Badge, Btn, FormInput, FormSelect, MetricCard, Modal, SectionTitle, Table, Td, Th, fmt, fmtM } from '@/components/ui'
import type { Empleado } from '@/types'

const EMPTY: Omit<Empleado,'id'|'created_at'|'user_id'> = { nombre:'', rut:'', cargo:'', sueldo:0, horas_extra:0, estado:'activo', tipo:'planta', inicio:'' }

export default function RRHHPage() {
  const [items, setItems]   = useState<Empleado[]>([])
  const [modal, setModal]   = useState<'nuevo'|'editar'|null>(null)
  const [form, setForm]     = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/empleados')
    setItems(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const upd = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.nombre) return
    setSaving(true)
    const method = modal === 'nuevo' ? 'POST' : 'PUT'
    await fetch('/api/empleados', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, sueldo: Number(form.sueldo), horas_extra: Number(form.horas_extra) }) })
    await load(); setSaving(false); setModal(null)
  }

  const del = async (id: string) => {
    if (!confirm('¿Eliminar trabajador?')) return
    await fetch('/api/empleados', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
    await load()
  }

  const totalNomina = items.reduce((s, e) => s + e.sueldo + e.horas_extra * 14000, 0)
  const totalHE     = items.reduce((s, e) => s + e.horas_extra, 0)

  const initials = (n: string) => n.split(' ').map(x => x[0]).slice(0,2).join('')

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <SectionTitle>Recursos humanos</SectionTitle>
        <Btn variant="primary" onClick={() => { setForm({ ...EMPTY }); setModal('nuevo') }}>+ Agregar trabajador</Btn>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        <MetricCard label="Total personal"  value={items.length} />
        <MetricCard label="Nómina mensual"  value={fmtM(totalNomina)} />
        <MetricCard label="Horas extra"     value={`${totalHE} h`} sub="Este mes" subColor="#b07d1a" />
        <MetricCard label="Vacaciones"      value={items.filter(e=>e.estado==='vacaciones').length} sub="trabajadores" />
      </div>

      {loading
        ? <p style={{ color:'#6b7a8d', textAlign:'center', padding:40 }}>Cargando...</p>
        : (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {/* Lista */}
          <div style={{ background:'#fff', border:'1px solid #e4e9f0', borderRadius:12, padding:18 }}>
            <div style={{ fontSize:14, fontWeight:700, marginBottom:14, color:'#1a2535' }}>Personal</div>
            {items.length === 0
              ? <p style={{ fontSize:13, color:'#6b7a8d', textAlign:'center', padding:20 }}>Sin trabajadores aún</p>
              : items.map(e => (
              <div key={e.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid #f0f4f8' }}>
                <div style={{ width:36, height:36, borderRadius:'50%', background:'#e8f1fb', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#1e6bb8', flexShrink:0 }}>
                  {initials(e.nombre)}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{e.nombre}</div>
                  <div style={{ fontSize:12, color:'#6b7a8d' }}>{e.cargo} · {e.tipo}</div>
                </div>
                <Badge estado={e.estado} tipo="empleado" />
                <div style={{ display:'flex', gap:4 }}>
                  <Btn onClick={() => { setForm({ ...e }); setModal('editar') }} style={{ fontSize:11, padding:'4px 8px' }}>✎</Btn>
                  <Btn variant="danger" onClick={() => del(e.id)} style={{ fontSize:11, padding:'4px 8px' }}>✕</Btn>
                </div>
              </div>
            ))}
          </div>

          {/* Liquidaciones */}
          <div style={{ background:'#fff', border:'1px solid #e4e9f0', borderRadius:12, padding:18 }}>
            <div style={{ fontSize:14, fontWeight:700, marginBottom:14, color:'#1a2535' }}>Liquidaciones del mes</div>
            <Table>
              <thead><tr><Th>Trabajador</Th><Th>Base</Th><Th>HH.EE</Th><Th>Total</Th></tr></thead>
              <tbody>
                {items.map(e => {
                  const he = e.horas_extra * 14000
                  return (
                    <tr key={e.id}>
                      <Td style={{ fontWeight:600 }}>{e.nombre.split(' ')[0]} {e.nombre.split(' ')[1]?.[0]}.</Td>
                      <Td>{fmt(e.sueldo)}</Td>
                      <Td style={{ color: he>0 ? '#b07d1a':'#aaa' }}>{he>0 ? fmt(he):'—'}</Td>
                      <Td style={{ fontWeight:700 }}>{fmt(e.sueldo + he)}</Td>
                    </tr>
                  )
                })}
                {items.length > 0 && (
                  <tr>
                    <Td colSpan={3} style={{ fontWeight:700, textAlign:'right', paddingTop:12 }}>Total nómina</Td>
                    <Td style={{ fontWeight:700, color:'#1e6bb8', paddingTop:12 }}>{fmt(totalNomina)}</Td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </div>
      )}

      {modal && (
        <Modal title={modal==='nuevo'?'Nuevo trabajador':'Editar trabajador'} onClose={() => setModal(null)}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ gridColumn:'1/-1' }}><FormInput label="Nombre completo" value={form.nombre||''} onChange={v=>upd('nombre',v)} required /></div>
            <FormInput label="RUT"                value={form.rut||''}          onChange={v=>upd('rut',v)} />
            <FormInput label="Cargo"              value={form.cargo||''}        onChange={v=>upd('cargo',v)} />
            <FormInput label="Sueldo base (CLP)"  value={form.sueldo||''}       onChange={v=>upd('sueldo',v)}      type="number" />
            <FormInput label="Horas extra / mes"  value={form.horas_extra??0}   onChange={v=>upd('horas_extra',v)} type="number" />
            <FormSelect label="Tipo"  value={form.tipo||'planta'} onChange={v=>upd('tipo',v)}
              options={[{value:'planta',label:'Planta'},{value:'subcontrato',label:'Subcontrato'}]} />
            <FormSelect label="Estado" value={form.estado||'activo'} onChange={v=>upd('estado',v)}
              options={[{value:'activo',label:'Activo'},{value:'vacaciones',label:'Vacaciones'},{value:'inactivo',label:'Inactivo'}]} />
            <FormInput label="Fecha ingreso" value={form.inicio||''} onChange={v=>upd('inicio',v)} type="date" />
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
