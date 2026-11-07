-- =============================================================================
-- Rancho Las Lomas · Fase (a): perfiles, códigos de invitado, mapa e importación KML
-- =============================================================================
-- Convenciones:
--   * Geometrías en geography(…, 4326): distancias y radios en metros.
--   * Toda escritura sensible pasa por funciones RPC que validan el rol adentro.
--   * RLS activo en todas las tablas.

create extension if not exists postgis with schema extensions;

-- -----------------------------------------------------------------------------
-- Tipos y utilidades
-- -----------------------------------------------------------------------------
create type public.rol_usuario as enum ('admin', 'staff', 'invitado');
create type public.origen_espiadero as enum ('prueba', 'kml', 'manual');

-- Nombre comparable: minúsculas, sin acentos, sin espacios repetidos.
-- "Espiadero La Noria " y "espiadero la noría" se consideran el mismo.
create or replace function public.normalizar_nombre(t text)
returns text
language sql
immutable
parallel safe
as $$
  select regexp_replace(
    lower(translate(trim(coalesce(t, '')), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')),
    '\s+', ' ', 'g'
  );
$$;

-- -----------------------------------------------------------------------------
-- Perfiles y roles
-- -----------------------------------------------------------------------------
create table public.codigos_invitado (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null check (codigo ~ '^[0-9]{6}$'),
  vigente_hasta timestamptz not null,
  usos_max      int check (usos_max is null or usos_max > 0),
  usos          int not null default 0,
  nota          text,
  creado_por    uuid references auth.users (id) on delete set null,
  creado_at     timestamptz not null default now(),
  revocado_at   timestamptz
);
create index codigos_invitado_codigo_idx on public.codigos_invitado (codigo) where revocado_at is null;

create table public.perfiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nombre     text not null check (length(trim(nombre)) between 1 and 60),
  rol        public.rol_usuario not null,
  codigo_id  uuid references public.codigos_invitado (id) on delete set null,
  expira_en  timestamptz,
  activo     boolean not null default true,
  creado_at  timestamptz not null default now()
);

-- Intentos de canje (para limitar fuerza bruta sobre códigos de 6 dígitos).
create table public.intentos_canje (
  id        bigint generated always as identity primary key,
  usuario   uuid,
  exitoso   boolean not null,
  creado_at timestamptz not null default now()
);
create index intentos_canje_usuario_idx on public.intentos_canje (usuario, creado_at);
create index intentos_canje_fecha_idx on public.intentos_canje (creado_at);

-- Rol vigente del usuario actual (null si no tiene perfil, está inactivo o expiró).
create or replace function public.mi_rol()
returns public.rol_usuario
language sql
stable
security definer
set search_path = public
as $$
  select p.rol
  from public.perfiles p
  where p.id = auth.uid()
    and p.activo
    and (p.expira_en is null or p.expira_en > now());
$$;

create or replace function public.es_admin()
returns boolean language sql stable as $$ select public.mi_rol() = 'admin' $$;

create or replace function public.es_staff()
returns boolean language sql stable as $$ select public.mi_rol() in ('admin', 'staff') $$;

-- Llamadas con la llave de servicio (scripts de línea de comandos).
create or replace function public.es_servicio()
returns boolean language sql stable as $$ select coalesce(auth.role() = 'service_role', false) $$;

-- Alta de personal: el script crear-usuario pone {rol, nombre} en app_metadata,
-- que solo la llave de servicio puede escribir. Los anónimos no generan perfil aquí.
create or replace function public.crear_perfil_personal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text := new.raw_app_meta_data ->> 'rol';
begin
  if coalesce(new.is_anonymous, false) or v_rol is null then
    return new;
  end if;
  if v_rol not in ('admin', 'staff') then
    raise exception 'Rol de personal inválido: %', v_rol;
  end if;
  insert into public.perfiles (id, nombre, rol)
  values (new.id, coalesce(nullif(trim(new.raw_app_meta_data ->> 'nombre'), ''), split_part(new.email, '@', 1)), v_rol::public.rol_usuario)
  on conflict (id) do update set rol = excluded.rol, nombre = excluded.nombre, activo = true;
  return new;
end;
$$;

create trigger al_crear_usuario
after insert on auth.users
for each row execute function public.crear_perfil_personal();

-- -----------------------------------------------------------------------------
-- Códigos de invitado
-- -----------------------------------------------------------------------------
create or replace function public.generar_codigo(
  p_horas    int default 24,
  p_usos_max int default null,
  p_nota     text default null
)
returns public.codigos_invitado
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text;
  v_fila   public.codigos_invitado;
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador puede generar códigos' using errcode = '42501';
  end if;
  if p_horas is null or p_horas < 1 or p_horas > 24 * 14 then
    raise exception 'La vigencia debe ser de 1 hora a 14 días';
  end if;

  -- Código que no choque con otro vigente.
  loop
    v_codigo := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (
      select 1 from public.codigos_invitado
      where codigo = v_codigo and revocado_at is null and vigente_hasta > now()
    );
  end loop;

  insert into public.codigos_invitado (codigo, vigente_hasta, usos_max, nota, creado_por)
  values (v_codigo, now() + make_interval(hours => p_horas), p_usos_max, nullif(trim(p_nota), ''), auth.uid())
  returning * into v_fila;
  return v_fila;
end;
$$;

-- Revocar un código también corta el acceso de los invitados que entraron con él.
create or replace function public.revocar_codigo(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador puede revocar códigos' using errcode = '42501';
  end if;
  update public.codigos_invitado set revocado_at = now() where id = p_id and revocado_at is null;
  update public.perfiles set activo = false where codigo_id = p_id and rol = 'invitado';
end;
$$;

-- El invitado entra con sesión anónima y luego canjea nombre + código.
create or replace function public.canjear_codigo(p_codigo text, p_nombre text)
returns public.perfiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_codigo public.codigos_invitado;
  v_perfil public.perfiles;
  v_nombre text := nullif(trim(p_nombre), '');
begin
  if v_uid is null then
    raise exception 'Sesión no iniciada' using errcode = '42501';
  end if;
  if v_nombre is null then
    raise exception 'Escribe tu nombre';
  end if;
  if exists (select 1 from public.perfiles where id = v_uid and rol in ('admin', 'staff')) then
    raise exception 'Esta cuenta ya es de personal del rancho';
  end if;

  -- Límite: 5 fallos por sesión en 15 min y 50 fallos globales en 15 min.
  if (select count(*) from public.intentos_canje
      where usuario = v_uid and not exitoso and creado_at > now() - interval '15 minutes') >= 5
     or (select count(*) from public.intentos_canje
      where not exitoso and creado_at > now() - interval '15 minutes') >= 50 then
    raise exception 'Demasiados intentos. Espera unos minutos.' using errcode = 'P0429';
  end if;

  select * into v_codigo
  from public.codigos_invitado
  where codigo = trim(p_codigo)
    and revocado_at is null
    and vigente_hasta > now()
    and (usos_max is null or usos < usos_max)
  order by creado_at desc
  limit 1
  for update;

  if v_codigo.id is null then
    insert into public.intentos_canje (usuario, exitoso) values (v_uid, false);
    -- Se devuelve null en vez de error para que el intento fallido quede registrado
    -- (un error revertiría la transacción completa).
    return null;
  end if;

  insert into public.intentos_canje (usuario, exitoso) values (v_uid, true);
  update public.codigos_invitado set usos = usos + 1 where id = v_codigo.id;

  insert into public.perfiles (id, nombre, rol, codigo_id, expira_en, activo)
  values (v_uid, left(v_nombre, 60), 'invitado', v_codigo.id, v_codigo.vigente_hasta, true)
  on conflict (id) do update
    set nombre = excluded.nombre, codigo_id = excluded.codigo_id,
        expira_en = excluded.expira_en, activo = true
  returning * into v_perfil;
  return v_perfil;
end;
$$;

-- -----------------------------------------------------------------------------
-- Mapa
-- -----------------------------------------------------------------------------
create table public.linderos (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null default 'Lindero',
  geom         extensions.geography(MultiPolygon, 4326) not null,
  creado_at    timestamptz not null default now(),
  archivado_at timestamptz
);

create table public.caminos (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null default 'Camino',
  geom         extensions.geography(LineString, 4326) not null,
  creado_at    timestamptz not null default now(),
  archivado_at timestamptz
);

create table public.espiaderos (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null check (length(trim(nombre)) between 1 and 60),
  geom         extensions.geography(Point, 4326) not null,
  altitud_m    numeric(7, 1),
  radio_m      int not null default 200 check (radio_m between 25 and 2000),
  origen       public.origen_espiadero not null default 'manual',
  creado_at    timestamptz not null default now(),
  actualizado_at timestamptz not null default now(),
  archivado_at timestamptz
);
create unique index espiaderos_nombre_activo_idx
  on public.espiaderos (public.normalizar_nombre(nombre)) where archivado_at is null;
create index espiaderos_geom_idx on public.espiaderos using gist (geom);

create table public.importaciones_kml (
  id            uuid primary key default gen_random_uuid(),
  archivo       text,
  resumen       jsonb not null,
  realizada_por uuid references auth.users (id) on delete set null,
  creado_at     timestamptz not null default now()
);

-- Capa base: satelital por defecto; aquí se registrará el ortomosaico propio.
create table public.capas_base (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  tipo      text not null check (tipo in ('xyz', 'pmtiles')),
  url       text not null,
  minzoom   int not null default 0,
  maxzoom   int not null default 20,
  atribucion text,
  activa    boolean not null default false,
  creado_at timestamptz not null default now()
);
create unique index capas_base_una_activa_idx on public.capas_base ((true)) where activa;

-- Todo el mapa vigente en una sola llamada, como GeoJSON (respeta RLS).
create or replace function public.mapa_actual()
returns jsonb
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'linderos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', 'Feature', 'id', l.id,
        'properties', jsonb_build_object('nombre', l.nombre),
        'geometry', st_asgeojson(l.geom::geometry, 6)::jsonb))
      from public.linderos l where l.archivado_at is null), '[]'::jsonb),
    'caminos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', 'Feature', 'id', c.id,
        'properties', jsonb_build_object('nombre', c.nombre),
        'geometry', st_asgeojson(c.geom::geometry, 6)::jsonb))
      from public.caminos c where c.archivado_at is null), '[]'::jsonb),
    'espiaderos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', 'Feature', 'id', e.id,
        'properties', jsonb_build_object('id', e.id, 'nombre', e.nombre, 'radio_m', e.radio_m,
                                         'altitud_m', e.altitud_m, 'origen', e.origen),
        'geometry', st_asgeojson(e.geom::geometry, 6)::jsonb) order by e.nombre)
      from public.espiaderos e where e.archivado_at is null), '[]'::jsonb),
    'capa_base', (
      select to_jsonb(cb) - 'creado_at' from public.capas_base cb where cb.activa limit 1)
  );
