/**
 * Ficha del ejemplar (tarjeta de trofeo): fotos, rasgos, lugares, historial.
 * Personal: registrar avistamiento, editar, elegir portada.
 * Admin: validar, unir con otro ejemplar (duplicado), marcar cazado.
 */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FotoMacho } from '../../../../components/bitacora/FotoMacho';
import { RasgosEditor, rasgosEnTexto } from '../../../../components/bitacora/RasgosEditor';
import { haceDias, TarjetaMacho, tonoEstado } from '../../../../components/bitacora/TarjetaMacho';
import { Aviso, Boton, Campo, Chip, Encabezado, Etiqueta, Filete, Opcion, Titulo } from '../../../../components/consulta';
import { useFicha, useMachos } from '../../../../lib/bitacora/datos';
import { useUrlsFotos } from '../../../../lib/bitacora/fotos';
import { CLASES_MACHO, NOMBRE_ESTADO, type ClaseMacho, type Rasgos } from '../../../../lib/bitacora/tipos';
import { useEnvios } from '../../../../lib/censo/cola';
import { fechaCorta } from '../../../../lib/censo/tiempo';
import { esAdmin, useSesion } from '../../../../lib/sesion';
import { mensajeDeError, supabase } from '../../../../lib/supabase';
import { borde, espacio, radio, temas, tipografia } from '../../../../theme';

const t = temas.consulta;

