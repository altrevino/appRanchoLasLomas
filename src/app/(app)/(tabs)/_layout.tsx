/**
 * Pestañas según rol:
 *   Invitado: Mapa, Censo
 *   Staff:    Mapa, Censo, Bitácora
 *   Admin:    Mapa, Censo, Bitácora, Administración
 */
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconoAdmin, IconoBitacora, IconoCenso, IconoMapa } from '../../../components/iconos';
import { esAdmin, esStaff, useSesion } from '../../../lib/sesion';
import { temas } from '../../../theme';

const t = temas.consulta;

type IconoComp = (p: { color: string }) => React.ReactNode;
const icono = (Componente: IconoComp) =>
  function Icono({ color }: { color: ColorValue }) {
    return <Componente color={color as string} />;
  };

export default function LayoutApp() {
  const { perfil } = useSesion();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.primario,
        tabBarInactiveTintColor: t.textoSecundario,
        tabBarStyle: {
          backgroundColor: t.fondo,
          borderTopColor: t.borde,
          height: 66 + insets.bottom,
          paddingTop: 4,
          paddingBottom: Math.max(insets.bottom, 6),
        },
        tabBarLabelStyle: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
        sceneStyle: { backgroundColor: t.fondo },
      }}
    >
      <Tabs.Screen name="mapa" options={{ title: 'Mapa', tabBarIcon: icono(IconoMapa) }} />
      <Tabs.Screen name="censo" options={{ title: 'Censo', tabBarIcon: icono(IconoCenso) }} />
      <Tabs.Screen
        name="bitacora"
        options={{ title: 'Bitácora', tabBarIcon: icono(IconoBitacora), href: esStaff(perfil) ? undefined : null }}
      />
      <Tabs.Screen
        name="admin"
        options={{ title: 'Admin', tabBarIcon: icono(IconoAdmin), href: esAdmin(perfil) ? undefined : null }}
      />
      <Tabs.Screen name="cuenta" options={{ href: null }} />
    </Tabs>
  );
}
