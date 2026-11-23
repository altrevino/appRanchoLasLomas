-- Pruebas: bitácora para invitados con revisión del admin. Se corre al final.
\set ON_ERROR_STOP 1
\set QUIET 1
create or replace function pg_temp.afirmar(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- Tres invitados nuevos: sin permiso (g0), lectura (g1), escritura (g2)
reset role;
delete from public.intentos_canje;
insert into auth.users (id, is_anonymous) values
  ('00000000-0000-0000-0000-0000000000e0', true), ('00000000-0000-0000-0000-0000000000e1', true), ('00000000-0000-0000-0000-0000000000e2', true);
select (array_agg(id order by nombre))[1] as e1 from public.espiaderos where archivado_at is null \gset
select gen_random_uuid() as ap, gen_random_uuid() as m_ap, gen_random_uuid() as an, gen_random_uuid() as m_nuevo,
       gen_random_uuid() as a_viejo, gen_random_uuid() as a_rech, gen_random_uuid() as m_rech, gen_random_uuid() as f_rech \gset
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select codigo as c0 from public.generar_codigo(24) \gset
select codigo as c1 from public.generar_codigo(24, null, null, 'lectura') \gset
select codigo as c2 from public.generar_codigo(24, null, null, 'escritura') \gset
select pg_temp.afirmar((select bitacora = 'escritura' from public.codigos_invitado where codigo = :'c2' and revocado_at is null), 'el código guarda el permiso de bitácora');

-- Un ejemplar aprobado del personal (…0b)
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.registrar_avistamiento(jsonb_build_object('id', :'ap', 'macho_id', :'m_ap', 'nuevo', true, 'clase', 'M3', 'espiadero_id', :'e1', 'observado_at', now() - interval '10 days')) \gset
select pg_temp.afirmar((select aprobado from public.machos where id = :'m_ap'), 'lo del personal entra aprobado');

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e0';
select public.canjear_codigo(:'c0', 'Sin permiso') \gset
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select public.canjear_codigo(:'c1', 'Lector') \gset
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
select public.canjear_codigo(:'c2', 'Escritor') \gset
select pg_temp.afirmar((select bitacora = 'escritura' from public.perfiles where id = auth.uid()), 'el invitado hereda el permiso del código');

-- Sin permiso: no ve nada
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e0';
select pg_temp.afirmar((select count(*) = 0 from public.machos where id = :'m_ap'), 'invitado sin permiso no ve la bitácora');
-- Lectura: ve lo aprobado, no puede registrar
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select pg_temp.afirmar((select count(*) = 1 from public.machos where id = :'m_ap') and (select count(*) = 1 from public.avistamientos where id = :'ap'), 'invitado de lectura ve lo aprobado');
select pg_temp.afirmar((select count(*) = 0 from public.machos_trofeo), 'invitado no ve datos de trofeo');
do $$ begin
  perform public.registrar_avistamiento('{"id":"00000000-0000-0000-0000-000000000011","macho_id":"00000000-0000-0000-0000-000000000012","nuevo":true,"clase":"M2"}');
  raise exception 'FALLA: el lector registró';
exception when insufficient_privilege then raise notice 'ok - invitado de lectura no puede registrar';
end $$;
do $$ begin
  perform public.actualizar_macho((select id from public.machos limit 1), '{"apodo":"X"}');
  raise exception 'FALLA: invitado editó';
exception when insufficient_privilege then raise notice 'ok - invitado no puede editar fichas';
end $$;

-- Escritura: registra ejemplar nuevo y avistamiento de uno existente → pendientes
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
select public.registrar_avistamiento(jsonb_build_object('id', :'an', 'macho_id', :'m_nuevo', 'nuevo', true, 'clase', 'M4', 'apodo', 'Del invitado', 'espiadero_id', :'e1', 'observado_at', now(),
  'foto', jsonb_build_object('id', gen_random_uuid(), 'storage_path', 'machos/' || :'m_nuevo' || '/x.jpg', 'tomada_at', now()))) as r \gset
select pg_temp.afirmar((:'r'::jsonb ->> 'pendiente')::boolean, 'lo del invitado queda pendiente');
select public.registrar_avistamiento(jsonb_build_object('id', :'a_viejo', 'macho_id', :'m_ap', 'clase', 'M3', 'espiadero_id', :'e1', 'observado_at', now())) \gset
select pg_temp.afirmar((select count(*) = 1 from public.machos where id = :'m_nuevo') and (select count(*) = 2 from public.avistamientos where macho_id = :'m_ap'), 'el autor ve sus aportes pendientes');
select pg_temp.afirmar((select not aprobado from public.v_machos where id = :'m_nuevo'), 'la vista de la lista incluye la marca de aprobado');
select pg_temp.afirmar((select ultimo_avistamiento_at < now() - interval '9 days' from public.machos where id = :'m_ap'), 'lo pendiente no cambia el «último visto»');
reset role;
update public.machos set aprobado = false where id = '00000000-0000-0000-0000-0000000000f5';
set role authenticated;
do $$ begin
  perform public.registrar_avistamiento(jsonb_build_object('id', gen_random_uuid(), 'macho_id', '00000000-0000-0000-0000-0000000000f5', 'clase', 'M5'));
  raise exception 'FALLA: invitado sumó a un ejemplar ajeno no aprobado';
exception when others then
  if sqlerrm like 'FALLA%' then raise; end if;
  raise notice 'ok - invitado no puede sumar a ejemplares pendientes ajenos';
end $$;

-- Otros (personal y lector) no ven lo pendiente
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.afirmar((select count(*) = 0 from public.machos where id = :'m_nuevo') and (select count(*) = 1 from public.avistamientos where macho_id = :'m_ap'), 'el personal no ve aportes pendientes');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select pg_temp.afirmar((select count(*) = 0 from public.machos where id = :'m_nuevo') and (select count(*) = 0 from public.fotos where macho_id = :'m_nuevo'), 'otro invitado no ve aportes pendientes');

-- Admin revisa
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.afirmar(jsonb_array_length(public.aportes_pendientes()) = 2, 'el admin ve 2 aportes por revisar');
select public.revisar_aporte(:'an', true) \gset
select public.revisar_aporte(:'a_viejo', true) \gset
select pg_temp.afirmar((select aprobado and estado = 'activo' and foto_portada_id is not null from public.machos where id = :'m_nuevo'), 'aprobar: ejemplar nuevo activo y con foto principal');
select pg_temp.afirmar((select ultimo_avistamiento_at > now() - interval '1 minute' from public.machos where id = :'m_ap'), 'aprobar: actualiza el «último visto»');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select pg_temp.afirmar((select count(*) = 1 from public.machos where id = :'m_nuevo') and (select count(*) = 1 from public.fotos where macho_id = :'m_nuevo'), 'aprobado: ya lo ven los demás');

-- Rechazo de un ejemplar nuevo con foto
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
select public.registrar_avistamiento(jsonb_build_object('id', :'a_rech', 'macho_id', :'m_rech', 'nuevo', true, 'clase', 'M1', 'observado_at', now(),
  'foto', jsonb_build_object('id', :'f_rech', 'storage_path', 'machos/' || :'m_rech' || '/r.jpg', 'tomada_at', now()))) \gset
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.revisar_aporte(:'a_rech', false) as r \gset
select pg_temp.afirmar((:'r'::jsonb -> 'rutas') = jsonb_build_array('machos/' || :'m_rech' || '/r.jpg'), 'rechazar devuelve la foto a borrar');
select pg_temp.afirmar(not exists (select 1 from public.machos where id = :'m_rech') and not exists (select 1 from public.fotos where id = :'f_rech'), 'rechazar elimina el ejemplar nuevo y su foto');

-- Cambiar permiso por persona
select public.permiso_bitacora_invitado('00000000-0000-0000-0000-0000000000e2', 'ninguno') \gset
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
select pg_temp.afirmar((select count(*) = 0 from public.machos), 'al quitarle el permiso deja de ver la bitácora');
reset role;
\echo 'TODAS LAS PRUEBAS DE BITÁCORA PARA INVITADOS PASARON'
