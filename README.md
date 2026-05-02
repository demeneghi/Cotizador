# Cotizador de Piña (PWA)

Aplicación web progresiva para calcular precios de piña por kilogramo (flete corto y largo), con **persistencia por estado** (Veracruz y Colima) y generación de informe.

## Estructura del repositorio

```
├── index.html              # Shell HTML (CSP, carga de scripts)
├── informe.html            # Vista de informe
├── manifest.json           # PWA
├── sw.js                   # Service Worker (caché versionada)
├── styles.css              # Estilos (tokens en :root)
├── Dockerfile              # Nginx estático opcional (docker build)
├── config/app.json         # Configuración: estados, almacenamiento, defaults, rutas de scripts
├── js/
│   ├── app-config.js       # Espejo de config (file:// sin fetch); debe coincidir con config/app.json
│   ├── theme-meta.js       # Aplica theme.colorPrimary a meta theme-color
│   ├── format-number.js    # Formato numérico compartido (cotizador, informe, tests)
│   ├── informe-validate.js# Validación estricta del JSON de informe
│   ├── calc-core.js        # Núcleo numérico (compartido con tests)
│   ├── cotizador-main.js   # Lógica Alpine del cotizador
│   ├── sw-register.js      # Registro del SW y utilidades de UI
│   ├── informe-app.js      # Carga y render del informe (DOM seguro)
│   └── vendor/
│       ├── alpine.min.js   # Alpine 3.14.3 (vendoreado)
│       └── html2canvas.min.js
├── tests/                  # Tests Node
├── SHA256SUMS              # Integridad: iconos + JS listados
└── .github/workflows/ci.yml
```

## Requisitos

- Navegador moderno (Chrome, Safari, Firefox, Edge).
- **Node.js 20+** para ejecutar tests y CI local (alineado con `engines` y GitHub Actions).

## Uso local

Sirve la carpeta con cualquier servidor estático (necesario para CSP, SW y rutas relativas):

```bash
npx serve .
# o
python3 -m http.server 8000
```

Abre `http://localhost:8000` (o el puerto indicado). Abrir `index.html` como `file://` sigue siendo limitado para el Service Worker; se recomienda HTTP local.

### Docker (opcional)

```bash
docker build -t cotizador-pina .
docker run --rm -p 8080:80 cotizador-pina
```

## Persistencia

- Configuración multi-estado: clave `cotizador_data_v2` (definida en `config/app.json`); incluye **precio de venta y parámetros** por estado (Veracruz / Colima).
- Informe reciente: clave `cotizacion_informe` (misma fuente de configuración).
- Migración automática desde la clave legada `cotizador_config` hacia el estado por defecto (`estadoDefault`) en la primera carga; el resto de estados queda con valores predeterminados.
- En la pantalla principal: **Exportar respaldo** / **Importar respaldo** (JSON de `cotizador_data_v2`) para copia de seguridad entre navegadores o equipos.

## Tests y verificación

```bash
npm run verify
```

Equivale a `npm audit` más tests (núcleo numérico, paridad `app.json` / `app-config.js`, formato, validación de informe).

Comprobación de integridad (macOS):

```bash
shasum -a 256 -c SHA256SUMS
```

En Linux CI se usa `sha256sum -c SHA256SUMS` (iconos y los JS listados en `SHA256SUMS`).

## Seguridad

- **CSP** en `index.html` e `informe.html`: en el cotizador, `script-src` incluye `'unsafe-eval'` porque **Alpine.js 3** evalúa las expresiones de plantilla (`x-data`, `@click`, `x-model`, etc.) con `new Function`; sin `'unsafe-eval'` el navegador bloquea Alpine y la interfaz no funciona. **`informe.html`** no usa Alpine y mantiene `script-src 'self'` sin eval. **Alpine** también puede aplicar estilos en runtime (`x-show`, etc.), por eso `style-src` incluye `'unsafe-inline'`. Los estilos propios van en `styles.css`.
- **Sin CDN en runtime**: Alpine y html2canvas se sirven desde `js/vendor/`; la integridad de esos archivos se comprueba con `SHA256SUMS` en CI.
- El informe se pinta con **DOM API y `textContent`**; la descarga HTML reconstruye el DOM desde JSON validado, no desde HTML arbitrario en almacenamiento.
- **localStorage / sessionStorage** guardan datos en claro en el dispositivo; no almacenes secretos. Mitigación: CSP estricta en scripts y origen único (`'self'`).

## Despliegue

Sube los archivos a tu hosting estático (GitHub Pages, Netlify, S3, etc.). Los comandos de publicación remota (`git push`, etc.) los ejecuta el operador según la política del equipo.

## Licencia

Uso interno.
