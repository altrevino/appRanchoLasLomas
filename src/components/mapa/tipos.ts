import type { LonLat } from '../../lib/geo';
import type { DatosMapa, Espiadero, Lugar } from '../../lib/mapa/datos';
import type { PuntoAvistamiento } from '../../lib/mapa/estilo';
import type { Ubicacion } from '../../lib/ubicacion';

export interface MapaRanchoProps {
  datos: DatosMapa;
  ubicacion: Ubicacion | null;
  espiaderoSeleccionado: string | null;
  /** Punto que se está midiendo (dibuja la línea desde tu ubicación). */
  objetivo: LonLat | null;
  /** Avistamientos recientes (solo personal; vacío para invitados). */
  avistamientos: PuntoAvistamiento[];
  onTocarEspiadero: (e: Espiadero) => void;
  onTocarLugar: (l: Lugar) => void;
  onTocarAvistamiento: (a: PuntoAvistamiento) => void;
  onTocarMapa: (punto: LonLat) => void;
}

/** Acciones de cámara que exponen ambas implementaciones (nativa y web). */
export interface MapaRanchoRef {
  verRancho: () => void;
  irA: (punto: LonLat) => void;
}
