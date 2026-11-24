/**
 * Captura de medidas por lado (derecho / izquierdo) en pulgadas y octavos.
 */
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { deCaptura, type Captura } from '../../lib/mediciones/calculo';
import { borde, espacio, radio, temas, tipografia } from '../../theme';

const t = temas.consulta;

export interface ParCaptura {
  d: Captura;
  i: Captura;
}

export function CeldaMedida({ valor, onChange, etiqueta }: { valor: Captura; onChange: (c: Captura) => void; etiqueta: string }) {
  const invalido = deCaptura(valor) === 'invalido';
  return (
    <View style={estilos.celda}>
      <TextInput
        value={valor.p}
        onChangeText={(p) => onChange({ ...valor, p: p.replace(/\D/g, '') })}
        keyboardType="number-pad"
        maxLength={2}
        placeholder="0"
        placeholderTextColor={t.borde}
        accessibilityLabel={`${etiqueta}, pulgadas`}
        style={[estilos.entrada, { flex: 1 }, invalido && estilos.invalido]}
        selectTextOnFocus
      />
      <TextInput
        value={valor.o}
        onChangeText={(o) => onChange({ ...valor, o: o.replace(/\D/g, '') })}
        keyboardType="number-pad"
        maxLength={1}
        placeholder="0"
        placeholderTextColor={t.borde}
        accessibilityLabel={`${etiqueta}, octavos`}
        style={[estilos.entrada, estilos.octavos, invalido && estilos.invalido]}
        selectTextOnFocus
      />
      <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>/8</Text>
    </View>
  );
}

export function FilaMedida({ nombre, par, onChange }: { nombre: string; par: ParCaptura; onChange: (p: ParCaptura) => void }) {
  return (
    <View style={estilos.fila}>
      <Text style={[tipografia.cuerpoFuerte, estilos.nombre, { color: t.texto }, nombre.length > 4 && { fontSize: 14, lineHeight: 17 }]}>{nombre}</Text>
      <CeldaMedida etiqueta={`${nombre} derecho`} valor={par.d} onChange={(d) => onChange({ ...par, d })} />
      <CeldaMedida etiqueta={`${nombre} izquierdo`} valor={par.i} onChange={(i) => onChange({ ...par, i })} />
    </View>
  );
}

export function EncabezadoLados() {
  return (
    <View style={estilos.fila}>
      <View style={estilos.nombre} />
      <Text style={[tipografia.etiqueta, estilos.lado, { color: t.acentoTexto }]}>RIGHT</Text>
      <Text style={[tipografia.etiqueta, estilos.lado, { color: t.acentoTexto }]}>LEFT</Text>
    </View>
  );
}

export function BotonAgregar({ children, onPress }: { children: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={estilos.agregar} hitSlop={6}>
      <Text style={[tipografia.secundario, { color: t.primario, fontWeight: '600' }]}>{`+ ${children}`}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  nombre: { width: 56 },
  lado: { flex: 1, textAlign: 'center' },
  celda: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  entrada: {
    height: 44,
    minWidth: 0,
    borderWidth: borde.fino,
    borderColor: t.borde,
    borderRadius: radio.s,
    backgroundColor: t.superficie,
    textAlign: 'center',
    fontSize: 17,
    color: t.texto,
    paddingHorizontal: espacio.xs,
  },
  octavos: { width: 36 },
  invalido: { borderColor: t.error, borderWidth: borde.medio },
  agregar: { alignSelf: 'flex-start', paddingVertical: espacio.s },
});
