-- ============================================================
-- PASO 1: Conversión Cotización → Proyecto
-- Ejecutar en Supabase > SQL Editor > New query > Run
-- ============================================================

-- Vincular cotización con el proyecto creado
alter table cotizaciones
  add column if not exists proyecto_id uuid references proyectos(id) on delete set null;

-- También: vincular proyecto con su cotización origen (trazabilidad inversa)
alter table proyectos
  add column if not exists cotizacion_id uuid references cotizaciones(id) on delete set null,
  add column if not exists cliente_id    uuid references clientes(id)     on delete set null;

create index if not exists idx_cot_proyecto on cotizaciones(proyecto_id);
create index if not exists idx_proy_cot     on proyectos(cotizacion_id);
create index if not exists idx_proy_cliente on proyectos(cliente_id);
