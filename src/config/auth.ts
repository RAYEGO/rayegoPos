export const AUTH_STORAGE_KEY = 'rayego-pos.auth.session'
const DEFAULT_PRODUCTION_API_BASE_URL = 'https://api-production-1693.up.railway.app'
const DEFAULT_DEVELOPMENT_API_BASE_URL = 'https://api-dev-dev-27e4.up.railway.app'

const explicitBase = (import.meta.env.VITE_API_BASE_URL ?? '').toString().trim()
const isVercelProduction = (import.meta.env.VERCEL_ENV === 'production')
const isBuiltinViteProduction = Boolean(import.meta.env.PROD)

let resolvedBase: string
if (explicitBase) {
  resolvedBase = explicitBase
} else if (isVercelProduction) {
  resolvedBase = DEFAULT_PRODUCTION_API_BASE_URL
} else if (!isBuiltinViteProduction) {
  resolvedBase = DEFAULT_DEVELOPMENT_API_BASE_URL
} else {
  console.warn(
    '[auth] VITE_API_BASE_URL no está definida y este build no es Vercel Production. ' +
      'Se usará API DEV por defecto (Railway). Si deseas apuntar a una URL distinta configura VITE_API_BASE_URL en Vercel/Preview/env local.',
  )
  resolvedBase = DEFAULT_DEVELOPMENT_API_BASE_URL
}

export const API_BASE_URL = resolvedBase

const rawAllowMocks = String(import.meta.env.VITE_AUTH_ALLOW_MOCKS ?? '').trim().toLowerCase()
export const AUTH_ALLOW_MOCKS: boolean =
  rawAllowMocks === '1' || rawAllowMocks === 'true' || rawAllowMocks === 'on'
    ? true
    : false
