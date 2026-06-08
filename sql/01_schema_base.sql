-- ============================================================
-- ObraManager - Schema Supabase
-- Ejecutar en: Supabase > SQL Editor > New query > Run
-- ============================================================

-- Habilitar UUID
create extension if not exists "uuid-ossp";

-- ─── PROYECTOS ────────────────────────────────────────────
create table proyectos (
  id          uuid primary key default uuid_generate_v4(),
  nombre      text not null,
  cliente     text not null,
  descripcion text,
  valor       bigint default 0,
  avance      integer default 0 check (avance >= 0 and avance <= 100),
  estado      text default 'cotizacion' check (estado in ('cotizacion','activo','terminado')),
  inicio      date,
  fin         date,
  user_id     uuid references auth.users(id) on delete cascade,
  created_at  timestamptz default now()
);

-- ─── EMPLEADOS ────────────────────────────────────────────
create table empleados (
  id          uuid primary key default uuid_generate_v4(),
  nombre      text not null,
  rut         text,
  cargo       text,
  sueldo      bigint default 0,
  horas_extra integer default 0,
  estado      text default 'activo' check (estado in ('activo','vacaciones','inactivo')),
  tipo        text default 'planta' check (tipo in ('planta','subcontrato')),
  inicio      date,
  user_id     uuid references auth.users(id) on delete cascade,
  created_at  timestamptz default now()
);

-- ─── PROVEEDORES ──────────────────────────────────────────
create table proveedores (
  id          uuid primary key default uuid_generate_v4(),
  nombre      text not null,
  rut         text,
  rubro       text,
  contacto    text,
  telefono    text,
  monto3m     bigint default 0,
  estado      text default 'activo' check (estado in ('activo','cotizacion')),
  user_id     uuid references auth.users(id) on delete cascade,
  created_at  timestamptz default now()
);

-- ─── CONTRATOS ────────────────────────────────────────────
create table contratos (
  id          uuid primary key default uuid_generate_v4(),
  numero      text,
  contraparte text not null,
  tipo        text default 'Suma alzada',
  valor       bigint default 0,
  inicio      date,
  fin         date,
  estado      text default 'ejecucion' check (estado in ('ejecucion','liquidado','pendiente')),
  user_id     uuid references auth.users(id) on delete cascade,
  created_at  timestamptz default now()
);

-- ─── FACTURAS ─────────────────────────────────────────────
create table facturas (
  id          uuid primary key default uuid_generate_v4(),
  numero      text,
  cliente     text not null,
  proyecto    text,
  monto       bigint default 0,
  emision     date,
  vencimiento date,
  estado      text default 'pendiente' check (estado in ('pagada','pendiente','vencida')),
  user_id     uuid references auth.users(id) on delete cascade,
  created_at  timestamptz default now()
);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────
alter table proyectos  enable row level security;
alter table empleados  enable row level security;
alter table proveedores enable row level security;
alter table contratos  enable row level security;
alter table facturas   enable row level security;

-- Políticas: cada usuario solo ve sus propios datos
create policy "proyectos_own"   on proyectos   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "empleados_own"   on empleados   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "proveedores_own" on proveedores for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "contratos_own"   on contratos   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "facturas_own"    on facturas    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── DATOS DE EJEMPLO (opcional, ejecutar después del login) ──
-- Reemplaza 'TU-USER-ID' con el UUID de tu usuario en auth.users
/*
insert into proyectos (nombre, cliente, descripcion, valor, avance, estado, inicio, fin, user_id)
values
  ('Edificio Comercial Talca',  'Inversiones Maule',       'Construcción 4 pisos, 2400 m²',       48000000, 72,  'activo',     '2026-01-15', '2026-07-31', 'TU-USER-ID'),
  ('Remodelación Oficinas UCM', 'U. Católica del Maule',   'Remodelación 800 m², tabiques y cielo',12000000, 90,  'activo',     '2026-02-01', '2026-06-15', 'TU-USER-ID'),
  ('Casa El Piduco',            'Familia González',        'Vivienda 160 m², fachada EIFS',        22000000, 100, 'terminado',  '2025-11-01', '2026-04-30', 'TU-USER-ID'),
  ('Bodega Industrial Ruta 5',  'Comercial Sur Ltda.',     'Nave industrial 2000 m²',              65000000, 30,  'activo',     '2026-03-01', '2026-11-30', 'TU-USER-ID'),
  ('Centro Médico Centro',      'Clínica Maule S.A.',      'Centro médico 3 pisos, 1800 m²',      110000000, 0,  'cotizacion', null,         null,         'TU-USER-ID');
*/
