export type AuthRole =
  | 'ADMIN'
  | 'ADMIN_EMPRESA'
  | 'ADMIN_POS'
  | 'SUPERVISOR'
  | 'CAJERO'
  | 'ALMACEN'

export type AuthPermission =
  | '*'
  | 'dashboard.read'
  | 'ventas.read'
  | 'ventas.manage'
  | 'productos.read'
  | 'productos.manage'
  | 'compras.read'
  | 'compras.manage'
  | 'inventario.read'
  | 'inventario.manage'
  | 'clientes.read'
  | 'clientes.manage'
  | 'proveedores.read'
  | 'proveedores.manage'
  | 'caja.read'
  | 'caja.manage'
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
