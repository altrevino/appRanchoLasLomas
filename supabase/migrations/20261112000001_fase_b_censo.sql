-- =============================================================================
-- Rancho Las Lomas · Fase (b): censo simultáneo
-- =============================================================================
-- Reglas clave:
--   * La hora de inicio y fin la pone el servidor (now()), nunca el teléfono.
--   * Cada toque es un registro con id generado en el teléfono: si la cola local
--     reintenta, no se duplica.
--   * Se aceptan registros que lleguen tarde (sin señal) si su hora cae dentro
--     de la ventana del censo.
--   * "Deshacer" no borra: marca anulado_at.
--   * Solo un censo en curso a la vez.

create type public.estado_censo as enum ('borrador', 'en_curso', 'cerrado', 'cancelado');
create type public.clase_censo  as enum ('M1', 'M2', 'M3', 'M4', 'hembra', 'cria');

create table public.censos (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null check (length(trim(nombre)) between 1 and 80),
  duracion_min  int  not null default 20 check (duracion_min between 1 and 240),
  estado        public.estado_censo not null default 'borrador',
  inicio_at     timestamptz,
  fin_at        timestamptz,
  es_simulacion boolean not null default false,
  creado_por    uuid references auth.users (id) on delete set null,
  creado_at     timestamptz not null default now(),
  cerrado_at    timestamptz,
  check (estado = 'borrador' or estado = 'cancelado' or (inicio_at is not null and fin_at is not null))
);
create unique index censos_uno_en_curso_idx on public.censos ((true)) where estado = 'en_curso';
create index censos_fecha_idx on public.censos (creado_at desc);

create table public.censo_espiaderos (
  censo_id     uuid not null references public.censos (id) on delete cascade,
  espiadero_id uuid not null references public.espiaderos (id),
  asignado_a   uuid references public.perfiles (id) on delete set null,
  primary key (censo_id, espiadero_id)
);

create table public.registros_censo (
  id           uuid primary key,
  censo_id     uuid not null references public.censos (id) on delete cascade,
  espiadero_id uuid not null references public.espiaderos (id),
  -- set null: si se borra un invitado, su conteo se conserva.
  perfil_id    uuid references public.perfiles (id) on delete set null,
  clase        public.clase_censo not null,
  capturado_at timestamptz not null,
  recibido_at  timestamptz not null default now(),
  ubicacion    extensions.geography(Point, 4326),
  precision_m  real,
  anulado_at   timestamptz
);
create index registros_censo_censo_idx on public.registros_censo (censo_id);
create index registros_censo_perfil_idx on public.registros_censo (perfil_id, censo_id);

