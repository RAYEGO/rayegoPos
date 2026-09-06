import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createSafeContext } from '@/lib/safe-context'
import { useAuth } from '@/hooks/useAuth'
import { authService } from '@/services/authService'
import {
  readSecurityTimeouts,
  readPendingOperation,
  INACTIVITY_STORAGE_KEY,
  type PendingOperationSnapshot,
  type SecurityTimeoutSettings,
} from '@/config/security'

import {
  AUTH_SESSION_CLEARED_EVENT,
  AUTH_SESSION_UPDATED_EVENT,
} from '@/config/auth'

const INACTIVITY_STORAGE_PREFIX = INACTIVITY_STORAGE_KEY.replace(/\.inactivity-state$/, '')
import { getTokenTimeLeftMs, isAccessTokenValid, isRefreshTokenValid } from '@/utils/jwt'
import type { AuthSession } from '@/types/auth'

const ACTIVITY_EVENTS = [
  'mousedown',
  'keyup',
  'scroll',
  'touchstart',
  'pointerup',
  'change',
  'click',
  'wheel',
  'input',
  'focusin',
] as const

const ACTIVITY_REPORT_COOLDOWN_MS = 800

type InactivityStatus = 'active' | 'warning' | 'expired'
export type WarningReason = 'inactivity' | 'absolute-expiry' | null

type SessionExpirationDetails = {
  reason:
    | 'idle-timeout'
    | 'access-expired-no-refresh'
    | 'refresh-invalid'
    | 'manual-logout'
    | 'auth-401-unrecoverable'
    | 'absolute-expiry'
  message: string
}

export type InactivityContextValue = {
  status: InactivityStatus
  warningReason: WarningReason
  settings: SecurityTimeoutSettings
  lastActivityAt: number
  idleTimeLeftMs: number
  warningCountdownSeconds: number
  pendingOperation: PendingOperationSnapshot | null
  refreshSession: () => Promise<AuthSession | null>
  reportActivity: () => void
  setPendingOperation: (snapshot: PendingOperationSnapshot | null) => void
  acknowledgeWarning: () => Promise<void>
  markExpired: (details: SessionExpirationDetails) => void
  lastExpirationDetails: SessionExpirationDetails | null
}

const [InactivityContext, useInactivityContext] = createSafeContext<InactivityContextValue>(
  'InactivityContext',
)

export { useInactivityContext }

