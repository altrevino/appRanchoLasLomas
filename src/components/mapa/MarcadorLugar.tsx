/**
 * Marcador de lugar de referencia (la Casa): silueta de casa en arena sobre verde.
 */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { paleta, radio } from '../../theme';

export function MarcadorLugar({ nombre, seleccionado = false }: { nombre: string; seleccionado?: boolean }) {
  return (
    <View style={estilos.raiz}>
      <View style={[estilos.etiqueta, seleccionado && { backgroundColor: paleta.arena }]}>
        <Text style={[estilos.texto, seleccionado && { color: paleta.verdeNoche }]} numberOfLines={1}>
          {nombre}
        </Text>
      </View>
      <View style={estilos.disco}>
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Path d="M3 11.5 L12 4 L21 11.5 M5.5 9.5 V20 H10 V14.5 H14 V20 H18.5 V9.5" stroke={paleta.arena} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" fill="none" />
        </Svg>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { alignItems: 'center' },
  etiqueta: { backgroundColor: 'rgba(21,29,23,0.82)', borderRadius: radio.s, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 2 },
  texto: { color: paleta.textoSobreOscuro, fontSize: 13, fontWeight: '600' },
  disco: { width: 34, height: 34, borderRadius: 17, backgroundColor: paleta.verdeBosque, borderWidth: 2, borderColor: paleta.arena, alignItems: 'center', justifyContent: 'center' },
});
