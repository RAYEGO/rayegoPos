import { useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  evaluateRouteAccess,
  hasAllPermissions,
  hasAllowedRole,
  hasAnyPermission,
  hasPermission,
  type RouteAccess,
} from '@/routes/access-control'
import type { AuthPermission, AuthRole } from '@/types/auth'

export function useAuthorization() {
  const { session } = useAuth()

  return useMemo(
    () => ({
      roles: session?.user.roles ?? [],
      permissions: session?.user.permissions ?? [],
      can: (permission: AuthPermission) => hasPermission(session, permission),
      canAny: (permissions: AuthPermission[]) =>
        hasAnyPermission(session, permissions),
      canAll: (permissions: AuthPermission[]) =>
        hasAllPermissions(session, permissions),
      hasRole: (role: AuthRole) => hasAllowedRole(session, [role]),
      hasAnyRole: (roles: AuthRole[]) => hasAllowedRole(session, roles),
      canAccess: (access: RouteAccess) => evaluateRouteAccess(session, access).allowed,
    }),
    [session],
  )
}

