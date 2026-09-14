import { apiRequest } from '@/services/apiClient'
import type { AuthPermission, AuthRole } from '@/types/auth'

export type RolesModuleRoleListItem = {
  codigo: AuthRole
  nombre: string
  descripcion: string | null
  isPlatformOnly: boolean
  permissionsCount: number
}

export type AvailablePermission = {
  codigo: string
  modulo: string
  nombre: string
  descripcion: string | null
  tipo: 'read' | 'manage' | 'otro'
}

export type RolePermissionsDetail = {
  codigo: AuthRole
  nombre: string
  descripcion: string | null
  isPlatformOnly: boolean
  permisos: AuthPermission[]
  permisosDisponibles: AvailablePermission[]
}

export type UpdateRolePermissionsResult = {
  ok: true
  affectedUsers: number
}

export const rolesService = {
  list(accessToken: string) {
    return apiRequest<RolesModuleRoleListItem[]>('/api/roles', {
      accessToken,
    })
  },

  getRolePermissions(accessToken: string, roleCodigo: AuthRole) {
    return apiRequest<RolePermissionsDetail>(`/api/roles/${encodeURIComponent(roleCodigo)}/permissions`, {
      accessToken,
    })
  },

  updateRolePermissions(
    accessToken: string,
    roleCodigo: AuthRole,
    permisos: AuthPermission[],
  ) {
    return apiRequest<UpdateRolePermissionsResult>(`/api/roles/${encodeURIComponent(roleCodigo)}/permissions`, {
      method: 'PUT',
      accessToken,
      body: { permisos },
    })
  },
}
