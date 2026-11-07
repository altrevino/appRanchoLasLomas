import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aviso, Boton } from '../../components/consulta';
import { LogoCompleto } from '../../components/logo';
import { useSesion } from '../../lib/sesion';
import { supabaseConfigurado } from '../../lib/supabase';
import { espacio, temas } from '../../theme';

const t = temas.consulta;

export default function Inicio() {
  const { avisoAcceso } = useSesion();
  return (
    <SafeAreaView style={estilos.raiz}>
      <StatusBar style={t.barraEstado} />
      <View style={estilos.logo}>
        <LogoCompleto ancho={320} />
      </View>
      <View style={estilos.acciones}>
        {!supabaseConfigurado ? (
          <Aviso>Falta configurar el servidor (EXPO_PUBLIC_SUPABASE_URL). Ver README.</Aviso>
        ) : null}
        {avisoAcceso ? <Aviso tono="alerta">{avisoAcceso}</Aviso> : null}
        <Boton onPress={() => router.push('/acceso/invitado')}>Soy invitado</Boton>
        <Boton variante="secundario" onPress={() => router.push('/acceso/personal')}>
          Personal del rancho
        </Boton>
      </View>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: t.fondo, padding: espacio.xl },
  logo: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  acciones: { gap: espacio.m, paddingBottom: espacio.l },
});
