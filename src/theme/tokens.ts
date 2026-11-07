/**
 * Tokens de diseño de Rancho Las Lomas.
 *
 * Regla: ninguna pantalla usa valores sueltos de color, tamaño o espacio.
 * Todo sale de aquí o de `temas` (index.ts).
 *
 * Contraste: `npm run contraste` verifica WCAG AA de cada par texto/fondo
 * declarado en `paresDeContraste` (ver scripts/verificar-contraste.ts).
 */

/** Paleta base, tal como la definió el rancho. No usar directo en pantallas. */
export const paleta = {
  verdeBosque: '#2B3B30',
  arena: '#AB8E64',
  hueso: '#F6F2EA',
  verdeNoche: '#151D17',
  textoSobreClaro: '#1E2620',
  textoSobreOscuro: '#EDE6D8',
  exito: '#5E7F4F',
  alerta: '#C08A2E',
  error: '#A4483A',
} as const;

/**
 * Variantes derivadas para cumplir AA (4.5:1) en texto pequeño.
 * Los valores originales no alcanzan en estas combinaciones:
 *   arena/hueso 2.77, alerta/hueso 2.72, éxito/hueso 4.07,
 *   error/noche 2.92, éxito/noche 3.79.
 */
export const derivados = {
  arenaTexto: '#7D6440', // arena para texto sobre hueso (4.99)
  arenaClaro: '#C9AE85', // arena para texto pequeño sobre verde bosque (5.58)
  exitoSobreClaro: '#4F6B42', // 5.35 sobre hueso
  alertaSobreClaro: '#8A6118', // 4.94 sobre hueso
  errorSobreClaro: '#A4483A', // el original ya pasa (5.27)
  exitoSobreOscuro: '#7FA06E', // 5.87 sobre noche
  alertaSobreOscuro: '#C08A2E', // el original ya pasa (5.67)
  errorSobreOscuro: '#D0705F', // 5.05 sobre noche
  huesoTarjeta: '#FBF8F2', // superficie de tarjetas sobre fondo hueso
  huesoBorde: '#DDD4C3', // líneas divisorias en modo consulta
  textoSecundarioClaro: '#5A6157', // texto secundario sobre hueso
  nocheSuperficie: '#1F2A22', // botones del modo campo
  nocheSuperficieActiva: '#2B3B30', // botón presionado (verde bosque)
  nocheBorde: '#34433A',
  textoSecundarioOscuro: '#A9A293', // texto secundario sobre noche
} as const;

export const espacio = {
  xxs: 2,
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Radios pequeños: estética sobria, nada de píldoras ni burbujas. */
export const radio = {
  s: 4,
  m: 8,
  l: 12,
} as const;

/** Bordes y líneas. Sin sombras: la separación se logra con borde y color. */
export const borde = {
  fino: 1,
  medio: 2,
} as const;

/**
 * Familias. `sistema` = undefined deja la fuente del sistema (SF Pro en iOS).
 * Cinzel solo para títulos de 20 pt o más.
 */
export const familias = {
  titulo: 'Cinzel_600SemiBold',
  tituloFuerte: 'Cinzel_700Bold',
  sistema: undefined,
} as const;

export const tipografia = {
  // Cinzel (títulos)
  display: { fontFamily: familias.tituloFuerte, fontSize: 32, lineHeight: 40, letterSpacing: 1 },
  titulo1: { fontFamily: familias.titulo, fontSize: 26, lineHeight: 34, letterSpacing: 0.8 },
  titulo2: { fontFamily: familias.titulo, fontSize: 20, lineHeight: 28, letterSpacing: 0.6 },
  // Sistema (todo lo demás)
  cuerpo: { fontSize: 17, lineHeight: 24 },
  cuerpoFuerte: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  secundario: { fontSize: 15, lineHeight: 20 },
  etiqueta: { fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  boton: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  // Números del modo campo
  cronometro: { fontSize: 64, lineHeight: 72, fontWeight: '700', fontVariant: ['tabular-nums'] },
  contador: { fontSize: 44, lineHeight: 50, fontWeight: '700', fontVariant: ['tabular-nums'] },
  botonCampo: { fontSize: 24, lineHeight: 28, fontWeight: '700' },
} as const;

export const tamanos = {
  /** Mínimo táctil general (Apple HIG). */
  toqueMinimo: 44,
  botonConsulta: 52,
  /** Mínimo de los botones de captura en modo campo. */
  botonCampoMinimo: 80,
  cabezaVenadoEncabezado: 34,
  marcadorEspiadero: 36,
} as const;

/** Brillo de pantalla al entrar a modo campo (0–1). Se restaura al salir. */
export const brilloCampo = 0.3;
