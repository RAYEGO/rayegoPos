import type { AuthBranch, AuthRole } from '@/types/auth'

export type UserStatus = 'ACTIVO' | 'BLOQUEADO' | 'INVITADO'

export type UsersModuleUserRecord = {
  id: string
  firstName: string
  lastName: string
  documentId: string
  phone: string
  email: string
  username: string
  primaryRole: AuthRole
  roles: AuthRole[]
  branchIds: string[]
  status: UserStatus
  lastAccessAt: string
  mustChangePassword: boolean
  mfaEnabled: boolean
}

export const usersModuleBranches: AuthBranch[] = [
  { id: 'br-pichanaki', code: 'PIC', name: 'Pichanaki' },
  { id: 'br-lamerced', code: 'LAM', name: 'La Merced' },
  { id: 'br-satipo', code: 'SAT', name: 'Satipo' },
]

export const usersModuleUsers: UsersModuleUserRecord[] = [
  {
    id: 'usr-001',
    firstName: 'Administrador',
    lastName: 'General',
    documentId: '70123456',
    phone: '+51 999 111 222',
    email: 'admin@rayego.pe',
    username: 'admin',
    primaryRole: 'ADMIN',
    roles: ['ADMIN'],
    branchIds: ['br-pichanaki', 'br-lamerced', 'br-satipo'],
    status: 'ACTIVO',
    lastAccessAt: '2026-07-13 18:42',
    mustChangePassword: false,
    mfaEnabled: true,
  },
  {
    id: 'usr-002',
    firstName: 'Supervisor',
    lastName: 'Operaciones',
    documentId: '72556633',
    phone: '+51 999 333 444',
    email: 'supervisor@rayego.pe',
    username: 'supervisor',
    primaryRole: 'SUPERVISOR',
    roles: ['SUPERVISOR'],
    branchIds: ['br-pichanaki', 'br-lamerced'],
    status: 'ACTIVO',
    lastAccessAt: '2026-07-13 17:58',
    mustChangePassword: false,
    mfaEnabled: true,
  },
  {
    id: 'usr-003',
    firstName: 'Operador',
    lastName: 'Caja',
    documentId: '74445511',
    phone: '+51 999 555 666',
    email: 'caja@rayego.pe',
    username: 'caja',
    primaryRole: 'CAJERO',
    roles: ['CAJERO'],
    branchIds: ['br-pichanaki'],
    status: 'ACTIVO',
    lastAccessAt: '2026-07-13 17:34',
    mustChangePassword: true,
    mfaEnabled: false,
  },
  {
    id: 'usr-004',
    firstName: 'Química',
    lastName: 'Farmacéutica',
    documentId: '41223344',
    phone: '+51 999 777 888',
    email: 'qf@rayego.pe',
    username: 'qf',
    primaryRole: 'SUPERVISOR',
    roles: ['SUPERVISOR'],
    branchIds: ['br-lamerced'],
    status: 'INVITADO',
    lastAccessAt: 'Pendiente',
    mustChangePassword: true,
    mfaEnabled: false,
  },
  {
    id: 'usr-005',
    firstName: 'Auxiliar',
    lastName: 'Inventario',
    documentId: '77665544',
    phone: '+51 999 888 999',
    email: 'inventario@rayego.pe',
    username: 'inventario',
    primaryRole: 'ALMACEN',
    roles: ['ALMACEN'],
    branchIds: ['br-pichanaki', 'br-satipo'],
    status: 'BLOQUEADO',
    lastAccessAt: '2026-07-09 08:11',
    mustChangePassword: false,
    mfaEnabled: false,
  },
]

