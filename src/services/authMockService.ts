import { getDefaultPermissionsForRoles, roleDefinitionMap } from '@/config/authorization'
import type {
  AuthRole,
  AuthSession,
  ForgotPasswordPayload,
  ForgotPasswordResult,
  LoginPayload,
  ResetPasswordPayload,
} from '@/types/auth'

function createSession({
  accessToken,
  refreshToken,
  id,
  email,
  fullName,
  branchName,
  roles,
}: {
  accessToken: string
  refreshToken: string
  id: string
  email: string
  fullName: string
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
      branchName,
      roles,
      permissions: getDefaultPermissionsForRoles(roles),
    },
  }
}

const DEMO_ACCOUNTS = [
  {
    email: 'admin@rayego.pe',
    password: 'RayegoPOS2026!',
    session: createSession({
      accessToken: 'mock-access-token-admin',
      refreshToken: 'mock-refresh-token-admin',
      id: '3a88f790-2aa0-4390-b2c8-7b0e5a1ad100',
      email: 'admin@rayego.pe',
      fullName: 'Administrador General',
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
    return DEMO_ACCOUNTS[0]
  },

  getDemoAccounts() {
    return DEMO_ACCOUNTS
  },

  isMockSession(session: AuthSession) {
    return session.accessToken.startsWith('mock-access-token-')
  },
}
