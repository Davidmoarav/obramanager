-- ============================================================
-- SUB-PASO B: Clientes con RUT
-- Ejecutar en Supabase > SQL Editor > New query > Run
-- ============================================================

-- ─── TABLA CLIENTES ────────────────────────────────────────
create table clientes (
  id              uuid primary key default uuid_generate_v4(),
  razon_social    text not null,
  rut             text,
  giro            text,
  contacto        text,
  email           text,
  telefono        text,
  direccion       text,
  comuna          text,
  ciudad          text,
  notas           text,
  user_id         uuid references auth.users(id) on delete cascade,
  created_at      timestamptz default now()
);

-- ─── RLS ───────────────────────────────────────────────────
alter table clientes enable row level security;

create policy "clientes_own" on clientes
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Índice de búsqueda rápida por razón social y RUT ─────
create index idx_clientes_razon on clientes(user_id, razon_social);
create index idx_clientes_rut   on clientes(user_id, rut);

-- ─── ENLAZAR COTIZACIONES → CLIENTES ──────────────────────
-- Agregamos la columna cliente_id sin romper las cotizaciones existentes
alter table cotizaciones
  add column if not exists cliente_id uuid references clientes(id) on delete set null;

create index if not exists idx_cotizaciones_cliente on cotizaciones(cliente_id);
