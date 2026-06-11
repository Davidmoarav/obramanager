-- ============================================================
-- PASO 2: Documentos por proyecto
-- Ejecutar en Supabase > SQL Editor > New query > Run
-- ============================================================

-- ─── Tabla de documentos ───────────────────────────────────
create table documentos (
  id            uuid primary key default uuid_generate_v4(),
  proyecto_id   uuid references proyectos(id) on delete cascade,
  nombre        text not null,
  descripcion   text,
  categoria     text default 'general' check (categoria in ('plano','foto','contrato','permiso','especificacion','presupuesto','general')),
  archivo_path  text not null,
  archivo_tipo  text,
  archivo_size  bigint default 0,
  user_id       uuid references auth.users(id) on delete cascade,
  created_at    timestamptz default now()
);

-- ─── RLS ───────────────────────────────────────────────────
alter table documentos enable row level security;

create policy "documentos_own" on documentos
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_docs_proyecto on documentos(proyecto_id);
create index idx_docs_user     on documentos(user_id);

-- ─── Bucket de Storage privado para documentos ─────────────
insert into storage.buckets (id, name, public)
values ('proyecto-docs', 'proyecto-docs', false)
on conflict (id) do nothing;

-- Políticas: cada usuario accede solo a SU carpeta
create policy "docs_select_own" on storage.objects
  for select using (
    bucket_id = 'proyecto-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "docs_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'proyecto-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "docs_delete_own" on storage.objects
  for delete using (
    bucket_id = 'proyecto-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
