/**
 * Espiaderos: cambiar nombre y radio de detección.
 * Las ubicaciones se cambian importando el KML.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Aviso, Boton, Campo, Encabezado, Fila, Titulo } from '../../../../components/consulta';
import { useDatosMapa, type Espiadero } from '../../../../lib/mapa/datos';
import { mensajeDeError, supabase } from '../../../../lib/supabase';
import { borde, espacio, radio, tamanos, temas, tipografia } from '../../../../theme';

const t = temas.consulta;
const PASO = 25;

export default function Espiaderos() {
  const { datos, recargar } = useDatosMapa();
  const [editando, setEditando] = useState<Espiadero | null>(null);

  return (
    <View style={estilos.raiz}>
      <Encabezado />
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Titulo>Espiaderos</Titulo>
        {editando ? (
          <Editor
            key={editando.id}
            espiadero={editando}
            onListo={() => {
              setEditando(null);
              recargar();
            }}
          />
        ) : null}
        <View style={estilos.lista}>
          {(datos?.espiaderos ?? []).map((e) => (
            <Fila
              key={e.id}
              titulo={e.nombre}
              detalle={`Radio ${e.radio_m} m${e.altitud_m != null ? ` · ${Math.round(e.altitud_m)} m s.n.m.` : ''}${e.origen === 'prueba' ? ' · prueba' : ''}`}
              onPress={() => setEditando(e)}
            />
          ))}
        </View>
        <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>
          Para mover espiaderos o agregar nuevos, importa el KML actualizado desde Administración.
        </Text>
      </ScrollView>
    </View>
  );
}

function Editor({ espiadero, onListo }: { espiadero: Espiadero; onListo: () => void }) {
  const [nombre, setNombre] = useState(espiadero.nombre);
  const [radioM, setRadioM] = useState(espiadero.radio_m);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    const { error: e } = await supabase.rpc('actualizar_espiadero', { p_id: espiadero.id, p_nombre: nombre, p_radio_m: radioM });
    setGuardando(false);
    if (e) return setError(/espiaderos_nombre_activo_idx|duplicate/i.test(e.message) ? 'Ya existe otro espiadero con ese nombre.' : mensajeDeError(e));
    onListo();
  }

  return (
    <View style={estilos.editor}>
      <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} maxLength={60} />
      <Text style={[tipografia.etiqueta, { color: t.acentoTexto }]}>Radio de detección</Text>
      <View style={estilos.paso}>
        <BotonPaso texto="−" onPress={() => setRadioM((r) => Math.max(25, r - PASO))} />
        <Text style={[tipografia.contador, { color: t.titulo, minWidth: 140, textAlign: 'center' }]}>{radioM} m</Text>
        <BotonPaso texto="+" onPress={() => setRadioM((r) => Math.min(2000, r + PASO))} />
      </View>
      <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>
        Si alguien está dentro de este radio, la app elige este espiadero al iniciar un censo.
      </Text>
      {error ? <Aviso>{error}</Aviso> : null}
      <Boton onPress={guardar} cargando={guardando} deshabilitado={!nombre.trim()}>
        Guardar
      </Boton>
      <Boton variante="secundario" onPress={onListo}>
        Cancelar
      </Boton>
    </View>
  );
}

function BotonPaso({ texto, onPress }: { texto: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={texto === '+' ? 'Aumentar radio' : 'Reducir radio'} style={estilos.botonPaso}>
      <Text style={[tipografia.titulo1, { color: t.primario }]}>{texto}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: t.fondo },
  contenido: { padding: espacio.l, gap: espacio.l, paddingBottom: espacio.xxxl },
  lista: { borderWidth: borde.fino, borderColor: t.borde, borderRadius: radio.m, overflow: 'hidden' },
  editor: { gap: espacio.m, padding: espacio.l, borderWidth: borde.fino, borderColor: t.acento, borderRadius: radio.m, backgroundColor: t.superficie },
  paso: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espacio.l },
  botonPaso: {
    width: tamanos.botonConsulta,
    height: tamanos.botonConsulta,
    borderRadius: radio.m,
    borderWidth: borde.medio,
    borderColor: t.primario,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
