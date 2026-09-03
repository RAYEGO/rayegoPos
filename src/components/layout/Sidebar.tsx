import { NavLink, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppLogo } from '@/components/brand/AppLogo'
import { buildNavItems } from '@/config/navigation'
import type { NavItem } from '@/config/navigation'
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

function computeSplit(
  items: NavItem[],
  availableHeight: number,
  itemHeight: number,
  gapHeight: number,
): { mainItems: NavItem[]; moreItems: NavItem[] } {
  if (availableHeight <= 0 || itemHeight <= 0) {
    return { mainItems: items, moreItems: [] }
  }

  const total = items.length
  if (total === 0) {
    return { mainItems: [], moreItems: [] }
  }

  const heightForCount = (count: number) =>
    count <= 0 ? 0 : count * itemHeight + Math.max(0, count - 1) * gapHeight

  if (heightForCount(total) <= availableHeight) {
    return { mainItems: items, moreItems: [] }
  }

  const moreEntryHeight = itemHeight + gapHeight
  let fitWithoutMore = 0
  for (let k = total; k >= 0; k--) {
    if (heightForCount(k) <= availableHeight) {
      fitWithoutMore = k
      break
    }
  }

  let fitWithMore = 0
  const availableAfterMore = availableHeight - moreEntryHeight
  for (let k = total - 1; k >= 0; k--) {
    if (heightForCount(k) <= availableAfterMore) {
      fitWithMore = k
      break
    }
  }

  const useCount = Math.min(total, Math.max(fitWithoutMore, fitWithMore))
  if (useCount >= total) {
    return { mainItems: items, moreItems: [] }
  }

  const mainCount = Math.max(0, Math.min(useCount, fitWithMore))
  return {
    mainItems: items.slice(0, mainCount),
    moreItems: items.slice(mainCount),
  }
}

function SidebarNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const visibleNavItems = useMemo(() => buildNavItems(session), [session])

  const navContainerRef = useRef<HTMLDivElement | null>(null)
  const measureRowRef = useRef<HTMLDivElement | null>(null)
  const [availableHeight, setAvailableHeight] = useState(0)
  const [itemHeight, setItemHeight] = useState(44)
  const [gapHeight, setGapHeight] = useState(4)

  const recalc = useCallback(() => {
    if (navContainerRef.current) {
      const h = navContainerRef.current.clientHeight
      if (h > 0) setAvailableHeight(h)
    }
    if (measureRowRef.current) {
      const style = window.getComputedStyle(measureRowRef.current)
      const parent = measureRowRef.current.parentElement
      let rowH = measureRowRef.current.getBoundingClientRect().height
      if (!(rowH > 0)) {
        rowH = 44
      }
      setItemHeight(rowH)

      let gap = 4
      if (parent) {
        const parentStyle = window.getComputedStyle(parent)
        const rawGap = parentStyle.rowGap ?? parentStyle.gap ?? '0px'
        const parsed = Number.parseFloat(rawGap)
        if (Number.isFinite(parsed) && parsed >= 0) {
          gap = parsed
        }
      }
      const marginTop = Number.parseFloat(style.marginTop)
      const marginBottom = Number.parseFloat(style.marginBottom)
      if (Number.isFinite(marginTop) && marginTop > 0) gap = Math.max(gap, marginTop)
      if (Number.isFinite(marginBottom) && marginBottom > 0) gap = Math.max(gap, marginBottom)
      setGapHeight(gap)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    let rafId = 0
    const schedule = () => {
      if (rafId) return
      rafId = window.requestAnimationFrame(() => {
        rafId = 0
        recalc()
      })
    }

    schedule()
    const secondPass = window.setTimeout(schedule, 50)

    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)

    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && navContainerRef.current) {
      ro = new ResizeObserver(schedule)
      ro.observe(navContainerRef.current)
    }

    let measureRo: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && measureRowRef.current) {
      measureRo = new ResizeObserver(schedule)
      measureRo.observe(measureRowRef.current)
    }

    return () => {
      window.clearTimeout(secondPass)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      if (rafId) window.cancelAnimationFrame(rafId)
      ro?.disconnect()
      measureRo?.disconnect()
    }
  }, [recalc])

  const { mainItems, moreItems } = useMemo(
    () => computeSplit(visibleNavItems, availableHeight, itemHeight, gapHeight),
    [visibleNavItems, availableHeight, itemHeight, gapHeight],
  )

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 rounded-md px-3 py-3 text-sm transition-colors duration-150 min-h-[44px] w-full text-left',
      isActive
        ? 'bg-primary-foreground/10 text-primary-foreground'
        : 'text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground',
    )

  return (
    <>
      <div className="px-5 py-5 shrink-0">
        <AppLogo variant="sidebar" />
      </div>

      <nav ref={navContainerRef} className="flex-1 overflow-hidden px-3 pb-5">
        <div className="h-full overflow-auto">
          <div className="space-y-1 relative">
            {visibleNavItems.length > 0 && (
              <div
                ref={measureRowRef}
                aria-hidden="true"
                className="absolute left-0 top-0 w-full pointer-events-none invisible"
              >
                <div className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-3 text-sm min-h-[44px] w-full text-left',
                  'text-primary-foreground/80',
                )}>
                  <MoreHorizontal className="h-4 w-4 shrink-0" />
                  <span className="truncate">&nbsp;</span>
                </div>
              </div>
            )}

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
        </div>
      </nav>

      <div className="border-t border-primary-foreground/10 px-5 py-4 shrink-0">
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