create table public.suscripciones_push (
  id             uuid primary key default gen_random_uuid(),
  perfil_id      uuid not null references public.perfiles (id) on delete cascade,
  endpoint       text not null unique,
  p256dh         text not null,
  auth           text not null,
  user_agent     text,
  creado_at      timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------
create or replace function public.hora_servidor()
returns timestamptz language sql volatile as $$ select now() $$;

-- Cierra los censos cuyo tiempo ya terminó (se llama antes de leer o iniciar).
create or replace function public.cerrar_censos_vencidos()
returns void
language sql
security definer
set search_path = public
as $$
  update public.censos
     set estado = 'cerrado', cerrado_at = fin_at
   where estado = 'en_curso' and fin_at <= now();
$$;

-- -----------------------------------------------------------------------------
-- Administración del censo
-- -----------------------------------------------------------------------------
-- p_asignaciones: {"<espiadero_id>": "<perfil_id>", ...} (opcional)
create or replace function public.crear_censo(
  p_nombre        text,
  p_duracion_min  int,
  p_espiaderos    uuid[],
  p_asignaciones  jsonb default '{}'::jsonb,
  p_simulacion    boolean default false
)
returns public.censos
language plpgsql
security definer
set search_path = public
as $$
declare v public.censos;
begin
  if not (public.es_admin() or public.es_servicio()) then
    raise exception 'Solo el administrador puede crear censos' using errcode = '42501';
  end if;
  if coalesce(array_length(p_espiaderos, 1), 0) = 0 then
    raise exception 'Elige al menos un espiadero';
  end if;
  if exists (select 1 from unnest(p_espiaderos) e
             where not exists (select 1 from public.espiaderos x where x.id = e and x.archivado_at is null)) then
    raise exception 'Hay espiaderos que no existen o están archivados';
  end if;

  insert into public.censos (nombre, duracion_min, es_simulacion, creado_por)
  values (trim(p_nombre), coalesce(p_duracion_min, 20), coalesce(p_simulacion, false), auth.uid())
  returning * into v;

  insert into public.censo_espiaderos (censo_id, espiadero_id, asignado_a)
  select v.id, e, nullif(p_asignaciones ->> e::text, '')::uuid
  from unnest(p_espiaderos) e;
  return v;
end;
$$;

create or replace function public.iniciar_censo(p_id uuid)
returns public.censos
language plpgsql
security definer
set search_path = public
as $$
declare v public.censos;
begin
  if not (public.es_admin() or public.es_servicio()) then
    raise exception 'Solo el administrador puede iniciar censos' using errcode = '42501';
  end if;
  perform public.cerrar_censos_vencidos();
  if exists (select 1 from public.censos where estado = 'en_curso' and id <> p_id) then
    raise exception 'Ya hay un censo en curso. Termínalo antes de iniciar otro.';
  end if;
  update public.censos
     set estado = 'en_curso', inicio_at = now(), fin_at = now() + make_interval(mins => duracion_min)
   where id = p_id and estado = 'borrador'
  returning * into v;
  if v.id is null then raise exception 'El censo no existe o ya se inició'; end if;
  return v;
end;
$$;

create or replace function public.terminar_censo(p_id uuid)
returns public.censos
language plpgsql
security definer
set search_path = public
as $$
declare v public.censos;
begin
  if not (public.es_admin() or public.es_servicio()) then
    raise exception 'Solo el administrador puede terminar censos' using errcode = '42501';
  end if;
  update public.censos
     set estado = 'cerrado', fin_at = least(fin_at, now()), cerrado_at = now()
   where id = p_id and estado = 'en_curso'
  returning * into v;
  if v.id is null then
    update public.censos set estado = 'cancelado' where id = p_id and estado = 'borrador' returning * into v;
  end if;
  if v.id is null then raise exception 'El censo no está en curso'; end if;
  return v;
end;
$$;

-- -----------------------------------------------------------------------------
-- Captura (lo usa la cola del teléfono)
-- -----------------------------------------------------------------------------
-- p_ops: [{ "op": "registrar", "id", "censo_id", "espiadero_id", "clase",
--           "capturado_at", "lon", "lat", "precision_m" },
--         { "op": "anular", "id" }]
-- Devuelve {"aceptados": [ids], "rechazados": [{"id", "motivo"}]}.
-- Los rechazados no se reintentan (por ejemplo, hora fuera del censo).
create or replace function public.registrar_lote(p_ops jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid  uuid := auth.uid();
  o      jsonb;
  c      public.censos;
  v_id   uuid;
  v_hora timestamptz;
  ok     uuid[] := '{}';
  malos  jsonb := '[]'::jsonb;
begin
  if v_uid is null or public.mi_rol() is null then
    raise exception 'Sin acceso' using errcode = '42501';
  end if;
  if jsonb_array_length(coalesce(p_ops, '[]')) > 500 then
    raise exception 'Demasiados registros en un envío';
  end if;

  for o in select * from jsonb_array_elements(coalesce(p_ops, '[]')) loop
    v_id := (o ->> 'id')::uuid;

    if o ->> 'op' = 'anular' then
      update public.registros_censo set anulado_at = coalesce(anulado_at, now())
       where id = v_id and perfil_id = v_uid;
      ok := ok || v_id;
      continue;
    end if;

    -- registrar
    if exists (select 1 from public.registros_censo where id = v_id) then
      ok := ok || v_id;  -- ya estaba (reintento)
      continue;
    end if;
    select * into c from public.censos where id = (o ->> 'censo_id')::uuid;
    v_hora := (o ->> 'capturado_at')::timestamptz;
    if c.id is null or c.estado not in ('en_curso', 'cerrado') then
      malos := malos || jsonb_build_object('id', v_id, 'motivo', 'censo no activo');
    elsif v_hora < c.inicio_at or v_hora > c.fin_at + interval '3 seconds' then
      malos := malos || jsonb_build_object('id', v_id, 'motivo', 'fuera del horario del censo');
    elsif v_hora > now() + interval '2 minutes' then
      malos := malos || jsonb_build_object('id', v_id, 'motivo', 'hora del teléfono adelantada');
    elsif not exists (select 1 from public.censo_espiaderos
                      where censo_id = c.id and espiadero_id = (o ->> 'espiadero_id')::uuid) then
      malos := malos || jsonb_build_object('id', v_id, 'motivo', 'espiadero no participa');
    else
      insert into public.registros_censo (id, censo_id, espiadero_id, perfil_id, clase, capturado_at, ubicacion, precision_m)
      values (
        v_id, c.id, (o ->> 'espiadero_id')::uuid, v_uid, (o ->> 'clase')::public.clase_censo, v_hora,
        case when o ? 'lon' and o ->> 'lon' is not null
             then st_setsrid(st_makepoint((o ->> 'lon')::float8, (o ->> 'lat')::float8), 4326)::geography end,
        nullif(o ->> 'precision_m', '')::real
      )
      on conflict (id) do nothing;
      ok := ok || v_id;
    end if;
  end loop;

  return jsonb_build_object('aceptados', to_jsonb(ok), 'rechazados', malos);
end;
$$;

-- Censo en curso (o null) con sus espiaderos y la hora del servidor.
create or replace function public.censo_actual()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare c public.censos;
begin
  if public.mi_rol() is null then return null; end if;
  perform public.cerrar_censos_vencidos();
  select * into c from public.censos where estado = 'en_curso' limit 1;
  return jsonb_build_object(
    'hora_servidor', now(),
    'censo', case when c.id is null then null else to_jsonb(c) end,
    'espiaderos', case when c.id is null then '[]'::jsonb else (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', e.id, 'nombre', e.nombre, 'radio_m', e.radio_m,
               'lon', extensions.st_x(e.geom::extensions.geometry), 'lat', extensions.st_y(e.geom::extensions.geometry),
               'asignado_a', ce.asignado_a, 'asignado_nombre', p.nombre) order by e.nombre), '[]')
      from public.censo_espiaderos ce
      join public.espiaderos e on e.id = ce.espiadero_id
      left join public.perfiles p on p.id = ce.asignado_a
      where ce.censo_id = c.id) end
  );
