// components/ui.tsx
'use client'

import React from 'react'

// ── BADGE ────────────────────────────────────────────────
const BADGE_MAPS: Record<string, Record<string, { label: string; cls: string }>> = {
  proyecto: {
    activo:    { label: 'En curso',      cls: 'text-brand bg-brand-bg' },
    terminado: { label: 'Terminado',     cls: 'text-success bg-success-bg' },
    cotizacion:{ label: 'En cotización', cls: 'text-warning bg-warning-bg' },
  },
  empleado: {
    activo:    { label: 'Activo',     cls: 'text-success bg-success-bg' },
    vacaciones:{ label: 'Vacaciones', cls: 'text-warning bg-warning-bg' },
    inactivo:  { label: 'Inactivo',   cls: 'text-danger bg-danger-bg' },
  },
  factura: {
    pagada:   { label: 'Pagada',   cls: 'text-success bg-success-bg' },
    pendiente:{ label: 'Pendiente',cls: 'text-warning bg-warning-bg' },
    vencida:  { label: 'Vencida',  cls: 'text-danger bg-danger-bg' },
  },
  contrato: {
    ejecucion: { label: 'En ejecución', cls: 'text-brand bg-brand-bg' },
    liquidado: { label: 'Liquidado',    cls: 'text-success bg-success-bg' },
    pendiente: { label: 'Pendiente',    cls: 'text-warning bg-warning-bg' },
  },
  proveedor: {
    activo:    { label: 'Activo',     cls: 'text-success bg-success-bg' },
    cotizacion:{ label: 'Cotización', cls: 'text-warning bg-warning-bg' },
  },
}

export function Badge({ estado, tipo }: { estado: string; tipo: keyof typeof BADGE_MAPS }) {
  const s = BADGE_MAPS[tipo]?.[estado] ?? { label: estado, cls: 'text-muted bg-line' }
  return (
    <span className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-md whitespace-nowrap ${s.cls}`}>
      {s.label}
    </span>
  )
}

// ── PROGRESS ─────────────────────────────────────────────
export function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#e8edf2] rounded-full overflow-hidden min-w-[60px]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-success' : 'bg-brand'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted min-w-[30px]">{pct}%</span>
    </div>
  )
}

// ── METRIC CARD ───────────────────────────────────────────
export function MetricCard({ label, value, sub, subColor }: { label: string; value: string | number; sub?: string; subColor?: string }) {
  return (
    <div className="bg-white border border-line rounded-card p-4 shadow-card">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className="text-2xl font-bold text-ink tabular-nums">{value}</div>
      {sub && (
        <div className="text-xs mt-0.5" style={{ color: subColor ?? '#6b7a8d' }}>{sub}</div>
      )}
    </div>
  )
}

// ── BTN ───────────────────────────────────────────────────
type BtnVariant = 'default' | 'primary' | 'danger'
const btnVariants: Record<BtnVariant, string> = {
  default: 'bg-white border border-line2 text-ink hover:bg-canvas',
  primary: 'bg-brand border border-brand text-white hover:bg-brand-dark',
  danger:  'bg-danger-bg border border-[#f5c6c2] text-danger hover:bg-[#fbdbd7]',
}
export function Btn({ children, onClick, variant = 'default', className = '', style, disabled, type = 'button' }:
  { children: React.ReactNode; onClick?: () => void; variant?: BtnVariant; className?: string; style?: React.CSSProperties; disabled?: boolean; type?: 'button'|'submit' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={style}
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition
        ${disabled ? 'opacity-60 cursor-default' : 'cursor-pointer'} ${btnVariants[variant]} ${className}`}>
      {children}
    </button>
  )
}

// ── INPUT ─────────────────────────────────────────────────
export function FormInput({ label, value, onChange, type = 'text', placeholder, required }: {
  label?: string; value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean
}) {
  return (
    <div className="mb-3">
      {label && <label className="label-base">{label}</label>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required}
        className="input-base" />
    </div>
  )
}

// ── SELECT ────────────────────────────────────────────────
export function FormSelect({ label, value, onChange, options }: {
  label?: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <div className="mb-3">
      {label && <label className="label-base">{label}</label>}
      <select value={value} onChange={e => onChange(e.target.value)} className="input-base cursor-pointer">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ── MODAL ─────────────────────────────────────────────────
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/35 z-[100] flex items-center justify-center p-5">
      <div className="bg-white rounded-card p-7 max-w-[540px] w-full shadow-pop max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-base font-bold text-ink m-0">{title}</h3>
          <button onClick={onClose} className="bg-transparent border-none text-2xl cursor-pointer text-muted leading-none hover:text-ink transition">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── TABLE ─────────────────────────────────────────────────
export function Table({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full border-collapse text-[13px]">{children}</table></div>
}
export function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-3 py-2.5 border-b border-line font-semibold text-xs text-muted whitespace-nowrap">{children}</th>
}
export function Td({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <td className={`px-3 py-2.5 border-b border-[#f0f4f8] ${className}`} style={style}>{children}</td>
}

// ── SECTION TITLE ─────────────────────────────────────────
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-ink m-0">{children}</h2>
}

// ── FORMAT HELPERS (re-exportados desde lib/format) ───────
export { fmt, fmtM } from '@/lib/format'
