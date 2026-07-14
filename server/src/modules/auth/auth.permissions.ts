import type { AuthPermission, AuthRole } from './auth.types.js'

const roleLabels: Record<AuthRole, string> = {
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  CAJERO: 'Cajero',
}

const rolePermissions: Record<AuthRole, AuthPermission[]> = {
  ADMIN: ['*'],
  SUPERVISOR: [
    'dashboard.read',
    'ventas.read',
    'productos.read',
    'compras.read',
    'inventario.read',
    'clientes.read',
    'proveedores.read',
    'caja.read',
    'usuarios.read',
    'sesiones.read',
    'auditoria.read',
    'reportes.read',
  ],
  CAJERO: [
    'dashboard.read',
    'ventas.read',
    'productos.read',
    'inventario.read',
    'clientes.read',
    'caja.read',
  ],
}

export function isAuthRole(value: string): value is AuthRole {
  return value === 'ADMIN' || value === 'SUPERVISOR' || value === 'CAJERO'
}

export function getRoleLabel(role: AuthRole) {
  return roleLabels[role]
}

export function getPermissionsForRoles(roles: AuthRole[]) {
  const expandedPermissions = roles.flatMap((role) => rolePermissions[role] ?? [])

  if (expandedPermissions.includes('*')) {
    return ['*'] as AuthPermission[]
  }

  return Array.from(new Set(expandedPermissions))
}
