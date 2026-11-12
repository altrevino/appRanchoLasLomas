/**
 * Módulo 1: mapa del rancho con espiaderos y ubicación en vivo.
 */
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BotonCuenta } from '../../../components/BotonCuenta';
import { Aviso, Encabezado, Etiqueta } from '../../../components/consulta';
import { MapaRancho } from '../../../components/mapa/MapaRancho';
import type { MapaRanchoRef } from '../../../components/mapa/tipos';
import { distanciaM, puntoCardinal, rumboGrados } from '../../../lib/geo';
import { useDatosMapa, type Espiadero } from '../../../lib/mapa/datos';
import { esStaff, useSesion } from '../../../lib/sesion';
import { useUbicacion } from '../../../lib/ubicacion';
import { supabase } from '../../../lib/supabase';
import { haceDias } from '../../../components/bitacora/TarjetaMacho';
import { borde, espacio, radio, temas, tipografia } from '../../../theme';

const t = temas.consulta;

function formatoDistancia(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export default function Mapa() {
  const { perfil } = useSesion();
  const { datos, error, cargando, recargar } = useDatosMapa();
  const { ubicacion, permiso } = useUbicacion();
  const [seleccion, setSeleccion] = useState<Espiadero | null>(null);
  const mapa = useRef<MapaRanchoRef>(null);
  const [avistamientos, setAvistamientos] = useState<{ macho_id: string; folio: string; apodo: string | null; clase: string; observado_at: string }[] | null>(null);
  const staff = esStaff(perfil);

  // Últimos avistamientos del espiadero tocado (solo personal)
  useEffect(() => {
    if (!seleccion || !staff) return;
    let vivo = true;
    supabase.rpc('ultimos_avistamientos', { p_espiadero: seleccion.id, p_limite: 5 }).then(({ data }) => {
      if (vivo) setAvistamientos(data ?? []);
    });
    return () => {
      vivo = false;
      setAvistamientos(null);
    };
  }, [seleccion, staff]);

  // Al volver a la pestaña (por ejemplo, después de importar un KML) se recarga.
  useFocusEffect(
    useCallback(() => {
      recargar();
    }, [recargar]),
  );

  const sinDatos = datos && datos.espiaderos.length === 0 && datos.linderos.length === 0;

  return (
    <View style={estilos.raiz}>
      <StatusBar style={t.barraEstado} />
      <Encabezado atras={false} derecha={<BotonCuenta />} />
      <View style={estilos.mapa}>
        {datos && !sinDatos ? (
          <MapaRancho
            ref={mapa}
            datos={datos}
            ubicacion={ubicacion}
            espiaderoSeleccionado={seleccion?.id ?? null}
            onTocarEspiadero={setSeleccion}
            onTocarMapa={() => setSeleccion(null)}
          />
        ) : (
          <View style={estilos.vacio}>
            {cargando ? (
              <ActivityIndicator color={t.primario} />
            ) : (
              <Text style={[tipografia.cuerpo, { color: t.textoSecundario, textAlign: 'center' }]}>
                {sinDatos
                  ? 'Aún no hay mapa cargado. El administrador debe importar el KML del rancho.'
                  : 'No se pudo cargar el mapa. Revisa la señal.'}
              </Text>
            )}
          </View>
        )}

        <View style={estilos.avisos} pointerEvents="box-none">
          {error && datos ? <Aviso tono="alerta">{error}</Aviso> : null}
          {permiso === 'negado' ? (
            <Aviso tono="alerta">Sin permiso de ubicación. Actívalo en Ajustes → Las Lomas → Ubicación.</Aviso>
          ) : null}
        </View>

        {datos && !sinDatos && !seleccion ? (
          <View style={estilos.botones}>
            <BotonMapa texto="Ver rancho" onPress={() => mapa.current?.verRancho()} />
            {ubicacion ? <BotonMapa texto="Mi ubicación" onPress={() => mapa.current?.irA([ubicacion.lon, ubicacion.lat])} /> : null}
          </View>
        ) : null}

        {seleccion ? (
          <View style={estilos.hoja}>
            <View style={estilos.hojaFila}>
              <Text style={[tipografia.titulo2, { color: t.titulo, flex: 1 }]} numberOfLines={2}>
                {seleccion.nombre}
              </Text>
              <Pressable onPress={() => setSeleccion(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar">
                <Text style={[tipografia.titulo2, { color: t.textoSecundario }]}>×</Text>
              </Pressable>
            </View>
            <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>
              Radio de detección {seleccion.radio_m} m
              {seleccion.altitud_m != null ? ` · Altitud ${Math.round(seleccion.altitud_m)} m` : ''}
              {seleccion.origen === 'prueba' ? ' · Dato de prueba' : ''}
            </Text>
            {ubicacion ? (
              <Text style={[tipografia.cuerpoFuerte, { color: t.texto }]}>
                A {formatoDistancia(distanciaM([ubicacion.lon, ubicacion.lat], [seleccion.lon, seleccion.lat]))} de ti, hacia el{' '}
                {puntoCardinal(rumboGrados([ubicacion.lon, ubicacion.lat], [seleccion.lon, seleccion.lat]))}
              </Text>
            ) : null}
            {staff ? (
              <View style={{ gap: espacio.xs, marginTop: espacio.s }}>
                <Etiqueta>Últimos avistamientos</Etiqueta>
                {avistamientos === null ? (
                  <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>Cargando…</Text>
                ) : avistamientos.length === 0 ? (
                  <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>Sin avistamientos registrados.</Text>
                ) : (
                  avistamientos.map((a) => (
                    <Text
                      key={a.macho_id + a.observado_at}
                      onPress={() => router.push({ pathname: '/bitacora/[id]', params: { id: a.macho_id } })}
                      style={[tipografia.secundario, { color: t.texto }]}
                      accessibilityRole="link"
                    >
                      <Text style={{ fontWeight: '700', color: t.primario }}>{a.folio}</Text>
                      {a.apodo ? ` “${a.apodo}”` : ''} · {a.clase} · {haceDias(a.observado_at)}
                    </Text>
                  ))
                )}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function BotonMapa({ texto, onPress }: { texto: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [estilos.botonMapa, pressed && { opacity: 0.8 }]}>
      <Text style={[tipografia.secundario, { color: t.textoSobrePrimario, fontWeight: '600' }]}>{texto}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: t.fondo },
  mapa: { flex: 1, backgroundColor: temas.campo.fondo },
  vacio: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espacio.xl, backgroundColor: t.fondo },
  avisos: { position: 'absolute', top: espacio.m, left: espacio.m, right: espacio.m, gap: espacio.s },
  botones: { position: 'absolute', right: espacio.m, bottom: espacio.xl, gap: espacio.s, alignItems: 'flex-end' },
  botonMapa: {
    minHeight: 44,
    paddingHorizontal: espacio.l,
    justifyContent: 'center',
    borderRadius: radio.m,
    backgroundColor: t.primario,
    borderWidth: borde.fino,
    borderColor: t.acento,
  },
  hoja: {
    position: 'absolute',
    left: espacio.m,
    right: espacio.m,
    bottom: espacio.m,
    backgroundColor: t.fondo,
    borderRadius: radio.l,
    borderWidth: borde.fino,
    borderColor: t.acento,
    padding: espacio.l,
    gap: espacio.xs,
  },
  hojaFila: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.m },
});
