/**
 * Pantalla temporal de la fase de aprobación de diseño. Se reemplaza por el
 * inicio/login real en la fase (a).
 */
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CabezaVenado } from '../components/CabezaVenado';
import { Boton, Filete, Titulo } from '../components/consulta';
import { espacio, temas, tipografia } from '../theme';

const t = temas.consulta;

export default function Inicio() {
  return (
    <SafeAreaView style={estilos.raiz}>
      <StatusBar style={t.barraEstado} />
      <View style={estilos.logo}>
        {/* Marcador de posición del logotipo completo */}
        <CabezaVenado tamano={120} color={t.primario} />
        <Titulo nivel={0} centrado>RANCHO LAS LOMAS</Titulo>
        <Filete style={{ width: 120 }} />
      </View>
      <View style={estilos.acciones}>
        <Text style={[tipografia.secundario, { color: t.textoSecundario, textAlign: 'center' }]}>
          Pantallas de muestra para aprobación
        </Text>
        <Boton onPress={() => router.push('/muestras/ficha')}>Modo consulta: ficha de ejemplar</Boton>
        <Boton variante="secundario" onPress={() => router.push('/muestras/captura')}>
          Modo campo: captura de censo
        </Boton>
      </View>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: t.fondo, padding: espacio.xl, justifyContent: 'space-between' },
  logo: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: espacio.l },
  acciones: { gap: espacio.m, paddingBottom: espacio.l },
});
