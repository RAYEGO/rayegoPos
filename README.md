# Rayego POS

Frontend y base backend para un POS de botica/farmacia en Peru.

## Stack

- Frontend: React + Vite + TypeScript + Tailwind
- Backend inicial: Fastify + Prisma + PostgreSQL
- Seguridad: JWT + RBAC

## Scripts principales

```bash
npm run dev
npm run dev:server
npm run build
npm run build:server
npm run lint
npm run prisma:seed
```

## Variables de entorno

Usa `.env.example` como punto de partida.

Variables importantes:

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `PORT`
- `FRONTEND_ORIGIN`
- `VITE_API_BASE_URL`
- `VITE_AUTH_ALLOW_MOCKS`

## Autenticación

Se agregó una API real en `server/src` con endpoints:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

El frontend ahora consume esta API desde `src/services/authService.ts`.

Si deseas seguir usando credenciales demo mientras no levantas backend o base de datos, puedes habilitar:

```bash
VITE_AUTH_ALLOW_MOCKS=true
```

## Seed inicial

El seed crea:

- empresa base
- sucursal principal
- permisos
- roles
- usuarios demo

Credenciales:

- `admin@rayego.pe` / `RayegoPOS2026!`
- `supervisor@rayego.pe` / `RayegoSupervisor2026!`
- `caja@rayego.pe` / `RayegoCaja2026!`

## Deploy del backend en Railway

El repositorio incluye `railway.json` para desplegar solo la API Fastify.

Variables requeridas en Railway:

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `PORT`
- `HOST=0.0.0.0`
- `FRONTEND_ORIGIN`

Ejemplo de `FRONTEND_ORIGIN`:

```bash
FRONTEND_ORIGIN="https://tu-app.vercel.app,https://*.vercel.app"
```

Comportamiento en Railway:

- build: `npm run railway:build`
- start: `npm run start:railway`
- healthcheck: `/health`
