// components/ui-server.tsx
// Componentes y helpers usables en Server Components (sin 'use client')

import React from 'react'

// ── BADGE ────────────────────────────────────────────────
const BADGE_MAPS: Record<string, Record<string, { label: string; color: string; bg: string }>> = {
  proyecto: {
    activo:     { label: 'En curso',       color: '#1e6bb8', bg: '#e8f1fb' },
    terminado:  { label: 'Terminado',      color: '#1a7a4a', bg: '#e6f4ed' },
    cotizacion: { label: 'En cotización',  color: '#b07d1a', bg: '#fef3d7' },
  },
  empleado: {
    activo:     { label: 'Activo',     color: '#1a7a4a', bg: '#e6f4ed' },
    vacaciones: { label: 'Vacaciones', color: '#b07d1a', bg: '#fef3d7' },
    inactivo:   { label: 'Inactivo',   color: '#b0401a', bg: '#fdecea' },
  },
  factura: {
    pagada:    { label: 'Pagada',    color: '#1a7a4a', bg: '#e6f4ed' },
    pendiente: { label: 'Pendiente', color: '#b07d1a', bg: '#fef3d7' },
    vencida:   { label: 'Vencida',   color: '#b0401a', bg: '#fdecea' },
  },
  contrato: {
    ejecucion: { label: 'En ejecución', color: '#1e6bb8', bg: '#e8f1fb' },
    liquidado: { label: 'Liquidado',    color: '#1a7a4a', bg: '#e6f4ed' },
    pendiente: { label: 'Pendiente',    color: '#b07d1a', bg: '#fef3d7' },
  },
  proveedor: {
    activo:     { label: 'Activo',      color: '#1a7a4a', bg: '#e6f4ed' },
    cotizacion: { label: 'Cotización',  color: '#b07d1a', bg: '#fef3d7' },
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
        <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#1a7a4a' : '#1e6bb8', borderRadius: 3 }} />
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

// ── TABLE ─────────────────────────────────────────────────
export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>{children}</table>
    </div>
  )
}

export function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ textAlign: 'left', padding: '9px 12px', borderBottom: '1px solid #e4e9f0', fontWeight: 600, fontSize: 12, color: '#6b7a8d', whiteSpace: 'nowrap' }}>
      {children}
    </th>
  )
}

export function Td({ children, style = {}, colSpan }: { children: React.ReactNode; style?: React.CSSProperties; colSpan?: number }) {
  return (
    <td colSpan={colSpan} style={{ padding: '11px 12px', borderBottom: '1px solid #f0f4f8', ...style }}>
      {children}
    </td>
  )
}

// ── SECTION TITLE ─────────────────────────────────────────
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a2535', margin: '0 0 18px' }}>
      {children}
    </h2>
  )
}
