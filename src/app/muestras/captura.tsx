/**
 * MUESTRA del modo campo: captura del censo.
 * Funcional en local (contadores, deshacer, cronómetro, bloqueo, háptica,
 * brillo bajo). En la fase (b) se conecta a la cola local y a Supabase.
 *
 * Prueba rápida del bloqueo: /muestras/captura?segundos=10
 */
import * as Brightness from 'expo-brightness';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ayudaClases, clasesCaptura, type ClaseCaptura } from '../../config/textos';
import { borde, brilloCampo, espacio, radio, tamanos, temas, tipografia } from '../../theme';

const t = temas.campo;
const esNativo = Platform.OS !== 'web';

function vibrar(tipo: 'toque' | 'deshacer' | 'fin') {
  if (!esNativo) return;
  if (tipo === 'toque') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  else if (tipo === 'deshacer') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Baja el brillo al entrar y lo restaura al salir. */
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

function formatear(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const vacio = (): Record<ClaseCaptura, number> => ({ M1: 0, M2: 0, M3: 0, M4: 0, hembra: 0, cria: 0 });

export default function CapturaMuestra() {
  useKeepAwake();
  useBrilloCampo();
  const insets = useSafeAreaInsets();
  const { segundos } = useLocalSearchParams<{ segundos?: string }>();

  const [finAt] = useState(() => Date.now() + (Number(segundos) || 20 * 60) * 1000);
  const [ahora, setAhora] = useState(() => Date.now());
  const [conteos, setConteos] = useState(vacio);
  const [pila, setPila] = useState<ClaseCaptura[]>([]);
  const restante = finAt - ahora;
  const terminado = restante <= 0;

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (terminado) vibrar('fin');
  }, [terminado]);

  const total = useMemo(() => Object.values(conteos).reduce((a, b) => a + b, 0), [conteos]);

  function registrar(clase: ClaseCaptura) {
    if (terminado) return;
    vibrar('toque');
    setConteos((c) => ({ ...c, [clase]: c[clase] + 1 }));
    setPila((p) => [...p, clase]);
  }

  function deshacer() {
    if (terminado || pila.length === 0) return;
    const ultima = pila[pila.length - 1];
    vibrar('deshacer');
    setConteos((c) => ({ ...c, [ultima]: c[ultima] - 1 }));
    setPila((p) => p.slice(0, -1));
  }

  const ultima = pila[pila.length - 1];
  const etiquetaUltima = clasesCaptura.find((c) => c.clave === ultima)?.etiqueta;
  const ultimoMinuto = !terminado && restante <= 60_000;

  return (
    <View style={[estilos.raiz, { paddingTop: insets.top + espacio.s, paddingBottom: insets.bottom + espacio.s }]}>
      <StatusBar style={t.barraEstado} />

      {/* Espiadero + pendientes */}
      <View style={estilos.barra}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cambiar espiadero" hitSlop={8}>
          <Text style={[tipografia.cuerpoFuerte, { color: t.texto }]}>La Noria</Text>
          <Text style={[tipografia.secundario, { color: t.acentoTexto }]}>Cambiar espiadero</Text>
        </Pressable>
        <View style={estilos.pendientes} accessibilityLabel="Todo enviado">
          <View style={[estilos.punto, { backgroundColor: t.exito }]} />
          <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>Enviado</Text>
        </View>
      </View>

      {/* Cronómetro */}
      <View style={estilos.reloj} accessibilityLiveRegion="polite">
        <Text
          style={[tipografia.cronometro, { color: terminado ? t.error : ultimoMinuto ? t.alerta : t.texto }]}
          accessibilityLabel={terminado ? 'Censo terminado' : `Quedan ${formatear(restante)}`}
        >
          {formatear(restante)}
        </Text>
        <Text style={[terminado ? tipografia.cuerpoFuerte : tipografia.secundario, { color: terminado ? t.error : t.textoSecundario }]}>
          {terminado ? `Censo terminado · Total: ${total}` : `Total: ${total}`}
        </Text>
      </View>

      {/* Botones de captura 2 × 3 */}
      <View style={estilos.cuadricula}>
        {[0, 2, 4].map((i) => (
          <View key={i} style={estilos.fila}>
            {clasesCaptura.slice(i, i + 2).map(({ clave, etiqueta }) => (
              <Pressable
                key={clave}
                onPress={() => registrar(clave)}
                disabled={terminado}
                accessibilityRole="button"
                accessibilityLabel={`${etiqueta}, ${conteos[clave]} registrados`}
                style={({ pressed }) => [
                  estilos.boton,
                  pressed && { backgroundColor: t.superficieActiva, borderColor: t.acento },
                  terminado && { opacity: 0.35 },
                ]}
              >
                <Text style={[tipografia.botonCampo, { color: t.acentoTexto }]}>{etiqueta}</Text>
                <Text style={[tipografia.contador, { color: t.texto }]}>{conteos[clave]}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      {/* Deshacer */}
      <Pressable
        onPress={deshacer}
        disabled={terminado || pila.length === 0}
        accessibilityRole="button"
        accessibilityLabel={etiquetaUltima ? `Deshacer último: ${etiquetaUltima}` : 'Nada que deshacer'}
        style={({ pressed }) => [
          estilos.deshacer,
          (terminado || pila.length === 0) && { opacity: 0.35 },
          pressed && { backgroundColor: t.superficieActiva },
        ]}
      >
        <Text style={[tipografia.boton, { color: t.texto }]}>
          {etiquetaUltima ? `Deshacer último (${etiquetaUltima})` : 'Deshacer último'}
        </Text>
      </Pressable>

      <Text style={[tipografia.secundario, estilos.ayuda]} numberOfLines={1} adjustsFontSizeToFit>
        {ayudaClases}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: t.fondo, paddingHorizontal: espacio.m, gap: espacio.m },
  barra: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: tamanos.toqueMinimo },
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
  ayuda: { color: t.textoSecundario, textAlign: 'center' },
});
