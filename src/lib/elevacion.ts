/**
 * Elevación del terreno (metros sobre el nivel del mar) para la diferencia de
 * altura del medidor de distancias.
 *
 * Fuente: Open-Meteo (modelo Copernicus GLO-90, ~90 m de resolución; gratuito,
 * sin llave). Se usa la misma fuente para los dos extremos: la altitud del GPS
 * del teléfono tiene un error vertical de 10–20 m y no se cancela.
 * Sin señal, la diferencia de altura no está disponible (lo demás sí).
 */
import { useEffect, useState } from 'react';
import type { LonLat } from './geo';

const cache = new Map<string, number>();
const clave = (p: LonLat) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`; // ~10 m

export async function elevaciones(puntos: LonLat[]): Promise<(number | null)[]> {
  const faltan = puntos.filter((p) => !cache.has(clave(p)));
  if (faltan.length) {
    try {
      const url =
        'https://api.open-meteo.com/v1/elevation?latitude=' +
        faltan.map((p) => p[1].toFixed(5)).join(',') +
        '&longitude=' +
        faltan.map((p) => p[0].toFixed(5)).join(',');
      const r = await fetch(url);
      if (r.ok) {
        const d = (await r.json()) as { elevation?: number[] };
        d.elevation?.forEach((e, i) => typeof e === 'number' && cache.set(clave(faltan[i]), e));
      }
    } catch {
      // sin señal
    }
  }
  return puntos.map((p) => cache.get(clave(p)) ?? null);
}

/**
 * Elevación de dos puntos (tú y el objetivo). Para tu posición solo se vuelve a
 * consultar si te moviste más de ~30 m.
 */
export function useDesnivel(desde: LonLat | null, hasta: LonLat | null): { tu: number | null; objetivo: number | null } {
  const [r, setR] = useState<{ tu: number | null; objetivo: number | null }>({ tu: null, objetivo: null });
  const kDesde = desde ? `${desde[0].toFixed(3)},${desde[1].toFixed(3)}` : '';
  const kHasta = hasta ? clave(hasta) : '';
  useEffect(() => {
    let vivo = true;
    const pts = [desde, hasta].filter(Boolean) as LonLat[];
    if (!pts.length) return;
    elevaciones(pts).then((e) => {
      if (!vivo) return;
      setR({ tu: desde ? e[0] : null, objetivo: hasta ? e[desde ? 1 : 0] : null });
    });
    return () => {
      vivo = false;
    };
    // Solo cambia cuando el punto cambia de forma relevante
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kDesde, kHasta]);
  return r;
}
