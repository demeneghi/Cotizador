# Cotizador de Piña - PWA

Aplicación web progresiva (PWA) para el departamento de ventas que permite calcular precios de piña por kilogramo considerando diferentes tipos de flete y costos asociados.

## Características

- **PWA Instalable**: Funciona como aplicación nativa en dispositivos móviles
- **Modo Offline**: Service Worker para uso sin conexión
- **Cálculos en Tiempo Real**: Actualización instantánea de resultados
- **Persistencia de Datos**: LocalStorage para guardar configuraciones
- **Responsive Design**: Optimizado para iPhone y dispositivos móviles
- **Teclado Numérico**: Interfaz optimizada para entrada de datos móvil

## Tecnologías

- **HTML5** - Estructura y semántica
- **CSS3** - Estilos y diseño responsive
- **Alpine.js** - Reactividad y manejo de estado
- **Service Worker** - Funcionalidad PWA y cache offline
- **LocalStorage** - Persistencia de configuración del usuario

## Estructura del Proyecto

```
Cotizador-WEB/
├── index.html          # Aplicación principal
├── config.json         # Configuración predeterminada
├── manifest.json       # Configuración PWA
├── sw.js              # Service Worker
├── server.py          # Servidor Python para desarrollo local
├── icon-192.png       # Icono PWA 192x192
├── icon-512.png       # Icono PWA 512x512
└── requirements.txt   # Dependencias Python
```

## Uso Local

### Con Python

```bash
python server.py
```

Luego abre `http://localhost:8000` en tu navegador.

### Con otros servidores

Puedes usar cualquier servidor web estático como:

```bash
# Node.js
npx serve

# Python 3
python -m http.server 8000
```

## Instalación como PWA

### En iPhone/iPad:
1. Abre la app en Safari
2. Toca el botón "Compartir"
3. Selecciona "Agregar a pantalla de inicio"
4. La app se instalará como aplicación nativa

### En Android:
1. Abre la app en Chrome
2. Toca el menú (⋮)
3. Selecciona "Instalar aplicación"
4. La app se instalará automáticamente

## Funcionalidades

### Datos Principales
- **Precio de Venta (USD)**: Precio de venta por caja
- **Tipo de Cambio (MXN)**: Conversión USD a pesos mexicanos

### Resultados
- **Precio/Kg Flete Corto**: Precio por kilogramo para flete corto
- **Precio/Kg Flete Largo**: Precio por kilogramo para flete largo

### Parámetros Configurables

**Parámetros Básicos:**
- Comisión de Venta (%)
- Peso por Caja (kg)

**Transporte y Logística:**
- Costo Flete Corto (MXN)
- Costo Flete Largo (MXN)
- Número de Cajas por tipo de flete

**Costos de Embarque (USD):**
- Costo Aduana
- Costo Manejo por Caja
- Costo Sobrepeso (solo flete largo)

**Costos de Empaque:**
- Costo Cartón por Caja (USD)
- Costo Empaque por Caja (MXN)

### Flujo de Cálculos

La aplicación incluye una sección interactiva que muestra paso a paso cómo se calculan los precios:

1. Conversión de costos MXN a USD
2. Cálculo de gastos totales de embarque
3. Prorrateo de gastos por caja
4. Aplicación de comisión de venta
5. Cálculo de precio neto
6. Conversión a MXN
7. División por peso para obtener precio por kilogramo

## Fórmulas

### Gastos de Embarque
```
Gastos = (Flete MXN ÷ Tipo Cambio) 
       + Aduana 
       + (Cartón × Cajas) 
       + (Empaque MXN ÷ Tipo Cambio × Cajas) 
       + (Manejo × Cajas)
       + Sobrepeso (solo flete largo)
```

### Precio por Kilogramo
```
Precio Neto = Precio Venta - (Precio Venta × Comisión% ÷ 100) - (Gastos ÷ Cajas)
Precio/Kg = (Precio Neto × Tipo Cambio) ÷ Peso Caja
```

## Gestión de Configuración

- **Guardado Automático**: Los cambios se guardan automáticamente en localStorage
- **Guardado Manual**: Botón "Guardar Configuración" para confirmar cambios
- **Restaurar Valores**: Botón para volver a la configuración predeterminada

## Compatibilidad

- **iOS Safari**: 12.2+
- **Chrome/Edge**: 80+
- **Firefox**: 75+
- **Samsung Internet**: 10+

## Optimizaciones para Móvil

- Teclado numérico automático en dispositivos móviles
- Áreas táctiles mínimas de 44px (Apple HIG)
- Soporte para notch de iPhone (safe areas)
- Scroll suave nativo de iOS
- Sin zoom automático en inputs
- Feedback táctil en botones

## Desarrollo

### Modificar Valores Predeterminados

Edita el archivo `config.json` con los valores deseados:

```json
{
  "tipo_cambio": 18.50,
  "comision_venta": 10.00,
  "peso_caja": 11.40,
  ...
}
```

### Personalizar Estilos

Los estilos CSS están embebidos en `index.html`. El tema usa:
- Color primario: `#667eea` (morado)
- Color secundario: `#764ba2` (morado oscuro)
- Color success: `#48bb78` (verde)
- Color danger: `#e53e3e` (rojo)

## Despliegue

### Vercel
```bash
vercel --prod
```

### GitHub Pages
```bash
git push origin main
```

### Netlify
Arrastra la carpeta del proyecto a Netlify Drop

## Licencia

Uso interno - Departamento de Ventas

## Contacto

Para soporte o modificaciones, contacta al equipo de desarrollo.

