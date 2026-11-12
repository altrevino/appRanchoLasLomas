/**
 * Fotos de ejemplares: se toman o eligen, se comprimen en el teléfono
 * (máx. 1600 px, JPEG 70%: ~200–400 KB) y se guardan en base64 hasta subirlas.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

export interface FotoLocal {
  /** data URI para mostrarla antes de subirla */
  uri: string;
  base64: string;
  tomadaAt: string;
}

const LADO_MAX = 1600;

/** Fecha de la foto desde EXIF ("2026:11:13 07:41:02"), si existe. */
function fechaExif(exif: Record<string, unknown> | null | undefined): string | null {
  const v = (exif?.DateTimeOriginal ?? exif?.DateTime) as string | undefined;
  if (!v) return null;
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(v);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export async function obtenerFoto(origen: 'camara' | 'galeria'): Promise<FotoLocal | null> {
  const opciones: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: true };
  if (origen === 'camara') {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) throw new Error('Sin permiso para usar la cámara. Actívalo en Ajustes.');
  }
  const r = origen === 'camara' ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
  if (r.canceled || !r.assets?.length) return null;
  const a = r.assets[0];

  const ctx = ImageManipulator.manipulate(a.uri);
  const ancho = a.width ?? 0;
  const alto = a.height ?? 0;
  if (ancho > LADO_MAX || alto > LADO_MAX) {
    ctx.resize(ancho >= alto ? { width: LADO_MAX } : { height: LADO_MAX });
  }
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!out.base64) throw new Error('No se pudo procesar la foto');
  return {
    uri: `data:image/jpeg;base64,${out.base64}`,
    base64: out.base64,
    tomadaAt: fechaExif(a.exif) ?? new Date().toISOString(),
  };
}

function base64ABytes(b64: string): Uint8Array {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

export async function subirFoto(ruta: string, base64: string): Promise<void> {
  const { error } = await supabase.storage.from('fotos').upload(ruta, base64ABytes(base64), {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
}

// URLs firmadas (la carpeta es privada). Se reutilizan durante 50 minutos.
const cache = new Map<string, { url: string; vence: number }>();

export function useUrlsFotos(rutas: (string | null | undefined)[]): Record<string, string> {
  const clave = rutas.filter(Boolean).join('|');
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const lista = clave ? clave.split('|') : [];
    const ahora = Date.now();
    const listas: Record<string, string> = {};
    const faltan: string[] = [];
    lista.forEach((r) => {
      const c = cache.get(r);
      if (c && c.vence > ahora) listas[r] = c.url;
      else faltan.push(r);
    });
    const publicar = () => setUrls({ ...listas });
    if (!faltan.length) {
      Promise.resolve().then(publicar);
      return;
    }
    supabase.storage
      .from('fotos')
      .createSignedUrls(faltan, 3600)
      .then(({ data }) => {
        (data ?? []).forEach((d) => {
          if (d.path && d.signedUrl) {
            cache.set(d.path, { url: d.signedUrl, vence: ahora + 50 * 60_000 });
            listas[d.path] = d.signedUrl;
          }
        });
        publicar();
      });
  }, [clave]);
  return urls;
}
