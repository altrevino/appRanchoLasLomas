/**
 * Genera ícono, splash y favicon a partir del logotipo oficial.
 * Uso: npm run iconos   (requiere Playwright con Chromium instalado)
 *
 * - assets/icon.png (1024): cabeza en arena sobre verde bosque, sin transparencia
 *   (requisito de Apple). Expo genera todos los tamaños de iOS en el build.
 * - assets/android-icon-*.png: capas del ícono adaptable de Android.
 * - assets/splash-icon.png: logotipo completo, fondo transparente (el splash
 *   pone el fondo hueso desde app.json).
 * - assets/favicon.png
 * - public/iconos/*: íconos de la web app (pantalla de inicio del iPhone)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const fuente = fs.readFileSync(path.join(raiz, 'src/components/logo/trazos.ts'), 'utf8');
const trazos = JSON.parse(fuente.slice(fuente.indexOf('{'), fuente.lastIndexOf('}') + 1));

const BOSQUE = '#2B3B30';
const ARENA = '#AB8E64';
const caja = { x: 469, y: 49, w: 600 };

function svgVenado({ lado, escala, fondo, color }) {
  // escala: fracción del lado que ocupa el venado (centrado)
  const w = caja.w / escala;
  const x = caja.x - (w - caja.w) / 2;
  const y = caja.y - (w - caja.w) / 2;
  const paths = trazos.venado.map((d) => `<path d="${d}" fill="${color}"/>`).join('');
  const bg = fondo ? `<rect x="${x}" y="${y}" width="${w}" height="${w}" fill="${fondo}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="${x} ${y} ${w} ${w}">${bg}${paths}</svg>`;
}

function svgCompleto(ancho) {
  const c = { x: 25, y: 41, w: 1484, h: 977 };
  const alto = Math.round((ancho * c.h) / c.w);
  const g = (arr, color) => arr.map((d) => `<path d="${d}" fill="${color}"/>`).join('');
  return {
    alto,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="${c.x} ${c.y} ${c.w} ${c.h}">${g(trazos.venado, BOSQUE)}${g(trazos.lasLomas, BOSQUE)}${g(trazos.colina, ARENA)}${g(trazos.rancho, ARENA)}</svg>`,
  };
}

async function render(page, svg, w, h, archivo) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.screenshot({ path: path.join(raiz, 'assets', archivo), omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  console.log('assets/' + archivo);
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ deviceScaleFactor: 1 });
  await render(p, svgVenado({ lado: 1024, escala: 0.72, fondo: BOSQUE, color: ARENA }), 1024, 1024, 'icon.png');
  // Android adaptable: el sistema recorta a ~66% central
  await render(p, svgVenado({ lado: 1024, escala: 0.5, color: ARENA }), 1024, 1024, 'android-icon-foreground.png');
  await render(p, `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${BOSQUE}"/></svg>`, 1024, 1024, 'android-icon-background.png');
  await render(p, svgVenado({ lado: 1024, escala: 0.5, color: '#000000' }), 1024, 1024, 'android-icon-monochrome.png');
  const s = svgCompleto(1024);
  await render(p, s.svg, 1024, s.alto, 'splash-icon.png');
  await render(p, svgVenado({ lado: 48, escala: 0.86, fondo: BOSQUE, color: ARENA }), 48, 48, 'favicon.png');
  // Web app (iPhone "Agregar a pantalla de inicio" y navegadores)
  fs.mkdirSync(path.join(raiz, 'public/iconos'), { recursive: true });
  await render(p, svgVenado({ lado: 180, escala: 0.72, fondo: BOSQUE, color: ARENA }), 180, 180, '../public/iconos/apple-touch-icon.png');
  await render(p, svgVenado({ lado: 192, escala: 0.66, fondo: BOSQUE, color: ARENA }), 192, 192, '../public/iconos/icono-192.png');
  await render(p, svgVenado({ lado: 512, escala: 0.66, fondo: BOSQUE, color: ARENA }), 512, 512, '../public/iconos/icono-512.png');
  await render(p, svgVenado({ lado: 48, escala: 0.86, fondo: BOSQUE, color: ARENA }), 48, 48, '../public/iconos/favicon-48.png');
  await b.close();
})();
