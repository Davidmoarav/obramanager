-- ============================================================
-- FACTURAS → PROYECTO POR ID (no por nombre)
-- Hasta ahora la factura guardaba el proyecto como TEXTO, y el presupuesto
-- las sumaba haciendo match exacto del nombre. Si se renombraba un proyecto,
-- sus facturas dejaban de contar como gasto (en silencio).
--
-- Esta migración agrega proyecto_id y MIGRA las facturas existentes,
-- enlazándolas por el nombre actual. La columna de texto se conserva.
-- Ejecutar en Supabase > SQL Editor > Run
-- ============================================================

alter table facturas
  add column if not exists proyecto_id uuid references proyectos(id) on delete set null;

create index if not exists idx_facturas_proyecto_id on facturas(proyecto_id);

-- ─── Migrar los enlaces existentes (match por nombre, del mismo dueño) ───
update facturas f
   set proyecto_id = p.id
  from proyectos p
 where f.proyecto_id is null
   and f.proyecto is not null
   and f.proyecto <> ''
   and p.user_id = f.user_id
   and lower(trim(p.nombre)) = lower(trim(f.proyecto));

-- ─── Verificación: facturas con proyecto en texto que NO se pudieron enlazar ───
-- (revisa el resultado: si aparecen filas, esos nombres ya no coinciden con
--  ningún proyecto y hay que enlazarlos a mano desde la app)
select
  f.numero,
  f.proyecto            as nombre_en_la_factura,
  f.tipo,
  f.monto
from facturas f
where f.proyecto_id is null
  and f.proyecto is not null
  and f.proyecto <> ''
order by f.numero;
