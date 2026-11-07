import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { useSesion } from '../lib/sesion';
import { temas, tipografia } from '../theme';

/** Nombre del usuario en el encabezado; abre la pantalla de cuenta. */
export function BotonCuenta() {
  const { perfil } = useSesion();
  if (!perfil) return null;
  const primerNombre = perfil.nombre.split(' ')[0];
  return (
    <Pressable onPress={() => router.push('/cuenta')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Mi cuenta">
      <Text style={[tipografia.secundario, { color: temas.consulta.primario, fontWeight: '600' }]} numberOfLines={1}>
        {primerNombre}
      </Text>
    </Pressable>
  );
}
