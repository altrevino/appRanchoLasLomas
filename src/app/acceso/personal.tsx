import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { Aviso, Boton, Campo, Encabezado, Titulo } from '../../components/consulta';
import { useSesion } from '../../lib/sesion';
import { espacio, temas, tipografia } from '../../theme';

const t = temas.consulta;

export default function AccesoPersonal() {
  const { entrarPersonal } = useSesion();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar() {
    setError(null);
    setEnviando(true);
    try {
      await entrarPersonal(correo, contrasena);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={estilos.raiz} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style={t.barraEstado} />
      <Encabezado />
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <Titulo>Personal</Titulo>
        <Text style={[tipografia.cuerpo, { color: t.textoSecundario }]}>Entra con el correo que te dio de alta el administrador.</Text>
        <Campo
          etiqueta="Correo"
          value={correo}
          onChangeText={setCorreo}
          placeholder="nombre@correo.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="username"
        />
        <Campo
          etiqueta="Contraseña"
          value={contrasena}
          onChangeText={setContrasena}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          onSubmitEditing={entrar}
        />
        {error ? <Aviso>{error}</Aviso> : null}
        <Boton onPress={entrar} deshabilitado={!correo.includes('@') || contrasena.length < 6} cargando={enviando}>
          Entrar
        </Boton>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: t.fondo },
  contenido: { padding: espacio.xl, gap: espacio.l },
});
