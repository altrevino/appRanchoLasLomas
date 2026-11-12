/**
 * Monitor en vivo (censo en curso) y resumen (censo cerrado).
 * Personal: totales y desglose por espiadero. Invitado: sus propios conteos y,
 * al cerrar, los totales por clase (sin desglose por espiadero).
 */
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { conteoEnLinea, Conteos } from '../../../../components/censo/Conteos';
import { Aviso, Boton, Encabezado, Etiqueta, Titulo } from '../../../../components/consulta';
import { useResumen } from '../../../../lib/censo/datos';
import { total } from '../../../../lib/censo/tipos';
import { ahoraServidor } from '../../../../lib/censo/reloj';
import { fechaCorta, haceCuanto, mmss, useRestante } from '../../../../lib/censo/tiempo';
import { esAdmin, esStaff, useSesion } from '../../../../lib/sesion';
import { mensajeDeError, supabase } from '../../../../lib/supabase';
import { borde, espacio, radio, temas, tipografia } from '../../../../theme';

const t = temas.consulta;

export default function ResumenCenso() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { perfil } = useSesion();
  const [cerrado, setCerrado] = useState(false);
  const { resumen, error, recargar } = useResumen(id, !cerrado);
  const restante = useRestante(resumen?.censo.estado === 'en_curso' ? resumen.censo.fin_at : null);
  const [confirmar, setConfirmar] = useState(false);
  const [terminando, setTerminando] = useState(false);
  const [errorTerminar, setErrorTerminar] = useState<string | null>(null);

  const c = resumen?.censo;
  const enCurso = c?.estado === 'en_curso' && restante > 0;
  if (c?.estado === 'cerrado' && !cerrado) setCerrado(true);

  async function terminar() {
    if (!confirmar) return setConfirmar(true);
    setTerminando(true);
    const { error: e } = await supabase.rpc('terminar_censo', { p_id: id });
    setTerminando(false);
    setConfirmar(false);
    if (e) return setErrorTerminar(mensajeDeError(e));
    recargar();
  }

  const ahora = ahoraServidor();
  return (
    <View style={estilos.raiz}>
      <Encabezado />
      <ScrollView contentContainerStyle={estilos.contenido}>
        {!resumen ? (
          error ? <Aviso>{error}</Aviso> : <Text style={[tipografia.cuerpo, { color: t.textoSecundario }]}>Cargando…</Text>
        ) : (
          <>
            <View style={{ gap: espacio.xs }}>
              <Titulo>{c!.nombre}</Titulo>
              <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>
                {enCurso ? 'En curso' : 'Cerrado'} · {fechaCorta(c!.inicio_at)}
                {c!.es_simulacion ? ' · simulación' : ''}
              </Text>
            </View>

            {enCurso ? (
              <View style={estilos.reloj}>
                <Etiqueta>Tiempo restante</Etiqueta>
                <Text style={[tipografia.cronometro, { color: restante < 60_000 ? t.alerta : t.titulo }]}>{mmss(restante)}</Text>
                <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>Se actualiza solo con cada registro.</Text>
              </View>
            ) : null}

            {resumen.totales ? <Conteos conteo={resumen.totales} titulo={enCurso ? 'Conteo en vivo' : 'Totales del censo'} /> : null}

            {resumen.por_espiadero ? (
              <View style={{ gap: espacio.s }}>
                <Titulo nivel={2}>Por espiadero</Titulo>
                <View style={estilos.lista}>
                  {resumen.por_espiadero.map((e) => (
                    <View key={e.espiadero_id} style={estilos.fila}>
                      <View style={estilos.filaArriba}>
                        <Text style={[tipografia.cuerpoFuerte, { color: t.texto, flex: 1 }]}>{e.nombre}</Text>
                        <Text style={[tipografia.titulo2, { color: t.titulo }]}>{e.total}</Text>
                      </View>
                      <Text style={[tipografia.secundario, { color: t.texto }]}>{conteoEnLinea(e.clases)}</Text>
                      <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>
                        {[e.personas.length ? e.personas.join(', ') : e.asignado_nombre ? `Asignado: ${e.asignado_nombre}` : 'Sin persona', enCurso ? haceCuanto(e.ultimo_at, ahora) : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : !esStaff(perfil) ? (
              <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>
                {enCurso ? 'Los totales del censo se muestran al terminar.' : 'El desglose por espiadero solo lo ve el personal del rancho.'}
              </Text>
            ) : null}

            {total(resumen.mis_totales) > 0 || !esStaff(perfil) ? <Conteos conteo={resumen.mis_totales} titulo="Tus registros" /> : null}

            {esAdmin(perfil) && c!.estado === 'en_curso' ? (
              <View style={{ gap: espacio.s }}>
                {errorTerminar ? <Aviso>{errorTerminar}</Aviso> : null}
                <Boton variante="peligro" onPress={terminar} cargando={terminando}>
                  {confirmar ? 'Toca otra vez para terminar' : 'Terminar ahora'}
                </Boton>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: t.fondo },
  contenido: { padding: espacio.l, gap: espacio.l, paddingBottom: espacio.xxxl },
  reloj: { alignItems: 'center', gap: espacio.xxs, padding: espacio.l, borderWidth: borde.fino, borderColor: t.acento, borderRadius: radio.m, backgroundColor: t.superficie },
  lista: { borderWidth: borde.fino, borderColor: t.borde, borderRadius: radio.m, overflow: 'hidden' },
  fila: { padding: espacio.m, gap: espacio.xxs, backgroundColor: t.superficie, borderBottomWidth: borde.fino, borderBottomColor: t.borde },
  filaArriba: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
});
