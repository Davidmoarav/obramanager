'use client'
// components/DocumentosPanel.tsx
//
// Panel reutilizable para subir y ver documentos de un proyecto.
// Se embebe en la página de detalle de proyecto.
// Soporta: drag-and-drop, categorización, preview de imágenes, descarga directa.

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { Btn, FormInput, FormSelect, Modal, SectionTitle } from '@/components/ui'
import { CATEGORIAS_DOC, type Documento, type CategoriaDocumento } from '@/types/documento'

const MAX_SIZE = 20 * 1024 * 1024 // 20 MB

const fmtSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const fmtFecha = (iso?: string) => {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return iso }
}

const catMap = Object.fromEntries(CATEGORIAS_DOC.map(c => [c.value, c]))

// Iconos por tipo de archivo
const fileIcon = (tipo?: string) => {
  if (!tipo) return '📁'
  if (tipo.startsWith('image/')) return '🖼'
  if (tipo === 'application/pdf') return '📕'
  if (tipo.includes('dwg') || tipo.includes('autocad') || tipo.includes('acad')) return '📐'
  if (tipo.includes('spreadsheet') || tipo.includes('excel') || tipo.includes('xlsx')) return '📊'
  if (tipo.includes('word') || tipo.includes('docx')) return '📝'
  return '📁'
}

interface Props {
  proyectoId: string
  proyectoNombre?: string
}

