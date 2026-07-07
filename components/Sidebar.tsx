'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

const MENU = [
  { href: '/dashboard',         label: 'Dashboard',         icon: '⊞', section: 'Principal' },
  { href: '/finanzas',          label: 'Finanzas',          icon: '◈', section: 'Operaciones' },
  { href: '/cotizaciones',      label: 'Cotizaciones',      icon: '◐', section: 'Operaciones' },
  { href: '/facturacion',       label: 'Facturación',       icon: '◻', section: 'Operaciones' },
  { href: '/proyectos',         label: 'Proyectos',         icon: '◧', section: 'Operaciones' },
  { href: '/clientes',          label: 'Clientes',          icon: '◍', section: 'Operaciones' },
  { href: '/rrhh',              label: 'RRHH',              icon: '◉', section: 'Operaciones' },
  { href: '/remuneraciones',    label: 'Remuneraciones',    icon: '💰', section: 'Contabilidad' },
  { href: '/catalogo-partidas', label: 'Catálogo partidas', icon: '📋', section: 'Admin' },
  { href: '/proveedores',       label: 'Proveedores',       icon: '◦', section: 'Admin' },
  { href: '/ordenes-compra',    label: 'Órdenes de compra', icon: '🛒', section: 'Admin' },
  { href: '/contratos',         label: 'Contratos',         icon: '◫', section: 'Admin' },
  { href: '/configuracion',     label: 'Configuración',     icon: '⚙', section: 'Admin' },
]

const sections = [...new Set(MENU.map(m => m.section))]

export default function Sidebar({ userEmail, open = false, onClose }: {
  userEmail?: string
  open?: boolean
  onClose?: () => void
}) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const [empresa, setEmpresa] = useState<string>('')

  useEffect(() => {
    fetch('/api/empresa')
      .then(r => r.json())
      .then(d => { if (d?.razon_social) setEmpresa(d.razon_social) })
      .catch(() => {})
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <aside className={[
      'w-[210px] shrink-0 bg-white border-r border-line flex flex-col',
      // Móvil: overlay deslizable
      'fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out',
      open ? 'translate-x-0' : '-translate-x-full',
      // Desktop: flujo normal, siempre visible
      'lg:relative lg:inset-auto lg:z-auto lg:translate-x-0 lg:h-screen lg:sticky lg:top-0',
    ].join(' ')}>

      {/* Logo */}
      <div className="px-4 pt-[18px] pb-4 border-b border-line">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Cubica Manager" className="w-[34px] h-[34px] rounded-lg object-contain" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-extrabold text-ink tracking-tight">Cubica Manager</div>
            <div className="text-[10px] text-muted mt-px truncate">{empresa || 'Sistema de gestión'}</div>
          </div>
          <button onClick={onClose} aria-label="Cerrar menú"
            className="lg:hidden text-muted hover:text-ink transition text-xl leading-none p-1 -mr-1">
            ✕
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2.5 overflow-y-auto">
        {sections.map(sec => (
          <div key={sec}>
            <div className="text-[10px] font-bold text-subtle uppercase tracking-wider px-4 pt-3 pb-1">{sec}</div>
            {MENU.filter(m => m.section === sec).map(m => {
              const active = pathname === m.href || (m.href !== '/dashboard' && pathname.startsWith(m.href))
              return (
                <Link key={m.href} href={m.href}
                  className={`flex items-center gap-2.5 px-4 py-2 text-[13px] no-underline transition
                    ${active
                      ? 'font-bold text-brand bg-brand-bg border-l-[3px] border-brand'
                      : 'font-normal text-muted border-l-[3px] border-transparent hover:bg-canvas'}`}>
                  <span className="text-[15px]">{m.icon}</span>
                  {m.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-line">
        {userEmail && <div className="text-[11px] text-muted mb-2 overflow-hidden text-ellipsis whitespace-nowrap">{userEmail}</div>}
        <button onClick={logout}
          className="w-full py-2 bg-canvas border border-line rounded-lg text-xs font-semibold text-muted cursor-pointer hover:bg-line transition">
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}