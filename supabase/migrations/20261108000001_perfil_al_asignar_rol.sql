-- Supabase crea el usuario y después escribe app_metadata en otra sentencia,
-- así que el trigger de alta también debe escuchar cambios de app_metadata.
-- Además permite cambiar de rol a alguien con el script crear-usuario.

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
  if tg_op = 'UPDATE' and (old.raw_app_meta_data ->> 'rol') is not distinct from v_rol
     and (old.raw_app_meta_data ->> 'nombre') is not distinct from (new.raw_app_meta_data ->> 'nombre') then
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

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
after insert or update of raw_app_meta_data on auth.users
for each row execute function public.crear_perfil_personal();
