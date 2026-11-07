/**
 * Pestañas según rol:
 *   Invitado: Mapa, Censo
 *   Staff:    Mapa, Censo, Bitácora
 *   Admin:    Mapa, Censo, Bitácora, Administración
 */
import { Tabs } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ColorValue } from 'react-native';
import { esAdmin, esStaff, useSesion } from '../../lib/sesion';
import { temas } from '../../theme';

const t = temas.consulta;

const icono = (nombre: SFSymbol) =>
  function Icono({ color }: { color: ColorValue }) {
    return <SymbolView name={nombre} tintColor={color as string} size={24} type="monochrome" />;
  };

export default function LayoutApp() {
  const { perfil } = useSesion();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.primario,
        tabBarInactiveTintColor: t.textoSecundario,
        tabBarStyle: { backgroundColor: t.fondo, borderTopColor: t.borde },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        sceneStyle: { backgroundColor: t.fondo },
      }}
    >
      <Tabs.Screen name="mapa" options={{ title: 'Mapa', tabBarIcon: icono('map') }} />
      <Tabs.Screen name="censo" options={{ title: 'Censo', tabBarIcon: icono('timer') }} />
      <Tabs.Screen
        name="bitacora"
        options={{ title: 'Bitácora', tabBarIcon: icono('book.closed'), href: esStaff(perfil) ? undefined : null }}
      />
      <Tabs.Screen
        name="admin"
        options={{ title: 'Admin', tabBarIcon: icono('gearshape'), href: esAdmin(perfil) ? undefined : null }}
      />
      <Tabs.Screen name="cuenta" options={{ href: null }} />
    </Tabs>
  );
}
