/**
 * Datos de la bitácora (solo personal). La lista se guarda en el teléfono para
 * poder buscar parecidos y consultar fichas sin señal.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import type { ClaseMacho, Forma, CuernoRoto, Macho } from './tipos';

const CLAVE = 'rll:machos';
const COLUMNAS =
  'id, folio, apodo, clase_actual, estado, estado_efectivo, nota, foto_portada_id, portada_path, primer_avistamiento_at, ultimo_avistamiento_at, ultimo_espiadero_id, ultimo_espiadero_nombre, ultimo_lon, ultimo_lat, num_avistamientos, creado_at, puntas_izq, puntas_der, forma, puntas_anomalas, cuerno_roto, cicatrices, oreja_marcada';

const consultarMachos = () =>
  supabase.from('v_machos').select(COLUMNAS).neq('estado', 'fusionado').order('ultimo_avistamiento_at', { ascending: false, nullsFirst: false });

export function useMachos() {
  const [machos, setMachos] = useState<Macho[] | null>(null);
  const [sinConexion, setSinConexion] = useState(false);

  const aplicar = useCallback((r: Awaited<ReturnType<typeof consultarMachos>>) => {
    if (r.error) {
      setSinConexion(true);
      return;
    }
    const lista = (r.data ?? []).map((m) => ({ ...m, num_avistamientos: Number(m.num_avistamientos) })) as Macho[];
    setMachos(lista);
    setSinConexion(false);
    AsyncStorage.setItem(CLAVE, JSON.stringify(lista)).catch(() => {});
  }, []);

  const recargar = useCallback(() => consultarMachos().then(aplicar), [aplicar]);

  useEffect(() => {
    AsyncStorage.getItem(CLAVE)
      .then((g) => {
        if (g) setMachos((a) => a ?? (JSON.parse(g) as Macho[]));
      })
      .catch(() => {});
    consultarMachos().then(aplicar);
  }, [aplicar]);

  return { machos, sinConexion, recargar };
}

export interface AvistamientoFicha {
  id: string;
  observado_at: string;
  clase_observada: ClaseMacho | null;
  nota: string | null;
  espiadero_id: string | null;
  espiaderos: { nombre: string } | null;
  perfiles: { nombre: string } | null;
  puntas_izq: number | null;
  puntas_der: number | null;
  forma: Forma | null;
  cuerno_roto: CuernoRoto | null;
}
export interface FotoFicha {
  id: string;
  storage_path: string;
  tomada_at: string;
}
export interface CambioClase {
  id: number;
  clase: ClaseMacho;
  desde: string;
  perfiles: { nombre: string } | null;
}
export interface Ficha {
  macho: Macho;
  avistamientos: AvistamientoFicha[];
  fotos: FotoFicha[];
  clases: CambioClase[];
}

export function useFicha(id: string | undefined) {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!id) return;
    const [m, a, f, h] = await Promise.all([
      supabase.from('v_machos').select(COLUMNAS + ', fusionado_en').eq('id', id).maybeSingle(),
      supabase
        .from('avistamientos')
        .select('id, observado_at, clase_observada, nota, espiadero_id, puntas_izq, puntas_der, forma, cuerno_roto, espiaderos(nombre), perfiles(nombre)')
        .eq('macho_id', id)
        .order('observado_at', { ascending: false }),
      supabase.from('fotos').select('id, storage_path, tomada_at').eq('macho_id', id).order('tomada_at', { ascending: false }),
      supabase.from('historial_clase').select('id, clase, desde, perfiles:registrado_por(nombre)').eq('macho_id', id).order('desde', { ascending: true }),
    ]);
    if (m.error || !m.data) {
      setError(m.error ? 'Sin conexión: no se pudo cargar la ficha.' : 'Ejemplar no encontrado.');
      return;
    }
    setError(null);
    setFicha({
      macho: { ...(m.data as unknown as Macho), num_avistamientos: Number((m.data as unknown as Macho).num_avistamientos) },
      avistamientos: (a.data ?? []) as unknown as AvistamientoFicha[],
      fotos: (f.data ?? []) as FotoFicha[],
      clases: (h.data ?? []) as unknown as CambioClase[],
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let vivo = true;
    Promise.resolve().then(() => {
      if (vivo) cargar();
    });
    return () => {
      vivo = false;
    };
  }, [id, cargar]);

  return { ficha, error, recargar: cargar };
}
