import { AUTH_STORAGE_KEY } from '@/config/auth'
import type { AuthSession } from '@/types/auth'
import {
  decodeJwtPayload,
  isRefreshTokenValid,
  isTokenExpired,
} from '@/utils/jwt'
import { apiRequestRaw } from '@/services/apiClient'

type RefreshResult =
  | { ok: true; session: AuthSession }
  | { ok: false; code: 'NO_REFRESH_TOKEN' | 'REFRESH_INVALID' | 'REFRESH_FAILED' | 'NETWORK_ERROR'; message: string }

let refreshPromise: Promise<RefreshResult> | null = null

function readSessionFromStorage(): AuthSession | null {
  const raw =
    window.localStorage.getItem(AUTH_STORAGE_KEY) ??
    window.sessionStorage.getItem(AUTH_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthSession
  } catch {
    return null
  }
}

function writeSessionToStorage(session: AuthSession): void {
  const inLocal = window.localStorage.getItem(AUTH_STORAGE_KEY) !== null
  const storage = inLocal ? window.localStorage : window.sessionStorage
  storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}

function clearSessionFromStorage(): void {
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY)
}

export type SessionWriteTarget = 'local' | 'session'

export function setSessionStorageTarget(session: AuthSession, target: SessionWriteTarget): void {
  clearSessionFromStorage()
  const storage = target === 'local' ? window.localStorage : window.sessionStorage
  storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}

export async function performTokenRefresh(): Promise<RefreshResult> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async (): Promise<RefreshResult> => {
    try {
      const stored = readSessionFromStorage()
      const refreshToken = stored?.refreshToken

      if (!refreshToken) {
        return {
          ok: false,
          code: 'NO_REFRESH_TOKEN',
          message: 'No hay un token de renovación disponible.',
        }
      }

      const decoded = decodeJwtPayload(refreshToken)
      if (!isRefreshTokenValid(refreshToken)) {
        clearSessionFromStorage()
        return {
          ok: false,
          code: 'REFRESH_INVALID',
          message:
            decoded && typeof decoded.exp === 'number' && isTokenExpired(refreshToken)
              ? 'El token de renovación ha expirado.'
              : 'El token de renovación no es válido.',
        }
      }

      const res = await apiRequestRaw<AuthSession>('/api/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
        skipAuth: true,
      })

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          clearSessionFromStorage()
        }
        return {
          ok: false,
          code: res.status === 401 || res.status === 403 ? 'REFRESH_INVALID' : 'REFRESH_FAILED',
          message: res.errorMessage ?? 'No se pudo renovar la sesión.',
        }
      }

      if (!res.data) {
        return {
          ok: false,
          code: 'REFRESH_FAILED',
          message: 'No se recibió la sesión del servidor.',
        }
      }

      writeSessionToStorage(res.data)
      return { ok: true, session: res.data }
    } catch {
      return {
        ok: false,
        code: 'NETWORK_ERROR',
        message: 'No fue posible comunicarse con el servidor para renovar la sesión.',
      }
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export function peekStoredSession(): AuthSession | null {
  return readSessionFromStorage()
}

export function overwriteStoredSession(session: AuthSession): void {
  writeSessionToStorage(session)
}

export function clearAllSessionStorage(): void {
  clearSessionFromStorage()
}
