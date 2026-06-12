'use client'
// app/auth/login/page.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre]     = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [msg, setMsg]           = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setMsg(''); setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      router.push('/dashboard')
      router.refresh()
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { nombre } }
      })
      if (error) { setError(error.message); setLoading(false); return }
      setMsg('Revisa tu correo para confirmar la cuenta, luego inicia sesión.')
      setMode('login')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 420, boxShadow: 'var(--shadow-lg)' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo.png" alt="Cubica Manager" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'contain', margin: '0 auto 12px', display: 'block' }} />
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.5 }}>Cubica Manager</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Sistema de gestión para contratistas</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 8, padding: 4, marginBottom: 24 }}>
          {(['login', 'register'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); setMsg('') }}
              style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: mode === m ? 'var(--surface)' : 'transparent',
                color: mode === m ? 'var(--primary)' : 'var(--muted)',
                boxShadow: mode === m ? 'var(--shadow)' : 'none' }}>
              {m === 'login' ? 'Iniciar sesión' : 'Registrarse'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Nombre completo</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Juan Pérez" required style={inputStyle} />
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Correo electrónico</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@empresa.cl" required style={inputStyle} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} style={inputStyle} />
          </div>

          {error && <div style={{ background: 'var(--red-bg)', color: 'var(--red)', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 14 }}>{error}</div>}
          {msg   && <div style={{ background: 'var(--green-bg)', color: 'var(--green)', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 14 }}>{msg}</div>}

          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '11px 0', background: loading ? 'var(--subtle)' : 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer' }}>
            {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 13, color: 'var(--text)', background: 'var(--bg)', outline: 'none' }
