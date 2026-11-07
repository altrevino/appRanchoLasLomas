import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const llavePublica = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** false si faltan las variables de entorno (la app lo indica en pantalla). */
export const supabaseConfigurado = Boolean(url && llavePublica);

export const supabase = createClient(url || 'http://sin-configurar.invalid', llavePublica || 'sin-configurar', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refrescar el token solo con la app en primer plano (recomendación de Supabase para RN).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export type Rol = 'admin' | 'staff' | 'invitado';

export interface Perfil {
  id: string;
  nombre: string;
  rol: Rol;
  expira_en: string | null;
  activo: boolean;
}

/** Mensaje entendible para errores de Supabase. */
export function mensajeDeError(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/Failed to fetch|Network request failed|network/i.test(m)) return 'Sin conexión. Revisa la señal e intenta de nuevo.';
  if (/Anonymous sign-ins are disabled/i.test(m)) return 'El acceso de invitados no está habilitado en el servidor.';
  return m;
}
