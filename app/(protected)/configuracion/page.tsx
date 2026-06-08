'use client'
// app/(protected)/configuracion/page.tsx

import { useState, useEffect, useCallback, useRef } from 'react'
import { Btn, FormInput, Modal, SectionTitle } from '@/components/ui'
import { createClient } from '@/lib/supabase'
import type { EmpresaConfig } from '@/types/empresa'

export default function ConfiguracionPage() {
  const supabase = createClient()
  const fileRef  = useRef<HTMLInputElement>(null)

  const [form, setForm]         = useState<EmpresaConfig>({})
  const [logoUrl, setLogoUrl]   = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg]           = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  // ─── Cargar config + URL pública del logo ────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/empresa')
    const data = await res.json()
    if (data && !data.error) {
      setForm(data)
      if (data.logo_path) {
        const { data: { publicUrl } } = supabase.storage.from('empresa-logos').getPublicUrl(data.logo_path)
        setLogoUrl(publicUrl)
      }
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const upd = (k: keyof EmpresaConfig, v: any) => setForm(f => ({ ...f, [k]: v }))

  // ─── Subir logo a Storage ────────────────────────────────
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validación
    if (file.size > 2 * 1024 * 1024) {
      setMsg({ kind: 'error', text: 'El logo no puede pesar más de 2 MB' })
      return
    }
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      setMsg({ kind: 'error', text: 'Solo se aceptan PNG, JPG, WEBP o SVG' })
      return
    }

    setUploading(true)
    setMsg(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploading(false); return }

    // Ruta: {user_id}/logo.{ext}  — sobrescribe el anterior
    const ext  = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `${user.id}/logo.${ext}`

    const { error: upErr } = await supabase.storage
      .from('empresa-logos')
      .upload(path, file, { upsert: true, cacheControl: '3600' })

    if (upErr) {
      setMsg({ kind: 'error', text: 'Error al subir logo: ' + upErr.message })
      setUploading(false)
      return
    }

    // Actualizar logo_path en la BD
    const newForm = { ...form, logo_path: path }
    setForm(newForm)

    await fetch('/api/empresa', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newForm),
    })

    // Refrescar URL pública (con cache-buster)
    const { data: { publicUrl } } = supabase.storage.from('empresa-logos').getPublicUrl(path)
    setLogoUrl(publicUrl + '?t=' + Date.now())
    setUploading(false)
    setMsg({ kind: 'ok', text: 'Logo actualizado correctamente' })
  }

  const removeLogo = async () => {
    if (!form.logo_path) return
    if (!confirm('¿Eliminar el logo actual?')) return

    await supabase.storage.from('empresa-logos').remove([form.logo_path])
    const newForm = { ...form, logo_path: '' }
    setForm(newForm)
    setLogoUrl(null)
    await fetch('/api/empresa', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newForm),
    })
  }

  // ─── Guardar datos ───────────────────────────────────────
  const save = async () => {
    setSaving(true)
    setMsg(null)

    const res = await fetch('/api/empresa', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (!res.ok) {
      const { error } = await res.json()
      setMsg({ kind: 'error', text: 'Error al guardar: ' + error })
    } else {
      setMsg({ kind: 'ok', text: 'Configuración guardada correctamente' })
    }
    setSaving(false)
  }

  if (loading) return <p style={{ color: '#6b7a8d', padding: 20 }}>Cargando...</p>

  return (
    <div style={{ maxWidth: 860 }}>
      <SectionTitle>Configuración de empresa</SectionTitle>
      <p style={{ fontSize: 13, color: '#6b7a8d', marginBottom: 24 }}>
        Estos datos aparecerán en tus cotizaciones, facturas y reportes PDF.
      </p>

      {/* ── BANNER MSG ── */}
      {msg && (
        <div style={{
          background: msg.kind === 'ok' ? '#e6f4ed' : '#fdecea',
          color:      msg.kind === 'ok' ? '#1a7a4a' : '#b0401a',
          border: '1px solid ' + (msg.kind === 'ok' ? '#b9e0c9' : '#f5c6c2'),
          padding: '12px 16px', borderRadius: 8, marginBottom: 18, fontSize: 13,
        }}>
          {msg.text}
        </div>
      )}

      {/* ─── LOGO ─── */}
      <div style={{ background: '#fff', border: '1px solid #e4e9f0', borderRadius: 12, padding: 20, marginBottom: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2535', marginBottom: 14 }}>Logo de la empresa</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {/* Preview */}
          <div style={{
            width: 160, height: 160, border: '1px dashed #d1d9e6', borderRadius: 10,
            background: '#fafbfc', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, overflow: 'hidden',
          }}>
            {logoUrl
              ? <img src={logoUrl} alt="Logo" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
              : <div style={{ fontSize: 12, color: '#a0aab8', textAlign: 'center', padding: 12 }}>Sin logo<br/>Sube uno aquí</div>}
          </div>

          {/* Controles */}
          <div style={{ flex: 1 }}>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleLogoUpload} style={{ display: 'none' }} />

            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <Btn variant="primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? 'Subiendo...' : (logoUrl ? 'Cambiar logo' : 'Subir logo')}
              </Btn>
              {logoUrl && <Btn variant="danger" onClick={removeLogo}>Quitar logo</Btn>}
            </div>

            <ul style={{ fontSize: 12, color: '#6b7a8d', paddingLeft: 18, lineHeight: 1.7 }}>
              <li>Formatos: PNG, JPG, WEBP, SVG</li>
              <li>Tamaño máximo: 2 MB</li>
              <li>Recomendado: 400×400 px o fondo transparente (PNG)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ─── DATOS DE LA EMPRESA ─── */}
      <div style={{ background: '#fff', border: '1px solid #e4e9f0', borderRadius: 12, padding: 20, marginBottom: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2535', marginBottom: 14 }}>Datos legales y comerciales</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FormInput label="Razón social"        value={form.razon_social || ''} onChange={v => upd('razon_social', v)} placeholder="Casa del EIFS SpA" />
          <FormInput label="RUT"                 value={form.rut || ''}          onChange={v => upd('rut', v)}          placeholder="76.123.456-7" />
          <div style={{ gridColumn: '1/-1' }}>
            <FormInput label="Giro"              value={form.giro || ''}         onChange={v => upd('giro', v)}         placeholder="Comercialización de materiales de construcción y servicios" />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <FormInput label="Dirección"         value={form.direccion || ''}    onChange={v => upd('direccion', v)}    placeholder="Av. 1 Sur 1234" />
          </div>
          <FormInput label="Comuna"              value={form.comuna || ''}       onChange={v => upd('comuna', v)}       placeholder="Talca" />
          <FormInput label="Ciudad"              value={form.ciudad || ''}       onChange={v => upd('ciudad', v)}       placeholder="Talca" />
          <FormInput label="Teléfono"            value={form.telefono || ''}     onChange={v => upd('telefono', v)}     placeholder="+56 71 222 3333" />
          <FormInput label="Email"               value={form.email || ''}        onChange={v => upd('email', v)}        placeholder="contacto@empresa.cl" type="email" />
          <div style={{ gridColumn: '1/-1' }}>
            <FormInput label="Sitio web"         value={form.sitio_web || ''}    onChange={v => upd('sitio_web', v)}    placeholder="https://www.casadeleifs.cl" />
          </div>
        </div>
      </div>

      {/* ─── PERSONALIZACIÓN PDF ─── */}
      <div style={{ background: '#fff', border: '1px solid #e4e9f0', borderRadius: 12, padding: 20, marginBottom: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2535', marginBottom: 14 }}>Personalización de documentos PDF</div>

        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 14, alignItems: 'center' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7a8d' }}>Color principal</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="color" value={form.color_primario || '#1e6bb8'}
              onChange={e => upd('color_primario', e.target.value)}
              style={{ width: 50, height: 36, border: '1px solid #d1d9e6', borderRadius: 6, cursor: 'pointer' }} />
            <input value={form.color_primario || '#1e6bb8'}
              onChange={e => upd('color_primario', e.target.value)}
              style={{ width: 120, padding: '8px 11px', border: '1px solid #d1d9e6', borderRadius: 7, fontSize: 13, fontFamily: 'monospace' }} />
            <span style={{ fontSize: 12, color: '#6b7a8d' }}>Se usa en títulos y bordes del PDF</span>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <FormInput label="Notas / términos al pie del PDF (opcional)"
            value={form.notas_pdf || ''}
            onChange={v => upd('notas_pdf', v)}
            placeholder="Ej: Cotización válida por 30 días. No incluye instalación salvo indicación expresa." />
        </div>
      </div>

      {/* ─── ACCIONES ─── */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
        <Btn variant="primary" onClick={save} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </Btn>
      </div>
    </div>
  )
}
