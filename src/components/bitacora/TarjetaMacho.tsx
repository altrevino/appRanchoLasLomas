import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NOMBRE_ESTADO, type Macho } from '../../lib/bitacora/tipos';
import { borde, espacio, radio, temas, tipografia } from '../../theme';
import { Chip } from '../consulta';
import { FotoMacho } from './FotoMacho';

const t = temas.consulta;

export function haceDias(iso: string | null): string {
  if (!iso) return 'sin avistamientos';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`;
}

export const tonoEstado = (e: Macho['estado_efectivo']) =>
  e === 'activo' ? 'exito' : e === 'por_validar' ? 'alerta' : e === 'cazado' ? 'neutro' : e === 'sin_ver' ? 'error' : 'neutro';

export function TarjetaMacho({ macho, url, onPress, derecha }: { macho: Macho; url?: string; onPress?: () => void; derecha?: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} style={({ pressed }) => [estilos.tarjeta, pressed && { backgroundColor: t.superficieActiva }]}>
      <FotoMacho url={url} style={estilos.foto} tamanoIcono={36} />
      <View style={{ flex: 1, gap: espacio.xxs }}>
        <View style={estilos.arriba}>
          <Text style={[tipografia.titulo2, { color: t.titulo }]}>{macho.folio}</Text>
          <View style={estilos.clase}>
            <Text style={[tipografia.cuerpoFuerte, { color: t.textoSobrePrimario }]}>{macho.clase_actual}</Text>
          </View>
        </View>
        {macho.apodo ? <Text style={[tipografia.cuerpoFuerte, { color: t.texto }]}>“{macho.apodo}”</Text> : null}
        <Text style={[tipografia.secundario, { color: t.textoSecundario }]} numberOfLines={1}>
          {haceDias(macho.ultimo_avistamiento_at)}
          {macho.ultimo_espiadero_nombre ? ` · ${macho.ultimo_espiadero_nombre}` : ''}
        </Text>
        {derecha ?? (
          <View style={{ flexDirection: 'row' }}>
            <Chip tono={tonoEstado(macho.estado_efectivo)}>{NOMBRE_ESTADO[macho.estado_efectivo]}</Chip>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    flexDirection: 'row',
    gap: espacio.m,
    padding: espacio.m,
    backgroundColor: t.superficie,
    borderWidth: borde.fino,
    borderColor: t.borde,
    borderRadius: radio.m,
  },
  foto: { width: 88, height: 88, borderRadius: radio.s },
  arriba: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.s },
  clase: { backgroundColor: t.primario, borderRadius: radio.s, paddingHorizontal: espacio.s, paddingVertical: 2, borderWidth: 1, borderColor: t.acento },
});
