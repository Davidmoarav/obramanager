-- ============================================================
-- CATÁLOGO DE PARTIDAS REUTILIZABLE
-- Ejecutar en Supabase > SQL Editor > New query > Run
-- ============================================================

create table catalogo_partidas (
  id                  uuid primary key default uuid_generate_v4(),
  parent_id           uuid references catalogo_partidas(id) on delete cascade,
  descripcion         text not null,
  unidad              text default 'gl',
  precio_unitario_ref bigint default 0,
  orden               integer default 0,
  user_id             uuid references auth.users(id) on delete cascade,
  created_at          timestamptz default now()
);

alter table catalogo_partidas enable row level security;

create policy "catalogo_own" on catalogo_partidas
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_catalogo_parent on catalogo_partidas(parent_id);
create index idx_catalogo_user   on catalogo_partidas(user_id, orden);
