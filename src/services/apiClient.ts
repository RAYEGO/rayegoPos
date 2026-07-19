import { API_BASE_URL } from '@/config/auth'

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  accessToken?: string
}

type ApiErrorPayload = {
  message?: string
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export class ApiNetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiNetworkError'
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.accessToken
          ? { Authorization: `Bearer ${options.accessToken}` }
          : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })

    if (response.status === 204) {
      return undefined as T
    }

    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null

    if (!response.ok) {
      throw new ApiError(
        payload?.message ?? 'La API respondió con un error.',
        response.status,
      )
    }

    return payload as T
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    throw new ApiNetworkError(
      'No fue posible conectar con la API. Verifica que el backend esté levantado.',
    )
  }
}

export async function apiRequestBlob(
  path: string,
  options: ApiRequestOptions = {},
): Promise<Blob> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.accessToken
          ? { Authorization: `Bearer ${options.accessToken}` }
          : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null
      throw new ApiError(payload?.message ?? 'La API respondió con un error.', response.status)
    }

    return response.blob()
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    throw new ApiNetworkError(
      'No fue posible conectar con la API. Verifica que el backend esté levantado.',
    )
  }
}
