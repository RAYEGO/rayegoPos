import { AUTH_ALLOW_MOCKS } from '@/config/auth'
import type {
  AuthBranchSelectionResponse,
  AuthSession,
  ForgotPasswordPayload,
  ForgotPasswordResult,
  LoginPayload,
  ResetPasswordPayload,
} from '@/types/auth'
import { apiRequest, ApiError, ApiNetworkError } from '@/services/apiClient'
import { authMockService } from '@/services/authMockService'
import {
  overwriteStoredSession,
  peekStoredSession,
  performTokenRefresh,
  setSessionStorageTarget,
} from '@/services/tokenManager'
import { isRefreshTokenValid } from '@/utils/jwt'

function shouldFallbackToMock(
  error: unknown,
  endpoint: 'login' | 'restoreSession' | 'logout' | 'requestPasswordReset' | 'resetPassword' | 'refreshSession' = 'restoreSession',
  loginPayload?: LoginPayload,
) {
  void error
  void endpoint
  void loginPayload
  return AUTH_ALLOW_MOCKS
}

export class BranchSelectionRequiredError extends Error {
  branches: AuthBranchSelectionResponse['branches']

  constructor(branches: AuthBranchSelectionResponse['branches']) {
    super('Selecciona una sucursal para continuar.')
    this.name = 'BranchSelectionRequiredError'
    this.branches = branches
  }
}

function isBranchSelectionResponse(
  response: AuthSession | AuthBranchSelectionResponse,
): response is AuthBranchSelectionResponse {
  return (
    'requiresBranchSelection' in response &&
    response.requiresBranchSelection === true
  )
}

export type RefreshSessionResult =
  | { ok: true; session: AuthSession }
  | {
      ok: false
      code: 'NO_REFRESH_TOKEN' | 'REFRESH_INVALID' | 'REFRESH_FAILED' | 'NETWORK_ERROR'
      message: string
    }

