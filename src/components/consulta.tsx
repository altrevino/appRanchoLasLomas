/**
 * Componentes del modo consulta (fondo hueso).
 */
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { borde, espacio, radio, tamanos, temas, tipografia } from '../theme';
import { CabezaVenado } from './logo';

const t = temas.consulta;

/** Encabezado interno: solo la cabeza del venado al centro, sin texto. */
export function Encabezado({ atras = true, derecha }: { atras?: boolean; derecha?: ReactNode }) {
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
      <View style={[estilos.encabezadoLado, { alignItems: 'flex-end' }]}>{derecha}</View>
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
  deshabilitado = false,
  cargando = false,
}: {
  children: string;
  onPress?: () => void;
  variante?: 'primario' | 'secundario' | 'peligro';
  deshabilitado?: boolean;
  cargando?: boolean;
}) {
  const primario = variante === 'primario';
  const colorBorde = variante === 'peligro' ? t.error : t.primario;
  const inactivo = deshabilitado || cargando;
  return (
    <Pressable
      onPress={inactivo ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      style={({ pressed }) => [
        estilos.boton,
        primario
          ? { backgroundColor: t.primario }
          : { backgroundColor: 'transparent', borderColor: colorBorde, borderWidth: borde.medio },
        pressed && { opacity: 0.85 },
        inactivo && { opacity: 0.5 },
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={primario ? t.textoSobrePrimario : colorBorde} />
      ) : (
        <Text style={[tipografia.boton, { color: primario ? t.textoSobrePrimario : colorBorde }]}>{children}</Text>
      )}
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

/** Campo de texto con etiqueta. */
export function Campo({ etiqueta, ayuda, ...props }: TextInputProps & { etiqueta: string; ayuda?: string }) {
  return (
    <View style={{ gap: espacio.xs }}>
      <Etiqueta>{etiqueta}</Etiqueta>
      <TextInput
        placeholderTextColor={t.textoSecundario}
        {...props}
        style={[estilos.campo, props.style]}
        accessibilityLabel={etiqueta}
      />
      {ayuda ? <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>{ayuda}</Text> : null}
    </View>
  );
}

/** Mensaje en línea (error, alerta o éxito). */
export function Aviso({ children, tono = 'error' }: { children: ReactNode; tono?: 'error' | 'alerta' | 'exito' }) {
  return (
    <View style={[estilos.aviso, { borderLeftColor: t[tono] }]} accessibilityRole="alert">
      <Text style={[tipografia.secundario, { color: t.texto }]}>{children}</Text>
    </View>
  );
}

/** Opción seleccionable en fila (vigencias, filtros). */
export function Opcion({ children, activa, onPress }: { children: string; activa: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: activa }}
      style={[estilos.opcion, activa && { backgroundColor: t.primario, borderColor: t.primario }]}
    >
      <Text style={[tipografia.secundario, { fontWeight: '600', color: activa ? t.textoSobrePrimario : t.primario }]}>{children}</Text>
    </Pressable>
  );
}

/** Fila tocable de una lista. */
export function Fila({ titulo, detalle, derecha, onPress }: { titulo: string; detalle?: string; derecha?: ReactNode; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [estilos.fila, pressed && { backgroundColor: t.superficieActiva }]}
    >
      <View style={{ flex: 1, gap: espacio.xxs }}>
        <Text style={[tipografia.cuerpoFuerte, { color: t.texto }]}>{titulo}</Text>
        {detalle ? <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>{detalle}</Text> : null}
      </View>
      {derecha}
      {onPress ? <Text style={[tipografia.cuerpo, { color: t.acentoTexto }]}>›</Text> : null}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  campo: {
    minHeight: tamanos.botonConsulta,
    borderWidth: borde.fino,
    borderColor: t.borde,
    borderRadius: radio.m,
    backgroundColor: t.superficie,
    paddingHorizontal: espacio.l,
    fontSize: 17,
    color: t.texto,
  },
  aviso: {
    borderLeftWidth: 4,
    backgroundColor: t.superficie,
    paddingVertical: espacio.m,
    paddingHorizontal: espacio.l,
    borderRadius: radio.s,
  },
  opcion: {
    minHeight: tamanos.toqueMinimo,
    paddingHorizontal: espacio.l,
    borderRadius: radio.m,
    borderWidth: borde.medio,
    borderColor: t.borde,
    justifyContent: 'center',
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    minHeight: 60,
    paddingHorizontal: espacio.l,
    paddingVertical: espacio.m,
    backgroundColor: t.superficie,
    borderBottomWidth: borde.fino,
    borderBottomColor: t.borde,
  },
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
