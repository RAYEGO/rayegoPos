import type { AuthPermission, AuthRole } from './auth.types.js'

const roleLabels: Record<AuthRole, string> = {
  ADMIN: 'Administrador',
  ADMIN_POS: 'Administrador POS (Plataforma)',
  SUPERVISOR: 'Supervisor',
  CAJERO: 'Cajero',
  ALMACEN: 'Almacén',
}

const rolePermissions: Record<AuthRole, AuthPermission[]> = {
  ADMIN: [
    'dashboard.read',
    'ventas.read',
    'productos.read',
    'compras.read',
    'inventario.read',
    'clientes.read',
    'proveedores.read',
    'caja.read',
    'usuarios.read',
    'usuarios.manage',
    'sesiones.read',
    'sesiones.revoke',
    'auditoria.read',
    'reportes.read',
    'configuracion.read',
  ],
  ADMIN_POS: [
    'dashboard.read',
    'tipos_empresa.manage',
    'empresas.read',
    'empresas.manage',
    'administradores.manage',
    'usuarios.read',
    'usuarios.manage',
    'sesiones.read',
    'sesiones.revoke',
    'auditoria.read',
    'reportes.read',
    'configuracion.read',
  ],
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
  ALMACEN: [
    'dashboard.read',
    'productos.read',
    'compras.read',
    'inventario.read',
    'proveedores.read',
  ],
}

const ALL_ROLE_CODES: AuthRole[] = ['ADMIN', 'ADMIN_POS', 'SUPERVISOR', 'CAJERO', 'ALMACEN']

export function isAuthRole(value: string): value is AuthRole {
  return ALL_ROLE_CODES.includes(value as AuthRole)
}

export function isPlatformAdminRole(role: AuthRole): boolean {
  return role === 'ADMIN_POS'
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
