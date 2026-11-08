import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/**
 * Dirección pública de la web app. En producción:
 * EXPO_PUBLIC_APP_URL=https://app.rancholaslomas.com.mx
 */
export function urlBase(): string {
  const configurada = process.env.EXPO_PUBLIC_APP_URL;
  if (configurada) return configurada.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return '';
}

/** Enlace que abre el acceso de invitado con el código ya escrito (lo que codifica el QR). */
export function enlaceInvitado(codigo: string): string {
  const base = urlBase();
  if (base) return `${base}/acceso/invitado?codigo=${codigo}`;
  return Linking.createURL('/acceso/invitado', { queryParams: { codigo } });
}

/** ¿Corre como app instalada (desde la pantalla de inicio)? */
export function esAppInstalada(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}