export function InactivityProvider({ children }: { children: React.ReactNode }) {
  const { session, isAuthenticated, logout, syncSessionFromStorage } = useAuth()

  const [settings, setSettings] = useState<SecurityTimeoutSettings>(() =>
    readSecurityTimeouts(),
  )
  const [status, setStatus] = useState<InactivityStatus>('active')
  const [warningReason, setWarningReason] = useState<WarningReason>(null)
  const [lastActivityAt, setLastActivityAt] = useState<number>(() => Date.now())
  const [idleTimeLeftMs, setIdleTimeLeftMs] = useState<number>(settings.idleTimeoutMs)
  const [warningCountdownSeconds, setWarningCountdownSeconds] = useState<number>(0)
  const [pendingOperation, setPendingOperationState] = useState<PendingOperationSnapshot | null>(
    () => readPendingOperation(),
  )
  const [lastExpirationDetails, setLastExpirationDetails] =
    useState<SessionExpirationDetails | null>(null)

  const warningIntervalRef = useRef<number | null>(null)
  const tickIntervalRef = useRef<number | null>(null)
  const idleDeadlineRef = useRef<number>(Date.now() + settings.idleTimeoutMs)
  const sessionRef = useRef<AuthSession | null>(session)
  const isAuthenticatedRef = useRef<boolean>(isAuthenticated)
  const statusRef = useRef<InactivityStatus>('active')
  const warningReasonRef = useRef<WarningReason>(null)
  const lastIdleUpdateRef = useRef<number>(0)
  const lastAbsoluteWarningShownAtRef = useRef<number>(0)
  const refreshInFlightRef = useRef(false)
  const lastReportAtRef = useRef<number>(0)

  useEffect(() => {
    sessionRef.current = session
    isAuthenticatedRef.current = isAuthenticated
  }, [session, isAuthenticated])

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    warningReasonRef.current = warningReason
  }, [warningReason])

  const clearWarningInterval = useCallback(() => {
    if (warningIntervalRef.current !== null) {
      window.clearInterval(warningIntervalRef.current)
      warningIntervalRef.current = null
    }
  }, [])

  const clearTickInterval = useCallback(() => {
    if (tickIntervalRef.current !== null) {
      window.clearInterval(tickIntervalRef.current)
      tickIntervalRef.current = null
    }
  }, [])

  const markExpired = useCallback(
    (details: SessionExpirationDetails) => {
      setLastExpirationDetails(details)
      setStatus('expired')
      setWarningReason(null)
      clearWarningInterval()
      clearTickInterval()
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new CustomEvent(AUTH_SESSION_CLEARED_EVENT))
        } catch {
          /* ignore */
        }
      }
      void logout(details.message)
    },
    [clearTickInterval, clearWarningInterval, logout],
  )

  const transitionToWarning = useCallback(
    (reason: Exclude<WarningReason, null>) => {
      if (statusRef.current !== 'active') return
      setWarningReason(reason)
      warningReasonRef.current = reason
      setStatus('warning')
      const seconds = Math.max(1, Math.round(settings.warningCountdownMs / 1000))
      setWarningCountdownSeconds(seconds)

      clearWarningInterval()
      warningIntervalRef.current = window.setInterval(() => {
        setWarningCountdownSeconds((prev) => {
          const next = prev - 1
          if (next <= 0) {
            clearWarningInterval()
            if (warningReasonRef.current === 'absolute-expiry') {
              markExpired({
                reason: 'absolute-expiry',
                message:
                  'Tu sesión ha alcanzado su duración máxima y no pudo renovarse. Inicia sesión nuevamente.',
              })
            } else {
              markExpired({
                reason: 'idle-timeout',
                message: `Tu sesión expiró por inactividad después de ${Math.round(
                  settings.idleTimeoutMs / 60000,
                )} minutos.`,
              })
            }
            return 0
          }
          return next
        })
      }, 1000)
    },
    [clearWarningInterval, markExpired, settings.idleTimeoutMs, settings.warningCountdownMs],
  )

  const closeWarningAndReset = useCallback(() => {
    setStatus('active')
    setWarningReason(null)
    warningReasonRef.current = null
    clearWarningInterval()
    setWarningCountdownSeconds(0)
    setLastExpirationDetails(null)
  }, [clearWarningInterval])

  const reportActivity = useCallback(() => {
    const now = Date.now()
    idleDeadlineRef.current = now + settings.idleTimeoutMs
    if (now - lastReportAtRef.current < ACTIVITY_REPORT_COOLDOWN_MS) {
      try {
        const lastSync =
          Number(window.localStorage.getItem(INACTIVITY_STORAGE_PREFIX + '.lastSync') ?? '0') ||
          0
        if (now - lastSync >= ACTIVITY_REPORT_COOLDOWN_MS) {
          window.localStorage.setItem(INACTIVITY_STORAGE_PREFIX + '.lastSync', String(now))
        }
      } catch {
        /* ignore */
      }
      return
    }
    lastReportAtRef.current = now
    setLastActivityAt(now)
    try {
      window.localStorage.setItem(INACTIVITY_STORAGE_PREFIX + '.lastSync', String(now))
    } catch {
      /* ignore */
    }
    setIdleTimeLeftMs(settings.idleTimeoutMs)

    if (statusRef.current === 'warning' && warningReasonRef.current === 'inactivity') {
      closeWarningAndReset()
    }

    if (statusRef.current !== 'expired') {
      void (async () => {
        const cur = sessionRef.current
        if (!cur?.accessToken) return
        if (!isAccessTokenValid(cur.accessToken, settings.accessTokenExpiryBufferMs)) {
          if (isRefreshTokenValid(cur.refreshToken)) {
            if (refreshInFlightRef.current) return
            refreshInFlightRef.current = true
            try {
              const refreshRes = await authService.refreshSession()
              if (refreshRes.ok) {
                sessionRef.current = refreshRes.session
                if (statusRef.current === 'warning' && warningReasonRef.current === 'absolute-expiry') {
                  closeWarningAndReset()
                  lastAbsoluteWarningShownAtRef.current = Date.now()
                }
              } else if (refreshRes.code !== 'NETWORK_ERROR') {
                if (warningReasonRef.current === 'absolute-expiry') {
                  return
                }
                void markExpired({
                  reason: 'refresh-invalid',
                  message: refreshRes.message,
                })
              }
            } finally {
              refreshInFlightRef.current = false
            }
          } else if (warningReasonRef.current !== 'absolute-expiry') {
            void markExpired({
              reason: 'access-expired-no-refresh',
              message:
                'El token de sesión ya expiró y no hay un token de renovación disponible. Inicia sesión nuevamente.',
            })
          }
        }
      })()
    }
  }, [
    closeWarningAndReset,
    markExpired,
    settings.accessTokenExpiryBufferMs,
    settings.idleTimeoutMs,
  ])

  const acknowledgeWarning = useCallback(async () => {
    if (warningReasonRef.current === 'absolute-expiry') {
      const cur = sessionRef.current
      if (cur?.refreshToken && !refreshInFlightRef.current) {
        refreshInFlightRef.current = true
        try {
          const refreshRes = await authService.refreshSession()
          if (refreshRes.ok) {
            sessionRef.current = refreshRes.session
            closeWarningAndReset()
            lastAbsoluteWarningShownAtRef.current = Date.now()
            return
          } else if (refreshRes.code === 'NETWORK_ERROR') {
            reportActivity()
            return
          }
        } finally {
          refreshInFlightRef.current = false
        }
      }
    }
    reportActivity()
  }, [closeWarningAndReset, reportActivity])

  const setPendingOperation = useCallback((snapshot: PendingOperationSnapshot | null) => {
    if (snapshot) {
      window.localStorage.setItem(
        'rayego-pos.security.pending-operation',
        JSON.stringify(snapshot),
      )
    } else {
      window.localStorage.removeItem('rayego-pos.security.pending-operation')
    }
    setPendingOperationState(snapshot)
  }, [])

  const refreshSession = useCallback(async (): Promise<AuthSession | null> => {
    const result = await authService.refreshSession()
    if (!result.ok) return null
    reportActivity()
    return result.session
  }, [reportActivity])

  useEffect(() => {
    const newSettings = readSecurityTimeouts()
    setSettings(newSettings)
    idleDeadlineRef.current = Date.now() + newSettings.idleTimeoutMs
    setIdleTimeLeftMs(newSettings.idleTimeoutMs)
  }, [])

  useEffect(() => {
    clearTickInterval()
    if (!isAuthenticated) {
      setStatus('active')
      setWarningReason(null)
      warningReasonRef.current = null
      setWarningCountdownSeconds(0)
      setIdleTimeLeftMs(settings.idleTimeoutMs)
      idleDeadlineRef.current = Date.now() + settings.idleTimeoutMs
      lastAbsoluteWarningShownAtRef.current = 0
      return
    }

    idleDeadlineRef.current = Date.now() + settings.idleTimeoutMs

    tickIntervalRef.current = window.setInterval(() => {
      if (statusRef.current === 'expired') return

      try {
        const otherLastSyncRaw =
          window.localStorage.getItem(INACTIVITY_STORAGE_PREFIX + '.lastSync') ?? null
        const otherLastSync = otherLastSyncRaw
          ? Number(otherLastSyncRaw) || 0
          : 0
        if (otherLastSync > 0) {
          const newDeadline = otherLastSync + settings.idleTimeoutMs
          if (newDeadline - idleDeadlineRef.current > 2000) {
            idleDeadlineRef.current = newDeadline
          }
        }
      } catch {
        /* ignore */
      }

      const curSession = sessionRef.current
      const refreshLeftMs = curSession?.refreshToken
        ? getTokenTimeLeftMs(curSession.refreshToken)
        : null
      const accessLeftMs = curSession?.accessToken
        ? getTokenTimeLeftMs(curSession.accessToken)
        : null

      if (curSession && refreshLeftMs !== null && refreshLeftMs <= 0) {
        void markExpired({
          reason: 'refresh-invalid',
          message: 'El token de renovación ha expirado. Inicia sesión nuevamente para continuar.',
        })
        return
      }

      const left = idleDeadlineRef.current - Date.now()
      const clampedLeft = left < 0 ? 0 : left
      const inIdleWarningWindow =
        clampedLeft <= settings.warningCountdownMs ||
        (statusRef.current === 'warning' && warningReasonRef.current === 'inactivity')

      if (inIdleWarningWindow) {
        setIdleTimeLeftMs(clampedLeft)
      } else {
        const now = Date.now()
        if (now - lastIdleUpdateRef.current >= 5000) {
          lastIdleUpdateRef.current = now
          setIdleTimeLeftMs(clampedLeft)
        }
      }

      if (
        statusRef.current === 'active' &&
        clampedLeft <= settings.warningCountdownMs &&
        warningReasonRef.current !== 'absolute-expiry'
      ) {
        transitionToWarning('inactivity')
      }

      if (
        statusRef.current === 'active' &&
        curSession &&
        warningReasonRef.current !== 'inactivity'
      ) {
        const accessNearExpiry =
          accessLeftMs !== null && accessLeftMs <= settings.warningCountdownMs
        const refreshNearExpiry =
          refreshLeftMs !== null &&
          refreshLeftMs > 0 &&
          refreshLeftMs <= Math.max(settings.warningCountdownMs * 2, 2 * 60 * 1000)
        if ((accessNearExpiry || refreshNearExpiry) && !refreshInFlightRef.current) {
          const now = Date.now()
          if (now - lastAbsoluteWarningShownAtRef.current < settings.warningCountdownMs) return
          transitionToWarning('absolute-expiry')
          lastAbsoluteWarningShownAtRef.current = now
        }
      }

      if (curSession && !isAccessTokenValid(curSession.accessToken, 15_000)) {
        if (isRefreshTokenValid(curSession.refreshToken) && !refreshInFlightRef.current) {
          console.debug(
            `[INACTIVITY] Access token cerca de expirar en tick loop. Refresh silencioso antes del logout. (accessLeft=${accessLeftMs}ms refreshLeft=${refreshLeftMs}ms)`,
          )
          refreshInFlightRef.current = true
          void (async () => {
            try {
              const refreshRes = await authService.refreshSession()
              if (refreshRes.ok) {
                sessionRef.current = refreshRes.session
                try {
                  syncSessionFromStorage()
                  if (typeof window !== 'undefined') {
                    try {
                      window.dispatchEvent(
                        new CustomEvent(AUTH_SESSION_UPDATED_EVENT, {
                          detail: { viaInactivityRefresh: true, ts: Date.now() },
                        }),
                      )
                    } catch {
                      /* ignore */
                    }
                  }
                } catch {
                  /* ignore */
                }
                if (
                  warningReasonRef.current === 'absolute-expiry' &&
                  statusRef.current === 'warning'
                ) {
                  closeWarningAndReset()
                  lastAbsoluteWarningShownAtRef.current = Date.now()
                }
              } else if (
                refreshRes.code === 'REFRESH_INVALID' &&
                warningReasonRef.current !== 'absolute-expiry'
              ) {
                void markExpired({
                  reason: 'refresh-invalid',
                  message: refreshRes.message,
                })
              }
            } finally {
              refreshInFlightRef.current = false
            }
          })()
        }
      }
    }, 1000)

    return () => {
      clearTickInterval()
      clearWarningInterval()
    }
  }, [
    clearTickInterval,
    clearWarningInterval,
    closeWarningAndReset,
    isAuthenticated,
    markExpired,
    settings.accessTokenExpiryBufferMs,
    settings.idleTimeoutMs,
    settings.warningCountdownMs,
    syncSessionFromStorage,
    transitionToWarning,
  ])

  useEffect(() => {
    if (!isAuthenticated) return

    const onActivity = () => {
      reportActivity()
    }

    const opts: AddEventListenerOptions & EventListenerOptions = {
      passive: true,
      capture: false,
    }

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName as string, onActivity, opts)
    }

    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        reportActivity()
      }
    }
    document.addEventListener('visibilitychange', visibilityHandler)

    return () => {
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName as string, onActivity, opts)
      }
      document.removeEventListener('visibilitychange', visibilityHandler)
    }
  }, [isAuthenticated, reportActivity])

  const value = useMemo<InactivityContextValue>(
    () => ({
      status,
      warningReason,
      settings,
      lastActivityAt,
      idleTimeLeftMs: idleTimeLeftMs < 0 ? 0 : idleTimeLeftMs,
      warningCountdownSeconds,
      pendingOperation,
      refreshSession,
      reportActivity,
      setPendingOperation,
      acknowledgeWarning,
      markExpired,
      lastExpirationDetails,
    }),
    [
      status,
      warningReason,
      settings,
      lastActivityAt,
      idleTimeLeftMs,
      warningCountdownSeconds,
      pendingOperation,
      refreshSession,
      reportActivity,
      setPendingOperation,
      acknowledgeWarning,
      markExpired,
      lastExpirationDetails,
    ],
  )

  return <InactivityContext.Provider value={value}>{children}</InactivityContext.Provider>
}
