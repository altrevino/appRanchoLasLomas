import type { LonLat } from '../../lib/geo';
import type { DatosMapa, Espiadero } from '../../lib/mapa/datos';
import type { Ubicacion } from '../../lib/ubicacion';

export interface MapaRanchoProps {
  datos: DatosMapa;
  ubicacion: Ubicacion | null;
  espiaderoSeleccionado: string | null;
  onTocarEspiadero: (e: Espiadero) => void;
  onTocarMapa: (punto: LonLat) => void;
}

/** Acciones de cámara que exponen ambas implementaciones (nativa y web). */
export interface MapaRanchoRef {
  verRancho: () => void;
  irA: (punto: LonLat) => void;
}
