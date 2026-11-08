/**
 * Íconos de línea, sobrios, dibujados a mano (funcionan igual en web y en iPhone).
 */
import Svg, { Circle, Path } from 'react-native-svg';

interface Props {
  color: string;
  tamano?: number;
}
const trazo = { strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

export function IconoMapa({ color, tamano = 24 }: Props) {
  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 24 24">
      <Path d="M3 6.5 L9 4 L15 6.5 L21 4 V17.5 L15 20 L9 17.5 L3 20 Z M9 4 V17.5 M15 6.5 V20" stroke={color} {...trazo} />
    </Svg>
  );
}

export function IconoCenso({ color, tamano = 24 }: Props) {
  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 24 24">
      <Circle cx={12} cy={13.5} r={7.5} stroke={color} {...trazo} />
      <Path d="M12 9.5 V13.5 L14.8 15.3 M9.5 2.8 H14.5 M12 2.8 V6" stroke={color} {...trazo} />
    </Svg>
  );
}

export function IconoBitacora({ color, tamano = 24 }: Props) {
  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 24 24">
      <Path d="M5 4.5 C5 3.7 5.7 3 6.5 3 H19 V18 H6.5 C5.7 18 5 18.7 5 19.5 Z M5 19.5 C5 20.3 5.7 21 6.5 21 H19 V18 M9 7.5 H15 M9 10.5 H13" stroke={color} {...trazo} />
    </Svg>
  );
}

export function IconoAdmin({ color, tamano = 24 }: Props) {
  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 24 24">
      <Path d="M4 6.5 H20 M4 12 H20 M4 17.5 H20" stroke={color} {...trazo} />
      <Circle cx={9} cy={6.5} r={2} stroke={color} {...trazo} fill="none" />
      <Circle cx={15.5} cy={12} r={2} stroke={color} {...trazo} fill="none" />
      <Circle cx={7.5} cy={17.5} r={2} stroke={color} {...trazo} fill="none" />
    </Svg>
  );
}
