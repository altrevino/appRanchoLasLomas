/**
 * Cálculos geográficos simples sobre la esfera (precisión de metros, suficiente
 * para distancias dentro de un rancho).
 */
export type LonLat = [number, number];

const R = 6371008.8; // radio medio de la Tierra en metros
const rad = (g: number) => (g * Math.PI) / 180;
const grad = (r: number) => (r * 180) / Math.PI;

/** Distancia en línea recta (metros). */
export function distanciaM(a: LonLat, b: LonLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rumbo inicial de a hacia b, en grados (0 = norte, 90 = este). */
export function rumboGrados(a: LonLat, b: LonLat): number {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return (grad(Math.atan2(y, x)) + 360) % 360;
}

const puntos = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
/** Punto cardinal en español (16 divisiones). */
export function puntoCardinal(grados: number): string {
  return puntos[Math.round(grados / 22.5) % 16];
}

/** ¿El punto está dentro del polígono? (anillo exterior y huecos). */
export function puntoEnPoligono(p: LonLat, anillos: LonLat[][]): boolean {
  const dentroDeAnillo = (anillo: LonLat[]) => {
    let dentro = false;
    for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
      const [xi, yi] = anillo[i];
      const [xj, yj] = anillo[j];
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) dentro = !dentro;
    }
    return dentro;
  };
  if (!anillos.length || !dentroDeAnillo(anillos[0])) return false;
  return !anillos.slice(1).some(dentroDeAnillo);
}

/** Espiadero cuyo radio contiene la posición; si varios, el más cercano. */
export function espiaderoEnRadio<T extends { lon: number; lat: number; radio_m: number }>(
  posicion: LonLat,
  espiaderos: T[],
): T | null {
  let mejor: { e: T; d: number } | null = null;
  for (const e of espiaderos) {
    const d = distanciaM(posicion, [e.lon, e.lat]);
    if (d <= e.radio_m && (!mejor || d < mejor.d)) mejor = { e, d };
  }
  return mejor?.e ?? null;
}
