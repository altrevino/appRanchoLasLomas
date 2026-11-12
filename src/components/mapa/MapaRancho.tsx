/**
 * Mapa del rancho en iPhone (MapLibre nativo).
 * La versión web equivalente está en MapaRancho.web.tsx.
 */
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  UserLocation,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { paleta } from '../../theme';
import { limites } from '../../lib/mapa/datos';
import { avistamientosGeoJson, capas, capasMedida, coleccion, estiloBase, medidaGeoJson, radiosGeoJson } from '../../lib/mapa/estilo';
import { MarcadorEspiadero } from './MarcadorEspiadero';
import { MarcadorLugar } from './MarcadorLugar';
import type { MapaRanchoProps, MapaRanchoRef } from './tipos';

const RELLENO = { top: 90, bottom: 220, left: 40, right: 40 };

export const MapaRancho = forwardRef<MapaRanchoRef, MapaRanchoProps>(function MapaRancho(
  { datos, ubicacion, espiaderoSeleccionado, objetivo, avistamientos, onTocarEspiadero, onTocarLugar, onTocarAvistamiento, onTocarMapa },
  ref,
) {
  const camara = useRef<CameraRef>(null);
  const ultimoToqueMarcador = useRef(0);
  const caja = limites(datos);
  const estilo = useMemo(() => estiloBase(datos.capaBase), [datos.capaBase]);
  const radios = useMemo(() => radiosGeoJson(datos.espiaderos), [datos.espiaderos]);
  const caminos = useMemo(() => coleccion(datos.caminos), [datos.caminos]);
  const linderos = useMemo(() => coleccion(datos.linderos), [datos.linderos]);
  const puntosAvist = useMemo(() => avistamientosGeoJson(avistamientos), [avistamientos]);
  const medida = useMemo(
    () => medidaGeoJson(ubicacion ? [ubicacion.lon, ubicacion.lat] : null, objetivo),
    [ubicacion, objetivo],
  );

  useImperativeHandle(ref, () => ({
    verRancho: () => caja && camara.current?.fitBounds(caja, { padding: RELLENO, duration: 600 }),
    irA: (p) => camara.current?.flyTo({ center: p, zoom: 16, duration: 600 }),
  }));

  const marcar = () => {
    ultimoToqueMarcador.current = Date.now();
  };

  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={estilo}
      logo={false}
      attribution
      attributionPosition={{ bottom: 8, left: 8 }}
      compass
      compassPosition={{ top: 100, right: 12 }}
      tintColor={paleta.arena}
      onPress={(e) => {
        if (Date.now() - ultimoToqueMarcador.current < 400) return;
        onTocarMapa(e.nativeEvent.lngLat);
      }}
    >
      <Camera ref={camara} initialViewState={caja ? { bounds: caja, padding: RELLENO } : undefined} />

      <GeoJSONSource id="radios" data={radios}>
        <Layer {...capas.radioRelleno} />
        <Layer {...capas.radioBorde} />
      </GeoJSONSource>
      <GeoJSONSource id="caminos" data={caminos}>
        <Layer {...capas.caminos} />
      </GeoJSONSource>
      <GeoJSONSource id="linderos" data={linderos}>
        <Layer {...capas.linderoSombra} />
        <Layer {...capas.lindero} />
      </GeoJSONSource>
      <GeoJSONSource id="medida" data={medida}>
        <Layer {...capasMedida.linea} />
        <Layer {...capasMedida.objetivo} />
      </GeoJSONSource>
      <GeoJSONSource
        id="avistamientos"
        data={puntosAvist}
        hitbox={{ top: 12, right: 12, bottom: 12, left: 12 }}
        onPress={(e) => {
          const id = e.nativeEvent.features?.[0]?.properties?.id;
          const a = avistamientos.find((x) => x.id === id);
          if (a) {
            marcar();
            onTocarAvistamiento(a);
          }
        }}
      >
        <Layer {...capasMedida.avistamientos} />
      </GeoJSONSource>

      <UserLocation accuracy heading />

      {datos.lugares.map((l) => (
        <Marker
          key={l.id}
          id={`lugar-${l.id}`}
          lngLat={[l.lon, l.lat]}
          anchor="bottom"
          onPress={() => {
            marcar();
            onTocarLugar(l);
          }}
        >
          <MarcadorLugar nombre={l.nombre} />
        </Marker>
      ))}

      {datos.espiaderos.map((e) => (
        <Marker
          key={e.id}
          id={`esp-${e.id}`}
          lngLat={[e.lon, e.lat]}
          anchor="bottom"
          onPress={() => {
            marcar();
            onTocarEspiadero(e);
          }}
        >
          <MarcadorEspiadero nombre={e.nombre} seleccionado={e.id === espiaderoSeleccionado} />
        </Marker>
      ))}
    </Map>
  );
});
