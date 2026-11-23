-- =============================================================================
-- Bitácora para invitados (permiso por código) con revisión del administrador
-- =============================================================================
-- * Permiso de bitácora del invitado: 'ninguno' | 'lectura' | 'escritura'.
--   Se elige al generar el código y lo heredan quienes entren con él; el admin
--   puede cambiarlo por persona.
-- * Lo que registra un invitado (avistamiento, foto, ejemplar nuevo) queda con
--   aprobado = false: solo lo ven el admin y quien lo registró, y no cuenta para
--   "último visto" ni foto principal hasta que el admin lo apruebe.
-- * Datos de trofeo siguen siendo solo del administrador.

alter table public.codigos_invitado add column bitacora text not null default 'ninguno'
  check (bitacora in ('ninguno', 'lectura', 'escritura'));
alter table public.perfiles add column bitacora text not null default 'ninguno'
  check (bitacora in ('ninguno', 'lectura', 'escritura'));
alter table public.machos        add column aprobado boolean not null default true;
alter table public.avistamientos add column aprobado boolean not null default true;
alter table public.fotos         add column aprobado boolean not null default true;
-- La vista se recrea para incluir la columna nueva (las vistas fijan sus columnas al crearse).
drop view public.v_machos;
create view public.v_machos with (security_invoker = true) as
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

create index avistamientos_pendientes_idx on public.avistamientos (creado_at) where not aprobado;

create or replace function public.puede_ver_bitacora()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_staff() or exists (
    select 1 from public.perfiles p
    where p.id = auth.uid() and p.rol = 'invitado' and p.activo
      and (p.expira_en is null or p.expira_en > now())
      and p.bitacora in ('lectura', 'escritura'));
$$;

create or replace function public.puede_escribir_bitacora()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_staff() or exists (
    select 1 from public.perfiles p
    where p.id = auth.uid() and p.rol = 'invitado' and p.activo
      and (p.expira_en is null or p.expira_en > now())
      and p.bitacora = 'escritura');
$$;

-- Lectura: personal e invitados con permiso; lo no aprobado solo para el admin y su autor.
drop policy machos_staff on public.machos;
drop policy avistamientos_staff on public.avistamientos;
drop policy fotos_staff on public.fotos;
drop policy historial_clase_staff on public.historial_clase;
create policy machos_leer on public.machos for select to authenticated
  using (public.es_admin() or (public.puede_ver_bitacora() and (aprobado or creado_por = auth.uid())));
create policy avistamientos_leer on public.avistamientos for select to authenticated
  using (public.es_admin() or (public.puede_ver_bitacora() and (aprobado or perfil_id = auth.uid())));
create policy fotos_leer on public.fotos for select to authenticated
  using (public.es_admin() or (public.puede_ver_bitacora() and (aprobado or subida_por = auth.uid())));
create policy historial_clase_leer on public.historial_clase for select to authenticated
  using (public.puede_ver_bitacora());

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    execute 'drop policy if exists fotos_leer_staff on storage.objects';
    execute 'drop policy if exists fotos_subir_staff on storage.objects';
    execute 'drop policy if exists fotos_reemplazar_staff on storage.objects';
    execute $p$create policy fotos_leer on storage.objects for select to authenticated
             using (bucket_id = 'fotos' and public.puede_ver_bitacora())$p$;
    execute $p$create policy fotos_subir on storage.objects for insert to authenticated
             with check (bucket_id = 'fotos' and public.puede_escribir_bitacora())$p$;
    execute $p$create policy fotos_reemplazar on storage.objects for update to authenticated
             using (bucket_id = 'fotos' and public.puede_escribir_bitacora())$p$;
    execute $p$create policy fotos_borrar_admin on storage.objects for delete to authenticated
             using (bucket_id = 'fotos' and public.es_admin())$p$;
  end if;
end $$;

