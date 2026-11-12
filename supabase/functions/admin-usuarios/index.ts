// Alta y administración del personal (solo administradores).
// Acciones: listar, crear, rol, contrasena, activo.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const LETRAS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
function contrasenaNueva(): string {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(b, (x) => LETRAS[x % LETRAS.length]).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const { data: esAdmin } = await usuario.rpc('es_admin');
  if (esAdmin !== true) return json({ error: 'Solo el administrador puede administrar al personal' }, 403);
  const { data: yo } = await usuario.auth.getUser();
  const miId = yo.user?.id;

  const servicio = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const p = await req.json().catch(() => ({}));

  try {
    switch (p.accion) {
      case 'listar': {
        const { data: perfiles } = await servicio
          .from('perfiles')
          .select('id, nombre, rol, activo')
          .in('rol', ['admin', 'staff'])
          .order('nombre');
        const ids = new Set((perfiles ?? []).map((x) => x.id));
        const correos = new Map<string, { correo: string; ultimo: string | null }>();
        for (let pagina = 1; ; pagina++) {
          const { data, error } = await servicio.auth.admin.listUsers({ page: pagina, perPage: 200 });
          if (error) throw error;
          data.users.filter((u) => ids.has(u.id)).forEach((u) => correos.set(u.id, { correo: u.email ?? '', ultimo: u.last_sign_in_at ?? null }));
          if (data.users.length < 200) break;
        }
        return json({
          personal: (perfiles ?? []).map((x) => ({ ...x, correo: correos.get(x.id)?.correo ?? '', ultimo_acceso: correos.get(x.id)?.ultimo ?? null, soy_yo: x.id === miId })),
        });
      }

      case 'crear': {
        const correo = String(p.correo ?? '').trim().toLowerCase();
        const nombre = String(p.nombre ?? '').trim();
        const rol = p.rol === 'admin' ? 'admin' : 'staff';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return json({ error: 'Correo no válido' }, 400);
        if (nombre.length < 2) return json({ error: 'Escribe el nombre' }, 400);
        const contrasena = contrasenaNueva();
        const { error } = await servicio.auth.admin.createUser({
          email: correo,
          password: contrasena,
          email_confirm: true,
          app_metadata: { rol, nombre },
        });
        if (error) {
          if (/already|registered|exists/i.test(error.message)) return json({ error: 'Ya existe una cuenta con ese correo' }, 409);
          throw error;
        }
        return json({ contrasena });
      }

      case 'rol': {
        if (p.id === miId) return json({ error: 'No puedes cambiar tu propio rol' }, 400);
        const rol = p.rol === 'admin' ? 'admin' : 'staff';
        const { data: per } = await servicio.from('perfiles').select('nombre').eq('id', p.id).maybeSingle();
        if (!per) return json({ error: 'Persona no encontrada' }, 404);
        const { error } = await servicio.auth.admin.updateUserById(p.id, { app_metadata: { rol, nombre: per.nombre } });
        if (error) throw error;
        await servicio.from('perfiles').update({ rol }).eq('id', p.id);
        return json({ ok: true });
      }

      case 'contrasena': {
        const contrasena = contrasenaNueva();
        const { error } = await servicio.auth.admin.updateUserById(p.id, { password: contrasena });
        if (error) throw error;
        return json({ contrasena });
      }

      case 'activo': {
        if (p.id === miId) return json({ error: 'No puedes desactivar tu propia cuenta' }, 400);
        const activo = p.activo === true;
        const { error } = await servicio.auth.admin.updateUserById(p.id, { ban_duration: activo ? 'none' : '876000h' });
        if (error) throw error;
        await servicio.from('perfiles').update({ activo }).eq('id', p.id);
        return json({ ok: true });
      }

      default:
        return json({ error: 'Acción no válida' }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
