-- Clase M5: se acepta en la bitácora y aparece en los resúmenes del censo.
alter table public.machos drop constraint if exists machos_clase_actual_check;
alter table public.machos add constraint machos_clase_actual_check check (clase_actual in ('M1', 'M2', 'M3', 'M4', 'M5'));
alter table public.avistamientos drop constraint if exists avistamientos_clase_observada_check;
alter table public.avistamientos add constraint avistamientos_clase_observada_check check (clase_observada in ('M1', 'M2', 'M3', 'M4', 'M5'));

create or replace function public.resumen_censo(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.censos;
  clases jsonb := '{"M1":0,"M2":0,"M3":0,"M4":0,"M5":0,"hembra":0,"cria":0}';
begin
  if public.mi_rol() is null then raise exception 'Sin acceso' using errcode = '42501'; end if;
  perform public.cerrar_censos_vencidos();
  select * into c from public.censos where id = p_id;
  if c.id is null then raise exception 'Censo no encontrado'; end if;

  return jsonb_build_object(
    'censo', to_jsonb(c),
    'hora_servidor', now(),
    'mis_totales', clases || coalesce((
      select jsonb_object_agg(clase, n) from (
        select clase, count(*) n from public.registros_censo
        where censo_id = p_id and perfil_id = auth.uid() and anulado_at is null group by clase) t), '{}'),
    'totales', case when public.es_staff() or c.estado = 'cerrado' then clases || coalesce((
      select jsonb_object_agg(clase, n) from (
        select clase, count(*) n from public.registros_censo
        where censo_id = p_id and anulado_at is null group by clase) t), '{}') end,
    'por_espiadero', case when public.es_staff() then (
      select coalesce(jsonb_agg(jsonb_build_object(
               'espiadero_id', e.id, 'nombre', e.nombre, 'asignado_nombre', pa.nombre,
               'clases', clases || coalesce((
                  select jsonb_object_agg(clase, n) from (
                    select clase, count(*) n from public.registros_censo r
                    where r.censo_id = p_id and r.espiadero_id = e.id and r.anulado_at is null group by clase) t), '{}'),
               'total', (select count(*) from public.registros_censo r
                         where r.censo_id = p_id and r.espiadero_id = e.id and r.anulado_at is null),
               'ultimo_at', (select max(capturado_at) from public.registros_censo r
                             where r.censo_id = p_id and r.espiadero_id = e.id),
               'personas', (select coalesce(jsonb_agg(distinct p.nombre), '[]') from public.registros_censo r
                            join public.perfiles p on p.id = r.perfil_id
                            where r.censo_id = p_id and r.espiadero_id = e.id)
             ) order by e.nombre), '[]')
      from public.censo_espiaderos ce
      join public.espiaderos e on e.id = ce.espiadero_id
      left join public.perfiles pa on pa.id = ce.asignado_a
      where ce.censo_id = p_id) end
  );
end;
$$;

