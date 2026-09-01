import type { AuthSession } from '@/types/auth'
import { evaluateRouteAccess } from '@/routes/access-control'
import { privateRoutes } from '@/routes/routeDefinitions'

const MODULOS_COMPARTIDOS: readonly string[] = [
  'dashboard',
  'clientes',
  'inventario',
  'caja',
  'usuarios',
  'reportes',
  'configuracion',
  'sesiones',
  'auditoria',
  'lotes',
  'kardex',
]

const MODULOS_EXCLUSIVOS_BOTICA: readonly string[] = [
  'ventas',
  'productos',
  'compras',
  'proveedores',
]

const MODULOS_EXCLUSIVOS_RAYEGOTECH: readonly string[] = [
  'ordenesServicio',
  'tecnicos',
]

const MODULOS_EXCLUSIVOS_PLATAFORMA: readonly string[] = [
  'empresas',
  'administradores',
  'tipos_empresa',
]

export type NavItem = {
  label: string
  href: string
  icon: NonNullable<(typeof privateRoutes)[number]['navIcon']>
  access: (typeof privateRoutes)[number]['access']
  section?: NonNullable<(typeof privateRoutes)[number]['navSection']>
  moduleCode?: string
}

function getModulosPermitidosPorContexto(session: AuthSession | null): Set<string> {
  if (!session) {
    return new Set()
  }

  const companyTypeCode = session.user.companyTypeCode?.toUpperCase() ?? ''

  const modules = new Set<string>(MODULOS_COMPARTIDOS)

  if (companyTypeCode === '' || companyTypeCode === 'PLATAFORMA') {
    MODULOS_EXCLUSIVOS_PLATAFORMA.forEach((m) => modules.add(m))
  } else if (companyTypeCode === 'BOTICA' || companyTypeCode === 'FARMACIA') {
    MODULOS_EXCLUSIVOS_BOTICA.forEach((m) => modules.add(m))
  } else if (companyTypeCode === 'RAYEGOTECH' || companyTypeCode === 'SERVICIO_TECNICO') {
    MODULOS_EXCLUSIVOS_RAYEGOTECH.forEach((m) => modules.add(m))
  } else {
    MODULOS_EXCLUSIVOS_BOTICA.forEach((m) => modules.add(m))
  }

  return modules
}

export function buildNavItems(session: AuthSession | null): NavItem[] {
  if (!session) {
    return []
  }

  const modulosPermitidos = getModulosPermitidosPorContexto(session)

  return privateRoutes
    .filter((route) => route.navLabel && route.navIcon)
    .filter((route) => {
      if (route.access?.moduleCode) {
        if (!modulosPermitidos.has(route.access.moduleCode)) {
          return false
        }
      }
      return true
    })
    .filter((route) => evaluateRouteAccess(session, route.access).allowed)
    .map((route) => ({
      label: route.navLabel!,
      href: route.path,
      icon: route.navIcon!,
      access: route.access,
      section: route.navSection,
      moduleCode: route.access?.moduleCode,
    }))
}
