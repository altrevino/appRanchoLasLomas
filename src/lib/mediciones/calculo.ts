/**
 * Puntuación Boone and Crockett para venado cola blanca.
 * Todo en OCTAVOS de pulgada (enteros): 18 4/8" = 148.
 *
 *   Crédito de abertura = abertura interior, sin exceder la viga principal más larga.
 *   Suma por lado       = viga + G1..Gn + H1..H4.
 *   Bruta               = crédito de abertura + suma derecha + suma izquierda.
 *   Diferencias         = Σ |derecho − izquierdo| de viga, cada G y cada H.
 *   Neta típica         = bruta − diferencias − puntas anormales.
 *   Neta no típica      = bruta − diferencias + puntas anormales.
 * Puntas por lado: G y anormales de al menos 1" más la punta de la viga.
 */

export type Valor = number | null;
export interface Par {
  d: Valor;
  i: Valor;
}
export interface Medidas {
  viga: Par;
  g: Par[];
  h: Par[];
  ap: Par[];
}

export const medidasVacias = (): Medidas => ({
  viga: { d: null, i: null },
  g: Array.from({ length: 5 }, () => ({ d: null, i: null })),
  h: Array.from({ length: 4 }, () => ({ d: null, i: null })),
  ap: Array.from({ length: 3 }, () => ({ d: null, i: null })),
});

export interface Resultado {
  creditoAbertura: number;
  sumaDer: number;
  sumaIzq: number;
  bruta: number;
  diferencias: number;
  anormalesDer: number;
  anormalesIzq: number;
  anormales: number;
  netaTipica: number;
  netaNoTipica: number;
  puntasDer: number;
  puntasIzq: number;
}

const v = (x: Valor) => x ?? 0;
const suma = (xs: Valor[]) => xs.reduce<number>((a, x) => a + v(x), 0);
const PULGADA = 8;

export function calcular(abertura: Valor, m: Medidas): Resultado {
  const tipicas = [m.viga, ...m.g, ...m.h];
  const vigaMayor = Math.max(v(m.viga.d), v(m.viga.i));
  const creditoAbertura = Math.min(v(abertura), vigaMayor);
  const sumaDer = suma(tipicas.map((p) => p.d));
  const sumaIzq = suma(tipicas.map((p) => p.i));
  const bruta = creditoAbertura + sumaDer + sumaIzq;
  const diferencias = tipicas.reduce((a, p) => a + Math.abs(v(p.d) - v(p.i)), 0);
  const anormalesDer = suma(m.ap.map((p) => p.d));
  const anormalesIzq = suma(m.ap.map((p) => p.i));
  const anormales = anormalesDer + anormalesIzq;
  const cuenta = (xs: Valor[]) => xs.filter((x) => v(x) >= PULGADA).length;
  const tieneViga = (x: Valor) => (v(x) > 0 ? 1 : 0);
  return {
    creditoAbertura,
    sumaDer,
    sumaIzq,
    bruta,
    diferencias,
    anormalesDer,
    anormalesIzq,
    anormales,
    netaTipica: bruta - diferencias - anormales,
    netaNoTipica: bruta - diferencias + anormales,
    puntasDer: tieneViga(m.viga.d) + cuenta(m.g.map((p) => p.d)) + cuenta(m.ap.map((p) => p.d)),
    puntasIzq: tieneViga(m.viga.i) + cuenta(m.g.map((p) => p.i)) + cuenta(m.ap.map((p) => p.i)),
  };
}

/** 148 → "18 4/8"; 144 → "18"; 3 → "3/8"; null → "". Como en la hoja oficial (sin simplificar). */
export function formato(octavos: Valor): string {
  if (octavos == null) return '';
  const signo = octavos < 0 ? '−' : '';
  const a = Math.abs(octavos);
  const p = Math.floor(a / 8);
  const o = a % 8;
  if (!o) return `${signo}${p}`;
  return p ? `${signo}${p} ${o}/8` : `${signo}${o}/8`;
}

/** Octavos → pulgadas decimales (148 → 18.5). */
export const aPulgadas = (octavos: number) => octavos / 8;

/** Campos de captura: pulgadas y octavos por separado. */
export interface Captura {
  p: string;
  o: string;
}
export const capturaVacia = (): Captura => ({ p: '', o: '' });

/** Captura → octavos. null si está vacía; 'invalido' si no es un número válido. */
export function deCaptura(c: Captura): Valor | 'invalido' {
  const p = c.p.trim();
  const o = c.o.trim();
  if (!p && !o) return null;
  if ((p && !/^\d{1,2}$/.test(p)) || (o && !/^[0-7]$/.test(o))) return 'invalido';
  return Number(p || 0) * 8 + Number(o || 0);
}

export function aCaptura(octavos: Valor): Captura {
  if (octavos == null) return capturaVacia();
  return { p: String(Math.floor(octavos / 8)), o: octavos % 8 ? String(octavos % 8) : '' };
}
