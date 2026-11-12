/**
 * Módulos 1 y 4: mapa del rancho y medidor de distancias.
 *
 * Toca un espiadero, la Casa, un avistamiento (personal) o cualquier punto del
 * mapa: se dibuja una línea desde tu ubicación y se muestra la distancia en
 * línea recta, el rumbo (grados y punto cardinal) y la diferencia de altura.
 * Se actualiza al moverte.
 */
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BotonCuenta } from '../../../components/BotonCuenta';
import { haceDias } from '../../../components/bitacora/TarjetaMacho';
import { Aviso, Encabezado, Etiqueta, Opcion } from '../../../components/consulta';
import { MapaRancho } from '../../../components/mapa/MapaRancho';
import type { MapaRanchoRef } from '../../../components/mapa/tipos';
import { useDesnivel } from '../../../lib/elevacion';
import { distanciaM, puntoCardinal, rumboGrados, type LonLat } from '../../../lib/geo';
import { useDatosMapa, type Espiadero } from '../../../lib/mapa/datos';
import type { PuntoAvistamiento } from '../../../lib/mapa/estilo';
import { esStaff, useSesion } from '../../../lib/sesion';
import { supabase } from '../../../lib/supabase';
import { useUbicacion } from '../../../lib/ubicacion';
import { borde, espacio, radio, temas, tipografia } from '../../../theme';

const t = temas.consulta;

type Objetivo =
  | { tipo: 'espiadero'; punto: LonLat; espiadero: Espiadero }
  | { tipo: 'lugar'; punto: LonLat; nombre: string }
  | { tipo: 'avistamiento'; punto: LonLat; avistamiento: PuntoAvistamiento }
  | { tipo: 'punto'; punto: LonLat };

