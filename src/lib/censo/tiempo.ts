import { useEffect, useState } from 'react';
import { ahoraServidor } from './reloj';

/** Milisegundos que faltan para `finIso` según la hora del servidor (se actualiza cada segundo). */
export function useRestante(finIso: string | null | undefined): number {
  const [ahora, setAhora] = useState(() => ahoraServidor());
  useEffect(() => {
    if (!finIso) return;
    const id = setInterval(() => setAhora(ahoraServidor()), 1000);
    return () => clearInterval(id);
  }, [finIso]);
  return finIso ? new Date(finIso).getTime() - ahora : 0;
}

export const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';

export function haceCuanto(iso: string | null, ahora: number): string {
  if (!iso) return 'sin registros';
  const s = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 1000));
  if (s < 60) return `hace ${s} s`;
  return `hace ${Math.floor(s / 60)} min`;
}