end;
$$;

-- Resumen: totales por clase y por espiadero.
-- Invitado: solo totales por clase del censo cerrado y sus propios conteos
-- (no ve el desglose por espiadero, que revelaría dónde están los machos).
create or replace function public.resumen_censo(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.censos;
  clases jsonb := '{"M1":0,"M2":0,"M3":0,"M4":0,"hembra":0,"cria":0}';
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

-- -----------------------------------------------------------------------------
-- Avisos (Web Push)
-- -----------------------------------------------------------------------------
create or replace function public.guardar_suscripcion(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.mi_rol() is null then raise exception 'Sin acceso' using errcode = '42501'; end if;
  insert into public.suscripciones_push (perfil_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set perfil_id = excluded.perfil_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, actualizado_at = now();
end;
$$;

create or replace function public.borrar_suscripcion(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.suscripciones_push where endpoint = p_endpoint and perfil_id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.censos             enable row level security;
alter table public.censo_espiaderos   enable row level security;
alter table public.registros_censo    enable row level security;
alter table public.suscripciones_push enable row level security;

create policy censos_leer on public.censos for select to authenticated using (public.mi_rol() is not null);
create policy censo_espiaderos_leer on public.censo_espiaderos for select to authenticated using (public.mi_rol() is not null);
-- Registros: cada quien los suyos; el personal todos (monitor en vivo).
create policy registros_leer on public.registros_censo for select to authenticated
  using (perfil_id = auth.uid() or public.es_staff());
create policy suscripciones_propias on public.suscripciones_push for select to authenticated
  using (perfil_id = auth.uid());

revoke execute on function public.crear_censo(text, int, uuid[], jsonb, boolean) from public, anon;
revoke execute on function public.iniciar_censo(uuid)   from public, anon;
revoke execute on function public.terminar_censo(uuid)  from public, anon;
revoke execute on function public.registrar_lote(jsonb) from public, anon;
revoke execute on function public.censo_actual()        from public, anon;
revoke execute on function public.resumen_censo(uuid)   from public, anon;
revoke execute on function public.guardar_suscripcion(text, text, text, text) from public, anon;
revoke execute on function public.borrar_suscripcion(text) from public, anon;
revoke execute on function public.cerrar_censos_vencidos() from public, anon;
grant execute on function public.crear_censo(text, int, uuid[], jsonb, boolean) to authenticated, service_role;
grant execute on function public.iniciar_censo(uuid)   to authenticated, service_role;
grant execute on function public.terminar_censo(uuid)  to authenticated, service_role;
grant execute on function public.registrar_lote(jsonb) to authenticated, service_role;
grant execute on function public.censo_actual()        to authenticated;
grant execute on function public.resumen_censo(uuid)   to authenticated, service_role;
grant execute on function public.guardar_suscripcion(text, text, text, text) to authenticated;
grant execute on function public.borrar_suscripcion(text) to authenticated;

-- Tiempo real: el monitor del admin escucha registros; todos escuchan el inicio del censo.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.registros_censo, public.censos;
  end if;
end $$;
