/**
 * Bitácora: lista de ejemplares con filtros y búsqueda.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BotonCuenta } from '../../../../components/BotonCuenta';
import { TarjetaMacho } from '../../../../components/bitacora/TarjetaMacho';
import { Aviso, Boton, Campo, Encabezado, Opcion, Titulo } from '../../../../components/consulta';
import { useMachos } from '../../../../lib/bitacora/datos';
import { useUrlsFotos } from '../../../../lib/bitacora/fotos';
import type { EstadoEfectivo } from '../../../../lib/bitacora/tipos';
import { useEnvios, usePendientes } from '../../../../lib/censo/cola';
import { espacio, temas, tipografia } from '../../../../theme';

const t = temas.consulta;
const FILTROS: [EstadoEfectivo | 'todos', string][] = [
  ['todos', 'Todos'],
  ['activo', 'Activos'],
  ['por_validar', 'Por validar'],
  ['sin_ver', 'Sin ver 60 días'],
  ['cazado', 'Cazados'],
];

const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function Bitacora() {
  const { machos, sinConexion, recargar } = useMachos();
  const pendientes = usePendientes();
  const [filtro, setFiltro] = useState<EstadoEfectivo | 'todos'>('todos');
  const [busqueda, setBusqueda] = useState('');

  // Cuando la cola termina de enviar algo, se recarga la lista.
  const envios = useEnvios();
  useEffect(() => {
    if (envios) recargar();
  }, [envios, recargar]);

  useFocusEffect(
    useCallback(() => {
      recargar();
    }, [recargar]),
  );

  const lista = useMemo(() => {
    const q = normal(busqueda.trim());
    return (machos ?? []).filter(
      (m) => (filtro === 'todos' || m.estado_efectivo === filtro) && (!q || normal(`${m.folio} ${m.apodo ?? ''}`).includes(q)),
    );
  }, [machos, filtro, busqueda]);
  const urls = useUrlsFotos(lista.map((m) => m.portada_path));
  const porValidar = (machos ?? []).filter((m) => m.estado === 'por_validar').length;

  return (
    <View style={estilos.raiz}>
      <Encabezado atras={false} derecha={<BotonCuenta />} />
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <Titulo>Bitácora</Titulo>
        <Boton onPress={() => router.push('/bitacora/registrar')}>Registrar avistamiento</Boton>
        {pendientes ? <Aviso tono="alerta">{`${pendientes} registro(s) por enviar. Se envían solos al haber señal.`}</Aviso> : null}
        {sinConexion ? <Aviso tono="alerta">Sin conexión: se muestra la última lista descargada.</Aviso> : null}
        {porValidar ? <Aviso tono="alerta">{`${porValidar} ejemplar(es) por validar.`}</Aviso> : null}

        <Campo etiqueta="Buscar" value={busqueda} onChangeText={setBusqueda} placeholder="Folio o apodo" autoCapitalize="none" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.filtros}>
          {FILTROS.map(([v, txt]) => (
            <Opcion key={v} activa={filtro === v} onPress={() => setFiltro(v)}>
              {txt}
            </Opcion>
          ))}
        </ScrollView>

        {machos && lista.length === 0 ? (
          <Text style={[tipografia.cuerpo, { color: t.textoSecundario }]}>
            {machos.length === 0 ? 'Aún no hay ejemplares. Registra el primer avistamiento.' : 'Ningún ejemplar con ese filtro.'}
          </Text>
        ) : null}
        <View style={{ gap: espacio.s }}>
          {lista.map((m) => (
            <TarjetaMacho
              key={m.id}
              macho={m}
              url={m.portada_path ? urls[m.portada_path] : undefined}
              onPress={() => router.push({ pathname: '/bitacora/[id]', params: { id: m.id } })}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: t.fondo },
  contenido: { padding: espacio.l, gap: espacio.l, paddingBottom: espacio.xxxl },
  filtros: { gap: espacio.s },
});
