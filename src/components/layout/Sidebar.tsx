import { NavLink } from 'react-router-dom'
import { AppLogo } from '@/components/brand/AppLogo'
import { navItems } from '@/config/navigation'
import { useAuthorization } from '@/hooks/useAuthorization'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'

type SidebarProps = {
  isMobileOpen?: boolean
  onMobileOpenChange?: (open: boolean) => void
}

function SidebarNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const { canAccess } = useAuthorization()
  const visibleNavItems = navItems.filter((item) => canAccess(item.access))

  return (
    <>
      <div className="px-5 py-5">
        <AppLogo variant="sidebar" />
      </div>

      <nav className="flex-1 overflow-auto px-3 pb-5">
        <div className="space-y-1">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150',
                  isActive ? 'bg-primary-foreground/10 text-primary-foreground' : 'text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground',
                )
              }
              end={item.href === '/'}
              onClick={onNavigate}
            >
              <item.icon className="h-4 w-4" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="border-t border-primary-foreground/10 px-5 py-4">
        <div className="text-xs text-primary-foreground/70">Modo oscuro (próximamente)</div>
      </div>
    </>
  )
}

export function Sidebar({
  isMobileOpen = false,
  onMobileOpenChange,
}: SidebarProps) {
  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-[280px] shrink-0 border-r bg-primary text-primary-foreground lg:block">
        <div className="flex h-full flex-col">
          <SidebarNavigation />
        </div>
      </aside>

      <Dialog open={isMobileOpen} onOpenChange={onMobileOpenChange}>
        <DialogContent className="left-0 top-0 h-dvh w-[280px] max-w-[85vw] translate-x-0 translate-y-0 gap-0 rounded-none border-0 border-r bg-primary p-0 text-primary-foreground shadow-soft lg:hidden">
          <div className="flex h-full flex-col">
            <SidebarNavigation onNavigate={() => onMobileOpenChange?.(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
