-- ============================================================
-- MÓDULO FINANZAS AVANZADO
-- Remuneraciones + Control IVA + Avance presupuestario
-- Ejecutar en Supabase > SQL Editor > New query > Run
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. PARÁMETROS GLOBALES DE REMUNERACIONES (editables por contadora)
-- ════════════════════════════════════════════════════════════
create table parametros_remuneracion (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid unique references auth.users(id) on delete cascade,
  -- Porcentajes previsionales (valores por defecto Chile 2026)
  afp_pct               numeric(5,2) default 10.00,   -- cotización obligatoria AFP (sin comisión)
  afp_comision_pct      numeric(5,2) default 1.44,    -- comisión AFP promedio
  salud_pct             numeric(5,2) default 7.00,    -- Fonasa / Isapre base
  afc_trabajador_pct    numeric(5,2) default 0.60,    -- seguro cesantía trabajador (contrato indefinido)
  afc_empleador_pct     numeric(5,2) default 2.40,    -- seguro cesantía empleador
  -- Topes y valores de referencia
  uf_valor              bigint default 39000,         -- valor UF referencial
  utm_valor             bigint default 68000,         -- valor UTM referencial
  tope_imponible_uf     numeric(6,2) default 87.80,   -- tope imponible en UF
  gratificacion_tope    bigint default 209396,        -- tope gratificación legal mensual (4.75 IMM / 12)
  -- Asignaciones no imponibles por defecto
  colacion_default      bigint default 0,
  movilizacion_default  bigint default 0,
  updated_at            timestamptz default now()
);

alter table parametros_remuneracion enable row level security;
create policy "param_rem_own" on parametros_remuneracion
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════
-- 2. DATOS PREVISIONALES POR EMPLEADO
-- ════════════════════════════════════════════════════════════
-- Ampliamos la tabla empleados con campos previsionales
alter table empleados
  add column if not exists afp_nombre        text default 'Modelo',
  add column if not exists afp_pct_custom    numeric(5,2),       -- si null, usa el global
  add column if not exists salud_sistema     text default 'Fonasa' check (salud_sistema in ('Fonasa','Isapre')),
  add column if not exists salud_pct_custom  numeric(5,2),       -- si null, usa 7%
  add column if not exists salud_uf          numeric(6,2) default 0,  -- plan Isapre en UF (si aplica)
  add column if not exists contrato_tipo     text default 'indefinido' check (contrato_tipo in ('indefinido','plazo_fijo','obra_faena')),
  add column if not exists colacion          bigint default 0,
  add column if not exists movilizacion      bigint default 0,
  add column if not exists bono_imponible    bigint default 0,
  add column if not exists otros_descuentos  bigint default 0;   -- préstamos, anticipos, etc.

-- ════════════════════════════════════════════════════════════
-- 3. LIQUIDACIONES MENSUALES (registro histórico)
-- ════════════════════════════════════════════════════════════
create table liquidaciones (
  id                uuid primary key default uuid_generate_v4(),
  empleado_id       uuid references empleados(id) on delete cascade,
  periodo           text not null,            -- formato 'YYYY-MM'
  -- Haberes
  sueldo_base       bigint default 0,
  horas_extra_monto bigint default 0,
  gratificacion     bigint default 0,
  bono_imponible    bigint default 0,
  colacion          bigint default 0,
  movilizacion      bigint default 0,
  total_imponible   bigint default 0,
  total_haberes     bigint default 0,
  -- Descuentos
  desc_afp          bigint default 0,
  desc_salud        bigint default 0,
  desc_afc          bigint default 0,
  otros_descuentos  bigint default 0,
  total_descuentos  bigint default 0,
  -- Resultado
  liquido_pagar     bigint default 0,
  estado            text default 'borrador' check (estado in ('borrador','pagada')),
  user_id           uuid references auth.users(id) on delete cascade,
  created_at        timestamptz default now()
);

alter table liquidaciones enable row level security;
create policy "liquidaciones_own" on liquidaciones
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_liq_periodo  on liquidaciones(user_id, periodo);
create index idx_liq_empleado on liquidaciones(empleado_id);

-- ════════════════════════════════════════════════════════════
-- 4. FACTURAS: separar neto/IVA y tipo (venta/compra) para control IVA
-- ════════════════════════════════════════════════════════════
alter table facturas
  add column if not exists tipo        text default 'venta' check (tipo in ('venta','compra')),
  add column if not exists neto        bigint default 0,
  add column if not exists iva         bigint default 0,
  add column if not exists periodo     text;   -- 'YYYY-MM' del IVA, derivado de emisión

-- Backfill: para facturas existentes, calcular neto/iva desde monto (asumiendo monto = total con IVA)
update facturas
set neto = round(monto / 1.19),
    iva  = monto - round(monto / 1.19),
    periodo = to_char(coalesce(emision, created_at::date), 'YYYY-MM')
where neto = 0 and monto > 0;
