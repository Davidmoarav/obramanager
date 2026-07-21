-- ============================================================
-- PASO 28: Partidas jerárquicas con grupos y desglose de costo
-- Ejecutar en Supabase > SQL Editor > New query > Run
-- ------------------------------------------------------------
-- Agrega el soporte para el árbol de partidas usado por la
-- importación de programas (beneficiarios) y por el panel de
-- control de obra:
--
--   nivel               → profundidad del nodo (1 = subproyecto/persona,
--                          2 = partida). Solo informativo; el árbol real
--                          se arma con parent_id.
--   es_grupo            → true = agrupador (persona/subproyecto/etapa),
--                          no lleva costo; false = partida real (hoja).
--   costo_material_unit → costo de material por unidad.
--   costo_mo_unit       → costo de mano de obra por unidad.
--
-- costo_unitario y markup_pct ya se agregaron en 13_presupuesto_margen.sql
-- (costo_unitario = costo_material_unit + costo_mo_unit).
--
-- Idempotente: se puede ejecutar varias veces sin error.
-- ============================================================

alter table partidas_proyecto
  add column if not exists nivel               integer default 1,
  add column if not exists es_grupo            boolean default false,
  add column if not exists costo_material_unit bigint  default 0,
  add column if not exists costo_mo_unit       bigint  default 0;

-- Asegura que costo_unitario exista aunque no se haya corrido el 13
alter table partidas_proyecto
  add column if not exists costo_unitario      bigint  default 0;

-- Índice para recorrer el árbol por proyecto y orden rápido
create index if not exists idx_pp_proy_parent_orden
  on partidas_proyecto(proyecto_id, parent_id, orden);
