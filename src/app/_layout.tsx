import { Cinzel_600SemiBold, Cinzel_700Bold, useFonts } from '@expo-google-fonts/cinzel';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SesionProvider, useSesion } from '../lib/sesion';
import { temas } from '../theme';

SplashScreen.preventAutoHideAsync();

function Rutas() {
  const { cargando, perfil } = useSesion();
  const [fuentesListas, error] = useFonts({ Cinzel_600SemiBold, Cinzel_700Bold });
  const listo = !cargando && (fuentesListas || !!error);

  useEffect(() => {
    if (listo) SplashScreen.hideAsync();
  }, [listo]);

  if (!listo) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: temas.consulta.fondo } }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!perfil}>
        <Stack.Screen name="acceso" />
      </Stack.Protected>
      <Stack.Protected guard={!!perfil}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      {/* Pantallas de muestra del diseño: solo en desarrollo */}
      <Stack.Protected guard={__DEV__}>
        <Stack.Screen name="muestras/ficha" />
        <Stack.Screen
          name="muestras/captura"
          options={{ contentStyle: { backgroundColor: temas.campo.fondo }, gestureEnabled: false }}
        />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SesionProvider>
        <Rutas />
      </SesionProvider>
    </SafeAreaProvider>
  );
}
