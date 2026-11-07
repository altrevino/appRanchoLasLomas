/**
 * Verifica WCAG AA de todos los pares texto/fondo del tema.
 * Uso: npm run contraste   (falla con código 1 si algún par no cumple)
 */
import { paresDeContraste } from '../src/theme';

function luminancia(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

let fallas = 0;
for (const p of paresDeContraste) {
  const r = ratio(p.texto, p.fondo);
  const minimo = p.grande ? 3 : 4.5;
  const ok = r >= minimo;
  if (!ok) fallas++;
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${r.toFixed(2).padStart(5)} (mín ${minimo})  ${p.nombre}  ${p.texto} sobre ${p.fondo}`);
}
console.log(fallas ? `\n${fallas} par(es) no cumplen AA` : '\nTodos los pares cumplen AA');
process.exit(fallas ? 1 : 0);
