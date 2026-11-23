/**
 * Aportes de invitados por revisar (admin): aprobar, rechazar o abrir la ficha
 * (para unirlo con otro ejemplar si es un duplicado).
 */
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { FotoMacho } from '../../../../components/bitacora/FotoMacho';
import { rasgosEnTexto } from '../../../../components/bitacora/RasgosEditor';
import { Aviso, Boton, Chip, Encabezado, Titulo } from '../../../../components/consulta';
import { useUrlsFotos } from '../../../../lib/bitacora/fotos';
import type { Rasgos } from '../../../../lib/bitacora/tipos';
import { fechaCorta } from '../../../../lib/censo/tiempo';
import { esAdmin, useSesion } from '../../../../lib/sesion';
import { mensajeDeError, supabase } from '../../../../lib/supabase';
import { borde, espacio, radio, temas, tipografia } from '../../../../theme';

const t = temas.consulta;

interface Aporte extends Rasgos {
  avistamiento_id: string;
  observado_at: string;
  clase: string | null;
  nota: string | null;
  espiadero: string | null;
  autor: string | null;
  macho_id: string;
  folio: string;
  apodo: string | null;
  ejemplar_nuevo: boolean;
  fotos: string[];
}

export default function Revisar() {
  const { perfil } = useSesion();
  const [aportes, setAportes] = useState<Aporte[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const urls = useUrlsFotos((aportes ?? []).flatMap((a) => a.fotos));

  const cargar = useCallback(() => {
    supabase.rpc('aportes_pendientes').then(({ data, error: e }) => {
      if (e) setError(mensajeDeError(e));
      else setAportes((data as Aporte[]) ?? []);
    });
  }, []);
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  if (!esAdmin(perfil)) return <Redirect href="/bitacora" />;

  async function revisar(a: Aporte, aprobar: boolean) {
    if (!aprobar && confirmar !== a.avistamiento_id) return setConfirmar(a.avistamiento_id);
    setConfirmar(null);
    setOcupado(a.avistamiento_id);
    setError(null);
    const { data, error: e } = await supabase.rpc('revisar_aporte', { p_avistamiento: a.avistamiento_id, p_aprobar: aprobar });
    if (e) {
      setOcupado(null);
      return setError(mensajeDeError(e));
    }
    const rutas = (data as { rutas?: string[] })?.rutas ?? [];
    if (rutas.length) await supabase.storage.from('fotos').remove(rutas);
    setOcupado(null);
    cargar();
  }

  return (
    <View style={estilos.raiz}>
      <Encabezado />
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Titulo>Por revisar</Titulo>
        <Text style={[tipografia.cuerpo, { color: t.textoSecundario }]}>
          Lo que registran los invitados. Nadie más lo ve hasta que lo apruebes. Si es un ejemplar que ya existe, abre la ficha y únelo con el
          correcto.
        </Text>
        {error ? <Aviso>{error}</Aviso> : null}
        {aportes && aportes.length === 0 ? <Aviso tono="exito">No hay nada pendiente.</Aviso> : null}

        {(aportes ?? []).map((a) => (
          <View key={a.avistamiento_id} style={estilos.tarjeta}>
            {a.fotos.length ? (
              <View style={estilos.fotos}>
                {a.fotos.map((r) => (
                  <FotoMacho key={r} url={urls[r]} style={estilos.foto} tamanoIcono={40} />
                ))}
              </View>
            ) : (
              <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>Sin foto</Text>
            )}
            <View style={estilos.fila}>
              <Text style={[tipografia.titulo2, { color: t.titulo, flex: 1 }]}>
                {a.ejemplar_nuevo ? 'Ejemplar nuevo' : a.folio}
                {a.apodo ? ` “${a.apodo}”` : ''}
              </Text>
              {a.clase ? <Chip>{a.clase}</Chip> : null}
            </View>
            <Text style={[tipografia.secundario, { color: t.texto }]}>
              {`${fechaCorta(a.observado_at)} · ${a.espiadero ?? 'fuera de espiadero'} · por ${a.autor ?? 'invitado'}`}
            </Text>
            {rasgosEnTexto(a).length ? (
              <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>
                {rasgosEnTexto(a)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(' · ')}
              </Text>
            ) : null}
            {a.nota ? <Text style={[tipografia.secundario, { color: t.texto }]}>{`“${a.nota}”`}</Text> : null}
            <View style={estilos.acciones}>
              <View style={{ flex: 1 }}>
                <Boton onPress={() => revisar(a, true)} cargando={ocupado === a.avistamiento_id && confirmar !== a.avistamiento_id}>
                  Aprobar
                </Boton>
              </View>
              <View style={{ flex: 1 }}>
                <Boton variante="peligro" onPress={() => revisar(a, false)}>
                  {confirmar === a.avistamiento_id ? '¿Seguro? Se borra' : 'Rechazar'}
                </Boton>
              </View>
            </View>
            <Boton variante="secundario" onPress={() => router.push({ pathname: '/bitacora/[id]', params: { id: a.macho_id } })}>
              {a.ejemplar_nuevo ? 'Ver ficha / unir con uno existente' : 'Ver ficha'}
            </Boton>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: t.fondo },
  contenido: { padding: espacio.l, gap: espacio.l, paddingBottom: espacio.xxxl },
  tarjeta: { gap: espacio.s, padding: espacio.l, borderWidth: borde.fino, borderColor: t.acento, borderRadius: radio.m, backgroundColor: t.superficie },
  fotos: { flexDirection: 'row', gap: espacio.s },
  foto: { flex: 1, aspectRatio: 4 / 3, borderRadius: radio.s },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  acciones: { flexDirection: 'row', gap: espacio.s },
});
