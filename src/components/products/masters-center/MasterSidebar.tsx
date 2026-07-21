import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { getCatalogConfig, masterCatalogs, masterGroups } from './catalogs'
import type { MasterCatalogKey } from './catalogs'

export type MasterSidebarProps = {
  activeKey: MasterCatalogKey
  onSelect: (key: MasterCatalogKey) => void
}

export function MasterSidebar({ activeKey, onSelect }: MasterSidebarProps) {
  const itemsByGroup = useMemo(() => {
    const map = new Map<string, typeof masterCatalogs>()
    for (const group of masterGroups) {
      map.set(group.key, masterCatalogs.filter((item) => item.group === group.key))
    }
    return map
  }, [])

  return (
    <aside className="w-full shrink-0 md:w-[280px]">
      <div className="rounded-xl border bg-card shadow-softSm">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Catálogos</p>
          <p className="text-xs text-muted-foreground">Centro de datos maestros</p>
        </div>

        <div className="space-y-5 p-3">
          {masterGroups.map((group) => {
            const items = itemsByGroup.get(group.key) ?? []
            return (
              <div key={group.key} className="space-y-1.5">
                <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {items.map((item) => {
                    const isActive = item.key === activeKey
                    const Icon = item.icon
                    return (
                      <Button
                        key={item.key}
                        type="button"
                        variant="ghost"
                        className={cn(
                          'w-full justify-start gap-2 rounded-lg px-2.5 text-sm',
                          isActive && 'bg-muted/60 text-foreground',
                        )}
                        onClick={() => onSelect(item.key)}
                      >
                        <Icon className={cn('h-4 w-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
                        <span className="truncate">{item.label}</span>
                      </Button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-3 rounded-xl border bg-muted/20 p-4">
        <p className="text-sm font-semibold text-foreground">{getCatalogConfig(activeKey).label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{getCatalogConfig(activeKey).description}</p>
      </div>
    </aside>
  )
}

