import { StyleSheet, Text, View } from 'react-native';
import { BotonCuenta } from '../../components/BotonCuenta';
import { Encabezado, Titulo } from '../../components/consulta';
import { espacio, temas, tipografia } from '../../theme';

const t = temas.consulta;

/** Se construye en la fase (b). */
export default function Censo() {
  return (
    <View style={estilos.raiz}>
      <Encabezado atras={false} derecha={<BotonCuenta />} />
      <View style={estilos.contenido}>
        <Titulo>Censo</Titulo>
        <Text style={[tipografia.cuerpo, { color: t.textoSecundario }]}>
          No hay ningún censo en curso. Cuando el administrador inicie uno, te llegará un aviso y entrarás directo a la captura.
        </Text>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: t.fondo },
  contenido: { padding: espacio.xl, gap: espacio.l },
});
