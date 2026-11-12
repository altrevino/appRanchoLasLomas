/**
 * Estilo del mapa, compartido por iPhone (MapLibre nativo) y la vista web.
 *
 * Capa base, en este orden de preferencia:
 *   1. La capa activa en la tabla `capas_base` (ortomosaico propio, XYZ o PMTiles).
 *   2. MapTiler satelital, si hay EXPO_PUBLIC_MAPTILER_KEY.
 *   3. Esri World Imagery (solo para desarrollo; ver README).
 */
import type { FeatureCollection, Polygon } from 'geojson';
import { paleta } from '../../theme';
import type { CapaBase, DatosMapa, Espiadero } from './datos';

const maptilerKey = process.env.EXPO_PUBLIC_MAPTILER_KEY ?? '';

export interface FuenteRaster {
  tiles?: string[];
  url?: string;
  tileSize: number;
  minzoom: number;
  maxzoom: number;
  attribution: string;
}

export function fuenteBase(capa: CapaBase | null): FuenteRaster {
  if (capa?.tipo === 'xyz') {
    return { tiles: [capa.url], tileSize: 256, minzoom: capa.minzoom, maxzoom: capa.maxzoom, attribution: capa.atribucion ?? '' };
  }
  if (capa?.tipo === 'pmtiles') {
    const url = capa.url.startsWith('pmtiles://') ? capa.url : `pmtiles://${capa.url}`;
    return { url, tileSize: 256, minzoom: capa.minzoom, maxzoom: capa.maxzoom, attribution: capa.atribucion ?? '' };
  }
  if (maptilerKey) {
    return {
      tiles: [`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${maptilerKey}`],
      tileSize: 512,
      minzoom: 0,
      maxzoom: 20,
      attribution: '© MapTiler © OpenStreetMap',
    };
  }
  return {
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    tileSize: 256,
    minzoom: 0,
    maxzoom: 19,
    attribution: 'Esri, Maxar, Earthstar Geographics',
  };
}

/** Estilo base (solo satelital). Las capas del rancho se agregan encima. */
export function estiloBase(capa: CapaBase | null) {
  const f = fuenteBase(capa);
  return {
    version: 8 as const,
    sources: { satelite: { type: 'raster' as const, ...f } },
    layers: [
      { id: 'fondo', type: 'background' as const, paint: { 'background-color': paleta.verdeNoche } },
      { id: 'satelite', type: 'raster' as const, source: 'satelite' },
    ],
  };
}

/** Círculo geodésico aproximado (para dibujar el radio de detección). */
export function circulo(lon: number, lat: number, radioM: number, lados = 48): Polygon {
  const coords: [number, number][] = [];
  const dLat = radioM / 110540;
  const dLon = radioM / (111320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= lados; i++) {
    const a = (i / lados) * 2 * Math.PI;
    coords.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: 'Polygon', coordinates: [coords] };
}

export function radiosGeoJson(espiaderos: Espiadero[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: espiaderos.map((e) => ({ type: 'Feature', id: e.id, properties: { id: e.id }, geometry: circulo(e.lon, e.lat, e.radio_m) })),
  };
}

export const coleccion = <T extends DatosMapa['linderos'][number] | DatosMapa['caminos'][number]>(f: T[]): FeatureCollection =>
  ({ type: 'FeatureCollection', features: f }) as FeatureCollection;

/** Capas del rancho (misma especificación para nativo y web). */
export const capas = {
  radioRelleno: {
    id: 'radio-relleno',
    type: 'fill' as const,
    paint: { 'fill-color': paleta.hueso, 'fill-opacity': 0.08 },
  },
  radioBorde: {
    id: 'radio-borde',
    type: 'line' as const,
    paint: { 'line-color': paleta.hueso, 'line-opacity': 0.45, 'line-width': 1, 'line-dasharray': [2, 2] },
  },
  caminos: {
    id: 'caminos',
    type: 'line' as const,
    layout: { 'line-cap': 'round' as const, 'line-join': 'round' as const },
    paint: { 'line-color': paleta.hueso, 'line-opacity': 0.55, 'line-width': 2.5 },
  },
  linderoSombra: {
    id: 'lindero-sombra',
    type: 'line' as const,
    paint: { 'line-color': paleta.verdeNoche, 'line-opacity': 0.6, 'line-width': 6 },
  },
  lindero: {
    id: 'lindero',
    type: 'line' as const,
    paint: { 'line-color': paleta.arena, 'line-width': 3 },
  },
};

/** Línea de medición (tú → objetivo) y punto objetivo. */
export function medidaGeoJson(desde: [number, number] | null, hasta: [number, number] | null): FeatureCollection {
  const features: FeatureCollection['features'] = [];
  if (hasta) features.push({ type: 'Feature', properties: { tipo: 'objetivo' }, geometry: { type: 'Point', coordinates: hasta } });
  if (desde && hasta) features.push({ type: 'Feature', properties: { tipo: 'linea' }, geometry: { type: 'LineString', coordinates: [desde, hasta] } });
  return { type: 'FeatureCollection', features };
}

export interface PuntoAvistamiento {
  id: string;
  macho_id: string;
  folio: string;
  apodo: string | null;
  clase: string;
  observado_at: string;
  lon: number;
  lat: number;
}

export function avistamientosGeoJson(lista: PuntoAvistamiento[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: lista.map((a) => ({ type: 'Feature', id: a.id, properties: { id: a.id }, geometry: { type: 'Point', coordinates: [a.lon, a.lat] } })),
  };
}

export const capasMedida = {
  linea: {
    id: 'medida-linea',
    type: 'line' as const,
    filter: ['==', ['get', 'tipo'], 'linea'] as ['==', ['get', string], string],
    layout: { 'line-cap': 'round' as const },
    paint: { 'line-color': paleta.arena, 'line-width': 3, 'line-dasharray': [1.5, 1.5] },
  },
  objetivo: {
    id: 'medida-objetivo',
    type: 'circle' as const,
    filter: ['==', ['get', 'tipo'], 'objetivo'] as ['==', ['get', string], string],
    paint: { 'circle-radius': 9, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': paleta.arena, 'circle-stroke-width': 3 },
  },
  avistamientos: {
    id: 'avistamientos',
    type: 'circle' as const,
    paint: { 'circle-radius': 6, 'circle-color': paleta.hueso, 'circle-stroke-color': paleta.verdeBosque, 'circle-stroke-width': 2, 'circle-opacity': 0.9 },
  },
};

/** Tolerancia de toque en metros según el zoom (≈ 28 px de pantalla). */
export function toleranciaToqueM(zoom: number, lat: number): number {
  const metrosPorPx = (156543.03 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
  return metrosPorPx * 28;
}
