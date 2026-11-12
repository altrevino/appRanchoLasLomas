/**
 * Lector de KML/KMZ. Lo usan la app (Administración → Importar KML) y el
 * script de línea de comandos (scripts/importar-kml.ts), así ambos detectan
 * exactamente lo mismo.
 *
 * Detecta automáticamente:
 *   - Polígonos → lindero
 *   - Líneas    → caminos
 *   - Puntos    → espiaderos
 * y conserva los nombres del KML.
 */
import { kml as kmlAGeoJson } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';
import { strFromU8, unzipSync } from 'fflate';
import type { Geometry } from 'geojson';
import { distanciaM, puntoEnPoligono, type LonLat } from '../geo';

/** Separación mínima esperada entre espiaderos (por debajo se advierte). */
export const SEPARACION_MINIMA_M = 400;

export interface LinderoKml {
  nombre: string;
  /** Anillos del polígono: [exterior, ...huecos], cada uno [[lon, lat], ...]. */
  coordenadas: LonLat[][];
}
export interface CaminoKml {
  nombre: string;
  coordenadas: LonLat[];
}
export interface EspiaderoKml {
  nombre: string;
  lon: number;
  lat: number;
  altitud: number | null;
}
export interface LugarKml {
  nombre: string;
  tipo: 'casa' | 'referencia';
  lon: number;
  lat: number;
  altitud: number | null;
}
/** Formato que recibe la función `importar_kml` de la base de datos. */
export interface DatosKml {
  linderos: LinderoKml[];
  caminos: CaminoKml[];
  espiaderos: EspiaderoKml[];
  /** Puntos que no son espiaderos (p. ej. la Casa): se ven en el mapa, no van a censos. */
  lugares: LugarKml[];
}

/** Nombres de puntos que se cargan como lugar y no como espiadero. */
export const NOMBRES_LUGAR: Record<string, LugarKml['tipo']> = { casa: 'casa', 'casa principal': 'casa' };
export interface Advertencia {
  /** `error` impide importar; `aviso` solo informa. */
  gravedad: 'error' | 'aviso';
  mensaje: string;
}
export interface LecturaKml {
  datos: DatosKml;
  advertencias: Advertencia[];
  /** Elementos que no son polígono, línea ni punto (se ignoran). */
  ignorados: number;
}

const normalizar = (t: string) =>
  t
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');

const dosD = (c: number[]): LonLat => [Number(c[0].toFixed(7)), Number(c[1].toFixed(7))];

/** Acepta el contenido de un .kml (texto) o de un .kmz (bytes zip). */
export function leerArchivoKml(contenido: string | Uint8Array, lugaresExtra: string[] = []): LecturaKml {
  let texto: string;
  if (typeof contenido === 'string') {
    texto = contenido;
  } else if (contenido[0] === 0x50 && contenido[1] === 0x4b) {
    // KMZ: zip con un doc.kml adentro
    const archivos = unzipSync(contenido);
    const nombre = Object.keys(archivos).find((n) => n.toLowerCase() === 'doc.kml') ?? Object.keys(archivos).find((n) => n.toLowerCase().endsWith('.kml'));
    if (!nombre) throw new Error('El KMZ no contiene ningún archivo .kml');
    texto = strFromU8(archivos[nombre]);
  } else {
    texto = strFromU8(contenido);
  }
  return leerKml(texto, lugaresExtra);
}

