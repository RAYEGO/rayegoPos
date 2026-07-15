import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { AUTH_STORAGE_KEY } from '@/config/auth'
import { AuthContext, type AuthContextValue } from '@/contexts/auth-context'
import { authService } from '@/services/authService'
import type {
  AuthSession,
  ForgotPasswordPayload,
  LoginPayload,
  ResetPasswordPayload,
} from '@/types/auth'

function readStoredSession() {
  const raw =
    window.localStorage.getItem(AUTH_STORAGE_KEY) ??
    window.sessionStorage.getItem(AUTH_STORAGE_KEY)

  if (!raw) {
    return null
  }

  try {
    const session = JSON.parse(raw) as AuthSession
    const hasRolesArray = Array.isArray(
      (session as { user?: { roles?: unknown } })?.user?.roles,
    )
    const hasPermissionsArray = Array.isArray(
      (session as { user?: { permissions?: unknown } })?.user?.permissions,
    )

    if (!hasRolesArray || !hasPermissionsArray) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
      window.sessionStorage.removeItem(AUTH_STORAGE_KEY)
      return null
    }

    return session
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }
}

function clearStoredSession() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  useEffect(() => {
    const storedSession = readStoredSession()

    if (!storedSession) {
      setIsBootstrapping(false)
      return
    }

    void authService
      .restoreSession(storedSession)
      .then((nextSession) => {
        if (!nextSession) {
          clearStoredSession()
          setSession(null)
          return
        }

        setSession(nextSession)
      })
      .catch(() => {
        setSession(storedSession)
      })
      .finally(() => {
        setIsBootstrapping(false)
      })
  }, [])

  const login = useCallback(async (payload: LoginPayload) => {
    const nextSession = await authService.login(payload)

    setSession(nextSession)

    clearStoredSession()

    const storage = payload.remember ? window.localStorage : window.sessionStorage
    storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession))
  }, [])

  const logout = useCallback(async () => {
    try {
      await authService.logout(session)
    } catch (error) {
      console.warn('No se pudo confirmar el cierre de sesión en la API.', error)
    } finally {
      setSession(null)
      clearStoredSession()
    }
  }, [session])

  const requestPasswordReset = useCallback(
    async (payload: ForgotPasswordPayload) => authService.requestPasswordReset(payload),
    [],
  )

  const resetPassword = useCallback(
    async (payload: ResetPasswordPayload) => authService.resetPassword(payload),
    [],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: session !== null,
      isBootstrapping,
      login,
      logout,
      requestPasswordReset,
      resetPassword,
    }),
    [isBootstrapping, login, logout, requestPasswordReset, resetPassword, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
