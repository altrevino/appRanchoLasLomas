import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BotonCuenta } from '../../../../components/BotonCuenta';
import { Encabezado, Fila, Titulo } from '../../../../components/consulta';
import { borde, espacio, radio, temas } from '../../../../theme';

const t = temas.consulta;

export default function Admin() {
  return (
    <View style={estilos.raiz}>
      <Encabezado atras={false} derecha={<BotonCuenta />} />
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Titulo>Administración</Titulo>
        <View style={estilos.lista}>
          <Fila titulo="Invitados y códigos" detalle="Generar código o QR, ver y revocar accesos" onPress={() => router.push('/admin/codigos')} />
          <Fila titulo="Espiaderos" detalle="Nombre y radio de detección" onPress={() => router.push('/admin/espiaderos')} />
          <Fila titulo="Importar KML" detalle="Lindero, caminos y espiaderos del rancho" onPress={() => router.push('/admin/importar')} />
        </View>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: t.fondo },
  contenido: { padding: espacio.l, gap: espacio.l },
  lista: { borderWidth: borde.fino, borderColor: t.borde, borderRadius: radio.m, overflow: 'hidden' },
});
