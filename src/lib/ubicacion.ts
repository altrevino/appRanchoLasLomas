/**
 * Ubicación GPS en vivo. Funciona sin datos móviles (el GPS no necesita señal).
 *
 * Un solo seguimiento de GPS para toda la app, compartido por todas las
 * pantallas que lo usan (mapa, captura): ahorra batería y evita un error de
 * expo-location en web con varios seguimientos simultáneos. En web se usa
 * directamente la API del navegador.
 */
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export interface Ubicacion {
  lon: number;
  lat: number;
  altitud: number | null;
  precisionM: number | null;
  rumbo: number | null;
  fecha: number;
}

export type EstadoPermiso = 'pendiente' | 'concedido' | 'negado';

interface Estado {
  ubicacion: Ubicacion | null;
  permiso: EstadoPermiso;
}

let estado: Estado = { ubicacion: null, permiso: 'pendiente' };
const oyentes = new Set<(e: Estado) => void>();
let usuarios = 0;
let detener: (() => void) | null = null;

function publicar(cambio: Partial<Estado>) {
  estado = { ...estado, ...cambio };
  oyentes.forEach((f) => f(estado));
}

const desdeCoords = (c: GeolocationCoordinates | Location.LocationObjectCoords, fecha: number): Ubicacion => ({
  lon: c.longitude,
  lat: c.latitude,
  altitud: c.altitude ?? null,
  precisionM: c.accuracy ?? null,
  rumbo: c.heading ?? null,
  fecha,
});

function iniciar() {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      publicar({ permiso: 'negado' });
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => publicar({ ubicacion: desdeCoords(p.coords, p.timestamp), permiso: 'concedido' }),
      (e) => {
        if (e.code === e.PERMISSION_DENIED) publicar({ permiso: 'negado' });
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    );
    detener = () => navigator.geolocation.clearWatch(id);
    return;
  }

  let sub: Location.LocationSubscription | null = null;
  let cancelado = false;
  detener = () => {
    cancelado = true;
    sub?.remove();
  };
  (async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (cancelado) return;
    if (status !== 'granted') return publicar({ permiso: 'negado' });
    publicar({ permiso: 'concedido' });
    sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 2, timeInterval: 2000 },
      (p) => publicar({ ubicacion: desdeCoords(p.coords, p.timestamp) }),
    );
    if (cancelado) sub.remove();
  })().catch(() => publicar({ permiso: 'negado' }));
}

export function useUbicacion(activa = true) {
  const [e, setE] = useState<Estado>(estado);
  useEffect(() => {
    if (!activa) return;
    oyentes.add(setE);
    usuarios += 1;
    if (usuarios === 1) iniciar();
    else setTimeout(() => setE(estado), 0);
    return () => {
      oyentes.delete(setE);
      usuarios -= 1;
      if (usuarios === 0) {
        detener?.();
        detener = null;
      }
    };
  }, [activa]);
  return e;
}
