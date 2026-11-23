/**
 * Códigos de invitado: generar (con QR), ver vigentes, revocar; invitados activos.
 */
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Aviso, Boton, Campo, Encabezado, Etiqueta, Fila, Opcion, Titulo } from '../../../../components/consulta';
import { enlaceInvitado } from '../../../../lib/enlaces';
import { mensajeDeError, supabase } from '../../../../lib/supabase';
import { borde, espacio, paleta, radio, temas, tipografia } from '../../../../theme';

const t = temas.consulta;

interface Codigo {
  id: string;
  codigo: string;
  vigente_hasta: string;
  usos: number;
  usos_max: number | null;
  nota: string | null;
  bitacora: Permiso;
}
interface Invitado {
  id: string;
  nombre: string;
  expira_en: string | null;
  bitacora: Permiso;
}

type Permiso = 'ninguno' | 'lectura' | 'escritura';
const PERMISOS: [Permiso, string][] = [
  ['ninguno', 'Sin bitácora'],
  ['lectura', 'Solo ver'],
  ['escritura', 'Ver y registrar'],
];
const nombrePermiso = (p: Permiso) => PERMISOS.find((x) => x[0] === p)?.[1] ?? 'Sin bitácora';

const vigencias = [
  { etiqueta: '6 horas', horas: 6 },
  { etiqueta: '1 día', horas: 24 },
  { etiqueta: '3 días', horas: 72 },
  { etiqueta: '7 días', horas: 168 },
];
const limites = [
  { etiqueta: 'Sin límite', usos: null },
  { etiqueta: '1 persona', usos: 1 },
  { etiqueta: '5', usos: 5 },
  { etiqueta: '10', usos: 10 },
];

const fecha = (iso: string) => new Date(iso).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });


function consultar() {
  const ahora = new Date().toISOString();
  return Promise.all([
    supabase.from('codigos_invitado').select('id, codigo, vigente_hasta, usos, usos_max, nota, bitacora').is('revocado_at', null).gt('vigente_hasta', ahora).order('creado_at', { ascending: false }),
    supabase.from('perfiles').select('id, nombre, expira_en, bitacora').eq('rol', 'invitado').eq('activo', true).gt('expira_en', ahora).order('nombre'),
  ]);
}