export const authService = {
  async login(payload: LoginPayload): Promise<AuthSession> {
    try {
      console.debug(
        `[AUTH] authService.login: POST /api/auth/login REAL con email=${payload.email} branchId=${payload.branchId ?? 'auto'}`,
      )
      const response = await apiRequest<AuthSession | AuthBranchSelectionResponse>(
        '/api/auth/login',
        {
        method: 'POST',
        skipAuth: true,
        skipRefresh: true,
        body: {
          email: payload.email,
          password: payload.password,
          branchId: payload.branchId,
        },
        },
      )

      if (isBranchSelectionResponse(response)) {
        throw new BranchSelectionRequiredError(response.branches)
      }

      console.debug(
        `[AUTH] authService.login: LOGIN REAL EXITOSO accessToken=${response.accessToken?.slice(0, 16)}... user.rolesTipo=${typeof (response as AuthSession).user?.roles} rolesPresentes=${'user' in response && 'roles' in (response as AuthSession).user}`,
      )
      setSessionStorageTarget(response, payload.remember ? 'local' : 'session')
      return response
    } catch (error) {
      if (error instanceof BranchSelectionRequiredError) {
        throw error
      }

      if (shouldFallbackToMock(error, 'login', payload)) {
        const errStatus = error instanceof ApiError ? error.status : 'NETWORK'
        const errMessage = error instanceof ApiError || error instanceof ApiNetworkError
          ? error.message
          : String(error)
        console.warn(
          `[AUTH] authService.login: LOGIN REAL FAILED (status=${errStatus} message="${errMessage}"). FALLBACK → authMockService.login() se activa porque VITE_AUTH_ALLOW_MOCKS=true.`,
        )
        const mockSession = await authMockService.login(payload)
        setSessionStorageTarget(mockSession, payload.remember ? 'local' : 'session')
        return mockSession
      }

      if (error instanceof ApiError || error instanceof ApiNetworkError) {
        throw error
      }

      throw new Error('No se pudo iniciar sesión.')
    }
  },

  async refreshSession(): Promise<RefreshSessionResult> {
    const stored = peekStoredSession()
    if (stored && authMockService.isMockSession(stored)) {
      if (!AUTH_ALLOW_MOCKS) {
        return { ok: false, code: 'REFRESH_INVALID', message: 'Modo demo deshabilitado.' }
      }
      return { ok: true, session: stored }
    }

    const result = await performTokenRefresh()
    return result
  },

  async restoreSession(session: AuthSession): Promise<AuthSession | null> {
    if (authMockService.isMockSession(session)) {
      return AUTH_ALLOW_MOCKS ? authMockService.restoreSession(session) : null
    }

    const refreshCandidate = isRefreshTokenValid(session.refreshToken)
    if (!session.accessToken && refreshCandidate) {
      const refreshed = await performTokenRefresh()
      if (refreshed.ok) return refreshed.session
    }

    const tokenPreview = session.accessToken?.slice(0, 16) ?? 'N/A'
    console.debug(
      `[AUTH] restoreSession: llamada a GET /api/auth/me con accessToken=${tokenPreview}...`,
    )
    try {
      const result = await apiRequest<AuthSession>('/api/auth/me', {
        accessToken: session.accessToken,
        skipRefresh: false,
      })
      if (result) overwriteStoredSession(result)
      console.debug(
        `[AUTH] restoreSession: /api/auth/me OK, nueva sesión accessToken=${result.accessToken?.slice(0, 16)}...`,
      )
      return result
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        console.warn(
          `[AUTH] restoreSession: /api/auth/me devolvió 401. Intentando refreshToken como último recurso. accessToken usado=${tokenPreview}...`,
        )
        if (refreshCandidate) {
          const refreshed = await performTokenRefresh()
          if (refreshed.ok) return refreshed.session
        }
        return null
      }

      if (shouldFallbackToMock(error, 'restoreSession')) {
        return authMockService.restoreSession(session)
      }

      if (error instanceof ApiNetworkError) {
        console.warn(
          `[AUTH] restoreSession: /api/auth/me Network Error. Se conserva storedSession. Error: ${error.message}`,
        )
        return session
      }

      console.warn(
        `[AUTH] restoreSession: /api/auth/me error NO-MANEJADO, rethrow. Error:`,
        error,
      )
      throw error
    }
  },

  async logout(session: AuthSession | null): Promise<void> {
    if (session && authMockService.isMockSession(session)) {
      await authMockService.logout()
      return
    }

    try {
      await apiRequest<void>('/api/auth/logout', {
        method: 'POST',
        accessToken: session?.accessToken,
        skipRefresh: true,
      })
    } catch (error) {
      if (shouldFallbackToMock(error, 'logout')) {
        await authMockService.logout()
        return
      }

      if (!(error instanceof ApiNetworkError)) {
        throw error
      }
    }
  },

  async requestPasswordReset(
    payload: ForgotPasswordPayload,
  ): Promise<ForgotPasswordResult> {
    try {
      return await apiRequest<ForgotPasswordResult>('/api/auth/forgot-password', {
        method: 'POST',
        skipAuth: true,
        skipRefresh: true,
        body: payload,
      })
    } catch (error) {
      if (shouldFallbackToMock(error, 'requestPasswordReset')) {
        return authMockService.requestPasswordReset(payload)
      }

      if (error instanceof ApiError || error instanceof ApiNetworkError) {
        throw error
      }

      throw new Error('No se pudo iniciar la recuperación de contraseña.')
    }
  },

  async resetPassword(payload: ResetPasswordPayload): Promise<void> {
    try {
      await apiRequest<void>('/api/auth/reset-password', {
        method: 'POST',
        skipAuth: true,
        skipRefresh: true,
        body: payload,
      })
    } catch (error) {
      if (shouldFallbackToMock(error, 'resetPassword')) {
        await authMockService.resetPassword(payload)
        return
      }

      if (error instanceof ApiError || error instanceof ApiNetworkError) {
        throw error
      }

      throw new Error('No se pudo restablecer la contraseña.')
    }
  },

  getDemoCredentials() {
    return AUTH_ALLOW_MOCKS ? authMockService.getDemoCredentials() : null
  },

  getDemoAccounts() {
    return AUTH_ALLOW_MOCKS ? authMockService.getDemoAccounts() : []
  },
}
