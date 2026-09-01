import { NavLink, useNavigate } from 'react-router-dom'
import { AppLogo } from '@/components/brand/AppLogo'
import { buildNavItems, splitNavItemsByTactical } from '@/config/navigation'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-react'

type SidebarProps = {
  isMobileOpen?: boolean
  onMobileOpenChange?: (open: boolean) => void
}

function SidebarNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const visibleNavItems = buildNavItems(session)
  const { mainItems, moreItems } = splitNavItemsByTactical(visibleNavItems, session)

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 rounded-md px-3 py-3 text-sm transition-colors duration-150 min-h-[44px] w-full text-left',
      isActive
        ? 'bg-primary-foreground/10 text-primary-foreground'
        : 'text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground',
    )

  return (
    <>
      <div className="px-5 py-5">
        <AppLogo variant="sidebar" />
      </div>

      <nav className="flex-1 overflow-auto px-3 pb-5">
        <div className="space-y-1">
          {mainItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={navLinkClass}
              end={item.href === '/'}
              onClick={onNavigate}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}

          {moreItems.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-3 text-sm transition-colors duration-150 min-h-[44px] w-full text-left',
                    'text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground',
                  )}
                >
                  <MoreHorizontal className="h-4 w-4 shrink-0" />
                  <span className="truncate">Más</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="bottom"
                align="start"
                sideOffset={4}
                className={cn(
                  'min-w-[220px] max-w-[260px]',
                  'bg-primary border-primary-foreground/10',
                  'text-primary-foreground shadow-soft',
                )}
              >
                <DropdownMenuGroup>
                  {moreItems.map((item) => (
                    <DropdownMenuItem
                      key={item.href}
                      onClick={() => {
                        navigate(item.href)
                        onNavigate?.()
                      }}
                      className="gap-3 min-h-[44px] px-3 py-2 text-primary-foreground/90 hover:bg-primary-foreground/10 hover:text-primary-foreground focus:bg-primary-foreground/10 focus:text-primary-foreground"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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
