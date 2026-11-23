import type { Medidas } from './calculo';

export type Arma = 'rifle' | 'arco' | 'ballesta' | 'otra';
export const ARMAS: { valor: Arma; nombre: string }[] = [
  { valor: 'rifle', nombre: 'Rifle' },
  { valor: 'arco', nombre: 'Arco' },
  { valor: 'ballesta', nombre: 'Ballesta' },
  { valor: 'otra', nombre: 'Otra' },
];
export const nombreArma = (a: Arma | null) => ARMAS.find((x) => x.valor === a)?.nombre ?? '';

export interface Medicion {
  id: string;
  folio: number;
  macho_id: string | null;
  foto_path: string | null;
  espiadero_id: string | null;
  lugar: string | null;
  cazado_at: string;
  cazador: string | null;
  procedencia: string | null;
  arma: Arma | null;
  guia: string | null;
  medido_por: string | null;
  notas: string | null;
  abertura: number | null;
  medidas: Medidas;
  bruta: number | null;
  neta_tipica: number | null;
  neta_no_tipica: number | null;
  creado_at: string;
}

export const folioMedicion = (n: number) => `M-${String(n).padStart(3, '0')}`;

export const nombreArchivoPdf = (folio: number, cazador: string | null) =>
  `Rancho Las Lomas ${folioMedicion(folio)}${cazador ? ' ' + cazador.replace(/[\\/:*?"<>|]/g, '') : ''}.pdf`;
