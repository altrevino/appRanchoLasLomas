/// <reference types="node" />
/**
 * Simulación de censo con varios usuarios falsos, para probar sin ir al rancho.
 *
 * Uso:
 *   npm run simular                                  # 6 usuarios, 5 minutos
 *   npm run simular -- --usuarios 8 --minutos 10
 *   npm run simular -- --censo <id>                  # usar un censo ya iniciado desde la app
 *   npm run simular -- --sin-terminar                # no cierra el censo al final
 *
 * Qué hace:
 *   1. Crea usuarios temporales "Simulado 1..N" (personal).
 *   2. Si no le das --censo, crea e inicia un censo marcado como simulación con
 *      todos los espiaderos (no aparece mezclado con los reales: lleva la marca).
 *   3. Cada usuario se asigna a un espiadero y registra animales en tiempo real
 *      (hembras y crías más frecuentes que machos), a veces deshace, y a veces
 *      "pierde la señal" y envía sus registros tarde, como en el campo.
 *   4. Al terminar cierra el censo y borra los usuarios temporales (los conteos
 *      se conservan). Mientras corre, abre en la app Censo → Ver conteo en vivo.
 *
 * Requiere .env con EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const args = process.argv.slice(2);
const val = (n: string, d?: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const N = Math.max(1, Math.min(30, Number(val('usuarios', '6'))));
const MINUTOS = Math.max(1, Math.min(60, Number(val('minutos', '5'))));
let censoId = val('censo');
const terminar = !args.includes('--sin-terminar');

try {
  process.loadEnvFile('.env');
} catch {
  // sin .env
}
const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const publica = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const secreta = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !publica || !secreta) {
  console.error('Faltan variables en .env (ver README).');
  process.exit(1);
}
const opciones = { auth: { persistSession: false, autoRefreshToken: false } };
const servicio = createClient(url, secreta, opciones);

const CLASES = [
  ['hembra', 40],
  ['cria', 20],
  ['M1', 12],
  ['M2', 12],
  ['M3', 10],
  ['M4', 6],
] as const;
const clasePorPeso = () => {
  let r = Math.random() * 100;
  for (const [c, p] of CLASES) if ((r -= p) <= 0) return c;
  return 'hembra';
};
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
const marca = Math.random().toString(36).slice(2, 7);

interface Simulado {
  id: string;
  nombre: string;
  cliente: SupabaseClient;
}

const creados: Simulado[] = [];
async function limpiar() {
  for (const s of creados) await servicio.auth.admin.deleteUser(s.id).catch(() => {});
  if (creados.length) console.log(`Usuarios temporales borrados: ${creados.length}`);
}
process.on('SIGINT', async () => {
  console.log('\nInterrumpido.');
  if (censoId && terminar) await servicio.rpc('terminar_censo', { p_id: censoId });
  await limpiar();
  process.exit(130);
});

try {
  // 1. Usuarios
  for (let i = 1; i <= N; i++) {
    const correo = `simulado-${marca}-${i}@example.com`;
    const pass = randomUUID();
    const { data, error } = await servicio.auth.admin.createUser({
      email: correo,
      password: pass,
      email_confirm: true,
      app_metadata: { rol: 'staff', nombre: `Simulado ${i}` },
    });
    if (error) throw error;
    const cliente = createClient(url, publica, opciones);
    const r = await cliente.auth.signInWithPassword({ email: correo, password: pass });
    if (r.error) throw r.error;
    creados.push({ id: data.user.id, nombre: `Simulado ${i}`, cliente });
  }
  console.log(`Usuarios simulados: ${N}`);

  // 2. Censo
  let espiaderos: { id: string; nombre: string }[];
  if (!censoId) {
    const { data: esp } = await servicio.from('espiaderos').select('id, nombre').is('archivado_at', null).order('nombre');
    espiaderos = esp ?? [];
    const { data: c, error } = await servicio.rpc('crear_censo', {
      p_nombre: `Simulación ${new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}`,
      p_duracion_min: MINUTOS,
      p_espiaderos: espiaderos.map((e) => e.id),
      p_asignaciones: {},
      p_simulacion: true,
    });
    if (error) throw error;
    censoId = (c as { id: string }).id;
    const ini = await servicio.rpc('iniciar_censo', { p_id: censoId });
    if (ini.error) throw ini.error;
    console.log(`Censo de simulación iniciado (${MINUTOS} min).`);
  } else {
    const { data } = await servicio.from('censo_espiaderos').select('espiadero_id, espiaderos(nombre)').eq('censo_id', censoId);
    espiaderos = (data ?? []).map((x) => ({ id: x.espiadero_id, nombre: (x.espiaderos as unknown as { nombre: string }).nombre }));
  }
  const { data: censo } = await servicio.from('censos').select('fin_at, estado').eq('id', censoId).single();
  if (!censo || censo.estado !== 'en_curso') throw new Error('El censo no está en curso');
  const fin = new Date(censo.fin_at).getTime();
  console.log(`Abre la app: Censo → Ver conteo en vivo. Termina a las ${new Date(fin).toLocaleTimeString('es-MX', { timeZone: 'America/Monterrey' })}.\n`);

  // 3. Cada simulado cuenta en su espiadero
  let total = 0;
  let tardios = 0;
  await Promise.all(
    creados.map(async (s, i) => {
      const esp = espiaderos[i % espiaderos.length];
      const sinSenal = Math.random() < 0.3; // 30% simula zona sin señal
      const retenidos: object[] = [];
      let ultimo: string | null = null;
      while (Date.now() < fin - 1500) {
        await dormir(4000 + Math.random() * 20000);
        if (Date.now() >= fin - 1500) break;
        if (ultimo && Math.random() < 0.06) {
          await s.cliente.rpc('registrar_lote', { p_ops: [{ op: 'anular', id: ultimo }] });
          console.log(`  ${s.nombre} (${esp.nombre}) deshizo su último registro`);
          ultimo = null;
          continue;
        }
        const op = {
          op: 'registrar',
          id: randomUUID(),
          censo_id: censoId,
          espiadero_id: esp.id,
          clase: clasePorPeso(),
          capturado_at: new Date().toISOString(),
        };
        ultimo = op.id;
        total++;
        if (sinSenal) {
          retenidos.push(op);
          continue;
        }
        const { data, error } = await s.cliente.rpc('registrar_lote', { p_ops: [op] });
        if (error) console.log(`  ${s.nombre}: error ${error.message}`);
        else if ((data as { rechazados: unknown[] }).rechazados.length) console.log(`  ${s.nombre}: rechazado`, (data as { rechazados: unknown[] }).rechazados);
        else console.log(`  ${s.nombre} (${esp.nombre}): ${op.clase}`);
      }
      if (retenidos.length) {
        // Recupera la señal al final: envía todo junto (llegan tarde pero dentro del horario)
        await dormir(2000);
        const { data } = await s.cliente.rpc('registrar_lote', { p_ops: retenidos });
        const r = data as { aceptados: string[] };
        tardios += r.aceptados.length;
        console.log(`  ${s.nombre} (${esp.nombre}) recuperó la señal: envió ${r.aceptados.length} registros guardados`);
      }
    }),
  );

  // 4. Cierre
  if (terminar) {
    await servicio.rpc('terminar_censo', { p_id: censoId }).then(() => {}, () => {});
  }
  const { data: res } = await servicio.from('registros_censo').select('clase, anulado_at').eq('censo_id', censoId);
  const vigentes = (res ?? []).filter((r) => !r.anulado_at);
  console.log(`\nListo. Registros enviados: ${total} (${tardios} llegaron tarde por falta de señal). Vigentes en el servidor: ${vigentes.length}.`);
} catch (e) {
  console.error('Error:', (e as Error).message);
  process.exitCode = 1;
} finally {
  await limpiar();
}
