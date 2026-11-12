/**
 * Tarjeta para activar los avisos de inicio de censo en este teléfono.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { activarAvisos, estadoAvisos, type EstadoAvisos } from '../../lib/censo/avisos';
import { borde, espacio, radio, temas, tipografia } from '../../theme';
import { Aviso, Boton, Etiqueta } from '../consulta';

const t = temas.consulta;

export function AvisosCenso() {
  const [estado, setEstado] = useState<EstadoAvisos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    estadoAvisos().then(setEstado).catch(() => setEstado('no-disponible'));
  }, []);

  if (!estado || estado === 'activos' || estado === 'no-disponible') return null;

  return (
    <View style={estilos.tarjeta}>
      <Etiqueta>Aviso cuando empiece un censo</Etiqueta>
      {estado === 'requiere-instalar' ? (
        <Text style={[tipografia.cuerpo, { color: t.texto }]}>
          Para recibir el aviso en el iPhone, primero agrega la app a tu pantalla de inicio: en Safari toca Compartir → «Agregar a pantalla de
          inicio», y ábrela desde ahí.
        </Text>
      ) : estado === 'bloqueados' ? (
        <Text style={[tipografia.cuerpo, { color: t.texto }]}>
          Los avisos están bloqueados. Actívalos en Ajustes → Notificaciones → Las Lomas.
        </Text>
      ) : (
        <>
          <Text style={[tipografia.cuerpo, { color: t.texto }]}>Recibe un aviso en este teléfono cuando el administrador inicie un censo.</Text>
          {error ? <Aviso>{error}</Aviso> : null}
          <Boton
            variante="secundario"
            cargando={ocupado}
            onPress={async () => {
              setOcupado(true);
              setError(null);
              try {
                setEstado(await activarAvisos());
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setOcupado(false);
              }
            }}
          >
            Activar avisos
          </Boton>
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    gap: espacio.s,
    padding: espacio.l,
    borderWidth: borde.fino,
    borderColor: t.borde,
    borderRadius: radio.m,
    backgroundColor: t.superficie,
  },
});
