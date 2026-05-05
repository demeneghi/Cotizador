# Cotizador de Pina (PWA)

Aplicacion web progresiva para calcular precios de pina por kilogramo (flete corto y largo), con persistencia por estado (Veracruz y Colima) y generacion de informe.

## Estructura del repositorio

```text
.
├── index.html              # Shell HTML del cotizador (CSP, scripts con defer)
├── informe.html            # Vista de informe
├── manifest.json           # PWA
├── sw.js                   # Service Worker (CACHE_NAME generado por build)
├── styles.css              # CSS auto-generado por build (concatenando styles/*.css)
├── styles/                 # Modulos de CSS (fuente)
│   ├── tokens-and-base.css
│   ├── responsive.css
│   ├── informe.css
│   └── avanzado.css
├── Dockerfile              # Imagen estatica nginx-unprivileged (multi-arch, no-root)
├── nginx/default.conf      # Headers de seguridad y caching para nginx
├── .dockerignore           # Excluye tests/, .git/, etc. de la imagen
├── config/app.json         # Configuracion canonical (estados, defaults, brand, limites)
├── js/
│   ├── app-config.js       # Auto-generado desde config/app.json (NO editar)
│   ├── theme-meta.js       # Aplica theme.colorPrimary a meta theme-color
│   ├── numeric.js          # Modulo unico de parseo/formato numerico
│   ├── format-number.js    # Wrapper retro-compatible sobre Numeric
│   ├── informe-validate.js # Validacion estricta del JSON de informe (con limites)
│   ├── calc-core.js        # Nucleo numerico
│   ├── storage.js          # Storage debounceado con eventos multi-pestana
│   ├── inputs-format.js    # Formato vivo de inputs (delegacion en document)
│   ├── cotizador-main.js   # Logica Alpine del cotizador
│   ├── sw-register.js      # Registro del SW + visibilitychange con throttle
│   ├── informe-app.js      # Render del informe (DOM seguro, html2canvas lazy)
│   └── vendor/
│       ├── alpine.min.js
│       └── html2canvas.min.js
├── scripts/build.cjs       # Genera app-config.js, styles.css, CACHE_NAME y SHA256SUMS
├── tests/                  # Tests Node (calc, numeric, format, validate, storage, build)
├── SHA256SUMS              # Auto-generado: cubre TODOS los archivos servidos
└── .github/workflows/ci.yml
```

## Requisitos

- Navegador moderno (Chrome, Safari, Firefox, Edge).
- Node.js 20+ para tests, build y CI local.

## Uso local

Sirve la carpeta con cualquier servidor estatico (CSP y SW requieren HTTP):

```bash
npx serve .
# o
python3 -m http.server 8000
```

### Docker (opcional)

```bash
docker build -t cotizador-pina .
docker run --rm -p 8080:8080 cotizador-pina
```

La imagen usa `nginx-unprivileged` (no corre como root) con tag `1.27-alpine` y `nginx/default.conf` que aplica HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy y Permissions-Policy. Para builds totalmente reproducibles en pipeline, sustituye el tag por digest (`@sha256:...`) siguiendo las instrucciones del comentario inicial del `Dockerfile`.

## Flujo de build (obligatorio antes de publicar)

```bash
node scripts/build.cjs
```

Genera de forma determinista:

- `js/app-config.js` espejo de `config/app.json` (sin edicion manual).
- `styles.css` concatenando `styles/*.css`.
- `sw.js` con `CACHE_NAME` derivado del hash agregado de assets criticos (asegura invalidacion en cada release).
- `SHA256SUMS` cubriendo HTML, JS, CSS, JSON, vendoreados e iconos.

Para verificar sin escribir cambios:

```bash
node scripts/build.cjs --check
```

## Persistencia

- Configuracion multi-estado: clave `cotizador_data_v2` (definida en `config/app.json`); incluye precio y parametros por estado.
- Informe reciente: `cotizacion_informe`.
- Migracion automatica desde la clave legada `cotizador_config` hacia el estado por defecto.
- Exportar respaldo / Importar respaldo (JSON) con limite de tamano configurable.
- Storage layer con debounce y sincronizacion multi-pestana (`storage` event).

## Tests y verificacion

```bash
npm run verify
```

Equivale a `build:check` + `lint` + `npm audit` + tests (numeric, calc, format, validate, storage, build, app-config-parity, informe-validate).

Comprobacion de integridad:

```bash
sha256sum -c SHA256SUMS    # Linux (CI)
shasum -a 256 -c SHA256SUMS  # macOS
```

## Seguridad

- CSP estricta en `index.html` (Alpine requiere `'unsafe-eval'`) e `informe.html` (sin `'unsafe-eval'`). `frame-ancestors 'none'`, `base-uri 'none'`, `referrer no-referrer`.
- Sin CDN runtime ni Google Fonts: vendor de tipografia mediante stack del sistema.
- `SHA256SUMS` cubre todos los assets servidos. CI valida en cada PR.
- Storage debounceado con limite de tamano y manejo de `QuotaExceededError`.
- Validacion del JSON de informe con limites de longitud por campo (defensa frente a DoS por enlace controlado).
- `Dockerfile` con `USER nginx`, tag pinneado a `1.27-alpine` (digest opcional en pipeline) y headers de seguridad en nginx.
- Workflow CI con `permissions: { contents: read }` y acciones pinned por SHA.

## Despliegue

Sube el contenido a tu hosting estatico (GitHub Pages, Netlify, S3, etc.). Ejecuta `node scripts/build.cjs` antes de publicar para que `CACHE_NAME` y `SHA256SUMS` queden actualizados.

## Licencia

UNLICENSED — uso interno (ver `LICENSE`).
