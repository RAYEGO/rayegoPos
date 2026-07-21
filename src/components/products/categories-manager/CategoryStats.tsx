import type { ComponentType } from 'react'
import { Boxes, Layers, Package, SplitSquareVertical } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { CategoryStatsSnapshot } from './types'

type StatCard = {
  key: keyof CategoryStatsSnapshot
  label: string
  icon: ComponentType<{ className?: string }>
  tone?: 'primary' | 'success' | 'muted'
}

export type CategoryStatsProps = {
  stats: CategoryStatsSnapshot
  className?: string
}

export function CategoryStats({ stats, className }: CategoryStatsProps) {
  const cards: StatCard[] = [
    {
      key: 'rootCount',
      label: 'Categorías principales',
      icon: SplitSquareVertical,
      tone: 'primary',
    },
    {
      key: 'subcategoryCount',
      label: 'Subcategorías',
      icon: Layers,
      tone: 'muted',
    },
    {
      key: 'totalCount',
      label: 'Total categorías',
      icon: Boxes,
      tone: 'muted',
    },
    {
      key: 'productCount',
      label: 'Productos asociados',
      icon: Package,
      tone: 'success',
    },
  ]

  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {cards.map((card) => {
        const Icon = card.icon
        const iconTone =
          card.tone === 'success'
            ? 'text-success'
            : card.tone === 'primary'
              ? 'text-primary'
              : 'text-muted-foreground'

        return (
          <Card key={card.key} className="rounded-xl border bg-card p-4 shadow-softSm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                  {stats[card.key].toLocaleString('es-PE')}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-2">
                <Icon className={cn('h-4 w-4', iconTone)} />
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
