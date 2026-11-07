/**
 * Mapa del rancho en navegador (maplibre-gl). Solo para probar en computadora;
 * en iPhone se usa MapaRancho.tsx con MapLibre nativo. Mismo estilo y capas.
 */
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, MapMouseEvent, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { View } from 'react-native';
import { paleta } from '../../theme';
import { limites } from '../../lib/mapa/datos';
import { capas, coleccion, estiloBase, radiosGeoJson } from '../../lib/mapa/estilo';
import { MarcadorEspiadero } from './MarcadorEspiadero';
import type { MapaRanchoProps, MapaRanchoRef } from './tipos';

const RELLENO = { top: 90, bottom: 220, left: 40, right: 40 };

export const MapaRancho = forwardRef<MapaRanchoRef, MapaRanchoProps>(function MapaRancho(
  { datos, ubicacion, espiaderoSeleccionado, onTocarEspiadero, onTocarMapa },
  ref,
) {
  const contenedor = useRef<HTMLDivElement | null>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const marcadores = useRef<{ m: maplibregl.Marker; root: Root; id: string; nombre: string }[]>([]);
  const yo = useRef<maplibregl.Marker | null>(null);
  const callbacks = useRef({ onTocarEspiadero, onTocarMapa });
  const ultimoToqueMarcador = useRef(0);
  callbacks.current = { onTocarEspiadero, onTocarMapa };
  const caja = limites(datos);

  useImperativeHandle(ref, () => ({
    verRancho: () => caja && mapa.current?.fitBounds(caja, { padding: RELLENO, duration: 600 }),
    irA: (p) => mapa.current?.flyTo({ center: p, zoom: 16, duration: 600 }),
  }));

  // Crear el mapa una vez
  useEffect(() => {
    if (!contenedor.current) return;
    const m = new maplibregl.Map({
      container: contenedor.current,
      style: estiloBase(datos.capaBase) as StyleSpecification,
      bounds: caja ?? undefined,
      fitBoundsOptions: { padding: RELLENO },
      attributionControl: { compact: true },
    });
    mapa.current = m;
    m.on('load', () => {
      m.addSource('radios', { type: 'geojson', data: radiosGeoJson(datos.espiaderos) });
      m.addSource('caminos', { type: 'geojson', data: coleccion(datos.caminos) });
      m.addSource('linderos', { type: 'geojson', data: coleccion(datos.linderos) });
      m.addLayer({ ...capas.radioRelleno, source: 'radios' });
      m.addLayer({ ...capas.radioBorde, source: 'radios' });
      m.addLayer({ ...capas.caminos, source: 'caminos' });
      m.addLayer({ ...capas.linderoSombra, source: 'linderos' });
      m.addLayer({ ...capas.lindero, source: 'linderos' });
    });
    m.on('click', (e: MapMouseEvent) => {
      if (Date.now() - ultimoToqueMarcador.current < 400) return;
      callbacks.current.onTocarMapa([e.lngLat.lng, e.lngLat.lat]);
    });
    return () => {
      marcadores.current.forEach((x) => x.root.unmount());
      marcadores.current = [];
      m.remove();
      mapa.current = null;
    };
    // El mapa se crea una sola vez; los datos se actualizan en el efecto siguiente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Actualizar capas y marcadores cuando cambian los datos o la selección
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const aplicar = () => {
      (m.getSource('radios') as GeoJSONSource | undefined)?.setData(radiosGeoJson(datos.espiaderos));
      (m.getSource('caminos') as GeoJSONSource | undefined)?.setData(coleccion(datos.caminos));
      (m.getSource('linderos') as GeoJSONSource | undefined)?.setData(coleccion(datos.linderos));
    };
    if (m.loaded()) aplicar();
    else m.once('load', aplicar);

    marcadores.current.forEach((x) => {
      x.m.remove();
      setTimeout(() => x.root.unmount());
    });
    marcadores.current = datos.espiaderos.map((e) => {
      const el = document.createElement('div');
      el.style.cursor = 'pointer';
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        ultimoToqueMarcador.current = Date.now();
        callbacks.current.onTocarEspiadero(e);
      });
      const root = createRoot(el);
      root.render(<MarcadorEspiadero nombre={e.nombre} seleccionado={e.id === espiaderoSeleccionado} />);
      const mk = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([e.lon, e.lat]).addTo(m);
      return { m: mk, root, id: e.id, nombre: e.nombre };
    });
  }, [datos, espiaderoSeleccionado]);

  // Punto de ubicación del usuario
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    if (!ubicacion) {
      yo.current?.remove();
      yo.current = null;
      return;
    }
    if (!yo.current) {
      const el = document.createElement('div');
      Object.assign(el.style, {
        width: '16px',
        height: '16px',
        borderRadius: '8px',
        background: paleta.arena,
        border: `3px solid ${paleta.hueso}`,
      });
      yo.current = new maplibregl.Marker({ element: el }).setLngLat([ubicacion.lon, ubicacion.lat]).addTo(m);
    } else {
      yo.current.setLngLat([ubicacion.lon, ubicacion.lat]);
    }
  }, [ubicacion]);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div ref={contenedor} style={{ position: 'absolute', inset: 0 }} />
    </View>
  );
});
