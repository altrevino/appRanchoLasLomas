/**
 * Textos que el rancho debe validar. Ajustar aquí sin tocar las pantallas.
 */

/**
 * Ayuda de una línea en la pantalla de captura.
 * PENDIENTE DE VALIDAR: los rangos de edad por clase varían entre ranchos;
 * confirmar el criterio de Rancho Las Lomas.
 */
export const ayudaClases = 'Edad aprox.: M1 1–2 años · M2 3–4 · M3 5–6 · M4 7+';

export const clasesCaptura = [
  { clave: 'M1', etiqueta: 'M1' },
  { clave: 'M2', etiqueta: 'M2' },
  { clave: 'M3', etiqueta: 'M3' },
  { clave: 'M4', etiqueta: 'M4' },
  { clave: 'hembra', etiqueta: 'Hembra' },
  { clave: 'cria', etiqueta: 'Cría' },
] as const;

export type ClaseCaptura = (typeof clasesCaptura)[number]['clave'];
