import { Stack } from 'expo-router';
import { temas } from '../../theme';

export default function LayoutAcceso() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: temas.consulta.fondo } }} />;
}
