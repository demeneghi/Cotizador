const CACHE_NAME = 'cotizador-pina-v4';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando versión', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Archivos en caché');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Instalación completada, esperando para activarse');
        // NO llamar skipWaiting aquí automáticamente
        // Esperar a que el usuario haga click en "Actualizar"
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

// Estrategia: Cache First, falling back to Network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si está en caché, devolver el recurso en caché
        if (response) {
          return response;
        }

        // Si no está en caché, hacer fetch
        return fetch(event.request).then(response => {
          // Verificar si recibimos una respuesta válida
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clonar la respuesta
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
      .catch(() => {
        // Si falla la red, intentar devolver una página offline personalizada
        return caches.match('./index.html');
      })
  );
});

// Manejo de mensajes para actualizar el caché
self.addEventListener('message', event => {
  console.log('Service Worker: Mensaje recibido:', event.data);
  if (event.data && event.data.action === 'skipWaiting') {
    console.log('Service Worker: Ejecutando skipWaiting');
    self.skipWaiting();
  }
});

