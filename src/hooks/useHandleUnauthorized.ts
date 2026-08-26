import { useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { authMockService } from '@/services/authMockService'
import { authService } from '@/services/authService'
import { useAuth } from '@/hooks/useAuth'
import { useInactivityContext } from '@/contexts/InactivityProvider'
import type { AuthSession } from '@/types/auth'

type UnauthorizedContext = {
  endpoint: string
  page: string
}

type HandleUnauthorizedFn = {
  (): Promise<{ handledAsMock: boolean; handledViaRefresh: boolean }>
  (
    status: number,
    message: string,
    context: UnauthorizedContext | string,
  ): Promise<{ handledAsMock: boolean; handledViaRefresh: boolean }>
}

export function useHandleUnauthorized(page: string) {
  const { logout, session } = useAuth()
  const { markExpired, reportActivity } = useInactivityContext()

  const volatile = useCallback(
    async (...args: unknown[]): Promise<{ handledAsMock: boolean; handledViaRefresh: boolean }> => {
      let status: number
      let message: string
      let endpoint: string

      if (args.length === 0) {
        status = 401
        message = 'La sesión ya no es válida.'
        endpoint = 'unknown'
      } else {
        status = (args[0] as number) ?? 401
        message = (args[1] as string) ?? 'La sesión ya no es válida.'
        const ctx = args[2]
        if (typeof ctx === 'string') {
          endpoint = ctx
        } else if (ctx && typeof ctx === 'object' && 'endpoint' in (ctx as Record<string, unknown>)) {
          endpoint = (ctx as UnauthorizedContext).endpoint
        } else {
          endpoint = 'unknown'
        }
      }

      const effectiveSession = session as AuthSession | null
      const sessionIsMock = effectiveSession && authMockService.isMockSession(effectiveSession)

      if (sessionIsMock) {
        console.warn(
          `[${page}] 401 en ${endpoint} status=${status} message="${message}". SE OMITE logout porque session.accessToken es MOCK (modo demo). Data placeholder se mantendrá visible.`,
        )
        toast.info(
          'Estás operando en modo demo (sin conexión al servidor de datos). Algunos datos se muestran en modo ejemplo.',
          { id: `demo-mode-info-${page}-${endpoint}` },
        )
        return { handledAsMock: true, handledViaRefresh: false }
      }

      if (status === 401 && effectiveSession?.refreshToken) {
        console.warn(
          `[${page}] 401 en ${endpoint}. Se intenta REFRESH TOKEN antes de expulsar al usuario.`,
        )
        const refresh = await authService.refreshSession()
        if (refresh.ok) {
          reportActivity()
          toast.success(
            'Tu sesión fue renovada automáticamente. Puedes continuar trabajando normalmente.',
            { id: `auth-refreshed-${page}-${endpoint}` },
          )
          return { handledAsMock: false, handledViaRefresh: true }
        }
        if (refresh.code === 'NETWORK_ERROR') {
          toast.warning(
            'No fue posible renovar tu sesión por un corte de conexión. Se conservará la sesión local hasta que la conexión se restablezca.',
            { id: `auth-refresh-network-${page}-${endpoint}` },
          )
          return { handledAsMock: false, handledViaRefresh: false }
        }
        console.warn(
          `[${page}] Refresh falló con code=${refresh.code} message="${refresh.message}". Se procede a logout.`,
        )
      }

      const reason = `${page}.handleUnauthorized → ${endpoint} status=${status} message="${message}"`
      console.warn(
        `[${page}] 401 en ${endpoint} status=${status} message="${message}". Se dispara logout.`,
      )
      toast.error('Tu sesión ya no es válida. Ingresa nuevamente para continuar.')
      markExpired({
        reason: status === 401 ? 'auth-401-unrecoverable' : 'manual-logout',
        message: reason,
      })
      await logout(reason)
      return { handledAsMock: false, handledViaRefresh: false }
    },
    [logout, markExpired, page, reportActivity, session],
  )

  const volatileRef = useRef(volatile)
  volatileRef.current = volatile

  const handler = useCallback<HandleUnauthorizedFn>(
    (...args: unknown[]) => volatileRef.current(...args) as ReturnType<HandleUnauthorizedFn>,
    [],
  )

  return handler as HandleUnauthorizedFn
}
