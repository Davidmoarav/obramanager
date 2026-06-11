-- ============================================================
-- ESTADOS DE PAGO + PARTIDAS JERÁRQUICAS EN COTIZACIÓN
-- Ejecutar en Supabase > SQL Editor > New query > Run
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. Jerarquía en partidas de cotización (igual que proyecto)
--    parent_id = null → partida padre (título, aparece en PDF)
--    parent_id = uuid → sub-partida (detalle interno)
-- ════════════════════════════════════════════════════════════
alter table partidas_cotizacion
  add column if not exists parent_id uuid references partidas_cotizacion(id) on delete cascade;

create index if not exists idx_pc_parent on partidas_cotizacion(parent_id);

-- ════════════════════════════════════════════════════════════
-- 2. ESTADOS DE PAGO
--    Cada EP es un "corte" mensual de avance de obra que se cobra.
--    monto = suma( (avance_nuevo - avance_anterior) x valor_partida )
-- ════════════════════════════════════════════════════════════
create table estados_pago (
  id              uuid primary key default uuid_generate_v4(),
  proyecto_id     uuid references proyectos(id) on delete cascade,
  numero          integer default 1,            -- EP N°1, N°2...
  periodo         text,                          -- 'YYYY-MM'
  fecha           date default current_date,
  -- Montos (todos netos, sin IVA)
  monto_neto      bigint default 0,              -- avance cobrado este período
  retencion_pct   numeric(5,2) default 0,        -- retención de garantía (ej: 5%, 10%)
  retencion_monto bigint default 0,
  anticipo_desc   bigint default 0,              -- descuento por amortización de anticipo
  monto_pagar     bigint default 0,              -- neto - retención - anticipo
  iva             bigint default 0,
  total           bigint default 0,              -- monto_pagar + iva
  -- Estado del EP
  estado          text default 'borrador' check (estado in ('borrador','presentado','aprobado','pagado','rechazado')),
  factura_id      uuid references facturas(id) on delete set null,  -- factura generada
  notas           text,
  user_id         uuid references auth.users(id) on delete cascade,
  created_at      timestamptz default now()
);

alter table estados_pago enable row level security;
create policy "ep_own" on estados_pago
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_ep_proyecto on estados_pago(proyecto_id, numero);

-- ════════════════════════════════════════════════════════════
-- 3. DETALLE DE ESTADO DE PAGO (foto del avance por partida)
--    Guarda cuánto se avanzó en cada partida en este EP.
-- ════════════════════════════════════════════════════════════
create table estado_pago_detalle (
  id               uuid primary key default uuid_generate_v4(),
  estado_pago_id   uuid references estados_pago(id) on delete cascade,
  partida_id       uuid references partidas_proyecto(id) on delete set null,
  descripcion      text,                          -- snapshot del nombre
  valor_partida    bigint default 0,              -- valor total de la partida
  avance_anterior  integer default 0,             -- % acumulado hasta EP anterior
  avance_actual    integer default 0,             -- % acumulado a este EP
  avance_periodo   integer default 0,             -- diferencia (lo que se cobra)
  monto            bigint default 0,              -- valor_partida x avance_periodo / 100
  user_id          uuid references auth.users(id) on delete cascade,
  created_at       timestamptz default now()
);

alter table estado_pago_detalle enable row level security;
create policy "epd_own" on estado_pago_detalle
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_epd_ep on estado_pago_detalle(estado_pago_id);

-- ════════════════════════════════════════════════════════════
-- 4. Campos extra en proyecto para gestión de presupuesto
-- ════════════════════════════════════════════════════════════
alter table proyectos
  add column if not exists retencion_pct numeric(5,2) default 0,   -- % retención garantía del contrato
  add column if not exists anticipo      bigint default 0;          -- anticipo recibido (a amortizar)

-- Campo en facturas para vincular al EP que la originó
alter table facturas
  add column if not exists estado_pago_id uuid references estados_pago(id) on delete set null;

-- ════════════════════════════════════════════════════════════
-- 5. Vincular partida de cotización con su origen en el catálogo
--    Permite que al convertir se traigan las sub-partidas del catálogo.
-- ════════════════════════════════════════════════════════════
alter table partidas_cotizacion
  add column if not exists catalogo_id uuid references catalogo_partidas(id) on delete set null;
