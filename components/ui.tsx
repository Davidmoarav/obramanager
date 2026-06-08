// components/ui.tsx
'use client'

import React from 'react'

// ── BADGE ────────────────────────────────────────────────
const BADGE_MAPS: Record<string, Record<string, { label: string; color: string; bg: string }>> = {
  proyecto: {
    activo:    { label: 'En curso',      color: '#1e6bb8', bg: '#e8f1fb' },
    terminado: { label: 'Terminado',     color: '#1a7a4a', bg: '#e6f4ed' },
    cotizacion:{ label: 'En cotización', color: '#b07d1a', bg: '#fef3d7' },
  },
  empleado: {
    activo:    { label: 'Activo',     color: '#1a7a4a', bg: '#e6f4ed' },
    vacaciones:{ label: 'Vacaciones', color: '#b07d1a', bg: '#fef3d7' },
    inactivo:  { label: 'Inactivo',   color: '#b0401a', bg: '#fdecea' },
  },
  factura: {
    pagada:   { label: 'Pagada',   color: '#1a7a4a', bg: '#e6f4ed' },
    pendiente:{ label: 'Pendiente',color: '#b07d1a', bg: '#fef3d7' },
    vencida:  { label: 'Vencida',  color: '#b0401a', bg: '#fdecea' },
  },
  contrato: {
    ejecucion: { label: 'En ejecución', color: '#1e6bb8', bg: '#e8f1fb' },
    liquidado: { label: 'Liquidado',    color: '#1a7a4a', bg: '#e6f4ed' },
    pendiente: { label: 'Pendiente',    color: '#b07d1a', bg: '#fef3d7' },
  },
  proveedor: {
    activo:    { label: 'Activo',     color: '#1a7a4a', bg: '#e6f4ed' },
    cotizacion:{ label: 'Cotización', color: '#b07d1a', bg: '#fef3d7' },
  },
}

export function Badge({ estado, tipo }: { estado: string; tipo: keyof typeof BADGE_MAPS }) {
  const s = BADGE_MAPS[tipo]?.[estado] ?? { label: estado, color: '#555', bg: '#eee' }
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

// ── PROGRESS ─────────────────────────────────────────────
export function ProgressBar({ pct }: { pct: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: '#e8edf2', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#1a7a4a' : '#1e6bb8', borderRadius: 3, transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: 12, color: '#6b7a8d', minWidth: 30 }}>{pct}%</span>
    </div>
  )
}

// ── METRIC CARD ───────────────────────────────────────────
export function MetricCard({ label, value, sub, subColor }: { label: string; value: string | number; sub?: string; subColor?: string }) {
  return (
    <div style={{ background: '#f0f4f8', borderRadius: 10, padding: '14px 18px' }}>
      <div style={{ fontSize: 12, color: '#6b7a8d', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#1a2535' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, marginTop: 3, color: subColor ?? '#6b7a8d' }}>{sub}</div>}
    </div>
  )
}

// ── BTN ───────────────────────────────────────────────────
type BtnVariant = 'default' | 'primary' | 'danger'
const btnStyles: Record<BtnVariant, React.CSSProperties> = {
  default: { background: '#fff', border: '1px solid #d1d9e6', color: '#1a2535' },
  primary: { background: '#1e6bb8', border: '1px solid #1e6bb8', color: '#fff' },
  danger:  { background: '#fdecea', border: '1px solid #f5c6c2', color: '#b0401a' },
}
export function Btn({ children, onClick, variant = 'default', style = {}, disabled, type = 'button' }:
  { children: React.ReactNode; onClick?: () => void; variant?: BtnVariant; style?: React.CSSProperties; disabled?: boolean; type?: 'button'|'submit' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1, ...btnStyles[variant], ...style }}>
      {children}
    </button>
  )
}

// ── INPUT ─────────────────────────────────────────────────
export function FormInput({ label, value, onChange, type = 'text', placeholder, required }: {
  label?: string; value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7a8d', marginBottom: 4 }}>{label}</label>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required}
        style={{ width: '100%', padding: '8px 11px', border: '1px solid #d1d9e6', borderRadius: 7, fontSize: 13, color: '#1a2535', background: '#fafbfc', boxSizing: 'border-box', outline: 'none' }} />
    </div>
  )
}

// ── SELECT ────────────────────────────────────────────────
export function FormSelect({ label, value, onChange, options }: {
  label?: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7a8d', marginBottom: 4 }}>{label}</label>}
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '8px 11px', border: '1px solid #d1d9e6', borderRadius: 7, fontSize: 13, color: '#1a2535', background: '#fafbfc' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ── MODAL ─────────────────────────────────────────────────
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, maxWidth: 540, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1a2535', margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7a8d', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── TABLE ─────────────────────────────────────────────────
export function Table({ children }: { children: React.ReactNode }) {
  return <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>{children}</table></div>
}
export function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: 'left', padding: '9px 12px', borderBottom: '1px solid #e4e9f0', fontWeight: 600, fontSize: 12, color: '#6b7a8d', whiteSpace: 'nowrap' }}>{children}</th>
}
export function Td({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: '11px 12px', borderBottom: '1px solid #f0f4f8', ...style }}>{children}</td>
}

// ── SECTION TITLE ─────────────────────────────────────────
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a2535', margin: '0 0 18px' }}>{children}</h2>
}

// ── FORMAT HELPERS (re-exportados desde lib/format) ───────
export { fmt, fmtM } from '@/lib/format'
