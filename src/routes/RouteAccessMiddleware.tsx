import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader } from '@/components/ui/loader'
import { useAuth } from '@/hooks/useAuth'
import { evaluateRouteAccess, type RouteAccess } from '@/routes/access-control'
import { paths } from '@/routes/paths'

type RouteAccessMiddlewareProps = {
  access: RouteAccess
  children?: ReactNode
}

export function RouteAccessMiddleware({
  access,
  children,
}: RouteAccessMiddlewareProps) {
  const { session, isBootstrapping } = useAuth()
  const location = useLocation()

  if (isBootstrapping) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader className="h-7 w-7" />
      </div>
    )
  }

  const decision = evaluateRouteAccess(session, access)

  if (!decision.allowed) {
    if (decision.reason === 'unauthenticated') {
      return <Navigate to={paths.login} replace state={{ from: location }} />
    }

    if (decision.reason === 'public-only') {
      return <Navigate to={paths.dashboard} replace />
    }

    return <Navigate to={paths.forbidden} replace state={{ from: location }} />
  }

  return children ? <>{children}</> : <Outlet />
}

