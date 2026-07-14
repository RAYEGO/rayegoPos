export type AuthRole = 'ADMIN' | 'SUPERVISOR' | 'CAJERO'

export type AuthPermission =
  | '*'
  | 'dashboard.read'
  | 'ventas.read'
  | 'productos.read'
  | 'compras.read'
  | 'inventario.read'
  | 'clientes.read'
  | 'proveedores.read'
  | 'caja.read'
  | 'usuarios.read'
  | 'usuarios.manage'
  | 'sesiones.read'
  | 'sesiones.revoke'
  | 'auditoria.read'
  | 'reportes.read'
  | 'configuracion.read'

export type AuthUser = {
  id: string
  email: string
  fullName: string
  roleName: string
  branchName: string
  roles: AuthRole[]
  permissions: AuthPermission[]
}

export type AuthSession = {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

export type LoginPayload = {
  email: string
  password: string
  remember: boolean
}

export type ForgotPasswordPayload = {
  email: string
}

export type ForgotPasswordResult = {
  email: string
  resetToken: string
  expiresAt: string
}

export type ResetPasswordPayload = {
  token: string
  password: string
}
