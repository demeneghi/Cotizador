/* Service worker. CACHE_NAME se sustituye automaticamente por scripts/build.cjs en cada release. */
const CACHE_NAME = 'cotizador-pina-4ff0d6fcab75';

const urlsToCache = [
  './index.html',
  './js/app-config.js',
  './js/theme-meta.js',
  './js/disable-mobile-zoom.js',
  './js/numeric.js',
  './js/format-number.js',
  './js/informe-validate.js',
  './js/calc-core.js',
  './js/storage.js',
  './js/inputs-format.js',
  './js/cotizador-main.js',
  './js/sw-register.js',
  './js/informe-app.js',
  './js/vendor/alpine.min.js',
  './js/vendor/html2canvas.min.js',
  './config/app.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './styles.css',
  './informe.html',
  './manifest.json'
];

const NAVIGATION_FALLBACK = './index.html';

function isHttpRequest(url) {
  return url.protocol === 'http:' || url.protocol === 'https:';
}

function isNetworkFirstRequest(url) {
  const pathname = url.pathname || '';
  const name = pathname.split('/').pop() || '';
  const networkFirstNames = new Set([
    'index.html',
    'informe.html',
    'manifest.json',
    'sw.js',
    'styles.css',
    'app.json',
    ''
  ]);
  if (networkFirstNames.has(name)) return true;
  if (pathname === '/' || pathname === '') return true;
  if (/^icon-.*\.png$/i.test(name)) return true;
  if (name.endsWith('.js') && pathname.indexOf('/js/vendor/') === -1) return true;
  return false;
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(
        urlsToCache.map(u =>
          cache.add(u).catch(err => {
            console.warn('Precache omitido o fallido:', u, err && err.message);
          })
        )
      )
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache).catch(err => {
              console.warn('No se pudo borrar cache antiguo:', cache, err && err.message);
              return null;
            });
          }
          return null;
        })
      )
    ).then(() => self.clients.claim())
  );
});

function networkFirstHandler(event) {
  return fetch(event.request)
    .then(response => {
      if (response && response.status === 200 && response.type === 'basic') {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache).catch(() => {});
        });
      }
      return response;
    })
    .catch(() =>
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        if (event.request.mode === 'navigate' || event.request.destination === 'document') {
          return caches.match(NAVIGATION_FALLBACK);
        }
        return new Response('', { status: 504, statusText: 'Gateway Timeout' });
      })
    );
}

function staleWhileRevalidate(event) {
  return caches.match(event.request).then(cachedResponse => {
    const networkFetch = fetch(event.request).then(response => {
      if (response && response.status === 200 && response.type === 'basic') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, clone).catch(() => {});
        });
      }
      return response;
    }).catch(() => null);
    return cachedResponse || networkFetch.then(r => r || new Response('', { status: 504 }));
  });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  let url;
  try { url = new URL(event.request.url); } catch (e) { return; }
  if (!isHttpRequest(url)) return;

  if (isNetworkFirstRequest(url)) {
    event.respondWith(networkFirstHandler(event));
  } else {
    event.respondWith(staleWhileRevalidate(event));
  }
});

self.addEventListener('message', event => {
  if (!event.data || event.data.action !== 'skipWaiting') return;
  if (!event.source) return;
  self.skipWaiting();
});
