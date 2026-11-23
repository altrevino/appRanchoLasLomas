-- Pruebas de mediciones de trofeo (solo admin). Se corre al final.
\set ON_ERROR_STOP 1
\set QUIET 1
create or replace function pg_temp.afirmar(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.mediciones (cazado_at, cazador, arma, abertura, medidas, bruta)
values (now(), 'Cliente Prueba', 'rifle', 148, '{"viga":{"d":184,"i":180},"g":[],"h":[],"ap":[]}', 1200);
select pg_temp.afirmar((select folio >= 1 and creado_por = '00000000-0000-0000-0000-00000000000a' from public.mediciones limit 1), 'el admin guarda una medición con folio');

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.afirmar((select count(*) = 0 from public.mediciones), 'el personal no ve las mediciones');
do $$ begin
  insert into public.mediciones (cazado_at, medidas) values (now(), '{}');
  raise exception 'FALLA: staff guardó medición';
exception when insufficient_privilege then raise notice 'ok - el personal no puede guardar mediciones';
end $$;
update public.mediciones set cazador = 'x';
reset role;
select pg_temp.afirmar((select cazador = 'Cliente Prueba' from public.mediciones limit 1), 'el personal no puede modificar mediciones');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
delete from public.mediciones;
select pg_temp.afirmar((select count(*) = 0 from public.mediciones), 'el admin puede borrar');
reset role;
\echo 'TODAS LAS PRUEBAS DE MEDICIONES PASARON'
