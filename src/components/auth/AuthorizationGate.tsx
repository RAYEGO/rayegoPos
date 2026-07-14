import type { ReactNode } from 'react'
import { useAuthorization } from '@/hooks/useAuthorization'
import type { AuthPermission, AuthRole } from '@/types/auth'

type AuthorizationGateProps = {
  permission?: AuthPermission
  permissions?: AuthPermission[]
  role?: AuthRole
  roles?: AuthRole[]
  match?: 'any' | 'all'
  fallback?: ReactNode
  children: ReactNode
}

export function AuthorizationGate({
  permission,
  permissions,
  role,
  roles,
  match = 'any',
  fallback = null,
  children,
}: AuthorizationGateProps) {
  const { can, canAny, canAll, hasRole, hasAnyRole } = useAuthorization()

  const isAllowedByPermission =
    permission
      ? can(permission)
      : permissions?.length
        ? match === 'all'
          ? canAll(permissions)
          : canAny(permissions)
        : true

  const isAllowedByRole =
    role ? hasRole(role) : roles?.length ? hasAnyRole(roles) : true

  return isAllowedByPermission && isAllowedByRole ? <>{children}</> : <>{fallback}</>
}

