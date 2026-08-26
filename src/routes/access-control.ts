import type { AuthPermission, AuthRole, AuthSession } from '@/types/auth'

export type RouteAccess = {
  requiresAuth?: boolean
  publicOnly?: boolean
  allowedRoles?: AuthRole[]
  allowedPermissions?: AuthPermission[]
  match?: 'any' | 'all'
  moduleCode?: string
}

export type AccessDecision =
  | { allowed: true }
  | {
      allowed: false
      reason: 'unauthenticated' | 'forbidden' | 'public-only' | 'module-not-enabled'
    }

export function permissionToModuleCode(permissionCode: string): string {
  return permissionCode.split('.')[0] ?? permissionCode
}

export function hasEnabledModule(
  session: AuthSession | null,
  moduleCode: string,
) {
  if (!session) {
    return false
  }
  const enabledModules = session.user.enabledModules ?? []
  if (!Array.isArray(enabledModules) || enabledModules.length === 0) {
    return true
  }
  return enabledModules.includes(moduleCode)
}

export function hasPermission(
  session: AuthSession | null,
  permission: AuthPermission,
) {
  if (!session) {
    return false
  }

  const permissions = (session as { user?: { permissions?: unknown } })?.user?.permissions
  const normalizedPermissions = Array.isArray(permissions) ? permissions : []
  return (
    normalizedPermissions.includes('*') ||
    normalizedPermissions.includes(permission)
  )
}

export function hasAnyPermission(
  session: AuthSession | null,
  permissions: AuthPermission[],
) {
  return permissions.some((permission) => hasPermission(session, permission))
}

export function hasAllPermissions(
  session: AuthSession | null,
  permissions: AuthPermission[],
) {
  return permissions.every((permission) => hasPermission(session, permission))
}

export function hasAllowedRole(session: AuthSession | null, roles: AuthRole[]) {
  if (!session) {
    return false
  }

  return roles.some((role) => session.user.roles.includes(role))
}

export function evaluateRouteAccess(
  session: AuthSession | null,
  access: RouteAccess,
): AccessDecision {
  if (access.publicOnly && session) {
    return { allowed: false, reason: 'public-only' }
  }

  if (access.requiresAuth && !session) {
    return { allowed: false, reason: 'unauthenticated' }
  }

  if (access.allowedRoles?.length && !hasAllowedRole(session, access.allowedRoles)) {
    return { allowed: false, reason: 'forbidden' }
  }

  if (access.allowedPermissions?.length) {
    const match = access.match ?? 'any'
    const isAllowed =
      match === 'all'
        ? hasAllPermissions(session, access.allowedPermissions)
        : hasAnyPermission(session, access.allowedPermissions)

    if (!isAllowed) {
      return { allowed: false, reason: 'forbidden' }
    }
  }

  if (access.moduleCode && session) {
    if (!hasEnabledModule(session, access.moduleCode)) {
      return { allowed: false, reason: 'module-not-enabled' }
    }
  }

  return { allowed: true }
}

export function filterRoutesByEnabledModules<T extends { access?: { moduleCode?: string } }>(
  routes: T[],
  session: AuthSession | null,
): T[] {
  if (!session) {
    return routes
  }
  const enabledModules = session.user.enabledModules ?? []
  if (!Array.isArray(enabledModules) || enabledModules.length === 0) {
    return routes
  }
  return routes.filter((route) => {
    const moduleCode = route.access?.moduleCode
    if (!moduleCode) {
      return true
    }
    return enabledModules.includes(moduleCode)
  })
}
