/**
 * Registrar avistamiento: foto, espiadero (GPS), clase y rasgos → parecidos →
 * "Es este" o "Es nuevo". Se guarda en el teléfono y se envía al haber señal.
 * Con ?macho=<id> (desde una ficha) se omite la búsqueda de parecidos.
 */
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RasgosEditor } from '../../../../components/bitacora/RasgosEditor';
import { TarjetaMacho } from '../../../../components/bitacora/TarjetaMacho';
import { Aviso, Boton, Campo, Encabezado, Etiqueta, Opcion, Titulo } from '../../../../components/consulta';
import { useMachos } from '../../../../lib/bitacora/datos';
import { obtenerFoto, useUrlsFotos, type FotoLocal } from '../../../../lib/bitacora/fotos';
import { candidatos as buscarCandidatos, type Candidato } from '../../../../lib/bitacora/similitud';
import { CLASES_MACHO, nombreMacho, rasgosVacios, type ClaseMacho, type Rasgos } from '../../../../lib/bitacora/tipos';
import { encolar } from '../../../../lib/censo/cola';
import { espiaderoEnRadio } from '../../../../lib/geo';
import { useDatosMapa } from '../../../../lib/mapa/datos';
import { useUbicacion } from '../../../../lib/ubicacion';
import { borde, espacio, radio, temas, tipografia } from '../../../../theme';

const t = temas.consulta;
const FUERA = 'fuera';

