import type { BadgeProps } from '@/components/ui/badge'
import type { AuthPermission, AuthRole } from '@/types/auth'

type PermissionDefinition = {
  key: Exclude<AuthPermission, '*'>
  label: string
  description: string
  module: string
}

type RoleDefinition = {
  key: AuthRole
  label: string
  description: string
  badgeVariant: NonNullable<BadgeProps['variant']>
  permissions: AuthPermission[]
}

export const permissionDefinitions: PermissionDefinition[] = [
  {
    key: 'dashboard.read',
    label: 'Ver dashboard',
    description: 'Permite acceder al panel principal y sus indicadores.',
    module: 'General',
  },
  {
    key: 'ventas.read',
    label: 'Ver ventas',
    description: 'Permite acceder al módulo de ventas.',
    module: 'Ventas',
  },
  {
    key: 'productos.read',
    label: 'Ver productos',
    description: 'Permite acceder al catálogo de productos.',
    module: 'Productos',
  },
  {
    key: 'compras.read',
    label: 'Ver compras',
    description: 'Permite acceder al módulo de compras.',
    module: 'Compras',
  },
  {
    key: 'inventario.read',
    label: 'Ver inventario',
    description: 'Permite revisar stock, lotes y movimientos.',
    module: 'Inventario',
  },
  {
    key: 'clientes.read',
    label: 'Ver clientes',
    description: 'Permite acceder al padrón de clientes.',
    module: 'Clientes',
  },
  {
    key: 'proveedores.read',
    label: 'Ver proveedores',
    description: 'Permite acceder al padrón de proveedores.',
    module: 'Proveedores',
  },
  {
    key: 'caja.read',
    label: 'Ver caja',
    description: 'Permite operar y consultar el módulo de caja.',
    module: 'Caja',
  },
  {
    key: 'usuarios.read',
    label: 'Ver usuarios',
    description: 'Permite acceder a usuarios, roles y permisos.',
    module: 'Seguridad',
  },
  {
    key: 'usuarios.manage',
    label: 'Gestionar usuarios',
    description: 'Permite crear, editar y cambiar el estado de usuarios.',
    module: 'Seguridad',
  },
  {
    key: 'sesiones.read',
    label: 'Ver sesiones',
    description: 'Permite consultar sesiones activas y recientes.',
    module: 'Seguridad',
  },
  {
    key: 'sesiones.revoke',
    label: 'Revocar sesiones',
    description: 'Permite cerrar sesiones activas de otros usuarios.',
    module: 'Seguridad',
  },
  {
    key: 'auditoria.read',
    label: 'Ver auditoría',
    description: 'Permite consultar el historial de acciones del sistema.',
    module: 'Seguridad',
  },
  {
    key: 'reportes.read',
    label: 'Ver reportes',
    description: 'Permite acceder al módulo de reportes.',
    module: 'Reportes',
  },
  {
    key: 'configuracion.read',
    label: 'Ver configuración',
    description: 'Permite acceder a la configuración general del sistema.',
    module: 'Configuración',
  },
]

export const roleDefinitions: RoleDefinition[] = [
  {
    key: 'ADMIN',
    label: 'Administrador',
    description: 'Control total del sistema, incluyendo seguridad y configuración.',
    badgeVariant: 'info',
    permissions: ['*'],
  },
  {
    key: 'SUPERVISOR',
    label: 'Supervisor',
    description: 'Supervisa operación, inventario, compras, reportes y usuarios.',
    badgeVariant: 'success',
    permissions: [
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
  },
  {
    key: 'CAJERO',
    label: 'Cajero',
    description: 'Opera ventas, caja y consultas operativas del día a día.',
    badgeVariant: 'warning',
    permissions: [
      'dashboard.read',
      'ventas.read',
      'productos.read',
      'inventario.read',
      'clientes.read',
      'caja.read',
    ],
  },
]

export const permissionDefinitionMap = Object.fromEntries(
  permissionDefinitions.map((permission) => [permission.key, permission]),
) as Record<PermissionDefinition['key'], PermissionDefinition>

export const roleDefinitionMap = Object.fromEntries(
  roleDefinitions.map((role) => [role.key, role]),
) as Record<AuthRole, RoleDefinition>

export const permissionModules = Array.from(
  new Set(permissionDefinitions.map((permission) => permission.module)),
)

export function getDefaultPermissionsForRoles(roles: AuthRole[]) {
  const expandedPermissions = roles.flatMap(
    (role) => roleDefinitionMap[role]?.permissions ?? [],
  )

  if (expandedPermissions.includes('*')) {
    return ['*'] as AuthPermission[]
  }

  return Array.from(new Set(expandedPermissions))
}
