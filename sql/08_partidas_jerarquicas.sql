-- ============================================================
-- FIX: Partidas jerárquicas (padre → sub-partidas)
-- Ejecutar en Supabase > SQL Editor > New query > Run
-- ============================================================

-- Agregar parent_id para jerarquía
-- parent_id = null → partida padre (aparece en cotización)
-- parent_id = uuid → sub-partida (aparece en control de obra)
alter table partidas_proyecto
  add column if not exists parent_id uuid references partidas_proyecto(id) on delete cascade;

create index if not exists idx_pp_parent on partidas_proyecto(parent_id);
