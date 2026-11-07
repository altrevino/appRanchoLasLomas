/// <reference types="node" />
/**
 * Da de alta (o cambia de rol) a una persona del personal del rancho.
 *
 * Uso:
 *   npm run crear-usuario -- --correo juan@correo.com --nombre "Juan Pérez" --rol staff
 *   npm run crear-usuario -- --correo yo@correo.com --nombre "Alonso" --rol admin --contrasena "MiClave2026"
 *   npm run crear-usuario -- --correo juan@correo.com --desactivar
 *
 * Si no das contraseña se genera una y se imprime en pantalla para que se la pases.
 * Requiere en .env: EXPO_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js';
import { randomInt } from 'node:crypto';

const args = process.argv.slice(2);
const valor = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const correo = valor('correo')?.trim().toLowerCase();
const nombre = valor('nombre')?.trim();
const rol = valor('rol');
const desactivar = args.includes('--desactivar');
let contrasena = valor('contrasena');

if (!correo || (!desactivar && (!nombre || (rol !== 'admin' && rol !== 'staff')))) {
  console.error('Uso: npm run crear-usuario -- --correo X --nombre "Nombre" --rol admin|staff [--contrasena Y]');
  process.exit(1);
}

try {
  process.loadEnvFile('.env');
} catch {
  // sin .env
}
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !llave) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el archivo .env');
  process.exit(1);
}
const supabase = createClient(url, llave, { auth: { persistSession: false } });

// ¿Ya existe?
let existente: { id: string } | undefined;
for (let pagina = 1; !existente; pagina++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: pagina, perPage: 200 });
  if (error) throw error;
  existente = data.users.find((u) => u.email?.toLowerCase() === correo);
  if (data.users.length < 200) break;
}

if (desactivar) {
  if (!existente) {
    console.error('No existe un usuario con ese correo.');
    process.exit(1);
  }
  await supabase.from('perfiles').update({ activo: false }).eq('id', existente.id);
  await supabase.auth.admin.updateUserById(existente.id, { ban_duration: '876000h' });
  console.log(`Desactivado: ${correo}`);
  process.exit(0);
}

if (!contrasena && !existente) {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  contrasena = Array.from({ length: 12 }, () => letras[randomInt(letras.length)]).join('');
}

if (existente) {
  const { error } = await supabase.auth.admin.updateUserById(existente.id, {
    app_metadata: { rol, nombre },
    ...(contrasena ? { password: contrasena } : {}),
    ban_duration: 'none',
  });
  if (error) throw error;
  const { error: e2 } = await supabase.from('perfiles').upsert({ id: existente.id, nombre, rol, activo: true });
  if (e2) throw e2;
  console.log(`Actualizado: ${correo} → ${rol}`);
} else {
  const { error } = await supabase.auth.admin.createUser({
    email: correo,
    password: contrasena,
    email_confirm: true,
    app_metadata: { rol, nombre },
  });
  if (error) throw error;
  console.log(`Creado: ${nombre} <${correo}> como ${rol}`);
}
if (contrasena) console.log(`Contraseña: ${contrasena}`);
