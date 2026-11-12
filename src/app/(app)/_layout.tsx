/**
 * Contenedor de la app con sesión: pestañas + captura del censo a pantalla completa.
 * Vigila el censo en curso: cuando el admin lo inicia, el personal y los invitados
 * con la app abierta entran solos a la captura (una vez por censo).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, router, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { useCensoActual } from '../../lib/censo/datos';
import { useSesion } from '../../lib/sesion';
import { temas } from '../../theme';

const CLAVE_VISTO = 'rll:censo-llevado';

function VigilanteCenso() {
  const { perfil } = useSesion();
  const { datos } = useCensoActual();
  const ruta = usePathname();
  const censoId = datos?.censo?.estado === 'en_curso' ? datos.censo.id : null;

  useEffect(() => {
    if (!censoId || perfil?.rol === 'admin' || ruta === '/captura') return;
    AsyncStorage.getItem(CLAVE_VISTO)
      .catch(() => null)
      .then((visto) => {
        if (visto === censoId) return;
        AsyncStorage.setItem(CLAVE_VISTO, censoId).catch(() => {});
        router.push('/captura');
      });
  }, [censoId, perfil?.rol, ruta]);

  return null;
}

export default function LayoutApp() {
  return (
    <>
      <VigilanteCenso />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: temas.consulta.fondo } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="cuenta" />
        <Stack.Screen name="captura" options={{ contentStyle: { backgroundColor: temas.campo.fondo }, gestureEnabled: false, animation: 'fade' }} />
      </Stack>
    </>
  );
}
