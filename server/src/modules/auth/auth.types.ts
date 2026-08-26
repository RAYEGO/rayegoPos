export type AuthRole = 'ADMIN' | 'ADMIN_POS' | 'SUPERVISOR' | 'CAJERO' | 'ALMACEN'

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

export type AuthBranch = {
  id: string
  code: string
  name: string
  companyId: string
  companyName: string
}

export type AuthSession = {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    email: string
    fullName: string
    roleName: string
    companyId: string
    companyName: string
    branchId: string | null
    branchCode: string | null
    branchName: string | null
    companyTypeId: string | null
    companyTypeCode: string | null
    enabledModules: string[]
    roles: AuthRole[]
    permissions: AuthPermission[]
  }
}

export type AuthBranchSelectionResponse = {
  requiresBranchSelection: true
  branches: AuthBranch[]
}

export type AuthLoginResponse = AuthSession | AuthBranchSelectionResponse
