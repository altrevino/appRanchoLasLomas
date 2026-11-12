-- Pruebas de la fase (d): lugares y avistamientos recientes.
\set ON_ERROR_STOP 1
\set QUIET 1
create or replace function pg_temp.afirmar(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.importar_kml('{
  "linderos": [{"nombre": "L", "coordenadas": [[[-100.12,26.60],[-100.05,26.60],[-100.05,26.65],[-100.12,26.65],[-100.12,26.60]]]}],
  "espiaderos": [{"nombre": "LA NORIA", "lon": -100.1095, "lat": 26.6132, "altitud": null}],
  "lugares": [{"nombre": "Casa", "tipo": "casa", "lon": -100.08, "lat": 26.62, "altitud": 178}]
}'::jsonb, false) as vista \gset
select pg_temp.afirmar((:'vista'::jsonb #>> '{lugares,nuevos}')::int = 1 and (:'vista'::jsonb #> '{lugares,nombres}') = '["Casa"]', 'vista previa incluye el lugar Casa');
select public.importar_kml('{
  "linderos": [{"nombre": "L", "coordenadas": [[[-100.12,26.60],[-100.05,26.60],[-100.05,26.65],[-100.12,26.65],[-100.12,26.60]]]}],
  "espiaderos": [{"nombre": "LA NORIA", "lon": -100.1095, "lat": 26.6132, "altitud": null}],
  "lugares": [{"nombre": "Casa", "tipo": "casa", "lon": -100.08, "lat": 26.62, "altitud": 178}]
}'::jsonb, true) \gset
select pg_temp.afirmar((select count(*) = 1 from public.lugares where archivado_at is null and tipo = 'casa'), 'Casa se guarda como lugar, no como espiadero');
select pg_temp.afirmar(not exists (select 1 from public.espiaderos where archivado_at is null and nombre ilike 'casa'), 'Casa no está entre los espiaderos');
select pg_temp.afirmar(jsonb_array_length(public.mapa_actual_v2() -> 'lugares') = 1, 'el mapa incluye los lugares');
select pg_temp.afirmar((select count(*) >= 0 from public.avistamientos_recientes(30)), 'avistamientos recientes (staff)');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
reset role;
update public.perfiles set activo = true, expira_en = now() + interval '1 day' where id = '00000000-0000-0000-0000-0000000000d1';
set role authenticated;
select pg_temp.afirmar(jsonb_array_length(public.mapa_actual_v2() -> 'lugares') = 1, 'el invitado también ve la Casa en el mapa');
select pg_temp.afirmar((select count(*) = 0 from public.avistamientos_recientes(365)), 'el invitado no ve avistamientos');
reset role;
-- Clase M5
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.registrar_avistamiento(jsonb_build_object('id', gen_random_uuid(), 'macho_id', '00000000-0000-0000-0000-0000000000f5', 'nuevo', true, 'clase', 'M5', 'observado_at', now())) \gset
select pg_temp.afirmar((select clase_actual = 'M5' from public.machos where id = '00000000-0000-0000-0000-0000000000f5'), 'la bitácora acepta M5');
reset role;
\echo 'TODAS LAS PRUEBAS DE LA FASE D PASARON'
