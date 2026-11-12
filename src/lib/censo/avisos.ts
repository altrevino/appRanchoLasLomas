/**
 * Avisos de inicio de censo (Web Push).
 *
 * En iPhone solo funcionan si la app se agregó a la pantalla de inicio
 * (iOS 16.4 o más reciente) y la persona aceptó el permiso.
 */
import { Platform } from 'react-native';
import { esAppInstalada } from '../enlaces';
import { supabase } from '../supabase';

const CLAVE_PUBLICA = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export type EstadoAvisos = 'activos' | 'apagados' | 'bloqueados' | 'requiere-instalar' | 'no-disponible';

function base64UrlABytes(b64: string): Uint8Array<ArrayBuffer> {
  const relleno = '='.repeat((4 - (b64.length % 4)) % 4);
  const s = atob((b64 + relleno).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
}

const esIOS = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);

export async function estadoAvisos(): Promise<EstadoAvisos> {
  if (Platform.OS !== 'web' || !CLAVE_PUBLICA) return 'no-disponible';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return esIOS() && !esAppInstalada() ? 'requiere-instalar' : 'no-disponible';
  }
  if (Notification.permission === 'denied') return 'bloqueados';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'activos' : 'apagados';
}

/** Pide permiso y registra este dispositivo. Debe llamarse desde un toque del usuario. */
export async function activarAvisos(): Promise<EstadoAvisos> {
  if (Platform.OS !== 'web') return 'no-disponible';
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return permiso === 'denied' ? 'bloqueados' : 'apagados';
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'));
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlABytes(CLAVE_PUBLICA) }));
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await supabase.rpc('guardar_suscripcion', {
    p_endpoint: j.endpoint,
    p_p256dh: j.keys.p256dh,
    p_auth: j.keys.auth,
    p_user_agent: navigator.userAgent,
  });
  if (error) throw new Error(error.message);
  return 'activos';
}

export async function desactivarAvisos(): Promise<void> {
  if (Platform.OS !== 'web') return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.rpc('borrar_suscripcion', { p_endpoint: sub.endpoint });
  await sub.unsubscribe();
}

/** El admin llama esto justo después de iniciar el censo. */
export async function enviarAvisoInicio(censoId: string): Promise<{ enviados: number } | null> {
  const { data, error } = await supabase.functions.invoke('avisar-censo', { body: { censo_id: censoId } });
  if (error) return null;
  return data as { enviados: number };
}
