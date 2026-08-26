export type AuthRole = 'ADMIN_POS' | 'ADMIN' | 'SUPERVISOR' | 'CAJERO' | 'ALMACEN'

export type UserStatus = 'ACTIVO' | 'BLOQUEADO' | 'INVITADO'

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
  | 'tipos_empresa.manage'
  | 'empresas.read'
  | 'empresas.manage'
  | 'administradores.manage'

export type AuthUser = {
  id: string
  email: string
  fullName: string
  roleName: string
  companyId: string
  companyName: string
  companyTypeId: string | null
  companyTypeCode: string | null
  enabledModules: string[]
  branchId: string
  branchCode: string
  branchName: string
  roles: AuthRole[]
  permissions: AuthPermission[]
}

export type AuthSession = {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

export type AuthBranch = {
  id: string
  code: string
  name: string
  companyId: string
  companyName: string
}

export type AuthBranchSelectionResponse = {
  requiresBranchSelection: true
  branches: AuthBranch[]
}

export type LoginPayload = {
  email: string
  password: string
  remember: boolean
  branchId?: string
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
