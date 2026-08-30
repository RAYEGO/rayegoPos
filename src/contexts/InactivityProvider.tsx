import { useEffect, useMemo, useRef, useState } from 'react'
import { createSafeContext } from '@/lib/safe-context'
import { useAuth } from '@/hooks/useAuth'
import { authService } from '@/services/authService'
import {
  readSecurityTimeouts,
  readPendingOperation,
  type PendingOperationSnapshot,
  type SecurityTimeoutSettings,
} from '@/config/security'
import { isAccessTokenValid, isRefreshTokenValid } from '@/utils/jwt'
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
] as const

const ACTIVITY_REPORT_COOLDOWN_MS = 800

type InactivityStatus = 'active' | 'warning' | 'expired'

type SessionExpirationDetails = {
  reason:
    | 'idle-timeout'
    | 'access-expired-no-refresh'
    | 'refresh-invalid'
    | 'manual-logout'
    | 'auth-401-unrecoverable'
  message: string
}

export type InactivityContextValue = {
  status: InactivityStatus
  settings: SecurityTimeoutSettings
  lastActivityAt: number
  idleTimeLeftMs: number
  warningCountdownSeconds: number
  pendingOperation: PendingOperationSnapshot | null
  refreshSession: () => Promise<AuthSession | null>
  reportActivity: () => void
  setPendingOperation: (snapshot: PendingOperationSnapshot | null) => void
  acknowledgeWarning: () => void
  markExpired: (details: SessionExpirationDetails) => void
  lastExpirationDetails: SessionExpirationDetails | null
}

const [InactivityContext, useInactivityContext] = createSafeContext<InactivityContextValue>(
  'InactivityContext',
)

export { useInactivityContext }

export function InactivityProvider({ children }: { children: React.ReactNode }) {
  const { session, isAuthenticated, logout } = useAuth()

  const [settings, setSettings] = useState<SecurityTimeoutSettings>(() =>
    readSecurityTimeouts(),
  )
  const [status, setStatus] = useState<InactivityStatus>('active')
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
  const lastIdleUpdateRef = useRef<number>(0)

  useEffect(() => {
    sessionRef.current = session
    isAuthenticatedRef.current = isAuthenticated
  }, [session, isAuthenticated])

  useEffect(() => {
    statusRef.current = status
  }, [status])

  const clearWarningInterval = () => {
    if (warningIntervalRef.current !== null) {
      window.clearInterval(warningIntervalRef.current)
      warningIntervalRef.current = null
    }
  }

  const lastReportAtRef = useRef<number>(0)

  const clearTickInterval = () => {
    if (tickIntervalRef.current !== null) {
      window.clearInterval(tickIntervalRef.current)
      tickIntervalRef.current = null
    }
  }

  const reportActivity = () => {
    const now = Date.now()
    if (now - lastReportAtRef.current < ACTIVITY_REPORT_COOLDOWN_MS) {
      idleDeadlineRef.current = now + settings.idleTimeoutMs
      return
    }
    lastReportAtRef.current = now
    setLastActivityAt(now)
    idleDeadlineRef.current = now + settings.idleTimeoutMs
    setIdleTimeLeftMs(settings.idleTimeoutMs)

    if (statusRef.current !== 'active') {
      setStatus('active')
      clearWarningInterval()
      setWarningCountdownSeconds(0)
      setLastExpirationDetails(null)

      void (async () => {
        const cur = sessionRef.current
        if (!cur?.accessToken) return
        if (!isAccessTokenValid(cur.accessToken, settings.accessTokenExpiryBufferMs)) {
          if (isRefreshTokenValid(cur.refreshToken)) {
            const refreshRes = await authService.refreshSession()
            if (refreshRes.ok) {
              sessionRef.current = refreshRes.session
            }
          }
        }
      })()
    }
  }

  const acknowledgeWarning = () => {
    reportActivity()
  }

  const setPendingOperation = (snapshot: PendingOperationSnapshot | null) => {
    if (snapshot) {
      window.localStorage.setItem(
        'rayego-pos.security.pending-operation',
        JSON.stringify(snapshot),
      )
    } else {
      window.localStorage.removeItem('rayego-pos.security.pending-operation')
    }
    setPendingOperationState(snapshot)
  }

  const refreshSession = async (): Promise<AuthSession | null> => {
    const result = await authService.refreshSession()
    if (!result.ok) return null
    reportActivity()
    return result.session
  }

  const markExpired = (details: SessionExpirationDetails) => {
    setLastExpirationDetails(details)
    setStatus('expired')
    clearWarningInterval()
    clearTickInterval()
    void logout(details.message)
  }

  const transitionToWarning = () => {
    if (statusRef.current !== 'active') return
    setStatus('warning')
    const seconds = Math.max(1, Math.round(settings.warningCountdownMs / 1000))
    setWarningCountdownSeconds(seconds)

    clearWarningInterval()
    warningIntervalRef.current = window.setInterval(() => {
      setWarningCountdownSeconds((prev) => {
        const next = prev - 1
        if (next <= 0) {
          clearWarningInterval()
          markExpired({
            reason: 'idle-timeout',
            message: `Tu sesión expiró por inactividad después de ${Math.round(settings.idleTimeoutMs / 60000)} minutos.`,
          })
          return 0
        }
        return next
      })
    }, 1000)
  }

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
      setWarningCountdownSeconds(0)
      setIdleTimeLeftMs(settings.idleTimeoutMs)
      idleDeadlineRef.current = Date.now() + settings.idleTimeoutMs
      return
    }

    idleDeadlineRef.current = Date.now() + settings.idleTimeoutMs

    tickIntervalRef.current = window.setInterval(() => {
      if (statusRef.current === 'expired') return
      const left = idleDeadlineRef.current - Date.now()
      const clampedLeft = left < 0 ? 0 : left
      const inWarningWindow =
        clampedLeft <= settings.warningCountdownMs || statusRef.current === 'warning'

      if (inWarningWindow) {
        setIdleTimeLeftMs(clampedLeft)
      } else {
        const now = Date.now()
        if (now - lastIdleUpdateRef.current >= 5000) {
          lastIdleUpdateRef.current = now
          setIdleTimeLeftMs(clampedLeft)
        }
      }

      if (clampedLeft <= settings.warningCountdownMs) {
        transitionToWarning()
      }

      const curSession = sessionRef.current
      if (curSession && !isAccessTokenValid(curSession.accessToken, 15_000)) {
        if (isRefreshTokenValid(curSession.refreshToken)) {
          console.debug(
            `[INACTIVITY] Access token cerca de expirar en tick loop. Refresh silencioso antes del logout. (left=${left}ms)`,
          )
          void (async () => {
            const refreshRes = await authService.refreshSession()
            if (refreshRes.ok) {
              sessionRef.current = refreshRes.session
            }
          })()
        }
      }
    }, 1000)

    return () => {
      clearTickInterval()
    }
  }, [isAuthenticated, settings.idleTimeoutMs, settings.warningCountdownMs, settings.accessTokenExpiryBufferMs])

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
  }, [isAuthenticated])

  const value = useMemo<InactivityContextValue>(
    () => ({
      status,
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
      settings,
      lastActivityAt,
      idleTimeLeftMs,
      warningCountdownSeconds,
      pendingOperation,
      lastExpirationDetails,
    ],
  )

  return <InactivityContext.Provider value={value}>{children}</InactivityContext.Provider>
}
