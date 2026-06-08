// app/dashboard/page.tsx  — SERVER COMPONENT
import { createServerSupabase } from '@/lib/supabase-server'
import { MetricCard, ProgressBar, Badge, SectionTitle, Table, Th, Td } from '@/components/ui-server'
import { fmt, fmtM } from '@/lib/format'

export default async function DashboardPage() {
  const supabase = await createServerSupabase()

  const [{ data: proyectos }, { data: empleados }, { data: facturas }] = await Promise.all([
    supabase.from('proyectos').select('*').order('created_at', { ascending: false }),
    supabase.from('empleados').select('*'),
    supabase.from('facturas').select('*').order('created_at', { ascending: false }),
  ])

  const p = proyectos ?? []
  const e = empleados ?? []
  const f = facturas  ?? []

  const cobrado   = f.filter((x:any) => x.estado === 'pagada').reduce((s:number, x:any) => s + x.monto, 0)
  const pendiente = f.filter((x:any) => x.estado !== 'pagada').reduce((s:number, x:any) => s + x.monto, 0)
  const activos   = p.filter((x:any) => x.estado === 'activo').length

  const estadosP = [
    { key: 'activo',      label: 'En curso',       color: '#1e6bb8' },
    { key: 'terminado',   label: 'Terminado',      color: '#1a7a4a' },
    { key: 'cotizacion',  label: 'En cotización',  color: '#b07d1a' },
  ]

  return (
    <div>
      <SectionTitle>Panel general</SectionTitle>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        <MetricCard label="Ingresos cobrados"  value={fmtM(cobrado)}   sub="Facturas pagadas"     subColor="#1a7a4a" />
        <MetricCard label="Por cobrar"         value={fmtM(pendiente)} sub="Facturas pendientes"  subColor="#b0401a" />
        <MetricCard label="Proyectos activos"  value={activos}         sub={`+${p.filter((x:any)=>x.estado==='cotizacion').length} en cotización`} subColor="#b07d1a" />
        <MetricCard label="Personal"           value={e.length}        sub={`${e.filter((x:any)=>x.tipo==='subcontrato').length} subcontratados`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* Estado proyectos */}
        <div style={{ background: '#fff', border: '1px solid #e4e9f0', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: '#1a2535' }}>Estado de proyectos</div>
          {estadosP.map(s => {
            const count = p.filter((x:any) => x.estado === s.key).length
            const pct   = p.length ? Math.round((count / p.length) * 100) : 0
            return (
              <div key={s.key} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{s.label}</span>
                  <span style={{ color: '#6b7a8d' }}>{count} proyecto{count !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ height: 8, background: '#e8edf2', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: s.color, borderRadius: 4 }} />
                </div>
              </div>
            )
          })}
          {p.length === 0 && <p style={{ fontSize: 13, color: '#6b7a8d', textAlign: 'center', padding: '20px 0' }}>Sin proyectos aún</p>}
        </div>

        {/* Últimas facturas */}
        <div style={{ background: '#fff', border: '1px solid #e4e9f0', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: '#1a2535' }}>Últimas facturas</div>
          {f.length === 0
            ? <p style={{ fontSize: 13, color: '#6b7a8d', textAlign: 'center', padding: '20px 0' }}>Sin facturas aún</p>
            : f.slice(0, 4).map((fac:any) => (
              <div key={fac.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f4f8' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{fac.cliente}</div>
                  <div style={{ fontSize: 11, color: '#6b7a8d' }}>{fac.numero || '—'}</div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{fmt(fac.monto)}</div>
                  <Badge estado={fac.estado} tipo="factura" />
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Proyectos recientes */}
      <div style={{ background: '#fff', border: '1px solid #e4e9f0', borderRadius: 12, padding: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: '#1a2535' }}>Proyectos recientes</div>
        {p.length === 0
          ? <p style={{ fontSize: 13, color: '#6b7a8d', textAlign: 'center', padding: '20px 0' }}>Dirígete a Proyectos para crear el primero.</p>
          : (
            <Table>
              <thead>
                <tr><Th>Proyecto</Th><Th>Cliente</Th><Th>Avance</Th><Th>Valor</Th><Th>Estado</Th></tr>
              </thead>
              <tbody>
                {p.slice(0, 5).map((pr:any) => (
                  <tr key={pr.id}>
                    <Td style={{ fontWeight: 600 }}>{pr.nombre}</Td>
                    <Td style={{ color: '#6b7a8d' }}>{pr.cliente}</Td>
                    <Td style={{ minWidth: 140 }}><ProgressBar pct={pr.avance} /></Td>
                    <Td style={{ fontWeight: 700 }}>{fmtM(pr.valor)}</Td>
                    <Td><Badge estado={pr.estado} tipo="proyecto" /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
      </div>
    </div>
  )
}
