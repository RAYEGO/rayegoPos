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
- `DIRECT_URL`
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

- Los scripts locales usan `scripts/run-with-project-env.mjs` para resolver el entorno antes de ejecutar Vite, Fastify o Prisma.
- Regla de ramas:
  - `main` o `master` -> `.env.production`
  - `develop` -> `.env.development`
  - cualquier otra rama local -> `.env.development`
- Los scripts `*:prod-local` fuerzan `.env.production` sin depender de la rama actual.
- Prisma CLI usa `prisma.config.ts`, resuelve automáticamente el archivo `.env` correcto según la rama y deja de depender del `.env` raíz.
- Dentro de `prisma.config.ts`, Rayego POS remapea `DATABASE_URL` hacia `DIRECT_URL` cuando Prisma CLI está corriendo en local. Eso evita que `migrate`, `db pull` y `db push` caigan en el pooler de Supabase.
- `DATABASE_URL` queda como conexión principal del entorno activo.
- `DATABASE_URL` se usa para runtime y tráfico pooled del backend local.
- `DIRECT_URL` se usa exclusivamente para Prisma CLI cuando el proveedor requiere conexión directa, como Supabase.
- Railway no usa `.env.development` ni `.env.production`; en deploy usa únicamente las variables definidas en Railway.
- Vercel tampoco usa archivos `.env*` del repositorio; usa solo sus variables configuradas en Vercel.

### Comandos útiles

```bash
npm run env:current
npm run env:current:prod-local
```

Estos comandos muestran qué archivo `.env` resolverá el proyecto según la rama actual.

### Prisma + Supabase DEV

En `develop`, Rayego POS usa dos URLs distintas:

```env
# Runtime local / backend
DATABASE_URL="postgresql://...@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require"

# Prisma CLI en red IPv4-only
DIRECT_URL="postgresql://...@aws-0-[region].pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30"
```

Uso operativo:

- `npm run dev:server` / backend local -> `DATABASE_URL`
- `npx prisma migrate status` -> `DIRECT_URL`
- `npx prisma db pull` -> `DIRECT_URL`
- `npx prisma migrate dev` -> `DIRECT_URL`
- `npx prisma db push` -> `DIRECT_URL`

Importante:

- El pooler transaccional de Supabase (`:6543`) es correcto para runtime.
- Prisma CLI no debe usar el pooler transaccional `:6543`.
- En redes solo IPv4, Prisma CLI puede usar el session pooler `:5432` de Supavisor.
- Si el entorno dispone de IPv6 o el proyecto tiene el IPv4 add-on de Supabase, `DIRECT_URL` puede volver al host directo `db.[project-ref].supabase.co:5432`.

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

- `railway:build` ejecuta scripts sin el resolvedor local, por lo que Railway depende solo de sus variables de entorno reales.
- `start:railway` también arranca sin leer archivos `.env*` del repositorio.