export default function FichaMacho() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { perfil } = useSesion();
  const admin = esAdmin(perfil);
  const { ficha, error, recargar } = useFicha(id);
  const { machos } = useMachos();
  const envios = useEnvios();
  useEffect(() => {
    if (envios) recargar();
  }, [envios, recargar]);
  useFocusEffect(
    useCallback(() => {
      recargar();
    }, [recargar]),
  );
  const [fotoSel, setFotoSel] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [uniendo, setUniendo] = useState(false);
  const [destino, setDestino] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  // Edición
  const [apodo, setApodo] = useState('');
  const [clase, setClase] = useState<ClaseMacho>('M1');
  const [rasgos, setRasgos] = useState<Rasgos | null>(null);
  const [nota, setNota] = useState('');

  const rutas = useMemo(() => (ficha?.fotos ?? []).map((f) => f.storage_path), [ficha]);
  const urls = useUrlsFotos(rutas);
  const otros = useMemo(() => (machos ?? []).filter((m) => m.id !== id && m.estado !== 'fusionado'), [machos, id]);
  const urlsOtros = useUrlsFotos(uniendo ? otros.map((m) => m.portada_path) : []);

  if (!ficha) {
    return (
      <View style={estilos.raiz}>
        <Encabezado />
        <View style={estilos.contenido}>{error ? <Aviso>{error}</Aviso> : <Text style={[tipografia.cuerpo, { color: t.textoSecundario }]}>Cargando…</Text>}</View>
      </View>
    );
  }
  const m = ficha.macho;
  const fotoGrande = ficha.fotos.find((f) => f.id === fotoSel) ?? ficha.fotos.find((f) => f.id === m.foto_portada_id) ?? ficha.fotos[0];

  async function actualizar(cambios: Record<string, unknown>, etiqueta: string) {
    setOcupado(etiqueta);
    setAviso(null);
    const { error: e } = await supabase.rpc('actualizar_macho', { p_id: m.id, p: cambios });
    setOcupado(null);
    if (e) return setAviso(mensajeDeError(e));
    setEditando(false);
    recargar();
  }

  function empezarEdicion() {
    setApodo(m.apodo ?? '');
    setClase(m.clase_actual);
    setRasgos({
      puntas_izq: m.puntas_izq,
      puntas_der: m.puntas_der,
      forma: m.forma,
      puntas_anomalas: m.puntas_anomalas,
      cuerno_roto: m.cuerno_roto,
      cicatrices: m.cicatrices,
      oreja_marcada: m.oreja_marcada,
    });
    setNota(m.nota ?? '');
    setEditando(true);
  }

  async function unir() {
    if (!destino) return;
    setOcupado('unir');
    const { error: e } = await supabase.rpc('fusionar_machos', { p_origen: m.id, p_destino: destino });
    setOcupado(null);
    if (e) return setAviso(mensajeDeError(e));
    router.replace({ pathname: '/bitacora/[id]', params: { id: destino } });
  }

  // Lugares donde se ha visto
  const lugares = new Map<string, number>();
  ficha.avistamientos.forEach((a) => {
    const n = a.espiaderos?.nombre ?? 'Fuera de espiadero';
    lugares.set(n, (lugares.get(n) ?? 0) + 1);
  });

  // Historial: avistamientos + cambios de clase
  const historial = [
    ...ficha.avistamientos.map((a) => ({
      fecha: a.observado_at,
      texto: `Avistamiento · ${a.espiaderos?.nombre ?? 'fuera de espiadero'}${a.clase_observada ? ` · ${a.clase_observada}` : ''}`,
      por: a.perfiles?.nombre ?? '—',
      nota: a.nota,
    })),
    ...ficha.clases.slice(1).map((c, i) => ({
      fecha: c.desde,
      texto: `Cambio de clase ${ficha.clases[i].clase} → ${c.clase}`,
      por: c.perfiles?.nombre ?? '—',
      nota: null as string | null,
    })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <View style={estilos.raiz}>
      <Encabezado />
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        {/* Tarjeta de trofeo */}
        <View style={estilos.tarjeta}>
          <FotoMacho url={fotoGrande ? urls[fotoGrande.storage_path] : null} style={estilos.foto} tamanoIcono={96} />
          <View style={estilos.placa}>
            <View style={estilos.placaFila}>
              <Text style={[tipografia.display, { color: t.titulo }]}>{m.folio}</Text>
              <View style={estilos.clase}>
                <Text style={[tipografia.titulo1, { color: t.textoSobrePrimario }]}>{m.clase_actual}</Text>
              </View>
            </View>
            {m.apodo ? <Text style={[tipografia.cuerpoFuerte, { color: t.texto }]}>“{m.apodo}”</Text> : null}
            <Filete style={{ marginVertical: espacio.s }} />
            <View style={estilos.placaFila}>
              <Chip tono={tonoEstado(m.estado_efectivo)}>{NOMBRE_ESTADO[m.estado_efectivo]}</Chip>
              <Text style={[tipografia.secundario, { color: t.textoSecundario, flexShrink: 1, textAlign: 'right' }]}>
                {haceDias(m.ultimo_avistamiento_at)}
                {m.ultimo_espiadero_nombre ? ` · ${m.ultimo_espiadero_nombre}` : ''}
              </Text>
            </View>
          </View>
        </View>

        {aviso ? <Aviso>{aviso}</Aviso> : null}

        {/* Acciones */}
        {!editando && !uniendo ? (
          <View style={{ gap: espacio.s }}>
            {m.estado !== 'cazado' ? (
              <Boton onPress={() => router.push({ pathname: '/bitacora/registrar', params: { macho: m.id } })}>Registrar avistamiento</Boton>
            ) : null}
            {admin && m.estado === 'por_validar' ? (
              <Boton onPress={() => actualizar({ estado: 'activo' }, 'validar')} cargando={ocupado === 'validar'}>
                Validar ejemplar
              </Boton>
            ) : null}
            <Boton variante="secundario" onPress={empezarEdicion}>
              Editar
            </Boton>
            {admin ? (
              <Boton variante="secundario" onPress={() => setUniendo(true)}>
                Unir con otro ejemplar (duplicado)
              </Boton>
            ) : null}
            {admin && m.estado === 'activo' ? (
              <Boton variante="peligro" onPress={() => actualizar({ estado: 'cazado' }, 'cazado')} cargando={ocupado === 'cazado'}>
                Marcar como cazado
              </Boton>
            ) : null}
            {admin && m.estado === 'cazado' ? (
              <Boton variante="secundario" onPress={() => actualizar({ estado: 'activo' }, 'activo')} cargando={ocupado === 'activo'}>
                Volver a activo
              </Boton>
            ) : null}
          </View>
        ) : null}

        {/* Edición */}
        {editando && rasgos ? (
          <View style={estilos.bloque}>
            <Titulo nivel={2}>Editar</Titulo>
            <Campo etiqueta="Apodo" value={apodo} onChangeText={setApodo} maxLength={40} />
            <Etiqueta>Clase actual</Etiqueta>
            <View style={estilos.opciones}>
              {CLASES_MACHO.map((c) => (
                <Opcion key={c} activa={clase === c} onPress={() => setClase(c)}>
                  {c}
                </Opcion>
              ))}
            </View>
            <RasgosEditor valor={rasgos} onChange={setRasgos} />
            <Campo etiqueta="Nota" value={nota} onChangeText={setNota} maxLength={500} multiline />
            <Boton onPress={() => actualizar({ apodo, clase, nota, ...rasgos }, 'guardar')} cargando={ocupado === 'guardar'}>
              Guardar cambios
            </Boton>
            <Boton variante="secundario" onPress={() => setEditando(false)}>
              Cancelar
            </Boton>
          </View>
        ) : null}

        {/* Unir duplicado */}
        {uniendo ? (
          <View style={estilos.bloque}>
            <Titulo nivel={2}>Unir con…</Titulo>
            <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>
              Elige el ejemplar que se conserva. Los avistamientos y fotos de {m.folio} pasan a él y {m.folio} desaparece de la lista.
            </Text>
            {otros.map((o) => (
              <TarjetaMacho
                key={o.id}
                macho={o}
                url={o.portada_path ? urlsOtros[o.portada_path] : undefined}
                onPress={() => setDestino(o.id)}
                derecha={destino === o.id ? <Chip tono="exito">Elegido</Chip> : undefined}
              />
            ))}
            <Boton onPress={unir} deshabilitado={!destino} cargando={ocupado === 'unir'}>
              {destino ? `Unir ${m.folio} en ${otros.find((o) => o.id === destino)?.folio}` : 'Elige un ejemplar'}
            </Boton>
            <Boton
              variante="secundario"
              onPress={() => {
                setUniendo(false);
                setDestino(null);
              }}
            >
              Cancelar
            </Boton>
          </View>
        ) : null}

        {/* Galería */}
        {ficha.fotos.length ? (
          <View style={{ gap: espacio.m }}>
            <Titulo nivel={2}>Galería</Titulo>
            <View style={estilos.galeria}>
              {ficha.fotos.map((f) => (
                <Pressable key={f.id} onPress={() => setFotoSel(f.id)} style={estilos.miniatura} accessibilityRole="button" accessibilityLabel={`Foto del ${fechaCorta(f.tomada_at)}`}>
                  <FotoMacho url={urls[f.storage_path]} style={StyleSheet.absoluteFill} tamanoIcono={28} />
                  <View style={estilos.miniaturaFecha}>
                    <Text style={[tipografia.secundario, { color: t.textoSobrePrimario, fontSize: 12 }]}>
                      {new Date(f.tomada_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  {f.id === fotoGrande?.id ? <View style={estilos.miniaturaSel} /> : null}
                </Pressable>
              ))}
            </View>
            {fotoGrande && fotoGrande.id !== m.foto_portada_id ? (
              <Boton variante="secundario" onPress={() => actualizar({ foto_portada_id: fotoGrande.id }, 'portada')} cargando={ocupado === 'portada'}>
                Usar esta foto como principal
              </Boton>
            ) : null}
          </View>
        ) : null}

        {/* Rasgos */}
        <View style={{ gap: espacio.m }}>
          <Titulo nivel={2}>Rasgos distintivos</Titulo>
          {rasgosEnTexto(m).length === 0 && !m.nota ? (
            <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>Sin rasgos registrados.</Text>
          ) : (
            <View style={estilos.bloqueLista}>
              {rasgosEnTexto(m).map(([k, v], i) => (
                <View key={k} style={[estilos.renglon, i > 0 && estilos.renglonBorde]}>
                  <Etiqueta>{k}</Etiqueta>
                  <Text style={[tipografia.cuerpo, { color: t.texto }]}>{v}</Text>
                </View>
              ))}
              {m.nota ? (
                <View style={[estilos.renglon, rasgosEnTexto(m).length > 0 && estilos.renglonBorde]}>
                  <Etiqueta>Nota</Etiqueta>
                  <Text style={[tipografia.cuerpo, { color: t.texto }]}>{m.nota}</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        {/* Visto en */}
        {lugares.size ? (
          <View style={{ gap: espacio.m }}>
            <Titulo nivel={2}>Visto en</Titulo>
            <View style={estilos.opciones}>
              {[...lugares.entries()].map(([n, c]) => (
                <Chip key={n}>{`${n} · ${c}`}</Chip>
              ))}
            </View>
          </View>
        ) : null}

        {/* Historial */}
        <View style={{ gap: espacio.m }}>
          <Titulo nivel={2}>Historial</Titulo>
          <View style={estilos.bloqueLista}>
            {historial.map((h, i) => (
              <View key={h.fecha + h.texto} style={[estilos.renglon, i > 0 && estilos.renglonBorde]}>
                <Text style={[tipografia.secundario, { color: t.acentoTexto, fontWeight: '600' }]}>{fechaCorta(h.fecha)}</Text>
                <Text style={[tipografia.cuerpo, { color: t.texto }]}>{h.texto}</Text>
                <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>Registró: {h.por}</Text>
                {h.nota ? <Text style={[tipografia.secundario, { color: t.texto }]}>{h.nota}</Text> : null}
              </View>
            ))}
            <View style={[estilos.renglon, historial.length > 0 && estilos.renglonBorde]}>
              <Text style={[tipografia.secundario, { color: t.acentoTexto, fontWeight: '600' }]}>{fechaCorta(m.creado_at)}</Text>
              <Text style={[tipografia.cuerpo, { color: t.texto }]}>Ficha creada</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: t.fondo },
  contenido: { padding: espacio.l, gap: espacio.xl, paddingBottom: espacio.xxxl },
  tarjeta: { backgroundColor: t.superficie, borderWidth: borde.fino, borderColor: t.acento, borderRadius: radio.m, overflow: 'hidden' },
  foto: { aspectRatio: 4 / 3 },
  placa: { padding: espacio.l, gap: espacio.xs },
  placaFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m },
  clase: { backgroundColor: t.primario, borderRadius: radio.s, paddingHorizontal: espacio.m, paddingVertical: espacio.xs, borderWidth: borde.medio, borderColor: t.acento },
  bloque: { gap: espacio.m, padding: espacio.l, borderWidth: borde.fino, borderColor: t.acento, borderRadius: radio.m, backgroundColor: t.superficie },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  galeria: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  miniatura: { width: '31.5%', aspectRatio: 1, borderRadius: radio.s, overflow: 'hidden' },
  miniaturaFecha: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: espacio.xs, backgroundColor: 'rgba(21,29,23,0.6)' },
  miniaturaSel: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 3, borderColor: t.acento, borderRadius: radio.s },
  bloqueLista: { backgroundColor: t.superficie, borderWidth: borde.fino, borderColor: t.borde, borderRadius: radio.m },
  renglon: { paddingHorizontal: espacio.l, paddingVertical: espacio.m, gap: espacio.xxs },
  renglonBorde: { borderTopWidth: borde.fino, borderTopColor: t.borde },
});
