// app/api/importar-sii/route.ts
// Importación masiva del Registro de Compras y Ventas (RCV) del SII.
// Recibe filas ya parseadas desde el cliente y las inserta como facturas.
import { createServerSupabase } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { filas, tipo } = await req.json()  // tipo: 'compra' | 'venta'
  if (!Array.isArray(filas) || filas.length === 0) {
    return NextResponse.json({ error: 'No hay filas para importar' }, { status: 400 })
  }

  // Evitar duplicados: traer folios ya existentes de este tipo
  const { data: existentes } = await supabase
    .from('facturas')
    .select('numero, periodo')
    .eq('user_id', user.id)
    .eq('tipo', tipo)

  const yaExiste = new Set((existentes ?? []).map((f: any) => `${f.numero}__${f.periodo}`))

  const filasInsertar = filas
    .filter((f: any) => !yaExiste.has(`${f.numero}__${f.periodo}`))
    .map((f: any) => ({
      numero:    f.numero || null,
      cliente:   f.contraparte || 'Sin nombre',
      tipo,
      doc_tipo:  f.doc_tipo || 'factura',
      factura_ref: f.factura_ref || null,   // folio de la factura que referencia la nota
      neto:      Number(f.neto) || 0,
      iva:       Number(f.iva) || 0,
      monto:     Number(f.total) || 0,
      emision:   f.emision || null,
      periodo:   f.periodo || null,
      estado:    tipo === 'compra' ? 'pagada' : 'pendiente',
      user_id:   user.id,
    }))

  if (filasInsertar.length === 0) {
    return NextResponse.json({ ok: true, insertadas: 0, duplicadas: filas.length, mensaje: 'Todas las facturas ya estaban registradas' })
  }

  // Insertar en lotes de 100
  let insertadas = 0
  for (let i = 0; i < filasInsertar.length; i += 100) {
    const lote = filasInsertar.slice(i, i + 100)
    const { error } = await supabase.from('facturas').insert(lote)
    if (error) return NextResponse.json({ error: error.message, insertadas }, { status: 500 })
    insertadas += lote.length
  }

  return NextResponse.json({
    ok: true,
    insertadas,
    duplicadas: filas.length - filasInsertar.length,
  })
}