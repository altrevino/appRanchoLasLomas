import { Redirect } from 'expo-router';
import { useSesion } from '../lib/sesion';

export default function Entrada() {
  const { perfil } = useSesion();
  return <Redirect href={perfil ? '/mapa' : '/acceso'} />;
}
