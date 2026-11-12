-- =============================================================================
-- Rancho Las Lomas · Fase (d): distancias y lugares de referencia
-- =============================================================================
-- * Lugares: puntos del KML que no son espiaderos (por ejemplo, la Casa).
--   Se ven en el mapa y sirven para medir distancias; no participan en censos.
-- * avistamientos_recientes: puntos de avistamientos para el mapa (solo personal).

create table public.lugares (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null check (length(trim(nombre)) between 1 and 60),
  tipo         text not null default 'referencia' check (tipo in ('casa', 'referencia')),
  geom         extensions.geography(Point, 4326) not null,
  altitud_m    numeric(7, 1),
  creado_at    timestamptz not null default now(),
  archivado_at timestamptz
);
alter table public.lugares enable row level security;
create policy lugares_leer on public.lugares for select to authenticated using (public.mi_rol() is not null);

-- Importación: ahora también recibe "lugares": [{nombre, tipo, lon, lat, altitud}]
create or replace function public.importar_kml(p_datos jsonb, p_aplicar boolean default false, p_archivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actualizar jsonb;
  v_crear      jsonb;
  v_archivar   jsonb;
  v_resumen    jsonb;
  v_nuevos     int := jsonb_array_length(coalesce(p_datos -> 'espiaderos', '[]'));
  -- "origen": "prueba" marca los datos ficticios (los archivará la importación real).
  v_origen     public.origen_espiadero := case when p_datos ->> 'origen' = 'prueba' then 'prueba' else 'kml' end;
begin
  if not (public.es_admin() or public.es_servicio()) then
    raise exception 'Solo el administrador puede importar KML' using errcode = '42501';
  end if;
  if jsonb_array_length(coalesce(p_datos -> 'linderos', '[]')) = 0 then
    raise exception 'El KML no trae lindero (polígono). No se importó nada.';
  end if;
  if v_nuevos = 0 then
    raise exception 'El KML no trae espiaderos (puntos). No se importó nada.';
  end if;
  if (select count(*) from jsonb_array_elements(p_datos -> 'espiaderos') e)
     <> (select count(distinct public.normalizar_nombre(e ->> 'nombre')) from jsonb_array_elements(p_datos -> 'espiaderos') e) then
    raise exception 'Hay espiaderos con nombre repetido en el KML. Corrige los nombres y vuelve a intentar.';
  end if;

  drop table if exists _kml_esp;
  create temp table _kml_esp on commit drop as
  select e ->> 'nombre' as nombre,
         public.normalizar_nombre(e ->> 'nombre') as clave,
         st_setsrid(st_makepoint((e ->> 'lon')::float8, (e ->> 'lat')::float8), 4326)::geography as geom,
         nullif(e ->> 'altitud', '')::numeric as altitud
  from jsonb_array_elements(p_datos -> 'espiaderos') e;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id, 'nombre', k.nombre, 'nombre_anterior', x.nombre,
           'movido_m', round(st_distance(x.geom, k.geom)::numeric, 0)) order by k.nombre), '[]')
    into v_actualizar
  from _kml_esp k
  join public.espiaderos x on x.archivado_at is null and public.normalizar_nombre(x.nombre) = k.clave;

  select coalesce(jsonb_agg(k.nombre order by k.nombre), '[]') into v_crear
  from _kml_esp k
  where not exists (select 1 from public.espiaderos x
                    where x.archivado_at is null and public.normalizar_nombre(x.nombre) = k.clave);

  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'nombre', x.nombre, 'origen', x.origen) order by x.nombre), '[]')
    into v_archivar
  from public.espiaderos x
  where x.archivado_at is null
    and not exists (select 1 from _kml_esp k where k.clave = public.normalizar_nombre(x.nombre));

  v_resumen := jsonb_build_object(
    'espiaderos', jsonb_build_object('actualizar', v_actualizar, 'crear', v_crear, 'archivar', v_archivar),
    'linderos', jsonb_build_object(
      'nuevos', jsonb_array_length(p_datos -> 'linderos'),
      'archivar', (select count(*) from public.linderos where archivado_at is null)),
    'caminos', jsonb_build_object(
      'nuevos', jsonb_array_length(coalesce(p_datos -> 'caminos', '[]')),
      'archivar', (select count(*) from public.caminos where archivado_at is null)),
    'lugares', jsonb_build_object(
      'nuevos', jsonb_array_length(coalesce(p_datos -> 'lugares', '[]')),
      'nombres', coalesce((select jsonb_agg(l ->> 'nombre') from jsonb_array_elements(coalesce(p_datos -> 'lugares', '[]')) l), '[]'),
      'archivar', (select count(*) from public.lugares where archivado_at is null)),
    'aplicado', p_aplicar
  );

  if not p_aplicar then
    return v_resumen;
  end if;

  -- Archivar primero para liberar los nombres en el índice único.
  update public.espiaderos x set archivado_at = now()
  where x.archivado_at is null
    and not exists (select 1 from _kml_esp k where k.clave = public.normalizar_nombre(x.nombre));

  update public.espiaderos x
     set geom = k.geom, altitud_m = coalesce(k.altitud, x.altitud_m), nombre = k.nombre,
         origen = v_origen, actualizado_at = now()
  from _kml_esp k
  where x.archivado_at is null and public.normalizar_nombre(x.nombre) = k.clave;

  insert into public.espiaderos (nombre, geom, altitud_m, origen)
  select k.nombre, k.geom, k.altitud, v_origen
  from _kml_esp k
  where not exists (select 1 from public.espiaderos x
                    where x.archivado_at is null and public.normalizar_nombre(x.nombre) = k.clave);

  update public.linderos set archivado_at = now() where archivado_at is null;
  insert into public.linderos (nombre, geom)
  select coalesce(nullif(l ->> 'nombre', ''), 'Lindero'),
         st_multi(st_makevalid(st_setsrid(st_geomfromgeojson(jsonb_build_object(
           'type', 'Polygon', 'coordinates', l -> 'coordenadas')::text), 4326)))::geography
  from jsonb_array_elements(p_datos -> 'linderos') l;

  update public.caminos set archivado_at = now() where archivado_at is null;
  insert into public.caminos (nombre, geom)
  select coalesce(nullif(c ->> 'nombre', ''), 'Camino'),
         st_setsrid(st_geomfromgeojson(jsonb_build_object(
           'type', 'LineString', 'coordinates', c -> 'coordenadas')::text), 4326)::geography
  from jsonb_array_elements(coalesce(p_datos -> 'caminos', '[]')) c;

  update public.lugares set archivado_at = now() where archivado_at is null;
  insert into public.lugares (nombre, tipo, geom, altitud_m)
  select l ->> 'nombre', coalesce(nullif(l ->> 'tipo', ''), 'referencia'),
         st_setsrid(st_makepoint((l ->> 'lon')::float8, (l ->> 'lat')::float8), 4326)::geography,
         nullif(l ->> 'altitud', '')::numeric
  from jsonb_array_elements(coalesce(p_datos -> 'lugares', '[]')) l;

  insert into public.importaciones_kml (archivo, resumen, realizada_por)
  values (p_archivo, v_resumen, auth.uid());

  return v_resumen;
