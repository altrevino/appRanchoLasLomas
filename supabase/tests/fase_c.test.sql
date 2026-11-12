-- Pruebas de la fase (c): bitácora. Se corre después de fase_b.test.sql.
\set ON_ERROR_STOP 1
\set QUIET 1

create or replace function pg_temp.afirmar(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

reset role;
select (array_agg(id order by nombre))[1] as e1, (array_agg(id order by nombre))[2] as e2
  from public.espiaderos where archivado_at is null \gset
select gen_random_uuid() as m1, gen_random_uuid() as a1, gen_random_uuid() as f1,
       gen_random_uuid() as m2, gen_random_uuid() as a2, gen_random_uuid() as a3 \gset
set role authenticated;

-- Invitado (…d1) no puede registrar ni ver
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
do $$ begin
  perform public.registrar_avistamiento('{"id":"00000000-0000-0000-0000-000000000001","macho_id":"00000000-0000-0000-0000-000000000002","nuevo":true,"clase":"M2"}');
  raise exception 'FALLA: invitado registró';
exception when insufficient_privilege then raise notice 'ok - invitado no puede registrar avistamientos';
end $$;

-- Staff (…0b) registra un ejemplar nuevo con foto
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.registrar_avistamiento(jsonb_build_object(
  'id', :'a1', 'macho_id', :'m1', 'nuevo', true, 'apodo', 'El Chueco', 'clase', 'M3',
  'espiadero_id', :'e1', 'observado_at', now() - interval '3 days', 'lon', -100.07, 'lat', 27.06,
  'rasgos', jsonb_build_object('puntas_izq', 5, 'puntas_der', 4, 'forma', 'abierta', 'cuerno_roto', 'derecho', 'oreja_marcada', true),
  'foto', jsonb_build_object('id', :'f1', 'storage_path', 'machos/' || :'m1' || '/' || :'f1' || '.jpg', 'tomada_at', now() - interval '3 days')
)) as r \gset
select pg_temp.afirmar((:'r'::jsonb ->> 'folio') ~ '^LL-\d{3}$', 'folio automático ' || (:'r'::jsonb ->> 'folio'));
select pg_temp.afirmar((select estado = 'por_validar' and puntas_izq = 5 and cuerno_roto = 'derecho' from public.machos where id = :'m1'), 'nace por validar con sus rasgos');
select pg_temp.afirmar((select foto_portada_id = :'f1' and ultimo_espiadero_id = :'e1' from public.machos where id = :'m1'), 'portada y último espiadero calculados');

-- Reintento de la cola: no duplica
select public.registrar_avistamiento(jsonb_build_object('id', :'a1', 'macho_id', :'m1', 'nuevo', true, 'clase', 'M3')) \gset
select pg_temp.afirmar((select count(*) = 1 from public.machos) and (select count(*) = 1 from public.avistamientos) and (select count(*) = 1 from public.fotos), 'reintento no duplica ejemplar, avistamiento ni foto');

-- Segundo avistamiento del mismo ejemplar, más reciente y en otro espiadero
select public.registrar_avistamiento(jsonb_build_object('id', :'a2', 'macho_id', :'m1', 'clase', 'M3', 'espiadero_id', :'e2', 'observado_at', now())) \gset
select pg_temp.afirmar((select ultimo_espiadero_id = :'e2' from public.machos where id = :'m1'), 'último avistamiento actualiza el espiadero');
select pg_temp.afirmar((select num_avistamientos = 2 and estado_efectivo = 'por_validar' from public.v_machos where id = :'m1'), 'vista con 2 avistamientos');

-- Staff no puede validar; admin sí
do $$ begin
  perform public.actualizar_macho((select id from public.machos limit 1), '{"estado":"activo"}');
  raise exception 'FALLA: staff validó';
exception when insufficient_privilege then raise notice 'ok - staff no puede validar';
end $$;
select public.actualizar_macho(:'m1', '{"apodo":"Chueco","clase":"M4","puntas_izq":6}') \gset
select pg_temp.afirmar((select apodo = 'Chueco' and clase_actual = 'M4' and puntas_izq = 6 from public.machos where id = :'m1'), 'staff edita apodo, clase y rasgos');
select pg_temp.afirmar((select count(*) = 2 from public.historial_clase where macho_id = :'m1'), 'cambio de clase queda en el historial');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.actualizar_macho(:'m1', '{"estado":"activo"}') \gset
select pg_temp.afirmar((select estado = 'activo' and validado_at is not null from public.machos where id = :'m1'), 'admin valida el ejemplar');

-- Duplicado y fusión
select public.registrar_avistamiento(jsonb_build_object('id', :'a3', 'macho_id', :'m2', 'nuevo', true, 'clase', 'M4', 'espiadero_id', :'e1',
  'observado_at', now() - interval '1 hour', 'rasgos', jsonb_build_object('cicatrices', true))) \gset
select public.fusionar_machos(:'m2', :'m1') \gset
select pg_temp.afirmar((select count(*) = 3 from public.avistamientos where macho_id = :'m1'), 'fusión mueve los avistamientos al destino');
select pg_temp.afirmar((select estado = 'fusionado' and fusionado_en = :'m1' from public.machos where id = :'m2'), 'el duplicado queda fusionado');
select pg_temp.afirmar((select cicatrices from public.machos where id = :'m1'), 'el destino hereda rasgos que no tenía');
-- Avistamiento enviado tarde al ejemplar fusionado se redirige
select public.registrar_avistamiento(jsonb_build_object('id', gen_random_uuid(), 'macho_id', :'m2', 'clase', 'M4', 'observado_at', now())) as r \gset
select pg_temp.afirmar((:'r'::jsonb ->> 'macho_id') = :'m1', 'avistamiento tardío de un fusionado va al destino');

-- Últimos avistamientos por espiadero (hoja del mapa)
select pg_temp.afirmar((select count(*) >= 1 from public.ultimos_avistamientos(:'e1')), 'últimos avistamientos por espiadero');

-- Sin ver en 60 días
reset role;
update public.avistamientos set observado_at = now() - interval '70 days' where macho_id = :'m1';
select public.actualizar_resumen_macho(:'m1') \gset
set role authenticated;
select pg_temp.afirmar((select estado_efectivo = 'sin_ver' from public.v_machos where id = :'m1'), 'activo sin ver en 60 días → sin_ver');

-- Cazado (solo admin)
select public.actualizar_macho(:'m1', '{"estado":"cazado"}') \gset
select pg_temp.afirmar((select estado = 'cazado' and cazado_at is not null from public.machos where id = :'m1'), 'admin marca cazado');

-- Invitado no ve nada
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select pg_temp.afirmar((select count(*) = 0 from public.machos) and (select count(*) = 0 from public.avistamientos) and (select count(*) = 0 from public.fotos), 'invitado no ve la bitácora');
select pg_temp.afirmar((select count(*) = 0 from public.ultimos_avistamientos(:'e1')), 'invitado no ve avistamientos en el mapa');
reset role;
\echo 'TODAS LAS PRUEBAS DE LA FASE C PASARON'
