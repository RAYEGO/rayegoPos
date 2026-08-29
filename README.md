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
npm run env:current
npm run prisma:validate
npm run lint
npm run prisma:seed
```

## Entornos

Rayego POS queda separado por entorno:

- `Development (DEV)`:
  - archivo local: `.env.development`
  - base de datos: PostgreSQL en Railway
  - scripts locales por defecto: `npm run dev`, `npm run dev:server`, `npm run build`, `npm run prisma:*`

- `Production (PROD)`:
  - archivo local opcional: `.env.production`
  - base de datos: PostgreSQL en Railway
  - scripts locales de simulación: `npm run dev:prod-local`, `npm run build:prod-local`, `npm run prisma:validate:prod-local`

Usa `.env.example` como referencia de variables requeridas sin credenciales.

### Variables importantes

- `APP_ENV`
- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `PORT`
- `HOST`
- `FRONTEND_ORIGIN`
- `VITE_API_BASE_URL`
- `VITE_PROXY_API_TARGET`
- `VITE_AUTH_ALLOW_MOCKS`
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_COMPANY_ASSETS`
- `R2_PUBLIC_BASE_URL`
- `R2_REGION`

### Cómo funciona la carga automática

- Los scripts locales usan `scripts/run-with-project-env.mjs` para resolver el entorno antes de ejecutar Vite, Fastify o Prisma.
- Regla de ramas:
  - `main` o `master` -> `.env.production`
  - `develop` -> `.env.development`
  - cualquier otra rama local -> `.env.development`
- Los scripts `*:prod-local` fuerzan `.env.production` sin depender de la rama actual.
- Prisma CLI usa `prisma.config.ts`, resuelve automáticamente el archivo `.env` correcto según la rama y deja de depender del `.env` raíz.
- `DATABASE_URL` queda como conexión principal del entorno activo.
- `DATABASE_URL` se usa para runtime y tráfico pooled del backend local.
- `DIRECT_URL` se usa exclusivamente para Prisma CLI cuando el proveedor requiere conexión directa (si aplica).
- Railway no usa `.env.development` ni `.env.production`; en deploy usa únicamente las variables definidas en Railway.
- Vercel tampoco usa archivos `.env*` del repositorio; usa solo sus variables configuradas en Vercel.

### Comandos útiles

```bash
npm run env:current
npm run env:current:prod-local
```

Estos comandos muestran qué archivo `.env` resolverá el proyecto según la rama actual.

### Prisma (PostgreSQL)

- `DATABASE_URL`: runtime del backend.
- `DIRECT_URL`: Prisma CLI cuando se requiera una conexión directa (si aplica al proveedor de PostgreSQL).

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
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_COMPANY_ASSETS`
- `R2_PUBLIC_BASE_URL`
- `R2_REGION=auto`

Ejemplo de `FRONTEND_ORIGIN`:

```bash
FRONTEND_ORIGIN="https://tu-app.vercel.app,https://*.vercel.app"
```

Comportamiento en Railway:

- build: `npm run railway:build`
- start: `npm run start:railway`
- healthcheck: `/health`

Detalles:

- `railway:build` ejecuta scripts sin el resolvedor local, por lo que Railway depende solo de sus variables de entorno reales.
- `start:railway` también arranca sin leer archivos `.env*` del repositorio.
