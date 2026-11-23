-- =============================================================================
-- Mediciones de trofeo (Boone and Crockett). SOLO ADMIN.
-- =============================================================================
-- Medidas en OCTAVOS DE PULGADA (enteros) para no perder precisión:
-- 18 4/8" = 148. La app calcula las puntuaciones y las guarda aquí para la lista.
--
-- medidas = {
--   "viga": {"d": int|null, "i": int|null},
--   "g":    [{"d","i"}, ...]   G1, G2, ... (puntas típicas)
--   "h":    [{"d","i"} x 4]    H1–H4 (circunferencias)
--   "ap":   [{"d","i"}, ...]   puntas anormales
-- }

create table public.mediciones (
  id               uuid primary key default gen_random_uuid(),
  folio            int generated always as identity unique,
  macho_id         uuid references public.machos (id) on delete set null,
  foto_path        text,
  espiadero_id     uuid references public.espiaderos (id) on delete set null,
  lugar            text check (lugar is null or length(trim(lugar)) between 1 and 60),
  cazado_at        timestamptz not null,
  cazador          text check (cazador is null or length(trim(cazador)) between 1 and 80),
  procedencia      text check (procedencia is null or length(procedencia) <= 80),
  arma             text check (arma is null or arma in ('rifle', 'arco', 'ballesta', 'otra')),
  guia             text check (guia is null or length(guia) <= 80),
  medido_por       text check (medido_por is null or length(medido_por) <= 80),
  notas            text check (notas is null or length(notas) <= 1000),
  abertura         int check (abertura between 0 and 800),
  medidas          jsonb not null default '{}'::jsonb check (jsonb_typeof(medidas) = 'object'),
  bruta            int,
  neta_tipica      int,
  neta_no_tipica   int,
  creado_por       uuid references public.perfiles (id) on delete set null default auth.uid(),
  creado_at        timestamptz not null default now(),
  actualizado_at   timestamptz not null default now()
);
create index mediciones_cazado_at on public.mediciones (cazado_at desc);

alter table public.mediciones enable row level security;
create policy mediciones_admin on public.mediciones for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
grant select, insert, update, delete on public.mediciones to authenticated;

-- Fotos: la carpeta mediciones/ es solo del admin (la bitácora no la ve).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    execute 'drop policy if exists fotos_leer on storage.objects';
    execute 'drop policy if exists fotos_subir on storage.objects';
    execute 'drop policy if exists fotos_reemplazar on storage.objects';
    execute $p$create policy fotos_leer on storage.objects for select to authenticated
             using (bucket_id = 'fotos' and case when name like 'mediciones/%' then public.es_admin() else public.puede_ver_bitacora() end)$p$;
    execute $p$create policy fotos_subir on storage.objects for insert to authenticated
             with check (bucket_id = 'fotos' and case when name like 'mediciones/%' then public.es_admin() else public.puede_escribir_bitacora() end)$p$;
    execute $p$create policy fotos_reemplazar on storage.objects for update to authenticated
             using (bucket_id = 'fotos' and case when name like 'mediciones/%' then public.es_admin() else public.puede_escribir_bitacora() end)$p$;
  end if;
end $$;
