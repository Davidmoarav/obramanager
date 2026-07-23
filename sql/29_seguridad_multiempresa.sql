-- ============================================================
-- 29 · SEGURIDAD MULTI-EMPRESA (Fase 1 de la auditoría)
--
-- A1: un usuario solo puede tener UNA membresía activa
--     (evita que sus datos caigan en la empresa equivocada).
-- A2: políticas de Storage org-aware (proyecto-docs, empresa-logos)
--     + migración de archivos antiguos a la carpeta del dueño.
-- A4: aceptar_invitacion exige email confirmado.
--
-- Idempotente. Ejecutar en Supabase > SQL Editor > Run
-- ============================================================

-- ─── A1.1 Limpieza previa: si un usuario tiene varias membresías
--     activas, se conserva la más antigua y el resto queda suspendido ─
update miembros m
   set estado = 'suspendido'
 where m.estado = 'activo'
   and m.member_user_id is not null
   and exists (
     select 1 from miembros m2
      where m2.member_user_id = m.member_user_id
        and m2.estado = 'activo'
        and m2.created_at < m.created_at
   );

-- ─── A1.2 Índice único: una sola membresía activa por usuario ─
create unique index if not exists uq_miembro_activo
  on miembros(member_user_id)
  where estado = 'activo' and member_user_id is not null;

-- ─── A1.3 resolver_owner determinista (la más antigua, por si acaso) ─
create or replace function resolver_owner() returns trigger as $$
begin
  new.user_id := coalesce(
    (select owner_id from miembros m
      where m.member_user_id = auth.uid() and m.estado = 'activo'
      order by m.created_at asc
      limit 1),
    auth.uid()
  );
  return new;
end;
$$ language plpgsql security definer;

-- ─── A4 aceptar_invitacion: solo con email confirmado ─────
-- Sin esto, si la confirmación de email estuviera apagada en Supabase,
-- cualquiera podría registrarse con el email de un invitado pendiente
-- y entrar a la organización ajena.
create or replace function aceptar_invitacion() returns void as $$
  update miembros
     set member_user_id = auth.uid(), estado = 'activo'
   where estado = 'pendiente'
     and member_user_id is null
     and lower(member_email) = lower((select email from auth.users where id = auth.uid()))
     and (select email_confirmed_at from auth.users where id = auth.uid()) is not null
     -- respeta el índice único: no activar si ya tiene otra membresía activa
     and not exists (
       select 1 from miembros x
        where x.member_user_id = auth.uid() and x.estado = 'activo'
     );
$$ language sql security definer;

-- ─── A2.1 Helper: uuid del dueño según la carpeta raíz del path ─
-- Devuelve null si la carpeta no es un uuid válido (evita errores de cast).
create or replace function owner_de_carpeta(path text) returns uuid as $$
begin
  return ((storage.foldername(path))[1])::uuid;
exception when others then
  return null;
end;
$$ language plpgsql immutable;

-- ─── A2.2 proyecto-docs: acceso por ORGANIZACIÓN, no por uid ─
drop policy if exists "docs_select_own" on storage.objects;
drop policy if exists "docs_insert_own" on storage.objects;
drop policy if exists "docs_delete_own" on storage.objects;
drop policy if exists "docs_select_org" on storage.objects;
drop policy if exists "docs_insert_org" on storage.objects;
drop policy if exists "docs_delete_org" on storage.objects;

create policy "docs_select_org" on storage.objects
  for select using (
    bucket_id = 'proyecto-docs'
    and puede_acceder(owner_de_carpeta(name))
  );

create policy "docs_insert_org" on storage.objects
  for insert with check (
    bucket_id = 'proyecto-docs'
    and puede_acceder(owner_de_carpeta(name))
  );

create policy "docs_delete_org" on storage.objects
  for delete using (
    bucket_id = 'proyecto-docs'
    and puede_acceder(owner_de_carpeta(name))
  );

-- ─── A2.3 empresa-logos: lectura pública (PDFs), escritura org ─
drop policy if exists "logos_insert_own" on storage.objects;
drop policy if exists "logos_update_own" on storage.objects;
drop policy if exists "logos_delete_own" on storage.objects;
drop policy if exists "logos_select_own" on storage.objects;
drop policy if exists "logos_insert_org" on storage.objects;
drop policy if exists "logos_update_org" on storage.objects;
drop policy if exists "logos_delete_org" on storage.objects;
-- (logos_public_read se mantiene tal cual)

create policy "logos_insert_org" on storage.objects
  for insert with check (
    bucket_id = 'empresa-logos'
    and puede_acceder(owner_de_carpeta(name))
  );

create policy "logos_update_org" on storage.objects
  for update using (
    bucket_id = 'empresa-logos'
    and puede_acceder(owner_de_carpeta(name))
  );

create policy "logos_delete_org" on storage.objects
  for delete using (
    bucket_id = 'empresa-logos'
    and puede_acceder(owner_de_carpeta(name))
  );

-- ─── A2.4 Migrar archivos antiguos a la carpeta del dueño ──
-- Documentos subidos por miembros quedaron en la carpeta del uid del
-- miembro; se mueven (rename) a la carpeta del dueño y se actualiza
-- documentos.archivo_path para que ambos sigan calzando.
do $$
declare
  d record;
  nuevo_path text;
begin
  for d in
    select id, user_id, archivo_path
      from documentos
     where split_part(archivo_path, '/', 1) <> user_id::text
  loop
    nuevo_path := d.user_id::text || substring(d.archivo_path from position('/' in d.archivo_path));
    update storage.objects
       set name = nuevo_path
     where bucket_id = 'proyecto-docs' and name = d.archivo_path;
    update documentos
       set archivo_path = nuevo_path
     where id = d.id;
  end loop;
end $$;

-- ─── Verificación rápida ───────────────────────────────────
-- select count(*) from miembros where estado='activo' group by member_user_id having count(*)>1;  → 0 filas
-- select name from storage.objects o join documentos d on d.archivo_path=o.name
--   where split_part(o.name,'/',1) <> d.user_id::text;  → 0 filas
