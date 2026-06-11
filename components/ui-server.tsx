// components/ui-server.tsx
// Componentes usables en Server Components (sin 'use client') — versión Tailwind

import React from 'react'

// ── BADGE ────────────────────────────────────────────────
const BADGE_MAPS: Record<string, Record<string, { label: string; cls: string }>> = {
  proyecto: {
    activo:     { label: 'En curso',       cls: 'text-brand bg-brand-bg' },
    terminado:  { label: 'Terminado',      cls: 'text-success bg-success-bg' },
    cotizacion: { label: 'En cotización',  cls: 'text-warning bg-warning-bg' },
  },
  empleado: {
    activo:     { label: 'Activo',     cls: 'text-success bg-success-bg' },
    vacaciones: { label: 'Vacaciones', cls: 'text-warning bg-warning-bg' },
    inactivo:   { label: 'Inactivo',   cls: 'text-danger bg-danger-bg' },
  },
  factura: {
    pagada:    { label: 'Pagada',    cls: 'text-success bg-success-bg' },
    pendiente: { label: 'Pendiente', cls: 'text-warning bg-warning-bg' },
    vencida:   { label: 'Vencida',   cls: 'text-danger bg-danger-bg' },
  },
  contrato: {
    ejecucion: { label: 'En ejecución', cls: 'text-brand bg-brand-bg' },
    liquidado: { label: 'Liquidado',    cls: 'text-success bg-success-bg' },
    pendiente: { label: 'Pendiente',    cls: 'text-warning bg-warning-bg' },
  },
  proveedor: {
    activo:     { label: 'Activo',      cls: 'text-success bg-success-bg' },
    cotizacion: { label: 'Cotización',  cls: 'text-warning bg-warning-bg' },
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
        <div className={`h-full rounded-full ${pct === 100 ? 'bg-success' : 'bg-brand'}`} style={{ width: `${pct}%` }} />
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
      {sub && <div className="text-xs mt-0.5" style={{ color: subColor ?? '#6b7a8d' }}>{sub}</div>}
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
export function Td({ children, className = '', style, colSpan }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; colSpan?: number }) {
  return <td colSpan={colSpan} className={`px-3 py-2.5 border-b border-[#f0f4f8] ${className}`} style={style}>{children}</td>
}

// ── SECTION TITLE ─────────────────────────────────────────
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-ink m-0">{children}</h2>
}
