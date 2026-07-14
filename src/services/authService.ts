import { AUTH_ALLOW_MOCKS } from '@/config/auth'
import type {
  AuthSession,
  ForgotPasswordPayload,
  ForgotPasswordResult,
  LoginPayload,
  ResetPasswordPayload,
} from '@/types/auth'
import { apiRequest, ApiError, ApiNetworkError } from '@/services/apiClient'
import { authMockService } from '@/services/authMockService'

function shouldFallbackToMock(error: unknown) {
  if (!AUTH_ALLOW_MOCKS) {
    return false
  }

  if (error instanceof ApiNetworkError) {
    return true
  }

  if (error instanceof ApiError && error.status >= 500) {
    return true
  }

  return false
}

export const authService = {
  async login(payload: LoginPayload): Promise<AuthSession> {
    try {
      return await apiRequest<AuthSession>('/api/auth/login', {
        method: 'POST',
        body: {
          email: payload.email,
          password: payload.password,
        },
      })
    } catch (error) {
      if (shouldFallbackToMock(error)) {
        return authMockService.login(payload)
      }

      if (error instanceof ApiError || error instanceof ApiNetworkError) {
        throw error
      }

      throw new Error('No se pudo iniciar sesión.')
    }
  },

  async restoreSession(session: AuthSession): Promise<AuthSession | null> {
    if (authMockService.isMockSession(session)) {
      return AUTH_ALLOW_MOCKS ? authMockService.restoreSession(session) : null
    }

    try {
      return await apiRequest<AuthSession>('/api/auth/me', {
        accessToken: session.accessToken,
      })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        return null
      }

      if (shouldFallbackToMock(error)) {
        return authMockService.restoreSession(session)
      }

      if (error instanceof ApiNetworkError) {
        return session
      }

      throw error
    }
  },

  async logout(session: AuthSession | null): Promise<void> {
    if (session && authMockService.isMockSession(session)) {
      return authMockService.logout()
    }

    try {
      await apiRequest<void>('/api/auth/logout', {
        method: 'POST',
        accessToken: session?.accessToken,
      })
    } catch (error) {
      if (shouldFallbackToMock(error)) {
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
        body: payload,
      })
    } catch (error) {
      if (shouldFallbackToMock(error)) {
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
        body: payload,
      })
    } catch (error) {
      if (shouldFallbackToMock(error)) {
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
