/*
 * Service worker de Las Lomas.
 *
 * Estrategias:
 *   - Páginas (navegación): primero red; sin señal, la última versión guardada.
 *     Así cada vez que hay señal se carga la versión más nueva de la app.
 *   - Archivos de la app (/_expo/static/, íconos, fuentes): guardados al
 *     instalar y luego desde caché (sus nombres cambian en cada versión).
 *   - Imágenes satelitales: desde caché si ya se vieron; si no, red y se guardan.
 *     Límite de mosaicos para no llenar el teléfono.
 *   - Supabase (datos): nunca se guardan aquí. La app tiene su propia caché y
 *     su cola de registros pendientes.
 */
const VERSION = 'v1';
const CACHE_APP = `app-${VERSION}`;
const CACHE_MOSAICOS = 'mosaicos-v1';
const MAX_MOSAICOS = 4000;

const esMosaico = (url) =>
  url.hostname === 'server.arcgisonline.com' || (url.hostname === 'api.maptiler.com' && url.pathname.startsWith('/tiles/'));

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_APP);
      const html = await fetch('/', { cache: 'no-store' }).then((r) => r.text());
      await cache.put('/', new Response(html, { headers: { 'Content-Type': 'text/html' } }));
      // Guardar todos los archivos de la app (lista generada al publicar) y,
      // por si acaso, los que referencia la página.
      const lista = await fetch('/precache.json', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []);
      const recursos = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1]);
      await Promise.all(
        [...new Set(['/manifest.json', ...lista, ...recursos])].map((r) => cache.add(r).catch(() => {})),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(nombres.filter((n) => n.startsWith('app-') && n !== CACHE_APP).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

async function recortarMosaicos() {
  const cache = await caches.open(CACHE_MOSAICOS);
  const claves = await cache.keys();
  const sobran = claves.length - MAX_MOSAICOS;
  for (let i = 0; i < sobran; i++) await cache.delete(claves[i]);
}

self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Navegación: red primero, caché si no hay señal.
  if (req.mode === 'navigate') {
    evento.respondWith(
      (async () => {
        try {
          const r = await fetch(req);
          const cache = await caches.open(CACHE_APP);
          cache.put('/', r.clone());
          return r;
        } catch {
          return (await caches.match('/')) || Response.error();
        }
      })(),
    );
    return;
  }

  // Mosaicos satelitales: caché primero.
  if (esMosaico(url)) {
    evento.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_MOSAICOS);
        const guardado = await cache.match(req);
        if (guardado) return guardado;
        try {
          const r = await fetch(req);
          if (r.ok || r.type === 'opaque') {
            await cache.put(req, r.clone());
            recortarMosaicos();
          }
          return r;
        } catch {
          return Response.error();
        }
      })(),
    );
    return;
  }

  // Archivos propios de la app: caché primero.
  if (url.origin === self.location.origin) {
    evento.respondWith(
      (async () => {
        const guardado = await caches.match(req);
        if (guardado) return guardado;
        const r = await fetch(req);
        if (r.ok && (url.pathname.startsWith('/_expo/') || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/iconos/'))) {
          const cache = await caches.open(CACHE_APP);
          cache.put(req, r.clone());
        }
        return r;
      })(),
    );
  }
  // Todo lo demás (Supabase, etc.): sin intervenir.
});
