/**
 * Se corre después de `expo export -p web` (ver `npm run build:web`).
 * - Escribe dist/precache.json con todos los archivos de la app, para que el
 *   service worker los guarde al instalarse (todas las pantallas abren sin señal).
 * - Pone una versión única al service worker, para que cada publicación
 *   reemplace la caché anterior.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dist = path.join(__dirname, '..', 'dist');
const archivos = [];
(function recorrer(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, f.name);
    if (f.isDirectory()) recorrer(ruta);
    else archivos.push('/' + path.relative(dist, ruta).split(path.sep).join('/'));
  }
})(dist);

const precache = archivos.filter(
  (f) => f.startsWith('/_expo/static/') || f.startsWith('/assets/') || f.startsWith('/iconos/') || f === '/manifest.json',
);
const hash = crypto.createHash('sha256');
for (const f of precache.sort()) hash.update(f + fs.statSync(path.join(dist, f)).size);
const version = hash.digest('hex').slice(0, 12);

fs.writeFileSync(path.join(dist, 'precache.json'), JSON.stringify(precache));
const sw = path.join(dist, 'sw.js');
fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8').replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`));
console.log(`precache.json: ${precache.length} archivos · service worker versión ${version}`);
