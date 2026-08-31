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

export async function systemRoutes(app: FastifyInstance) {
  app.get('/environment', async (request): Promise<EnvironmentResponse> => {
    await requirePermission(request, 'configuracion.read')

    const envMode = normalizeMode(
      process.env.RAYEGO_ENV_MODE || process.env.APP_ENV || process.env.NODE_ENV,
    )
    const apiName = String(process.env.RAYEGO_API_NAME ?? '').trim() || (envMode === 'production' ? 'Api-prod' : envMode === 'development' ? 'Api-dev' : 'Rayego POS API')
    const dbName = String(process.env.RAYEGO_DB_NAME ?? '').trim() || (envMode === 'production' ? 'Postgres-prod' : envMode === 'development' ? 'Postgres-dev' : 'Postgres')
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
