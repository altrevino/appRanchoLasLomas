/**
 * Ficha de puntuación en PDF (tamaño carta) para entregar al cliente.
 * Se genera en el teléfono con jsPDF; el logotipo y la fuente Cinzel se toman
 * de /pdf/ (quedan en la caché de la app, funcionan sin señal).
 */
import { jsPDF } from 'jspdf';
import { calcular, formato, type Medidas, type Par } from './calculo';
import { folioMedicion, nombreArma, type Arma } from './tipos';

export interface DatosPdf {
  folio: number;
  cazado_at: string;
  lugar: string | null;
  cazador: string | null;
  procedencia: string | null;
  arma: Arma | null;
  guia: string | null;
  medido_por: string | null;
  notas: string | null;
  ejemplar: string | null;
  abertura: number | null;
  medidas: Medidas;
  /** data URI JPEG de la foto del trofeo */
  foto: string | null;
}

// Colores de la identidad (tokens.ts)
const BOSQUE: [number, number, number] = [43, 59, 48];
const ARENA: [number, number, number] = [171, 142, 100];
const ARENA_TEXTO: [number, number, number] = [125, 100, 64];
const TEXTO: [number, number, number] = [30, 38, 32];
const SECUNDARIO: [number, number, number] = [90, 97, 87];
const LINEA: [number, number, number] = [221, 212, 195];
const TARJETA: [number, number, number] = [246, 242, 234];

const ANCHO = 215.9;
const ALTO = 279.4;
const M = 16; // margen
const UTIL = ANCHO - 2 * M;
const PIE = 18;

async function aDataUri(blob: Blob): Promise<string> {
  return new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(r.result as string);
    r.onerror = () => mal(r.error);
    r.readAsDataURL(blob);
  });
}
async function recurso(ruta: string): Promise<Blob | null> {
  try {
    const r = await fetch(ruta);
    return r.ok ? await r.blob() : null;
  } catch {
    return null;
  }
}

