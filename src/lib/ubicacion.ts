/**
 * Ubicación GPS en vivo. Funciona sin datos móviles (el GPS no necesita señal).
 */
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export interface Ubicacion {
  lon: number;
  lat: number;
  altitud: number | null;
  precisionM: number | null;
  rumbo: number | null;
  fecha: number;
}

export type EstadoPermiso = 'pendiente' | 'concedido' | 'negado';

export function useUbicacion(activa = true) {
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null);
  const [permiso, setPermiso] = useState<EstadoPermiso>('pendiente');

  useEffect(() => {
    if (!activa) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelado = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelado) return;
      if (status !== 'granted') {
        setPermiso('negado');
        return;
      }
      setPermiso('concedido');
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 2, timeInterval: 2000 },
        (p) =>
          setUbicacion({
            lon: p.coords.longitude,
            lat: p.coords.latitude,
            altitud: p.coords.altitude ?? null,
            precisionM: p.coords.accuracy ?? null,
            rumbo: p.coords.heading ?? null,
            fecha: p.timestamp,
          }),
      );
      if (cancelado) sub.remove();
    })().catch(() => setPermiso('negado'));
    return () => {
      cancelado = true;
      sub?.remove();
    };
  }, [activa]);

  return { ubicacion, permiso };
}
