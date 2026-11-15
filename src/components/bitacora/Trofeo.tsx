/**
 * Datos de trofeo del ejemplar (solo administrador): puntuación estimada,
 * registro de caza (fecha y cazador) y puntuación real.
 * La base de datos no entrega estos datos a nadie que no sea administrador.
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { mensajeDeError, supabase } from '../../lib/supabase';
import { borde, espacio, radio, temas, tipografia } from '../../theme';
import { Aviso, Boton, Campo, Etiqueta, Opcion, Titulo } from '../consulta';

const t = temas.consulta;

export interface DatosTrofeo {
  macho_id: string;
  puntuacion_estimada: number | null;
  puntuacion_real: number | null;
  sistema: 'B&C' | 'SCI';
  fecha_caza: string | null;
  cazador: string | null;
}

/** "14/11/2026" → "2026-11-14" (o null si no es válida). */
export function fechaAIso(txt: string): string | null {
  const m = /^\s*(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})\s*$/.exec(txt);
  if (!m) return null;
  const anio = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(Date.UTC(anio, Number(m[2]) - 1, Number(m[1])));
  if (d.getUTCDate() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1) return null;
  return d.toISOString().slice(0, 10);
}
const isoATexto = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const hoyTexto = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};
const fechaLarga = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
const numero = (txt: string): number | null | 'invalido' => {
  const s = txt.trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n <= 400 ? Math.round(n * 10) / 10 : 'invalido';
};

