-- Pruebas de trofeo (solo admin). Se corre al final.
\set ON_ERROR_STOP 1
\set QUIET 1
create or replace function pg_temp.afirmar(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
reset role;
select gen_random_uuid() as t1, gen_random_uuid() as t2 \gset
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.registrar_avistamiento(jsonb_build_object('id', gen_random_uuid(), 'macho_id', :'t1', 'nuevo', true, 'clase', 'M5', 'observado_at', now())) \gset
select public.registrar_avistamiento(jsonb_build_object('id', gen_random_uuid(), 'macho_id', :'t2', 'nuevo', true, 'clase', 'M5', 'observado_at', now())) \gset
do $$ begin
  perform public.guardar_trofeo((select id from public.machos where estado = 'por_validar' limit 1), '{"puntuacion_estimada": 150}');
  raise exception 'FALLA: staff guardó trofeo';
exception when insufficient_privilege then raise notice 'ok - el personal no puede guardar datos de trofeo';
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.guardar_trofeo(:'t1', '{"puntuacion_estimada": 148.5, "sistema": "B&C"}') \gset
select pg_temp.afirmar((select puntuacion_estimada = 148.5 and fecha_caza is null from public.machos_trofeo where macho_id = :'t1'), 'admin guarda la puntuación estimada');
select public.guardar_trofeo(:'t1', '{"fecha_caza": "2026-11-14", "cazador": "Juan Pérez"}') \gset
select pg_temp.afirmar((select estado = 'cazado' and cazado_at::date = '2026-11-14' from public.machos where id = :'t1'), 'con fecha de caza el ejemplar queda cazado');
select pg_temp.afirmar((select puntuacion_estimada = 148.5 and cazador = 'Juan Pérez' from public.machos_trofeo where macho_id = :'t1'), 'conserva la estimada al registrar la caza');
select public.guardar_trofeo(:'t1', '{"puntuacion_real": 152}') \gset
select pg_temp.afirmar((select puntuacion_real = 152 from public.machos_trofeo where macho_id = :'t1'), 'la puntuación real se puede agregar después');

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.afirmar((select count(*) = 0 from public.machos_trofeo), 'el personal no ve los datos de trofeo');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.guardar_trofeo(:'t1', '{"fecha_caza": null}') \gset
select pg_temp.afirmar((select estado = 'activo' from public.machos where id = :'t1') and (select cazador is null and puntuacion_real = 152 from public.machos_trofeo where macho_id = :'t1'), 'quitar la fecha regresa a activo (por error) y conserva puntuaciones');
select public.fusionar_machos(:'t1', :'t2') \gset
select pg_temp.afirmar((select puntuacion_estimada = 148.5 from public.machos_trofeo where macho_id = :'t2') and not exists (select 1 from public.machos_trofeo where macho_id = :'t1'), 'la fusión mueve los datos de trofeo');
reset role;
\echo 'TODAS LAS PRUEBAS DE TROFEO PASARON'
