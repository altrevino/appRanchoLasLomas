/**
 * Captura del censo (modo campo): siempre oscura, botones grandes, una mano.
 *
 * - Espiadero: el que contiene al usuario en su radio (GPS). Si no está en
 *   ninguno, se elige de una lista. Siempre se puede cambiar.
 * - Cada toque crea un registro con la hora del servidor y se guarda en la cola
 *   local; se envía en cuanto hay señal.
 * - Al llegar a cero se bloquea la captura.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Brightness from 'expo-brightness';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ayudaClases } from '../../config/textos';
import { encolar, pendientes, usePendientes } from '../../lib/censo/cola';
import { useCensoActual } from '../../lib/censo/datos';
import { ahoraServidor } from '../../lib/censo/reloj';
import { NOMBRE_CLASE, conteoVacio, type Censo, type Clase, type EspiaderoCenso } from '../../lib/censo/tipos';
import { distanciaM, espiaderoEnRadio } from '../../lib/geo';
import { useSesion } from '../../lib/sesion';
import { supabase } from '../../lib/supabase';
import { useUbicacion } from '../../lib/ubicacion';
import { borde, brilloCampo, espacio, radio, tamanos, temas, tipografia } from '../../theme';

const t = temas.campo;
const esNativo = Platform.OS !== 'web';

interface MiRegistro {
  id: string;
  espiadero_id: string;
  clase: Clase;
  capturado_at: string;
  anulado: boolean;
}

function vibrar(tipo: 'toque' | 'deshacer' | 'fin') {
  if (esNativo) {
    if (tipo === 'toque') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    else if (tipo === 'deshacer') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(tipo === 'toque' ? 30 : 80); // Android; el iPhone en Safari no vibra
  }
}

/** Pantalla siempre encendida durante la captura (sin romper si el navegador no lo permite). */
function useMantenerEncendida() {
  useEffect(() => {
    const tag = 'captura-censo';
    activateKeepAwakeAsync(tag).catch(() => {});
    return () => {
      Promise.resolve()
        .then(() => deactivateKeepAwake(tag))
        .catch(() => {});
    };
  }, []);
}

function useBrilloCampo() {
  useEffect(() => {
    if (!esNativo) return;
    let previo: number | null = null;
    Brightness.getBrightnessAsync()
      .then((b) => {
        previo = b;
        return Brightness.setBrightnessAsync(Math.min(b, brilloCampo));
      })
      .catch(() => {});
    return () => {
      if (previo !== null) Brightness.setBrightnessAsync(previo).catch(() => {});
    };
  }, []);
}

// Machos en dos filas (M1–M3, M4–M5) y hembras/crías, las más frecuentes, abajo.
const FILAS: Clase[][] = [
  ['M1', 'M2', 'M3'],
  ['M4', 'M5'],
  ['hembra', 'cria'],
];

const formatear = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const formatoDistancia = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

