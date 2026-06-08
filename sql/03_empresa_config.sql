-- ============================================================
-- SUB-PASO A: Configuración de empresa
-- Ejecutar en Supabase > SQL Editor > New query > Run
-- ============================================================

-- ─── Tabla de configuración de empresa ─────────────────────
-- Un registro por usuario (una empresa por cuenta)
create table empresa_config (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid unique references auth.users(id) on delete cascade,
  razon_social    text,
  rut             text,
  giro            text,
  direccion       text,
  comuna          text,
  ciudad          text,
  telefono        text,
  email           text,
  sitio_web       text,
  logo_path       text,
  color_primario  text default '#1e6bb8',
  notas_pdf       text,
  updated_at      timestamptz default now()
);

-- ─── RLS ───────────────────────────────────────────────────
alter table empresa_config enable row level security;

create policy "empresa_config_own" on empresa_config
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Storage bucket para logos ─────────────────────────────
-- Crea el bucket "empresa-logos" (público para que el logo cargue en PDFs)
insert into storage.buckets (id, name, public)
values ('empresa-logos', 'empresa-logos', true)
on conflict (id) do nothing;

-- Políticas del bucket: el dueño puede subir/actualizar/borrar SU logo
create policy "logos_select_own" on storage.objects
  for select using (
    bucket_id = 'empresa-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "logos_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'empresa-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "logos_update_own" on storage.objects
  for update using (
    bucket_id = 'empresa-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "logos_delete_own" on storage.objects
  for delete using (
    bucket_id = 'empresa-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lectura pública (cualquiera puede ver los logos por URL — necesario para que el PDF los muestre)
create policy "logos_public_read" on storage.objects
  for select using (bucket_id = 'empresa-logos');
