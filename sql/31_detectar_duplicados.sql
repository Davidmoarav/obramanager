-- ============================================================
-- 31 · DETECTOR DE DUPLICADOS (solo lectura, no modifica nada)
--
-- Pegar COMPLETO en Supabase > SQL Editor > Run.
-- Devuelve una tabla resumen: un chequeo por fila.
--   grupos_duplicados = cuántos conjuntos de filas repetidas hay
--   filas_de_mas      = cuántas filas sobran (las que habría que fusionar/borrar)
-- Si todo da 0, la base está limpia.
-- ============================================================

with
liq as (            -- liquidaciones repetidas del mismo empleado+período
  select count(*) c from liquidaciones
  group by user_id, empleado_id, periodo having count(*) > 1
),
gmo as (            -- gasto de mano de obra duplicado para la misma liquidación
  select count(*) c from gastos_obra
  where liquidacion_id is not null
  group by liquidacion_id having count(*) > 1
),
ep as (             -- estados de pago con el mismo número en el mismo proyecto
  select count(*) c from estados_pago
  group by user_id, proyecto_id, numero having count(*) > 1
),
fac as (            -- facturas con misma org+tipo+doc+número+período (clave del import SII)
  select count(*) c from facturas
  where numero is not null and numero <> ''
  group by user_id, tipo, coalesce(doc_tipo,'factura'), numero, coalesce(periodo,'') having count(*) > 1
),
doc as (            -- documentos que apuntan al mismo archivo
  select count(*) c from documentos
  group by archivo_path having count(*) > 1
),
mie as (            -- usuarios con más de una membresía ACTIVA (bug A1; el 29 lo bloquea)
  select count(*) c from miembros
  where estado = 'activo' and member_user_id is not null
  group by member_user_id having count(*) > 1
),
cli as (            -- clientes con el mismo RUT en la misma organización
  select count(*) c from clientes
  where rut is not null and rut <> ''
  group by user_id, lower(regexp_replace(rut, '[^0-9kK]', '', 'g')) having count(*) > 1
),
prov as (           -- proveedores con el mismo nombre en la misma organización
  select count(*) c from proveedores
  group by user_id, lower(trim(nombre)) having count(*) > 1
),
emp as (            -- empleados con el mismo RUT en la misma organización
  select count(*) c from empleados
  where rut is not null and rut <> ''
  group by user_id, lower(regexp_replace(rut, '[^0-9kK]', '', 'g')) having count(*) > 1
),
cot as (            -- cotizaciones con el mismo número en la misma organización
  select count(*) c from cotizaciones
  where numero is not null and numero::text <> ''
  group by user_id, numero having count(*) > 1
),
oc as (             -- órdenes de compra con el mismo número en la misma organización
  select count(*) c from ordenes_compra
  group by user_id, numero having count(*) > 1
),
cat as (            -- catálogo: partidas con la misma descripción (informativo)
  select count(*) c from catalogo_partidas
  group by user_id, lower(trim(descripcion)) having count(*) > 1
),
pp as (             -- partidas de proyecto EXACTAMENTE iguales (mismo padre, texto, cantidad y precio)
  select count(*) c from partidas_proyecto
  group by user_id, proyecto_id, coalesce(parent_id::text,''), lower(trim(descripcion)), cantidad, precio_unitario
  having count(*) > 1
),
huerf_reg as (      -- documentos cuyo archivo NO existe en Storage (registro huérfano)
  select 1 c from documentos d
  where not exists (select 1 from storage.objects o
                    where o.bucket_id = 'proyecto-docs' and o.name = d.archivo_path)
),
huerf_arch as (     -- archivos en Storage sin registro en documentos (archivo huérfano)
  select 1 c from storage.objects o
  where o.bucket_id = 'proyecto-docs'
    and not exists (select 1 from documentos d where d.archivo_path = o.name)
)
select '1. Liquidaciones repetidas (empleado+período)'          as chequeo, (select count(*) from liq)  as grupos_duplicados, (select coalesce(sum(c-1),0) from liq)  as filas_de_mas union all
select '2. Gasto MO duplicado por liquidación',                             (select count(*) from gmo),                       (select coalesce(sum(c-1),0) from gmo)  union all
select '3. Estados de pago con número repetido',                            (select count(*) from ep),                        (select coalesce(sum(c-1),0) from ep)   union all
select '4. Facturas duplicadas (clave SII)',                                (select count(*) from fac),                       (select coalesce(sum(c-1),0) from fac)  union all
select '5. Documentos apuntando al mismo archivo',                          (select count(*) from doc),                       (select coalesce(sum(c-1),0) from doc)  union all
select '6. Membresías activas duplicadas (bug A1)',                         (select count(*) from mie),                       (select coalesce(sum(c-1),0) from mie)  union all
select '7. Clientes con RUT repetido',                                      (select count(*) from cli),                       (select coalesce(sum(c-1),0) from cli)  union all
select '8. Proveedores con nombre repetido',                                (select count(*) from prov),                      (select coalesce(sum(c-1),0) from prov) union all
select '9. Empleados con RUT repetido',                                     (select count(*) from emp),                       (select coalesce(sum(c-1),0) from emp)  union all
select '10. Cotizaciones con número repetido',                              (select count(*) from cot),                       (select coalesce(sum(c-1),0) from cot)  union all
select '11. OC con número repetido',                                        (select count(*) from oc),                        (select coalesce(sum(c-1),0) from oc)   union all
select '12. Catálogo: descripciones repetidas (informativo)',               (select count(*) from cat),                       (select coalesce(sum(c-1),0) from cat)  union all
select '13. Partidas de proyecto idénticas (informativo)',                  (select count(*) from pp),                        (select coalesce(sum(c-1),0) from pp)   union all
select '14. Documentos sin archivo en Storage (huérfanos)',                 (select count(*) from huerf_reg),                 (select count(*) from huerf_reg)        union all
select '15. Archivos en Storage sin registro (huérfanos)',                  (select count(*) from huerf_arch),                (select count(*) from huerf_arch)
order by 1;

