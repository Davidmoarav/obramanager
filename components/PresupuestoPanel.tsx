'use client'
// components/PresupuestoPanel.tsx
//
// Administra el presupuesto de la obra y los Estados de Pago.
// - Vista de presupuesto: planificado vs ejecutado vs cobrado
// - Estados de pago: cortes mensuales de avance, editables, con factura

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Btn, FormInput, Modal } from '@/components/ui'
import { fmt, fmtM } from '@/lib/format'
import { ESTADO_EP, type EstadoPago } from '@/types/estado-pago'

interface Props {
  proyectoId: string
  valorContrato: number
}

const IVA = 0.19

export default function PresupuestoPanel({ proyectoId, valorContrato }: Props) {
  const [eps, setEps]         = useState<EstadoPago[]>([])
  const [loading, setLoading] = useState(true)
  const [resumen, setResumen] = useState({ presupuesto: 0, ejecutado: 0, cobrado: 0, costo: 0, ganancia: 0, markup_real: 0, margen_venta: 0, costo_ejecutado: 0, ganancia_ejecutada: 0 })

  // Modal nuevo EP
  const [modal, setModal]       = useState(false)
  const [sugerencia, setSugerencia] = useState<any>(null)
  const [detalleEdit, setDetalleEdit] = useState<any[]>([])
  const [retencion, setRetencion]   = useState(0)
  const [anticipo, setAnticipo]     = useState(0)
  const [notas, setNotas]           = useState('')
  const [saving, setSaving]         = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [epData, presData] = await Promise.all([
      fetch(`/api/estados-pago?proyecto_id=${proyectoId}`).then(r => r.json()),
      fetch('/api/presupuesto').then(r => r.json()).catch(() => []),
    ])
    const epList = Array.isArray(epData) ? epData : []
    setEps(epList)

    // Resumen presupuestario de este proyecto
    const p = Array.isArray(presData) ? presData.find((x: any) => x.proyecto_id === proyectoId) : null
    const cobrado = epList
      .filter(e => e.estado === 'pagado')
      .reduce((s, e) => s + (e.monto_pagar || 0), 0)
    setResumen({
      presupuesto: p?.presupuesto_venta || p?.presupuesto_partidas || 0,
      ejecutado: p?.ejecutado || 0,
      cobrado,
      costo: p?.presupuesto_costo || 0,
      ganancia: p?.ganancia_esperada || 0,
      markup_real: p?.markup_real || 0,
      margen_venta: p?.margen_venta_pct || 0,
      costo_ejecutado: p?.costo_ejecutado || 0,
      ganancia_ejecutada: p?.ganancia_ejecutada || 0,
    })
    setLoading(false)
  }, [proyectoId])

  useEffect(() => { load() }, [load])

  // ─── Abrir modal: pedir sugerencia de EP ─────────────────
  const openNuevoEP = async () => {
    const res = await fetch(`/api/estados-pago?proyecto_id=${proyectoId}&sugerir=1`)
    const sug = await res.json()
    setSugerencia(sug)
    setDetalleEdit((sug.detalle || []).map((d: any) => ({ ...d })))
    setRetencion(0)
    setAnticipo(0)
    setNotas('')
    setModal(true)
  }

  // Permite editar el monto de cada línea
  const updDetalle = (idx: number, monto: number) => {
    setDetalleEdit(prev => prev.map((d, i) => i === idx ? { ...d, monto } : d))
  }

  const montoNeto = useMemo(
    () => detalleEdit.reduce((s, d) => s + (Number(d.monto) || 0), 0),
    [detalleEdit]
  )
  const retencionMonto = Math.round(montoNeto * retencion / 100)
  const montoPagar = montoNeto - retencionMonto - anticipo
  const ivaCalc = Math.round(montoPagar * IVA)
  const totalCalc = montoPagar + ivaCalc

  const guardarEP = async () => {
    if (montoNeto <= 0) { alert('El monto del estado de pago debe ser mayor a cero'); return }
    setSaving(true)
    await fetch('/api/estados-pago', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proyecto_id: proyectoId,
        numero: sugerencia.numero,
        periodo: new Date().toISOString().slice(0, 7),
        fecha: new Date().toISOString().split('T')[0],
        monto_neto: montoNeto,
        retencion_pct: retencion,
        anticipo_desc: anticipo,
        notas,
        detalle: detalleEdit,
      }),
    })
    await load(); setSaving(false); setModal(false)
  }

  const cambiarEstado = async (ep: EstadoPago, estado: string, generarFactura = false) => {
    const res = await fetch('/api/estados-pago', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ep.id, estado, generar_factura: generarFactura }),
    })
    const data = await res.json()
    if (data.factura_generada) alert('✓ Factura generada en el módulo de Facturación')
    await load()
  }

  const delEP = async (id: string) => {
    if (!confirm('¿Eliminar este estado de pago?')) return
    await fetch('/api/estados-pago', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await load()
  }

  const totalCobradoConIva = eps.filter(e => e.estado === 'pagado').reduce((s, e) => s + (e.total || 0), 0)
  const pctCobrado = valorContrato > 0 ? Math.round(totalCobradoConIva / valorContrato * 100) : 0

  if (loading) return <p style={{ color: '#6b7a8d', textAlign: 'center', padding: 20 }}>Cargando...</p>

  return (
    <div>
      {/* ─── RESUMEN: COSTO → VENTA → GANANCIA ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <ResumenCard label="Presupuesto costo" valor={fmtM(resumen.costo)} color="#b07d1a" sub="Lo que te cuesta" />
        <ResumenCard label="Precio venta" valor={fmtM(resumen.presupuesto)} color="#1e6bb8" sub="Lo que cobras (neto)" />
        <ResumenCard label="Ganancia esperada" valor={fmtM(resumen.ganancia)} color="#1a7a4a" sub={`Markup ${resumen.markup_real}% · Margen ${resumen.margen_venta}%`} />
        <ResumenCard label="Cobrado" valor={fmtM(totalCobradoConIva)} color="#534ab7" sub={`${pctCobrado}% del contrato`} />
      </div>

      {/* Ejecutado a la fecha: costo vs venta vs ganancia */}
      <div className="bg-canvas border border-line rounded-xl p-4 mb-5">
        <div className="text-[11px] font-bold text-muted uppercase tracking-wide mb-3">Ejecutado a la fecha (según avance físico)</div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-[11px] text-muted">Costo ejecutado</div>
            <div className="text-base font-bold text-[#b07d1a]">{fmt(resumen.costo_ejecutado)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted">Venta ejecutada</div>
            <div className="text-base font-bold text-brand">{fmt(resumen.ejecutado)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted">Ganancia ejecutada</div>
            <div className="text-base font-bold text-success">{fmt(resumen.ganancia_ejecutada)}</div>
          </div>
        </div>
      </div>

      {/* Barra cobrado vs contrato */}
      <div className="mb-6">
        <div className="flex justify-between text-[11px] text-muted mb-1">
          <span>Avance de cobro</span>
          <span className="font-bold text-success">{pctCobrado}%</span>
        </div>
        <div className="h-2.5 bg-[#e8edf2] rounded-full overflow-hidden">
          <div className="h-full bg-success rounded-full transition-all duration-500" style={{ width: `${pctCobrado}%` }} />
        </div>
      </div>

      {/* ─── ESTADOS DE PAGO ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2535' }}>
          Estados de pago ({eps.length})
        </div>
        <Btn variant="primary" onClick={openNuevoEP} style={{ fontSize: 12, padding: '5px 12px' }}>
          + Nuevo estado de pago
        </Btn>
      </div>

      {eps.length === 0
        ? <div style={{ background: '#f8fafc', border: '1px dashed #d1d9e6', borderRadius: 8, padding: 24, textAlign: 'center', fontSize: 12, color: '#6b7a8d' }}>
            Sin estados de pago. Crea el primero cuando tengas avance de obra que cobrar.
          </div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {eps.map(ep => {
              const s = ESTADO_EP[ep.estado] || ESTADO_EP.borrador
              return (
                <div key={ep.id} style={{ border: '1px solid #e4e9f0', borderRadius: 10, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#1a2535' }}>EP N°{ep.numero}</span>
                        <span style={{ background: s.bg, color: s.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5 }}>{s.label}</span>
                        {ep.factura_id && <span style={{ fontSize: 10, color: '#534ab7', fontWeight: 600 }}>🧾 Facturado</span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7a8d', marginTop: 3 }}>
                        {ep.periodo} · {ep.fecha}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#1a2535' }}>{fmt(ep.total)}</div>
                      <div style={{ fontSize: 10, color: '#6b7a8d' }}>Neto {fmt(ep.monto_pagar)} + IVA</div>
                    </div>
                  </div>

                  {/* Desglose */}
                  {(ep.retencion_monto > 0 || ep.anticipo_desc > 0) && (
                    <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#6b7a8d', marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f4f8' }}>
                      <span>Avance: {fmt(ep.monto_neto)}</span>
                      {ep.retencion_monto > 0 && <span style={{ color: '#b0401a' }}>− Retención {ep.retencion_pct}%: {fmt(ep.retencion_monto)}</span>}
                      {ep.anticipo_desc > 0 && <span style={{ color: '#b0401a' }}>− Anticipo: {fmt(ep.anticipo_desc)}</span>}
                    </div>
                  )}

                  {/* Acciones por estado */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {ep.estado === 'borrador' && (
                      <Btn onClick={() => cambiarEstado(ep, 'presentado')} style={{ fontSize: 11, padding: '4px 10px' }}>Marcar presentado</Btn>
                    )}
                    {ep.estado === 'presentado' && (
                      <>
                        <Btn onClick={() => cambiarEstado(ep, 'aprobado')} style={{ fontSize: 11, padding: '4px 10px', background: '#e6f4ed', borderColor: '#b9e0c9', color: '#1a7a4a' }}>Aprobar</Btn>
                        <Btn onClick={() => cambiarEstado(ep, 'rechazado')} style={{ fontSize: 11, padding: '4px 10px', background: '#fdecea', borderColor: '#f5c6c2', color: '#b0401a' }}>Rechazar</Btn>
                      </>
                    )}
                    {ep.estado === 'aprobado' && (
                      <>
                        {!ep.factura_id && (
                          <Btn onClick={() => cambiarEstado(ep, 'aprobado', true)} style={{ fontSize: 11, padding: '4px 10px', background: '#eeedfe', borderColor: '#ccc5fc', color: '#534ab7', fontWeight: 700 }}>🧾 Generar factura</Btn>
                        )}
                        <Btn onClick={() => cambiarEstado(ep, 'pagado')} style={{ fontSize: 11, padding: '4px 10px', background: '#e6f4ed', borderColor: '#b9e0c9', color: '#1a7a4a' }}>Marcar pagado</Btn>
                      </>
                    )}
                    {ep.estado !== 'pagado' && (
                      <button onClick={() => delEP(ep.id)} style={{ fontSize: 11, padding: '4px 10px', background: 'transparent', border: 'none', color: '#b0401a', cursor: 'pointer', marginLeft: 'auto' }}>Eliminar</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

      {/* ═══ MODAL NUEVO EP ═══ */}
      {modal && sugerencia && (
        <Modal title={`Nuevo Estado de Pago N°${sugerencia.numero}`} onClose={() => setModal(false)}>
          {detalleEdit.length === 0
            ? <div style={{ textAlign: 'center', padding: 20 }}>
                <p style={{ fontSize: 13, color: '#6b7a8d' }}>No hay avance nuevo para cobrar.</p>
                <p style={{ fontSize: 12, color: '#6b7a8d', marginTop: 6 }}>Actualiza el avance de las partidas en la pestaña "Control de obra" antes de crear un estado de pago.</p>
              </div>
            : (
              <>
                <p style={{ fontSize: 12, color: '#6b7a8d', marginBottom: 14 }}>
                  Avance a cobrar por partida (sugerido desde el control de obra, editable).
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto', marginBottom: 16 }}>
                  {detalleEdit.map((d, idx) => (
                    <div key={d.partida_id} style={{ background: '#fafbfc', border: '1px solid #e4e9f0', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2535', marginBottom: 6 }}>{d.descripcion}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: 11, color: '#6b7a8d' }}>
                          {d.avance_anterior}% → {d.avance_actual}% <span style={{ color: '#1a7a4a', fontWeight: 700 }}>(+{d.avance_periodo}%)</span>
                          <br/>de {fmt(d.valor_partida)}
                        </div>
                        <div style={{ width: 150 }}>
                          <label style={{ fontSize: 10, color: '#6b7a8d', display: 'block', marginBottom: 2 }}>Monto a cobrar</label>
                          <input type="number" value={d.monto}
                            onChange={e => updDetalle(idx, Number(e.target.value))}
                            style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d9e6', borderRadius: 6, fontSize: 13, textAlign: 'right', fontWeight: 700 }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Deducciones */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <FormInput label="Retención garantía (%)" value={retencion} onChange={v => setRetencion(Number(v) || 0)} type="number" />
                  <FormInput label="Amortización anticipo ($)" value={anticipo} onChange={v => setAnticipo(Number(v) || 0)} type="number" />
                </div>

                {/* Totales */}
                <div style={{ background: '#f0f4f8', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                  <Row label="Avance del período (neto)" valor={fmt(montoNeto)} />
                  {retencionMonto > 0 && <Row label={`Retención ${retencion}%`} valor={`− ${fmt(retencionMonto)}`} color="#b0401a" />}
                  {anticipo > 0 && <Row label="Amortización anticipo" valor={`− ${fmt(anticipo)}`} color="#b0401a" />}
                  <Row label="IVA (19%)" valor={fmt(ivaCalc)} />
                  <div style={{ borderTop: '1px solid #d1d9e6', marginTop: 6, paddingTop: 6 }}>
                    <Row label="Total a facturar" valor={fmt(totalCalc)} bold />
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <FormInput label="Notas (opcional)" value={notas} onChange={setNotas} placeholder="Ej: Incluye trabajos extraordinarios aprobados" />
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Btn onClick={() => setModal(false)}>Cancelar</Btn>
                  <Btn variant="primary" onClick={guardarEP} disabled={saving}>{saving ? 'Guardando...' : 'Crear estado de pago'}</Btn>
                </div>
              </>
            )}
        </Modal>
      )}
    </div>
  )
}

function ResumenCard({ label, valor, color, sub }: { label: string; valor: string; color: string; sub?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e4e9f0', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 10, color: '#6b7a8d', textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color, marginTop: 4 }}>{valor}</div>
      {sub && <div style={{ fontSize: 10, color: '#6b7a8d', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Row({ label, valor, color, bold }: { label: string; valor: string; color?: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: bold ? 15 : 13, marginBottom: 3 }}>
      <span style={{ color: color || '#6b7a8d', fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ color: color || '#1a2535', fontWeight: bold ? 800 : 600 }}>{valor}</span>
    </div>
  )
}
