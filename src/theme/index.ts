import { derivados, paleta } from './tokens';

export * from './tokens';

/**
 * Dos modos de interfaz con los mismos nombres semánticos, para que un
 * componente funcione en ambos solo cambiando el tema.
 *
 * - consulta: siempre claro (fondo hueso), sin importar el ajuste del teléfono.
 * - campo: siempre oscuro (fondo verde noche), sin importar el ajuste del teléfono.
 */
export interface Tema {
  modo: 'consulta' | 'campo';
  fondo: string;
  superficie: string;
  superficieActiva: string;
  borde: string;
  texto: string;
  textoSecundario: string;
  titulo: string;
  primario: string;
  textoSobrePrimario: string;
  /** Arena para bordes, filetes y elementos grandes/decorativos. */
  acento: string;
  /** Arena apto para texto pequeño sobre `fondo`. */
  acentoTexto: string;
  exito: string;
  alerta: string;
  error: string;
  barraEstado: 'dark' | 'light';
}

export const temas: Record<Tema['modo'], Tema> = {
  consulta: {
    modo: 'consulta',
    fondo: paleta.hueso,
    superficie: derivados.huesoTarjeta,
    superficieActiva: '#EFE8DA',
    borde: derivados.huesoBorde,
    texto: paleta.textoSobreClaro,
    textoSecundario: derivados.textoSecundarioClaro,
    titulo: paleta.verdeBosque,
    primario: paleta.verdeBosque,
    textoSobrePrimario: paleta.hueso,
    acento: paleta.arena,
    acentoTexto: derivados.arenaTexto,
    exito: derivados.exitoSobreClaro,
    alerta: derivados.alertaSobreClaro,
    error: derivados.errorSobreClaro,
    barraEstado: 'dark',
  },
  campo: {
    modo: 'campo',
    fondo: paleta.verdeNoche,
    superficie: derivados.nocheSuperficie,
    superficieActiva: derivados.nocheSuperficieActiva,
    borde: derivados.nocheBorde,
    texto: paleta.textoSobreOscuro,
    textoSecundario: derivados.textoSecundarioOscuro,
    titulo: paleta.textoSobreOscuro,
    primario: paleta.verdeBosque,
    textoSobrePrimario: paleta.textoSobreOscuro,
    acento: paleta.arena,
    acentoTexto: paleta.arena, // 5.56 sobre noche
    exito: derivados.exitoSobreOscuro,
    alerta: derivados.alertaSobreOscuro,
    error: derivados.errorSobreOscuro,
    barraEstado: 'light',
  },
};

export function useTema(modo: Tema['modo']): Tema {
  return temas[modo];
}

/**
 * Pares texto/fondo que deben cumplir AA. `grande: true` = solo se usa en
 * texto de 24 pt o más (o 18.66 pt negrita), que exige 3:1.
 */
export const paresDeContraste: { nombre: string; texto: string; fondo: string; grande?: boolean }[] = [
  ...(['consulta', 'campo'] as const).flatMap((m) => {
    const t = temas[m];
    return [
      { nombre: `${m}: texto/fondo`, texto: t.texto, fondo: t.fondo },
      { nombre: `${m}: texto/superficie`, texto: t.texto, fondo: t.superficie },
      { nombre: `${m}: secundario/fondo`, texto: t.textoSecundario, fondo: t.fondo },
      { nombre: `${m}: secundario/superficie`, texto: t.textoSecundario, fondo: t.superficie },
      { nombre: `${m}: titulo/fondo`, texto: t.titulo, fondo: t.fondo },
      { nombre: `${m}: acentoTexto/fondo`, texto: t.acentoTexto, fondo: t.fondo },
      { nombre: `${m}: acentoTexto/superficie`, texto: t.acentoTexto, fondo: t.superficie },
      { nombre: `${m}: sobrePrimario/primario`, texto: t.textoSobrePrimario, fondo: t.primario },
      { nombre: `${m}: exito/fondo`, texto: t.exito, fondo: t.fondo },
      { nombre: `${m}: alerta/fondo`, texto: t.alerta, fondo: t.fondo },
      { nombre: `${m}: error/fondo`, texto: t.error, fondo: t.fondo },
    ];
  }),
  { nombre: 'campo: texto/botón activo', texto: paleta.textoSobreOscuro, fondo: derivados.nocheSuperficieActiva },
  { nombre: 'arena claro/bosque', texto: derivados.arenaClaro, fondo: paleta.verdeBosque },
  { nombre: 'arena/bosque (solo grande)', texto: paleta.arena, fondo: paleta.verdeBosque, grande: true },
];
