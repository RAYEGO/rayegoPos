import type { ComponentType } from 'react'
import { BadgeCheck, Building2, Beaker, Package, FlaskConical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import type { MasterStore } from './catalogs'

type StatCard = {
  key: string
  label: string
  value: number
  icon: ComponentType<{ className?: string }>
  tone?: 'primary' | 'success' | 'info' | 'muted'
}

export type MasterStatsProps = {
  store: MasterStore
  className?: string
}

export function MasterStats({ store, className }: MasterStatsProps) {
  const stats: StatCard[] = [
    {
      key: 'categorias',
      label: 'Categorías',
      value: store.categorias.length,
      icon: BadgeCheck,
      tone: 'primary',
    },
    {
      key: 'laboratorios',
      label: 'Laboratorios',
      value: store.laboratorios.length,
      icon: Building2,
      tone: 'info',
    },
    {
      key: 'principiosActivos',
      label: 'Principios activos',
      value: store.principiosActivos.length,
      icon: Beaker,
      tone: 'success',
    },
    {
      key: 'presentaciones',
      label: 'Presentaciones',
      value: store.presentaciones.length,
      icon: Package,
      tone: 'muted',
    },
    {
      key: 'formasFarmaceuticas',
      label: 'Formas farmacéuticas',
      value: store.formasFarmaceuticas.length,
      icon: FlaskConical,
      tone: 'muted',
    },
  ]

  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-5', className)}>
      {stats.map((stat) => {
        const Icon = stat.icon
        const iconTone =
          stat.tone === 'success'
            ? 'text-success'
            : stat.tone === 'info'
              ? 'text-info'
              : stat.tone === 'primary'
                ? 'text-primary'
                : 'text-muted-foreground'

        return (
          <Card key={stat.key} className="rounded-xl border bg-card p-4 shadow-softSm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                  {stat.value.toLocaleString('es-PE')}
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
