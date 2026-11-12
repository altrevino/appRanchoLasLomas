/**
 * Editor de rasgos distintivos. Todo es opcional: "No sé" deja el dato vacío.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CuernoRoto, Forma, Rasgos } from '../../lib/bitacora/tipos';
import { borde, espacio, radio, tamanos, temas, tipografia } from '../../theme';
import { Etiqueta, Opcion } from '../consulta';

const t = temas.consulta;

function Puntas({ titulo, valor, onChange }: { titulo: string; valor: number | null; onChange: (v: number | null) => void }) {
  return (
    <View style={estilos.puntas}>
      <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>{titulo}</Text>
      <View style={estilos.paso}>
        <Pressable
          onPress={() => onChange(valor == null ? null : valor <= 1 ? null : valor - 1)}
          style={estilos.botonPaso}
          accessibilityRole="button"
          accessibilityLabel={`Menos puntas ${titulo}`}
        >
          <Text style={[tipografia.titulo2, { color: t.primario }]}>−</Text>
        </Pressable>
        <Text style={[tipografia.titulo1, { color: valor == null ? t.textoSecundario : t.titulo, minWidth: 48, textAlign: 'center' }]}>
          {valor ?? '?'}
        </Text>
        <Pressable
          onPress={() => onChange(Math.min(20, (valor ?? 0) + 1))}
          style={estilos.botonPaso}
          accessibilityRole="button"
          accessibilityLabel={`Más puntas ${titulo}`}
        >
          <Text style={[tipografia.titulo2, { color: t.primario }]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SiNo({ titulo, valor, onChange }: { titulo: string; valor: boolean | null; onChange: (v: boolean | null) => void }) {
  return (
    <View style={{ gap: espacio.xs }}>
      <Text style={[tipografia.secundario, { color: t.texto, fontWeight: '600' }]}>{titulo}</Text>
      <View style={estilos.opciones}>
        <Opcion activa={valor === true} onPress={() => onChange(valor === true ? null : true)}>
          Sí
        </Opcion>
        <Opcion activa={valor === false} onPress={() => onChange(valor === false ? null : false)}>
          No
        </Opcion>
        <Opcion activa={valor === null} onPress={() => onChange(null)}>
          No sé
        </Opcion>
      </View>
    </View>
  );
}

export function RasgosEditor({ valor, onChange }: { valor: Rasgos; onChange: (r: Rasgos) => void }) {
  const set = <K extends keyof Rasgos>(k: K, v: Rasgos[K]) => onChange({ ...valor, [k]: v });
  const formas: [Forma | null, string][] = [
    ['abierta', 'Abierta'],
    ['cerrada', 'Cerrada'],
    [null, 'No sé'],
  ];
  const cuernos: [CuernoRoto | null, string][] = [
    ['no', 'No'],
    ['izquierdo', 'Izquierdo'],
    ['derecho', 'Derecho'],
    ['ambos', 'Ambos'],
    [null, 'No sé'],
  ];
  return (
    <View style={{ gap: espacio.l }}>
      <View style={{ gap: espacio.s }}>
        <Etiqueta>Puntas por lado</Etiqueta>
        <View style={estilos.fila}>
          <Puntas titulo="Izquierdo" valor={valor.puntas_izq} onChange={(v) => set('puntas_izq', v)} />
          <Puntas titulo="Derecho" valor={valor.puntas_der} onChange={(v) => set('puntas_der', v)} />
        </View>
      </View>
      <View style={{ gap: espacio.xs }}>
        <Text style={[tipografia.secundario, { color: t.texto, fontWeight: '600' }]}>Forma de la cornamenta</Text>
        <View style={estilos.opciones}>
          {formas.map(([v, txt]) => (
            <Opcion key={txt} activa={valor.forma === v} onPress={() => set('forma', v)}>
              {txt}
            </Opcion>
          ))}
        </View>
      </View>
      <View style={{ gap: espacio.xs }}>
        <Text style={[tipografia.secundario, { color: t.texto, fontWeight: '600' }]}>Cuerno roto</Text>
        <View style={estilos.opciones}>
          {cuernos.map(([v, txt]) => (
            <Opcion key={txt} activa={valor.cuerno_roto === v} onPress={() => set('cuerno_roto', v)}>
              {txt}
            </Opcion>
          ))}
        </View>
      </View>
      <SiNo titulo="Puntas anómalas (de más, chuecas, hacia abajo)" valor={valor.puntas_anomalas} onChange={(v) => set('puntas_anomalas', v)} />
      <SiNo titulo="Oreja marcada o rota" valor={valor.oreja_marcada} onChange={(v) => set('oreja_marcada', v)} />
      <SiNo titulo="Cicatrices visibles" valor={valor.cicatrices} onChange={(v) => set('cicatrices', v)} />
    </View>
  );
}

/** Texto de los rasgos conocidos, para la ficha. */
export function rasgosEnTexto(r: Rasgos): [string, string][] {
  const filas: [string, string][] = [];
  if (r.puntas_izq != null || r.puntas_der != null) filas.push(['Puntas', `${r.puntas_izq ?? '?'} izq · ${r.puntas_der ?? '?'} der`]);
  if (r.forma) filas.push(['Cornamenta', r.forma === 'abierta' ? 'Abierta' : 'Cerrada']);
  if (r.cuerno_roto) filas.push(['Cuerno roto', r.cuerno_roto === 'no' ? 'No' : r.cuerno_roto[0].toUpperCase() + r.cuerno_roto.slice(1)]);
  if (r.puntas_anomalas != null) filas.push(['Puntas anómalas', r.puntas_anomalas ? 'Sí' : 'No']);
  if (r.oreja_marcada != null) filas.push(['Oreja marcada', r.oreja_marcada ? 'Sí' : 'No']);
  if (r.cicatrices != null) filas.push(['Cicatrices', r.cicatrices ? 'Sí' : 'No']);
  return filas;
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', gap: espacio.m },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  puntas: { flex: 1, alignItems: 'center', gap: espacio.xs, padding: espacio.m, borderWidth: borde.fino, borderColor: t.borde, borderRadius: radio.m, backgroundColor: t.superficie },
  paso: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  botonPaso: {
    width: tamanos.toqueMinimo,
    height: tamanos.toqueMinimo,
    borderRadius: radio.m,
    borderWidth: borde.medio,
    borderColor: t.primario,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
