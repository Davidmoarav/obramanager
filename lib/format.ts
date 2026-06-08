// lib/format.ts
// Helpers de formateo puros — sin 'use client', usables en Server y Client Components

export const fmt  = (n: number) => '$' + Number(n).toLocaleString('es-CL')
export const fmtM = (n: number) => '$' + (n / 1_000_000).toFixed(1) + 'M'
