import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { navItems } from '@/config/navigation'
import { paths } from '@/routes/paths'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

type Crumb = {
  label: string
  href: string
  isCurrent: boolean
}

export function Breadcrumbs() {
  const location = useLocation()

  const crumbs = useMemo<Crumb[]>(() => {
    const pathname = location.pathname
    const normalized = pathname === '' ? '/' : pathname

    if (normalized === paths.login) {
      return [{ label: 'Login', href: paths.login, isCurrent: true }]
    }

    const lookup = new Map(navItems.map((i) => [i.href, i.label]))
    const currentLabel = lookup.get(normalized) ?? 'Sección'

    const rootLabel = lookup.get(paths.dashboard) ?? 'Dashboard'
    if (normalized === paths.dashboard) {
      return [{ label: rootLabel, href: paths.dashboard, isCurrent: true }]
    }

    return [
      { label: rootLabel, href: paths.dashboard, isCurrent: false },
      { label: currentLabel, href: normalized, isCurrent: true },
    ]
  }, [location.pathname])

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((c, idx) => (
          <BreadcrumbItem key={c.href}>
            {c.isCurrent ? <BreadcrumbPage>{c.label}</BreadcrumbPage> : <BreadcrumbLink to={c.href}>{c.label}</BreadcrumbLink>}
            {idx < crumbs.length - 1 ? <BreadcrumbSeparator /> : null}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

