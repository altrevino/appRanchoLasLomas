/**
 * Textos que el rancho debe validar. Ajustar aquí sin tocar las pantallas.
 */

/**
 * Ayuda de una línea en la pantalla de captura (edades confirmadas por el rancho).
 */
export const ayudaClases = 'Edad: M1 1.5 · M2 2.5 · M3 3.5 · M4 4.5 · M5 5.5+ años';

export const clasesCaptura = [
  { clave: 'M1', etiqueta: 'M1' },
  { clave: 'M2', etiqueta: 'M2' },
  { clave: 'M3', etiqueta: 'M3' },
  { clave: 'M4', etiqueta: 'M4' },
  { clave: 'M5', etiqueta: 'M5' },
  { clave: 'hembra', etiqueta: 'Hembra' },
  { clave: 'cria', etiqueta: 'Cría' },
] as const;

export type ClaseCaptura = (typeof clasesCaptura)[number]['clave'];
