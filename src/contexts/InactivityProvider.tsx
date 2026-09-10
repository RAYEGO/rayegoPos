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
] as const

const ACTIVITY_REPORT_COOLDOWN_MS = 800
const ACK_GRACE_MS = 5_000

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
  const prevIsAuthenticatedRef = useRef<boolean>(isAuthenticated)
  const statusRef = useRef<InactivityStatus>('active')
  const warningReasonRef = useRef<WarningReason>(null)
  const lastIdleUpdateRef = useRef<number>(0)
  const lastAbsoluteWarningShownAtRef = useRef<number>(0)
  const refreshInFlightRef = useRef(false)
  const lastReportAtRef = useRef<number>(0)
  const logoutInFlightRef = useRef(false)
  const warningIntervalStartedAtRef = useRef(0)
  const userAcknowledgedAtRef = useRef(0)
  const acknowledgeInFlightRef = useRef(false)
  const reportActivityRef = useRef<(eventType?: string) => void>(() => {})

  useEffect(() => {
    sessionRef.current = session
    isAuthenticatedRef.current = isAuthenticated
    if (isAuthenticated) {
      logoutInFlightRef.current = false
      acknowledgeInFlightRef.current = false
      refreshInFlightRef.current = false
      userAcknowledgedAtRef.current = 0
      warningIntervalStartedAtRef.current = 0
      const wasNotAuthenticated = !prevIsAuthenticatedRef.current
      if (wasNotAuthenticated) {
        const now = Date.now()
        const candidateDeadline = now + settings.idleTimeoutMs
        if (candidateDeadline > idleDeadlineRef.current) {
          console.log('[INACTIVITY DEADLINE RESET]', {
            reason: 'session-authenticated (false→true)',
            eventType: 'auth-transition',
            oldDeadline: idleDeadlineRef.current,
            newDeadline: candidateDeadline,
            timeLeftBeforeMs: Math.max(0, idleDeadlineRef.current - now),
            timeLeftAfterMs: settings.idleTimeoutMs,
          })
          lastReportAtRef.current = now
          idleDeadlineRef.current = candidateDeadline
          lastIdleUpdateRef.current = 0
          lastAbsoluteWarningShownAtRef.current = 0
        } else {
          console.log('[INACTIVITY DEADLINE OVERWRITE SKIPPED]', {
            reason: 'session-authenticated (false→true) candidate <= existing (extended by prior activity pre-auth)',
            eventType: 'auth-transition',
            oldDeadline: idleDeadlineRef.current,
            candidateDeadline,
            timeLeftPreservedMs: Math.max(0, idleDeadlineRef.current - now),
          })
        }
      }
    }
    prevIsAuthenticatedRef.current = isAuthenticated
  }, [session, isAuthenticated, settings.idleTimeoutMs])

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
      warningIntervalStartedAtRef.current = 0
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
      console.log('[INACTIVITY] markExpired CALLED', details)
      const HIGH_PRIORITY_REASONS: Array<SessionExpirationDetails['reason']> = [
        'manual-logout',
        'idle-timeout',
        'absolute-expiry',
      ]
      const isHighPriority = HIGH_PRIORITY_REASONS.includes(details.reason)

      const graceLeft = ACK_GRACE_MS - (Date.now() - userAcknowledgedAtRef.current)
      if (graceLeft > 0 && !isHighPriority) {
        console.log('[INACTIVITY] markExpired SKIPPED ACK_GRACE', {
          graceLeftMs: graceLeft,
          reason: details.reason,
          userAcknowledgedAt: userAcknowledgedAtRef.current,
          now: Date.now(),
        })
        return
      }

      if (statusRef.current === 'expired' && !isHighPriority) {
        console.log('[INACTIVITY] markExpired SKIPPED STATUS_EXPIRED', details.reason)
        return
      }

      if (logoutInFlightRef.current) {
        if (!isHighPriority) {
          console.log('[INACTIVITY] markExpired SKIPPED LOGOUT_IN_FLIGHT (soft reason)', details.reason)
          return
        }
        console.log('[INACTIVITY] markExpired BYPASS LOGOUT_IN_FLIGHT (high priority)', details.reason)
        logoutInFlightRef.current = false
      }

      console.log('[INACTIVITY] markExpired PROCEEDING (all guards passed)', details.reason)
      try {
        logoutInFlightRef.current = true
        setLastExpirationDetails(details)
        setStatus('expired')
        setWarningReason(null)
        warningReasonRef.current = null
        clearWarningInterval()
        clearTickInterval()
        if (typeof window !== 'undefined') {
          try {
            window.dispatchEvent(new CustomEvent(AUTH_SESSION_CLEARED_EVENT))
          } catch {
            /* ignore */
          }
        }
        console.log('[INACTIVITY] markExpired CALLING LOGOUT', details.reason, details.message)
        void logout(details.message)
      } finally {
        console.log('[INACTIVITY] markExpired FINALLY → logoutInFlightRef reset to false', details.reason)
        logoutInFlightRef.current = false
      }
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
      warningIntervalStartedAtRef.current = Date.now()
      warningIntervalRef.current = window.setInterval(() => {
        if (statusRef.current === 'active' || statusRef.current === 'expired') {
          clearWarningInterval()
          return
        }
        setWarningCountdownSeconds((prev) => {
          const next = prev - 1
          if (next <= 0) {
            clearWarningInterval()
            console.log('[INACTIVITY COUNTDOWN ZERO]', {
              status: statusRef.current,
              warningReason: warningReasonRef.current,
              next,
            })
            if (statusRef.current !== 'warning') return 0
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
    clearWarningInterval()
    setStatus('active')
    setWarningReason(null)
    warningReasonRef.current = null
    setWarningCountdownSeconds(0)
    setLastExpirationDetails(null)
    const now = Date.now()
    idleDeadlineRef.current = now + settings.idleTimeoutMs
    setIdleTimeLeftMs(settings.idleTimeoutMs)
    lastReportAtRef.current = now
    setLastActivityAt(now)
    try {
      window.localStorage.setItem(INACTIVITY_STORAGE_PREFIX + '.lastSync', String(now))
    } catch {
      /* ignore */
    }
  }, [clearWarningInterval, settings.idleTimeoutMs])

  const reportActivity = useCallback((eventType?: string) => {
    if (acknowledgeInFlightRef.current) return

    const now = Date.now()
    const oldDeadline = idleDeadlineRef.current
    const timeLeftBefore = Math.max(0, oldDeadline - now)
    const newDeadline = now + settings.idleTimeoutMs
    idleDeadlineRef.current = newDeadline
    const timeLeftAfter = Math.max(0, newDeadline - now)
    console.log('[INACTIVITY ACTIVITY]', {
      eventType: eventType ?? null,
      timestamp: now,
      oldDeadline,
      newDeadline,
      timeLeftBefore,
      timeLeftAfter,
    })
    console.log('[INACTIVITY DEADLINE RESET]', {
      reason: eventType ? `user-interaction (${eventType})` : 'programmatic-reportActivity',
      eventType: eventType ?? null,
      oldDeadline,
      newDeadline,
      timeLeftBefore,
      timeLeftAfter,
    })
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

    const hasOpenSessionWarning =
      typeof document !== 'undefined' &&
      !!document.querySelector('[data-session-warning="true"]')
    if (
      statusRef.current === 'warning' &&
      warningReasonRef.current === 'inactivity' &&
      !hasOpenSessionWarning
    ) {
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
    if (statusRef.current !== 'warning') return
    if (acknowledgeInFlightRef.current) return
    acknowledgeInFlightRef.current = true
    try {
      clearWarningInterval()
      const now = Date.now()
      userAcknowledgedAtRef.current = now
      lastReportAtRef.current = now
      const oldDeadline = idleDeadlineRef.current
      const timeLeftBefore = Math.max(0, oldDeadline - now)
      const newDeadline = now + settings.idleTimeoutMs
      idleDeadlineRef.current = newDeadline
      lastIdleUpdateRef.current = 0
      console.log('[INACTIVITY DEADLINE RESET]', {
        reason: 'warning-acknowledge',
        eventType: 'acknowledgeWarning',
        oldDeadline,
        newDeadline,
        timeLeftBefore,
        timeLeftAfter: settings.idleTimeoutMs,
      })

      const snapshotReason = warningReasonRef.current
      const cur = sessionRef.current

      const requiresTokenRefresh = (() => {
        if (!cur?.accessToken) return false
        if (snapshotReason === 'absolute-expiry') return true
        const buffer = Math.max(15_000, settings.accessTokenExpiryBufferMs ?? 15_000)
        if (!isAccessTokenValid(cur.accessToken, buffer)) return true
        if (cur.refreshToken && !isRefreshTokenValid(cur.refreshToken)) return false
        return false
      })()

      if (requiresTokenRefresh) {
        if (cur?.refreshToken && !refreshInFlightRef.current) {
          refreshInFlightRef.current = true
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
                        detail: { viaInactivityAcknowledge: true, ts: Date.now(), reason: snapshotReason },
                      }),
                    )
                  } catch {
                    /* ignore */
                  }
                }
              } catch {
                /* ignore */
              }
              if (snapshotReason === 'absolute-expiry') {
                lastAbsoluteWarningShownAtRef.current = Date.now()
              }
              closeWarningAndReset()
              return
            } else if (refreshRes.code === 'NETWORK_ERROR') {
              userAcknowledgedAtRef.current = Date.now()
              closeWarningAndReset()
              return
            } else {
              userAcknowledgedAtRef.current = Date.now()
              closeWarningAndReset()
              return
            }
          } finally {
            refreshInFlightRef.current = false
          }
        } else if (!cur?.refreshToken) {
          closeWarningAndReset()
        }
        return
      }

      closeWarningAndReset()
    } finally {
      acknowledgeInFlightRef.current = false
    }
  }, [clearWarningInterval, closeWarningAndReset, settings.accessTokenExpiryBufferMs, settings.idleTimeoutMs, syncSessionFromStorage])

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
    reportActivity('refresh-session')
    return result.session
  }, [reportActivity])

  useEffect(() => {
    const newSettings = readSecurityTimeouts()
    setSettings(newSettings)
    const now = Date.now()
    const candidateDeadline = now + newSettings.idleTimeoutMs
    if (candidateDeadline > idleDeadlineRef.current) {
      console.log('[INACTIVITY DEADLINE RESET]', {
        reason: 'settings-read-hydration (only future)',
        eventType: 'settings-hydration',
        oldDeadline: idleDeadlineRef.current,
        newDeadline: candidateDeadline,
        timeLeftBefore: Math.max(0, idleDeadlineRef.current - now),
        timeLeftAfter: newSettings.idleTimeoutMs,
      })
      idleDeadlineRef.current = candidateDeadline
    } else {
      console.log('[INACTIVITY DEADLINE OVERWRITE SKIPPED]', {
        reason: 'settings-read-hydration candidate not future',
        eventType: 'settings-hydration',
        oldDeadline: idleDeadlineRef.current,
        candidateDeadline,
        timeLeftPreserved: Math.max(0, idleDeadlineRef.current - now),
      })
    }
    setIdleTimeLeftMs(
      candidateDeadline > idleDeadlineRef.current
        ? newSettings.idleTimeoutMs
        : Math.max(0, idleDeadlineRef.current - now),
    )
  }, [])

  useEffect(() => {
    clearTickInterval()
    if (!isAuthenticated) {
      setStatus('active')
      setWarningReason(null)
      warningReasonRef.current = null
      setWarningCountdownSeconds(0)
      const now = Date.now()
      const candidateDeadline = now + settings.idleTimeoutMs
      if (candidateDeadline > idleDeadlineRef.current) {
        idleDeadlineRef.current = candidateDeadline
      }
      setIdleTimeLeftMs(Math.max(0, idleDeadlineRef.current - now))
      lastAbsoluteWarningShownAtRef.current = 0
      return
    }

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
        const graceLeft = ACK_GRACE_MS - (Date.now() - userAcknowledgedAtRef.current)
        if (graceLeft > 0) {
          return
        } else if (refreshInFlightRef.current) {
          return
        } else {
          void markExpired({
            reason: 'refresh-invalid',
            message:
              'El token de renovación ha expirado. Inicia sesión nuevamente para continuar.',
          })
        }
        return
      }

      const left = idleDeadlineRef.current - Date.now()
      const clampedLeft = left < 0 ? 0 : left
      console.log('[INACTIVITY DEBUG]', {
        authenticated: isAuthenticated,
        status: statusRef.current,
        leftMs: clampedLeft,
        warningMs: settings.warningCountdownMs,
        idleTimeoutMs: settings.idleTimeoutMs,
        deadline: idleDeadlineRef.current,
        now: Date.now(),
      })
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
        console.log('[INACTIVITY WARNING TRIGGER]', {
          leftMs: clampedLeft,
          warningMs: settings.warningCountdownMs,
          status: statusRef.current,
          warningReason: warningReasonRef.current,
        })
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

      const ackGraceActive = Date.now() - userAcknowledgedAtRef.current < ACK_GRACE_MS
      if (curSession && !isAccessTokenValid(curSession.accessToken, 15_000)) {
        if (
          isRefreshTokenValid(curSession.refreshToken) &&
          !refreshInFlightRef.current &&
          !ackGraceActive
        ) {
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
    reportActivityRef.current = reportActivity
  }, [reportActivity])

  useEffect(() => {
    if (!isAuthenticated) return

    const isTargetInsideSessionWarningModal = (target: EventTarget | null): boolean => {
      const el = target instanceof Element ? target : target instanceof Node ? (target as Element | null) : null
      return !!(el instanceof Element && el.closest?.('[data-session-warning="true"]'))
    }

    const onActivity = (event: Event) => {
      console.log('[INACTIVITY EVENT]', event.type)
      if (statusRef.current === 'warning' && isTargetInsideSessionWarningModal(event.target)) {
        console.log('[INACTIVITY EVENT] SKIPPED (inside SessionWarningModal during status=warning)', event.type)
        return
      }
      reportActivityRef.current(event.type)
    }

    const opts: AddEventListenerOptions & EventListenerOptions = {
      passive: true,
      capture: false,
    }

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName as string, onActivity, opts)
    }

    const visibilityHandler = () => {
      if (document.visibilityState !== 'visible') return
      if (statusRef.current === 'warning') {
        console.log('[INACTIVITY VISIBILITY] SKIPPED (status=warning; returning to page mid-warning)')
        return
      }
      reportActivityRef.current('visibilitychange')
    }
    document.addEventListener('visibilitychange', visibilityHandler)

    return () => {
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName as string, onActivity, opts)
      }
      document.removeEventListener('visibilitychange', visibilityHandler)
    }
  }, [isAuthenticated])

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
