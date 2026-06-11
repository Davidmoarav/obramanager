// app/api/presupuesto/route.ts
// Avance presupuestario por proyecto: ejecutado = suma(avance% x valor) de partidas
import { createServerSupabase } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: proyectos } = await supabase
    .from('proyectos')
    .select('*')
    .eq('user_id', user.id)

  const { data: partidas } = await supabase
    .from('partidas_proyecto')
    .select('*')
    .eq('user_id', user.id)

  const arrProy = proyectos ?? []
  const arrPart = partidas ?? []

  const resumen = arrProy.map(proy => {
    // Solo partidas PADRE para no duplicar (los padres tienen el valor)
    const padres = arrPart.filter(p => p.proyecto_id === proy.id && !p.parent_id)
    const hijos  = arrPart.filter(p => p.proyecto_id === proy.id && p.parent_id)

    // Presupuesto total = suma valor de padres
    const presupuesto = padres.reduce((s, p) =>
      s + (Number(p.cantidad) || 0) * (Number(p.precio_unitario) || 0), 0)

    // Ejecutado: avance de cada padre x su valor
    let ejecutado = 0
    for (const padre of padres) {
      const valor = (Number(padre.cantidad) || 0) * (Number(padre.precio_unitario) || 0)
      const hijosPadre = hijos.filter(h => h.parent_id === padre.id)
      const avancePadre = hijosPadre.length > 0
        ? hijosPadre.reduce((s, h) => s + (Number(h.avance) || 0), 0) / hijosPadre.length
        : (Number(padre.avance) || 0)
      ejecutado += valor * avancePadre / 100
    }

    const pctPresupuesto = presupuesto > 0 ? Math.round(ejecutado / presupuesto * 100) : 0

    return {
      proyecto_id: proy.id,
      nombre: proy.nombre,
      cliente: proy.cliente,
      estado: proy.estado,
      valor_contrato: Number(proy.valor) || 0,
      avance_fisico: Number(proy.avance) || 0,
      presupuesto_partidas: Math.round(presupuesto),
      ejecutado: Math.round(ejecutado),
      pct_presupuesto: pctPresupuesto,
      n_partidas: padres.length,
    }
  })

  return NextResponse.json(resumen)
}
