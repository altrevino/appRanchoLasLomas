import { Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { BotonCuenta } from '../../../components/BotonCuenta';
import { Encabezado, Titulo } from '../../../components/consulta';
import { esStaff, useSesion } from '../../../lib/sesion';
import { espacio, temas, tipografia } from '../../../theme';

const t = temas.consulta;

/** Se construye en la fase (c). Solo admin y staff. */
export default function Bitacora() {
  const { perfil } = useSesion();
  if (!esStaff(perfil)) return <Redirect href="/mapa" />;
  return (
    <View style={estilos.raiz}>
      <Encabezado atras={false} derecha={<BotonCuenta />} />
      <View style={estilos.contenido}>
        <Titulo>Bitácora</Titulo>
        <Text style={[tipografia.cuerpo, { color: t.textoSecundario }]}>Aún no hay ejemplares registrados.</Text>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: t.fondo },
  contenido: { padding: espacio.xl, gap: espacio.l },
});
