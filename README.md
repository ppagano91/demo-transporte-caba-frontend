# Frontend — Transporte público (Subtes)

React + TypeScript + Vite. Consume el backend FastAPI.

## Desarrollo local

Variables (`.env` / `.env.local`):

```env
VITE_API_BASE_URL=/api
BACKEND_PROXY_TARGET=http://127.0.0.1:8000
```

`BACKEND_PROXY_TARGET` es **obligatoria** para `npm run dev` / `preview`. Sin valor válido (http/https absoluto), Vite no arranca. No hay fallback.

Flujo:

```text
Navegador → http://localhost:5173/api/...
         → proxy de Vite
         → http://127.0.0.1:8000/api/...
```

Comandos (con el backend en el puerto 8000):

```bash
npm install
npm run dev
```

El servidor escucha en `0.0.0.0:5173`, así que desde un celular en la misma red:

```text
http://<IP-LAN-DE-LA-PC>:5173
```

Las peticiones del celular van a `:5173/api/...` (no a `localhost:8000` del teléfono).

## Build

```bash
npm run build
```

Salida: `dist/`.

Vista previa local:

```bash
npm run preview -- --host 0.0.0.0
```

## Producción (Vercel)

No usar el proxy de Vite en producción: no existe en el hosting estático.

Configurar en **Vercel → Project Settings → Environment Variables** (Production):

```env
VITE_API_BASE_URL=https://transporte-publico-backend.onrender.com/api
```

Ajustes del proyecto:

| Campo | Valor |
|---|---|
| Framework Preset | Vite |
| Root Directory | `frontend` (monorepo con backend) |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

`vercel.json` solo define el fallback SPA (`/(.*) → /index.html`) para rutas como `/subtes`. No reescribe `/api`.

Las variables `VITE_*` son públicas (quedan en el bundle del navegador). No poner secretos ahí.

## CORS (Render)

El frontend en Vercel llama directamente a Render. En **Render → Environment**:

```env
CORS_ALLOWED_ORIGINS=https://nombre-proyecto.vercel.app
```

Incluir también orígenes de desarrollo si hace falta:

```env
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://nombre-proyecto.vercel.app
```

Tras el primer deploy, reemplazar `nombre-proyecto` por el dominio real de Vercel. Cada preview adicional debe agregarse de forma explícita (no se permiten todos los `*.vercel.app`).

## Seguridad

- `VITE_API_BASE_URL` es una URL pública; puede verse en el cliente.
- `BACKEND_PROXY_TARGET` solo se usa en el servidor de desarrollo de Vite; no va al bundle.
- Claves de mapas (`VITE_STADIA_MAPS_API_KEY`, etc.) deben ser claves de navegador restringidas por dominio en el proveedor.
