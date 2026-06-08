// app/(protected)/finanzas/page.tsx  — SERVER COMPONENT
import { createServerSupabase } from '@/lib/supabase-server'
import { MetricCard, SectionTitle } from '@/components/ui-server'
import { fmt, fmtM } from '@/lib/format'

export default async function FinanzasPage() {
  const supabase = await createServerSupabase()

  const [{ data: facturas }, { data: empleados }] = await Promise.all([
    supabase.from('facturas').select('monto, estado'),
    supabase.from('empleados').select('sueldo, horas_extra'),
  ])

  const f = facturas  ?? []
  const e = empleados ?? []

  const cobrado   = f.filter((x:any) => x.estado === 'pagada').reduce((s:number, x:any) => s + x.monto, 0)
  const pendiente = f.filter((x:any) => x.estado === 'pendiente').reduce((s:number, x:any) => s + x.monto, 0)
  const vencido   = f.filter((x:any) => x.estado === 'vencida').reduce((s:number, x:any) => s + x.monto, 0)
  const nomina    = e.reduce((s:number, x:any) => s + x.sueldo + x.horas_extra * 14000, 0)

  const gastos = [
    { cat: 'Mano de obra',   monto: nomina,                    color: '#1e6bb8' },
    { cat: 'Materiales',     monto: Math.round(nomina * 0.76), color: '#e09820' },
    { cat: 'Subcontratos',   monto: Math.round(nomina * 0.38), color: '#1a7a4a' },
    { cat: 'Equipos',        monto: Math.round(nomina * 0.18), color: '#c0397a' },
    { cat: 'Administracion', monto: Math.round(nomina * 0.14), color: '#888'    },
  ]
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0)

  return (
    <div>
      <SectionTitle>Finanzas</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        <MetricCard label="Ingresos cobrados" value={fmtM(cobrado)}   sub="Facturas pagadas"    subColor="#1a7a4a" />
        <MetricCard label="CxC pendiente"     value={fmtM(pendiente)} sub="Por cobrar"           subColor="#b07d1a" />
        <MetricCard label="CxC vencida"       value={fmtM(vencido)}   sub="Gestion urgente"     subColor="#b0401a" />
        <MetricCard label="Nomina mensual"    value={fmtM(nomina)}    sub="Mano de obra directa" />
      </div>
      <div style={{ background: '#fff', border: '1px solid #e4e9f0', borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: '#1a2535' }}>
          Distribucion de costos estimada
        </div>
        {nomina === 0
          ? <p style={{ fontSize: 13, color: '#6b7a8d', textAlign: 'center', padding: 20 }}>Agrega empleados en RRHH para ver la distribucion de costos.</p>
          : gastos.map(g => {
              const pct = totalGastos > 0 ? Math.round((g.monto / totalGastos) * 100) : 0
              return (
                <div key={g.cat} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{g.cat}</span>
                    <span style={{ color: '#6b7a8d' }}>{fmt(g.monto)} ({pct}%)</span>
                  </div>
                  <div style={{ height: 9, background: '#e8edf2', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: g.color, borderRadius: 5 }} />
                  </div>
                </div>
              )
            })}
        <p style={{ fontSize: 12, color: '#a0aab8', marginTop: 16 }}>
          Los costos de materiales, subcontratos y equipos son estimaciones proporcionales basadas en la nomina registrada.
        </p>
      </div>
    </div>
  )
}
