export type ClaseMacho = 'M1' | 'M2' | 'M3' | 'M4';
export const CLASES_MACHO: ClaseMacho[] = ['M1', 'M2', 'M3', 'M4'];
export type Forma = 'abierta' | 'cerrada';
export type CuernoRoto = 'no' | 'izquierdo' | 'derecho' | 'ambos';
export type EstadoMacho = 'por_validar' | 'activo' | 'cazado' | 'fusionado';
export type EstadoEfectivo = EstadoMacho | 'sin_ver';

/** Rasgos distintivos. null = no se sabe / no se vio. */
export interface Rasgos {
  puntas_izq: number | null;
  puntas_der: number | null;
  forma: Forma | null;
  puntas_anomalas: boolean | null;
  cuerno_roto: CuernoRoto | null;
  cicatrices: boolean | null;
  oreja_marcada: boolean | null;
}
export const rasgosVacios = (): Rasgos => ({
  puntas_izq: null,
  puntas_der: null,
  forma: null,
  puntas_anomalas: null,
  cuerno_roto: null,
  cicatrices: null,
  oreja_marcada: null,
});

export interface Macho extends Rasgos {
  id: string;
  folio: string;
  apodo: string | null;
  clase_actual: ClaseMacho;
  estado: EstadoMacho;
  estado_efectivo: EstadoEfectivo;
  nota: string | null;
  foto_portada_id: string | null;
  portada_path: string | null;
  primer_avistamiento_at: string | null;
  ultimo_avistamiento_at: string | null;
  ultimo_espiadero_id: string | null;
  ultimo_espiadero_nombre: string | null;
  ultimo_lon: number | null;
  ultimo_lat: number | null;
  num_avistamientos: number;
  creado_at: string;
}

export const NOMBRE_ESTADO: Record<EstadoEfectivo, string> = {
  por_validar: 'Por validar',
  activo: 'Activo',
  cazado: 'Cazado',
  fusionado: 'Fusionado',
  sin_ver: 'Sin ver 60 días',
};

export const nombreMacho = (m: Pick<Macho, 'folio' | 'apodo'>) => (m.apodo ? `${m.folio} · ${m.apodo}` : m.folio);
