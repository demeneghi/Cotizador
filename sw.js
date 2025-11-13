const CACHE_NAME = 'cotizador-pina-v5';
const urlsToCache = [
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
  console.log('SW: Instalando nueva versión', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('SW: Cacheando recursos estáticos');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('SW: Instalación completada, esperando skipWaiting');
      })
  );
});

// Activación del Service Worker
self.addEventListener('activate', event => {
  console.log('Service Worker: Activando versión', CACHE_NAME);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Eliminando caché antigua:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Tomando control de todos los clientes');
      return self.clients.claim();
    })
  );
});

// Estrategia híbrida: Network First para archivos críticos, Cache First para recursos estáticos
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Lista de archivos que SIEMPRE deben ir a la red primero para detectar actualizaciones
  const networkFirstFiles = ['index.html', 'manifest.json', 'sw.js', '/', './'];
  const isNetworkFirst = networkFirstFiles.some(file => 
    url.pathname.endsWith(file) || url.pathname === file || url.pathname === '/Cotizador/' || url.pathname === '/Cotizador'
  );

  if (isNetworkFirst) {
    // NETWORK FIRST: Intenta red primero, caché como respaldo
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Si la respuesta es válida, actualizar caché
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Si falla la red, usar caché
          return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Si no hay caché, devolver index.html como fallback
            return caches.match('./index.html');
          });
        })
    );
  } else {
    // CACHE FIRST: Para recursos estáticos (imágenes, fuentes, JS externos)
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            return response;
          }
          
          return fetch(event.request).then(response => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });

            return response;
          });
        })
    );
  }
});

// Manejo de mensajes para actualizar el caché
self.addEventListener('message', event => {
  console.log('Service Worker: Mensaje recibido:', event.data);
  if (event.data && event.data.action === 'skipWaiting') {
    console.log('Service Worker: Ejecutando skipWaiting');
    self.skipWaiting();
  }
});

