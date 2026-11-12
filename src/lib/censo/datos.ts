/**
 * Censo en curso, con tiempo real: cuando el admin inicia o termina un censo,
 * todos los teléfonos abiertos se enteran en uno o dos segundos.
 * Se guarda en el teléfono para poder capturar aunque se pierda la señal.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../supabase';
import { sincronizar } from './reloj';
import type { CensoActual, ResumenCenso } from './tipos';

const CLAVE = 'rll:censo-actual';

async function consultar(): Promise<CensoActual | null> {
  const t0 = Date.now();
  const { data, error } = await supabase.rpc('censo_actual');
  if (error || !data) return null;
  const d = data as CensoActual;
  sincronizar(d.hora_servidor, Date.now() - t0);
  return d;
}

export function useCensoActual() {
  const [datos, setDatos] = useState<CensoActual | null>(null);
  const [cargando, setCargando] = useState(true);

  const aplicar = useCallback((d: CensoActual | null) => {
    if (d) {
      setDatos(d);
      AsyncStorage.setItem(CLAVE, JSON.stringify(d)).catch(() => {});
    }
    setCargando(false);
  }, []);

  const recargar = useCallback(() => consultar().then(aplicar), [aplicar]);

  useEffect(() => {
    AsyncStorage.getItem(CLAVE)
      .then((g) => {
        if (g) setDatos((actual) => actual ?? (JSON.parse(g) as CensoActual));
      })
      .catch(() => {});
    consultar().then(aplicar);

    const canal = supabase
      .channel('censos-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'censos' }, () => {
        consultar().then(aplicar);
      })
      .subscribe();
    const sub = AppState.addEventListener('change', (e) => e === 'active' && consultar().then(aplicar));
    // Respaldo por si el tiempo real se corta
    const intervalo = setInterval(() => consultar().then(aplicar), 30_000);
    return () => {
      supabase.removeChannel(canal);
      sub.remove();
      clearInterval(intervalo);
    };
  }, [aplicar]);

  return { datos, cargando, recargar };
}

/** Resumen del censo; en vivo si está en curso (personal: cada registro nuevo lo actualiza). */
export function useResumen(censoId: string | undefined, enVivo: boolean) {
  const [resumen, setResumen] = useState<ResumenCenso | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    if (!censoId) return;
    const t0 = Date.now();
    const { data, error: e } = await supabase.rpc('resumen_censo', { p_id: censoId });
    if (e) {
      setError(e.message);
      return;
    }
    const r = data as ResumenCenso;
    sincronizar(r.hora_servidor, Date.now() - t0);
    setResumen(r);
    setError(null);
  }, [censoId]);

  useEffect(() => {
    if (!censoId) return;
    let pendiente: ReturnType<typeof setTimeout> | null = null;
    const programar = () => {
      if (pendiente) return;
      pendiente = setTimeout(() => {
        pendiente = null;
        recargar();
      }, 600);
    };
    programar();
    if (!enVivo) return;
    const canal = supabase
      .channel('registros-' + censoId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registros_censo', filter: `censo_id=eq.${censoId}` }, programar)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'censos', filter: `id=eq.${censoId}` }, programar)
      .subscribe();
    const intervalo = setInterval(programar, 15_000);
    return () => {
      supabase.removeChannel(canal);
      clearInterval(intervalo);
      if (pendiente) clearTimeout(pendiente);
    };
  }, [censoId, enVivo, recargar]);

  return { resumen, error, recargar };
}
