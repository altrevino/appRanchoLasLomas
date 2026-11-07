/**
 * Logotipo oficial de Rancho Las Lomas (assets/logo/logo-completo.svg).
 * Los trazos se generan con `npm run logo`.
 */
import Svg, { Path } from 'react-native-svg';
import { paleta } from '../../theme';
import { trazosLogo } from './trazos';

/** Recorte cuadrado del busto del venado con cornamenta. */
const cajaVenado = '469 49 600 600';
/** Recorte del logotipo completo (venado, colina y nombre). */
const cajaCompleto = { x: 25, y: 41, ancho: 1484, alto: 977 };

/** Solo la cabeza del venado, en un color. Encabezados, ícono, marcas pequeñas. */
export function CabezaVenado({ tamano = 28, color }: { tamano?: number; color: string }) {
  return (
    <Svg width={tamano} height={tamano} viewBox={cajaVenado} accessibilityLabel="Rancho Las Lomas">
      {trazosLogo.venado.map((d, i) => (
        <Path key={i} d={d} fill={color} />
      ))}
    </Svg>
  );
}

/** Logotipo completo en sus colores originales. Inicio y login. */
export function LogoCompleto({
  ancho,
  primario = paleta.verdeBosque,
  acento = paleta.arena,
}: {
  ancho: number;
  primario?: string;
  acento?: string;
}) {
  const alto = (ancho * cajaCompleto.alto) / cajaCompleto.ancho;
  const { x, y, ancho: w, alto: h } = cajaCompleto;
  return (
    <Svg width={ancho} height={alto} viewBox={`${x} ${y} ${w} ${h}`} accessibilityLabel="Rancho Las Lomas">
      {trazosLogo.venado.map((d, i) => (
        <Path key={`v${i}`} d={d} fill={primario} />
      ))}
      {trazosLogo.lasLomas.map((d, i) => (
        <Path key={`l${i}`} d={d} fill={primario} />
      ))}
      {trazosLogo.colina.map((d, i) => (
        <Path key={`c${i}`} d={d} fill={acento} />
      ))}
      {trazosLogo.rancho.map((d, i) => (
        <Path key={`r${i}`} d={d} fill={acento} />
      ))}
    </Svg>
  );
}
