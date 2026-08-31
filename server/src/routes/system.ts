import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { requirePermission } from '../lib/auth.js'

type EnvironmentMode = 'development' | 'production' | 'staging' | 'unknown'

const ENV_MODE_NORMALIZED: Record<string, EnvironmentMode> = {
  development: 'development',
  dev: 'development',
  production: 'production',
  prod: 'production',
  staging: 'staging',
}

function normalizeMode(input?: string | null): EnvironmentMode {
  if (!input) return 'unknown'
  const key = input.trim().toLowerCase()
  return ENV_MODE_NORMALIZED[key] ?? 'unknown'
}

function resolveBranch(): string | null {
  const explicit = String(process.env.RAYEGO_BRANCH ?? '').trim()
  if (explicit) return explicit
  const raw = process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.VERCEL_GIT_COMMIT_REF ?? process.env.RAYEGO_ENV_SOURCE ?? ''
  const s = String(raw)
  if (!s) return null
  if (s.startsWith('rama:')) return s.slice('rama:'.length)
  if (s === 'production' || s === 'main') return 'main'
  if (s === 'development' || s === 'develop' || s === 'dev') return 'develop'
  return s
}

async function isDatabaseConnected(): Promise<boolean> {
  try {
    const result = (await prisma.$queryRawUnsafe('SELECT 1 AS rayego_ping LIMIT 1')) as any
    if (Array.isArray(result)) {
      const first = result[0] as any
      return first && Number(first?.rayego_ping ?? first?.ping ?? first?.['?column?']) === 1
    }
    return true
  } catch {
    return false
  }
}

type EnvironmentResponse = {
  environment: EnvironmentMode
  api: string
  database: string
  branch: string | null
  databaseConnected: boolean
}

function resolveMode(): EnvironmentMode {
  const explicit = process.env.RAYEGO_ENV_MODE || process.env.APP_ENV || process.env.NODE_ENV
  if (explicit) {
    const n = normalizeMode(explicit)
    if (n !== 'unknown') return n
  }
  const railwayEnv = String(process.env.RAILWAY_ENVIRONMENT_NAME ?? '').trim().toLowerCase()
  if (railwayEnv === 'production' || railwayEnv === 'prod') return 'production'
  if (railwayEnv === 'development' || railwayEnv === 'develop' || railwayEnv === 'dev') return 'development'
  if (railwayEnv === 'staging') return 'staging'
  return normalizeMode(explicit)
}

function resolveApiName(envMode: EnvironmentMode): string {
  const explicitRayego = String(process.env.RAYEGO_API_NAME ?? '').trim()
  if (explicitRayego) return explicitRayego
  const railwayService = String(process.env.RAILWAY_SERVICE_NAME ?? '').trim()
  if (railwayService) return railwayService
  return envMode === 'production' ? 'Api-prod' : envMode === 'development' ? 'Api-dev' : 'Rayego POS API'
}

function resolveDatabaseName(envMode: EnvironmentMode): string {
  const explicitRayego = String(process.env.RAYEGO_DB_NAME ?? '').trim()
  if (explicitRayego) return explicitRayego
  const railwayEnv = String(process.env.RAILWAY_ENVIRONMENT_NAME ?? '').trim().toLowerCase()
  if (railwayEnv === 'production' || railwayEnv === 'prod') return 'Postgres-prod'
  if (railwayEnv === 'development' || railwayEnv === 'develop' || railwayEnv === 'dev') return 'Postgres-dev'
  return envMode === 'production' ? 'Postgres-prod' : envMode === 'development' ? 'Postgres-dev' : 'Postgres'
}

export async function systemRoutes(app: FastifyInstance) {
  app.get('/environment', async (request): Promise<EnvironmentResponse> => {
    await requirePermission(request, 'configuracion.read')

    const envMode = resolveMode()
    const apiName = resolveApiName(envMode)
    const dbName = resolveDatabaseName(envMode)
    const branch = resolveBranch()

    const databaseConnected = await isDatabaseConnected()

    return {
      environment: envMode,
      api: apiName,
      database: dbName,
      branch,
      databaseConnected,
    }
  })
}
