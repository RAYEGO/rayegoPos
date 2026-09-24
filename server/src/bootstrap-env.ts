import process from 'node:process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config as loadEnvFile } from 'dotenv'

const PLATFORM_MARKERS = ['RAILWAY_ENVIRONMENT_NAME', 'VERCEL', 'LAMBDA_TASK_ROOT', 'AWS_LAMBDA_FUNCTION_NAME']
const managedPlatform = PLATFORM_MARKERS.some((marker) => Object.prototype.hasOwnProperty.call(process.env, marker))

if (!managedPlatform && !Object.prototype.hasOwnProperty.call(process.env, 'DATABASE_URL')) {
  const candidates = [
    process.env.RAYEGO_ENV_FILE ? resolve(process.env.RAYEGO_ENV_FILE) : null,
    resolve(process.cwd(), '.env.local'),
    resolve(process.cwd(), '.env.development'),
    resolve(process.cwd(), '.env'),
  ].filter((path): path is string => typeof path === 'string' && existsSync(path))

  const chosen = candidates[0]
  if (chosen) {
    loadEnvFile({
      path: chosen,
      override: false,
    })
    process.env.RAYEGO_ENV_SOURCE = process.env.RAYEGO_ENV_SOURCE ?? 'server-bootstrap'
    process.env.RAYEGO_ENV_MODE = process.env.RAYEGO_ENV_MODE ?? (chosen.endsWith('.env.production') ? 'production' : 'development')
    process.env.RAYEGO_ENV_FILE = process.env.RAYEGO_ENV_FILE ?? chosen
  }
}

export {}
