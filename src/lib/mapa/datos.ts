/**
 * Datos del mapa (lindero, caminos, espiaderos, capa base) desde `mapa_actual()`.
 * Se guardan en el teléfono: sin señal, el mapa muestra lo último descargado.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Feature, LineString, MultiPolygon, Point } from 'geojson';
import { useCallback, useEffect, useState } from 'react';
import type { LonLat } from '../geo';
import { supabase } from '../supabase';

export interface Espiadero {
  id: string;
  nombre: string;
  lon: number;
  lat: number;
  radio_m: number;
  altitud_m: number | null;
  origen: 'prueba' | 'kml' | 'manual';
}

export interface CapaBase {
  id: string;
  nombre: string;
  tipo: 'xyz' | 'pmtiles';
  url: string;
  minzoom: number;
  maxzoom: number;
  atribucion: string | null;
}

export interface DatosMapa {
  linderos: Feature<MultiPolygon>[];
  caminos: Feature<LineString>[];
  espiaderos: Espiadero[];
  capaBase: CapaBase | null;
  actualizado: string;
}

interface RespuestaMapa {
  linderos: Feature<MultiPolygon>[];
  caminos: Feature<LineString>[];
  espiaderos: Feature<Point, Omit<Espiadero, 'lon' | 'lat'>>[];
  capa_base: CapaBase | null;
}

const CLAVE = 'rll:mapa';

export function convertirRespuesta(r: RespuestaMapa): DatosMapa {
  return {
    linderos: r.linderos,
    caminos: r.caminos,
    espiaderos: r.espiaderos.map((f) => ({
      ...f.properties,
      altitud_m: f.properties.altitud_m == null ? null : Number(f.properties.altitud_m),
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    })),
    capaBase: r.capa_base,
    actualizado: new Date().toISOString(),
  };
}

const consultarMapa = () => supabase.rpc('mapa_actual');

export function useDatosMapa() {
  const [datos, setDatos] = useState<DatosMapa | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const aplicar = useCallback((r: Awaited<ReturnType<typeof consultarMapa>>) => {
    const { data, error: e } = r;
    if (e) {
      setError('Sin conexión: se muestra el último mapa descargado.');
    } else {
      const d = convertirRespuesta(data as RespuestaMapa);
      setDatos(d);
      setError(null);
      AsyncStorage.setItem(CLAVE, JSON.stringify(d)).catch(() => {});
    }
    setCargando(false);
  }, []);

  const recargar = useCallback(() => consultarMapa().then(aplicar), [aplicar]);

  useEffect(() => {
    AsyncStorage.getItem(CLAVE)
      .then((g) => {
        if (g) setDatos((actual) => actual ?? (JSON.parse(g) as DatosMapa));
      })
      .catch(() => {});
    consultarMapa().then(aplicar);
  }, [aplicar]);

  return { datos, error, cargando, recargar };
}

/** Rectángulo [oeste, sur, este, norte] que contiene el lindero (o los espiaderos). */
export function limites(d: DatosMapa): [number, number, number, number] | null {
  const pts: LonLat[] = [];
  d.linderos.forEach((l) => l.geometry.coordinates.forEach((p) => p[0].forEach((c) => pts.push([c[0], c[1]]))));
  if (!pts.length) d.espiaderos.forEach((e) => pts.push([e.lon, e.lat]));
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
