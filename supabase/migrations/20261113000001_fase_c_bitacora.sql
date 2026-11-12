-- =============================================================================
-- Rancho Las Lomas · Fase (c): bitácora de machos (solo admin y staff)
-- =============================================================================
-- * Cada ejemplar tiene folio automático (LL-001, LL-002, …).
-- * El teléfono genera los ids (ejemplar, avistamiento, foto) para poder guardar
--   sin señal y reintentar sin duplicar.
-- * Los ejemplares nuevos nacen "por validar"; el admin los confirma o fusiona.
-- * "Sin ver en 60 días" no se guarda: se calcula en v_machos.

create type public.estado_macho     as enum ('por_validar', 'activo', 'cazado', 'fusionado');
create type public.forma_cornamenta as enum ('abierta', 'cerrada');
create type public.cuerno_roto      as enum ('no', 'izquierdo', 'derecho', 'ambos');

create sequence public.machos_folio_seq;

create table public.machos (
  id                     uuid primary key,
  folio                  text not null unique default 'LL-' || lpad(nextval('public.machos_folio_seq')::text, 3, '0'),
  apodo                  text check (apodo is null or length(trim(apodo)) between 1 and 40),
  clase_actual           public.clase_censo not null check (clase_actual in ('M1', 'M2', 'M3', 'M4')),
  estado                 public.estado_macho not null default 'por_validar',
  fusionado_en           uuid references public.machos (id),
  -- Rasgos distintivos (null = no se sabe)
  puntas_izq             smallint check (puntas_izq between 0 and 20),
  puntas_der             smallint check (puntas_der between 0 and 20),
  forma                  public.forma_cornamenta,
  puntas_anomalas        boolean,
  cuerno_roto            public.cuerno_roto,
  cicatrices             boolean,
  oreja_marcada          boolean,
  nota                   text check (nota is null or length(nota) <= 500),
  foto_portada_id        uuid,
  primer_avistamiento_at timestamptz,
  ultimo_avistamiento_at timestamptz,
  ultimo_espiadero_id    uuid references public.espiaderos (id),
  creado_por             uuid references public.perfiles (id) on delete set null,
  validado_por           uuid references public.perfiles (id) on delete set null,
  validado_at            timestamptz,
  cazado_at              timestamptz,
  creado_at              timestamptz not null default now()
);

create table public.avistamientos (
  id              uuid primary key,
  macho_id        uuid not null references public.machos (id),
  espiadero_id    uuid references public.espiaderos (id),
  perfil_id       uuid references public.perfiles (id) on delete set null,
  observado_at    timestamptz not null,
  ubicacion       extensions.geography(Point, 4326),
  clase_observada public.clase_censo check (clase_observada in ('M1', 'M2', 'M3', 'M4')),
  puntas_izq      smallint,
  puntas_der      smallint,
  forma           public.forma_cornamenta,
  puntas_anomalas boolean,
  cuerno_roto     public.cuerno_roto,
  cicatrices      boolean,
  oreja_marcada   boolean,
  nota            text check (nota is null or length(nota) <= 500),
  creado_at       timestamptz not null default now()
);
create index avistamientos_macho_idx on public.avistamientos (macho_id, observado_at desc);
create index avistamientos_espiadero_idx on public.avistamientos (espiadero_id, observado_at desc);

create table public.fotos (
  id              uuid primary key,
  macho_id        uuid not null references public.machos (id),
  avistamiento_id uuid references public.avistamientos (id) on delete set null,
  storage_path    text not null unique,
  tomada_at       timestamptz not null,
  subida_por      uuid references public.perfiles (id) on delete set null,
  creado_at       timestamptz not null default now()
);
create index fotos_macho_idx on public.fotos (macho_id, tomada_at desc);

create table public.historial_clase (
  id             bigint generated always as identity primary key,
  macho_id       uuid not null references public.machos (id),
  clase          public.clase_censo not null,
  desde          timestamptz not null default now(),
  registrado_por uuid references public.perfiles (id) on delete set null
);

-- Vista con el estado efectivo (sin ver en 60 días) y datos para la lista.
create or replace view public.v_machos with (security_invoker = true) as
select m.*,
       case when m.estado = 'activo' and coalesce(m.ultimo_avistamiento_at, m.creado_at) < now() - interval '60 days'
            then 'sin_ver' else m.estado::text end as estado_efectivo,
       e.nombre as ultimo_espiadero_nombre,
       extensions.st_x(e.geom::extensions.geometry) as ultimo_lon,
       extensions.st_y(e.geom::extensions.geometry) as ultimo_lat,
       f.storage_path as portada_path,
       (select count(*) from public.avistamientos a where a.macho_id = m.id) as num_avistamientos
