# Controlador Bluetooth HC-05 para Arduino Uno (Vite + TypeScript Vanilla)

Aplicación web estática construida con **Vite** y **TypeScript Vanilla** que solicita permisos Bluetooth/Serial al navegador y convierte los controles direccionales (`up`, `down`, `left`, `right`, `stop`) en señales para un módulo **HC-05** en **Arduino Uno**.

## Requisitos
- Node.js 20+
- Navegador compatible con **Web Serial API** (para HC-05 Bluetooth Clásico SPP) o **Web Bluetooth API** (para módulos BLE): Google Chrome, Microsoft Edge u Opera.
- Contexto seguro (**HTTPS** en producción o `localhost` en desarrollo).

## Comandos Vite

```bash
# Instalar dependencias
npm install

# Desarrollo local (http://localhost:5173)
npm run dev

# Verificar tipos TypeScript
npm run typecheck

# Compilar sitio estático para producción en ./dist
npm run build

# Previsualizar el build de producción (http://localhost:4173)
npm run preview
```

## Despliegue de sitio estático

El build de Vite genera todos los archivos estáticos en la carpeta `dist/` con rutas relativas (`base: './'`), listo para cualquier hosting HTTPS:

- **GitHub Pages**: incluye [.github/workflows/deploy.yml](.github/workflows/deploy.yml). Activa *Settings → Pages → Source: GitHub Actions* y haz push a `main`.
- **Vercel**: incluye [vercel.json](vercel.json) (`framework: vite`, `outputDirectory: dist` y cabecera `Permissions-Policy`).
- **Netlify / Cloudflare Pages**: configura Build command `npm run build` y Publish directory `dist`. Incluye [public/_headers](public/_headers) con `Permissions-Policy: serial=(self), bluetooth=(self)`.
- **Servidor propio (Nginx / Apache / Caddy)**: sube el contenido de `dist/` bajo HTTPS.

## Conexión HC-05 + Arduino Uno
1. Carga el sketch [arduino/hc05_controller.ino](arduino/hc05_controller.ino) en tu Arduino Uno.
2. Empareja el módulo **HC-05** en el sistema operativo (PIN habitual `1234` o `0000`, modo datos a `9600` baud).
3. Abre la web desplegada en HTTPS (o `localhost`) y pulsa **Conectar Bluetooth HC-05**.