export default function RegistrarAvistamiento() {
  const { macho: machoFijo } = useLocalSearchParams<{ macho?: string }>();
  const { machos } = useMachos();
  const { datos: mapa } = useDatosMapa();
  const { ubicacion } = useUbicacion();
  const fijo = machos?.find((m) => m.id === machoFijo) ?? null;

  const [foto, setFoto] = useState<FotoLocal | null>(null);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const [espElegido, setEspElegido] = useState<string | null>(null);
  const [cambiandoEsp, setCambiandoEsp] = useState(false);
  const [clase, setClase] = useState<ClaseMacho | null>(null);
  const [rasgos, setRasgos] = useState<Rasgos>(rasgosVacios);
  const [nota, setNota] = useState('');
  const [apodo, setApodo] = useState('');
  const [parecidos, setParecidos] = useState<Candidato[] | null>(null);
  const [guardando, setGuardando] = useState(false);

  const espiaderos = useMemo(() => mapa?.espiaderos ?? [], [mapa]);
  const porGps = ubicacion ? espiaderoEnRadio([ubicacion.lon, ubicacion.lat], espiaderos) : null;
  const espiaderoId = espElegido ?? porGps?.id ?? null;
  const espiadero = espiaderos.find((e) => e.id === espiaderoId) ?? null;
  const urls = useUrlsFotos((parecidos ?? []).map((c) => c.macho.portada_path));

  async function tomar(origen: 'camara' | 'galeria') {
    setErrorFoto(null);
    try {
      const f = await obtenerFoto(origen);
      if (f) setFoto(f);
    } catch (e) {
      setErrorFoto((e as Error).message);
    }
  }

  function buscar() {
    if (!clase) return;
    setParecidos(
      buscarCandidatos(machos ?? [], {
        ...rasgos,
        clase,
        espiadero_id: espiadero?.id ?? null,
        lon: ubicacion?.lon ?? espiadero?.lon ?? null,
        lat: ubicacion?.lat ?? espiadero?.lat ?? null,
        cuando: Date.now(),
      }),
    );
  }

  async function guardar(machoId: string | null) {
    if (!clase) return;
    setGuardando(true);
    const nuevo = !machoId;
    const idMacho = machoId ?? Crypto.randomUUID();
    const idAvist = Crypto.randomUUID();
    const idFoto = Crypto.randomUUID();
    await encolar({
      op: 'avistamiento',
      id: idAvist,
      datos: {
        id: idAvist,
        macho_id: idMacho,
        nuevo,
        apodo: nuevo ? apodo.trim() || null : null,
        clase,
        espiadero_id: espiadero?.id ?? null,
        observado_at: new Date().toISOString(),
        lon: ubicacion?.lon ?? null,
        lat: ubicacion?.lat ?? null,
        rasgos,
        nota: nota.trim() || null,
      },
      foto: foto ? { id: idFoto, ruta: `machos/${idMacho}/${idFoto}.jpg`, base64: foto.base64, tomada_at: foto.tomadaAt } : null,
    });
    setGuardando(false);
    // Regresa a donde se abrió (lista o ficha); se actualiza sola al enviarse.
    if (router.canGoBack()) router.back();
    else if (nuevo) router.replace('/bitacora');
    else router.replace({ pathname: '/bitacora/[id]', params: { id: idMacho } });
  }

  const listo = !!clase;

  return (
    <View style={estilos.raiz}>
      <Encabezado />
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <Titulo>Avistamiento</Titulo>
        {fijo ? <Text style={[tipografia.cuerpoFuerte, { color: t.acentoTexto }]}>{nombreMacho(fijo)}</Text> : null}

        {/* Foto */}
        <View style={{ gap: espacio.s }}>
          <Etiqueta>Foto</Etiqueta>
          {foto ? (
            <View style={estilos.fotoMarco}>
              <Image source={{ uri: foto.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel="Foto tomada" />
            </View>
          ) : null}
          <View style={estilos.dos}>
            <View style={{ flex: 1 }}>
              <Boton variante={foto ? 'secundario' : 'primario'} onPress={() => tomar('camara')}>
                {foto ? 'Otra foto' : 'Tomar foto'}
              </Boton>
            </View>
            <View style={{ flex: 1 }}>
              <Boton variante="secundario" onPress={() => tomar('galeria')}>
                Galería
              </Boton>
            </View>
          </View>
          {errorFoto ? <Aviso>{errorFoto}</Aviso> : null}
        </View>

        {/* Espiadero */}
        <View style={{ gap: espacio.s }}>
          <Etiqueta>Lugar</Etiqueta>
          <View style={estilos.lugar}>
            <Text style={[tipografia.cuerpoFuerte, { color: t.texto, flex: 1 }]}>
              {espiadero ? espiadero.nombre : espElegido === FUERA ? 'Fuera de espiadero' : ubicacion ? 'Fuera de espiadero' : 'Buscando ubicación…'}
              {espiadero && !espElegido ? '  (por GPS)' : ''}
            </Text>
            <Text onPress={() => setCambiandoEsp(!cambiandoEsp)} style={[tipografia.secundario, { color: t.primario, fontWeight: '600' }]} accessibilityRole="button">
              {cambiandoEsp ? 'Listo' : 'Cambiar'}
            </Text>
          </View>
          {cambiandoEsp ? (
            <View style={estilos.opciones}>
              {espiaderos.map((e) => (
                <Opcion key={e.id} activa={espiaderoId === e.id} onPress={() => setEspElegido(e.id)}>
                  {e.nombre}
                </Opcion>
              ))}
              <Opcion activa={espElegido === FUERA} onPress={() => setEspElegido(FUERA)}>
                Fuera de espiadero
              </Opcion>
            </View>
          ) : null}
        </View>

        {/* Clase */}
        <View style={{ gap: espacio.s }}>
          <Etiqueta>Clase</Etiqueta>
          <View style={estilos.opciones}>
            {CLASES_MACHO.map((c) => (
              <Opcion key={c} activa={clase === c} onPress={() => setClase(c)}>
                {c}
              </Opcion>
            ))}
          </View>
        </View>

        <RasgosEditor valor={rasgos} onChange={setRasgos} />
        <Campo etiqueta="Nota (opcional)" value={nota} onChangeText={setNota} placeholder="Lo que ayude a reconocerlo" maxLength={500} multiline />

        {fijo ? (
          <Boton onPress={() => guardar(fijo.id)} deshabilitado={!listo} cargando={guardando}>
            Guardar avistamiento
          </Boton>
        ) : !parecidos ? (
          <>
            <Boton onPress={buscar} deshabilitado={!listo}>
              Buscar parecidos
            </Boton>
            {!listo ? <Text style={[tipografia.secundario, { color: t.textoSecundario, textAlign: 'center' }]}>Elige la clase para continuar.</Text> : null}
          </>
        ) : (
          <View style={{ gap: espacio.m }}>
            <Titulo nivel={2}>¿Es alguno de estos?</Titulo>
            {parecidos.length === 0 ? (
              <Text style={[tipografia.cuerpo, { color: t.textoSecundario }]}>No hay ejemplares parecidos en la bitácora.</Text>
            ) : null}
            {parecidos.map((c) => (
              <View key={c.macho.id} style={{ gap: espacio.s }}>
                <TarjetaMacho
                  macho={c.macho}
                  url={c.macho.portada_path ? urls[c.macho.portada_path] : undefined}
                  onPress={() => router.push({ pathname: '/bitacora/[id]', params: { id: c.macho.id } })}
                  derecha={
                    <Text style={[tipografia.secundario, { color: t.acentoTexto, fontWeight: '600' }]}>
                      {`Parecido ${c.parecido}%`}
                      {c.motivos.length ? ` · ${c.motivos.slice(0, 3).join(' · ')}` : ''}
                    </Text>
                  }
                />
                <Boton variante="secundario" onPress={() => guardar(c.macho.id)} cargando={guardando}>
                  {`Es este: ${c.macho.folio}`}
                </Boton>
              </View>
            ))}
            <View style={estilos.nuevo}>
              <Etiqueta>Ninguno coincide</Etiqueta>
              <Campo etiqueta="Apodo (opcional)" value={apodo} onChangeText={setApodo} placeholder="Ej. El Chueco" maxLength={40} />
              <Boton onPress={() => guardar(null)} cargando={guardando}>
                Es un ejemplar nuevo
              </Boton>
              <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>
                Quedará «por validar» hasta que el administrador lo confirme o lo una con otro.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: t.fondo },
  contenido: { padding: espacio.l, gap: espacio.l, paddingBottom: espacio.xxxl },
  fotoMarco: { aspectRatio: 4 / 3, borderRadius: radio.m, overflow: 'hidden', backgroundColor: t.primario, borderWidth: borde.fino, borderColor: t.acento },
  dos: { flexDirection: 'row', gap: espacio.s },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  lugar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    padding: espacio.m,
    borderWidth: borde.fino,
    borderColor: t.borde,
    borderRadius: radio.m,
    backgroundColor: t.superficie,
  },
  nuevo: { gap: espacio.m, padding: espacio.l, borderWidth: borde.fino, borderColor: t.acento, borderRadius: radio.m, backgroundColor: t.superficie },
});
