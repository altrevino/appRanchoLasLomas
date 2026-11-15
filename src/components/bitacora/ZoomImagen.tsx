/**
 * Imagen con zoom en la app nativa de iPhone: el ScrollView de iOS da el
 * pellizco y el arrastre. (La web app usa ZoomImagen.web.tsx.)
 */
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, View, type LayoutChangeEvent, type ScrollViewInstance } from 'react-native';
import type { ZoomImagenProps, ZoomImagenRef } from './ZoomImagen.tipos';

export const ZoomImagen = forwardRef<ZoomImagenRef, ZoomImagenProps>(function ZoomImagen({ uri, onZoom }, ref) {
  const scroll = useRef<ScrollViewInstance>(null);
  const [tam, setTam] = useState({ w: 0, h: 0 });
  const escala = useRef(1);

  const irA = (s: number) => {
    const sc = Math.min(6, Math.max(1, s));
    escala.current = sc;
    const w = tam.w / sc;
    const h = tam.h / sc;
    scroll.current?.scrollResponderZoomTo({ x: (tam.w - w) / 2, y: (tam.h - h) / 2, width: w, height: h, animated: true });
    onZoom?.(sc);
  };

  useImperativeHandle(ref, () => ({
    acercar: () => irA(escala.current * 1.6),
    alejar: () => irA(escala.current / 1.6),
    restablecer: () => irA(1),
  }));

  return (
    <View style={{ flex: 1, alignSelf: 'stretch' }} onLayout={(e: LayoutChangeEvent) => setTam({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <ScrollView
        ref={scroll}
        style={StyleSheet.absoluteFill}
        contentContainerStyle={{ width: tam.w, height: tam.h }}
        maximumZoomScale={6}
        minimumZoomScale={1}
        centerContent
        bouncesZoom
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          escala.current = e.nativeEvent.zoomScale ?? 1;
          onZoom?.(escala.current);
        }}
        scrollEventThrottle={64}
      >
        <Image source={{ uri }} style={{ width: tam.w, height: tam.h }} resizeMode="contain" accessibilityLabel="Foto del ejemplar" />
      </ScrollView>
    </View>
  );
});
