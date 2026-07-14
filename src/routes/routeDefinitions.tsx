import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Boxes,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Store,
  Truck,
  Users,
} from 'lucide-react'
import { CajaPage } from '@/pages/CajaPage'
import { ClientesPage } from '@/pages/ClientesPage'
import { ComprasPage } from '@/pages/ComprasPage'
import { ConfiguracionPage } from '@/pages/ConfiguracionPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ForbiddenPage } from '@/pages/ForbiddenPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { InventarioPage } from '@/pages/InventarioPage'
import { LoginPage } from '@/pages/LoginPage'
import { ProductosPage } from '@/pages/ProductosPage'
import { ProveedoresPage } from '@/pages/ProveedoresPage'
import { ReportesPage } from '@/pages/ReportesPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { UsuariosPage } from '@/pages/UsuariosPage'
import { VentasPage } from '@/pages/VentasPage'
import { paths } from '@/routes/paths'
import type { RouteAccess } from '@/routes/access-control'

type RouteComponent = ComponentType

export type AppRouteDefinition = {
  path: string
  component: RouteComponent
  access: RouteAccess
  index?: boolean
  navLabel?: string
  navIcon?: LucideIcon
}

export const authRoutes: AppRouteDefinition[] = [
  {
    path: paths.login,
    component: LoginPage,
    access: { publicOnly: true },
  },
  {
    path: paths.forgotPassword,
    component: ForgotPasswordPage,
    access: { publicOnly: true },
  },
  {
    path: paths.resetPassword,
    component: ResetPasswordPage,
    access: { publicOnly: true },
  },
]

export const privateRoutes: AppRouteDefinition[] = [
  {
    path: paths.dashboard,
    component: DashboardPage,
    index: true,
    navLabel: 'Dashboard',
    navIcon: LayoutDashboard,
    access: { requiresAuth: true, allowedPermissions: ['dashboard.read'] },
  },
  {
    path: paths.ventas,
    component: VentasPage,
    navLabel: 'Ventas',
    navIcon: ShoppingCart,
    access: { requiresAuth: true, allowedPermissions: ['ventas.read'] },
  },
  {
    path: paths.productos,
    component: ProductosPage,
    navLabel: 'Productos',
    navIcon: Package,
    access: { requiresAuth: true, allowedPermissions: ['productos.read'] },
  },
  {
    path: paths.compras,
    component: ComprasPage,
    navLabel: 'Compras',
    navIcon: Truck,
    access: { requiresAuth: true, allowedPermissions: ['compras.read'] },
  },
  {
    path: paths.inventario,
    component: InventarioPage,
    navLabel: 'Inventario',
    navIcon: Boxes,
    access: { requiresAuth: true, allowedPermissions: ['inventario.read'] },
  },
  {
    path: paths.clientes,
    component: ClientesPage,
    navLabel: 'Clientes',
    navIcon: Users,
    access: { requiresAuth: true, allowedPermissions: ['clientes.read'] },
  },
  {
    path: paths.proveedores,
    component: ProveedoresPage,
    navLabel: 'Proveedores',
    navIcon: Store,
    access: { requiresAuth: true, allowedPermissions: ['proveedores.read'] },
  },
  {
    path: paths.caja,
    component: CajaPage,
    navLabel: 'Caja',
    navIcon: CreditCard,
    access: { requiresAuth: true, allowedPermissions: ['caja.read'] },
  },
  {
    path: paths.usuarios,
    component: UsuariosPage,
    navLabel: 'Usuarios',
    navIcon: ClipboardList,
    access: {
      requiresAuth: true,
      allowedPermissions: ['usuarios.read', 'sesiones.read', 'auditoria.read'],
      allowedRoles: ['ADMIN', 'SUPERVISOR'],
    },
  },
  {
    path: paths.reportes,
    component: ReportesPage,
    navLabel: 'Reportes',
    navIcon: BarChart3,
    access: { requiresAuth: true, allowedPermissions: ['reportes.read'] },
  },
  {
    path: paths.configuracion,
    component: ConfiguracionPage,
    navLabel: 'Configuración',
    navIcon: Settings,
    access: {
      requiresAuth: true,
      allowedPermissions: ['configuracion.read'],
      allowedRoles: ['ADMIN'],
    },
  },
  {
    path: paths.forbidden,
    component: ForbiddenPage,
    access: { requiresAuth: true },
  },
]

export const navRoutes = privateRoutes.filter((route) => route.navLabel && route.navIcon)
