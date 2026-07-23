// app/api/partida-materiales/aplicar-a-todos/route.ts
// Copia los materiales de UNA partida a la MISMA partida (misma descripción y
// categoría) de todos los demás beneficiarios/subproyectos del proyecto.
// Así se define el consumo de materiales una sola vez y aplica a todos, sin
// cargarlo uno por uno. No duplica: si un beneficiario ya tiene ese material,
// se omite. El "a comprar" se recalcula solo, porque el rendimiento es por unidad.
import { createServerSupabase } from '@/lib/supabase-server'
import { guardEscritura, getOwnerId } from '@/lib/roles'
import { NextResponse } from 'next/server'

const norm = (s: any) => String(s ?? '')
  .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ').trim()

export async function POST(req: Request) {
  const supabase = await createServerSupabase()
  const ro = await guardEscritura(supabase, 'obra')
  if (ro) return ro
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const ownerId = await getOwnerId(supabase) || user.id

  const { partida_id } = await req.json()
  if (!partida_id) return NextResponse.json({ error: 'Falta partida_id' }, { status: 400 })

  // 1) Partida origen
  const { data: origen, error: eO } = await supabase
    .from('partidas_proyecto').select('*')
    .eq('id', partida_id).eq('user_id', ownerId).single()
  if (eO || !origen) return NextResponse.json({ error: 'No se encontró la partida' }, { status: 404 })

  // 2) Materiales de la partida origen
  const { data: origenMats } = await supabase
    .from('partida_materiales').select('*')
    .eq('partida_id', partida_id).eq('user_id', ownerId)
  if (!origenMats || origenMats.length === 0) {
    return NextResponse.json({ error: 'Esta partida no tiene materiales que copiar.' }, { status: 400 })
  }

  // 3) Partidas destino: misma descripción y categoría (notas), otros nodos hoja
  const { data: hojas } = await supabase
    .from('partidas_proyecto')
    .select('id, descripcion, notas, es_grupo')
    .eq('proyecto_id', origen.proyecto_id).eq('user_id', ownerId)
  const dO = norm(origen.descripcion), nO = norm(origen.notas)
  const destinos = (hojas ?? []).filter((h: any) =>
    h.id !== origen.id && !h.es_grupo && norm(h.descripcion) === dO && norm(h.notas) === nO)

  if (destinos.length === 0) {
    return NextResponse.json({ ok: true, destinos: 0, insertados: 0 })
  }

  // 4) Materiales ya existentes en los destinos (por lotes) para no duplicar
  const destIds = destinos.map((d: any) => d.id)
  const yaTiene = new Set<string>()
  for (let i = 0; i < destIds.length; i += 100) {
    const lote = destIds.slice(i, i + 100)
    const { data } = await supabase.from('partida_materiales')
      .select('partida_id, material').in('partida_id', lote).eq('user_id', ownerId)
    for (const m of data ?? []) yaTiene.add(m.partida_id + '¦' + norm(m.material))
  }

  // 5) Construir inserciones (omitiendo los que ya existen)
  const filas: any[] = []
  for (const d of destinos) {
    for (const om of origenMats) {
      if (yaTiene.has(d.id + '¦' + norm(om.material))) continue
      filas.push({
        partida_id: d.id,
        material: om.material,
        unidad: om.unidad || 'un',
        rendimiento: Number(om.rendimiento) || 0,
        precio_unitario: Number(om.precio_unitario) || 0,
        notas: om.notas ?? null,
        user_id: ownerId,
      })
    }
  }

  let insertados = 0
  for (let i = 0; i < filas.length; i += 100) {
    const lote = filas.slice(i, i + 100)
    const { error } = await supabase.from('partida_materiales').insert(lote)
    if (error) return NextResponse.json({ error: error.message, insertados }, { status: 500 })
    insertados += lote.length
  }

  return NextResponse.json({ ok: true, destinos: destinos.length, insertados })
}