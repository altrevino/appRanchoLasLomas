/// <reference types="node" />
/**
 * Prueba de punta a punta contra el Supabase real: crea un admin temporal,
 * genera un código, entra como invitado, revisa permisos y borra todo al final.
 * Uso: npm run probar-servidor   (requiere .env con la llave secreta)
 */
import { createClient } from '@supabase/supabase-js';
process.loadEnvFile('.env');
const url = process.env.EXPO_PUBLIC_SUPABASE_URL!, pub = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!, sec = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const op = { auth: { persistSession: false } };
const servicio = createClient(url, sec, op);
const ok = (c: boolean, m: string) => { console.log((c ? 'ok   ' : 'FALLA') + ' - ' + m); if (!c) process.exitCode = 1; };
const correo = 'prueba-temporal@rancholaslomas.com.mx', pass = 'Temporal-' + Math.random().toString(36).slice(2);
// Limpiar restos de una corrida anterior
{
  const { data } = await servicio.auth.admin.listUsers({ perPage: 1000 });
  for (const x of data.users.filter((x) => x.email === correo)) await servicio.auth.admin.deleteUser(x.id);
}
const { data: u, error: e0 } = await servicio.auth.admin.createUser({ email: correo, password: pass, email_confirm: true, app_metadata: { rol: 'admin', nombre: 'Admin temporal' } });
if (e0) throw e0;
const ids = [u.user.id];
try {
  const admin = createClient(url, pub, op);
  const { error: e1 } = await admin.auth.signInWithPassword({ email: correo, password: pass });
  ok(!e1, 'admin entra con correo y contraseña');
  const { data: perf, error: ePerf } = await admin.from('perfiles').select('rol').eq('id', u.user.id).maybeSingle();
  if (ePerf) console.log('  detalle:', ePerf.message, ePerf.code);
  ok(perf?.rol === 'admin', 'el trigger creó el perfil admin');
  const { data: cod, error: e2 } = await admin.rpc('generar_codigo', { p_horas: 1, p_usos_max: 1, p_nota: 'prueba automática' });
  ok(!e2 && /^\d{6}$/.test(cod?.codigo), 'admin genera código ' + (cod?.codigo ?? e2?.message));

  const inv = createClient(url, pub, op);
  const { data: anon, error: e3 } = await inv.auth.signInAnonymously();
  ok(!e3, 'invitado obtiene sesión anónima ' + (e3?.message ?? ''));
  if (anon?.user) ids.push(anon.user.id);
  const { data: malo } = await inv.rpc('canjear_codigo', { p_codigo: '000001', p_nombre: 'X' });
  ok(!malo?.id, 'código incorrecto no da acceso');
  const { data: bueno, error: e4 } = await inv.rpc('canjear_codigo', { p_codigo: cod.codigo, p_nombre: 'Invitado Prueba' });
  ok(bueno?.rol === 'invitado', 'código correcto crea invitado ' + (e4?.message ?? ''));
  const { data: mapa } = await inv.rpc('mapa_actual');
  ok(mapa?.espiaderos?.length === 10 && mapa?.linderos?.length === 1 && mapa?.caminos?.length === 4, 'invitado ve el mapa (10 espiaderos, lindero, 4 caminos)');
  const { data: cods } = await inv.from('codigos_invitado').select('id');
  ok((cods ?? []).length === 0, 'invitado NO ve los códigos');
  const { data: perfs } = await inv.from('perfiles').select('id');
  ok((perfs ?? []).length === 1, 'invitado solo ve su propio perfil');
  const { error: e5 } = await inv.rpc('generar_codigo', { p_horas: 1 });
  ok(!!e5, 'invitado NO puede generar códigos');

  const inv2 = createClient(url, pub, op);
  const { data: anon2 } = await inv2.auth.signInAnonymously();
  if (anon2?.user) ids.push(anon2.user.id);
  const { data: segundo } = await inv2.rpc('canjear_codigo', { p_codigo: cod.codigo, p_nombre: 'Otro' });
  ok(!segundo?.id, 'código de 1 uso no sirve a una segunda persona');

  await admin.rpc('revocar_codigo', { p_id: cod.id });
  const { data: mapa2 } = await inv.rpc('mapa_actual');
  ok((mapa2?.espiaderos ?? []).length === 0, 'al revocar el código el invitado pierde acceso');
} finally {
  for (const id of ids) await servicio.auth.admin.deleteUser(id);
  await servicio.from('codigos_invitado').delete().eq('nota', 'prueba automática');
  await servicio.from('intentos_canje').delete().not('id', 'is', null);
  console.log('limpieza: usuarios temporales borrados', ids.length);
}