end;
$$;


-- El mapa incluye los lugares.
create or replace function public.mapa_lugares()
returns jsonb
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', l.id, 'nombre', l.nombre, 'tipo', l.tipo, 'altitud_m', l.altitud_m,
           'lon', st_x(l.geom::geometry), 'lat', st_y(l.geom::geometry)) order by l.nombre), '[]')
  from public.lugares l where l.archivado_at is null;
$$;

create or replace function public.mapa_actual_v2()
returns jsonb
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select public.mapa_actual() || jsonb_build_object('lugares', public.mapa_lugares());
$$;

-- Avistamientos recientes con su ubicación (o la de su espiadero), para el mapa.
create or replace function public.avistamientos_recientes(p_dias int default 30)
returns table (id uuid, macho_id uuid, folio text, apodo text, clase text, observado_at timestamptz, lon float8, lat float8)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select a.id, m.id, m.folio, m.apodo, coalesce(a.clase_observada, m.clase_actual)::text, a.observado_at,
         st_x(coalesce(a.ubicacion, e.geom)::geometry), st_y(coalesce(a.ubicacion, e.geom)::geometry)
  from public.avistamientos a
  join public.machos m on m.id = a.macho_id and m.estado <> 'fusionado'
  left join public.espiaderos e on e.id = a.espiadero_id
  where a.observado_at > now() - make_interval(days => least(greatest(coalesce(p_dias, 30), 1), 365))
    and coalesce(a.ubicacion, e.geom) is not null
  order by a.observado_at desc
  limit 300;
$$;

revoke execute on function public.avistamientos_recientes(int) from public, anon;
grant execute on function public.avistamientos_recientes(int) to authenticated;
revoke execute on function public.mapa_actual_v2() from public, anon;
grant execute on function public.mapa_actual_v2() to authenticated;
