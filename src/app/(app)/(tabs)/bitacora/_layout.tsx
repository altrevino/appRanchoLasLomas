import { Redirect, Stack } from 'expo-router';
import { puedeVerBitacora, useSesion } from '../../../../lib/sesion';
import { temas } from '../../../../theme';

/** Bitácora: personal e invitados con permiso. */
export default function LayoutBitacora() {
  const { perfil } = useSesion();
  if (!puedeVerBitacora(perfil)) return <Redirect href="/mapa" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: temas.consulta.fondo } }} />;
}