export default function Captura() {
  useMantenerEncendida();
  useBrilloCampo();
  const insets = useSafeAreaInsets();
  const { perfil } = useSesion();
  const { datos, cargando } = useCensoActual();
  const { ubicacion, permiso } = useUbicacion();
  const pendientesN = usePendientes();

  // Se conserva el último censo visto, para mostrar "terminado" cuando se cierre.
  const [visto, setVisto] = useState<{ censo: Censo; espiaderos: EspiaderoCenso[] } | null>(null);
  if (datos?.censo && datos.censo.id !== visto?.censo.id) setVisto({ censo: datos.censo, espiaderos: datos.espiaderos });
  const censo: Censo | null = datos?.censo ?? (visto ? { ...visto.censo, estado: datos ? 'cerrado' : visto.censo.estado } : null);
  const espiaderos = datos?.censo ? datos.espiaderos : (visto?.espiaderos ?? []);

  const [espiaderoId, setEspiaderoId] = useState<string | null>(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [gpsAgotado, setGpsAgotado] = useState(false);
  const [registros, setRegistros] = useState<MiRegistro[]>([]);
  const [ahora, setAhora] = useState(() => ahoraServidor());
  const [destello, setDestello] = useState<Clase | null>(null);

  const claveEsp = censo ? `rll:captura:${censo.id}:esp` : null;
  const claveRegs = censo ? `rll:captura:${censo.id}:regs` : null;

  // Cronómetro con la hora del servidor
  useEffect(() => {
    const id = setInterval(() => setAhora(ahoraServidor()), 250);
    return () => clearInterval(id);
  }, []);

  // Recuperar espiadero y registros propios (del teléfono y del servidor)
  useEffect(() => {
    if (!censo || !claveEsp || !claveRegs || !perfil) return;
    let vivo = true;
    (async () => {
      const [esp, regsLocal] = await Promise.all([
        AsyncStorage.getItem(claveEsp).catch(() => null),
        AsyncStorage.getItem(claveRegs).catch(() => null),
      ]);
      if (!vivo) return;
      if (esp) setEspiaderoId(esp);
      const locales: MiRegistro[] = regsLocal ? JSON.parse(regsLocal) : [];
      const { data } = await supabase
        .from('registros_censo')
        .select('id, espiadero_id, clase, capturado_at, anulado_at')
        .eq('censo_id', censo.id)
        .eq('perfil_id', perfil.id);
      const enCola = await pendientes();
      const anuladosEnCola = new Set(enCola.filter((o) => o.op === 'anular').map((o) => o.id));
      const mapa = new Map<string, MiRegistro>();
      (data ?? []).forEach((r) =>
        mapa.set(r.id, { id: r.id, espiadero_id: r.espiadero_id, clase: r.clase, capturado_at: r.capturado_at, anulado: !!r.anulado_at }),
      );
      locales.forEach((r) => {
        const s = mapa.get(r.id);
        mapa.set(r.id, s ? { ...s, anulado: s.anulado || r.anulado || anuladosEnCola.has(r.id) } : r);
      });
      if (vivo) setRegistros([...mapa.values()].sort((a, b) => a.capturado_at.localeCompare(b.capturado_at)));
    })();
    return () => {
      vivo = false;
    };
  }, [censo?.id, claveEsp, claveRegs, perfil]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detección por GPS: el primer espiadero que contiene al usuario queda fijo
  // para todo el censo (aunque después se mueva). Siempre se puede cambiar a mano.
  const detectado = !espiaderoId && ubicacion ? espiaderoEnRadio([ubicacion.lon, ubicacion.lat], espiaderos) : null;
  if (detectado && !espiaderoId && !eligiendo) setEspiaderoId(detectado.id);
  const sinDeteccion = !espiaderoId && !detectado && (!!ubicacion || permiso === 'negado' || gpsAgotado);

  useEffect(() => {
    if (espiaderoId || ubicacion) return;
    const id = setTimeout(() => setGpsAgotado(true), 8000);
    return () => clearTimeout(id);
  }, [espiaderoId, ubicacion]);

  useEffect(() => {
    if (claveEsp && espiaderoId) AsyncStorage.setItem(claveEsp, espiaderoId).catch(() => {});
  }, [claveEsp, espiaderoId]);

  const elegir = (id: string) => {
    setEspiaderoId(id);
    setEligiendo(false);
  };

  const guardarRegistros = useCallback(
    (lista: MiRegistro[]) => {
      setRegistros(lista);
      if (claveRegs) AsyncStorage.setItem(claveRegs, JSON.stringify(lista)).catch(() => {});
    },
    [claveRegs],
  );

  const fin = censo?.fin_at ? new Date(censo.fin_at).getTime() : 0;
  const restante = fin - ahora;
  const terminado = !!censo && (censo.estado !== 'en_curso' || restante <= 0);
  const ultimoMinuto = !terminado && restante <= 60_000;

  useEffect(() => {
    if (terminado) vibrar('fin');
  }, [terminado]);

  const espiadero = espiaderos.find((e) => e.id === espiaderoId) ?? null;
  const vigentes = registros.filter((r) => !r.anulado && r.espiadero_id === espiaderoId);
  const conteos = useMemo(() => {
    const c = conteoVacio();
    vigentes.forEach((r) => (c[r.clase] += 1));
    return c;
  }, [vigentes]);
  const ultimo = vigentes[vigentes.length - 1];

  function registrar(clase: Clase) {
    if (terminado || !censo || !espiaderoId) return;
    vibrar('toque');
    setDestello(clase);
    setTimeout(() => setDestello((d) => (d === clase ? null : d)), 160);
    const r: MiRegistro = {
      id: Crypto.randomUUID(),
      espiadero_id: espiaderoId,
      clase,
      capturado_at: new Date(ahoraServidor()).toISOString(),
      anulado: false,
    };
    guardarRegistros([...registros, r]);
    encolar({
      op: 'registrar',
      id: r.id,
      censo_id: censo.id,
      espiadero_id: espiaderoId,
      clase,
      capturado_at: r.capturado_at,
      lon: ubicacion?.lon ?? null,
      lat: ubicacion?.lat ?? null,
      precision_m: ubicacion?.precisionM ?? null,
    });
  }

  function deshacer() {
    if (terminado || !ultimo) return;
    vibrar('deshacer');
    guardarRegistros(registros.map((r) => (r.id === ultimo.id ? { ...r, anulado: true } : r)));
    encolar({ op: 'anular', id: ultimo.id });
  }

  const salir = () => (router.canGoBack() ? router.back() : router.replace('/censo'));
  const relleno = { paddingTop: insets.top + espacio.s, paddingBottom: insets.bottom + espacio.s };

  // --- Sin censo -------------------------------------------------------------
  if (!censo) {
    return (
      <View style={[estilos.raiz, estilos.centro, relleno]}>
        <StatusBar style={t.barraEstado} />
        <Text style={[tipografia.cuerpoFuerte, { color: t.texto, textAlign: 'center' }]}>
          {cargando ? 'Buscando censo…' : 'No hay ningún censo en curso.'}
        </Text>
        {!cargando ? <BotonCampo texto="Volver" onPress={salir} /> : null}
      </View>
    );
  }

  // --- Elegir espiadero ------------------------------------------------------
  if (eligiendo || (!espiadero && sinDeteccion)) {
    const conDistancia = espiaderos
      .map((e) => ({ e, d: ubicacion ? distanciaM([ubicacion.lon, ubicacion.lat], [e.lon, e.lat]) : null }))
      .sort((a, b) => (a.d ?? 0) - (b.d ?? 0) || a.e.nombre.localeCompare(b.e.nombre));
    return (
      <View style={[estilos.raiz, relleno]}>
        <StatusBar style={t.barraEstado} />
        <View style={estilos.barra}>
          <Text style={[tipografia.cuerpoFuerte, { color: t.texto }]}>¿En qué espiadero estás?</Text>
          <Pressable onPress={espiadero ? () => setEligiendo(false) : salir} hitSlop={12} accessibilityRole="button">
            <Text style={[tipografia.cuerpo, { color: t.acentoTexto }]}>{espiadero ? 'Cancelar' : 'Salir'}</Text>
          </Pressable>
        </View>
        {!ubicacion && permiso !== 'negado' ? (
          <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>Buscando tu ubicación…</Text>
        ) : ubicacion ? (
          <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>No estás dentro del radio de ningún espiadero. Elige el tuyo.</Text>
        ) : null}
        <ScrollView contentContainerStyle={{ gap: espacio.m, paddingVertical: espacio.m }}>
          {conDistancia.map(({ e, d }) => (
            <Pressable
              key={e.id}
              onPress={() => elegir(e.id)}
              accessibilityRole="button"
              style={({ pressed }) => [estilos.opcion, e.id === espiaderoId && { borderColor: t.acento }, pressed && { backgroundColor: t.superficieActiva }]}
            >
              <Text style={[tipografia.botonCampo, { color: t.texto }]}>{e.nombre}</Text>
              <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>
                {[d != null ? `a ${formatoDistancia(d)}` : null, e.asignado_a === perfil?.id ? 'Asignado a ti' : e.asignado_nombre ? `Asignado: ${e.asignado_nombre}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  }

  if (!espiadero) {
    return (
      <View style={[estilos.raiz, estilos.centro, relleno]}>
        <StatusBar style={t.barraEstado} />
        <Text style={[tipografia.cuerpoFuerte, { color: t.texto, textAlign: 'center' }]}>Buscando tu espiadero por GPS…</Text>
        <BotonCampo texto="Elegir a mano" onPress={() => setEligiendo(true)} />
      </View>
    );
  }

  // --- Captura ---------------------------------------------------------------
  const totalPropio = vigentes.length;
  return (
    <View style={[estilos.raiz, relleno]}>
      <StatusBar style={t.barraEstado} />

      <View style={estilos.barra}>
        <Pressable onPress={() => setEligiendo(true)} accessibilityRole="button" accessibilityLabel="Cambiar espiadero" hitSlop={8} style={{ flex: 1 }}>
          <Text style={[tipografia.cuerpoFuerte, { color: t.texto }]} numberOfLines={1}>
            {espiadero.nombre}
          </Text>
          <Text style={[tipografia.secundario, { color: t.acentoTexto }]}>Cambiar espiadero</Text>
        </Pressable>
        <View style={{ alignItems: 'flex-end', gap: espacio.xxs }}>
          <View style={estilos.pendientes} accessibilityLabel={pendientesN ? `${pendientesN} por enviar` : 'Todo enviado'}>
            <View style={[estilos.punto, { backgroundColor: pendientesN ? t.alerta : t.exito }]} />
            <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>{pendientesN ? `${pendientesN} por enviar` : 'Enviado'}</Text>
          </View>
          <Pressable onPress={salir} hitSlop={12} accessibilityRole="button">
            <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>Salir</Text>
          </Pressable>
        </View>
      </View>

      <View style={estilos.reloj} accessibilityLiveRegion="polite">
        <Text
          style={[tipografia.cronometro, { color: terminado ? t.error : ultimoMinuto ? t.alerta : t.texto }]}
          accessibilityLabel={terminado ? 'Censo terminado' : `Quedan ${formatear(restante)}`}
        >
          {formatear(terminado ? 0 : restante)}
        </Text>
        <Text style={[terminado ? tipografia.cuerpoFuerte : tipografia.secundario, { color: terminado ? t.error : t.textoSecundario }]}>
          {terminado ? `Censo terminado · Registraste ${totalPropio}` : `${censo.nombre} · Total: ${totalPropio}`}
        </Text>
      </View>

      <View style={estilos.cuadricula}>
        {FILAS.map((fila) => (
          <View key={fila.join()} style={estilos.fila}>
            {fila.map((clave) => (
              <Pressable
                key={clave}
                onPress={() => registrar(clave)}
                disabled={terminado}
                accessibilityRole="button"
                accessibilityLabel={`${NOMBRE_CLASE[clave]}, ${conteos[clave]} registrados`}
                style={({ pressed }) => [
                  estilos.boton,
                  (pressed || destello === clave) && { backgroundColor: t.superficieActiva, borderColor: t.acento },
                  terminado && { opacity: 0.35 },
                ]}
              >
                <Text style={[tipografia.botonCampo, { color: t.acentoTexto }]}>{NOMBRE_CLASE[clave]}</Text>
                <Text style={[tipografia.contador, { color: t.texto }]}>{conteos[clave]}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      {terminado ? (
        <BotonCampo texto="Ver resumen" onPress={() => router.replace({ pathname: '/censo/[id]', params: { id: censo.id } })} />
      ) : (
        <Pressable
          onPress={deshacer}
          disabled={!ultimo}
          accessibilityRole="button"
          accessibilityLabel={ultimo ? `Deshacer último: ${NOMBRE_CLASE[ultimo.clase]}` : 'Nada que deshacer'}
          style={({ pressed }) => [estilos.deshacer, !ultimo && { opacity: 0.35 }, pressed && { backgroundColor: t.superficieActiva }]}
        >
          <Text style={[tipografia.boton, { color: t.texto }]}>{ultimo ? `Deshacer último (${NOMBRE_CLASE[ultimo.clase]})` : 'Deshacer último'}</Text>
        </Pressable>
      )}

      <Text style={[tipografia.secundario, estilos.ayuda]} numberOfLines={1} adjustsFontSizeToFit>
        {ayudaClases}
      </Text>
    </View>
  );
}

function BotonCampo({ texto, onPress }: { texto: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [estilos.deshacer, { borderColor: t.acento }, pressed && { backgroundColor: t.superficieActiva }]}>
      <Text style={[tipografia.boton, { color: t.texto }]}>{texto}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: t.fondo, paddingHorizontal: espacio.m, gap: espacio.m },
  centro: { alignItems: 'stretch', justifyContent: 'center', gap: espacio.xl, padding: espacio.xl },
  barra: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: tamanos.toqueMinimo, gap: espacio.m },
  pendientes: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  punto: { width: 8, height: 8, borderRadius: 4 },
  reloj: { alignItems: 'center' },
  cuadricula: { flex: 1, gap: espacio.m },
  fila: { flex: 1, flexDirection: 'row', gap: espacio.m },
  boton: {
    flex: 1,
    minHeight: tamanos.botonCampoMinimo,
    backgroundColor: t.superficie,
    borderWidth: borde.medio,
    borderColor: t.borde,
    borderRadius: radio.l,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deshacer: {
    minHeight: 56,
    borderWidth: borde.fino,
    borderColor: t.borde,
    borderRadius: radio.l,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opcion: {
    minHeight: tamanos.botonCampoMinimo,
    justifyContent: 'center',
    paddingHorizontal: espacio.l,
    backgroundColor: t.superficie,
    borderWidth: borde.medio,
    borderColor: t.borde,
    borderRadius: radio.l,
    gap: espacio.xxs,
  },
  ayuda: { color: t.textoSecundario, textAlign: 'center' },
});