from public.machos m
left join public.espiaderos e on e.id = m.ultimo_espiadero_id
left join public.fotos f on f.id = m.foto_portada_id;

-- Mantener último avistamiento y portada al día.
create or replace function public.actualizar_resumen_macho(p_macho uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.machos m set
    primer_avistamiento_at = s.primero,
    ultimo_avistamiento_at = s.ultimo,
    ultimo_espiadero_id    = s.ultimo_esp,
    foto_portada_id        = coalesce((select id from public.fotos where id = m.foto_portada_id and macho_id = m.id),
                                      (select id from public.fotos where macho_id = m.id order by tomada_at desc limit 1))
  from (
    select min(observado_at) primero, max(observado_at) ultimo,
           (select espiadero_id from public.avistamientos where macho_id = p_macho and espiadero_id is not null
             order by observado_at desc limit 1) ultimo_esp
    from public.avistamientos where macho_id = p_macho
  ) s
  where m.id = p_macho;
$$;

-- -----------------------------------------------------------------------------
-- Registrar avistamiento (lo envía la cola del teléfono)
-- -----------------------------------------------------------------------------
-- p: { id, macho_id, nuevo (bool), apodo, clase, espiadero_id, observado_at,
--      lon, lat, rasgos: {puntas_izq, puntas_der, forma, puntas_anomalas,
--      cuerno_roto, cicatrices, oreja_marcada}, nota,
--      foto: { id, storage_path, tomada_at } | null }
create or replace function public.registrar_avistamiento(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid   uuid := auth.uid();
  v_macho uuid := (p ->> 'macho_id')::uuid;
  v_id    uuid := (p ->> 'id')::uuid;
  r       jsonb := coalesce(p -> 'rasgos', '{}'::jsonb);
  m       public.machos;
begin
  if not public.es_staff() then
    raise exception 'Solo el personal puede registrar avistamientos' using errcode = '42501';
  end if;

  if coalesce((p ->> 'nuevo')::boolean, false) then
    insert into public.machos (id, apodo, clase_actual, puntas_izq, puntas_der, forma, puntas_anomalas,
                               cuerno_roto, cicatrices, oreja_marcada, nota, creado_por)
    values (v_macho, nullif(trim(p ->> 'apodo'), ''), (p ->> 'clase')::public.clase_censo,
            (r ->> 'puntas_izq')::smallint, (r ->> 'puntas_der')::smallint, (r ->> 'forma')::public.forma_cornamenta,
            (r ->> 'puntas_anomalas')::boolean, (r ->> 'cuerno_roto')::public.cuerno_roto,
            (r ->> 'cicatrices')::boolean, (r ->> 'oreja_marcada')::boolean, nullif(trim(p ->> 'nota'), ''), v_uid)
    on conflict (id) do nothing;
    if found then
      insert into public.historial_clase (macho_id, clase, registrado_por) values (v_macho, (p ->> 'clase')::public.clase_censo, v_uid);
    end if;
  end if;

  select * into m from public.machos where id = v_macho;
  if m.id is null then raise exception 'Ejemplar no encontrado'; end if;
  -- Si se fusionó mientras el teléfono estaba sin señal, va al ejemplar destino.
  if m.estado = 'fusionado' and m.fusionado_en is not null then v_macho := m.fusionado_en; end if;

  insert into public.avistamientos (id, macho_id, espiadero_id, perfil_id, observado_at, ubicacion, clase_observada,
                                    puntas_izq, puntas_der, forma, puntas_anomalas, cuerno_roto, cicatrices, oreja_marcada, nota)
  values (v_id, v_macho, nullif(p ->> 'espiadero_id', '')::uuid, v_uid, coalesce((p ->> 'observado_at')::timestamptz, now()),
          case when p ->> 'lon' is not null then st_setsrid(st_makepoint((p ->> 'lon')::float8, (p ->> 'lat')::float8), 4326)::geography end,
          (p ->> 'clase')::public.clase_censo,
          (r ->> 'puntas_izq')::smallint, (r ->> 'puntas_der')::smallint, (r ->> 'forma')::public.forma_cornamenta,
          (r ->> 'puntas_anomalas')::boolean, (r ->> 'cuerno_roto')::public.cuerno_roto,
          (r ->> 'cicatrices')::boolean, (r ->> 'oreja_marcada')::boolean, nullif(trim(p ->> 'nota'), ''))
  on conflict (id) do nothing;

  if p -> 'foto' is not null and jsonb_typeof(p -> 'foto') = 'object' then
    insert into public.fotos (id, macho_id, avistamiento_id, storage_path, tomada_at, subida_por)
    values ((p #>> '{foto,id}')::uuid, v_macho, v_id, p #>> '{foto,storage_path}',
            coalesce((p #>> '{foto,tomada_at}')::timestamptz, now()), v_uid)
    on conflict (id) do nothing;
  end if;

  perform public.actualizar_resumen_macho(v_macho);
  select * into m from public.machos where id = v_macho;
  return jsonb_build_object('macho_id', m.id, 'folio', m.folio, 'avistamiento_id', v_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Edición, validación, fusión
-- -----------------------------------------------------------------------------
-- p: { apodo, clase, estado ('activo'|'cazado'), rasgos..., nota, foto_portada_id }
-- Staff: apodo, clase, rasgos, nota, portada. Admin además: validar y marcar cazado.
create or replace function public.actualizar_macho(p_id uuid, p jsonb)
returns public.machos
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.machos;
  v_clase public.clase_censo := nullif(p ->> 'clase', '')::public.clase_censo;
  v_estado text := nullif(p ->> 'estado', '');
begin
  if not public.es_staff() then raise exception 'Sin acceso' using errcode = '42501'; end if;
  select * into m from public.machos where id = p_id;
  if m.id is null or m.estado = 'fusionado' then raise exception 'Ejemplar no encontrado'; end if;
  if v_estado is not null and v_estado <> m.estado::text then
    if not public.es_admin() then raise exception 'Solo el administrador puede cambiar el estado' using errcode = '42501'; end if;
    if v_estado not in ('activo', 'cazado') then raise exception 'Estado no válido'; end if;
  end if;

  update public.machos set
    apodo           = case when p ? 'apodo' then nullif(trim(p ->> 'apodo'), '') else apodo end,
    clase_actual    = coalesce(v_clase, clase_actual),
    puntas_izq      = case when p ? 'puntas_izq' then (p ->> 'puntas_izq')::smallint else puntas_izq end,
    puntas_der      = case when p ? 'puntas_der' then (p ->> 'puntas_der')::smallint else puntas_der end,
    forma           = case when p ? 'forma' then (p ->> 'forma')::public.forma_cornamenta else forma end,
    puntas_anomalas = case when p ? 'puntas_anomalas' then (p ->> 'puntas_anomalas')::boolean else puntas_anomalas end,
    cuerno_roto     = case when p ? 'cuerno_roto' then (p ->> 'cuerno_roto')::public.cuerno_roto else cuerno_roto end,
    cicatrices      = case when p ? 'cicatrices' then (p ->> 'cicatrices')::boolean else cicatrices end,
    oreja_marcada   = case when p ? 'oreja_marcada' then (p ->> 'oreja_marcada')::boolean else oreja_marcada end,
    nota            = case when p ? 'nota' then nullif(trim(p ->> 'nota'), '') else nota end,
    foto_portada_id = case when p ? 'foto_portada_id'
                           then (select id from public.fotos where id = (p ->> 'foto_portada_id')::uuid and macho_id = p_id)
                           else foto_portada_id end,
    estado          = coalesce(v_estado::public.estado_macho, estado),
    validado_por    = case when v_estado = 'activo' and m.estado = 'por_validar' then auth.uid() else validado_por end,
    validado_at     = case when v_estado = 'activo' and m.estado = 'por_validar' then now() else validado_at end,
    cazado_at       = case when v_estado = 'cazado' then coalesce(cazado_at, now()) when v_estado = 'activo' then null else cazado_at end
  where id = p_id
  returning * into m;

  if v_clase is not null and v_clase is distinct from (select clase from public.historial_clase where macho_id = p_id order by desde desc, id desc limit 1) then
    insert into public.historial_clase (macho_id, clase, registrado_por) values (p_id, v_clase, auth.uid());
  end if;
  return m;
end;
$$;

-- Fusiona un ejemplar duplicado (origen) en otro (destino): mueve avistamientos y fotos.
create or replace function public.fusionar_machos(p_origen uuid, p_destino uuid)
returns public.machos
language plpgsql
security definer
set search_path = public
as $$
declare d public.machos;
begin
  if not public.es_admin() then raise exception 'Solo el administrador puede fusionar' using errcode = '42501'; end if;
  if p_origen = p_destino then raise exception 'Elige dos ejemplares distintos'; end if;
  if not exists (select 1 from public.machos where id = p_origen and estado <> 'fusionado')
     or not exists (select 1 from public.machos where id = p_destino and estado <> 'fusionado') then
    raise exception 'Ejemplar no encontrado';
  end if;
  update public.avistamientos set macho_id = p_destino where macho_id = p_origen;
  update public.fotos set macho_id = p_destino where macho_id = p_origen;
  update public.historial_clase set macho_id = p_destino where macho_id = p_origen;
  update public.machos set estado = 'fusionado', fusionado_en = p_destino, foto_portada_id = null where id = p_origen;
  -- Completar rasgos que el destino no tenía
  update public.machos d2 set
    apodo           = coalesce(d2.apodo, o.apodo),
    puntas_izq      = coalesce(d2.puntas_izq, o.puntas_izq),
    puntas_der      = coalesce(d2.puntas_der, o.puntas_der),
    forma           = coalesce(d2.forma, o.forma),
    puntas_anomalas = coalesce(d2.puntas_anomalas, o.puntas_anomalas),
    cuerno_roto     = coalesce(d2.cuerno_roto, o.cuerno_roto),
    cicatrices      = coalesce(d2.cicatrices, o.cicatrices),
    oreja_marcada   = coalesce(d2.oreja_marcada, o.oreja_marcada)
  from public.machos o where o.id = p_origen and d2.id = p_destino;
  perform public.actualizar_resumen_macho(p_destino);
  select * into d from public.machos where id = p_destino;
  return d;
end;
$$;

-- Últimos avistamientos en un espiadero (hoja del mapa, solo personal).
create or replace function public.ultimos_avistamientos(p_espiadero uuid, p_limite int default 5)
returns table (macho_id uuid, folio text, apodo text, clase text, observado_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select m.id, m.folio, m.apodo, coalesce(a.clase_observada, m.clase_actual)::text, a.observado_at
  from public.avistamientos a
  join public.machos m on m.id = a.macho_id
  where a.espiadero_id = p_espiadero and m.estado <> 'fusionado'
  order by a.observado_at desc
  limit least(coalesce(p_limite, 5), 20);
$$;

-- -----------------------------------------------------------------------------
-- RLS: invitados no ven nada de la bitácora
-- -----------------------------------------------------------------------------
alter table public.machos          enable row level security;
alter table public.avistamientos   enable row level security;
alter table public.fotos           enable row level security;
alter table public.historial_clase enable row level security;

create policy machos_staff          on public.machos          for select to authenticated using (public.es_staff());
create policy avistamientos_staff   on public.avistamientos   for select to authenticated using (public.es_staff());
create policy fotos_staff           on public.fotos           for select to authenticated using (public.es_staff());
create policy historial_clase_staff on public.historial_clase for select to authenticated using (public.es_staff());

revoke execute on function public.registrar_avistamiento(jsonb)     from public, anon;
revoke execute on function public.actualizar_macho(uuid, jsonb)     from public, anon;
revoke execute on function public.fusionar_machos(uuid, uuid)       from public, anon;
revoke execute on function public.actualizar_resumen_macho(uuid)    from public, anon, authenticated;
revoke execute on function public.ultimos_avistamientos(uuid, int)  from public, anon;
grant execute on function public.registrar_avistamiento(jsonb)      to authenticated;
grant execute on function public.actualizar_macho(uuid, jsonb)      to authenticated;
grant execute on function public.fusionar_machos(uuid, uuid)        to authenticated;
grant execute on function public.ultimos_avistamientos(uuid, int)   to authenticated;

-- -----------------------------------------------------------------------------
-- Storage: bucket privado de fotos (solo personal). Se omite si no existe el
-- esquema storage (pruebas locales).
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('fotos', 'fotos', false, 3145728, array['image/jpeg', 'image/webp', 'image/png'])
    on conflict (id) do nothing;
    execute $p$create policy fotos_leer_staff on storage.objects for select to authenticated
             using (bucket_id = 'fotos' and public.es_staff())$p$;
    execute $p$create policy fotos_subir_staff on storage.objects for insert to authenticated
             with check (bucket_id = 'fotos' and public.es_staff())$p$;
    execute $p$create policy fotos_reemplazar_staff on storage.objects for update to authenticated
             using (bucket_id = 'fotos' and public.es_staff())$p$;
  end if;
end $$;
