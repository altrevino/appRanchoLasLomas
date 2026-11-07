import { Cinzel_600SemiBold, Cinzel_700Bold, useFonts } from '@expo-google-fonts/cinzel';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { temas } from '../theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fuentesListas, error] = useFonts({ Cinzel_600SemiBold, Cinzel_700Bold });

  useEffect(() => {
    if (fuentesListas || error) SplashScreen.hideAsync();
  }, [fuentesListas, error]);

  if (!fuentesListas && !error) return null;

  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: temas.consulta.fondo },
        }}
      >
        <Stack.Screen
          name="muestras/captura"
          options={{ contentStyle: { backgroundColor: temas.campo.fondo }, gestureEnabled: false }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
