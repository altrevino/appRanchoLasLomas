/**
 * Mapa del rancho en navegador (maplibre-gl). Es el que usa la web app;
 * MapaRancho.tsx es el equivalente nativo (MapLibre). Mismo estilo y capas.
 */
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, MapLayerMouseEvent, MapMouseEvent, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { View } from 'react-native';
import { paleta } from '../../theme';
import { limites } from '../../lib/mapa/datos';
import { avistamientosGeoJson, capas, capasMedida, coleccion, estiloBase, medidaGeoJson, radiosGeoJson } from '../../lib/mapa/estilo';
import { MarcadorEspiadero } from './MarcadorEspiadero';
import { MarcadorLugar } from './MarcadorLugar';
import type { MapaRanchoProps, MapaRanchoRef } from './tipos';

const RELLENO = { top: 90, bottom: 220, left: 40, right: 40 };

type Marca = { m: maplibregl.Marker; root: Root };

export const MapaRancho = forwardRef<MapaRanchoRef, MapaRanchoProps>(function MapaRancho(
  { datos, ubicacion, espiaderoSeleccionado, objetivo, avistamientos, onTocarEspiadero, onTocarLugar, onTocarAvistamiento, onTocarMapa },
  ref,
) {
  const contenedor = useRef<HTMLDivElement | null>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const marcadores = useRef<Marca[]>([]);
  const yo = useRef<maplibregl.Marker | null>(null);
  const callbacks = useRef({ onTocarEspiadero, onTocarLugar, onTocarAvistamiento, onTocarMapa, avistamientos });
  const ultimoToqueMarcador = useRef(0);
  callbacks.current = { onTocarEspiadero, onTocarLugar, onTocarAvistamiento, onTocarMapa, avistamientos };
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
      m.addSource('medida', { type: 'geojson', data: medidaGeoJson(null, null) });
      m.addSource('avistamientos', { type: 'geojson', data: avistamientosGeoJson([]) });
      m.addLayer({ ...capas.radioRelleno, source: 'radios' });
      m.addLayer({ ...capas.radioBorde, source: 'radios' });
      m.addLayer({ ...capas.caminos, source: 'caminos' });
      m.addLayer({ ...capas.linderoSombra, source: 'linderos' });
      m.addLayer({ ...capas.lindero, source: 'linderos' });
      m.addLayer({ ...capasMedida.linea, source: 'medida' });
      m.addLayer({ ...capasMedida.objetivo, source: 'medida' });
      m.addLayer({ ...capasMedida.avistamientos, source: 'avistamientos' });
      m.fire('rll:listo');
    });
    m.on('click', 'avistamientos', (e: MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id;
      const a = callbacks.current.avistamientos.find((x) => x.id === id);
      if (a) {
        ultimoToqueMarcador.current = Date.now();
        callbacks.current.onTocarAvistamiento(a);
      }
    });
    m.on('mouseenter', 'avistamientos', () => (m.getCanvas().style.cursor = 'pointer'));
    m.on('mouseleave', 'avistamientos', () => (m.getCanvas().style.cursor = ''));
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
    // El mapa se crea una sola vez; los datos se actualizan en los efectos siguientes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cuandoListo = (f: (m: maplibregl.Map) => void) => {
    const m = mapa.current;
    if (!m) return;
    if (m.getSource('medida')) f(m);
    else m.once('rll:listo', () => f(m));
  };

  // Capas del rancho y marcadores
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    cuandoListo((mm) => {
      (mm.getSource('radios') as GeoJSONSource | undefined)?.setData(radiosGeoJson(datos.espiaderos));
      (mm.getSource('caminos') as GeoJSONSource | undefined)?.setData(coleccion(datos.caminos));
      (mm.getSource('linderos') as GeoJSONSource | undefined)?.setData(coleccion(datos.linderos));
    });

    marcadores.current.forEach((x) => {
      x.m.remove();
      setTimeout(() => x.root.unmount());
    });
    const crear = (lon: number, lat: number, contenido: React.ReactElement, alTocar: () => void): Marca => {
      const el = document.createElement('div');
      el.style.cursor = 'pointer';
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        ultimoToqueMarcador.current = Date.now();
        alTocar();
      });
      const root = createRoot(el);
      root.render(contenido);
      return { m: new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lon, lat]).addTo(m), root };
    };
    marcadores.current = [
      ...datos.lugares.map((l) => crear(l.lon, l.lat, <MarcadorLugar nombre={l.nombre} />, () => callbacks.current.onTocarLugar(l))),
      ...datos.espiaderos.map((e) =>
        crear(e.lon, e.lat, <MarcadorEspiadero nombre={e.nombre} seleccionado={e.id === espiaderoSeleccionado} />, () => callbacks.current.onTocarEspiadero(e)),
      ),
    ];
  }, [datos, espiaderoSeleccionado]);

  // Avistamientos recientes
  useEffect(() => {
    cuandoListo((m) => (m.getSource('avistamientos') as GeoJSONSource | undefined)?.setData(avistamientosGeoJson(avistamientos)));
  }, [avistamientos]);

  // Línea de medición
  useEffect(() => {
    cuandoListo((m) =>
      (m.getSource('medida') as GeoJSONSource | undefined)?.setData(medidaGeoJson(ubicacion ? [ubicacion.lon, ubicacion.lat] : null, objetivo)),
    );
  }, [ubicacion, objetivo]);

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
        boxShadow: '0 0 0 2px rgba(21,29,23,0.5)',
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
