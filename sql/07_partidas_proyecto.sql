-- ============================================================
-- PASO 3: Control de obra por partidas
-- Ejecutar en Supabase > SQL Editor > New query > Run
-- ============================================================

-- ─── Partidas de proyecto (ítems de obra) ──────────────────
create table partidas_proyecto (
  id              uuid primary key default uuid_generate_v4(),
  proyecto_id     uuid references proyectos(id) on delete cascade,
  orden           integer default 0,
  descripcion     text not null,
  unidad          text default 'gl',
  cantidad        numeric(12,2) default 1,
  precio_unitario bigint default 0,
  avance          integer default 0 check (avance >= 0 and avance <= 100),
  notas           text,
  user_id         uuid references auth.users(id) on delete cascade,
  created_at      timestamptz default now()
);

alter table partidas_proyecto enable row level security;

create policy "partidas_proy_own" on partidas_proyecto
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_pp_proyecto on partidas_proyecto(proyecto_id, orden);
