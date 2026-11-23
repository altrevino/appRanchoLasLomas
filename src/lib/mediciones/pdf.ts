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
  const asegurar = (alto: number) => {
    if (y + alto > ALTO - PIE) {
      doc.addPage();
      y = M;
    }
  };

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

  // Foto (izquierda) y puntuación (derecha)
  const anchoR = 70;
  const xR = ANCHO - M - anchoR;
  const filasR: [string, string, boolean][] = [
    ['Abertura interior', formato(d.abertura ?? 0), false],
    ...(r.creditoAbertura < (d.abertura ?? 0) ? [['Crédito de abertura', formato(r.creditoAbertura), false] as [string, string, boolean]] : []),
    ['Suma lado derecho', formato(r.sumaDer), false],
    ['Suma lado izquierdo', formato(r.sumaIzq), false],
    ['PUNTUACIÓN BRUTA', formato(r.bruta), true],
    ['Diferencias', r.diferencias ? `- ${formato(r.diferencias)}` : '0', false],
    ['Puntas anormales', formato(r.anormales), false],
    ['NETA TÍPICA', formato(r.netaTipica), true],
    ['NETA NO TÍPICA', formato(r.netaNoTipica), true],
    ['Número de puntas', `${r.puntasDer} der. · ${r.puntasIzq} izq.`, false],
  ];
  const altoR = 9 + filasR.length * 5.4;
  let altoFoto = 0;
  if (d.foto) {
    const p = doc.getImageProperties(d.foto);
    const maxAncho = xR - 6 - M;
    let w = maxAncho;
    let h = (w * p.height) / p.width;
    if (h > Math.max(altoR, 70)) {
      h = Math.max(altoR, 70);
      w = (h * p.width) / p.height;
    }
    const x = M + (maxAncho - w) / 2;
    doc.addImage(d.foto, 'JPEG', x, y, w, h);
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
  for (const [k, v, fuerte] of filasR) {
    fuenteTexto(fuerte ? 9 : 8.5, fuerte);
    color(fuerte ? BOSQUE : SECUNDARIO);
    doc.text(k, xR + 4, yr);
    fuenteTexto(fuerte ? 11.5 : 9.5, true);
    color(fuerte ? BOSQUE : TEXTO);
    doc.text(v, xR + anchoR - 4, yr, { align: 'right' });
    yr += 5.4;
  }
  y += Math.max(altoFoto, altoR) + 6;

  // Datos de la caza, en dos columnas
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
  fuenteTexto(8, true);
  color(ARENA_TEXTO);
  doc.text('DATOS DE LA CAZA', M, y);
  y += 2;
  const col = (UTIL - 8) / 2;
  for (let i = 0; i < datos.length; i += 2) {
    let altoFila = 5.2;
    datos.slice(i, i + 2).forEach(([k, v], j) => {
      const x = M + j * (col + 8);
      fuenteTexto(8.5);
      color(SECUNDARIO);
      doc.text(k, x, y + 4);
      fuenteTexto(9.5, true);
      color(TEXTO);
      const lineas = doc.splitTextToSize(v, col - 25) as string[];
      doc.text(lineas, x + 25, y + 4);
      altoFila = Math.max(altoFila, 1 + lineas.length * 4.2);
    });
    y += altoFila;
    linea(M, y, M + col, y);
    if (datos[i + 1]) linea(M + col + 8, y, ANCHO - M, y);
  }
  y += 6;

  // Tabla de medidas
  // Medida | Derecho | Izquierdo | Diferencia (borde derecho de cada columna numérica)
  const fin = ANCHO - M;
  const bordes = [M + 102, M + 142, fin];
  const ALTO_FILA = 4.9;
  const encabezado = (titulos: string[]) => {
    asegurar(ALTO_FILA * 2);
    doc.setFillColor(BOSQUE[0], BOSQUE[1], BOSQUE[2]);
    doc.rect(M, y, UTIL, ALTO_FILA + 0.6, 'F');
    fuenteTexto(8, true);
    doc.setTextColor(237, 230, 216);
    titulos.forEach((tx, i) => doc.text(tx, i === 0 ? M + 2 : bordes[i - 1] - 3, y + 3.9, { align: i === 0 ? 'left' : 'right' }));
    y += ALTO_FILA + 0.6;
  };
  const fila = (nombre: string, celdas: string[], fuerte = false) => {
    asegurar(ALTO_FILA);
    fuenteTexto(9, fuerte);
    color(fuerte ? BOSQUE : TEXTO);
    doc.text(nombre, M + 2, y + 3.7);
    celdas.forEach((c, i) => doc.text(c, bordes[i] - 3, y + 3.7, { align: 'right' }));
    y += ALTO_FILA;
    linea(M, y, fin, y);
  };
  const dif = (p: Par) => (p.d == null && p.i == null ? '' : formato(Math.abs((p.d ?? 0) - (p.i ?? 0))));

  encabezado(['MEDIDA', 'DERECHO', 'IZQUIERDO', 'DIFERENCIA']);
  fila('Longitud de viga principal', [formato(d.medidas.viga.d), formato(d.medidas.viga.i), dif(d.medidas.viga)]);
  const ultimaG = d.medidas.g.reduce((u, p, i) => (p.d != null || p.i != null ? i : u), -1);
  d.medidas.g.slice(0, Math.max(ultimaG + 1, 1)).forEach((p, i) => fila(`G${i + 1}  Longitud de punta`, [formato(p.d), formato(p.i), dif(p)]));
  d.medidas.h.forEach((p, i) => fila(`H${i + 1}  Circunferencia`, [formato(p.d), formato(p.i), dif(p)]));
  fila('Subtotal', [formato(r.sumaDer), formato(r.sumaIzq), formato(r.diferencias)], true);
  y += 4;

  const anormales = d.medidas.ap.filter((p) => p.d != null || p.i != null);
  encabezado(['PUNTAS ANORMALES', 'DERECHO', 'IZQUIERDO', 'TOTAL']);
  if (!anormales.length) {
    fila('Sin puntas anormales', ['', '', '']);
  } else {
    anormales.forEach((p, i) => fila(`AP${i + 1}`, [formato(p.d), formato(p.i), formato((p.d ?? 0) + (p.i ?? 0))]));
    fila('Total', [formato(r.anormalesDer), formato(r.anormalesIzq), formato(r.anormales)], true);
  }

  if (d.notas) {
    y += 4;
    fuenteTexto(9);
    const lineas = doc.splitTextToSize(d.notas, UTIL) as string[];
    asegurar(6 + lineas.length * 4.2);
    fuenteTexto(8, true);
    color(ARENA_TEXTO);
    doc.text('NOTAS', M, y + 3);
    fuenteTexto(9);
    color(TEXTO);
    doc.text(lineas, M, y + 8);
    y += 8 + lineas.length * 4.2;
  }

  // Pie en cada hoja
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    linea(M, ALTO - 13, ANCHO - M, ALTO - 13, ARENA, 0.3);
    fuenteTexto(7.5);
    color(SECUNDARIO);
    doc.text(
      'Medición realizada por Rancho Las Lomas con el método Boone and Crockett. No es un registro oficial del Boone and Crockett Club.',
      ANCHO / 2,
      ALTO - 9,
      { align: 'center' },
    );
    doc.text(`Rancho Las Lomas  ·  ${folioMedicion(d.folio)}${paginas > 1 ? `  ·  Hoja ${i} de ${paginas}` : ''}`, ANCHO / 2, ALTO - 5.5, { align: 'center' });
  }

  return doc.output('blob');
}
