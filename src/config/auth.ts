export const AUTH_STORAGE_KEY = 'rayego-pos.auth.session'
const DEFAULT_PRODUCTION_API_BASE_URL = 'https://api-production-1693.up.railway.app'

const explicitBase = (import.meta.env.VITE_API_BASE_URL ?? '').toString().trim()
const isVercelProduction = (import.meta.env.VERCEL_ENV === 'production')
const isBuiltinViteProduction = Boolean(import.meta.env.PROD)

let resolvedBase: string
if (explicitBase) {
  resolvedBase = explicitBase
} else if (isVercelProduction) {
  resolvedBase = DEFAULT_PRODUCTION_API_BASE_URL
} else if (!isBuiltinViteProduction) {
  resolvedBase = ''
} else {
  console.warn(
    '[auth] VITE_API_BASE_URL no está definida y este build no es Vercel Production. ' +
    'Las llamadas a la API van a fallar hasta que configures la variable correctamente en Vercel. ' +
    'Preview develop debe apuntar a Api-dev Railway (ej: https://api-development-XXXX.up.railway.app).',
  )
  resolvedBase = ''
}

export const API_BASE_URL = resolvedBase

export const AUTH_ALLOW_MOCKS = true
