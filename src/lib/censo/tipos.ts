export type Clase = 'M1' | 'M2' | 'M3' | 'M4' | 'hembra' | 'cria';
export const CLASES: Clase[] = ['M1', 'M2', 'M3', 'M4', 'hembra', 'cria'];
export const NOMBRE_CLASE: Record<Clase, string> = { M1: 'M1', M2: 'M2', M3: 'M3', M4: 'M4', hembra: 'Hembra', cria: 'Cría' };

export type EstadoCenso = 'borrador' | 'en_curso' | 'cerrado' | 'cancelado';

export interface Censo {
  id: string;
  nombre: string;
  duracion_min: number;
  estado: EstadoCenso;
  inicio_at: string | null;
  fin_at: string | null;
  es_simulacion: boolean;
  creado_at: string;
}

export interface EspiaderoCenso {
  id: string;
  nombre: string;
  radio_m: number;
  lon: number;
  lat: number;
  asignado_a: string | null;
  asignado_nombre: string | null;
}

export interface CensoActual {
  hora_servidor: string;
  censo: Censo | null;
  espiaderos: EspiaderoCenso[];
}

export type Conteo = Record<Clase, number>;
export const conteoVacio = (): Conteo => ({ M1: 0, M2: 0, M3: 0, M4: 0, hembra: 0, cria: 0 });

export interface ResumenEspiadero {
  espiadero_id: string;
  nombre: string;
  asignado_nombre: string | null;
  clases: Conteo;
  total: number;
  ultimo_at: string | null;
  personas: string[];
}

export interface ResumenCenso {
  censo: Censo;
  hora_servidor: string;
  mis_totales: Conteo;
  /** null para invitados mientras el censo sigue en curso. */
  totales: Conteo | null;
  /** Solo personal (admin y staff). */
  por_espiadero: ResumenEspiadero[] | null;
}

export const total = (c: Conteo | null | undefined) => (c ? CLASES.reduce((s, k) => s + (c[k] ?? 0), 0) : 0);