export default function DocumentosPanel({ proyectoId, proyectoNombre }: Props) {
  const supabase = createClient()
  const fileRef  = useRef<HTMLInputElement>(null)

  const [docs, setDocs]           = useState<Documento[]>([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress]   = useState<string | null>(null)
  const [filtro, setFiltro]       = useState<string>('todos')
  const [dragging, setDragging]   = useState(false)

  // Form para categoría/descripción al subir
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploadForm, setUploadForm]  = useState<{ categoria: CategoriaDocumento; descripcion: string }>({ categoria: 'general', descripcion: '' })

  // ─── Cargar documentos ────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const res  = await fetch(`/api/documentos?proyecto_id=${proyectoId}`)
    const data = await res.json()
    setDocs(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [proyectoId])

  useEffect(() => { load() }, [load])

  // ─── Subir archivo ────────────────────────────────────────
  const handleFileSelect = (file: File) => {
    if (file.size > MAX_SIZE) {
      alert(`Archivo demasiado grande (${fmtSize(file.size)}). Máximo 20 MB.`)
      return
    }
    // Abrir mini-modal para categoría
    setPendingFile(file)
    setUploadForm({ categoria: guessCategoria(file), descripcion: '' })
  }

  const guessCategoria = (file: File): CategoriaDocumento => {
    const name = file.name.toLowerCase()
    const type = file.type
    if (name.endsWith('.dwg') || name.endsWith('.dxf')) return 'plano'
    if (type.startsWith('image/')) return 'foto'
    if (name.includes('contrato')) return 'contrato'
    if (name.includes('permiso') || name.includes('dom')) return 'permiso'
    if (name.includes('presupuesto') || name.includes('cotizacion')) return 'presupuesto'
    if (name.includes('eett') || name.includes('especificacion')) return 'especificacion'
    return 'general'
  }

  const doUpload = async () => {
    if (!pendingFile) return
    setUploading(true)
    setProgress('Subiendo archivo...')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploading(false); return }

    // Path: {user_id}/{proyecto_id}/{timestamp}_{filename}
    const ts   = Date.now()
    const safe = pendingFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${user.id}/${proyectoId}/${ts}_${safe}`

    const { error: upErr } = await supabase.storage
      .from('proyecto-docs')
      .upload(path, pendingFile, { cacheControl: '3600' })

    if (upErr) {
      alert('Error al subir: ' + upErr.message)
      setUploading(false)
      setProgress(null)
      return
    }

    setProgress('Registrando documento...')

    // Registrar en BD
    const res = await fetch('/api/documentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proyecto_id:  proyectoId,
        nombre:       pendingFile.name,
        descripcion:  uploadForm.descripcion || null,
        categoria:    uploadForm.categoria,
        archivo_path: path,
        archivo_tipo: pendingFile.type || 'application/octet-stream',
        archivo_size: pendingFile.size,
      }),
    })

    if (!res.ok) {
      const { error } = await res.json()
      alert('Error al registrar: ' + error)
      // Limpiar archivo huérfano
      await supabase.storage.from('proyecto-docs').remove([path])
    }

    setPendingFile(null)
    setUploading(false)
    setProgress(null)
    await load()
  }

  // ─── Descargar archivo ────────────────────────────────────
  const descargar = async (doc: Documento) => {
    const { data, error } = await supabase.storage
      .from('proyecto-docs')
      .createSignedUrl(doc.archivo_path, 60) // URL válida 60 segundos

    if (error || !data?.signedUrl) {
      alert('Error al generar enlace de descarga')
      return
    }

    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = doc.nombre
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // ─── Eliminar documento ───────────────────────────────────
  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar este documento permanentemente?')) return
    await fetch('/api/documentos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await load()
  }

  // ─── Drag & Drop handlers ────────────────────────────────
  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }

  // ─── Filtrado ─────────────────────────────────────────────
  const filtered = filtro === 'todos' ? docs : docs.filter(d => d.categoria === filtro)

  return (
    <div>
      {/* ─── ZONA DE SUBIDA ─── */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#1e6bb8' : '#d1d9e6'}`,
          background: dragging ? '#e8f1fb' : '#f8fafc',
          borderRadius: 10,
          padding: '24px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          marginBottom: 16,
          transition: 'all 0.15s',
        }}
      >
        <input ref={fileRef} type="file" style={{ display: 'none' }}
          accept=".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.zip,.rar"
          onChange={e => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); e.target.value = '' }}
        />
        <div style={{ fontSize: 28, marginBottom: 6 }}>📎</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2535' }}>
          {dragging ? 'Suelta el archivo aquí' : 'Arrastra un archivo o haz clic para subir'}
        </div>
        <div style={{ fontSize: 11, color: '#6b7a8d', marginTop: 4 }}>
          PDF, DWG, imágenes, Word, Excel, ZIP — Máximo 20 MB
        </div>
      </div>

      {/* ─── FILTRO POR CATEGORÍA ─── */}
      {docs.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          <button onClick={() => setFiltro('todos')}
            style={pillStyle(filtro === 'todos')}>
            Todos ({docs.length})
          </button>
          {CATEGORIAS_DOC.map(c => {
            const count = docs.filter(d => d.categoria === c.value).length
            if (count === 0) return null
            return (
              <button key={c.value} onClick={() => setFiltro(c.value)}
                style={pillStyle(filtro === c.value)}>
                {c.icon} {c.label} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* ─── LISTA DE DOCUMENTOS ─── */}
      {loading
        ? <p style={{ color: '#6b7a8d', textAlign: 'center', padding: 20 }}>Cargando documentos...</p>
        : filtered.length === 0
        ? <p style={{ color: '#6b7a8d', textAlign: 'center', padding: 20, fontSize: 13 }}>
            {docs.length === 0 ? 'Aún no hay documentos en este proyecto.' : 'Sin documentos en esta categoría.'}
          </p>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(doc => (
              <div key={doc.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: '#fff', border: '1px solid #e4e9f0', borderRadius: 8,
                padding: '10px 14px',
              }}>
                {/* Icono */}
                <div style={{ fontSize: 24, flexShrink: 0 }}>
                  {fileIcon(doc.archivo_tipo)}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2535', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.nombre}
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#6b7a8d', marginTop: 2 }}>
                    <span style={{
                      background: '#f0f4f8', padding: '1px 6px', borderRadius: 4, fontWeight: 600,
                    }}>
                      {catMap[doc.categoria]?.icon} {catMap[doc.categoria]?.label || doc.categoria}
                    </span>
                    <span>{fmtSize(doc.archivo_size)}</span>
                    <span>{fmtFecha(doc.created_at)}</span>
                  </div>
                  {doc.descripcion && (
                    <div style={{ fontSize: 11, color: '#6b7a8d', marginTop: 2 }}>{doc.descripcion}</div>
                  )}
                </div>

                {/* Acciones */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => descargar(doc)} title="Descargar"
                    style={actionBtnStyle('#1e6bb8', '#e8f1fb')}>
                    ↓
                  </button>
                  <button onClick={() => eliminar(doc.id)} title="Eliminar"
                    style={actionBtnStyle('#b0401a', '#fdecea')}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      {/* ─── MODAL DE UPLOAD (categoría + descripción) ─── */}
      {pendingFile && (
        <Modal title="Subir documento" onClose={() => { setPendingFile(null) }}>
          <div style={{ background: '#f0f4f8', borderRadius: 8, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>{fileIcon(pendingFile.type)}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2535' }}>{pendingFile.name}</div>
              <div style={{ fontSize: 11, color: '#6b7a8d' }}>{fmtSize(pendingFile.size)}</div>
            </div>
          </div>

          <FormSelect
            label="Categoría"
            value={uploadForm.categoria}
            onChange={v => setUploadForm(f => ({ ...f, categoria: v as CategoriaDocumento }))}
            options={CATEGORIAS_DOC.map(c => ({ value: c.value, label: `${c.icon} ${c.label}` }))}
          />

          <FormInput
            label="Descripción (opcional)"
            value={uploadForm.descripcion}
            onChange={v => setUploadForm(f => ({ ...f, descripcion: v }))}
            placeholder="Ej: Planta primer piso - Rev. 3"
          />

          {progress && (
            <div style={{ fontSize: 12, color: '#1e6bb8', marginTop: 8 }}>{progress}</div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            <Btn onClick={() => setPendingFile(null)} disabled={uploading}>Cancelar</Btn>
            <Btn variant="primary" onClick={doUpload} disabled={uploading}>
              {uploading ? 'Subiendo...' : 'Subir documento'}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}

const pillStyle = (active: boolean): React.CSSProperties => ({
  padding: '4px 12px', borderRadius: 16, border: '1px solid',
  fontSize: 11, fontWeight: 600, cursor: 'pointer',
  borderColor: active ? '#1e6bb8' : '#d1d9e6',
  background:  active ? '#1e6bb8' : '#fff',
  color:       active ? '#fff'    : '#6b7a8d',
})

const actionBtnStyle = (color: string, bg: string): React.CSSProperties => ({
  width: 28, height: 28, borderRadius: 6, border: 'none',
  background: bg, color: color, fontSize: 14, fontWeight: 700,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
})
