-- =============================================================================
-- Trofeo: puntuación estimada y real, fecha de caza y cazador. SOLO ADMIN.
-- =============================================================================
-- Tabla aparte porque RLS oculta filas, no columnas: el personal ve la ficha del
-- ejemplar pero no estos datos.

create table public.machos_trofeo (
  macho_id            uuid primary key references public.machos (id) on delete cascade,
  puntuacion_estimada numeric(5, 1) check (puntuacion_estimada between 0 and 400),
  puntuacion_real     numeric(5, 1) check (puntuacion_real between 0 and 400),
  sistema             text not null default 'B&C' check (sistema in ('B&C', 'SCI')),
  fecha_caza          date,
  cazador             text check (cazador is null or length(trim(cazador)) between 1 and 80),
  actualizado_por     uuid references public.perfiles (id) on delete set null,
  actualizado_at      timestamptz not null default now()
);
alter table public.machos_trofeo enable row level security;
create policy trofeo_solo_admin on public.machos_trofeo for select to authenticated using (public.es_admin());

-- p: { puntuacion_estimada, puntuacion_real, sistema, fecha_caza (YYYY-MM-DD), cazador }
-- Solo cambia las claves presentes. Con fecha_caza el ejemplar queda "cazado";
-- con fecha_caza = null (explícito) vuelve a "activo".
create or replace function public.guardar_trofeo(p_macho uuid, p jsonb)
returns public.machos_trofeo
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.machos_trofeo;
  m public.machos;
begin
  if not public.es_admin() then raise exception 'Solo el administrador' using errcode = '42501'; end if;
  select * into m from public.machos where id = p_macho;
  if m.id is null or m.estado = 'fusionado' then raise exception 'Ejemplar no encontrado'; end if;

  insert into public.machos_trofeo (macho_id) values (p_macho) on conflict (macho_id) do nothing;
  update public.machos_trofeo set
    puntuacion_estimada = case when p ? 'puntuacion_estimada' then nullif(p ->> 'puntuacion_estimada', '')::numeric else puntuacion_estimada end,
    puntuacion_real     = case when p ? 'puntuacion_real' then nullif(p ->> 'puntuacion_real', '')::numeric else puntuacion_real end,
    sistema             = case when p ? 'sistema' then coalesce(nullif(p ->> 'sistema', ''), 'B&C') else sistema end,
    fecha_caza          = case when p ? 'fecha_caza' then nullif(p ->> 'fecha_caza', '')::date else fecha_caza end,
    cazador             = case when p ? 'cazador' then nullif(trim(p ->> 'cazador'), '') else cazador end,
    actualizado_por     = auth.uid(),
    actualizado_at      = now()
  where macho_id = p_macho
  returning * into r;

  if p ? 'fecha_caza' then
    if r.fecha_caza is not null then
      update public.machos set estado = 'cazado', cazado_at = r.fecha_caza::timestamptz where id = p_macho;
    elsif m.estado = 'cazado' then
      update public.machos set estado = 'activo', cazado_at = null where id = p_macho;
      update public.machos_trofeo set cazador = null where macho_id = p_macho returning * into r;
    end if;
  end if;
  return r;
end;
$$;

revoke execute on function public.guardar_trofeo(uuid, jsonb) from public, anon;
grant execute on function public.guardar_trofeo(uuid, jsonb) to authenticated;

-- Fusión: también mueve los datos de trofeo.
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
  -- Datos de trofeo: si el destino no tiene, se conservan los del duplicado.
  insert into public.machos_trofeo (macho_id, puntuacion_estimada, puntuacion_real, sistema, fecha_caza, cazador, actualizado_por, actualizado_at)
  select p_destino, puntuacion_estimada, puntuacion_real, sistema, fecha_caza, cazador, actualizado_por, actualizado_at
  from public.machos_trofeo where macho_id = p_origen
  on conflict (macho_id) do nothing;
  delete from public.machos_trofeo where macho_id = p_origen;
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

