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

export type AuthSession = {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    email: string
    fullName: string
    roleName: string
    branchName: string
    roles: AuthRole[]
    permissions: AuthPermission[]
  }
}
