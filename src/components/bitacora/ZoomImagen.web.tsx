/**
 * Imagen con zoom para la web app: pellizcar con dos dedos, arrastrar con uno,
 * doble toque para acercar/alejar, rueda del ratón en computadora.
 * (La página tiene el zoom del navegador desactivado, por eso se hace aquí.)
 */
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import type { ZoomImagenProps, ZoomImagenRef } from './ZoomImagen.tipos';

const MIN = 1;
const MAX = 6;

export const ZoomImagen = forwardRef<ZoomImagenRef, ZoomImagenProps>(function ZoomImagen({ uri, onZoom }, ref) {
  const caja = useRef<HTMLDivElement | null>(null);
  const [vista, setVista] = useState({ s: 1, x: 0, y: 0 });
  const vistaRef = useRef(vista);
  const punteros = useRef(new Map<number, { x: number; y: number }>());
  const gesto = useRef<{ dist: number; s: number; cx: number; cy: number; x: number; y: number } | null>(null);
  const ultimoToque = useRef(0);

  const aplicar = (s: number, x: number, y: number) => {
    const el = caja.current;
    const sc = Math.min(MAX, Math.max(MIN, s));
    // Limitar el desplazamiento para no perder la imagen
    const w = el?.clientWidth ?? 0;
    const h = el?.clientHeight ?? 0;
    const mx = ((sc - 1) * w) / 2;
    const my = ((sc - 1) * h) / 2;
    const v = sc === 1 ? { s: 1, x: 0, y: 0 } : { s: sc, x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) };
    vistaRef.current = v;
    setVista(v);
    onZoom?.(v.s);
  };

  /** Acerca/aleja manteniendo fijo el punto (px, py) relativo al centro. */
  const zoomEn = (nuevo: number, px = 0, py = 0) => {
    const v = vistaRef.current;
    const sc = Math.min(MAX, Math.max(MIN, nuevo));
    const k = sc / v.s;
    aplicar(sc, px - (px - v.x) * k, py - (py - v.y) * k);
  };

  useImperativeHandle(ref, () => ({
    acercar: () => zoomEn(vistaRef.current.s * 1.6),
    alejar: () => zoomEn(vistaRef.current.s / 1.6),
    restablecer: () => aplicar(1, 0, 0),
  }));

  const relativo = (e: { clientX: number; clientY: number }) => {
    const r = caja.current!.getBoundingClientRect();
    return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
  };

  return (
    <View style={{ flex: 1, alignSelf: 'stretch' }}>
      <div
        ref={caja}
        style={{ position: 'absolute', inset: 0, overflow: 'hidden', touchAction: 'none', cursor: vista.s > 1 ? 'grab' : 'zoom-in' }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const ps = [...punteros.current.values()];
          const v = vistaRef.current;
          if (ps.length === 2) {
            const c = relativo({ clientX: (ps[0].x + ps[1].x) / 2, clientY: (ps[0].y + ps[1].y) / 2 });
            gesto.current = { dist: Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y), s: v.s, cx: c.x, cy: c.y, x: v.x, y: v.y };
          } else if (ps.length === 1) {
            const ahora = Date.now();
            if (ahora - ultimoToque.current < 300) {
              const p = relativo(e);
              if (v.s > 1.05) aplicar(1, 0, 0);
              else zoomEn(2.5, p.x, p.y);
              ultimoToque.current = 0;
            } else {
              ultimoToque.current = ahora;
            }
            gesto.current = { dist: 0, s: v.s, cx: e.clientX, cy: e.clientY, x: v.x, y: v.y };
          }
        }}
        onPointerMove={(e) => {
          if (!punteros.current.has(e.pointerId) || !gesto.current) return;
          punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const ps = [...punteros.current.values()];
          const g = gesto.current;
          if (ps.length >= 2 && g.dist > 0) {
            const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
            const sc = Math.min(MAX, Math.max(MIN, (g.s * d) / g.dist));
            const k = sc / g.s;
            aplicar(sc, g.cx - (g.cx - g.x) * k, g.cy - (g.cy - g.y) * k);
          } else if (ps.length === 1 && vistaRef.current.s > 1) {
            aplicar(vistaRef.current.s, g.x + (e.clientX - g.cx), g.y + (e.clientY - g.cy));
          }
        }}
        onPointerUp={(e) => {
          punteros.current.delete(e.pointerId);
          const v = vistaRef.current;
          const restante = [...punteros.current.values()][0];
          gesto.current = restante ? { dist: 0, s: v.s, cx: restante.x, cy: restante.y, x: v.x, y: v.y } : null;
        }}
        onPointerCancel={(e) => {
          punteros.current.delete(e.pointerId);
          gesto.current = null;
        }}
        onWheel={(e) => {
          const p = relativo(e);
          zoomEn(vistaRef.current.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), p.x, p.y);
        }}
      >
        <img
          src={uri}
          alt="Foto ampliada"
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.s})`,
            transformOrigin: 'center center',
            transition: gesto.current ? 'none' : 'transform 120ms ease-out',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />
      </div>
    </View>
  );
});
