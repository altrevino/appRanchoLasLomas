/**
 * Marcador de espiadero: silueta de torre en verde bosque con borde arena y nombre.
 * Se usa igual en el mapa nativo y en la vista web.
 */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { paleta, radio, tamanos } from '../../theme';

export function SiluetaTorre({ tamano = tamanos.marcadorEspiadero, relleno = paleta.verdeBosque, borde = paleta.arena }: { tamano?: number; relleno?: string; borde?: string }) {
  return (
    <Svg width={tamano} height={tamano * 1.15} viewBox="0 0 32 37">
      {/* Patas y travesaño */}
      <Path d="M11 19 L7 35 M21 19 L25 35 M9.2 27 L22.8 27 M8.5 30 L16 23 L23.5 30" stroke={borde} strokeWidth={4.2} strokeLinecap="round" fill="none" />
      <Path d="M11 19 L7 35 M21 19 L25 35 M9.2 27 L22.8 27 M8.5 30 L16 23 L23.5 30" stroke={relleno} strokeWidth={2} strokeLinecap="round" fill="none" />
      {/* Techo y caseta con ventana corrida */}
      <Path
        d="M4 9.5 L16 2 L28 9.5 Z M8 10 H24 V20 H8 Z M10.5 12.5 V15.5 H21.5 V12.5 Z"
        fill={relleno}
        fillRule="evenodd"
        stroke={borde}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function MarcadorEspiadero({ nombre, seleccionado = false }: { nombre: string; seleccionado?: boolean }) {
  return (
    <View style={estilos.raiz}>
      <View style={[estilos.etiqueta, seleccionado && estilos.etiquetaSeleccionada]}>
        <Text style={[estilos.texto, seleccionado && { color: paleta.verdeNoche }]} numberOfLines={1}>
          {nombre}
        </Text>
      </View>
      <SiluetaTorre tamano={seleccionado ? tamanos.marcadorEspiadero + 6 : tamanos.marcadorEspiadero} />
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { alignItems: 'center' },
  etiqueta: {
    backgroundColor: 'rgba(21,29,23,0.82)',
    borderRadius: radio.s,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 2,
    maxWidth: 140,
  },
  etiquetaSeleccionada: { backgroundColor: paleta.arena },
  texto: { color: paleta.textoSobreOscuro, fontSize: 13, fontWeight: '600' },
});
