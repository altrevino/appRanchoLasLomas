/**
 * Compartir el PDF: menú del iPhone (WhatsApp, correo, AirDrop) o descarga.
 * navigator.share necesita un toque del usuario, por eso el PDF se prepara
 * antes y este paso no espera nada.
 */
import { Platform } from 'react-native';
import type { DatosPdf } from './pdf';

export interface PdfListo {
  blob: Blob;
  nombre: string;
}

export async function urlADataUri(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error('No se pudo descargar la foto');
  const blob = await r.blob();
  return new Promise((ok, mal) => {
    const lector = new FileReader();
    lector.onload = () => ok(lector.result as string);
    lector.onerror = () => mal(lector.error);
    lector.readAsDataURL(blob);
  });
}

export async function prepararPdf(datos: DatosPdf, nombre: string): Promise<PdfListo> {
  if (Platform.OS !== 'web') throw new Error('El PDF se genera desde la web app.');
  const { generarPdf } = await import('./pdf');
  return { blob: await generarPdf(datos), nombre };
}

export function descargar({ blob, nombre }: PdfListo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const puedeCompartir = (pdf: PdfListo) => {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.canShare) return false;
  return navigator.canShare({ files: [new File([pdf.blob], pdf.nombre, { type: 'application/pdf' })] });
};

export async function compartir(pdf: PdfListo): Promise<'compartido' | 'cancelado' | 'descargado'> {
  const archivo = new File([pdf.blob], pdf.nombre, { type: 'application/pdf' });
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: pdf.nombre.replace(/\.pdf$/, '') });
      return 'compartido';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelado';
    }
  }
  descargar(pdf);
  return 'descargado';
}
