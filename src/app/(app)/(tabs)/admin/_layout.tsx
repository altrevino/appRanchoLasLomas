import { Redirect, Stack } from 'expo-router';
import { esAdmin, useSesion } from '../../../../lib/sesion';
import { temas } from '../../../../theme';

export default function LayoutAdmin() {
  const { perfil } = useSesion();
  if (!esAdmin(perfil)) return <Redirect href="/mapa" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: temas.consulta.fondo } }} />;
}
