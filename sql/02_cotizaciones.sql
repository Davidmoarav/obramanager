-- ============================================================
-- PASO 1: Cotizaciones con partidas
-- Ejecutar en Supabase > SQL Editor > New query > Run
-- ============================================================

-- ─── COTIZACIONES (encabezado) ────────────────────────────
create table cotizaciones (
  id              uuid primary key default uuid_generate_v4(),
  numero          text,
  cliente         text not null,
  proyecto_nombre text,
  descripcion     text,
  fecha           date default current_date,
  validez_dias    integer default 30,
  estado          text default 'borrador' check (estado in ('borrador','enviada','aprobada','rechazada','convertida')),
  notas           text,
  user_id         uuid references auth.users(id) on delete cascade,
  created_at      timestamptz default now()
);

-- ─── PARTIDAS DE COTIZACIÓN (detalle) ─────────────────────
create table partidas_cotizacion (
  id              uuid primary key default uuid_generate_v4(),
  cotizacion_id   uuid references cotizaciones(id) on delete cascade,
  orden           integer default 0,
  descripcion     text not null,
  unidad          text default 'un',   -- m2, m3, ml, kg, un, gl, hh
  cantidad        numeric(12,2) default 0,
  precio_unitario bigint default 0,
  created_at      timestamptz default now()
);

-- ─── RLS ───────────────────────────────────────────────────
alter table cotizaciones        enable row level security;
alter table partidas_cotizacion enable row level security;

create policy "cotizaciones_own" on cotizaciones
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Las partidas heredan acceso: si puedes ver la cotización padre, puedes ver sus partidas
create policy "partidas_own" on partidas_cotizacion
  for all using (
    exists (
      select 1 from cotizaciones c
      where c.id = partidas_cotizacion.cotizacion_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from cotizaciones c
      where c.id = partidas_cotizacion.cotizacion_id
        and c.user_id = auth.uid()
    )
  );

-- ─── Índice para acelerar consultas ────────────────────────
create index idx_partidas_cotizacion on partidas_cotizacion(cotizacion_id, orden);
