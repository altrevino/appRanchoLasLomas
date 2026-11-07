/// <reference types="node" />
/**
 * Convierte assets/logo/logo-completo.svg en trazos para react-native-svg.
 * Uso: npm run logo   (volver a correr si cambia el SVG oficial)
 *
 * Separa el logotipo por color y por elemento:
 * - venado: trazos verdes por encima de y=700 (busto con cornamenta)
 * - colina: trazo arena bajo el venado
 * - rancho: texto "RANCHO" y filetes laterales (arena)
 * - lasLomas: texto "LAS LOMAS" (verde)
 */
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('assets/logo/logo-completo.svg', 'utf8');
const elementos = [...svg.matchAll(/<(path|polygon)\s([^>]*)\/>/g)].map((m) => {
  const attr = (n: string) => m[2].match(new RegExp(`${n}="([^"]*)"`))?.[1] ?? '';
  let d = attr('d');
  if (m[1] === 'polygon') {
    const n = attr('points').trim().split(/\s+/).map(Number);
    const pares = [];
    for (let i = 0; i < n.length; i += 2) pares.push(`${n[i]},${n[i + 1]}`);
    d = `M${pares.join('L')}Z`;
  }
  const y = Number(d.match(/^M[\d.-]+,([\d.-]+)/)?.[1] ?? 0);
  return { d, fill: attr('fill').toLowerCase(), y };
});

const visibles = elementos.filter((e) => e.fill !== 'none');
const verde = visibles.filter((e) => e.fill === '#2b3b30');
const arena = visibles.filter((e) => e.fill === '#ac8e65');

const grupos = {
  venado: verde.filter((e) => e.y < 700).map((e) => e.d),
  lasLomas: verde.filter((e) => e.y >= 700).map((e) => e.d),
  colina: arena.filter((e) => e.y < 700).map((e) => e.d),
  rancho: arena.filter((e) => e.y >= 700).map((e) => e.d),
};

const salida = `// GENERADO por scripts/generar-logo.ts a partir de assets/logo/logo-completo.svg. No editar a mano.
export const trazosLogo = ${JSON.stringify(grupos, null, 2)} as const;
`;
writeFileSync('src/components/logo/trazos.ts', salida);
console.log(Object.entries(grupos).map(([k, v]) => `${k}: ${v.length}`).join(', '));
