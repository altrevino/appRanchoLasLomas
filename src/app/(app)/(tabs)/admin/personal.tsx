/**
 * Personal del rancho (admin): alta, rol, contraseña nueva, desactivar.
 * Usa la función del servidor admin-usuarios (necesita la llave secreta).
 */
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Aviso, Boton, Campo, Chip, Encabezado, Etiqueta, Opcion, Titulo } from '../../../../components/consulta';
import { supabase } from '../../../../lib/supabase';
import { borde, espacio, radio, temas, tipografia } from '../../../../theme';

const t = temas.consulta;

interface Persona {
  id: string;
  nombre: string;
  correo: string;
  rol: 'admin' | 'staff';
  activo: boolean;
  ultimo_acceso: string | null;
  soy_yo: boolean;
}

async function llamar<T>(cuerpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-usuarios', { body: cuerpo });
  if (error) {
    // El mensaje útil viene en el cuerpo de la respuesta
    const ctx = (error as { context?: Response }).context;
    const msg = ctx ? await ctx.json().then((j) => j.error).catch(() => null) : null;
    throw new Error(msg ?? 'No se pudo completar. Revisa la señal.');
  }
  return data as T;
}

const nombreRol = { admin: 'Administrador', staff: 'Personal' } as const;

export default function Personal() {
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [rol, setRol] = useState<'staff' | 'admin'>('staff');
  const [creando, setCreando] = useState(false);
  const [credencial, setCredencial] = useState<{ nombre: string; correo: string; contrasena: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(() => {
    llamar<{ personal: Persona[] }>({ accion: 'listar' })
      .then((r) => {
        setPersonas(r.personal);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function crear() {
    setCreando(true);
    setError(null);
    try {
      const r = await llamar<{ contrasena: string }>({ accion: 'crear', nombre, correo, rol });
      setCredencial({ nombre: nombre.trim(), correo: correo.trim().toLowerCase(), contrasena: r.contrasena });
      setCopiado(false);
      setNombre('');
      setCorreo('');
      setRol('staff');
      cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreando(false);
    }
  }

  async function accion(p: Persona, tipo: 'rol' | 'contrasena' | 'activo') {
    const clave = `${tipo}-${p.id}`;
    if (tipo !== 'contrasena' && confirmar !== clave) return setConfirmar(clave);
    setConfirmar(null);
    setOcupado(clave);
    setError(null);
    try {
      if (tipo === 'rol') await llamar({ accion: 'rol', id: p.id, rol: p.rol === 'admin' ? 'staff' : 'admin' });
      if (tipo === 'activo') await llamar({ accion: 'activo', id: p.id, activo: !p.activo });
      if (tipo === 'contrasena') {
        const r = await llamar<{ contrasena: string }>({ accion: 'contrasena', id: p.id });
        setCredencial({ nombre: p.nombre, correo: p.correo, contrasena: r.contrasena });
        setCopiado(false);
      }
      cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim());

  return (
    <View style={estilos.raiz}>
      <Encabezado />
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <Titulo>Personal</Titulo>
        <Text style={[tipografia.cuerpo, { color: t.textoSecundario }]}>
          Cuentas permanentes del rancho. Los invitados no van aquí: entran con código desde «Invitados y códigos».
        </Text>

        {credencial ? (
          <View style={estilos.credencial}>
            <Etiqueta>Datos para entrar</Etiqueta>
            <Text style={[tipografia.cuerpoFuerte, { color: t.texto }]}>{credencial.nombre}</Text>
            <Text style={[tipografia.cuerpo, { color: t.texto }]} selectable>
              {credencial.correo}
            </Text>
            <Text style={estilos.contrasena} selectable accessibilityLabel={`Contraseña ${credencial.contrasena.split('').join(' ')}`}>
              {credencial.contrasena}
            </Text>
            <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>
              Entra en app.rancholaslomas.com.mx → Personal del rancho. Puede cambiar la contraseña tocando su nombre arriba a la derecha.
            </Text>
            <Boton
              variante="secundario"
              onPress={async () => {
                await Clipboard.setStringAsync(
                  `Rancho Las Lomas\nhttps://app.rancholaslomas.com.mx\nCorreo: ${credencial.correo}\nContraseña: ${credencial.contrasena}`,
                );
                setCopiado(true);
              }}
            >
              {copiado ? 'Copiado' : 'Copiar para enviar por mensaje'}
            </Boton>
            <Boton variante="secundario" onPress={() => setCredencial(null)}>
              Listo
            </Boton>
          </View>
        ) : null}

        {error ? <Aviso>{error}</Aviso> : null}

        <View style={estilos.bloque}>
          <Titulo nivel={2}>Agregar persona</Titulo>
          <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} placeholder="Ej. Juan Pérez" autoCapitalize="words" maxLength={60} />
          <Campo etiqueta="Correo" value={correo} onChangeText={setCorreo} placeholder="nombre@correo.com" keyboardType="email-address" autoCapitalize="none" />
          <Etiqueta>Rol</Etiqueta>
          <View style={estilos.opciones}>
            <Opcion activa={rol === 'staff'} onPress={() => setRol('staff')}>
              Personal
            </Opcion>
            <Opcion activa={rol === 'admin'} onPress={() => setRol('admin')}>
              Administrador
            </Opcion>
          </View>
          <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>
            {rol === 'staff'
              ? 'Personal: captura censos, ve el conteo en vivo, la bitácora y los avistamientos.'
              : 'Administrador: además crea censos, invita, importa el KML, valida ejemplares y administra al personal.'}
          </Text>
          <Boton onPress={crear} cargando={creando} deshabilitado={nombre.trim().length < 2 || !correoValido}>
            Agregar
          </Boton>
        </View>

        <View style={{ gap: espacio.s }}>
          {personas === null && !error ? <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>Cargando…</Text> : null}
          {(personas ?? []).map((p) => (
            <View key={p.id} style={[estilos.persona, !p.activo && { opacity: 0.6 }]}>
              <View style={estilos.fila}>
                <Text style={[tipografia.cuerpoFuerte, { color: t.texto, flex: 1 }]}>
                  {p.nombre}
                  {p.soy_yo ? ' (tú)' : ''}
                </Text>
                <Chip tono={p.activo ? (p.rol === 'admin' ? 'neutro' : 'exito') : 'error'}>{p.activo ? nombreRol[p.rol] : 'Desactivado'}</Chip>
              </View>
              <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>
                {p.correo}
                {p.ultimo_acceso
                  ? ` · último acceso ${new Date(p.ultimo_acceso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`
                  : ' · aún no entra'}
              </Text>
              {!p.soy_yo ? (
                <View style={estilos.acciones}>
                  <Opcion activa={false} onPress={() => accion(p, 'contrasena')}>
                    {ocupado === `contrasena-${p.id}` ? '…' : 'Nueva contraseña'}
                  </Opcion>
                  {p.activo ? (
                    <Opcion activa={confirmar === `rol-${p.id}`} onPress={() => accion(p, 'rol')}>
                      {confirmar === `rol-${p.id}` ? '¿Seguro?' : p.rol === 'admin' ? 'Hacer personal' : 'Hacer administrador'}
                    </Opcion>
                  ) : null}
                  <Opcion activa={confirmar === `activo-${p.id}`} onPress={() => accion(p, 'activo')}>
                    {confirmar === `activo-${p.id}` ? '¿Seguro?' : p.activo ? 'Desactivar' : 'Reactivar'}
                  </Opcion>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: t.fondo },
  contenido: { padding: espacio.l, gap: espacio.l, paddingBottom: espacio.xxxl },
  bloque: { gap: espacio.m, padding: espacio.l, borderWidth: borde.fino, borderColor: t.borde, borderRadius: radio.m, backgroundColor: t.superficie },
  credencial: { gap: espacio.s, padding: espacio.l, borderWidth: borde.fino, borderColor: t.acento, borderRadius: radio.m, backgroundColor: t.superficie },
  contrasena: { fontSize: 28, fontWeight: '700', letterSpacing: 2, color: t.titulo, fontVariant: ['tabular-nums'] },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  persona: { gap: espacio.xs, padding: espacio.m, borderWidth: borde.fino, borderColor: t.borde, borderRadius: radio.m, backgroundColor: t.superficie },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s, marginTop: espacio.xs },
});