const formatoDistancia = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`);

function textoDesnivel(d: number) {
  if (Math.abs(d) < 3) return 'Casi al mismo nivel que tú';
  return d > 0 ? `${Math.round(d)} m más alto que tú` : `${Math.round(-d)} m más bajo que tú`;
}

export default function Mapa() {
  const { perfil } = useSesion();
  const staff = esStaff(perfil);
  const { datos, error, cargando, recargar } = useDatosMapa();
  const { ubicacion, permiso } = useUbicacion();
  const [objetivo, setObjetivo] = useState<Objetivo | null>(null);
  const [verAvist, setVerAvist] = useState(false);
  const [puntosAvist, setPuntosAvist] = useState<PuntoAvistamiento[]>([]);
  const [ultimos, setUltimos] = useState<{ macho_id: string; folio: string; apodo: string | null; clase: string; observado_at: string }[] | null>(null);
  const mapa = useRef<MapaRanchoRef>(null);

  useFocusEffect(
    useCallback(() => {
      recargar();
    }, [recargar]),
  );

  // Avistamientos recientes en el mapa (personal, si se activan)
  useEffect(() => {
    if (!staff || !verAvist) return;
    let vivo = true;
    supabase.rpc('avistamientos_recientes', { p_dias: 30 }).then(({ data }) => {
      if (vivo) setPuntosAvist((data as PuntoAvistamiento[]) ?? []);
    });
    return () => {
      vivo = false;
      setPuntosAvist([]);
    };
  }, [staff, verAvist]);

  // Últimos avistamientos del espiadero elegido (personal)
  const espId = objetivo?.tipo === 'espiadero' ? objetivo.espiadero.id : null;
  useEffect(() => {
    if (!espId || !staff) return;
    let vivo = true;
    supabase.rpc('ultimos_avistamientos', { p_espiadero: espId, p_limite: 5 }).then(({ data }) => {
      if (vivo) setUltimos(data ?? []);
    });
    return () => {
      vivo = false;
      setUltimos(null);
    };
  }, [espId, staff]);

  const yo: LonLat | null = ubicacion ? [ubicacion.lon, ubicacion.lat] : null;
  const desnivel = useDesnivel(yo, objetivo?.punto ?? null);
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
            espiaderoSeleccionado={objetivo?.tipo === 'espiadero' ? objetivo.espiadero.id : null}
            objetivo={objetivo?.punto ?? null}
            avistamientos={staff && verAvist ? puntosAvist : []}
            onTocarEspiadero={(e) => setObjetivo({ tipo: 'espiadero', punto: [e.lon, e.lat], espiadero: e })}
            onTocarLugar={(l) => setObjetivo({ tipo: 'lugar', punto: [l.lon, l.lat], nombre: l.nombre })}
            onTocarAvistamiento={(a) => setObjetivo({ tipo: 'avistamiento', punto: [a.lon, a.lat], avistamiento: a })}
            onTocarMapa={(p) => setObjetivo({ tipo: 'punto', punto: p })}
          />
        ) : (
          <View style={estilos.vacio}>
            {cargando ? (
              <ActivityIndicator color={t.primario} />
            ) : (
              <Text style={[tipografia.cuerpo, { color: t.textoSecundario, textAlign: 'center' }]}>
                {sinDatos ? 'Aún no hay mapa cargado. El administrador debe importar el KML del rancho.' : 'No se pudo cargar el mapa. Revisa la señal.'}
              </Text>
            )}
          </View>
        )}

        <View style={estilos.avisos} pointerEvents="box-none">
          {error && datos ? <Aviso tono="alerta">{error}</Aviso> : null}
          {permiso === 'negado' ? <Aviso tono="alerta">Sin permiso de ubicación. Actívalo en Ajustes → Las Lomas → Ubicación.</Aviso> : null}
          {staff && datos && !sinDatos ? (
            <View style={{ flexDirection: 'row' }}>
              <Opcion activa={verAvist} onPress={() => setVerAvist(!verAvist)}>
                {verAvist ? `Avistamientos 30 días (${puntosAvist.length})` : 'Ver avistamientos'}
              </Opcion>
            </View>
          ) : null}
        </View>

        {datos && !sinDatos && !objetivo ? (
          <View style={estilos.botones}>
            <Text style={[tipografia.secundario, estilos.pista]}>Toca un punto para medir la distancia</Text>
            <BotonMapa texto="Ver rancho" onPress={() => mapa.current?.verRancho()} />
            {ubicacion ? <BotonMapa texto="Mi ubicación" onPress={() => mapa.current?.irA([ubicacion.lon, ubicacion.lat])} /> : null}
          </View>
        ) : null}

        {objetivo ? (
          <View style={estilos.hoja}>
            <View style={estilos.hojaFila}>
              <Text style={[tipografia.titulo2, { color: t.titulo, flex: 1 }]} numberOfLines={2}>
                {objetivo.tipo === 'espiadero'
                  ? objetivo.espiadero.nombre
                  : objetivo.tipo === 'lugar'
                    ? objetivo.nombre
                    : objetivo.tipo === 'avistamiento'
                      ? objetivo.avistamiento.folio + (objetivo.avistamiento.apodo ? ` “${objetivo.avistamiento.apodo}”` : '')
                      : 'Punto en el mapa'}
              </Text>
              <Pressable onPress={() => setObjetivo(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar">
                <Text style={[tipografia.titulo2, { color: t.textoSecundario }]}>×</Text>
              </Pressable>
            </View>

            {/* Medición */}
            {yo ? (
              <View style={estilos.medida} accessibilityLiveRegion="polite">
                <Text style={[tipografia.contador, { color: t.titulo }]}>{formatoDistancia(distanciaM(yo, objetivo.punto))}</Text>
                <View style={{ flex: 1, gap: espacio.xxs }}>
                  <Text style={[tipografia.cuerpoFuerte, { color: t.texto }]}>
                    Rumbo {Math.round(rumboGrados(yo, objetivo.punto))}° {puntoCardinal(rumboGrados(yo, objetivo.punto))}
                  </Text>
                  <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>
                    {desnivel.tu != null && desnivel.objetivo != null ? textoDesnivel(desnivel.objetivo - desnivel.tu) : 'Altura no disponible sin señal'}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>
                {permiso === 'negado' ? 'Activa tu ubicación para medir la distancia.' : 'Buscando tu ubicación para medir…'}
              </Text>
            )}

            {/* Detalle */}
            {objetivo.tipo === 'espiadero' ? (
              <>
                <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>
                  Radio de detección {objetivo.espiadero.radio_m} m
                  {desnivel.objetivo != null ? ` · Terreno ${Math.round(desnivel.objetivo)} m s.n.m.` : ''}
                </Text>
                {staff ? (
                  <View style={{ gap: espacio.xs, marginTop: espacio.xs }}>
                    <Etiqueta>Últimos avistamientos</Etiqueta>
                    {ultimos === null ? (
                      <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>Cargando…</Text>
                    ) : ultimos.length === 0 ? (
                      <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>Sin avistamientos registrados.</Text>
                    ) : (
                      ultimos.map((a) => (
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
              </>
            ) : objetivo.tipo === 'avistamiento' ? (
              <Text
                onPress={() => router.push({ pathname: '/bitacora/[id]', params: { id: objetivo.avistamiento.macho_id } })}
                style={[tipografia.secundario, { color: t.texto }]}
                accessibilityRole="link"
              >
                {objetivo.avistamiento.clase} · visto {haceDias(objetivo.avistamiento.observado_at)} ·{' '}
                <Text style={{ color: t.primario, fontWeight: '700' }}>Ver ficha</Text>
              </Text>
            ) : objetivo.tipo === 'punto' && desnivel.objetivo != null ? (
              <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>Terreno {Math.round(desnivel.objetivo)} m s.n.m.</Text>
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
  botones: { position: 'absolute', right: espacio.m, bottom: espacio.xl, left: espacio.m, gap: espacio.s, alignItems: 'flex-end' },
  pista: { color: temas.campo.texto, backgroundColor: 'rgba(21,29,23,0.75)', paddingHorizontal: espacio.s, paddingVertical: espacio.xxs, borderRadius: radio.s, alignSelf: 'flex-start' },
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
    gap: espacio.s,
  },
  hojaFila: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.m },
  medida: { flexDirection: 'row', alignItems: 'center', gap: espacio.l },
});
