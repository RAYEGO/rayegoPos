import { navRoutes } from '@/routes/routeDefinitions'

export type NavItem = {
  label: string
  href: string
  icon: NonNullable<(typeof navRoutes)[number]['navIcon']>
  access: (typeof navRoutes)[number]['access']
}

export const navItems: NavItem[] = navRoutes.map((route) => ({
  label: route.navLabel!,
  href: route.path,
  icon: route.navIcon!,
  access: route.access,
}))
