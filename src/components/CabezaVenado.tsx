import Svg, { Path } from 'react-native-svg';

/**
 * MARCADOR DE POSICIÓN: cabeza de venado esquemática hasta recibir el SVG del
 * logotipo en /assets/logo. Al tenerlo, reemplazar el contenido de este
 * componente por el trazo real; la interfaz (tamano, color) no cambia.
 */
export function CabezaVenado({ tamano = 28, color }: { tamano?: number; color: string }) {
  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 100 100" accessibilityLabel="Rancho Las Lomas">
      {/* Cornamenta */}
      <Path
        d="M42 40 C36 28 30 20 28 6 M33 24 L22 18 M36 30 L26 30 M58 40 C64 28 70 20 72 6 M67 24 L78 18 M64 30 L74 30"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      {/* Orejas */}
      <Path d="M40 46 C30 42 22 44 16 48 C24 54 32 54 41 52 Z" fill={color} />
      <Path d="M60 46 C70 42 78 44 84 48 C76 54 68 54 59 52 Z" fill={color} />
      {/* Cabeza */}
      <Path d="M40 42 C46 37 54 37 60 42 L58 74 C56 86 44 86 42 74 Z" fill={color} />
    </Svg>
  );
}
