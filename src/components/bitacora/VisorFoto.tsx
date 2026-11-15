/**
 * Visor de fotos a pantalla completa con zoom. Flechas para pasar de foto,
 * botones + / − para quien prefiera no pellizcar.
 */
import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { espacio, paleta, radio, tipografia } from '../../theme';
import { ZoomImagen } from './ZoomImagen';
import type { ZoomImagenRef } from './ZoomImagen.tipos';

export interface FotoVisor {
  id: string;
  url: string | undefined;
  fecha: string;
}

export function VisorFoto({ fotos, inicial, onCerrar }: { fotos: FotoVisor[]; inicial: number; onCerrar: () => void }) {
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(inicial);
  const [escala, setEscala] = useState(1);
  const zoom = useRef<ZoomImagenRef>(null);
  const foto = fotos[i];
  const ir = (d: number) => {
    setI((x) => (x + d + fotos.length) % fotos.length);
    setEscala(1);
  };

  return (
    <Modal visible animationType="fade" onRequestClose={onCerrar} statusBarTranslucent>
      <View style={estilos.fondo}>
        <View style={[estilos.barra, { paddingTop: insets.top + espacio.s }]}>
          <Text style={[tipografia.secundario, { color: paleta.textoSobreOscuro }]}>
            {new Date(foto.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
            {fotos.length > 1 ? `  ·  ${i + 1} de ${fotos.length}` : ''}
          </Text>
          <Pressable onPress={onCerrar} hitSlop={14} accessibilityRole="button" accessibilityLabel="Cerrar foto" style={estilos.boton}>
            <Text style={estilos.icono}>×</Text>
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>{foto.url ? <ZoomImagen key={foto.id} ref={zoom} uri={foto.url} onZoom={setEscala} /> : null}</View>

        <View style={[estilos.controles, { paddingBottom: insets.bottom + espacio.m }]}>
          {fotos.length > 1 ? (
            <Pressable onPress={() => ir(-1)} style={estilos.boton} accessibilityRole="button" accessibilityLabel="Foto anterior">
              <Text style={estilos.icono}>‹</Text>
            </Pressable>
          ) : (
            <View style={estilos.hueco} />
          )}
          <View style={estilos.zoom}>
            <Pressable onPress={() => zoom.current?.alejar()} style={estilos.boton} accessibilityRole="button" accessibilityLabel="Alejar">
              <Text style={estilos.icono}>−</Text>
            </Pressable>
            <Pressable onPress={() => zoom.current?.restablecer()} accessibilityRole="button" accessibilityLabel="Tamaño original" style={estilos.escala}>
              <Text style={[tipografia.secundario, { color: paleta.textoSobreOscuro, fontWeight: '600' }]}>{`${escala.toFixed(1)}×`}</Text>
            </Pressable>
            <Pressable onPress={() => zoom.current?.acercar()} style={estilos.boton} accessibilityRole="button" accessibilityLabel="Acercar">
              <Text style={estilos.icono}>+</Text>
            </Pressable>
          </View>
          {fotos.length > 1 ? (
            <Pressable onPress={() => ir(1)} style={estilos.boton} accessibilityRole="button" accessibilityLabel="Foto siguiente">
              <Text style={estilos.icono}>›</Text>
            </Pressable>
          ) : (
            <View style={estilos.hueco} />
          )}
        </View>
        <Text style={[tipografia.secundario, estilos.pista]}>Pellizca o toca dos veces para acercar</Text>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#000' },
  barra: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: espacio.l, paddingBottom: espacio.s },
  controles: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: espacio.l, paddingTop: espacio.s },
  zoom: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  boton: {
    width: 48,
    height: 48,
    borderRadius: radio.m,
    borderWidth: 1,
    borderColor: 'rgba(237,230,216,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(21,29,23,0.7)',
  },
  hueco: { width: 48 },
  icono: { color: paleta.textoSobreOscuro, fontSize: 28, lineHeight: 32, fontWeight: '500' },
  escala: { minWidth: 56, alignItems: 'center' },
  pista: { color: 'rgba(237,230,216,0.6)', textAlign: 'center', paddingBottom: espacio.s, position: 'absolute', bottom: 92, left: 0, right: 0 },
});
