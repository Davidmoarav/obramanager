'use client'
// components/Sidebar.tsx  — REEMPLAZAR archivo existente

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const MENU = [
  { href: '/dashboard',             label: 'Dashboard',          icon: '⊞', section: 'Principal' },
  { href: '/finanzas',              label: 'Finanzas',           icon: '◈', section: 'Operaciones' },
  { href: '/cotizaciones',          label: 'Cotizaciones',       icon: '◐', section: 'Operaciones' },
  { href: '/facturacion',           label: 'Facturación',        icon: '◻', section: 'Operaciones' },
  { href: '/proyectos',             label: 'Proyectos',          icon: '◧', section: 'Operaciones' },
  { href: '/clientes',              label: 'Clientes',           icon: '◍', section: 'Operaciones' },
  { href: '/rrhh',                  label: 'RRHH',               icon: '◉', section: 'Operaciones' },
  { href: '/catalogo-partidas',     label: 'Catálogo partidas',  icon: '📋', section: 'Admin' },
  { href: '/proveedores',           label: 'Proveedores',        icon: '◦', section: 'Admin' },
  { href: '/contratos',             label: 'Contratos',          icon: '◫', section: 'Admin' },
  { href: '/configuracion',         label: 'Configuración',      icon: '⚙', section: 'Admin' },
]

const sections = [...new Set(MENU.map(m => m.section))]

export default function Sidebar({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <aside style={{ width: 210, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0 }}>
      <div style={{ padding: '18px 16px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, background: 'var(--primary)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18 }}>⬡</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.3 }}>ObraManager</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>Casa del EIFS SpA</div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
        {sections.map(sec => (
          <div key={sec}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '12px 16px 4px' }}>{sec}</div>
            {MENU.filter(m => m.section === sec).map(m => {
              const active = pathname === m.href || (m.href !== '/dashboard' && pathname.startsWith(m.href))
              return (
                <Link key={m.href} href={m.href}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', fontSize: 13, fontWeight: active ? 700 : 400,
                    color: active ? 'var(--primary)' : 'var(--muted)',
                    background: active ? 'var(--primary-bg)' : 'transparent',
                    borderLeft: `3px solid ${active ? 'var(--primary)' : 'transparent'}`,
                    textDecoration: 'none', transition: 'all 0.12s' }}>
                  <span style={{ fontSize: 15 }}>{m.icon}</span>
                  {m.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        {userEmail && <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>}
        <button onClick={logout}
          style={{ width: '100%', padding: '7px 0', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, fontWeight: 600, color: 'var(--muted)', cursor: 'pointer' }}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
