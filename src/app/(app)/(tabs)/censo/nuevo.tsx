/**
 * Nuevo censo (admin): nombre, duración, espiaderos participantes y asignación opcional.
 */
import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Aviso, Boton, Campo, Encabezado, Etiqueta, Opcion, Titulo } from '../../../../components/consulta';
import { enviarAvisoInicio } from '../../../../lib/censo/avisos';
import { useDatosMapa } from '../../../../lib/mapa/datos';
import { esAdmin, useSesion } from '../../../../lib/sesion';
import { mensajeDeError, supabase } from '../../../../lib/supabase';
import { borde, espacio, radio, tamanos, temas, tipografia } from '../../../../theme';

const t = temas.consulta;
const DURACIONES = [10, 15, 20, 30, 45];

interface Persona {
  id: string;
  nombre: string;
  rol: string;
}

const nombreInicial = () =>
  'Censo ' + new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) + (new Date().getHours() < 12 ? ' mañana' : ' tarde');

export default function NuevoCenso() {
  const { perfil } = useSesion();
  const { datos } = useDatosMapa();
  const espiaderos = useMemo(() => datos?.espiaderos ?? [], [datos]);
  const [nombre, setNombre] = useState(nombreInicial);
  const [duracion, setDuracion] = useState(20);
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set());
  const [asignaciones, setAsignaciones] = useState<Record<string, string>>({});
  const [asignando, setAsignando] = useState<string | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<'iniciar' | 'guardar' | null>(null);

  useEffect(() => {
    supabase
      .from('perfiles')
      .select('id, nombre, rol, expira_en')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) =>
        setPersonas(((data ?? []) as (Persona & { expira_en: string | null })[]).filter((p) => !p.expira_en || new Date(p.expira_en) > new Date())),
      );
  }, []);

  if (!esAdmin(perfil)) return <Redirect href="/censo" />;

  const participantes = espiaderos.filter((e) => !excluidos.has(e.id));
  const alternar = (id: string) =>
    setExcluidos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function guardar(iniciarYa: boolean) {
    setError(null);
    setOcupado(iniciarYa ? 'iniciar' : 'guardar');
    const asign = Object.fromEntries(Object.entries(asignaciones).filter(([e]) => !excluidos.has(e)));
    const { data, error: e } = await supabase.rpc('crear_censo', {
      p_nombre: nombre,
      p_duracion_min: duracion,
      p_espiaderos: participantes.map((x) => x.id),
      p_asignaciones: asign,
    });
    if (e || !data) {
      setOcupado(null);
      return setError(mensajeDeError(e));
    }
    const id = (data as { id: string }).id;
    if (!iniciarYa) {
      setOcupado(null);
      return router.back();
    }
    const r = await supabase.rpc('iniciar_censo', { p_id: id });
    if (r.error) {
      setOcupado(null);
      return setError(mensajeDeError(r.error));
    }
    await enviarAvisoInicio(id);
    setOcupado(null);
    router.replace({ pathname: '/censo/[id]', params: { id } });
  }

  return (
    <View style={estilos.raiz}>
      <Encabezado />
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <Titulo>Nuevo censo</Titulo>
        <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} maxLength={80} />

        <View style={{ gap: espacio.s }}>
          <Etiqueta>Duración</Etiqueta>
          <View style={estilos.opciones}>
            {DURACIONES.map((d) => (
              <Opcion key={d} activa={duracion === d} onPress={() => setDuracion(d)}>
                {`${d} min`}
              </Opcion>
            ))}
          </View>
        </View>

        <View style={{ gap: espacio.s }}>
          <Etiqueta>{`Espiaderos participantes (${participantes.length} de ${espiaderos.length})`}</Etiqueta>
          <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>
            Toca un espiadero para quitarlo o incluirlo. «Asignar» es opcional: indica quién va en cada uno.
          </Text>
          <View style={estilos.lista}>
            {espiaderos.map((e) => {
              const incluido = !excluidos.has(e.id);
              const asignado = personas.find((p) => p.id === asignaciones[e.id]);
              return (
                <View key={e.id} style={estilos.fila}>
                  <View style={estilos.filaArriba}>
                    <Pressable
                      onPress={() => alternar(e.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: incluido }}
                      style={estilos.marca}
                      hitSlop={6}
                    >
                      <View style={[estilos.casilla, incluido && { backgroundColor: t.primario, borderColor: t.primario }]}>
                        {incluido ? <Text style={{ color: t.textoSobrePrimario, fontWeight: '700' }}>✓</Text> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[tipografia.cuerpoFuerte, { color: incluido ? t.texto : t.textoSecundario }]}>{e.nombre}</Text>
                        {asignado && incluido ? (
                          <Text style={[tipografia.secundario, { color: t.acentoTexto }]}>{asignado.nombre}</Text>
                        ) : null}
                      </View>
                    </Pressable>
                    {incluido ? (
                      <Pressable onPress={() => setAsignando(asignando === e.id ? null : e.id)} hitSlop={8} accessibilityRole="button">
                        <Text style={[tipografia.secundario, { color: t.primario, fontWeight: '600' }]}>{asignando === e.id ? 'Listo' : 'Asignar'}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {asignando === e.id ? (
                    <View style={estilos.opciones}>
                      <Opcion
                        activa={!asignaciones[e.id]}
                        onPress={() =>
                          setAsignaciones((a) => {
                            const n = { ...a };
                            delete n[e.id];
                            return n;
                          })
                        }
                      >
                        Nadie
                      </Opcion>
                      {personas.map((p) => (
                        <Opcion key={p.id} activa={asignaciones[e.id] === p.id} onPress={() => setAsignaciones((a) => ({ ...a, [e.id]: p.id }))}>
                          {p.nombre}
                        </Opcion>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        {error ? <Aviso>{error}</Aviso> : null}
        <Boton onPress={() => guardar(true)} cargando={ocupado === 'iniciar'} deshabilitado={!nombre.trim() || !participantes.length || !!ocupado}>
          Iniciar ahora
        </Boton>
        <Text style={[tipografia.secundario, { color: t.textoSecundario, textAlign: 'center' }]}>
          Al iniciar, el servidor fija la hora de inicio y fin y se avisa a todos.
        </Text>
        <Boton variante="secundario" onPress={() => guardar(false)} cargando={ocupado === 'guardar'} deshabilitado={!nombre.trim() || !participantes.length || !!ocupado}>
          Guardar para después
        </Boton>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: t.fondo },
  contenido: { padding: espacio.l, gap: espacio.l, paddingBottom: espacio.xxxl },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  lista: { borderWidth: borde.fino, borderColor: t.borde, borderRadius: radio.m, overflow: 'hidden' },
  fila: { padding: espacio.m, gap: espacio.m, backgroundColor: t.superficie, borderBottomWidth: borde.fino, borderBottomColor: t.borde },
  filaArriba: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  marca: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espacio.m, minHeight: tamanos.toqueMinimo },
  casilla: {
    width: 28,
    height: 28,
    borderRadius: radio.s,
    borderWidth: borde.medio,
    borderColor: t.borde,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
