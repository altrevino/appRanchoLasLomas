/**
 * Hora del servidor. La app calcula la diferencia con el reloj del teléfono y
 * la usa para el cronómetro y para la hora de cada registro, así todos los
 * teléfonos quedan sincronizados aunque su reloj esté desfasado.
 */
let diferenciaMs = 0;

/** Ajusta la diferencia con una hora del servidor recién recibida. */
export function sincronizar(horaServidorIso: string, latenciaMs = 0) {
  const servidor = new Date(horaServidorIso).getTime() + latenciaMs / 2;
  diferenciaMs = servidor - Date.now();
}

export const ahoraServidor = () => Date.now() + diferenciaMs;
export const diferencia = () => diferenciaMs;
