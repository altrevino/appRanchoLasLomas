/**
 * Medición de trofeo (Boone and Crockett), solo administrador.
 * /admin/mediciones/nueva crea una; /admin/mediciones/<id> la edita.
 * Medidas en pulgadas y octavos; la puntuación se recalcula con cada dato.
 * Al guardar, si se eligió un ejemplar de la bitácora, se le pone la
 * puntuación real (bruta), la fecha de caza y el cazador.
 */
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FotoMacho } from '../../../../../components/bitacora/FotoMacho';
import { fechaAIso } from '../../../../../components/bitacora/Trofeo';
import { Aviso, Boton, Campo, Encabezado, Etiqueta, Filete, Opcion, Titulo } from '../../../../../components/consulta';
import { BotonAgregar, CeldaMedida, EncabezadoLados, FilaMedida, type ParCaptura } from '../../../../../components/mediciones/TablaMedidas';
import { useMachos } from '../../../../../lib/bitacora/datos';
import { obtenerFoto, subirFoto, useUrlsFotos, type FotoLocal } from '../../../../../lib/bitacora/fotos';
import { nombreMacho } from '../../../../../lib/bitacora/tipos';
import { useDatosMapa } from '../../../../../lib/mapa/datos';
import {
  aCaptura,
  aPulgadas,
  calcular,
  capturaVacia,
  deCaptura,
  formato,
  medidasVacias,
  type Captura,
  type Medidas,
  type Par,
  type Valor,
} from '../../../../../lib/mediciones/calculo';
import { compartir, descargar, prepararPdf, puedeCompartir, urlADataUri, type PdfListo } from '../../../../../lib/mediciones/compartir';
import { ARMAS, folioMedicion, nombreArchivoPdf, type Arma, type Medicion } from '../../../../../lib/mediciones/tipos';
import { useSesion } from '../../../../../lib/sesion';
import { mensajeDeError, supabase } from '../../../../../lib/supabase';
import { borde, espacio, radio, temas, tipografia } from '../../../../../theme';

const t = temas.consulta;
const FUERA = 'Fuera de espiadero';

interface Filas {
  viga: ParCaptura;
  g: ParCaptura[];
  h: ParCaptura[];
  ap: ParCaptura[];
}
const parCap = (p: Par): ParCaptura => ({ d: aCaptura(p.d), i: aCaptura(p.i) });
const aFilas = (m: Medidas): Filas => ({ viga: parCap(m.viga), g: m.g.map(parCap), h: m.h.map(parCap), ap: m.ap.map(parCap) });
const parVacio = (): ParCaptura => ({ d: capturaVacia(), i: capturaVacia() });

/** Filas capturadas → medidas en octavos; `invalidas` cuenta las celdas mal escritas. */
function aMedidas(f: Filas): { medidas: Medidas; invalidas: number } {
  let invalidas = 0;
  const val = (c: Captura): Valor => {
    const v = deCaptura(c);
    if (v === 'invalido') {
      invalidas++;
      return null;
    }
    return v;
  };
  const par = (p: ParCaptura): Par => ({ d: val(p.d), i: val(p.i) });
  return { medidas: { viga: par(f.viga), g: f.g.map(par), h: f.h.map(par), ap: f.ap.map(par) }, invalidas };
}

