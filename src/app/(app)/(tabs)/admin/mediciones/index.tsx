/**
 * Mediciones de trofeo (solo administrador): lista y "Nueva medición".
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Aviso, Boton, Encabezado, Fila, Titulo } from '../../../../../components/consulta';
import { formato } from '../../../../../lib/mediciones/calculo';
import { folioMedicion, type Medicion } from '../../../../../lib/mediciones/tipos';
import { mensajeDeError, supabase } from '../../../../../lib/supabase';
import { borde, espacio, radio, temas, tipografia } from '../../../../../theme';

const t = temas.consulta;
type Resumen = Pick<Medicion, 'id' | 'folio' | 'cazador' | 'cazado_at' | 'lugar' | 'bruta' | 'neta_tipica'>;

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

export default function Mediciones() {
  const [lista, setLista] = useState<Resumen[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      supabase
        .from('mediciones')
        .select('id, folio, cazador, cazado_at, lugar, bruta, neta_tipica')
        .order('cazado_at', { ascending: false })
        .then(({ data, error: e }) => {
          if (e) setError(mensajeDeError(e));
          else setLista((data as Resumen[]) ?? []);
        });
    }, []),
  );

  return (
    <View style={estilos.raiz}>
      <Encabezado />
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Titulo>Mediciones</Titulo>
        <Text style={[tipografia.cuerpo, { color: t.textoSecundario }]}>
          Puntuación Boone and Crockett de los venados cazados. Solo la ven los administradores.
        </Text>
        <Boton onPress={() => router.push({ pathname: '/admin/mediciones/[id]', params: { id: 'nueva' } })}>Nueva medición</Boton>
        {error ? <Aviso>{error}</Aviso> : null}
        {lista && !lista.length ? <Text style={[tipografia.cuerpo, { color: t.textoSecundario }]}>Todavía no hay mediciones.</Text> : null}
        {lista?.length ? (
          <View style={estilos.lista}>
            {lista.map((m) => (
              <Fila
                key={m.id}
                titulo={`${folioMedicion(m.folio)} · ${m.cazador ?? 'Sin cazador'}`}
                detalle={[fecha(m.cazado_at), m.lugar].filter(Boolean).join(' · ')}
                derecha={
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[tipografia.cuerpoFuerte, { color: t.titulo }]}>{formato(m.bruta ?? 0)}</Text>
                    <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>{`neta ${formato(m.neta_tipica ?? 0)}`}</Text>
                  </View>
                }
                onPress={() => router.push({ pathname: '/admin/mediciones/[id]', params: { id: m.id } })}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: t.fondo },
  contenido: { padding: espacio.l, gap: espacio.l, paddingBottom: espacio.xxxl },
  lista: { borderWidth: borde.fino, borderColor: t.borde, borderRadius: radio.m, overflow: 'hidden' },
});
