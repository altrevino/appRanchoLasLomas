/**
 * Cuadrícula de conteos por clase (modo consulta).
 */
import { StyleSheet, Text, View } from 'react-native';
import { CLASES, NOMBRE_CLASE, total, type Conteo } from '../../lib/censo/tipos';
import { borde, espacio, radio, temas, tipografia } from '../../theme';

const t = temas.consulta;

export function Conteos({ conteo, titulo }: { conteo: Conteo; titulo?: string }) {
  return (
    <View style={estilos.raiz}>
      <View style={estilos.encabezado}>
        {titulo ? <Text style={[tipografia.etiqueta, { color: t.acentoTexto }]}>{titulo}</Text> : <View />}
        <Text style={[tipografia.cuerpoFuerte, { color: t.texto }]}>Total {total(conteo)}</Text>
      </View>
      <View style={estilos.cuadricula}>
        {CLASES.map((c) => (
          <View key={c} style={estilos.celda} accessibilityLabel={`${NOMBRE_CLASE[c]}: ${conteo[c] ?? 0}`}>
            <Text style={[tipografia.contador, { color: t.titulo }]}>{conteo[c] ?? 0}</Text>
            <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>{NOMBRE_CLASE[c]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Texto compacto "M1 2 · M2 1 · Hembra 4". */
export const conteoEnLinea = (c: Conteo) =>
  CLASES.filter((k) => c[k])
    .map((k) => `${NOMBRE_CLASE[k]} ${c[k]}`)
    .join(' · ') || 'Sin registros';

const estilos = StyleSheet.create({
  raiz: { gap: espacio.s },
  encabezado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cuadricula: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  celda: {
    width: '31.5%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: espacio.m,
    borderWidth: borde.fino,
    borderColor: t.borde,
    borderRadius: radio.m,
    backgroundColor: t.superficie,
  },
});
