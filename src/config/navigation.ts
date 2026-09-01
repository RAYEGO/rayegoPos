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

const BOTICA_PRIORITY: readonly string[] = [
  'dashboard',
  'ventas',
  'productos',
  'compras',
  'inventario',
  'clientes',
  'proveedores',
  'caja',
  'usuarios',
  'reportes',
  'configuracion',
]

const RAYEGOTECH_PRIORITY: readonly string[] = [
  'dashboard',
  'ordenesServicio',
  'clientes',
  'inventario',
  'caja',
  'reportes',
  'configuracion',
  'usuarios',
  'tecnicos',
]

const PLATAFORMA_PRIORITY: readonly string[] = [
  'dashboard',
  'empresas',
  'administradores',
  'tipos_empresa',
  'usuarios',
  'reportes',
  'configuracion',
]

export type NavItem = {
  label: string
  href: string
  icon: NonNullable<(typeof privateRoutes)[number]['navIcon']>
  access: (typeof privateRoutes)[number]['access']
  section?: NonNullable<(typeof privateRoutes)[number]['navSection']>
  moduleCode?: string
}

type CompanyContext = 'BOTICA' | 'RAYEGOTECH' | 'PLATAFORMA'

function detectCompanyContext(session: AuthSession | null): CompanyContext {
  if (!session) return 'BOTICA'
  const code = session.user.companyTypeCode?.toUpperCase() ?? ''
  if (code === '' || code === 'PLATAFORMA') return 'PLATAFORMA'
  if (code === 'RAYEGOTECH' || code === 'SERVICIO_TECNICO') return 'RAYEGOTECH'
  return 'BOTICA'
}

function getModulosPermitidosPorContexto(session: AuthSession | null): Set<string> {
  if (!session) return new Set()
  const ctx = detectCompanyContext(session)
  const modules = new Set<string>(MODULOS_COMPARTIDOS)
  if (ctx === 'PLATAFORMA') {
    MODULOS_EXCLUSIVOS_PLATAFORMA.forEach((m) => modules.add(m))
  } else if (ctx === 'BOTICA') {
    MODULOS_EXCLUSIVOS_BOTICA.forEach((m) => modules.add(m))
  } else {
    MODULOS_EXCLUSIVOS_RAYEGOTECH.forEach((m) => modules.add(m))
  }
  return modules
}

function getPriorityForContext(ctx: CompanyContext): readonly string[] {
  if (ctx === 'PLATAFORMA') return PLATAFORMA_PRIORITY
  if (ctx === 'RAYEGOTECH') return RAYEGOTECH_PRIORITY
  return BOTICA_PRIORITY
}

function resolveLabel(
  ctx: CompanyContext,
  moduleCode: string | undefined,
  baseLabel: string,
): string {
  if (ctx === 'RAYEGOTECH') {
    if (moduleCode === 'inventario') return 'Inventario técnico'
    if (moduleCode === 'ordenesServicio') return baseLabel
  }
  return baseLabel
}

function sortNavItemsByPriority(
  items: NavItem[],
  priority: readonly string[],
): NavItem[] {
  return [...items].sort((a, b) => {
    const ia = a.moduleCode ? priority.indexOf(a.moduleCode) : -1
    const ib = b.moduleCode ? priority.indexOf(b.moduleCode) : -1
    if (ia === -1 && ib === -1) return 0
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}

export function buildNavItems(session: AuthSession | null): NavItem[] {
  if (!session) return []

  const ctx = detectCompanyContext(session)
  const modulosPermitidos = getModulosPermitidosPorContexto(session)
  const priority = getPriorityForContext(ctx)

  const raw = privateRoutes
    .filter((route) => route.navLabel && route.navIcon)
    .filter((route) => {
      const mc = route.access?.moduleCode
      if (!mc) return true
      return modulosPermitidos.has(mc)
    })
    .filter((route) => evaluateRouteAccess(session, route.access).allowed)
    .map((route) => {
      const mc = route.access?.moduleCode
      return {
        label: resolveLabel(ctx, mc, route.navLabel!),
        href: route.path,
        icon: route.navIcon!,
        access: route.access,
        section: route.navSection,
        moduleCode: mc,
      } satisfies NavItem
    })

  return sortNavItemsByPriority(raw, priority)
}
