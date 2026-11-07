-- Pruebas de la fase (a) contra un Postgres local con PostGIS.
-- Uso: npm run test:db   (ver scripts/probar-db.sh)
\set ON_ERROR_STOP 1
\set QUIET 1

create or replace function pg_temp.afirmar(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- Usuarios: admin y staff vía app_metadata (como lo hace el script crear-usuario), y dos anónimos.
insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@rancho.mx', '{"rol":"admin","nombre":"Administrador"}'),
  ('00000000-0000-0000-0000-00000000000b', 'staff@rancho.mx', '{"rol":"staff","nombre":"Juan Pérez"}');
insert into auth.users (id, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000c1', true),
  ('00000000-0000-0000-0000-0000000000c2', true);

select pg_temp.afirmar((select count(*) = 2 from public.perfiles), 'el trigger crea perfiles solo para personal');
select pg_temp.afirmar((select rol = 'admin' from public.perfiles where nombre = 'Administrador'), 'perfil admin con su rol');

-- Cargar datos de prueba con la llave de servicio
set request.jwt.claim.role = 'service_role';
set request.jwt.claim.sub = '';
select public.importar_kml(:'datos'::jsonb || '{"origen":"prueba"}', true, 'rancho-prueba.kml') as r \gset
select pg_temp.afirmar((select count(*) = 10 from public.espiaderos where origen = 'prueba' and archivado_at is null), 'carga 10 espiaderos de prueba');
select pg_temp.afirmar((select count(*) = 4 from public.caminos where archivado_at is null), 'carga 4 caminos');
select pg_temp.afirmar((select extensions.st_area(geom) between 2.5e7 and 3.5e7 from public.linderos where archivado_at is null), 'lindero de ~30 km²');
select pg_temp.afirmar((select altitud_m = 312 from public.espiaderos where nombre = 'La Noria'), 'conserva altitud');
reset request.jwt.claim.role;

-- Staff no puede generar códigos ni importar
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  perform public.generar_codigo(24);
  raise exception 'FALLA: staff generó código';
exception when insufficient_privilege then raise notice 'ok - staff no puede generar códigos';
end $$;
do $$ begin
  perform public.importar_kml('{"linderos":[1],"espiaderos":[1]}', false);
  raise exception 'FALLA: staff importó';
exception when insufficient_privilege then raise notice 'ok - staff no puede importar KML';
end $$;
select pg_temp.afirmar((select count(*) = 2 from public.perfiles), 'staff ve los perfiles del personal');
select pg_temp.afirmar((select count(*) = 0 from public.codigos_invitado), 'staff no ve códigos');

-- Admin genera un código
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select codigo, id as codigo_id from public.generar_codigo(24, 2, 'Invitados del sábado') \gset
select pg_temp.afirmar(:'codigo' ~ '^[0-9]{6}$', 'código de 6 dígitos');

-- Invitado 1: código incorrecto no da acceso, el correcto sí
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select pg_temp.afirmar((select count(*) = 0 from public.espiaderos), 'sin perfil no ve espiaderos');
select pg_temp.afirmar((select (public.canjear_codigo(case when :'codigo' = '000000' then '111111' else '000000' end, 'Pedro')).id is null), 'código incorrecto no entra');
select pg_temp.afirmar((select (public.canjear_codigo(:'codigo', '  Pedro Garza ')).nombre = 'Pedro Garza'), 'código correcto crea perfil invitado');
select pg_temp.afirmar((select public.mi_rol() = 'invitado'), 'rol invitado vigente');
select pg_temp.afirmar((select count(*) = 10 from public.espiaderos), 'invitado ve los espiaderos');
select pg_temp.afirmar((select count(*) = 1 from public.perfiles), 'invitado solo ve su propio perfil');
select pg_temp.afirmar((select count(*) = 0 from public.codigos_invitado), 'invitado no ve códigos');
select pg_temp.afirmar((select jsonb_array_length(public.mapa_actual() -> 'espiaderos') = 10), 'mapa_actual devuelve los 10 espiaderos');
do $$ begin
  update public.espiaderos set radio_m = 999;
  if (select count(*) from public.espiaderos where radio_m = 999) > 0 then raise exception 'FALLA: invitado editó'; end if;
  raise notice 'ok - invitado no puede editar espiaderos';
end $$;

-- Límite de intentos: 5 fallos seguidos bloquean
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
select count(*) as fallos from (select public.canjear_codigo('99999' || n, 'X') from generate_series(0, 4) n) s \gset
do $$ begin
  perform public.canjear_codigo('123123', 'X');
  raise exception 'FALLA: no se aplicó el límite de intentos';
exception when sqlstate 'P0429' then raise notice 'ok - límite de intentos por sesión';
end $$;

-- Revocar el código corta el acceso del invitado
reset role;
delete from public.intentos_canje;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.revocar_codigo(:'codigo_id');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select pg_temp.afirmar((select public.mi_rol() is null), 'invitado pierde acceso al revocar el código');
select pg_temp.afirmar((select count(*) = 0 from public.espiaderos), 'invitado revocado ya no ve el mapa');

-- Código vencido no entra
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select codigo as codigo2, id as codigo2_id from public.generar_codigo(1) \gset
reset role;
update public.codigos_invitado set vigente_hasta = now() - interval '1 minute' where id = :'codigo2_id';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
select pg_temp.afirmar((select (public.canjear_codigo(:'codigo2', 'Ana')).id is null), 'código vencido no entra');

-- Importación "real": 2 coinciden por nombre (uno con otro acento/mayúsculas), 1 nuevo, el resto se archiva
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.importar_kml('{
  "linderos": [{"nombre": "Lindero real", "coordenadas": [[[-100.12,26.60],[-100.05,26.60],[-100.05,26.65],[-100.12,26.65],[-100.12,26.60]]]}],
  "caminos": [{"nombre": "Camino real", "coordenadas": [[-100.11,26.61],[-100.06,26.64]]}],
  "espiaderos": [
    {"nombre": "LA NORIA", "lon": -100.1095, "lat": 26.6132, "altitud": null},
    {"nombre": "El Ebano", "lon": -100.065, "lat": 26.614, "altitud": 335},
    {"nombre": "El Venadito", "lon": -100.08, "lat": 26.63, "altitud": null}
  ]}'::jsonb, false) as vista \gset
select pg_temp.afirmar((:'vista'::jsonb #> '{espiaderos,actualizar}') @> '[{"nombre":"LA NORIA"},{"nombre":"El Ebano"}]', 'vista previa: actualiza por nombre sin importar acentos');
select pg_temp.afirmar(jsonb_array_length(:'vista'::jsonb #> '{espiaderos,archivar}') = 8, 'vista previa: archiva 8 ficticios');
select pg_temp.afirmar((:'vista'::jsonb #> '{espiaderos,crear}') = '["El Venadito"]', 'vista previa: 1 nuevo');
select pg_temp.afirmar((select count(*) = 10 from public.espiaderos), 'la vista previa no cambia nada');

select id as noria_id from public.espiaderos where nombre = 'La Noria' \gset
select public.importar_kml(:'vista_datos'::jsonb, true, 'rancho-real.kml') \gset
reset role;
select pg_temp.afirmar((select nombre = 'LA NORIA' and archivado_at is null and origen = 'kml' and altitud_m = 312 from public.espiaderos where id = :'noria_id'),
  'La Noria conserva su id (historial), toma el nombre nuevo y conserva altitud si el KML no la trae');
select pg_temp.afirmar((select count(*) = 3 from public.espiaderos where archivado_at is null), 'quedan 3 espiaderos vigentes');
select pg_temp.afirmar((select count(*) = 8 from public.espiaderos where archivado_at is not null and origen = 'prueba'), 'los 8 ficticios quedan archivados, no borrados');
select pg_temp.afirmar((select count(*) = 1 from public.linderos where archivado_at is null and nombre = 'Lindero real'), 'lindero reemplazado');
select pg_temp.afirmar((select count(*) = 1 from public.caminos where archivado_at is null), 'caminos reemplazados');
select pg_temp.afirmar((select count(*) = 2 from public.importaciones_kml), 'importaciones registradas');

-- Reimportar el mismo archivo es idempotente
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.importar_kml(:'vista_datos'::jsonb, true, 'rancho-real.kml') as r2 \gset
select pg_temp.afirmar(jsonb_array_length(:'r2'::jsonb #> '{espiaderos,archivar}') = 0 and jsonb_array_length(:'r2'::jsonb #> '{espiaderos,crear}') = 0, 'reimportar el mismo KML no crea ni archiva');

-- Editar radio
select pg_temp.afirmar((select (public.actualizar_espiadero(:'noria_id', null, 300)).radio_m = 300), 'admin cambia el radio');
reset role;
\echo 'TODAS LAS PRUEBAS PASARON'
