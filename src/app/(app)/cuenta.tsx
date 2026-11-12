import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Aviso, Boton, Campo, Encabezado, Etiqueta, Titulo } from '../../components/consulta';
import { esAppInstalada } from '../../lib/enlaces';
import { useSesion } from '../../lib/sesion';
import { mensajeDeError, supabase } from '../../lib/supabase';
import { espacio, temas, tipografia } from '../../theme';

const t = temas.consulta;
const nombreRol = { admin: 'Administrador', staff: 'Personal', invitado: 'Invitado' } as const;

export default function Cuenta() {
  const { perfil, salir } = useSesion();
  const [nueva, setNueva] = useState('');
  const [aviso, setAviso] = useState<{ tono: 'exito' | 'error'; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  if (!perfil) return null;

  async function cambiarContrasena() {
    setGuardando(true);
    setAviso(null);
    const { error } = await supabase.auth.updateUser({ password: nueva });
    setGuardando(false);
    if (error) return setAviso({ tono: 'error', texto: mensajeDeError(error) });
    setNueva('');
    setAviso({ tono: 'exito', texto: 'Contraseña actualizada.' });
  }
  return (
    <View style={estilos.raiz}>
      <Encabezado />
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Titulo>{perfil.nombre}</Titulo>
        <View style={{ gap: espacio.xs }}>
          <Etiqueta>Rol</Etiqueta>
          <Text style={[tipografia.cuerpo, { color: t.texto }]}>{nombreRol[perfil.rol]}</Text>
        </View>
        {perfil.expira_en ? (
          <View style={{ gap: espacio.xs }}>
            <Etiqueta>Acceso vigente hasta</Etiqueta>
            <Text style={[tipografia.cuerpo, { color: t.texto }]}>
              {new Date(perfil.expira_en).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
            </Text>
          </View>
        ) : null}
        {perfil.rol !== 'invitado' ? (
          <View style={{ gap: espacio.m }}>
            <Campo
              etiqueta="Nueva contraseña"
              value={nueva}
              onChangeText={setNueva}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              ayuda="Mínimo 8 caracteres."
            />
            {aviso ? <Aviso tono={aviso.tono}>{aviso.texto}</Aviso> : null}
            <Boton variante="secundario" onPress={cambiarContrasena} deshabilitado={nueva.length < 8} cargando={guardando}>
              Cambiar contraseña
            </Boton>
          </View>
        ) : null}
        {!esAppInstalada() ? (
          <View style={estilos.instalar}>
            <Etiqueta>Tenerla como app en el iPhone</Etiqueta>
            <Text style={[tipografia.cuerpo, { color: t.texto }]}>
              1. Abre esta página en Safari.{'\n'}2. Toca el botón Compartir (cuadro con flecha hacia arriba).{'\n'}3. Elige «Agregar a pantalla de inicio».
            </Text>
            <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>
              Así abre a pantalla completa, funciona mejor sin señal y puede recibir avisos de inicio de censo.
            </Text>
          </View>
        ) : null}
        <Boton
          variante="peligro"
          onPress={async () => {
            await salir();
          }}
        >
          Cerrar sesión
        </Boton>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: t.fondo },
  contenido: { padding: espacio.xl, gap: espacio.xl },
  instalar: { gap: espacio.s, padding: espacio.l, borderWidth: 1, borderColor: t.acento, borderRadius: 8, backgroundColor: t.superficie },
});
