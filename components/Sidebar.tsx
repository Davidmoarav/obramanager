'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import { createClient } from '@/lib/supabase'

const MENU = [
  { href: '/dashboard',         label: 'Dashboard',         icon: '⊞', section: 'Principal' },

  { href: '/cotizaciones',      label: 'Cotizaciones',      icon: '◐', section: 'Comercial' },
  { href: '/clientes',          label: 'Clientes',          icon: '◍', section: 'Comercial' },

  { href: '/proyectos',         label: 'Proyectos',         icon: '◧', section: 'Obra' },
  { href: '/catalogo-partidas', label: 'Catálogo partidas', icon: '📋', section: 'Obra' },
  { href: '/ordenes-compra',    label: 'Órdenes de compra', icon: '🛒', section: 'Obra' },
  { href: '/proveedores',       label: 'Proveedores',       icon: '◦', section: 'Obra' },

  { href: '/finanzas',          label: 'Finanzas',          icon: '◈', section: 'Finanzas' },
  { href: '/facturacion',       label: 'Facturación',       icon: '◻', section: 'Finanzas' },

  { href: '/rrhh',              label: 'RRHH',              icon: '◉', section: 'Personal' },
  { href: '/remuneraciones',    label: 'Remuneraciones',    icon: '💰', section: 'Personal' },

  { href: '/contratos',         label: 'Contratos',         icon: '◫', section: 'Admin' },
  { href: '/usuarios',          label: 'Usuarios y roles',  icon: '👥', section: 'Admin', modulo: 'usuarios' },
  { href: '/configuracion',     label: 'Configuración',     icon: '⚙', section: 'Admin' },
]

// Qué roles ven cada módulo restringido. Espejo de lib/roles.ts: el permiso REAL
// se aplica en el servidor; esto solo evita mostrar lo que no corresponde.
const ACCESO: Record<string, string[]> = {
  '/facturacion':    ['admin', 'contador'],
  '/finanzas':       ['admin', 'contador'],
  '/remuneraciones': ['admin', 'contador'],
  '/rrhh':           ['admin', 'contador'],
  '/usuarios':       ['admin'],
}

export default function Sidebar({ userEmail, open = false, onClose }: {
  userEmail?: string
  open?: boolean
  onClose?: () => void
}) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const [empresa, setEmpresa] = useState<string>('')

  // Rol del usuario: filtra qué módulos se muestran
  const { data: miRol } = useSWR<any>('/api/mi-rol', fetcher)
  const rol = miRol?.rol || 'admin'
  const menuVisible = MENU.filter(m => {
    const permitidos = ACCESO[m.href]
    return !permitidos || permitidos.includes(rol)
  })
  const sections = [...new Set(menuVisible.map(m => m.section))]

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
            {menuVisible.filter(m => m.section === sec).map(m => {
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
        {userEmail && <div className="text-[11px] text-muted mb-1 overflow-hidden text-ellipsis whitespace-nowrap">{userEmail}</div>}
        {miRol?.rol && (
          <div className="text-[10px] font-bold uppercase tracking-wide text-brand mb-2">
            {miRol.rol === 'admin' ? 'Administrador' : miRol.rol === 'contador' ? 'Contador' : 'Jefe de obra'}
          </div>
        )}
        <button onClick={logout}
          className="w-full py-2 bg-canvas border border-line rounded-lg text-xs font-semibold text-muted cursor-pointer hover:bg-line transition">
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}