const fechaHora = (iso: string) => {
  const d = new Date(iso);
  const f = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  const h = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${f}, ${h} h`;
};

export async function generarPdf(d: DatosPdf): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const r = calcular(d.abertura, d.medidas);

  // Fuente de títulos (Cinzel); si no carga, Helvetica.
  let titulo = 'helvetica';
  const fuente = await recurso('/pdf/cinzel.ttf');
  if (fuente) {
    const b64 = (await aDataUri(fuente)).split(',')[1];
    doc.addFileToVFS('Cinzel.ttf', b64);
    doc.addFont('Cinzel.ttf', 'Cinzel', 'normal');
    titulo = 'Cinzel';
  }
  const color = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const fuenteTexto = (tam: number, negrita = false) => {
    doc.setFont('helvetica', negrita ? 'bold' : 'normal');
    doc.setFontSize(tam);
  };
  const linea = (x1: number, y1: number, x2: number, y2: number, c = LINEA, grosor = 0.2) => {
    doc.setDrawColor(c[0], c[1], c[2]);
    doc.setLineWidth(grosor);
    doc.line(x1, y1, x2, y2);
  };

  let y = 12;

  // Encabezado: logotipo, título y folio
  const logo = await recurso('/pdf/logo.png');
  if (logo) {
    const uri = await aDataUri(logo);
    const p = doc.getImageProperties(uri);
    const w = 38;
    const h = (w * p.height) / p.width;
    doc.addImage(uri, 'PNG', (ANCHO - w) / 2, y, w, h, 'logo', 'FAST');
    y += h + 7;
  } else {
    y += 10;
  }
  doc.setFont(titulo, titulo === 'Cinzel' ? 'normal' : 'bold');
  doc.setFontSize(17);
  color(BOSQUE);
  doc.text('FICHA DE PUNTUACIÓN', ANCHO / 2, y, { align: 'center' });
  y += 5.5;
  fuenteTexto(9.5);
  color(ARENA_TEXTO);
  doc.text('Venado cola blanca  ·  Método Boone and Crockett  ·  Medidas en pulgadas', ANCHO / 2, y, { align: 'center' });
  fuenteTexto(9, true);
  color(SECUNDARIO);
  doc.text(folioMedicion(d.folio), ANCHO - M, 14, { align: 'right' });
  y += 4;
  linea(M, y, ANCHO - M, y, ARENA, 0.4);
  y += 5;

  // ---------------------------------------------------------------------------
  // Todo cabe en UNA hoja: se mide el contenido y, si no cabe, se achica la foto,
  // luego los renglones de la tabla y al final se recortan las notas.
  // ---------------------------------------------------------------------------
  const anchoR = 70;
  const xR = ANCHO - M - anchoR;
  const maxAnchoFoto = xR - 6 - M;
  const filasR: [string, string][] = [
    ['Abertura interior', formato(d.abertura ?? 0)],
    ...(r.creditoAbertura < (d.abertura ?? 0) ? [['Crédito de abertura', formato(r.creditoAbertura)] as [string, string]] : []),
    ['Suma lado derecho', formato(r.sumaDer)],
    ['Suma lado izquierdo', formato(r.sumaIzq)],
    ['Número de puntas', `${r.puntasDer} der. · ${r.puntasIzq} izq.`],
  ];
  const altoR = 9 + filasR.length * 5.4 + 13;
  const propFoto = d.foto ? doc.getImageProperties(d.foto) : null;
  const altoFotoCon = (max: number) => {
    if (!propFoto) return 0;
    const h = (maxAnchoFoto * propFoto.height) / propFoto.width;
    return Math.min(h, Math.max(altoR, max));
  };

  const datos: [string, string][] = (
    [
      ['Cazador', d.cazador ?? ''],
      ['Procedencia', d.procedencia ?? ''],
      ['Fecha y hora', fechaHora(d.cazado_at)],
      ['Lugar', d.lugar ?? ''],
      ['Arma', nombreArma(d.arma)],
      ['Guía', d.guia ?? ''],
      ['Medido por', d.medido_por ?? ''],
      ['Ejemplar', d.ejemplar ?? ''],
    ] as [string, string][]
  ).filter(([, v]) => v);
  const col = (UTIL - 8) / 2;
  fuenteTexto(9.5, true);
  const lineasDato = datos.map(([, v]) => (doc.splitTextToSize(v, col - 25) as string[]).slice(0, 2));
  let altoDatos = 2;
  for (let i = 0; i < datos.length; i += 2) altoDatos += Math.max(5.2, 1 + Math.max(...lineasDato.slice(i, i + 2).map((l) => l.length)) * 4.2);

  const ultimaG = d.medidas.g.reduce((u, p, i) => (p.d != null || p.i != null ? i : u), -1);
  const gs = d.medidas.g.slice(0, Math.max(ultimaG + 1, 1));
  const anormales = d.medidas.ap.filter((p) => p.d != null || p.i != null);
  const renglones = 1 + 1 + gs.length + d.medidas.h.length + anormales.length + 1;

  fuenteTexto(9);
  let notas = d.notas ? (doc.splitTextToSize(d.notas, UTIL) as string[]) : [];
  const altoNotas = (n: number) => (n ? 12 + n * 4.2 : 0);

  const disponible = ALTO - PIE - 3 - y;
  const necesita = (fotoMax: number, fila: number, nNotas: number) =>
    Math.max(altoR, altoFotoCon(fotoMax)) + 6 + altoDatos + 6 + (fila + 0.6) + renglones * fila + altoNotas(nNotas);
  let fotoMax = 70;
  let ALTO_FILA = 4.9;
  while (fotoMax > 40 && necesita(fotoMax, ALTO_FILA, notas.length) > disponible) fotoMax -= 5;
  while (ALTO_FILA > 3.5 && necesita(fotoMax, ALTO_FILA, notas.length) > disponible) ALTO_FILA = Math.round((ALTO_FILA - 0.1) * 10) / 10;
  while (notas.length && necesita(fotoMax, ALTO_FILA, notas.length) > disponible) notas = notas.slice(0, -1);
  if (d.notas && notas.length && notas.join(' ').length < d.notas.trim().length - 1) notas[notas.length - 1] = notas[notas.length - 1].replace(/\s*\S*$/, ' …');
  const tamFila = Math.min(9, ALTO_FILA * 1.85);

  // Foto (izquierda) y puntuación (derecha)
  let altoFoto = 0;
  if (d.foto && propFoto) {
    const h = altoFotoCon(fotoMax);
    const w = (h * propFoto.width) / propFoto.height;
    const x = M + (maxAnchoFoto - w) / 2;
    doc.addImage(d.foto, 'JPEG', x, y, w, h, 'foto', 'FAST');
    doc.setDrawColor(ARENA[0], ARENA[1], ARENA[2]);
    doc.setLineWidth(0.3);
    doc.rect(x, y, w, h);
    altoFoto = h;
  }
  doc.setFillColor(TARJETA[0], TARJETA[1], TARJETA[2]);
  doc.setDrawColor(ARENA[0], ARENA[1], ARENA[2]);
  doc.setLineWidth(0.3);
  doc.rect(xR, y, anchoR, altoR, 'FD');
  fuenteTexto(8, true);
  color(ARENA_TEXTO);
  doc.text('PUNTUACIÓN', xR + 4, y + 5);
  let yr = y + 10.5;
  for (const [k, v] of filasR) {
    fuenteTexto(8.5);
    color(SECUNDARIO);
    doc.text(k, xR + 4, yr);
    fuenteTexto(9.5, true);
    color(TEXTO);
    doc.text(v, xR + anchoR - 4, yr, { align: 'right' });
    yr += 5.4;
  }
  linea(xR + 4, yr - 2.6, xR + anchoR - 4, yr - 2.6, ARENA, 0.3);
  fuenteTexto(9, true);
  color(BOSQUE);
  doc.text('PUNTUACIÓN BRUTA', xR + 4, yr + 5);
  doc.setFont(titulo, titulo === 'Cinzel' ? 'normal' : 'bold');
  doc.setFontSize(22);
  doc.text(formato(r.bruta), xR + anchoR - 4, yr + 6, { align: 'right' });
  y += Math.max(altoFoto, altoR) + 6;

  // Datos de la caza, en dos columnas
  fuenteTexto(8, true);
  color(ARENA_TEXTO);
  doc.text('DATOS DE LA CAZA', M, y);
  y += 2;
  for (let i = 0; i < datos.length; i += 2) {
    let altoFila = 5.2;
    datos.slice(i, i + 2).forEach(([k], j) => {
      const x = M + j * (col + 8);
      const lineas = lineasDato[i + j];
      fuenteTexto(8.5);
      color(SECUNDARIO);
      doc.text(k, x, y + 4);
      fuenteTexto(9.5, true);
      color(TEXTO);
      doc.text(lineas, x + 25, y + 4);
      altoFila = Math.max(altoFila, 1 + lineas.length * 4.2);
    });
    y += altoFila;
    linea(M, y, M + col, y);
    if (datos[i + 1]) linea(M + col + 8, y, ANCHO - M, y);
  }
  y += 6;

  // Tabla de medidas, en inglés para el cliente: Measurement | Right | Left | Total
  const fin = ANCHO - M;
  const bordes = [M + 112, M + 148, fin];
  doc.setFillColor(BOSQUE[0], BOSQUE[1], BOSQUE[2]);
  doc.rect(M, y, UTIL, ALTO_FILA + 0.6, 'F');
  fuenteTexto(Math.min(8, tamFila), true);
  doc.setTextColor(237, 230, 216);
  ['MEASUREMENT', 'RIGHT', 'LEFT', 'TOTAL'].forEach((tx, i) =>
    doc.text(tx, i === 0 ? M + 2 : bordes[i - 1] - 3, y + ALTO_FILA * 0.8, { align: i === 0 ? 'left' : 'right' }),
  );
  y += ALTO_FILA + 0.6;
  const fila = (nombre: string, celdas: string[], fuerte = false) => {
    fuenteTexto(fuerte ? tamFila + 0.5 : tamFila, fuerte);
    color(fuerte ? BOSQUE : TEXTO);
    doc.text(nombre, M + 2, y + ALTO_FILA * 0.76);
    celdas.forEach((c, i) => doc.text(c, bordes[i] - 3, y + ALTO_FILA * 0.76, { align: 'right' }));
    y += ALTO_FILA;
    linea(M, y, fin, y, fuerte ? ARENA : LINEA, fuerte ? 0.3 : 0.2);
  };
  const suma = (p: Par) => (p.d == null && p.i == null ? '' : formato((p.d ?? 0) + (p.i ?? 0)));

  fila(r.creditoAbertura < (d.abertura ?? 0) ? `Inside Spread  (${formato(d.abertura)}, credit limited to longer main beam)` : 'Inside Spread', ['', '', formato(r.creditoAbertura)]);
  fila('Main Beam Length', [formato(d.medidas.viga.d), formato(d.medidas.viga.i), suma(d.medidas.viga)]);
  gs.forEach((p, i) => fila(`G${i + 1}  Point Length`, [formato(p.d), formato(p.i), suma(p)]));
  d.medidas.h.forEach((p, i) => fila(`H${i + 1}  Circumference`, [formato(p.d), formato(p.i), suma(p)]));
  anormales.forEach((p, i) => fila(`AP${i + 1}  Abnormal Point`, [formato(p.d), formato(p.i), suma(p)]));
  fila('GROSS SCORE', [formato(r.sumaDer), formato(r.sumaIzq), formato(r.bruta)], true);

  if (notas.length) {
    y += 4;
    fuenteTexto(8, true);
    color(ARENA_TEXTO);
    doc.text('NOTAS', M, y + 3);
    fuenteTexto(9);
    color(TEXTO);
    doc.text(notas, M, y + 8);
  }

  // Pie
  linea(M, ALTO - 13, ANCHO - M, ALTO - 13, ARENA, 0.3);
  fuenteTexto(7.5);
  color(SECUNDARIO);
  doc.text(
    'Medición realizada por Rancho Las Lomas con el método Boone and Crockett (puntuación bruta). No es un registro oficial del Boone and Crockett Club.',
    ANCHO / 2,
    ALTO - 9,
    { align: 'center' },
  );
  doc.text(`Rancho Las Lomas  ·  ${folioMedicion(d.folio)}`, ANCHO / 2, ALTO - 5.5, { align: 'center' });

  return doc.output('blob');
}