$$;

-- -----------------------------------------------------------------------------
-- Importación de KML
-- -----------------------------------------------------------------------------
-- p_datos lo produce el lector de KML (src/lib/kml), en la app o en el script:
-- {
--   "linderos":   [{"nombre": "...", "coordenadas": [[[lon,lat], ...]] }],   -- anillos de un polígono
--   "caminos":    [{"nombre": "...", "coordenadas": [[lon,lat], ...] }],
--   "espiaderos": [{"nombre": "...", "lon": n, "lat": n, "altitud": n|null }]
-- }
-- Opcional: "origen": "prueba" para cargar datos ficticios.
-- Con p_aplicar = false solo calcula la vista previa. Con true aplica todo en una
-- transacción:
--   * Espiadero cuyo nombre coincide con uno vigente: se actualiza su ubicación
--     (conserva su id, y con él todo su historial).
--   * Espiadero nuevo: se crea con origen 'kml'.
--   * Espiadero vigente que no viene en el KML: se archiva (no se borra).
--   * Linderos y caminos vigentes se archivan y se cargan los del KML.
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

  insert into public.importaciones_kml (archivo, resumen, realizada_por)
  values (p_archivo, v_resumen, auth.uid());

  return v_resumen;
end;
$$;

-- Cambiar radio o nombre de un espiadero (admin).
create or replace function public.actualizar_espiadero(p_id uuid, p_nombre text default null, p_radio_m int default null)
returns public.espiaderos
language plpgsql
security definer
set search_path = public
as $$
declare v public.espiaderos;
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador puede editar espiaderos' using errcode = '42501';
  end if;
  update public.espiaderos
     set nombre = coalesce(nullif(trim(p_nombre), ''), nombre),
         radio_m = coalesce(p_radio_m, radio_m),
         actualizado_at = now()
   where id = p_id and archivado_at is null
  returning * into v;
  if v.id is null then raise exception 'Espiadero no encontrado'; end if;
  return v;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.perfiles          enable row level security;
