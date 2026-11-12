/**
 * Cola local de registros del censo y avistamientos de la bitácora.
 *
 * Cada toque (o avistamiento, con su foto) se guarda primero en el teléfono y después se envía. Si no hay
 * señal, se reintenta: al volver la conexión, al regresar a la app y cada 10 s
 * mientras esté abierta. El servidor ignora duplicados (cada registro lleva su
 * id), así que reintentar nunca cuenta doble.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { subirFoto } from '../bitacora/fotos';
import { supabase } from '../supabase';
import type { Clase } from './tipos';

const CLAVE = 'rll:cola';
const CLAVE_RECHAZOS = 'rll:cola-rechazos';
const LOTE = 200;

export type Operacion =
  | {
      op: 'registrar';
      id: string;
      censo_id: string;
      espiadero_id: string;
      clase: Clase;
      capturado_at: string;
      lon?: number | null;
      lat?: number | null;
      precision_m?: number | null;
    }
  | { op: 'anular'; id: string }
  | {
      op: 'avistamiento';
      id: string;
      /** Datos para registrar_avistamiento (ver migración de la fase c). */
      datos: Record<string, unknown>;
      /** Foto pendiente de subir (JPEG en base64). */
      foto?: { id: string; ruta: string; base64: string; tomada_at: string } | null;
    };

export interface Rechazo {
  id: string;
  motivo: string;
}

let cola: Operacion[] = [];
let cargada = false;
let enviando = false;
const oyentes = new Set<(n: number) => void>();
// Cada envío exitoso incrementa este contador (las pantallas lo usan para recargar).
let envios = 0;
const oyentesEnvio = new Set<(n: number) => void>();
function avisarEnvio() {
  envios += 1;
  oyentesEnvio.forEach((f) => f(envios));
}

async function cargar() {
  if (cargada) return;
  try {
    const g = await AsyncStorage.getItem(CLAVE);
    const guardada = g ? (JSON.parse(g) as Operacion[]) : [];
    // Lo que se haya encolado mientras se cargaba va después de lo guardado.
    cola = [...guardada, ...cola];
  } catch {
    // almacenamiento no disponible: la cola vive en memoria
  }
  cargada = true;
  avisar();
}

async function guardar() {
  try {
    await AsyncStorage.setItem(CLAVE, JSON.stringify(cola));
  } catch {
    // sin almacenamiento: se conserva en memoria
  }
}

function avisar() {
  oyentes.forEach((f) => f(cola.length));
}

export async function encolar(op: Operacion) {
  cola.push(op);
  avisar();
  await cargar();
  await guardar();
  enviar();
}

/** Envía lo pendiente. Devuelve cuántas operaciones quedan. */
export async function enviar(): Promise<number> {
  await cargar();
  if (enviando || cola.length === 0) return cola.length;
  enviando = true;
  try {
    while (cola.length) {
      // Avistamientos: uno por uno (primero la foto, luego el registro)
      if (cola[0].op === 'avistamiento') {
        const a = cola[0];
        try {
          if (a.foto) await subirFoto(a.foto.ruta, a.foto.base64);
          const { error } = await supabase.rpc('registrar_avistamiento', {
            p: { ...a.datos, foto: a.foto ? { id: a.foto.id, storage_path: a.foto.ruta, tomada_at: a.foto.tomada_at } : null },
          });
          if (error) {
            // Error de datos (no de red): se aparta para no bloquear la cola
            if (error.code && error.code !== 'PGRST301' && !/fetch|network/i.test(error.message)) {
              await guardarRechazos([{ id: a.id, motivo: error.message }]);
              cola = cola.filter((o) => o !== a);
              await guardar();
              avisar();
              continue;
            }
            break;
          }
        } catch {
          break; // sin señal: se reintenta después
        }
        cola = cola.filter((o) => o !== a);
        await guardar();
        avisar();
        avisarEnvio();
        continue;
      }

      // Censo: en lotes de operaciones consecutivas
      const fin = cola.findIndex((o) => o.op === 'avistamiento');
      const lote = cola.slice(0, Math.min(LOTE, fin === -1 ? cola.length : fin));
      const { data, error } = await supabase.rpc('registrar_lote', { p_ops: lote });
      if (error) break; // sin señal o sesión vencida: se reintenta después
      const r = data as { aceptados: string[]; rechazados: Rechazo[] };
      const listos = new Set([...r.aceptados, ...r.rechazados.map((x) => x.id)]);
      cola = cola.filter((o, i) => !(i < lote.length && listos.has(o.id)));
      if (r.rechazados.length) await guardarRechazos(r.rechazados);
      await guardar();
      avisar();
      if (r.aceptados.length) avisarEnvio();
      if (listos.size === 0) break;
    }
  } finally {
    enviando = false;
  }
  return cola.length;
}

async function guardarRechazos(nuevos: Rechazo[]) {
  try {
    const g = await AsyncStorage.getItem(CLAVE_RECHAZOS);
    const previos = g ? (JSON.parse(g) as Rechazo[]) : [];
    await AsyncStorage.setItem(CLAVE_RECHAZOS, JSON.stringify([...previos, ...nuevos].slice(-200)));
  } catch {
    // no crítico
  }
}

export async function rechazados(): Promise<Rechazo[]> {
  try {
    const g = await AsyncStorage.getItem(CLAVE_RECHAZOS);
    return g ? (JSON.parse(g) as Rechazo[]) : [];
  } catch {
    return [];
  }
}

/** Operaciones aún no enviadas (para mostrar los conteos propios sin señal). */
export async function pendientes(): Promise<Operacion[]> {
  await cargar();
  return [...cola];
}

// Reintentos automáticos
let iniciado = false;
function iniciarReintentos() {
  if (iniciado) return;
  iniciado = true;
  cargar().then(() => enviar());
  setInterval(() => enviar(), 10_000);
  AppState.addEventListener('change', (e) => e === 'active' && enviar());
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('online', () => enviar());
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && enviar());
  }
}

/** Número de registros pendientes por enviar (se actualiza solo). */
export function usePendientes(): number {
  const [n, setN] = useState(cola.length);
  useEffect(() => {
    iniciarReintentos();
    oyentes.add(setN);
    cargar().then(() => setN(cola.length));
    return () => {
      oyentes.delete(setN);
    };
  }, []);
  return n;
}

/** Número que cambia cada vez que la cola envía algo con éxito. */
export function useEnvios(): number {
  const [n, setN] = useState(envios);
  useEffect(() => {
    iniciarReintentos();
    oyentesEnvio.add(setN);
    return () => {
      oyentesEnvio.delete(setN);
    };
  }, []);
  return n;
}
