/**
 * MUESTRA del modo consulta: ficha de ejemplar tipo "tarjeta de trofeo".
 * Datos ficticios; en la fase (c) se conecta a Supabase.
 */
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CabezaVenado } from '../../components/CabezaVenado';
import { Boton, Chip, Encabezado, Etiqueta, Filete, Titulo } from '../../components/consulta';
import { borde, espacio, radio, temas, tipografia } from '../../theme';

const t = temas.consulta;

const ejemplar = {
  folio: 'LL-014',
  apodo: 'El Chueco',
  clase: 'M3',
  estado: 'Activo',
  ultimoRegistro: 'Hace 6 días · Espiadero La Noria',
  rasgos: [
    ['Puntas', '5 izq · 4 der'],
    ['Cornamenta', 'Abierta'],
    ['Anomalías', 'Punta extra en la base del cuerno derecho'],
    ['Cuerno roto', 'No'],
    ['Marcas', 'Oreja izquierda con muesca'],
  ],
  vistoEn: ['La Noria', 'El Mezquite', 'Loma Alta'],
  historial: [
    { fecha: '30 oct 2026', texto: 'Avistamiento · La Noria · M3', por: 'Juan P.' },
    { fecha: '12 oct 2026', texto: 'Avistamiento · El Mezquite · M3', por: 'Admin' },
    { fecha: '02 sep 2026', texto: 'Cambio de clase M2 → M3', por: 'Admin' },
    { fecha: '18 dic 2025', texto: 'Ficha creada · Loma Alta · M2', por: 'Juan P.' },
  ],
};

export default function FichaMuestra() {
  return (
    <View style={estilos.raiz}>
      <StatusBar style={t.barraEstado} />
      <Encabezado />
      <ScrollView contentContainerStyle={estilos.contenido}>
        {/* Tarjeta de trofeo */}
        <View style={estilos.tarjeta}>
          <View style={estilos.foto} accessibilityLabel="Foto principal del ejemplar">
            <CabezaVenado tamano={96} color={t.acento} />
            <Text style={[tipografia.secundario, { color: t.textoSobrePrimario, opacity: 0.8 }]}>
              Foto principal
            </Text>
          </View>
          <View style={estilos.placa}>
            <View style={estilos.placaFila}>
              <Text style={[tipografia.display, { color: t.titulo }]}>{ejemplar.folio}</Text>
              <View style={estilos.clase}>
                <Text style={[tipografia.titulo1, { color: t.textoSobrePrimario }]}>{ejemplar.clase}</Text>
              </View>
            </View>
            <Text style={[tipografia.cuerpoFuerte, { color: t.texto }]}>“{ejemplar.apodo}”</Text>
            <Filete style={{ marginVertical: espacio.s }} />
            <View style={estilos.placaFila}>
              <Chip tono="exito">{ejemplar.estado}</Chip>
              <Text style={[tipografia.secundario, { color: t.textoSecundario, flexShrink: 1, textAlign: 'right' }]}>
                {ejemplar.ultimoRegistro}
              </Text>
            </View>
          </View>
        </View>

        {/* Galería */}
        <View style={estilos.seccion}>
          <Titulo nivel={2}>Galería</Titulo>
          <View style={estilos.galeria}>
            {['30 oct', '12 oct', '02 sep', '18 dic'].map((f) => (
              <View key={f} style={estilos.miniatura}>
                <Text style={[tipografia.secundario, { color: t.textoSobrePrimario }]}>{f}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Rasgos */}
        <View style={estilos.seccion}>
          <Titulo nivel={2}>Rasgos distintivos</Titulo>
          <View style={estilos.bloque}>
            {ejemplar.rasgos.map(([k, v], i) => (
              <View key={k} style={[estilos.rasgo, i > 0 && estilos.rasgoBorde]}>
                <Etiqueta>{k}</Etiqueta>
                <Text style={[tipografia.cuerpo, { color: t.texto }]}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Visto en */}
        <View style={estilos.seccion}>
          <Titulo nivel={2}>Visto en</Titulo>
          <View style={estilos.chips}>
            {ejemplar.vistoEn.map((e) => (
              <Chip key={e}>{e}</Chip>
            ))}
          </View>
        </View>

        {/* Historial */}
        <View style={estilos.seccion}>
          <Titulo nivel={2}>Historial</Titulo>
          <View style={estilos.bloque}>
            {ejemplar.historial.map((h, i) => (
              <View key={h.fecha + h.texto} style={[estilos.rasgo, i > 0 && estilos.rasgoBorde]}>
                <Text style={[tipografia.secundario, { color: t.acentoTexto, fontWeight: '600' }]}>{h.fecha}</Text>
                <Text style={[tipografia.cuerpo, { color: t.texto }]}>{h.texto}</Text>
                <Text style={[tipografia.secundario, { color: t.textoSecundario }]}>Registró: {h.por}</Text>
              </View>
            ))}
          </View>
        </View>

        <Boton>Registrar avistamiento</Boton>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: t.fondo },
  contenido: { padding: espacio.l, gap: espacio.xl, paddingBottom: espacio.xxxl },
  tarjeta: {
    backgroundColor: t.superficie,
    borderWidth: borde.fino,
    borderColor: t.acento,
    borderRadius: radio.m,
    overflow: 'hidden',
  },
  foto: {
    aspectRatio: 4 / 3,
    backgroundColor: t.primario,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.s,
  },
  placa: { padding: espacio.l, gap: espacio.xs },
  placaFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m },
  clase: {
    backgroundColor: t.primario,
    borderRadius: radio.s,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.xs,
    borderWidth: borde.medio,
    borderColor: t.acento,
  },
  seccion: { gap: espacio.m },
  galeria: { flexDirection: 'row', gap: espacio.s },
  miniatura: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: t.primario,
    borderRadius: radio.s,
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: espacio.xs,
  },
  bloque: {
    backgroundColor: t.superficie,
    borderWidth: borde.fino,
    borderColor: t.borde,
    borderRadius: radio.m,
  },
  rasgo: { paddingHorizontal: espacio.l, paddingVertical: espacio.m, gap: espacio.xxs },
  rasgoBorde: { borderTopWidth: borde.fino, borderTopColor: t.borde },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
});
