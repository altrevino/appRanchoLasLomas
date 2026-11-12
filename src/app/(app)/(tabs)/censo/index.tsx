/**
 * Pestaña Censo: censo en curso, avisos, preparados (admin) e historial.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BotonCuenta } from '../../../../components/BotonCuenta';
import { AvisosCenso } from '../../../../components/censo/AvisosCenso';
import { Aviso, Boton, Encabezado, Etiqueta, Fila, Titulo } from '../../../../components/consulta';
import { enviarAvisoInicio } from '../../../../lib/censo/avisos';
import { useCensoActual } from '../../../../lib/censo/datos';
import { fechaCorta, mmss, useRestante } from '../../../../lib/censo/tiempo';
import type { Censo } from '../../../../lib/censo/tipos';
import { esAdmin, esStaff, useSesion } from '../../../../lib/sesion';
import { mensajeDeError, supabase } from '../../../../lib/supabase';
import { borde, espacio, radio, temas, tipografia } from '../../../../theme';

const t = temas.consulta;

export default function CensoInicio() {
  const { perfil } = useSesion();
  const admin = esAdmin(perfil);
  const { datos, recargar } = useCensoActual();
  const enCurso = datos?.censo?.estado === 'en_curso' ? datos.censo : null;
  const restante = useRestante(enCurso?.fin_at);
  const [lista, setLista] = useState<Censo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [iniciando, setIniciando] = useState<string | null>(null);
  const [porDescartar, setPorDescartar] = useState<string | null>(null);

  const cargarLista = useCallback(async () => {
    const { data } = await supabase
      .from('censos')
      .select('id, nombre, duracion_min, estado, inicio_at, fin_at, es_simulacion, creado_at')
      .in('estado', admin ? ['borrador', 'cerrado'] : ['cerrado'])
      .order('creado_at', { ascending: false })
      .limit(40);
    setLista((data as Censo[]) ?? []);
  }, [admin]);

  useFocusEffect(
    useCallback(() => {
      cargarLista();
      recargar();
    }, [cargarLista, recargar]),
  );

  async function iniciar(id: string) {
    setError(null);
    setIniciando(id);
    const { error: e } = await supabase.rpc('iniciar_censo', { p_id: id });
    if (e) {
      setIniciando(null);
      return setError(mensajeDeError(e));
    }
    await enviarAvisoInicio(id);
    setIniciando(null);
    router.push({ pathname: '/censo/[id]', params: { id } });
  }

  async function descartar(id: string) {
    if (porDescartar !== id) return setPorDescartar(id);
    setPorDescartar(null);
    await supabase.rpc('terminar_censo', { p_id: id });
    cargarLista();
  }

  const preparados = lista.filter((c) => c.estado === 'borrador');
  const cerrados = lista.filter((c) => c.estado === 'cerrado');

  return (
    <View style={estilos.raiz}>
      <Encabezado atras={false} derecha={<BotonCuenta />} />
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Titulo>Censo</Titulo>

        {enCurso ? (
          <View style={estilos.enCurso}>
            <Etiqueta>En curso</Etiqueta>
            <Text style={[tipografia.titulo2, { color: t.titulo }]}>{enCurso.nombre}</Text>
            <Text style={[tipografia.contador, { color: restante < 60_000 ? t.alerta : t.texto, fontVariant: ['tabular-nums'] }]}>
              {mmss(restante)}
            </Text>
            <Boton onPress={() => router.push('/captura')}>Entrar a la captura</Boton>
            {esStaff(perfil) ? (
              <Boton variante="secundario" onPress={() => router.push({ pathname: '/censo/[id]', params: { id: enCurso.id } })}>
                Ver conteo en vivo
              </Boton>
            ) : null}
          </View>
        ) : (
          <Text style={[tipografia.cuerpo, { color: t.textoSecundario }]}>
            No hay ningún censo en curso. Cuando el administrador inicie uno, esta pantalla entra sola a la captura.
          </Text>
        )}

        <AvisosCenso />

        {admin && !enCurso ? <Boton onPress={() => router.push('/censo/nuevo')}>Nuevo censo</Boton> : null}
        {error ? <Aviso>{error}</Aviso> : null}

        {admin && preparados.length ? (
          <View style={{ gap: espacio.s }}>
            <Titulo nivel={2}>Preparados</Titulo>
            <View style={estilos.lista}>
              {preparados.map((c) => (
                <View key={c.id} style={estilos.preparado}>
                  <Text style={[tipografia.cuerpoFuerte, { color: t.texto }]}>{c.nombre}</Text>
                  <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>{c.duracion_min} minutos</Text>
                  <View style={estilos.acciones}>
                    <View style={{ flex: 1 }}>
                      <Boton onPress={() => iniciar(c.id)} cargando={iniciando === c.id} deshabilitado={!!enCurso}>
                        Iniciar
                      </Boton>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Boton variante="peligro" onPress={() => descartar(c.id)}>
                        {porDescartar === c.id ? '¿Seguro?' : 'Descartar'}
                      </Boton>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ gap: espacio.s }}>
          <Titulo nivel={2}>Censos anteriores</Titulo>
          {cerrados.length === 0 ? <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>Aún no hay censos cerrados.</Text> : null}
          <View style={estilos.lista}>
            {cerrados.map((c) => (
              <Fila
                key={c.id}
                titulo={c.nombre + (c.es_simulacion ? ' · simulación' : '')}
                detalle={fechaCorta(c.inicio_at)}
                onPress={() => router.push({ pathname: '/censo/[id]', params: { id: c.id } })}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: t.fondo },
  contenido: { padding: espacio.l, gap: espacio.l, paddingBottom: espacio.xxxl },
  enCurso: { gap: espacio.m, padding: espacio.l, borderWidth: borde.fino, borderColor: t.acento, borderRadius: radio.m, backgroundColor: t.superficie },
  lista: { borderWidth: borde.fino, borderColor: t.borde, borderRadius: radio.m, overflow: 'hidden' },
  preparado: { padding: espacio.l, gap: espacio.xs, backgroundColor: t.superficie, borderBottomWidth: borde.fino, borderBottomColor: t.borde },
  acciones: { flexDirection: 'row', gap: espacio.s, marginTop: espacio.s },
});
