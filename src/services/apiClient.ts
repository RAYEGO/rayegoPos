import { API_BASE_URL } from '@/config/auth'
import { authMockService } from '@/services/authMockService'
import {
  clearAllSessionStorage,
  performTokenRefresh,
  peekStoredSession,
} from '@/services/tokenManager'
import { isAccessTokenValid } from '@/utils/jwt'

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  accessToken?: string
  skipAuth?: boolean
  skipRefresh?: boolean
}

type ApiErrorPayload = {
  message?: string
  code?: string
  issues?: {
    formErrors?: string[]
    fieldErrors?: Record<string, string[] | undefined>
  }
}

export class ApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export class ApiNetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiNetworkError'
  }
}

export type ApiRawResult<T> =
  | { ok: true; data: T; status: number }
  | {
      ok: false
      data: ApiErrorPayload | null
      status: number
      errorMessage: string
      code?: string
    }

function resolveApiUrl(path: string) {
  const base = String(API_BASE_URL ?? '').trim()
  if (!base) return path

  const normalizedBase = base.replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (normalizedPath.startsWith('/api/')) {
    const baseWithoutApi = normalizedBase.replace(/\/api$/i, '')
    if (baseWithoutApi !== normalizedBase) {
      return `${baseWithoutApi}${normalizedPath}`
    }
  }

  return `${normalizedBase}${normalizedPath}`
}

function getFirstApiValidationMessage(payload: ApiErrorPayload | null) {
  const formMessage = payload?.issues?.formErrors?.find(
    (entry) => typeof entry === 'string' && entry.trim().length > 0,
  )
  if (formMessage) return formMessage

  const fieldEntries = Object.entries(payload?.issues?.fieldErrors ?? {})
  for (const [field, messages] of fieldEntries) {
    const message = messages?.find((entry) => typeof entry === 'string' && entry.trim().length > 0)
    if (message) return `${field}: ${message}`
  }
  return null
}

function resolveAccessToken(explicitToken?: string): string | undefined {
  if (explicitToken) return explicitToken
  const stored = peekStoredSession()
  return stored?.accessToken
}

export async function apiRequestRaw<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiRawResult<T>> {
  const method = options.method ?? 'GET'
  const authToken = options.skipAuth ? undefined : resolveAccessToken(options.accessToken)
  const authPreview = authToken
    ? `Bearer ${authToken.slice(0, 16)}...`
    : '(sin Authorization header)'
  console.debug(`[API] REQUEST → ${method} ${path} | Authorization: ${authPreview}`)

  let response: Response
  try {
    const headers: Record<string, string> = {}
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json'
    }
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`
    }

    response = await fetch(resolveApiUrl(path), {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    return {
      ok: false,
      data: null,
      status: 0,
      errorMessage: 'No fue posible conectar con la API. Verifica que el backend esté levantado.',
    }
  }

  if (response.status === 204) {
    console.debug(`[API] RESPONSE ← ${method} ${path} | status=${response.status} (no content)`)
    return { ok: true, data: undefined as T, status: response.status }
  }

  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | T | null

  if (!response.ok) {
    const errPayload = payload as ApiErrorPayload | null
    const apiMessage =
      getFirstApiValidationMessage(errPayload) ??
      errPayload?.message ??
      'La API respondió con un error.'
    console.warn(
      `[API] RESPONSE ERROR ← ${method} ${path} | status=${response.status} | message="${apiMessage}" | payloadKeys=${errPayload ? Object.keys(errPayload).join(',') : 'null'}`,
    )
    return {
      ok: false,
      data: errPayload,
      status: response.status,
      errorMessage: apiMessage,
      code: errPayload?.code,
    }
  }

  console.debug(
    `[API] RESPONSE OK ← ${method} ${path} | status=${response.status} | bodyKeys=${payload ? Object.keys(payload as Record<string, unknown>).join(',') : 'null'}`,
  )
  return { ok: true, data: payload as T, status: response.status }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  if (!options.skipAuth && !options.accessToken && !options.skipRefresh) {
    const stored = peekStoredSession()
    if (stored?.accessToken && !isAccessTokenValid(stored.accessToken, 30_000)) {
      if (stored.refreshToken) {
        console.debug(
          `[API] Access token cerca de expirar antes de ${path}. Intentando refresh silencioso.`,
        )
        const ref = await performTokenRefresh()
        if (ref.ok && ref.session.accessToken) {
          options = { ...options, accessToken: ref.session.accessToken }
        }
      }
    }
  }

  let result = await apiRequestRaw<T>(path, options)

  if (
    !options.skipAuth &&
    !options.skipRefresh &&
    !result.ok &&
    result.status === 401
  ) {
    const stored = peekStoredSession()
    const hasRefresh = Boolean(stored?.refreshToken)
    const sessionIsMock = stored && authMockService.isMockSession(stored)

    if (!sessionIsMock && hasRefresh) {
      console.warn(
        `[API] 401 en ${path}. Se intentará renovar accessToken vía refreshToken y reintentar una vez.`,
      )
      const refresh = await performTokenRefresh()
      if (refresh.ok) {
        result = await apiRequestRaw<T>(path, {
          ...options,
          accessToken: refresh.session.accessToken,
          skipRefresh: true,
        })
      } else if (refresh.code === 'REFRESH_INVALID') {
        console.warn(
          `[API] Refresh token inválido/expirado en ${path}. Destruyendo sesión almacenada.`,
        )
        clearAllSessionStorage()
      }
    }
  }

  if (result.ok) return result.data

  if (result.status === 0) {
    throw new ApiNetworkError(result.errorMessage)
  }
  throw new ApiError(result.errorMessage, result.status, result.code)
}

export async function apiRequestBlob(
  path: string,
  options: ApiRequestOptions = {},
): Promise<Blob> {
  const authToken = options.skipAuth ? undefined : resolveAccessToken(options.accessToken)
  try {
    const response = await fetch(resolveApiUrl(path), {
      method: options.method ?? 'GET',
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null
      throw new ApiError(payload?.message ?? 'La API respondió con un error.', response.status)
    }

    return response.blob()
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiNetworkError(
      'No fue posible conectar con la API. Verifica que el backend esté levantado.',
    )
  }
}
