import { Image, StyleSheet, View, type ViewStyle } from 'react-native';
import { temas } from '../../theme';
import { CabezaVenado } from '../logo';

const t = temas.consulta;

/** Foto del ejemplar o, si no hay, la cabeza del venado sobre verde. */
export function FotoMacho({ url, style, tamanoIcono = 64 }: { url?: string | null; style?: ViewStyle; tamanoIcono?: number }) {
  return (
    <View style={[estilos.marco, style]}>
      {url ? (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel="Foto del ejemplar" />
      ) : (
        <CabezaVenado tamano={tamanoIcono} color={t.acento} />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  marco: { backgroundColor: t.primario, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