export function Trofeo({ machoId, cazado, onCambio }: { machoId: string; cazado: boolean; onCambio: () => void }) {
  const [datos, setDatos] = useState<DatosTrofeo | null>(null);
  const [modo, setModo] = useState<'ver' | 'estimada' | 'caza'>('ver');
  const [estimada, setEstimada] = useState('');
  const [sistema, setSistema] = useState<'B&C' | 'SCI'>('B&C');
  const [fecha, setFecha] = useState('');
  const [cazador, setCazador] = useState('');
  const [real, setReal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('machos_trofeo').select('*').eq('macho_id', machoId).maybeSingle();
    setDatos((data as DatosTrofeo | null) ?? null);
  }, [machoId]);
  useEffect(() => {
    let vivo = true;
    supabase
      .from('machos_trofeo')
      .select('*')
      .eq('macho_id', machoId)
      .maybeSingle()
      .then(({ data }) => vivo && setDatos((data as DatosTrofeo | null) ?? null));
    return () => {
      vivo = false;
    };
  }, [machoId]);

  function editar(m: 'estimada' | 'caza') {
    setEstimada(datos?.puntuacion_estimada?.toString() ?? '');
    setSistema(datos?.sistema ?? 'B&C');
    setFecha(isoATexto(datos?.fecha_caza ?? null) || hoyTexto());
    setCazador(datos?.cazador ?? '');
    setReal(datos?.puntuacion_real?.toString() ?? '');
    setError(null);
    setModo(m);
  }

  async function guardar(p: Record<string, unknown>) {
    setOcupado(true);
    setError(null);
    const { error: e } = await supabase.rpc('guardar_trofeo', { p_macho: machoId, p });
    setOcupado(false);
    if (e) return setError(mensajeDeError(e));
    setModo('ver');
    setConfirmarQuitar(false);
    await cargar();
    onCambio();
  }

  function guardarEstimada() {
    const n = numero(estimada);
    if (n === 'invalido') return setError('Escribe la puntuación con números (por ejemplo 148.5).');
    guardar({ puntuacion_estimada: n, sistema });
  }

  function guardarCaza() {
    const iso = fechaAIso(fecha);
    if (!iso) return setError('Escribe la fecha como día/mes/año, por ejemplo 14/11/2026.');
    if (!cazador.trim()) return setError('Escribe el nombre del cazador.');
    const r = numero(real);
    if (r === 'invalido') return setError('La puntuación real debe ser un número (por ejemplo 152).');
    guardar({ fecha_caza: iso, cazador, puntuacion_real: r, sistema });
  }

  const sis = datos?.sistema ?? 'B&C';
  return (
    <View style={estilos.bloque}>
      <View style={estilos.fila}>
        <Titulo nivel={2}>Trofeo</Titulo>
        <Text style={[tipografia.etiqueta, { color: t.acentoTexto }]}>Solo administrador</Text>
      </View>

      {modo === 'ver' ? (
        <>
          <Renglon etiqueta="Puntuación estimada" valor={datos?.puntuacion_estimada != null ? `${datos.puntuacion_estimada} ${sis}` : 'Sin estimar'} />
          {cazado ? (
            <>
              <Renglon etiqueta="Cazado" valor={datos?.fecha_caza ? fechaLarga(datos.fecha_caza) : '—'} />
              <Renglon etiqueta="Cazador" valor={datos?.cazador ?? '—'} />
              <Renglon etiqueta="Puntuación real" valor={datos?.puntuacion_real != null ? `${datos.puntuacion_real} ${sis}` : 'Pendiente de medir'} />
            </>
          ) : null}
          {error ? <Aviso>{error}</Aviso> : null}
          <Boton variante="secundario" onPress={() => editar('estimada')}>
            {datos?.puntuacion_estimada != null ? 'Cambiar puntuación estimada' : 'Estimar puntuación'}
          </Boton>
          {cazado ? (
            <>
              <Boton variante="secundario" onPress={() => editar('caza')}>
                {datos?.puntuacion_real != null ? 'Editar datos de caza' : 'Agregar puntuación real / editar caza'}
              </Boton>
              <Boton variante="peligro" cargando={ocupado && confirmarQuitar} onPress={() => (confirmarQuitar ? guardar({ fecha_caza: null }) : setConfirmarQuitar(true))}>
                {confirmarQuitar ? 'Toca otra vez: vuelve a «activo»' : 'Quitar caza (fue un error)'}
              </Boton>
            </>
          ) : (
            <Boton variante="peligro" onPress={() => editar('caza')}>
              Registrar caza
            </Boton>
          )}
        </>
      ) : null}

      {modo === 'estimada' ? (
        <>
          <Campo etiqueta="Puntuación estimada" value={estimada} onChangeText={setEstimada} placeholder="Ej. 148.5" keyboardType="decimal-pad" maxLength={6} />
          <SelectorSistema valor={sistema} onChange={setSistema} />
          {error ? <Aviso>{error}</Aviso> : null}
          <Boton onPress={guardarEstimada} cargando={ocupado}>
            Guardar
          </Boton>
          <Boton variante="secundario" onPress={() => setModo('ver')}>
            Cancelar
          </Boton>
        </>
      ) : null}

      {modo === 'caza' ? (
        <>
          <View style={{ gap: espacio.xs }}>
            <Campo etiqueta="Fecha de caza" value={fecha} onChangeText={setFecha} placeholder="día/mes/año" keyboardType="numbers-and-punctuation" maxLength={10} />
            <View style={{ flexDirection: 'row' }}>
              <Opcion activa={fecha === hoyTexto()} onPress={() => setFecha(hoyTexto())}>
                Hoy
              </Opcion>
            </View>
          </View>
          <Campo etiqueta="Cazador" value={cazador} onChangeText={setCazador} placeholder="Nombre de quien lo cazó" autoCapitalize="words" maxLength={80} />
          <Campo
            etiqueta="Puntuación real (opcional)"
            value={real}
            onChangeText={setReal}
            placeholder="Se puede agregar después de medirlo"
            keyboardType="decimal-pad"
            maxLength={6}
          />
          <SelectorSistema valor={sistema} onChange={setSistema} />
          {error ? <Aviso>{error}</Aviso> : null}
          <Boton onPress={guardarCaza} cargando={ocupado}>
            {cazado ? 'Guardar' : 'Registrar caza'}
          </Boton>
          <Boton variante="secundario" onPress={() => setModo('ver')}>
            Cancelar
          </Boton>
        </>
      ) : null}
    </View>
  );
}

function SelectorSistema({ valor, onChange }: { valor: 'B&C' | 'SCI'; onChange: (v: 'B&C' | 'SCI') => void }) {
  return (
    <View style={{ gap: espacio.xs }}>
      <Etiqueta>Sistema de puntuación</Etiqueta>
      <View style={{ flexDirection: 'row', gap: espacio.s }}>
        <Opcion activa={valor === 'B&C'} onPress={() => onChange('B&C')}>
          Boone and Crockett
        </Opcion>
        <Opcion activa={valor === 'SCI'} onPress={() => onChange('SCI')}>
          SCI
        </Opcion>
      </View>
    </View>
  );
}

function Renglon({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={{ gap: espacio.xxs }}>
      <Etiqueta>{etiqueta}</Etiqueta>
      <Text style={[tipografia.cuerpoFuerte, { color: t.texto }]}>{valor}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  bloque: { gap: espacio.m, padding: espacio.l, borderWidth: borde.medio, borderColor: t.acento, borderRadius: radio.m, backgroundColor: t.superficie },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