alter table public.codigos_invitado  enable row level security;
alter table public.intentos_canje    enable row level security;
alter table public.linderos          enable row level security;
alter table public.caminos           enable row level security;
alter table public.espiaderos        enable row level security;
alter table public.importaciones_kml enable row level security;
alter table public.capas_base        enable row level security;

-- perfiles: cada quien ve el suyo; el personal ve todos (nombres en bitácora y censos).
create policy perfiles_leer on public.perfiles for select to authenticated
  using (id = auth.uid() or public.es_staff());
create policy perfiles_admin_editar on public.perfiles for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- códigos: solo admin (alta y revocación por RPC).
create policy codigos_admin_leer on public.codigos_invitado for select to authenticated
  using (public.es_admin());

-- intentos_canje: sin políticas = sin acceso desde la app.

-- mapa: lectura para cualquier perfil vigente; escritura solo por RPC de admin.
create policy linderos_leer   on public.linderos   for select to authenticated using (public.mi_rol() is not null);
create policy caminos_leer    on public.caminos    for select to authenticated using (public.mi_rol() is not null);
create policy espiaderos_leer on public.espiaderos for select to authenticated using (public.mi_rol() is not null);
create policy capas_leer      on public.capas_base for select to authenticated using (public.mi_rol() is not null);
create policy capas_admin     on public.capas_base for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

create policy importaciones_admin_leer on public.importaciones_kml for select to authenticated
  using (public.es_admin());

-- Funciones: quitar ejecución pública y conceder solo lo necesario.
revoke execute on function public.generar_codigo(int, int, text)      from public, anon;
revoke execute on function public.revocar_codigo(uuid)                from public, anon;
revoke execute on function public.canjear_codigo(text, text)          from public, anon;
revoke execute on function public.importar_kml(jsonb, boolean, text)  from public, anon;
revoke execute on function public.actualizar_espiadero(uuid, text, int) from public, anon;
revoke execute on function public.crear_perfil_personal()             from public, anon, authenticated;
grant execute on function public.generar_codigo(int, int, text)       to authenticated;
grant execute on function public.revocar_codigo(uuid)                 to authenticated;
grant execute on function public.canjear_codigo(text, text)           to authenticated;
grant execute on function public.importar_kml(jsonb, boolean, text)   to authenticated, service_role;
grant execute on function public.actualizar_espiadero(uuid, text, int) to authenticated;