const dosDigitos = (n: number) => String(n).padStart(2, '0');
const fechaTexto = (d: Date) => `${dosDigitos(d.getDate())}/${dosDigitos(d.getMonth() + 1)}/${d.getFullYear()}`;
const horaTexto = (d: Date) => `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;
/** "14/11/2026" + "07:40" (hora local) → ISO. */
function fechaHoraAIso(fecha: string, hora: string): string | null {
  const f = fechaAIso(fecha);
  const h = /^\s*(\d{1,2})[:.](\d{2})\s*$/.exec(hora);
  if (!f || !h || Number(h[1]) > 23 || Number(h[2]) > 59) return null;
  const [a, m, d] = f.split('-').map(Number);
  return new Date(a, m - 1, d, Number(h[1]), Number(h[2])).toISOString();
}
const textoONull = (s: string) => s.trim() || null;

export default function EditarMedicion() {
  const { id: idRuta } = useLocalSearchParams<{ id: string }>();
  const nueva = idRuta === 'nueva';
  const { perfil } = useSesion();
  const { datos: mapa } = useDatosMapa();
  const { machos } = useMachos();

  const [cargada, setCargada] = useState<Medicion | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [foto, setFoto] = useState<FotoLocal | null>(null);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const [lugar, setLugar] = useState<{ nombre: string; espiadero_id: string | null } | null>(null);
  const ahora = useMemo(() => new Date(), []);
  const [fecha, setFecha] = useState(fechaTexto(ahora));
  const [hora, setHora] = useState(horaTexto(ahora));
  const [cazador, setCazador] = useState('');
  const [procedencia, setProcedencia] = useState('');
  const [arma, setArma] = useState<Arma | null>(null);
  const [guia, setGuia] = useState('');
  const [medidoPor, setMedidoPor] = useState(perfil?.nombre ?? '');
  const [notas, setNotas] = useState('');
  const [machoId, setMachoId] = useState<string | null>(null);
  const [buscarMacho, setBuscarMacho] = useState('');
  const [abertura, setAbertura] = useState<Captura>(capturaVacia());
  const [filas, setFilas] = useState<Filas>(() => aFilas(medidasVacias()));

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [sucio, setSucio] = useState(false);
  const [pdf, setPdf] = useState<PdfListo | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);

  const urls = useUrlsFotos([cargada?.foto_path]);

  useEffect(() => {
    if (nueva) return;
    let vivo = true;
    supabase
      .from('mediciones')
      .select('*')
      .eq('id', idRuta)
      .maybeSingle()
      .then(({ data, error: e }) => {
        if (!vivo) return;
        if (e || !data) return setErrorCarga(e ? mensajeDeError(e) : 'No se encontró la medición.');
        const m = data as Medicion;
        const vacias = medidasVacias();
        const med: Medidas = {
          viga: m.medidas.viga ?? vacias.viga,
          g: m.medidas.g?.length ? m.medidas.g : vacias.g,
          h: m.medidas.h?.length ? m.medidas.h : vacias.h,
          ap: m.medidas.ap?.length ? m.medidas.ap : vacias.ap,
        };
        const d = new Date(m.cazado_at);
        setCargada({ ...m, medidas: med });
        setLugar(m.lugar ? { nombre: m.lugar, espiadero_id: m.espiadero_id } : null);
        setFecha(fechaTexto(d));
        setHora(horaTexto(d));
        setCazador(m.cazador ?? '');
        setProcedencia(m.procedencia ?? '');
        setArma(m.arma);
        setGuia(m.guia ?? '');
        setMedidoPor(m.medido_por ?? '');
        setNotas(m.notas ?? '');
        setMachoId(m.macho_id);
        setAbertura(aCaptura(m.abertura));
        setFilas(aFilas(med));
      });
    return () => {
      vivo = false;
    };
  }, [idRuta, nueva]);

  const { medidas, invalidas } = useMemo(() => aMedidas(filas), [filas]);
  const valorAbertura = deCaptura(abertura);
  const r = calcular(valorAbertura === 'invalido' ? null : valorAbertura, medidas);
  const totalInvalidas = invalidas + (valorAbertura === 'invalido' ? 1 : 0);

  const lugares = useMemo(
    () => [
      ...(mapa?.lugares ?? []).map((l) => ({ nombre: l.nombre, espiadero_id: null as string | null })),
      ...(mapa?.espiaderos ?? []).map((e) => ({ nombre: e.nombre, espiadero_id: e.id as string | null })),
      { nombre: FUERA, espiadero_id: null },
    ],
    [mapa],
  );
  const machosVisibles = useMemo(() => {
    const q = buscarMacho.trim().toLowerCase();
    const lista = (machos ?? []).filter((m) => m.estado !== 'fusionado');
    const filtrada = q ? lista.filter((m) => nombreMacho(m).toLowerCase().includes(q)) : lista;
    return filtrada.slice(0, 12);
  }, [machos, buscarMacho]);
  const machoElegido = (machos ?? []).find((m) => m.id === machoId) ?? null;

  function cambiar<K extends 'g' | 'h' | 'ap'>(clave: K, i: number, p: ParCaptura) {
    setFilas((f) => ({ ...f, [clave]: f[clave].map((x, j) => (j === i ? p : x)) }));
    tocar();
  }
  function tocar() {
    setPdf(null);
    setGuardadoOk(false);
    setSucio(true);
  }

  async function tomar(origen: 'camara' | 'galeria') {
    setErrorFoto(null);
    try {
      const f = await obtenerFoto(origen);
      if (f) {
        setFoto(f);
        tocar();
      }
    } catch (e) {
      setErrorFoto((e as Error).message);
    }
  }

  async function guardar() {
    setError(null);
    const cazadoAt = fechaHoraAIso(fecha, hora);
    if (!cazadoAt) return setError('Revisa la fecha (dd/mm/aaaa) y la hora (hh:mm).');
    if (totalInvalidas) return setError('Hay medidas mal escritas (en rojo). Los octavos van de 0 a 7.');
    setGuardando(true);
    try {
      const id = cargada?.id ?? Crypto.randomUUID();
      let fotoPath = cargada?.foto_path ?? null;
      if (foto) {
        fotoPath = `mediciones/${id}/${Crypto.randomUUID()}.jpg`;
        await subirFoto(fotoPath, foto.base64);
      }
      const fila = {
        id,
        macho_id: machoId,
        foto_path: fotoPath,
        espiadero_id: lugar?.espiadero_id ?? null,
        lugar: lugar?.nombre ?? null,
        cazado_at: cazadoAt,
        cazador: textoONull(cazador),
        procedencia: textoONull(procedencia),
        arma,
        guia: textoONull(guia),
        medido_por: textoONull(medidoPor),
        notas: textoONull(notas),
        abertura: valorAbertura === 'invalido' ? null : valorAbertura,
        medidas,
        bruta: r.bruta,
        neta_tipica: r.netaTipica,
        neta_no_tipica: r.netaNoTipica,
        actualizado_at: new Date().toISOString(),
      };
      const { data, error: e } = await supabase.from('mediciones').upsert(fila).select('*').single();
      if (e) throw e;
      if (foto && cargada?.foto_path && cargada.foto_path !== fotoPath) {
        await supabase.storage.from('fotos').remove([cargada.foto_path]);
      }
      if (machoId) {
        const { error: et } = await supabase.rpc('guardar_trofeo', {
          p_macho: machoId,
          p: {
            puntuacion_real: Math.round(aPulgadas(r.bruta) * 10) / 10,
            sistema: 'B&C',
            fecha_caza: fechaAIso(fecha),
            cazador: textoONull(cazador) ?? '',
          },
        });
        if (et) throw et;
      }
      const m = data as Medicion;
      setFoto(null);
      setCargada(m);
      setGuardadoOk(true);
      setSucio(false);
      if (nueva) router.setParams({ id: m.id });
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  }

  async function preparar() {
    if (!cargada) return;
    setError(null);
    setPreparando(true);
    try {
      let fotoUri: string | null = null;
      if (cargada.foto_path) {
        const { data, error: ef } = await supabase.storage.from('fotos').createSignedUrl(cargada.foto_path, 600);
        if (ef || !data) throw ef ?? new Error('No se pudo obtener la foto');
        fotoUri = await urlADataUri(data.signedUrl);
      }
      const listo = await prepararPdf(
        {
          folio: cargada.folio,
          cazado_at: cargada.cazado_at,
          lugar: cargada.lugar,
          cazador: cargada.cazador,
          procedencia: cargada.procedencia,
          arma: cargada.arma,
          guia: cargada.guia,
          medido_por: cargada.medido_por,
          notas: cargada.notas,
          ejemplar: machoElegido ? nombreMacho(machoElegido) : null,
          abertura: cargada.abertura,
          medidas: cargada.medidas,
          foto: fotoUri,
        },
        nombreArchivoPdf(cargada.folio, cargada.cazador),
      );
      setPdf(listo);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setPreparando(false);
    }
  }

  async function borrar() {
    if (!cargada) return;
    if (!confirmarBorrar) return setConfirmarBorrar(true);
    setGuardando(true);
    const { error: e } = await supabase.from('mediciones').delete().eq('id', cargada.id);
    if (e) {
      setGuardando(false);
      return setError(mensajeDeError(e));
    }
    if (cargada.foto_path) await supabase.storage.from('fotos').remove([cargada.foto_path]);
    router.replace('/admin/mediciones');
  }

  if (errorCarga) {
    return (
      <View style={estilos.raiz}>
        <Encabezado />
        <View style={estilos.contenido}>
          <Aviso>{errorCarga}</Aviso>
        </View>
      </View>
    );
  }
  if (!nueva && !cargada) {
    return (
      <View style={estilos.raiz}>
        <Encabezado />
        <View style={estilos.contenido}>
          <Text style={[tipografia.cuerpo, { color: t.textoSecundario }]}>Cargando…</Text>
        </View>
      </View>
    );
  }

  const urlFoto = foto?.uri ?? (cargada?.foto_path ? urls[cargada.foto_path] : undefined);
  const hayFoto = !!(foto || cargada?.foto_path);
  const guardadoSinCambios = !!cargada && guardadoOk && !sucio;

  return (
    <View style={estilos.raiz}>
      <Encabezado />
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <Titulo>{cargada ? `Medición ${folioMedicion(cargada.folio)}` : 'Nueva medición'}</Titulo>
        <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>Método Boone and Crockett · pulgadas y octavos</Text>

        {/* Foto */}
        <View style={{ gap: espacio.s }}>
          <Etiqueta>Foto del trofeo</Etiqueta>
          {hayFoto ? (
            <View style={estilos.fotoMarco}>
              {foto ? (
                <Image source={{ uri: foto.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel="Foto del trofeo" />
              ) : (
                <FotoMacho url={urlFoto} style={StyleSheet.absoluteFill} tamanoIcono={48} />
              )}
            </View>
          ) : null}
          <View style={estilos.dos}>
            <View style={{ flex: 1 }}>
              <Boton variante={hayFoto ? 'secundario' : 'primario'} onPress={() => tomar('camara')}>
                {hayFoto ? 'Otra foto' : 'Tomar foto'}
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

        {/* Caza */}
        <View style={{ gap: espacio.m }}>
          <Etiqueta>Lugar</Etiqueta>
          <View style={estilos.opciones}>
            {lugares.map((l) => (
              <Opcion
                key={(l.espiadero_id ?? '') + l.nombre}
                activa={lugar?.nombre === l.nombre}
                onPress={() => {
                  setLugar(l);
                  tocar();
                }}
              >
                {l.nombre}
              </Opcion>
            ))}
          </View>
          <View style={estilos.dos}>
            <View style={{ flex: 3 }}>
              <Campo etiqueta="Fecha" value={fecha} onChangeText={(v) => (setFecha(v), tocar())} placeholder="dd/mm/aaaa" maxLength={10} />
            </View>
            <View style={{ flex: 2 }}>
              <Campo etiqueta="Hora" value={hora} onChangeText={(v) => (setHora(v), tocar())} placeholder="hh:mm" maxLength={5} />
            </View>
          </View>
          <Campo etiqueta="Cazador (cliente)" value={cazador} onChangeText={(v) => (setCazador(v), tocar())} maxLength={80} />
          <Campo etiqueta="Ciudad / país" value={procedencia} onChangeText={(v) => (setProcedencia(v), tocar())} placeholder="Ej. San Antonio, Texas" maxLength={80} />
          <View style={{ gap: espacio.s }}>
            <Etiqueta>Arma</Etiqueta>
            <View style={estilos.opciones}>
              {ARMAS.map((a) => (
                <Opcion key={a.valor} activa={arma === a.valor} onPress={() => (setArma(arma === a.valor ? null : a.valor), tocar())}>
                  {a.nombre}
                </Opcion>
              ))}
            </View>
          </View>
          <Campo etiqueta="Guía" value={guia} onChangeText={(v) => (setGuia(v), tocar())} maxLength={80} />
          <Campo etiqueta="Medido por" value={medidoPor} onChangeText={(v) => (setMedidoPor(v), tocar())} maxLength={80} />
        </View>

        <Filete />

        {/* Medidas */}
        <View style={{ gap: espacio.s }}>
          <Titulo nivel={2}>Medidas</Titulo>
          <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>Pulgadas en el primer cuadro y octavos (0 a 7) en el segundo.</Text>
          <View style={estilos.fila}>
            <Text style={[tipografia.cuerpoFuerte, { color: t.texto, flex: 1 }]}>Abertura interior</Text>
            <View style={{ width: 150 }}>
              <CeldaMedida etiqueta="Abertura interior" valor={abertura} onChange={(c) => (setAbertura(c), tocar())} />
            </View>
          </View>
        </View>

        <View style={estilos.bloque}>
          <EncabezadoLados />
          <FilaMedida nombre="Viga" par={filas.viga} onChange={(p) => (setFilas((f) => ({ ...f, viga: p })), tocar())} />
          <Text style={[tipografia.etiqueta, { color: t.acentoTexto, marginTop: espacio.s }]}>PUNTAS (G)</Text>
          {filas.g.map((p, i) => (
            <FilaMedida key={`g${i}`} nombre={`G${i + 1}`} par={p} onChange={(n) => cambiar('g', i, n)} />
          ))}
          <BotonAgregar onPress={() => setFilas((f) => ({ ...f, g: [...f.g, parVacio()] }))}>Agregar G</BotonAgregar>
          <Text style={[tipografia.etiqueta, { color: t.acentoTexto, marginTop: espacio.s }]}>CIRCUNFERENCIAS (H)</Text>
          {filas.h.map((p, i) => (
            <FilaMedida key={`h${i}`} nombre={`H${i + 1}`} par={p} onChange={(n) => cambiar('h', i, n)} />
          ))}
          <Text style={[tipografia.etiqueta, { color: t.acentoTexto, marginTop: espacio.s }]}>PUNTAS ANORMALES</Text>
          {filas.ap.map((p, i) => (
            <FilaMedida key={`ap${i}`} nombre={`AP${i + 1}`} par={p} onChange={(n) => cambiar('ap', i, n)} />
          ))}
          <BotonAgregar onPress={() => setFilas((f) => ({ ...f, ap: [...f.ap, parVacio()] }))}>Agregar punta anormal</BotonAgregar>
        </View>

        {/* Puntuación en vivo */}
        <View style={estilos.resultado} accessibilityLabel="Puntuación">
          <Etiqueta>Puntuación</Etiqueta>
          {(
            [
              ['Crédito de abertura', formato(r.creditoAbertura), false],
              ['Suma lado derecho', formato(r.sumaDer), false],
              ['Suma lado izquierdo', formato(r.sumaIzq), false],
              ['Puntuación bruta', formato(r.bruta), true],
              ['Diferencias', r.diferencias ? `− ${formato(r.diferencias)}` : '0', false],
              ['Puntas anormales', formato(r.anormales), false],
              ['Neta típica', formato(r.netaTipica), true],
              ['Neta no típica', formato(r.netaNoTipica), true],
              ['Número de puntas', `${r.puntasDer} der. · ${r.puntasIzq} izq.`, false],
            ] as [string, string, boolean][]
          ).map(([k, v, fuerte]) => (
            <View key={k} style={estilos.filaResultado}>
              <Text style={[fuerte ? tipografia.cuerpoFuerte : tipografia.secundario, { color: fuerte ? t.titulo : t.textoSecundario, flex: 1 }]}>{k}</Text>
              <Text style={[fuerte ? tipografia.titulo2 : tipografia.cuerpoFuerte, { color: fuerte ? t.titulo : t.texto }]}>{v}</Text>
            </View>
          ))}
          {totalInvalidas ? <Aviso>Hay medidas mal escritas (en rojo). Los octavos van de 0 a 7.</Aviso> : null}
        </View>

        {/* Ejemplar */}
        <View style={{ gap: espacio.s }}>
          <Etiqueta>Ejemplar de la bitácora (opcional)</Etiqueta>
          <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>
            Al guardar, el ejemplar queda como cazado con la puntuación bruta, la fecha y el cazador.
          </Text>
          {machoElegido ? (
            <View style={estilos.fila}>
              <Text style={[tipografia.cuerpoFuerte, { color: t.texto, flex: 1 }]}>{nombreMacho(machoElegido)}</Text>
              <Text onPress={() => (setMachoId(null), tocar())} accessibilityRole="button" style={[tipografia.secundario, { color: t.primario, fontWeight: '600' }]}>
                Quitar
              </Text>
            </View>
          ) : (
            <>
              <Campo etiqueta="Buscar por folio o apodo" value={buscarMacho} onChangeText={setBuscarMacho} placeholder="Ej. LL-011" />
              <View style={estilos.opciones}>
                {machosVisibles.map((m) => (
                  <Opcion key={m.id} activa={false} onPress={() => (setMachoId(m.id), tocar())}>
                    {nombreMacho(m)}
                  </Opcion>
                ))}
              </View>
            </>
          )}
        </View>

        <Campo etiqueta="Notas (opcional)" value={notas} onChangeText={(v) => (setNotas(v), tocar())} maxLength={1000} multiline />

        {error ? <Aviso>{error}</Aviso> : null}
        {guardadoSinCambios ? <Aviso tono="exito">Medición guardada.</Aviso> : null}
        <Boton onPress={guardar} cargando={guardando} variante={guardadoSinCambios ? 'secundario' : 'primario'}>
          {cargada ? 'Guardar cambios' : 'Guardar medición'}
        </Boton>

        {/* PDF */}
        {cargada ? (
          <View style={estilos.bloquePdf}>
            <Etiqueta>PDF para el cliente</Etiqueta>
            {sucio ? <Aviso tono="alerta">Tienes cambios sin guardar. El PDF usa lo último que guardaste.</Aviso> : null}
            {Platform.OS !== 'web' ? (
              <Aviso tono="alerta">El PDF se genera desde la web app.</Aviso>
            ) : !pdf ? (
              <Boton variante="secundario" onPress={preparar} cargando={preparando}>
                Preparar PDF
              </Boton>
            ) : (
              <View style={{ gap: espacio.s }}>
                {puedeCompartir(pdf) ? <Boton onPress={() => compartir(pdf)}>Compartir PDF</Boton> : null}
                <Boton variante="secundario" onPress={() => descargar(pdf)}>
                  Descargar PDF
                </Boton>
              </View>
            )}
          </View>
        ) : null}

        {cargada ? (
          <Boton variante="peligro" onPress={borrar}>
            {confirmarBorrar ? '¿Seguro? Se borra la medición' : 'Borrar medición'}
          </Boton>
        ) : null}
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
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  bloque: { gap: espacio.s },
  resultado: { gap: espacio.s, padding: espacio.l, borderWidth: borde.fino, borderColor: t.acento, borderRadius: radio.m, backgroundColor: t.superficie },
  filaResultado: { flexDirection: 'row', alignItems: 'baseline', gap: espacio.m },
  bloquePdf: { gap: espacio.m, padding: espacio.l, borderWidth: borde.fino, borderColor: t.borde, borderRadius: radio.m, backgroundColor: t.superficie },
});
