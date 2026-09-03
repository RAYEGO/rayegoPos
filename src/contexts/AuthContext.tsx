import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
    // Backward-compatible check: roles/permissions pueden venir dentro de session.user
    // (estructura canónica) o al nivel raíz del payload (contracto alternativo backend
    // que devuelve companyId/branchId/roles/permissions como campos top-level). Se
    // acepta cualquiera de los 2 formatos; si es root-level se normaliza a session.user
    // para que el resto de la app consuma siempre desde user.roles / user.permissions.
    const rootRoles = Array.isArray((session as unknown as { roles?: unknown }).roles)
      ? (session as unknown as { roles: AuthSession['user']['roles'] }).roles
      : null
    const rootPermissions = Array.isArray(
      (session as unknown as { permissions?: unknown }).permissions,
    )
      ? (session as unknown as { permissions: AuthSession['user']['permissions'] }).permissions
      : null

    const hasRolesArray =
      Array.isArray((session as { user?: { roles?: unknown } })?.user?.roles) ||
      rootRoles !== null
    const hasPermissionsArray =
      Array.isArray((session as { user?: { permissions?: unknown } })?.user?.permissions) ||
      rootPermissions !== null

    if (!hasRolesArray || !hasPermissionsArray) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
      window.sessionStorage.removeItem(AUTH_STORAGE_KEY)
      return null
    }

    // Normalización root-level → session.user (estructura esperada por tipos).
    if (rootRoles !== null || rootPermissions !== null) {
      session.user = {
        ...(session.user ?? {} as AuthSession['user']),
        ...(rootRoles !== null ? { roles: rootRoles } : {}),
        ...(rootPermissions !== null ? { permissions: rootPermissions } : {}),
        companyId:
          (session as unknown as { companyId?: AuthSession['user']['companyId'] }).companyId ??
          session.user?.companyId ??
          null,
        branchId:
          (session as unknown as { branchId?: AuthSession['user']['branchId'] }).branchId ??
          session.user?.branchId ??
          null,
      } as AuthSession['user']
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

function sessionTokensEqual(a: AuthSession | null, b: AuthSession | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.accessToken === b.accessToken && a.refreshToken === b.refreshToken
}

const AUTH_SESSION_UPDATED_EVENT = 'rayego-auth-session-updated'
const AUTH_SESSION_CLEARED_EVENT = 'rayego-auth-session-cleared'
const AUTH_401_EVENT = 'rayego-auth-401'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AuthSession | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const sessionRef = useRef<AuthSession | null>(null)
  const lastHandled401Ref = useRef<number>(0)

  const setSession = useCallback((next: AuthSession | null) => {
    sessionRef.current = next
    setSessionState((prev) => {
      if (sessionTokensEqual(prev, next)) return prev
      return next
    })
  }, [])

  const syncSessionFromStorage = useCallback(() => {
    const stored = readStoredSession()
    if (!stored) {
      if (sessionRef.current !== null) {
        setSession(null)
      }
      return
    }
    if (!sessionTokensEqual(sessionRef.current, stored)) {
      setSession(stored)
    }
  }, [setSession])

  useEffect(() => {
    const storedSession = readStoredSession()

    if (!storedSession) {
      console.debug('[AUTH] Bootstrap: no hay sesión almacenada → isBootstrapping=false')
      sessionRef.current = null
      setIsBootstrapping(false)
      return
    }

    const tokenPreview = storedSession.accessToken?.slice(0, 16) ?? 'N/A'
    console.debug(
      `[AUTH] Bootstrap: encontrada sesión almacenada (accessToken=${tokenPreview}...) → restoreSession iniciado`,
      {
        hasAccessToken: Boolean(storedSession.accessToken),
        hasRefreshToken: Boolean(storedSession.refreshToken),
        hasRolesArray: Array.isArray(storedSession.user?.roles),
        hasPermissionsArray: Array.isArray(storedSession.user?.permissions),
        userId: storedSession.user?.id ?? null,
        branchId: storedSession.user?.branchId ?? null,
        companyId: storedSession.user?.companyId ?? null,
      },
    )

    void authService
      .restoreSession(storedSession)
      .then((nextSession) => {
        if (!nextSession) {
          console.debug(
            '[AUTH] Bootstrap: restoreSession devolvió null → SESIÓN INVÁLIDA, se limpia storage y session=null',
          )
          clearStoredSession()
          sessionRef.current = null
          setSessionState(null)
          return
        }

        console.debug(
          `[AUTH] Bootstrap: restoreSession OK (accessToken=${nextSession.accessToken?.slice(0, 16)}...) → setSession actualizada`,
        )
        setSession(nextSession)
      })
      .catch((err) => {
        console.warn(
          '[AUTH] Bootstrap: restoreSession lanzó error NO-401 → se conserva storedSession. Error:',
          err,
        )
        setSession(storedSession)
      })
      .finally(() => {
        setIsBootstrapping(false)
      })
  }, [setSession])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_STORAGE_KEY && event.key !== null) return
      syncSessionFromStorage()
    }
    window.addEventListener('storage', onStorage)

    const onSessionCleared = () => {
      const prev = sessionRef.current
      if (prev !== null) {
        setSession(null)
      }
    }
    window.addEventListener(AUTH_SESSION_CLEARED_EVENT, onSessionCleared)

    const onSessionUpdated = () => {
      syncSessionFromStorage()
    }
    window.addEventListener(AUTH_SESSION_UPDATED_EVENT, onSessionUpdated)

    const onAuth401 = (event: Event) => {
      const now = Date.now()
      if (now - lastHandled401Ref.current < 2500) return
      lastHandled401Ref.current = now
      const detail = (event as CustomEvent).detail
      const message =
        detail && typeof detail === 'object' && typeof (detail as any).message === 'string'
          ? (detail as any).message as string
          : 'Tu sesión ha expirado. Inicia sesión nuevamente para continuar.'
      const prev = sessionRef.current
      if (prev !== null) {
        void logout(message).catch(() => {})
      } else {
        clearStoredSession()
        setSession(null)
      }
    }
    window.addEventListener(AUTH_401_EVENT, onAuth401)

    const interval = window.setInterval(() => {
      syncSessionFromStorage()
    }, 2000)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(AUTH_SESSION_CLEARED_EVENT, onSessionCleared)
      window.removeEventListener(AUTH_SESSION_UPDATED_EVENT, onSessionUpdated)
      window.removeEventListener(AUTH_401_EVENT, onAuth401)
      window.clearInterval(interval)
    }
  }, [syncSessionFromStorage, logout])

  const login = useCallback(async (payload: LoginPayload) => {
    console.debug(
      `[AUTH] login: inicio con email=${payload.email} remember=${payload.remember} branchId=${payload.branchId ?? 'auto'}`,
    )
    const nextSession = await authService.login(payload)
    console.debug(
      `[AUTH] login: RESPUESTA EXITOSA (accessToken=${nextSession.accessToken?.slice(0, 16)}...). Estructura recibida:`,
      {
        hasAccessToken: Boolean(nextSession.accessToken),
        hasRefreshToken: Boolean(nextSession.refreshToken),
        sessionKeys: Object.keys(nextSession),
        userKeys: Object.keys(nextSession.user ?? {}),
        userId: nextSession.user?.id ?? null,
        roles: nextSession.user?.roles ?? null,
        permissions: nextSession.user?.permissions ?? null,
        branchId: nextSession.user?.branchId ?? null,
        companyId: nextSession.user?.companyId ?? null,
      },
    )

    setSession(nextSession)

    clearStoredSession()

    const storage = payload.remember ? window.localStorage : window.sessionStorage
    storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession))
    console.debug(
      `[AUTH] login: sesión GUARDADA en storage (${payload.remember ? 'localStorage' : 'sessionStorage'}). Verificación read-back:`,
      (() => {
        try {
          const raw = storage.getItem(AUTH_STORAGE_KEY)
          if (!raw) return 'READ-BACK FALLO: no existe key en storage'
          const parsed = JSON.parse(raw) as AuthSession
          return {
            readBackAccessTokenMatches:
              parsed.accessToken?.slice(0, 16) === nextSession.accessToken?.slice(0, 16),
            accessTokenStored: parsed.accessToken?.slice(0, 16) ?? 'N/A',
            userRolesType: typeof parsed.user?.roles,
            userPermissionsType: typeof parsed.user?.permissions,
          }
        } catch (e) {
          return `READ-BACK FALLO: parse error ${String(e)}`
        }
      })(),
    )
  }, [setSession])

  const logout = useCallback(async (reason?: string) => {
    console.warn(
      `[AUTH] logout INICIADO. Motivo: ${reason ?? 'sin motivo explícito'}. Sesión actual será destruida (accessToken=${session?.accessToken?.slice(0, 16) ?? 'ninguna'}...)`,
    )
    try {
      await authService.logout(session)
    } catch (error) {
      console.warn('No se pudo confirmar el cierre de sesión en la API.', error)
    } finally {
      sessionRef.current = null
      setSessionState(null)
      clearStoredSession()
      console.warn('[AUTH] logout COMPLETADO: session=null, storage limpiado.')
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
      setSession,
      syncSessionFromStorage,
    }),
    [
      isBootstrapping,
      login,
      logout,
      requestPasswordReset,
      resetPassword,
      session,
      setSession,
      syncSessionFromStorage,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
