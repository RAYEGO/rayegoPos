import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { config as loadEnvFile } from 'dotenv'

const BRANCH_ENV_MAP = new Map([
  ['main', 'production'],
  ['master', 'production'],
  ['develop', 'development'],
])

const DEFAULT_LOCAL_ENV = 'development'

export const ENV_FILES = {
  development: '.env.development',
  production: '.env.production',
}

export function getCurrentGitBranch() {
  try {
    return execSync('git branch --show-current', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

export function isManagedPlatform() {
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT_NAME ||
      process.env.RAILWAY_PROJECT_ID ||
      process.env.RAILWAY_SERVICE_ID ||
      process.env.VERCEL === '1' ||
      process.env.VERCEL_ENV,
  )
}

export function resolveProjectEnvironment(requestedEnv = null) {
  if (requestedEnv) {
    return {
      mode: requestedEnv,
      envFile: resolve(process.cwd(), ENV_FILES[requestedEnv]),
      source: 'argumento',
      branch: getCurrentGitBranch(),
      managedPlatform: false,
    }
  }

  if (isManagedPlatform()) {
    return {
      mode: process.env.NODE_ENV === 'production' ? 'production' : 'platform',
      envFile: null,
      source: 'plataforma',
      branch: null,
      managedPlatform: true,
    }
  }

  const branch = getCurrentGitBranch()
  const mode = BRANCH_ENV_MAP.get(branch ?? '') ?? DEFAULT_LOCAL_ENV

  return {
    mode,
    envFile: resolve(process.cwd(), ENV_FILES[mode]),
    source: branch ? `rama:${branch}` : 'fallback-local',
    branch,
    managedPlatform: false,
  }
}

export function loadResolvedProjectEnvironment(target) {
  if (!target.envFile) {
    return target
  }

  if (!existsSync(target.envFile)) {
    throw new Error(`No existe el archivo de entorno requerido: ${target.envFile}`)
  }

  loadEnvFile({
    path: target.envFile,
    override: false,
  })

  process.env.RAYEGO_ENV_MODE = target.mode
  process.env.RAYEGO_ENV_SOURCE = target.source
  process.env.RAYEGO_ENV_FILE = target.envFile

  return target
}
