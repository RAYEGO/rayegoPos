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
npm run env:check:dev
npm run prisma:validate
npm run lint
npm run prisma:seed
```

## Entornos

Rayego POS queda separado por entorno:

- `Development (DEV)`:
  - archivo local: `.env.development`
  - base de datos: Supabase DEV
  - scripts locales por defecto: `npm run dev`, `npm run dev:server`, `npm run build`, `npm run prisma:*`

- `Production (PROD)`:
  - archivo local opcional: `.env.production`
  - base de datos real: Railway
  - scripts locales de simulación: `npm run dev:prod-local`, `npm run build:prod-local`, `npm run prisma:validate:prod-local`

Usa `.env.example` como referencia de variables requeridas sin credenciales.

### Variables importantes

- `APP_ENV`
- `DATABASE_URL`
- `JWT_SECRET`
- `PORT`
- `HOST`
- `FRONTEND_ORIGIN`
- `VITE_API_BASE_URL`
- `VITE_PROXY_API_TARGET`
- `VITE_AUTH_ALLOW_MOCKS`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Cómo funciona la carga automática

- Los scripts locales usan `dotenv-cli` para cargar automáticamente `.env.development`.
- Los scripts `*:prod-local` cargan `.env.production` para pruebas locales de producción.
- Prisma sigue leyendo `env("DATABASE_URL")` desde `schema.prisma`, pero ahora el valor correcto se inyecta según el script ejecutado.
- Railway no usa `.env.development` ni `.env.production`; en deploy usa únicamente las variables definidas en Railway.

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
- `JWT_SECRET`
- `PORT`
- `HOST=0.0.0.0`
- `FRONTEND_ORIGIN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Ejemplo de `FRONTEND_ORIGIN`:

```bash
FRONTEND_ORIGIN="https://tu-app.vercel.app,https://*.vercel.app"
```

Comportamiento en Railway:

- build: `npm run railway:build`
- start: `npm run start:railway`
- healthcheck: `/health`

Detalles:

- `railway:build` ejecuta scripts sin `dotenv-cli`, por lo que Railway depende solo de sus variables de entorno reales.
- `start:railway` también arranca sin leer archivos `.env*` del repositorio.
