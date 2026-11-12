import { Redirect, Stack } from 'expo-router';
import { esStaff, useSesion } from '../../../../lib/sesion';
import { temas } from '../../../../theme';

/** Bitácora: solo administrador y personal. */
export default function LayoutBitacora() {
  const { perfil } = useSesion();
  if (!esStaff(perfil)) return <Redirect href="/mapa" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: temas.consulta.fondo } }} />;
}
