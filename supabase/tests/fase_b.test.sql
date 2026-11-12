-- Pruebas de la fase (b): censo. Se corre después de fase_a.test.sql (ver scripts/probar-db.sh).
\set ON_ERROR_STOP 1
\set QUIET 1

create or replace function pg_temp.afirmar(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- Escenario: admin (…0a), staff (…0b), un invitado nuevo (…d1)
reset role;
delete from public.intentos_canje;
insert into auth.users (id, is_anonymous) values ('00000000-0000-0000-0000-0000000000d1', true);
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select codigo as cod from public.generar_codigo(24) \gset
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select public.canjear_codigo(:'cod', 'Invitado Censo') \gset

-- Espiaderos vigentes (tras la fase a quedan 3)
reset role;
select array_agg(id order by nombre) as esp from public.espiaderos where archivado_at is null \gset
select (array_agg(id order by nombre))[1] as e1, (array_agg(id order by nombre))[2] as e2, (array_agg(id order by nombre))[3] as e3
  from public.espiaderos where archivado_at is null \gset
set role authenticated;

-- Staff no puede crear
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  perform public.crear_censo('X', 20, '{}'::uuid[]);
  raise exception 'FALLA: staff creó censo';
exception when insufficient_privilege then raise notice 'ok - staff no puede crear censos';
end $$;

-- Admin crea con 2 de 3 espiaderos y asigna al invitado al primero
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select id as censo from public.crear_censo('Censo de prueba', 20, array[:'e1', :'e2']::uuid[],
  jsonb_build_object(:'e1', '00000000-0000-0000-0000-0000000000d1')) \gset
select pg_temp.afirmar((select count(*) = 2 from public.censo_espiaderos where censo_id = :'censo'), 'censo con 2 espiaderos participantes');
select pg_temp.afirmar((select estado = 'borrador' and inicio_at is null from public.censos where id = :'censo'), 'nace en borrador sin horario');

-- Antes de iniciar no se aceptan registros
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select public.registrar_lote(jsonb_build_array(jsonb_build_object('op','registrar','id',gen_random_uuid(),'censo_id',:'censo','espiadero_id',:'e1','clase','M1','capturado_at',now()))) as r \gset
select pg_temp.afirmar(jsonb_array_length(:'r'::jsonb -> 'rechazados') = 1, 'sin iniciar: registro rechazado');

-- Iniciar: el servidor fija el horario
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select inicio_at as ini, fin_at as fin from public.iniciar_censo(:'censo') \gset
select pg_temp.afirmar(:'fin'::timestamptz - :'ini'::timestamptz = interval '20 minutes', 'fin = inicio + 20 min (hora del servidor)');
do $$ begin
  perform public.iniciar_censo((select id from public.censos where estado = 'en_curso'));
  raise exception 'FALLA: se inició dos veces';
exception when others then
  if sqlerrm like 'FALLA%' then raise; end if;
  raise notice 'ok - no se puede iniciar un censo ya iniciado';
end $$;
select codigo as cod2 from public.generar_codigo(1) \gset
select id as censo2 from public.crear_censo('Otro', 10, array[:'e3']::uuid[]) \gset
do $$ begin
  perform public.iniciar_censo((select id from public.censos where nombre = 'Otro'));
  raise exception 'FALLA: dos censos en curso';
exception when others then
  if sqlerrm like 'FALLA%' then raise; end if;
  raise notice 'ok - solo un censo en curso a la vez';
end $$;

-- censo_actual para el invitado
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select public.censo_actual() as ca \gset
select pg_temp.afirmar((:'ca'::jsonb #>> '{censo,id}') = :'censo', 'censo_actual devuelve el censo en curso');
select pg_temp.afirmar(jsonb_array_length(:'ca'::jsonb -> 'espiaderos') = 2, 'con sus 2 espiaderos');
select pg_temp.afirmar((select bool_or(x ->> 'asignado_nombre' = 'Invitado Censo') from jsonb_array_elements(:'ca'::jsonb -> 'espiaderos') x), 'y la asignación con nombre');

-- Registrar: válidos, reintento, fuera de horario, espiadero ajeno
select gen_random_uuid() as r1, gen_random_uuid() as r2, gen_random_uuid() as r3, gen_random_uuid() as r4, gen_random_uuid() as r5 \gset
select public.registrar_lote(jsonb_build_array(
  jsonb_build_object('op','registrar','id',:'r1','censo_id',:'censo','espiadero_id',:'e1','clase','M3','capturado_at',now(),'lon',-100.07,'lat',27.06,'precision_m',8),
  jsonb_build_object('op','registrar','id',:'r2','censo_id',:'censo','espiadero_id',:'e1','clase','hembra','capturado_at',now()),
  jsonb_build_object('op','registrar','id',:'r3','censo_id',:'censo','espiadero_id',:'e1','clase','cria','capturado_at',now()),
  jsonb_build_object('op','registrar','id',:'r4','censo_id',:'censo','espiadero_id',:'e3','clase','M1','capturado_at',now()),
  jsonb_build_object('op','registrar','id',:'r5','censo_id',:'censo','espiadero_id',:'e1','clase','M1','capturado_at',now() - interval '1 hour')
)) as r \gset
select pg_temp.afirmar(jsonb_array_length(:'r'::jsonb -> 'aceptados') = 3, '3 registros válidos aceptados');
select pg_temp.afirmar((:'r'::jsonb -> 'rechazados') @> '[{"motivo":"espiadero no participa"},{"motivo":"fuera del horario del censo"}]', 'rechaza espiadero ajeno y hora fuera del censo');
select public.registrar_lote(jsonb_build_array(jsonb_build_object('op','registrar','id',:'r1','censo_id',:'censo','espiadero_id',:'e1','clase','M3','capturado_at',now()))) as r \gset
select pg_temp.afirmar((select count(*) = 3 from public.registros_censo where censo_id = :'censo'), 'reintento de la cola no duplica');
select public.registrar_lote(jsonb_build_array(jsonb_build_object('op','registrar','id',gen_random_uuid(),'censo_id',:'censo','espiadero_id',:'e1','clase','M1','capturado_at',now() + interval '10 minutes'))) as r \gset
select pg_temp.afirmar((:'r'::jsonb -> 'rechazados') @> '[{"motivo":"hora del teléfono adelantada"}]', 'rechaza hora del teléfono adelantada');

-- Deshacer el último (cría)
select public.registrar_lote(jsonb_build_array(jsonb_build_object('op','anular','id',:'r3'))) \gset
select pg_temp.afirmar((select anulado_at is not null from public.registros_censo where id = :'r3'), 'deshacer marca el registro como anulado');

-- Staff no puede anular registros ajenos
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.registrar_lote(jsonb_build_array(jsonb_build_object('op','anular','id',:'r2'))) \gset
select pg_temp.afirmar((select anulado_at is null from public.registros_censo where id = :'r2'), 'no se pueden anular registros de otra persona');
select public.registrar_lote(jsonb_build_array(jsonb_build_object('op','registrar','id',gen_random_uuid(),'censo_id',:'censo','espiadero_id',:'e2','clase','M2','capturado_at',now()))) \gset
select pg_temp.afirmar((select count(*) = 4 from public.registros_censo where censo_id = :'censo'), 'staff ve todos los registros (4)');

-- Lo que ve el invitado
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select pg_temp.afirmar((select count(*) = 3 from public.registros_censo), 'invitado solo ve sus 3 registros');
select public.resumen_censo(:'censo') as res \gset
select pg_temp.afirmar((:'res'::jsonb -> 'por_espiadero') = 'null'::jsonb and (:'res'::jsonb -> 'totales') = 'null'::jsonb, 'invitado no ve desglose por espiadero ni totales durante el censo');
select pg_temp.afirmar((:'res'::jsonb #>> '{mis_totales,M3}')::int = 1 and (:'res'::jsonb #>> '{mis_totales,cria}')::int = 0, 'invitado ve sus propios totales (sin el anulado)');

-- Monitor del admin
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.resumen_censo(:'censo') as res \gset
select pg_temp.afirmar((:'res'::jsonb #>> '{totales,M3}')::int = 1 and (:'res'::jsonb #>> '{totales,M2}')::int = 1 and (:'res'::jsonb #>> '{totales,hembra}')::int = 1, 'admin ve totales por clase');
select pg_temp.afirmar(jsonb_array_length(:'res'::jsonb -> 'por_espiadero') = 2, 'admin ve el desglose de los 2 espiaderos');
select pg_temp.afirmar((select (x ->> 'total')::int = 2 from jsonb_array_elements(:'res'::jsonb -> 'por_espiadero') x where x ->> 'espiadero_id' = :'e1'), 'espiadero 1 con 2 registros vigentes');

-- Terminar antes de tiempo; registro tardío dentro de la ventana sí entra, después no
select fin_at as fin2 from public.terminar_censo(:'censo') \gset
select pg_temp.afirmar(:'fin2'::timestamptz < :'fin'::timestamptz, 'terminar antes de tiempo recorta el fin');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select public.registrar_lote(jsonb_build_array(
  jsonb_build_object('op','registrar','id',gen_random_uuid(),'censo_id',:'censo','espiadero_id',:'e1','clase','M4','capturado_at', :'ini'::timestamptz + (:'fin2'::timestamptz - :'ini'::timestamptz) / 2),
  jsonb_build_object('op','registrar','id',gen_random_uuid(),'censo_id',:'censo','espiadero_id',:'e1','clase','M4','capturado_at', :'fin2'::timestamptz + interval '30 seconds')
)) as r \gset
select pg_temp.afirmar(jsonb_array_length(:'r'::jsonb -> 'aceptados') = 1 and jsonb_array_length(:'r'::jsonb -> 'rechazados') = 1, 'registro tardío: entra si su hora cae dentro del censo, no si es posterior');
select pg_temp.afirmar((public.censo_actual() -> 'censo') = 'null'::jsonb, 'ya no hay censo en curso');
select public.resumen_censo(:'censo') as res \gset
select pg_temp.afirmar((:'res'::jsonb #>> '{totales,M4}')::int = 1 and (:'res'::jsonb -> 'por_espiadero') = 'null'::jsonb, 'cerrado: invitado ve totales por clase, sin desglose');

-- Censo que vence solo
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.iniciar_censo(:'censo2') \gset
reset role;
update public.censos set fin_at = now() - interval '1 second', inicio_at = now() - interval '11 minutes' where id = :'censo2';
set role authenticated;
select pg_temp.afirmar((public.censo_actual() -> 'censo') = 'null'::jsonb, 'un censo vencido se cierra solo');
select pg_temp.afirmar((select estado = 'cerrado' from public.censos where id = :'censo2'), 'y queda en estado cerrado');

-- Suscripciones de avisos
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select public.guardar_suscripcion('https://push.example/abc', 'p', 'a', 'iPhone') \gset
select public.guardar_suscripcion('https://push.example/abc', 'p2', 'a2', 'iPhone') \gset
select pg_temp.afirmar((select count(*) = 1 and min(p256dh) = 'p2' from public.suscripciones_push), 'suscripción: una por dispositivo, se actualiza');
reset role;
\echo 'TODAS LAS PRUEBAS DE LA FASE B PASARON'
