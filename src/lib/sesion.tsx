/**
 * Sesión y perfil del usuario actual.
 *
 * - Personal (admin/staff): correo y contraseña.
 * - Invitado: sesión anónima de Supabase + canje de nombre y código de 6 dígitos.
 *
 * El perfil se guarda en el teléfono para que la app abra aunque no haya señal.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { mensajeDeError, supabase, type Perfil } from './supabase';

const CLAVE_PERFIL = 'rll:perfil';

interface EstadoSesion {
  cargando: boolean;
  sesion: Session | null;
  perfil: Perfil | null;
  /** Motivo por el que una sesión existente ya no tiene acceso (código vencido o revocado). */
  avisoAcceso: string | null;
  entrarInvitado: (nombre: string, codigo: string) => Promise<void>;
  entrarPersonal: (correo: string, contrasena: string) => Promise<void>;
  salir: () => Promise<void>;
  recargarPerfil: () => Promise<void>;
}

const Contexto = createContext<EstadoSesion | null>(null);

function vigente(p: Perfil | null): p is Perfil {
  return !!p && p.activo && (!p.expira_en || new Date(p.expira_en) > new Date());
}

export function SesionProvider({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [sesion, setSesion] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [avisoAcceso, setAvisoAcceso] = useState<string | null>(null);

  const guardarPerfil = useCallback(async (p: Perfil | null) => {
    setPerfil(p);
    try {
      if (p) await AsyncStorage.setItem(CLAVE_PERFIL, JSON.stringify(p));
      else await AsyncStorage.removeItem(CLAVE_PERFIL);
    } catch {
      // almacenamiento no disponible: se sigue sin caché
    }
  }, []);

  const cargarPerfil = useCallback(
    async (s: Session | null) => {
      if (!s) {
        await guardarPerfil(null);
        return;
      }
      const { data, error } = await supabase
        .from('perfiles')
        .select('id, nombre, rol, expira_en, activo')
        .eq('id', s.user.id)
        .maybeSingle<Perfil>();
      if (error) {
        // Sin señal: se usa el perfil guardado si es del mismo usuario y sigue vigente.
        const guardado = await AsyncStorage.getItem(CLAVE_PERFIL).catch(() => null);
        const p = guardado ? (JSON.parse(guardado) as Perfil) : null;
        setPerfil(p && p.id === s.user.id && vigente(p) ? p : null);
        return;
      }
      if (data && !vigente(data)) {
        const p: Perfil = data;
        setAvisoAcceso(p.rol === 'invitado' ? 'Tu código de invitado venció o fue revocado. Pide uno nuevo.' : 'Tu cuenta está desactivada.');
        await guardarPerfil(null);
        return;
      }
      await guardarPerfil(data ?? null);
    },
    [guardarPerfil],
  );

  useEffect(() => {
    let activo = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!activo) return;
      setSesion(data.session);
      // Abrir de inmediato con el perfil guardado (sirve sin señal) y validarlo en segundo plano.
      const guardado = await AsyncStorage.getItem(CLAVE_PERFIL).catch(() => null);
      const previo = guardado ? (JSON.parse(guardado) as Perfil) : null;
      if (data.session && previo && previo.id === data.session.user.id && vigente(previo)) {
        setPerfil(previo);
        setCargando(false);
        cargarPerfil(data.session);
        return;
      }
      await cargarPerfil(data.session);
      setCargando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSesion(s);
    });
    return () => {
      activo = false;
      sub.subscription.unsubscribe();
    };
  }, [cargarPerfil]);

  const entrarInvitado = useCallback(
    async (nombre: string, codigo: string) => {
      setAvisoAcceso(null);
      let { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        const r = await supabase.auth.signInAnonymously();
        if (r.error) throw new Error(mensajeDeError(r.error));
        s = { session: r.data.session };
      }
      const { data, error } = await supabase.rpc('canjear_codigo', { p_codigo: codigo.trim(), p_nombre: nombre.trim() });
      if (error) throw new Error(mensajeDeError(error));
      if (!data?.id) throw new Error('Código incorrecto o vencido. Revisa los 6 dígitos.');
      await cargarPerfil(s.session);
    },
    [cargarPerfil],
  );

  const entrarPersonal = useCallback(
    async (correo: string, contrasena: string) => {
      setAvisoAcceso(null);
      // Si había una sesión anónima de invitado, se cierra antes.
      await supabase.auth.signOut().catch(() => {});
      const { data, error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: contrasena });
      if (error) throw new Error(mensajeDeError(error));
      await cargarPerfil(data.session);
      const { data: p } = await supabase.from('perfiles').select('id').eq('id', data.user.id).maybeSingle();
      if (!p) {
        await supabase.auth.signOut();
        throw new Error('Esta cuenta no tiene perfil en el rancho. Pide al administrador que la dé de alta.');
      }
    },
    [cargarPerfil],
  );

  const salir = useCallback(async () => {
    await supabase.auth.signOut().catch(() => {});
    await guardarPerfil(null);
  }, [guardarPerfil]);

  const recargarPerfil = useCallback(() => cargarPerfil(sesion), [cargarPerfil, sesion]);

  const valor = useMemo(
    () => ({ cargando, sesion, perfil, avisoAcceso, entrarInvitado, entrarPersonal, salir, recargarPerfil }),
    [cargando, sesion, perfil, avisoAcceso, entrarInvitado, entrarPersonal, salir, recargarPerfil],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion() {
  const c = useContext(Contexto);
  if (!c) throw new Error('useSesion fuera de SesionProvider');
  return c;
}

export const esStaff = (p: Perfil | null) => p?.rol === 'admin' || p?.rol === 'staff';
export const esAdmin = (p: Perfil | null) => p?.rol === 'admin';
