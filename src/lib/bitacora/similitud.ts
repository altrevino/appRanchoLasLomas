/**
 * Anti-duplicados: ordena los ejemplares existentes por parecido con lo que
 * se acaba de observar. Corre en el teléfono (funciona sin señal).
 *
 * Criterios (los rasgos raros pesan más que los comunes):
 *   - Clase igual, o vecina (un M2 pudo pasar a M3).
 *   - Puntas por lado iguales o con diferencia de una.
 *   - Forma de la cornamenta.
 *   - Rasgos raros: cuerno roto del mismo lado, puntas anómalas, oreja marcada, cicatrices.
 *   - Lugar: mismo espiadero o a menos de 1.5 km del último donde se vio.
 *   - Visto recientemente.
 * Un rasgo raro que no coincide (uno tiene cuerno roto y el otro no) resta.
 */
import { distanciaM } from '../geo';
import type { ClaseMacho, Macho, Rasgos } from './tipos';

export interface Observacion extends Rasgos {
  clase: ClaseMacho;
  espiadero_id: string | null;
  lon: number | null;
  lat: number | null;
  /** Momento de la observación (ms). */
  cuando: number;
}

export interface Candidato {
  macho: Macho;
  puntos: number;
  /** 0–100, relativo al máximo posible con los datos disponibles. */
  parecido: number;
  motivos: string[];
}

const nivel = (c: ClaseMacho) => Number(c.slice(1));
const DIA = 86_400_000;

export function puntuar(m: Macho, o: Observacion): Candidato {
  let puntos = 0;
  let posible = 0;
  const motivos: string[] = [];
  const sumar = (p: number, max: number, motivo?: string) => {
    puntos += p;
    posible += max;
    if (motivo && p > 0) motivos.push(motivo);
  };

  // Clase
  const dif = Math.abs(nivel(m.clase_actual) - nivel(o.clase));
  sumar(dif === 0 ? 30 : dif === 1 ? 12 : -10, 30, dif === 0 ? 'Misma clase' : dif === 1 ? 'Clase vecina' : undefined);

  // Puntas por lado
  for (const lado of ['puntas_izq', 'puntas_der'] as const) {
    const a = m[lado];
    const b = o[lado];
    if (a == null || b == null) continue;
    const d = Math.abs(a - b);
    sumar(d === 0 ? 10 : d === 1 ? 4 : -4, 10, d === 0 ? (lado === 'puntas_izq' ? `${a} puntas izq.` : `${a} puntas der.`) : undefined);
  }

  // Forma
  if (m.forma && o.forma) sumar(m.forma === o.forma ? 8 : -4, 8, m.forma === o.forma ? `Cornamenta ${o.forma}` : undefined);

  // Rasgos raros: coincidencia positiva vale mucho; discrepancia resta.
  const raro = (a: boolean | null, b: boolean | null, peso: number, motivo: string) => {
    if (a == null || b == null) return;
    if (a && b) sumar(peso, peso, motivo);
    else if (a !== b) sumar(-Math.round(peso / 2), peso);
  };
  raro(m.puntas_anomalas, o.puntas_anomalas, 12, 'Puntas anómalas');
  raro(m.oreja_marcada, o.oreja_marcada, 12, 'Oreja marcada');
  raro(m.cicatrices, o.cicatrices, 8, 'Cicatrices');
  if (m.cuerno_roto && o.cuerno_roto) {
    if (m.cuerno_roto !== 'no' && m.cuerno_roto === o.cuerno_roto) sumar(18, 18, `Cuerno roto ${o.cuerno_roto}`);
    else if (m.cuerno_roto !== o.cuerno_roto) sumar(-9, 18);
  }

  // Lugar
  if (o.espiadero_id && m.ultimo_espiadero_id === o.espiadero_id) {
    sumar(15, 15, `Visto en ${m.ultimo_espiadero_nombre ?? 'el mismo espiadero'}`);
  } else if (o.lon != null && o.lat != null && m.ultimo_lon != null && m.ultimo_lat != null) {
    const d = distanciaM([o.lon, o.lat], [m.ultimo_lon, m.ultimo_lat]);
    sumar(d < 1500 ? 8 : 0, 15, d < 1500 ? `Visto a ${Math.round(d / 100) * 100} m` : undefined);
  } else {
    posible += 15;
  }

  // Reciente
  if (m.ultimo_avistamiento_at) {
    const dias = (o.cuando - new Date(m.ultimo_avistamiento_at).getTime()) / DIA;
    sumar(dias <= 30 ? 10 : dias <= 90 ? 5 : 0, 10, dias <= 30 ? 'Visto este mes' : dias <= 90 ? 'Visto en 3 meses' : undefined);
  }

  const parecido = posible > 0 ? Math.max(0, Math.min(100, Math.round((puntos / posible) * 100))) : 0;
  return { macho: m, puntos, parecido, motivos };
}

/** Candidatos ordenados de más a menos parecido (excluye cazados y fusionados). */
export function candidatos(machos: Macho[], o: Observacion, limite = 8): Candidato[] {
  return machos
    .filter((m) => m.estado !== 'fusionado' && m.estado !== 'cazado')
    .map((m) => puntuar(m, o))
    .filter((c) => c.parecido >= 25)
    .sort((a, b) => b.parecido - a.parecido || b.puntos - a.puntos)
    .slice(0, limite);
}
