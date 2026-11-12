// Envía el aviso "Censo iniciado" (Web Push) a todos los dispositivos suscritos
// de personas con acceso vigente. La llama la app del admin justo después de
// iniciar_censo(). Requiere los secretos VAPID_KEYS y VAPID_CONTACTO.
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as webpush from 'jsr:@negrel/webpush@0.5.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const { data: esAdmin } = await usuario.rpc('es_admin');
  if (esAdmin !== true) return json({ error: 'Solo el administrador puede enviar avisos' }, 403);

  const { censo_id } = await req.json().catch(() => ({}));
  const servicio = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: censo } = await servicio.from('censos').select('id, nombre, estado, fin_at').eq('id', censo_id).maybeSingle();
  if (!censo || censo.estado !== 'en_curso') return json({ error: 'El censo no está en curso' }, 400);

  const { data: subs, error } = await servicio
    .from('suscripciones_push')
    .select('id, endpoint, p256dh, auth, perfiles!inner(activo, expira_en)')
    .eq('perfiles.activo', true);
  if (error) return json({ error: error.message }, 500);
  const ahora = Date.now();
  const vigentes = (subs ?? []).filter((s) => {
    const p = s.perfiles as unknown as { expira_en: string | null };
    return !p.expira_en || new Date(p.expira_en).getTime() > ahora;
  });

  const vapidKeys = await webpush.importVapidKeys(JSON.parse(Deno.env.get('VAPID_KEYS')!), { extractable: false });
  const servidor = await webpush.ApplicationServer.new({
    contactInformation: 'mailto:' + (Deno.env.get('VAPID_CONTACTO') ?? 'contacto@rancholaslomas.com.mx'),
    vapidKeys,
  });
  const minutos = Math.max(1, Math.round((new Date(censo.fin_at).getTime() - ahora) / 60000));
  const mensaje = JSON.stringify({
    titulo: 'Censo iniciado',
    cuerpo: `${censo.nombre} · ${minutos} min. Toca para entrar a la captura.`,
    url: '/captura',
    censo_id: censo.id,
  });

  const resultados = await Promise.allSettled(
    vigentes.map((s) =>
      servidor
        .subscribe({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } })
        .pushTextMessage(mensaje, { urgency: webpush.Urgency.High, ttl: minutos * 60, topic: 'censo' }),
    ),
  );

  // Suscripciones que ya no existen (el usuario borró la app o quitó el permiso)
  const muertas = vigentes.filter((_, i) => {
    const r = resultados[i];
    if (r.status === 'fulfilled') return false;
    const st = (r.reason as { response?: Response })?.response?.status;
    return st === 404 || st === 410;
  });
  if (muertas.length) await servicio.from('suscripciones_push').delete().in('id', muertas.map((m) => m.id));

  return json({
    enviados: resultados.filter((r) => r.status === 'fulfilled').length,
    fallidos: resultados.filter((r) => r.status === 'rejected').length,
    borrados: muertas.length,
  });
});
