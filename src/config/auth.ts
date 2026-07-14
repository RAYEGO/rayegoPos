export const AUTH_STORAGE_KEY = 'rayego-pos.auth.session'
const DEFAULT_PRODUCTION_API_BASE_URL = 'https://api-production-1693.up.railway.app'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  (import.meta.env.PROD ? DEFAULT_PRODUCTION_API_BASE_URL : '')
export const AUTH_ALLOW_MOCKS = import.meta.env.VITE_AUTH_ALLOW_MOCKS === 'true'