-- ============================================================
-- DETALLE — para ver las filas de un chequeo con resultado > 0,
-- descomenta y ejecuta la consulta correspondiente:
-- ============================================================

-- 1. Liquidaciones repetidas:
-- select l.* from liquidaciones l join (
--   select user_id, empleado_id, periodo from liquidaciones
--   group by 1,2,3 having count(*) > 1
-- ) d using (user_id, empleado_id, periodo) order by l.empleado_id, l.periodo, l.created_at;

-- 2. Gasto MO duplicado:
-- select * from gastos_obra where liquidacion_id in (
--   select liquidacion_id from gastos_obra where liquidacion_id is not null
--   group by 1 having count(*) > 1) order by liquidacion_id, fecha;

-- 3. EP con número repetido:
-- select e.* from estados_pago e join (
--   select user_id, proyecto_id, numero from estados_pago group by 1,2,3 having count(*) > 1
-- ) d using (user_id, proyecto_id, numero) order by e.proyecto_id, e.numero, e.created_at;

-- 4. Facturas duplicadas:
-- select f.* from facturas f join (
--   select user_id, tipo, coalesce(doc_tipo,'factura') dt, numero, coalesce(periodo,'') per
--   from facturas where numero is not null and numero <> ''
--   group by 1,2,3,4,5 having count(*) > 1
-- ) d on d.user_id=f.user_id and d.tipo=f.tipo and d.dt=coalesce(f.doc_tipo,'factura')
--    and d.numero=f.numero and d.per=coalesce(f.periodo,'')
-- order by f.numero, f.created_at;

-- 6. Membresías activas duplicadas:
-- select * from miembros where member_user_id in (
--   select member_user_id from miembros where estado='activo' and member_user_id is not null
--   group by 1 having count(*) > 1) order by member_user_id, created_at;

-- 14/15. Huérfanos de Storage:
-- select d.id, d.nombre, d.archivo_path from documentos d
--   where not exists (select 1 from storage.objects o where o.bucket_id='proyecto-docs' and o.name=d.archivo_path);
-- select o.name, o.created_at from storage.objects o
--   where o.bucket_id='proyecto-docs'
--     and not exists (select 1 from documentos d where d.archivo_path=o.name);
