import { getDefaultPermissionsForRoles, roleDefinitionMap } from '@/config/authorization'
import type {
  AuthRole,
  AuthSession,
  ForgotPasswordPayload,
  ForgotPasswordResult,
  LoginPayload,
  ResetPasswordPayload,
} from '@/types/auth'

const MODULOS_BOTICA = [
  'dashboard',
  'ventas',
  'productos',
  'compras',
  'inventario',
  'lotes',
  'kardex',
  'clientes',
  'proveedores',
  'caja',
  'reportes',
  'configuracion',
  'usuarios',
  'sesiones',
  'auditoria',
]

function createSession({
  accessToken,
  refreshToken,
  id,
  email,
  fullName,
  companyId,
  companyName,
  companyTypeId = '00000000-0000-0000-0000-000000000001',
  companyTypeCode = 'BOTICA',
  enabledModules = MODULOS_BOTICA,
  branchId,
  branchCode,
  branchName,
  roles,
}: {
  accessToken: string
  refreshToken: string
  id: string
  email: string
  fullName: string
  companyId: string
  companyName: string
  companyTypeId?: string
  companyTypeCode?: string
  enabledModules?: string[]
  branchId: string
  branchCode: string
  branchName: string
  roles: AuthRole[]
}): AuthSession {
  const primaryRole = roles[0]

  return {
    accessToken,
    refreshToken,
    user: {
      id,
      email,
      fullName,
      roleName: roleDefinitionMap[primaryRole].label,
      companyId,
      companyName,
      companyTypeId,
      companyTypeCode,
      enabledModules,
      branchId,
      branchCode,
      branchName,
      roles,
      permissions: getDefaultPermissionsForRoles(roles),
    },
  }
}

const DEMO_ACCOUNTS = [
  {
    email: 'admin.pos@rayego.pe',
    password: 'RayegoPOS2026!',
    session: createSession({
      accessToken: 'mock-access-token-admin-pos',
      refreshToken: 'mock-refresh-token-admin-pos',
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin.pos@rayego.pe',
      fullName: 'Administrador de Plataforma',
      companyId: '',
      companyName: '',
      companyTypeId: '',
      companyTypeCode: '',
      enabledModules: [
        'dashboard',
        'tipos_empresa',
        'empresas',
        'usuarios',
        'administradores',
        'sesiones',
        'auditoria',
        'reportes',
        'configuracion',
      ],
      branchId: '',
      branchCode: '',
      branchName: '',
      roles: ['ADMIN_POS'],
    }),
  },
  {
    email: 'admin@rayego.pe',
    password: 'RayegoPOS2026!',
    session: createSession({
      accessToken: 'mock-access-token-admin',
      refreshToken: 'mock-refresh-token-admin',
      id: '3a88f790-2aa0-4390-b2c8-7b0e5a1ad100',
      email: 'admin@rayego.pe',
      fullName: 'Administrador General',
      companyId: '2f59f401-45a0-4a25-a7b6-9d5d5b9eaaaa',
      companyName: 'Rayego Botica SAC',
      branchId: '4c2b9bc1-2d4b-4cf1-9b53-7e0bded73c8c',
      branchCode: 'PICH',
      branchName: 'Sucursal Principal',
      roles: ['ADMIN'],
    }),
  },
  {
    email: 'supervisor@rayego.pe',
    password: 'RayegoSupervisor2026!',
    session: createSession({
      accessToken: 'mock-access-token-supervisor',
      refreshToken: 'mock-refresh-token-supervisor',
      id: 'b74c2f16-74c0-49f9-856d-7eabf65ce350',
      email: 'supervisor@rayego.pe',
      fullName: 'Supervisor de Operaciones',
      companyId: '2f59f401-45a0-4a25-a7b6-9d5d5b9eaaaa',
      companyName: 'Rayego Botica SAC',
      branchId: '4c2b9bc1-2d4b-4cf1-9b53-7e0bded73c8c',
      branchCode: 'PICH',
      branchName: 'Sucursal Principal',
      roles: ['SUPERVISOR'],
    }),
  },
  {
    email: 'caja@rayego.pe',
    password: 'RayegoCaja2026!',
    session: createSession({
      accessToken: 'mock-access-token-cashier',
      refreshToken: 'mock-refresh-token-cashier',
      id: '798d1e2a-4e11-45dd-9271-080fe14bc401',
      email: 'caja@rayego.pe',
      fullName: 'Operador de Caja',
      companyId: '2f59f401-45a0-4a25-a7b6-9d5d5b9eaaaa',
      companyName: 'Rayego Botica SAC',
      branchId: '4c2b9bc1-2d4b-4cf1-9b53-7e0bded73c8c',
      branchCode: 'PICH',
      branchName: 'Sucursal Principal',
      roles: ['CAJERO'],
    }),
  },
] as const

function wait(ms = 450) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export function isDemoAccountCredentials(email: string, password?: string): boolean {
  const normalizedEmail = email.trim().toLowerCase()
  return DEMO_ACCOUNTS.some((entry) => {
    if (entry.email !== normalizedEmail) return false
    if (typeof password === 'undefined') return true
    return entry.password === password
  })
}

export const authMockService = {
  async login(payload: LoginPayload): Promise<AuthSession> {
    await wait()

    const email = payload.email.trim().toLowerCase()
    const account = DEMO_ACCOUNTS.find(
      (entry) => entry.email === email && entry.password === payload.password,
    )

    if (!account) {
      throw new Error('Credenciales inválidas. Verifica tu correo y contraseña.')
    }

    return account.session
  },

  async logout(): Promise<void> {
    await wait(150)
  },

  async requestPasswordReset(
    payload: ForgotPasswordPayload,
  ): Promise<ForgotPasswordResult> {
    await wait()

    const email = payload.email.trim().toLowerCase()

    return {
      email,
      resetToken: 'rayego-demo-reset-token',
      expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
    }
  },

  async resetPassword(payload: ResetPasswordPayload): Promise<void> {
    await wait()

    if (payload.token.trim() === '') {
      throw new Error('El enlace de recuperación no es válido.')
    }
  },

  async restoreSession(session: AuthSession): Promise<AuthSession | null> {
    await wait(150)

    return DEMO_ACCOUNTS.some((account) => account.session.user.id === session.user.id)
      ? session
      : null
  },

  getDemoCredentials() {
    return DEMO_ACCOUNTS[1]
  },

  getDemoAccounts() {
    return DEMO_ACCOUNTS
  },

  isMockSession(session: AuthSession) {
    return session.accessToken.startsWith('mock-access-token-')
  },
}
