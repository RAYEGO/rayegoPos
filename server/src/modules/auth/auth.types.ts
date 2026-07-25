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

export type AuthBranch = {
  id: string
  code: string
  name: string
}

export type AuthSession = {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    email: string
    fullName: string
    roleName: string
    branchId: string
    branchCode: string
    branchName: string
    roles: AuthRole[]
    permissions: AuthPermission[]
  }
}

export type AuthBranchSelectionResponse = {
  requiresBranchSelection: true
  branches: AuthBranch[]
}

export type AuthLoginResponse = AuthSession | AuthBranchSelectionResponse
