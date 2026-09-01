import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Building2,
  Boxes,
  ClipboardCheck,
  CreditCard,
  LayoutDashboard,
  Layers,
  Settings,
  Shield,
  ShoppingCart,
  Store,
  Truck,
  Users,
  Wrench,
  Package,
} from 'lucide-react'
import { CajaPage } from '@/pages/CajaPage'
import { ClientesPage } from '@/pages/ClientesPage'
import { ComprasPage } from '@/pages/ComprasPage'
import { ConfiguracionPage } from '@/pages/ConfiguracionPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { EmpresasPage } from '@/pages/EmpresasPage'
import { AdministradoresPage } from '@/pages/AdministradoresPage'
import { ForbiddenPage } from '@/pages/ForbiddenPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { InventarioPage } from '@/pages/InventarioPage'
import { LoginPage } from '@/pages/LoginPage'
import { ProductosPage } from '@/pages/ProductosPage'
import { ProveedoresPage } from '@/pages/ProveedoresPage'
import { ReportesPage } from '@/pages/ReportesPage'
import { UsuariosPage } from '@/pages/UsuariosPage'
import { VentasPage } from '@/pages/VentasPage'
import { TiposEmpresaPage } from '@/pages/TiposEmpresaPage'
import { OrdenesServicioPage } from '@/pages/OrdenesServicioPage'
import { TecnicosPage } from '@/pages/TecnicosPage'
import { RegisterPage } from '@/public/register/RegisterPage'
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
  navSection?: 'Operaciones' | 'Seguridad' | 'Reportes' | 'Administración POS' | 'Configuración'
}

export const authRoutes: AppRouteDefinition[] = [
  {
    path: paths.register,
    component: RegisterPage,
    access: { publicOnly: true },
  },
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
  // ==================== 8 MÓDULOS PRINCIPALES (SIDEBAR MENU) ====================
  {
    path: paths.dashboard,
    component: DashboardPage,
    index: true,
    navLabel: 'Inicio',
    navIcon: LayoutDashboard,
    navSection: 'Operaciones',
    access: {
      requiresAuth: true,
      allowedPermissions: ['dashboard.read'],
      moduleCode: 'dashboard',
    },
  },
  {
    path: paths.ordenesServicio,
    component: OrdenesServicioPage,
    navLabel: 'Órdenes Servicio',
    navIcon: ClipboardCheck,
    navSection: 'Operaciones',
    access: {
      requiresAuth: true,
      allowedPermissions: ['ordenesServicio.read'],
      moduleCode: 'ordenesServicio',
    },
  },
  {
    path: paths.clientes,
    component: ClientesPage,
    navLabel: 'Clientes',
    navIcon: Users,
    navSection: 'Operaciones',
    access: {
      requiresAuth: true,
      allowedPermissions: ['clientes.read'],
      moduleCode: 'clientes',
    },
  },
  {
    path: paths.inventario,
    component: InventarioPage,
    navLabel: 'Inventario',
    navIcon: Boxes,
    navSection: 'Operaciones',
    access: {
      requiresAuth: true,
      allowedPermissions: ['inventario.read'],
      moduleCode: 'inventario',
    },
  },
  {
    path: paths.tecnicos,
    component: TecnicosPage,
    navLabel: 'Técnicos',
    navIcon: Wrench,
    navSection: 'Operaciones',
    access: {
      requiresAuth: true,
      allowedPermissions: ['tecnicos.read'],
      moduleCode: 'tecnicos',
    },
  },
  {
    path: paths.caja,
    component: CajaPage,
    navLabel: 'Caja',
    navIcon: CreditCard,
    navSection: 'Operaciones',
    access: {
      requiresAuth: true,
      allowedPermissions: ['caja.read'],
      moduleCode: 'caja',
    },
  },
  {
    path: paths.reportes,
    component: ReportesPage,
    navLabel: 'Reportes',
    navIcon: BarChart3,
    navSection: 'Reportes',
    access: {
      requiresAuth: true,
      allowedPermissions: ['reportes.read'],
      allowedRoles: ['ADMIN_POS', 'ADMIN', 'ADMIN_EMPRESA', 'SUPERVISOR'],
      moduleCode: 'reportes',
    },
  },
  {
    path: paths.configuracion,
    component: ConfiguracionPage,
    navLabel: 'Configuración',
    navIcon: Settings,
    navSection: 'Configuración',
    access: {
      requiresAuth: true,
      allowedPermissions: ['configuracion.read'],
      allowedRoles: ['ADMIN_POS', 'ADMIN', 'ADMIN_EMPRESA'],
      moduleCode: 'configuracion',
    },
  },

  // ==================== RUTAS OCULTAS (SIN MENU, ACCESO POR URL) ====================
  // Módulos POS antiguos — siguen disponibles por URL pero fuera del menú 8 máx
  {
    path: paths.ventas,
    component: VentasPage,
    access: {
      requiresAuth: true,
      allowedPermissions: ['ventas.read'],
      moduleCode: 'ventas',
    },
  },
  {
    path: paths.productos,
    component: ProductosPage,
    access: {
      requiresAuth: true,
      allowedPermissions: ['productos.read'],
      moduleCode: 'productos',
    },
  },
  {
    path: paths.compras,
    component: ComprasPage,
    access: {
      requiresAuth: true,
      allowedPermissions: ['compras.read'],
      moduleCode: 'compras',
    },
  },
  {
    path: paths.proveedores,
    component: ProveedoresPage,
    access: {
      requiresAuth: true,
      allowedPermissions: ['proveedores.read'],
      moduleCode: 'proveedores',
    },
  },
  {
    path: paths.usuarios,
    component: UsuariosPage,
    access: {
      requiresAuth: true,
      allowedPermissions: ['usuarios.read', 'sesiones.read', 'auditoria.read'],
      allowedRoles: ['ADMIN_POS', 'ADMIN', 'ADMIN_EMPRESA', 'SUPERVISOR'],
      moduleCode: 'usuarios',
    },
  },
  {
    path: paths.empresas,
    component: EmpresasPage,
    access: {
      requiresAuth: true,
      allowedPermissions: ['empresas.read', 'empresas.manage'],
      allowedRoles: ['ADMIN_POS'],
      moduleCode: 'empresas',
    },
  },
  {
    path: paths.administradores,
    component: AdministradoresPage,
    access: {
      requiresAuth: true,
      allowedPermissions: ['administradores.manage', 'usuarios.read'],
      allowedRoles: ['ADMIN_POS'],
      moduleCode: 'administradores',
    },
  },
  {
    path: paths.tiposEmpresa,
    component: TiposEmpresaPage,
    access: {
      requiresAuth: true,
      allowedPermissions: ['tipos_empresa.manage'],
      allowedRoles: ['ADMIN_POS'],
      moduleCode: 'tipos_empresa',
    },
  },
  {
    path: paths.forbidden,
    component: ForbiddenPage,
    access: { requiresAuth: true },
  },
]

export const navRoutes = privateRoutes.filter((route) => route.navLabel && route.navIcon)