export function leerKml(texto: string, lugaresExtra: string[] = []): LecturaKml {
  const doc = new DOMParser({ onError: () => {} }).parseFromString(texto, 'text/xml');
  if (!doc || !doc.getElementsByTagName('kml').length) {
    throw new Error('El archivo no parece ser un KML válido');
  }
  const geo = kmlAGeoJson(doc as unknown as Document);

  const datos: DatosKml = { linderos: [], caminos: [], espiaderos: [], lugares: [] };
  const extra = new Set(lugaresExtra.map(normalizar));
  const advertencias: Advertencia[] = [];
  let ignorados = 0;
  let sinNombre = 0;

  const agregar = (g: Geometry | null, nombreOriginal: string) => {
    if (!g) {
      ignorados++;
      return;
    }
    switch (g.type) {
      case 'Polygon':
        datos.linderos.push({ nombre: nombreOriginal || 'Lindero', coordenadas: g.coordinates.map((a) => a.map(dosD)) });
        break;
      case 'MultiPolygon':
        g.coordinates.forEach((p, i) =>
          datos.linderos.push({ nombre: `${nombreOriginal || 'Lindero'}${g.coordinates.length > 1 ? ` ${i + 1}` : ''}`, coordenadas: p.map((a) => a.map(dosD)) }),
        );
        break;
      case 'LineString':
        if (g.coordinates.length >= 2) datos.caminos.push({ nombre: nombreOriginal || 'Camino', coordenadas: g.coordinates.map(dosD) });
        else ignorados++;
        break;
      case 'MultiLineString':
        g.coordinates.forEach((l, i) => {
          if (l.length >= 2) datos.caminos.push({ nombre: `${nombreOriginal || 'Camino'}${g.coordinates.length > 1 ? ` ${i + 1}` : ''}`, coordenadas: l.map(dosD) });
        });
        break;
      case 'Point': {
        let nombre = nombreOriginal;
        if (!nombre) {
          sinNombre++;
          nombre = `Espiadero sin nombre ${sinNombre}`;
        }
        const alt = g.coordinates[2];
        const clave = normalizar(nombre);
        if (NOMBRES_LUGAR[clave] || extra.has(clave)) {
          datos.lugares.push({
            nombre,
            tipo: NOMBRES_LUGAR[clave] ?? 'referencia',
            lon: Number(g.coordinates[0].toFixed(7)),
            lat: Number(g.coordinates[1].toFixed(7)),
            altitud: typeof alt === 'number' && alt !== 0 ? Math.round(alt * 10) / 10 : null,
          });
          break;
        }
        datos.espiaderos.push({
          nombre,
          lon: Number(g.coordinates[0].toFixed(7)),
          lat: Number(g.coordinates[1].toFixed(7)),
          // KML suele traer 0 cuando el punto va "pegado al terreno": se toma como dato ausente.
          altitud: typeof alt === 'number' && alt !== 0 ? Math.round(alt * 10) / 10 : null,
        });
        break;
      }
      case 'MultiPoint':
        g.coordinates.forEach((c, i) => agregar({ type: 'Point', coordinates: c }, nombreOriginal ? `${nombreOriginal} ${i + 1}` : ''));
        break;
      case 'GeometryCollection':
        g.geometries.forEach((sub) => agregar(sub, nombreOriginal));
        break;
      default:
        ignorados++;
    }
  };

  for (const f of geo.features) {
    const nombre = typeof f.properties?.name === 'string' ? f.properties.name.trim() : '';
    agregar(f.geometry as Geometry | null, nombre);
  }

  // --- Advertencias -------------------------------------------------------
  if (!datos.linderos.length) {
    advertencias.push({ gravedad: 'error', mensaje: 'No se encontró el lindero (ningún polígono).' });
  } else if (datos.linderos.length > 1) {
    advertencias.push({ gravedad: 'aviso', mensaje: `Se encontraron ${datos.linderos.length} polígonos; todos se cargarán como lindero.` });
  }
  if (!datos.espiaderos.length) {
    advertencias.push({ gravedad: 'error', mensaje: 'No se encontraron espiaderos (ningún punto).' });
  }
  if (sinNombre) {
    advertencias.push({
      gravedad: 'aviso',
      mensaje: `${sinNombre} punto(s) sin nombre. Se cargarán como "Espiadero sin nombre N"; conviene ponerles nombre en el KML.`,
    });
  }

  const vistos = new Map<string, string>();
  for (const e of datos.espiaderos) {
    const clave = normalizar(e.nombre);
    if (vistos.has(clave)) {
      advertencias.push({ gravedad: 'error', mensaje: `Nombre repetido: "${e.nombre}". Cada espiadero debe tener un nombre distinto.` });
    }
    vistos.set(clave, e.nombre);
  }

  for (let i = 0; i < datos.espiaderos.length; i++) {
    for (let j = i + 1; j < datos.espiaderos.length; j++) {
      const a = datos.espiaderos[i];
      const b = datos.espiaderos[j];
      const d = distanciaM([a.lon, a.lat], [b.lon, b.lat]);
      if (d < SEPARACION_MINIMA_M) {
        advertencias.push({ gravedad: 'aviso', mensaje: `"${a.nombre}" y "${b.nombre}" están a ${Math.round(d)} m (menos de ${SEPARACION_MINIMA_M} m).` });
      }
    }
  }

  if (datos.linderos.length) {
    const fuera = datos.espiaderos.filter((e) => !datos.linderos.some((l) => puntoEnPoligono([e.lon, e.lat], l.coordenadas)));
    if (fuera.length) {
      advertencias.push({ gravedad: 'aviso', mensaje: `Fuera del lindero: ${fuera.map((e) => `"${e.nombre}"`).join(', ')}.` });
    }
  }
  if (ignorados) {
    advertencias.push({ gravedad: 'aviso', mensaje: `${ignorados} elemento(s) sin geometría útil se ignoraron.` });
  }

  return { datos, advertencias, ignorados };
}

export const hayErrores = (l: LecturaKml) => l.advertencias.some((a) => a.gravedad === 'error');
