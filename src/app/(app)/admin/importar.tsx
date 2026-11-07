/**
 * Importar KML/KMZ desde la app: elegir archivo → vista previa → aplicar.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Aviso, Boton, Encabezado, Etiqueta, Titulo } from '../../../components/consulta';
import { hayErrores, leerArchivoKml, type LecturaKml } from '../../../lib/kml';
import type { ResumenImportacion } from '../../../lib/kml/resumen';
import { mensajeDeError, supabase } from '../../../lib/supabase';
import { borde, espacio, radio, temas, tipografia } from '../../../theme';

const t = temas.consulta;

async function leerBytes(asset: DocumentPicker.DocumentPickerAsset): Promise<Uint8Array> {
  if (Platform.OS === 'web') {
    const r = await fetch(asset.uri);
    return new Uint8Array(await r.arrayBuffer());
  }
  return new File(asset.uri).bytes();
}

export default function Importar() {
  const [archivo, setArchivo] = useState<string | null>(null);
  const [lectura, setLectura] = useState<LecturaKml | null>(null);
  const [resumen, setResumen] = useState<ResumenImportacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aplicado, setAplicado] = useState(false);

  async function elegir() {
    setError(null);
    setResumen(null);
    setLectura(null);
    setAplicado(false);
    const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (r.canceled || !r.assets?.length) return;
    const a = r.assets[0];
    if (!/\.km[lz]$/i.test(a.name)) return setError('Elige un archivo .kml o .kmz (Google Earth).');
    setArchivo(a.name);
    setOcupado(true);
    try {
      const l = leerArchivoKml(await leerBytes(a));
      setLectura(l);
      if (!hayErrores(l)) {
        const { data, error: e } = await supabase.rpc('importar_kml', { p_datos: l.datos, p_aplicar: false, p_archivo: a.name });
        if (e) throw e;
        setResumen(data as ResumenImportacion);
      }
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  }

  async function aplicar() {
    if (!lectura) return;
    setOcupado(true);
    const { data, error: e } = await supabase.rpc('importar_kml', { p_datos: lectura.datos, p_aplicar: true, p_archivo: archivo });
    setOcupado(false);
    if (e) return setError(mensajeDeError(e));
    setResumen(data as ResumenImportacion);
    setAplicado(true);
  }

  const d = lectura?.datos;
  return (
    <View style={estilos.raiz}>
      <Encabezado />
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Titulo>Importar KML</Titulo>
        <Text style={[tipografia.cuerpo, { color: t.textoSecundario }]}>
          Elige el archivo .kml o .kmz del rancho (desde Archivos, iCloud o un correo guardado). Antes de guardar verás qué se detectó.
        </Text>
        <Boton onPress={elegir} cargando={ocupado && !lectura} variante={lectura ? 'secundario' : 'primario'}>
          {lectura ? 'Elegir otro archivo' : 'Elegir archivo'}
        </Boton>
        {error ? <Aviso>{error}</Aviso> : null}

        {d ? (
          <View style={estilos.bloque}>
            <Etiqueta>{archivo}</Etiqueta>
            <View style={estilos.conteos}>
              <Conteo numero={d.linderos.length} texto="lindero" />
              <Conteo numero={d.caminos.length} texto="caminos" />
              <Conteo numero={d.espiaderos.length} texto="espiaderos" />
            </View>
            {d.espiaderos.map((e) => (
              <Text key={e.nombre} style={[tipografia.secundario, { color: t.texto }]}>
                · {e.nombre}
                {e.altitud != null ? `  (${e.altitud} m)` : ''}
              </Text>
            ))}
          </View>
        ) : null}

        {lectura?.advertencias.map((a, i) => (
          <Aviso key={i} tono={a.gravedad === 'error' ? 'error' : 'alerta'}>
            {a.mensaje}
          </Aviso>
        ))}

        {resumen ? (
          <View style={estilos.bloque}>
            <Etiqueta>{aplicado ? 'Cambios aplicados' : 'Lo que va a pasar'}</Etiqueta>
            <Linea texto={`Se actualizan ${resumen.espiaderos.actualizar.length} espiadero(s) que coinciden por nombre (conservan su historial)`} />
            {resumen.espiaderos.actualizar.filter((x) => x.movido_m > 0).map((x) => (
              <Linea key={x.id} sub texto={`${x.nombre}: se mueve ${x.movido_m} m`} />
            ))}
            <Linea texto={`Se crean ${resumen.espiaderos.crear.length} espiadero(s) nuevos`} />
            <Linea
              texto={`Se archivan ${resumen.espiaderos.archivar.length} espiadero(s) que ya no vienen en el KML${
                resumen.espiaderos.archivar.some((x) => x.origen === 'prueba') ? ' (incluye los de prueba)' : ''
              }`}
            />
            <Linea texto={`Lindero y caminos se reemplazan (${resumen.linderos.archivar + resumen.caminos.archivar} anteriores se archivan)`} />
          </View>
        ) : null}

        {resumen && !aplicado ? (
          <Boton onPress={aplicar} cargando={ocupado}>
            Guardar cambios
          </Boton>
        ) : null}
        {aplicado ? (
          <>
            <Aviso tono="exito">Listo. Revisa el mapa para confirmar que el lindero y los espiaderos quedaron en su lugar.</Aviso>
            <Boton onPress={() => router.navigate('/mapa')}>Ver mapa</Boton>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Conteo({ numero, texto }: { numero: number; texto: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[tipografia.contador, { color: t.titulo }]}>{numero}</Text>
      <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>{texto}</Text>
    </View>
  );
}

function Linea({ texto, sub = false }: { texto: string; sub?: boolean }) {
  return <Text style={[tipografia.secundario, { color: sub ? t.textoSecundario : t.texto, paddingLeft: sub ? espacio.l : 0 }]}>{sub ? '· ' : ''}{texto}</Text>;
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: t.fondo },
  contenido: { padding: espacio.l, gap: espacio.l, paddingBottom: espacio.xxxl },
  bloque: { gap: espacio.s, padding: espacio.l, borderWidth: borde.fino, borderColor: t.borde, borderRadius: radio.m, backgroundColor: t.superficie },
  conteos: { flexDirection: 'row', paddingVertical: espacio.s },
});
