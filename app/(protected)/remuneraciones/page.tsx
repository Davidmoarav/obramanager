'use client'
// app/(protected)/remuneraciones/page.tsx

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Btn, FormInput, FormSelect, Modal, SectionTitle, MetricCard } from '@/components/ui'
import { fmt } from '@/lib/format'
import { calcularLiquidacion, type ParametrosRemuneracion, type EmpleadoPrevisional } from '@/types/finanzas'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function periodoActual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function labelPeriodo(periodo: string) {
  const [y, m] = periodo.split('-')
  return `${MESES[Number(m) - 1]} ${y}`
}

export default function RemuneracionesPage() {
  const [tab, setTab] = useState<'liquidaciones' | 'parametros' | 'empleados'>('liquidaciones')
  const [params, setParams] = useState<ParametrosRemuneracion | null>(null)
  const [empleados, setEmpleados] = useState<EmpleadoPrevisional[]>([])
  const [periodo, setPeriodo] = useState(periodoActual())
  const [loading, setLoading] = useState(true)
  const [savingParams, setSavingParams] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // Modal de edición previsional de empleado
  const [empModal, setEmpModal] = useState<EmpleadoPrevisional | null>(null)
  const [empForm, setEmpForm] = useState<any>({})
  const [savingEmp, setSavingEmp] = useState(false)

  // ─── Carga inicial ───────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const [rp, re] = await Promise.all([
      fetch('/api/parametros-rem').then(r => r.json()),
      fetch('/api/empleados').then(r => r.json()),
    ])
    setParams(rp)
    setEmpleados(Array.isArray(re) ? re.filter((e: any) => e.estado !== 'inactivo') : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ─── Liquidaciones calculadas en vivo ────────────────────
  const liquidaciones = useMemo(() => {
    if (!params) return []
    return empleados.map(emp => ({
      empleado: emp,
      calc: calcularLiquidacion(emp, params),
    }))
  }, [empleados, params])

  const totales = useMemo(() => {
    return liquidaciones.reduce((acc, l) => ({
      imponible: acc.imponible + l.calc.total_imponible,
      descuentos: acc.descuentos + l.calc.total_descuentos,
      liquido: acc.liquido + l.calc.liquido_pagar,
    }), { imponible: 0, descuentos: 0, liquido: 0 })
  }, [liquidaciones])

  // ─── Guardar parámetros ──────────────────────────────────
  const updParam = (k: string, v: any) => setParams(p => p ? { ...p, [k]: Number(v) } : p)

  const saveParams = async () => {
    if (!params) return
    setSavingParams(true)
    setMsg(null)
    const res = await fetch('/api/parametros-rem', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (res.ok) setMsg('Parámetros guardados correctamente')
    setSavingParams(false)
  }

  // ─── Editar previsional de empleado ──────────────────────
  const openEmp = (emp: EmpleadoPrevisional) => {
    setEmpForm({ ...emp })
    setEmpModal(emp)
  }
  const updEmp = (k: string, v: any) => setEmpForm((f: any) => ({ ...f, [k]: v }))

  const saveEmp = async () => {
    setSavingEmp(true)
    await fetch('/api/empleados', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(empForm),
    })
    await load()
    setSavingEmp(false)
    setEmpModal(null)
  }

  // ─── Guardar liquidación de un empleado ──────────────────
  const guardarLiq = async (emp: EmpleadoPrevisional, calc: any) => {
    await fetch('/api/remuneraciones', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empleado_id: emp.id, periodo, estado: 'borrador', ...calc }),
    })
    setMsg(`Liquidación de ${emp.nombre} guardada`)
  }

  if (loading || !params) return <p style={{ color: '#6b7a8d', padding: 20 }}>Cargando...</p>

  return (
    <div>
      <div className="mb-5">
        <SectionTitle>Remuneraciones</SectionTitle>
        <p className="text-sm text-muted mt-1">Gestión de sueldos, descuentos previsionales y liquidaciones</p>
      </div>

      {msg && (
        <div className="bg-success-bg text-success border border-[#b9e0c9] px-4 py-2.5 rounded-xl mb-4 text-[13px]">
          {msg}
        </div>
      )}

      {/* TABS */}
      <div className="inline-flex gap-1 p-1 bg-canvas rounded-xl mb-6">
        {[
          { key: 'liquidaciones' as const, label: '💰 Liquidaciones' },
          { key: 'empleados' as const,     label: '👤 Datos previsionales' },
          { key: 'parametros' as const,    label: '⚙ Parámetros' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-[13px] font-semibold transition
              ${tab === t.key ? 'bg-white text-brand shadow-card' : 'text-muted hover:text-ink'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════ TAB LIQUIDACIONES ══════ */}
      {tab === 'liquidaciones' && (
        <div>
          {/* Selector de período */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#6b7a8d' }}>Período:</label>
            <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #d1d9e6', borderRadius: 7, fontSize: 13 }} />
            <span style={{ fontSize: 13, color: '#1a2535', fontWeight: 600 }}>{labelPeriodo(periodo)}</span>
          </div>

          {/* Métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            <MetricCard label="Total imponible"  value={fmt(totales.imponible)} sub={`${liquidaciones.length} empleados`} />
            <MetricCard label="Total descuentos" value={fmt(totales.descuentos)} subColor="#b0401a" />
            <MetricCard label="Líquido a pagar"  value={fmt(totales.liquido)} subColor="#1a7a4a" sub="Total nómina del mes" />
          </div>

          {/* Tabla de liquidaciones */}
          <div style={{ background: '#fff', border: '1px solid #e4e9f0', borderRadius: 12, padding: 18, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 800 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e4e9f0' }}>
                  <th style={thS}>Empleado</th>
                  <th style={thNum}>Imponible</th>
                  <th style={thNum}>AFP</th>
                  <th style={thNum}>Salud</th>
                  <th style={thNum}>AFC</th>
                  <th style={thNum}>Otros</th>
                  <th style={thNum}>Líquido</th>
                  <th style={thS}></th>
                </tr>
              </thead>
              <tbody>
                {liquidaciones.map(({ empleado, calc }) => (
                  <tr key={empleado.id} style={{ borderBottom: '1px solid #f0f4f8' }}>
                    <td style={tdS}>
                      <div style={{ fontWeight: 700, color: '#1a2535' }}>{empleado.nombre}</div>
                      <div style={{ fontSize: 10, color: '#6b7a8d' }}>{empleado.cargo} · {empleado.afp_nombre || 'AFP'} · {empleado.salud_sistema || 'Fonasa'}</div>
                    </td>
                    <td style={tdNum}>{fmt(calc.total_imponible)}</td>
                    <td style={{ ...tdNum, color: '#b0401a' }}>{fmt(calc.desc_afp)}</td>
                    <td style={{ ...tdNum, color: '#b0401a' }}>{fmt(calc.desc_salud)}</td>
                    <td style={{ ...tdNum, color: '#b0401a' }}>{fmt(calc.desc_afc)}</td>
                    <td style={{ ...tdNum, color: '#b0401a' }}>{fmt(calc.otros_descuentos)}</td>
                    <td style={{ ...tdNum, fontWeight: 800, color: '#1a7a4a' }}>{fmt(calc.liquido_pagar)}</td>
                    <td style={tdS}>
                      <Btn onClick={() => guardarLiq(empleado, calc)} style={{ fontSize: 10, padding: '3px 8px' }}>Guardar</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {liquidaciones.length === 0 && <p style={{ textAlign: 'center', color: '#6b7a8d', padding: 20 }}>No hay empleados activos.</p>}
          </div>

          <p style={{ fontSize: 11, color: '#6b7a8d', marginTop: 10 }}>
            💡 Las liquidaciones se calculan automáticamente con los parámetros y datos previsionales de cada empleado. Edita los datos en la pestaña correspondiente.
          </p>
        </div>
      )}

      {/* ══════ TAB DATOS PREVISIONALES POR EMPLEADO ══════ */}
      {tab === 'empleados' && (
        <div style={{ background: '#fff', border: '1px solid #e4e9f0', borderRadius: 12, padding: 18 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e4e9f0' }}>
                <th style={thS}>Empleado</th>
                <th style={thS}>AFP</th>
                <th style={thS}>Salud</th>
                <th style={thS}>Contrato</th>
                <th style={thNum}>Sueldo base</th>
                <th style={thNum}>Bonos/Asign.</th>
                <th style={thS}></th>
              </tr>
            </thead>
            <tbody>
              {empleados.map(emp => (
                <tr key={emp.id} style={{ borderBottom: '1px solid #f0f4f8' }}>
                  <td style={tdS}><span style={{ fontWeight: 700 }}>{emp.nombre}</span><br/><span style={{ fontSize: 10, color: '#6b7a8d' }}>{emp.cargo}</span></td>
                  <td style={tdS}>{emp.afp_nombre || 'Modelo'} {emp.afp_pct_custom ? `(${emp.afp_pct_custom}%)` : ''}</td>
                  <td style={tdS}>{emp.salud_sistema || 'Fonasa'}{emp.salud_sistema === 'Isapre' && emp.salud_uf ? ` (${emp.salud_uf} UF)` : ''}</td>
                  <td style={tdS}>{emp.contrato_tipo || 'indefinido'}</td>
                  <td style={tdNum}>{fmt(emp.sueldo)}</td>
                  <td style={tdNum}>{fmt((emp.bono_imponible || 0) + (emp.colacion || 0) + (emp.movilizacion || 0))}</td>
                  <td style={tdS}><Btn onClick={() => openEmp(emp)} style={{ fontSize: 10, padding: '3px 8px' }}>Editar</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
          {empleados.length === 0 && <p style={{ textAlign: 'center', color: '#6b7a8d', padding: 20 }}>No hay empleados. Agrégalos en el módulo RRHH.</p>}
        </div>
      )}

      {/* ══════ TAB PARÁMETROS ══════ */}
      {tab === 'parametros' && (
        <div style={{ maxWidth: 640 }}>
          <div style={{ background: '#fff', border: '1px solid #e4e9f0', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2535', marginBottom: 4 }}>Porcentajes previsionales</div>
            <p style={{ fontSize: 12, color: '#6b7a8d', marginBottom: 16 }}>Valores por defecto que se aplican a todos los empleados (salvo que tengan valor propio).</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <FormInput label="AFP - cotización obligatoria (%)" value={params.afp_pct} onChange={v => updParam('afp_pct', v)} type="number" />
              <FormInput label="AFP - comisión promedio (%)" value={params.afp_comision_pct} onChange={v => updParam('afp_comision_pct', v)} type="number" />
              <FormInput label="Salud - Fonasa/Isapre base (%)" value={params.salud_pct} onChange={v => updParam('salud_pct', v)} type="number" />
              <FormInput label="AFC - trabajador (%)" value={params.afc_trabajador_pct} onChange={v => updParam('afc_trabajador_pct', v)} type="number" />
              <FormInput label="AFC - empleador (%)" value={params.afc_empleador_pct} onChange={v => updParam('afc_empleador_pct', v)} type="number" />
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e4e9f0', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2535', marginBottom: 16 }}>Valores de referencia</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <FormInput label="Valor UF ($)" value={params.uf_valor} onChange={v => updParam('uf_valor', v)} type="number" />
              <FormInput label="Valor UTM ($)" value={params.utm_valor} onChange={v => updParam('utm_valor', v)} type="number" />
              <FormInput label="Tope imponible (UF)" value={params.tope_imponible_uf} onChange={v => updParam('tope_imponible_uf', v)} type="number" />
              <FormInput label="Tope gratificación mensual ($)" value={params.gratificacion_tope} onChange={v => updParam('gratificacion_tope', v)} type="number" />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Btn variant="primary" onClick={saveParams} disabled={savingParams}>
              {savingParams ? 'Guardando...' : 'Guardar parámetros'}
            </Btn>
          </div>
        </div>
      )}

      {/* ══════ MODAL EDITAR PREVISIONAL EMPLEADO ══════ */}
      {empModal && (
        <Modal title={`Datos previsionales — ${empModal.nombre}`} onClose={() => setEmpModal(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormInput label="Sueldo base ($)" value={empForm.sueldo ?? 0} onChange={v => updEmp('sueldo', Number(v))} type="number" />
            <FormInput label="Horas extra (cant.)" value={empForm.horas_extra ?? 0} onChange={v => updEmp('horas_extra', Number(v))} type="number" />

            <FormInput label="Nombre AFP" value={empForm.afp_nombre || ''} onChange={v => updEmp('afp_nombre', v)} placeholder="Modelo, Habitat, ProVida..." />
            <FormInput label="AFP % propio (opcional)" value={empForm.afp_pct_custom ?? ''} onChange={v => updEmp('afp_pct_custom', v ? Number(v) : null)} type="number" placeholder="Si difiere del global" />

            <FormSelect label="Sistema de salud" value={empForm.salud_sistema || 'Fonasa'} onChange={v => updEmp('salud_sistema', v)}
              options={[{ value: 'Fonasa', label: 'Fonasa' }, { value: 'Isapre', label: 'Isapre' }]} />
            {empForm.salud_sistema === 'Isapre'
              ? <FormInput label="Plan Isapre (UF)" value={empForm.salud_uf ?? 0} onChange={v => updEmp('salud_uf', Number(v))} type="number" />
              : <FormInput label="Salud % propio (opcional)" value={empForm.salud_pct_custom ?? ''} onChange={v => updEmp('salud_pct_custom', v ? Number(v) : null)} type="number" placeholder="Default 7%" />}

            <FormSelect label="Tipo de contrato" value={empForm.contrato_tipo || 'indefinido'} onChange={v => updEmp('contrato_tipo', v)}
              options={[
                { value: 'indefinido', label: 'Indefinido' },
                { value: 'plazo_fijo', label: 'Plazo fijo' },
                { value: 'obra_faena', label: 'Por obra o faena' },
              ]} />
            <FormInput label="Bono imponible ($)" value={empForm.bono_imponible ?? 0} onChange={v => updEmp('bono_imponible', Number(v))} type="number" />

            <FormInput label="Colación ($, no imponible)" value={empForm.colacion ?? 0} onChange={v => updEmp('colacion', Number(v))} type="number" />
            <FormInput label="Movilización ($, no imponible)" value={empForm.movilizacion ?? 0} onChange={v => updEmp('movilizacion', Number(v))} type="number" />

            <div style={{ gridColumn: '1/-1' }}>
              <FormInput label="Otros descuentos ($, anticipos/préstamos)" value={empForm.otros_descuentos ?? 0} onChange={v => updEmp('otros_descuentos', Number(v))} type="number" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            <Btn onClick={() => setEmpModal(null)}>Cancelar</Btn>
            <Btn variant="primary" onClick={saveEmp} disabled={savingEmp}>{savingEmp ? 'Guardando...' : 'Guardar'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}

const thS: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#6b7a8d', textTransform: 'uppercase', letterSpacing: 0.3 }
const thNum: React.CSSProperties = { ...thS, textAlign: 'right' }
const tdS: React.CSSProperties = { padding: '8px 10px', color: '#1a2535' }
const tdNum: React.CSSProperties = { padding: '8px 10px', textAlign: 'right', color: '#1a2535', fontVariantNumeric: 'tabular-nums' }