-- Códigos: generar con permiso de bitácora (reemplaza la versión de 3 parámetros)
drop function public.generar_codigo(int, int, text);
create or replace function public.generar_codigo(
  p_horas    int default 24,
  p_usos_max int default null,
  p_nota     text default null,
  p_bitacora text default 'ninguno'
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
  if coalesce(p_bitacora, 'ninguno') not in ('ninguno', 'lectura', 'escritura') then
    raise exception 'Permiso de bitácora no válido';
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

  insert into public.codigos_invitado (codigo, vigente_hasta, usos_max, nota, creado_por, bitacora)
  values (v_codigo, now() + make_interval(hours => p_horas), p_usos_max, nullif(trim(p_nota), ''), auth.uid(), coalesce(p_bitacora, 'ninguno'))
  returning * into v_fila;
  return v_fila;
end;
$$;


revoke execute on function public.generar_codigo(int, int, text, text) from public, anon;
grant execute on function public.generar_codigo(int, int, text, text) to authenticated;

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

  insert into public.perfiles (id, nombre, rol, codigo_id, expira_en, activo, bitacora)
  values (v_uid, left(v_nombre, 60), 'invitado', v_codigo.id, v_codigo.vigente_hasta, true, v_codigo.bitacora)
  on conflict (id) do update
    set nombre = excluded.nombre, codigo_id = excluded.codigo_id,
        expira_en = excluded.expira_en, activo = true, bitacora = excluded.bitacora
  returning * into v_perfil;
  return v_perfil;
end;
$$;


-- Cambiar el permiso de bitácora de un invitado (admin)
create or replace function public.permiso_bitacora_invitado(p_perfil uuid, p_bitacora text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin() then raise exception 'Solo el administrador' using errcode = '42501'; end if;
  if p_bitacora not in ('ninguno', 'lectura', 'escritura') then raise exception 'Permiso no válido'; end if;
  update public.perfiles set bitacora = p_bitacora where id = p_perfil and rol = 'invitado';
end;
$$;
revoke execute on function public.permiso_bitacora_invitado(uuid, text) from public, anon;
grant execute on function public.permiso_bitacora_invitado(uuid, text) to authenticated;

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
    foto_portada_id        = coalesce((select id from public.fotos where id = m.foto_portada_id and macho_id = m.id and aprobado),
                                      (select id from public.fotos where macho_id = m.id and aprobado order by tomada_at desc limit 1))
  from (
    select min(observado_at) primero, max(observado_at) ultimo,
           (select espiadero_id from public.avistamientos where macho_id = p_macho and espiadero_id is not null and aprobado
             order by observado_at desc limit 1) ultimo_esp
    from public.avistamientos where macho_id = p_macho and aprobado
  ) s
  where m.id = p_macho;
$$;

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
  -- Lo que registra un invitado queda pendiente de revisión del admin.
  v_ok    boolean := public.es_staff();
begin
  if not public.puede_escribir_bitacora() then
    raise exception 'No tienes permiso para registrar en la bitácora' using errcode = '42501';
  end if;

  if coalesce((p ->> 'nuevo')::boolean, false) then
    insert into public.machos (id, apodo, clase_actual, puntas_izq, puntas_der, forma, puntas_anomalas,
                               cuerno_roto, cicatrices, oreja_marcada, nota, creado_por, aprobado)
    values (v_macho, nullif(trim(p ->> 'apodo'), ''), (p ->> 'clase')::public.clase_censo,
            (r ->> 'puntas_izq')::smallint, (r ->> 'puntas_der')::smallint, (r ->> 'forma')::public.forma_cornamenta,
            (r ->> 'puntas_anomalas')::boolean, (r ->> 'cuerno_roto')::public.cuerno_roto,
            (r ->> 'cicatrices')::boolean, (r ->> 'oreja_marcada')::boolean, nullif(trim(p ->> 'nota'), ''), v_uid, v_ok)
    on conflict (id) do nothing;
    if found then
      insert into public.historial_clase (macho_id, clase, registrado_por) values (v_macho, (p ->> 'clase')::public.clase_censo, v_uid);
    end if;
  end if;

  select * into m from public.machos where id = v_macho;
  if m.id is null then raise exception 'Ejemplar no encontrado'; end if;
  -- Un invitado solo puede sumar avistamientos a ejemplares aprobados o a los suyos.
  if not v_ok and not m.aprobado and m.creado_por is distinct from v_uid then raise exception 'Ejemplar no encontrado'; end if;
  -- Si se fusionó mientras el teléfono estaba sin señal, va al ejemplar destino.
  if m.estado = 'fusionado' and m.fusionado_en is not null then v_macho := m.fusionado_en; end if;

  insert into public.avistamientos (id, macho_id, espiadero_id, perfil_id, observado_at, ubicacion, clase_observada,
                                    puntas_izq, puntas_der, forma, puntas_anomalas, cuerno_roto, cicatrices, oreja_marcada, nota, aprobado)
  values (v_id, v_macho, nullif(p ->> 'espiadero_id', '')::uuid, v_uid, coalesce((p ->> 'observado_at')::timestamptz, now()),
          case when p ->> 'lon' is not null then st_setsrid(st_makepoint((p ->> 'lon')::float8, (p ->> 'lat')::float8), 4326)::geography end,
          (p ->> 'clase')::public.clase_censo,
          (r ->> 'puntas_izq')::smallint, (r ->> 'puntas_der')::smallint, (r ->> 'forma')::public.forma_cornamenta,
          (r ->> 'puntas_anomalas')::boolean, (r ->> 'cuerno_roto')::public.cuerno_roto,
          (r ->> 'cicatrices')::boolean, (r ->> 'oreja_marcada')::boolean, nullif(trim(p ->> 'nota'), ''), v_ok)
  on conflict (id) do nothing;

  if p -> 'foto' is not null and jsonb_typeof(p -> 'foto') = 'object' then
    insert into public.fotos (id, macho_id, avistamiento_id, storage_path, tomada_at, subida_por, aprobado)
    values ((p #>> '{foto,id}')::uuid, v_macho, v_id, p #>> '{foto,storage_path}',
            coalesce((p #>> '{foto,tomada_at}')::timestamptz, now()), v_uid, v_ok)
    on conflict (id) do nothing;
  end if;

  perform public.actualizar_resumen_macho(v_macho);
  select * into m from public.machos where id = v_macho;
  return jsonb_build_object('macho_id', m.id, 'folio', m.folio, 'avistamiento_id', v_id, 'pendiente', not v_ok);
end;
$$;


-- -----------------------------------------------------------------------------
-- Revisión del administrador
-- -----------------------------------------------------------------------------
-- Aportes pendientes (avistamientos no aprobados), con su ejemplar y fotos.
create or replace function public.aportes_pendientes()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'avistamiento_id', a.id, 'observado_at', a.observado_at, 'clase', a.clase_observada, 'nota', a.nota,
    'puntas_izq', a.puntas_izq, 'puntas_der', a.puntas_der, 'forma', a.forma, 'cuerno_roto', a.cuerno_roto,
    'puntas_anomalas', a.puntas_anomalas, 'oreja_marcada', a.oreja_marcada, 'cicatrices', a.cicatrices,
    'espiadero', e.nombre, 'autor', p.nombre,
    'macho_id', m.id, 'folio', m.folio, 'apodo', m.apodo, 'ejemplar_nuevo', not m.aprobado,
    'fotos', (select coalesce(jsonb_agg(f.storage_path), '[]') from public.fotos f where f.avistamiento_id = a.id)
  ) order by a.creado_at), '[]')
  from public.avistamientos a
  join public.machos m on m.id = a.macho_id
  left join public.espiaderos e on e.id = a.espiadero_id
  left join public.perfiles p on p.id = a.perfil_id
  where not a.aprobado and public.es_admin();
$$;

-- Aprobar o rechazar un aporte. Rechazar devuelve las rutas de fotos a borrar.
create or replace function public.revisar_aporte(p_avistamiento uuid, p_aprobar boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.avistamientos;
  v_rutas jsonb;
begin
  if not public.es_admin() then raise exception 'Solo el administrador' using errcode = '42501'; end if;
  select * into a from public.avistamientos where id = p_avistamiento;
  if a.id is null then raise exception 'Aporte no encontrado'; end if;

  if p_aprobar then
    update public.avistamientos set aprobado = true where id = a.id;
    update public.fotos set aprobado = true where avistamiento_id = a.id;
    update public.machos set aprobado = true, estado = 'activo', validado_por = auth.uid(), validado_at = now()
     where id = a.macho_id and not aprobado;
    perform public.actualizar_resumen_macho(a.macho_id);
    return jsonb_build_object('aprobado', true, 'macho_id', a.macho_id);
  end if;

  select coalesce(jsonb_agg(storage_path), '[]') into v_rutas from public.fotos where avistamiento_id = a.id;
  update public.machos set foto_portada_id = null
   where id = a.macho_id and foto_portada_id in (select id from public.fotos where avistamiento_id = a.id);
  delete from public.fotos where avistamiento_id = a.id;
  delete from public.avistamientos where id = a.id;
  -- Ejemplar nuevo del invitado sin más avistamientos: se elimina.
  if exists (select 1 from public.machos where id = a.macho_id and not aprobado)
     and not exists (select 1 from public.avistamientos where macho_id = a.macho_id) then
    delete from public.machos_trofeo where macho_id = a.macho_id;
    delete from public.historial_clase where macho_id = a.macho_id;
    delete from public.fotos where macho_id = a.macho_id;
    delete from public.machos where id = a.macho_id;
  else
    perform public.actualizar_resumen_macho(a.macho_id);
  end if;
  return jsonb_build_object('aprobado', false, 'rutas', v_rutas);
end;
$$;

revoke execute on function public.aportes_pendientes() from public, anon;
revoke execute on function public.revisar_aporte(uuid, boolean) from public, anon;
grant execute on function public.aportes_pendientes() to authenticated;
grant execute on function public.revisar_aporte(uuid, boolean) to authenticated;
