import { apiRequest } from '@/services/apiClient'
import type { AuthRole, UserStatus } from '@/types/auth'

export type UsersModuleUserRecord = {
  id: string
  firstName: string
  lastName: string
  documentId: string | null
  phone: string | null
  email: string | null
  username: string
  primaryRole: AuthRole
  roles: AuthRole[]
  branchIds: string[]
  status: UserStatus
  lastAccessAt: string
  mustChangePassword: boolean
  mfaEnabled: boolean
}

export type CreateUserPayload = {
  firstName: string
  lastName: string
  documentId: string
  tipoDocumento?: 'DNI' | 'CE' | 'PASAPORTE' | 'RUC' | 'OTRO'
  phone: string
  email: string
  username: string
  password: string
  role: 'ADMIN' | 'SUPERVISOR' | 'CAJERO' | 'ALMACEN'
  branchIds: string[]
  isActive: boolean
  mustChangePassword?: boolean
}

export type UpdateUserPayload = Omit<CreateUserPayload, 'password'> & {
  password?: string
}

export const usersService = {
  list(accessToken: string) {
    return apiRequest<UsersModuleUserRecord[]>('/api/users', {
      accessToken,
    })
  },

  create(accessToken: string, payload: CreateUserPayload) {
    return apiRequest<UsersModuleUserRecord>('/api/users', {
      method: 'POST',
      accessToken,
      body: payload,
    })
  },

  update(accessToken: string, userId: string, payload: UpdateUserPayload) {
    return apiRequest<UsersModuleUserRecord>(`/api/users/${userId}`, {
      method: 'PUT',
      accessToken,
      body: payload,
    })
  },
}
