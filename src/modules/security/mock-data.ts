import type { AuthRole } from '@/types/auth'

export type SecurityUserRecord = {
  id: string
  fullName: string
  email: string
  branchName: string
  roles: AuthRole[]
  status: 'ACTIVO' | 'BLOQUEADO' | 'INVITADO'
  lastAccessAt: string
  lastPasswordChangeAt: string
  mfaEnabled: boolean
}

export type SecuritySessionRecord = {
  id: string
  userName: string
  role: AuthRole
  device: string
  ipAddress: string
  startedAt: string
  lastSeenAt: string
  status: 'ACTIVA' | 'INACTIVA' | 'REVOCADA'
  isCurrent: boolean
}

export type AuditRecord = {
  id: string
  actorName: string
  actorRole: AuthRole
  module: string
  action: string
  target: string
  ipAddress: string
  createdAt: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
}

export const securityUsers: SecurityUserRecord[] = [
  {
    id: 'usr-001',
    fullName: 'Administrador General',
    email: 'admin@rayego.pe',
    branchName: 'Sucursal Principal',
    roles: ['ADMIN'],
    status: 'ACTIVO',
    lastAccessAt: '2026-07-13 18:42',
    lastPasswordChangeAt: '2026-07-01 09:15',
    mfaEnabled: true,
  },
  {
    id: 'usr-002',
    fullName: 'Supervisor de Operaciones',
    email: 'supervisor@rayego.pe',
    branchName: 'Sucursal Principal',
    roles: ['SUPERVISOR'],
    status: 'ACTIVO',
    lastAccessAt: '2026-07-13 17:58',
    lastPasswordChangeAt: '2026-06-26 11:40',
    mfaEnabled: true,
  },
  {
    id: 'usr-003',
    fullName: 'Operador de Caja',
    email: 'caja@rayego.pe',
    branchName: 'Sucursal Principal',
    roles: ['CAJERO'],
    status: 'ACTIVO',
    lastAccessAt: '2026-07-13 17:34',
    lastPasswordChangeAt: '2026-06-18 15:22',
    mfaEnabled: false,
  },
  {
    id: 'usr-004',
    fullName: 'Química Farmacéutica',
    email: 'qf@rayego.pe',
    branchName: 'Sucursal Centro',
    roles: ['SUPERVISOR'],
    status: 'INVITADO',
    lastAccessAt: 'Pendiente',
    lastPasswordChangeAt: 'Pendiente',
    mfaEnabled: false,
  },
  {
    id: 'usr-005',
    fullName: 'Auxiliar de Inventario',
    email: 'inventario@rayego.pe',
    branchName: 'Sucursal Principal',
    roles: ['CAJERO'],
    status: 'BLOQUEADO',
    lastAccessAt: '2026-07-09 08:11',
    lastPasswordChangeAt: '2026-05-20 10:05',
    mfaEnabled: false,
  },
]

export const securitySessions: SecuritySessionRecord[] = [
  {
    id: 'ses-001',
    userName: 'Administrador General',
    role: 'ADMIN',
    device: 'Windows 11 · Chrome 138',
    ipAddress: '192.168.1.38',
    startedAt: '2026-07-13 18:10',
    lastSeenAt: 'Hace 1 min',
    status: 'ACTIVA',
    isCurrent: true,
  },
  {
    id: 'ses-002',
    userName: 'Supervisor de Operaciones',
    role: 'SUPERVISOR',
    device: 'macOS · Safari 18',
    ipAddress: '192.168.1.52',
    startedAt: '2026-07-13 16:45',
    lastSeenAt: 'Hace 8 min',
    status: 'ACTIVA',
    isCurrent: false,
  },
  {
    id: 'ses-003',
    userName: 'Operador de Caja',
    role: 'CAJERO',
    device: 'Android Tablet · Chrome',
    ipAddress: '192.168.1.80',
    startedAt: '2026-07-13 09:02',
    lastSeenAt: 'Hace 26 min',
    status: 'INACTIVA',
    isCurrent: false,
  },
  {
    id: 'ses-004',
    userName: 'Auxiliar de Inventario',
    role: 'CAJERO',
    device: 'Windows 10 · Edge',
    ipAddress: '192.168.1.61',
    startedAt: '2026-07-09 07:55',
    lastSeenAt: '2026-07-09 08:11',
    status: 'REVOCADA',
    isCurrent: false,
  },
]

export const auditRecords: AuditRecord[] = [
  {
    id: 'aud-001',
    actorName: 'Administrador General',
    actorRole: 'ADMIN',
    module: 'Seguridad',
    action: 'Actualizó permisos del rol Supervisor',
    target: 'Rol SUPERVISOR',
    ipAddress: '192.168.1.38',
    createdAt: '2026-07-13 18:22',
    severity: 'CRITICAL',
  },
  {
    id: 'aud-002',
    actorName: 'Supervisor de Operaciones',
    actorRole: 'SUPERVISOR',
    module: 'Inventario',
    action: 'Consultó movimientos de lotes',
    target: 'Lote AMX-2406',
    ipAddress: '192.168.1.52',
    createdAt: '2026-07-13 17:41',
    severity: 'INFO',
  },
  {
    id: 'aud-003',
    actorName: 'Administrador General',
    actorRole: 'ADMIN',
    module: 'Sesiones',
    action: 'Revocó una sesión remota',
    target: 'ses-004',
    ipAddress: '192.168.1.38',
    createdAt: '2026-07-13 16:12',
    severity: 'WARNING',
  },
  {
    id: 'aud-004',
    actorName: 'Operador de Caja',
    actorRole: 'CAJERO',
    module: 'Caja',
    action: 'Inició sesión desde tablet',
    target: 'Caja Principal',
    ipAddress: '192.168.1.80',
    createdAt: '2026-07-13 09:03',
    severity: 'INFO',
  },
  {
    id: 'aud-005',
    actorName: 'Administrador General',
    actorRole: 'ADMIN',
    module: 'Usuarios',
    action: 'Bloqueó usuario por intentos fallidos',
    target: 'inventario@rayego.pe',
    ipAddress: '192.168.1.38',
    createdAt: '2026-07-09 08:15',
    severity: 'WARNING',
  },
]

