const CACHE_NAME = 'cotizador-pina-v13';

const urlsToCache = [
  './index.html',
  './js/app-config.js',
  './js/theme-meta.js',
  './js/format-number.js',
  './js/informe-validate.js',
  './js/calc-core.js',
  './js/cotizador-main.js',
  './js/sw-register.js',
  './js/informe-app.js',
  './js/vendor/alpine.min.js',
  './js/vendor/html2canvas.min.js',
  './config/app.json',
  './icon-192.png',
  './icon-512.png',
  './styles.css',
  './informe.html',
  './manifest.json'
];

function isNetworkFirstRequest(url) {
  const pathname = url.pathname || '';
  const name = pathname.split('/').pop() || '';
  const networkFirstNames = new Set([
    'index.html',
    'informe.html',
    'manifest.json',
    'sw.js',
    'styles.css',
    ''
  ]);
  if (networkFirstNames.has(name)) return true;
  if (pathname === '/' || pathname === '') return true;
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
            return caches.delete(cache);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isNetworkFirst = isNetworkFirstRequest(url);

  if (isNetworkFirst) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache).catch(() => {});
            });
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return caches.match('./index.html');
          })
        )
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache).catch(() => {});
          });
          return response;
        });
      })
    );
  }
});

self.addEventListener('message', event => {
  if (!event.data || event.data.action !== 'skipWaiting') {
    return;
  }
  if (!event.source) {
    return;
  }
  self.skipWaiting();
});
