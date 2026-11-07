/**
 * Acceso de invitado: nombre + código de 6 dígitos. Sin cuenta.
 * El QR que genera el admin abre esta pantalla con el código ya escrito:
 *   rancholaslomas://acceso/invitado?codigo=123456
 */
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { Aviso, Boton, Campo, Encabezado, Titulo } from '../../components/consulta';
import { useSesion } from '../../lib/sesion';
import { espacio, temas, tipografia } from '../../theme';

const t = temas.consulta;

export default function AccesoInvitado() {
  const { codigo: codigoQr } = useLocalSearchParams<{ codigo?: string }>();
  const { entrarInvitado } = useSesion();
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState((codigoQr ?? '').replace(/\D/g, '').slice(0, 6));
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const valido = nombre.trim().length >= 2 && /^\d{6}$/.test(codigo);

  async function entrar() {
    setError(null);
    setEnviando(true);
    try {
      await entrarInvitado(nombre, codigo);
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
        <Titulo>Bienvenido</Titulo>
        <Text style={[tipografia.cuerpo, { color: t.textoSecundario }]}>
          Escribe tu nombre y el código que te dio el administrador.
        </Text>
        <Campo
          etiqueta="Tu nombre"
          value={nombre}
          onChangeText={setNombre}
          placeholder="Ej. Pedro Garza"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          maxLength={60}
        />
        <Campo
          etiqueta="Código"
          value={codigo}
          onChangeText={(v) => setCodigo(v.replace(/\D/g, '').slice(0, 6))}
          placeholder="6 dígitos"
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          maxLength={6}
          style={estilos.codigo}
        />
        {error ? <Aviso>{error}</Aviso> : null}
        <Boton onPress={entrar} deshabilitado={!valido} cargando={enviando}>
          Entrar
        </Boton>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: t.fondo },
  contenido: { padding: espacio.xl, gap: espacio.l },
  codigo: { fontSize: 28, letterSpacing: 8, fontVariant: ['tabular-nums'], textAlign: 'center' },
});