export default function Codigos() {
  const [horas, setHoras] = useState(24);
  const [usosMax, setUsosMax] = useState<number | null>(null);
  const [nota, setNota] = useState('');
  const [permiso, setPermiso] = useState<Permiso>('ninguno');
  const [cambiando, setCambiando] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState<Codigo | null>(null);
  const [codigos, setCodigos] = useState<Codigo[]>([]);
  const [invitados, setInvitados] = useState<Invitado[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [porRevocar, setPorRevocar] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const aplicarConsulta = useCallback((r: Awaited<ReturnType<typeof consultar>>) => {
    const [c, i] = r;
    if (c.error || i.error) setError(mensajeDeError(c.error ?? i.error));
    setCodigos((c.data as Codigo[]) ?? []);
    setInvitados((i.data as Invitado[]) ?? []);
  }, []);
  const cargar = useCallback(() => consultar().then(aplicarConsulta), [aplicarConsulta]);

  useEffect(() => {
    consultar().then(aplicarConsulta);
  }, [aplicarConsulta]);


  async function generar() {
    setError(null);
    setGenerando(true);
    const { data, error: e } = await supabase.rpc('generar_codigo', {
      p_horas: horas,
      p_usos_max: usosMax,
      p_nota: nota || null,
      p_bitacora: permiso,
    });
    setGenerando(false);
    if (e) return setError(mensajeDeError(e));
    setNuevo(data as Codigo);
    setNota('');
    setCopiado(false);
    cargar();
  }

  async function revocar(id: string) {
    if (porRevocar !== id) return setPorRevocar(id);
    setPorRevocar(null);
    const { error: e } = await supabase.rpc('revocar_codigo', { p_id: id });
    if (e) return setError(mensajeDeError(e));
    if (nuevo?.id === id) setNuevo(null);
    cargar();
  }

  return (
    <View style={estilos.raiz}>
      <Encabezado />
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Titulo>Invitados</Titulo>

        {nuevo ? (
          <View style={estilos.tarjeta}>
            <Etiqueta>Código para invitados</Etiqueta>
            <Text style={estilos.codigoGrande} selectable accessibilityLabel={`Código ${nuevo.codigo.split('').join(' ')}`}>
              {nuevo.codigo.slice(0, 3)} {nuevo.codigo.slice(3)}
            </Text>
            <View style={estilos.qr}>
              <QRCode value={enlaceInvitado(nuevo.codigo)} size={200} color={paleta.verdeBosque} backgroundColor={paleta.hueso} />
            </View>
            <Text style={[tipografia.secundario, { color: t.textoSecundario, textAlign: 'center' }]}>
              Vence: {fecha(nuevo.vigente_hasta)}{'\n'}El invitado escanea el QR con la cámara del iPhone, o abre app.rancholaslomas.com.mx y escribe el código.
            </Text>
            <Boton
              variante="secundario"
              onPress={async () => {
                await Clipboard.setStringAsync(nuevo.codigo);
                setCopiado(true);
              }}
            >
              {copiado ? 'Copiado' : 'Copiar código'}
            </Boton>
          </View>
        ) : null}

        <View style={{ gap: espacio.m }}>
          <Etiqueta>Vigencia</Etiqueta>
          <View style={estilos.opciones}>
            {vigencias.map((v) => (
              <Opcion key={v.horas} activa={horas === v.horas} onPress={() => setHoras(v.horas)}>
                {v.etiqueta}
              </Opcion>
            ))}
          </View>
          <Etiqueta>¿Cuántas personas pueden usarlo?</Etiqueta>
          <View style={estilos.opciones}>
            {limites.map((l) => (
              <Opcion key={l.etiqueta} activa={usosMax === l.usos} onPress={() => setUsosMax(l.usos)}>
                {l.etiqueta}
              </Opcion>
            ))}
          </View>
          <Etiqueta>Bitácora de machos</Etiqueta>
          <View style={estilos.opciones}>
            {PERMISOS.map(([v, txt]) => (
              <Opcion key={v} activa={permiso === v} onPress={() => setPermiso(v)}>
                {txt}
              </Opcion>
            ))}
          </View>
          <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>
            {permiso === 'ninguno'
              ? 'No verán la bitácora.'
              : permiso === 'lectura'
                ? 'Podrán consultar fichas y fotos, sin registrar ni ver puntuaciones.'
                : 'Podrán registrar avistamientos; tú los apruebas antes de que los vean los demás.'}
          </Text>
          <Campo etiqueta="Nota (opcional)" value={nota} onChangeText={setNota} placeholder="Ej. Invitados de Luis, temporada 2026" maxLength={80} />
          {error ? <Aviso>{error}</Aviso> : null}
          <Boton onPress={generar} cargando={generando}>
            Generar código
          </Boton>
        </View>

        <View style={{ gap: espacio.s }}>
          <Titulo nivel={2}>Códigos vigentes</Titulo>
          {codigos.length === 0 ? <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>No hay códigos vigentes.</Text> : null}
          <View style={estilos.lista}>
            {codigos.map((c) => (
              <Fila
                key={c.id}
                titulo={`${c.codigo.slice(0, 3)} ${c.codigo.slice(3)}`}
                detalle={`Vence ${fecha(c.vigente_hasta)} · ${c.usos}${c.usos_max ? ` de ${c.usos_max}` : ''} uso(s) · Bitácora: ${nombrePermiso(c.bitacora)}${c.nota ? ` · ${c.nota}` : ''}`}
                derecha={
                  <Text onPress={() => revocar(c.id)} style={[tipografia.secundario, { color: t.error, fontWeight: '600' }]} accessibilityRole="button">
                    {porRevocar === c.id ? '¿Revocar? Toca otra vez' : 'Revocar'}
                  </Text>
                }
              />
            ))}
          </View>
        </View>

        <View style={{ gap: espacio.s }}>
          <Titulo nivel={2}>Invitados con acceso</Titulo>
          {invitados.length === 0 ? <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>Nadie ha entrado con código.</Text> : null}
          <View style={estilos.lista}>
            {invitados.map((i) => (
              <View key={i.id}>
                <Fila
                  titulo={i.nombre}
                  detalle={`${i.expira_en ? `Hasta ${fecha(i.expira_en)} · ` : ''}Bitácora: ${nombrePermiso(i.bitacora)}`}
                  derecha={
                    <Text
                      onPress={() => setCambiando(cambiando === i.id ? null : i.id)}
                      style={[tipografia.secundario, { color: t.primario, fontWeight: '600' }]}
                      accessibilityRole="button"
                    >
                      {cambiando === i.id ? 'Listo' : 'Permiso'}
                    </Text>
                  }
                />
                {cambiando === i.id ? (
                  <View style={[estilos.opciones, { padding: espacio.m, backgroundColor: t.superficie }]}>
                    {PERMISOS.map(([v, txt]) => (
                      <Opcion
                        key={v}
                        activa={i.bitacora === v}
                        onPress={async () => {
                          const { error: e } = await supabase.rpc('permiso_bitacora_invitado', { p_perfil: i.id, p_bitacora: v });
                          if (e) setError(mensajeDeError(e));
                          else cargar();
                        }}
                      >
                        {txt}
                      </Opcion>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: t.fondo },
  contenido: { padding: espacio.l, gap: espacio.xl, paddingBottom: espacio.xxxl },
  tarjeta: {
    backgroundColor: t.superficie,
    borderWidth: borde.fino,
    borderColor: t.acento,
    borderRadius: radio.m,
    padding: espacio.l,
    gap: espacio.m,
    alignItems: 'stretch',
  },
  codigoGrande: { fontSize: 48, fontWeight: '700', letterSpacing: 6, color: t.titulo, textAlign: 'center', fontVariant: ['tabular-nums'] },
  qr: { alignItems: 'center', padding: espacio.m, backgroundColor: paleta.hueso, borderRadius: radio.s },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  lista: { borderWidth: borde.fino, borderColor: t.borde, borderRadius: radio.m, overflow: 'hidden' },
});
