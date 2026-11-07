/**
 * Componentes del modo consulta (fondo hueso).
 */
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { borde, espacio, radio, tamanos, temas, tipografia } from '../theme';
import { CabezaVenado } from './CabezaVenado';

const t = temas.consulta;

/** Encabezado interno: solo la cabeza del venado al centro, sin texto. */
export function Encabezado({ atras = true }: { atras?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[estilos.encabezado, { paddingTop: insets.top + espacio.s }]}>
      <View style={estilos.encabezadoLado}>
        {atras && router.canGoBack() ? (
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Regresar"
          >
            <Text style={[tipografia.cuerpo, { color: t.primario }]}>‹ Regresar</Text>
          </Pressable>
        ) : null}
      </View>
      <CabezaVenado tamano={tamanos.cabezaVenadoEncabezado} color={t.primario} />
      <View style={estilos.encabezadoLado} />
    </View>
  );
}

export function Titulo({
  children,
  nivel = 1,
  centrado = false,
}: {
  children: ReactNode;
  nivel?: 0 | 1 | 2;
  centrado?: boolean;
}) {
  const estilo = nivel === 0 ? tipografia.display : nivel === 1 ? tipografia.titulo1 : tipografia.titulo2;
  return (
    <Text style={[estilo, { color: t.titulo }, centrado && { textAlign: 'center' }]} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Etiqueta({ children }: { children: ReactNode }) {
  return <Text style={[tipografia.etiqueta, { color: t.acentoTexto }]}>{children}</Text>;
}

/** Filete arena: separador decorativo propio de la identidad. */
export function Filete({ style }: { style?: ViewStyle }) {
  return <View style={[{ height: borde.fino, backgroundColor: t.acento, opacity: 0.6 }, style]} />;
}

export function Boton({
  children,
  onPress,
  variante = 'primario',
}: {
  children: string;
  onPress?: () => void;
  variante?: 'primario' | 'secundario';
}) {
  const primario = variante === 'primario';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        estilos.boton,
        primario
          ? { backgroundColor: t.primario }
          : { backgroundColor: 'transparent', borderColor: t.primario, borderWidth: borde.medio },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[tipografia.boton, { color: primario ? t.textoSobrePrimario : t.primario }]}>{children}</Text>
    </Pressable>
  );
}

export function Chip({ children, tono = 'neutro' }: { children: string; tono?: 'neutro' | 'exito' | 'alerta' | 'error' }) {
  const color = tono === 'neutro' ? t.primario : t[tono];
  return (
    <View style={[estilos.chip, { borderColor: color }]}>
      <Text style={[tipografia.secundario, { color, fontWeight: '600' }]}>{children}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espacio.l,
    paddingBottom: espacio.s,
    backgroundColor: t.fondo,
    borderBottomWidth: borde.fino,
    borderBottomColor: t.borde,
  },
  encabezadoLado: { flex: 1 },
  boton: {
    minHeight: tamanos.botonConsulta,
    borderRadius: radio.m,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: espacio.xl,
  },
  chip: {
    borderWidth: borde.fino,
    borderRadius: radio.s,
    paddingHorizontal: espacio.s,
    paddingVertical: espacio.xxs,
    alignSelf: 'flex-start',
  },
});
