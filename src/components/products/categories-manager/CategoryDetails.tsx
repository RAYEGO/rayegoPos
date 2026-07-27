import { Calendar, Clock3, Package } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { CategoryRecord } from './types'

export type CategoryDetailsProps = {
  selected: CategoryRecord
  className?: string
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function CategoryDetails({ selected, className }: CategoryDetailsProps) {
  const statusLabel = selected.active ? 'ACTIVO' : 'INACTIVO'

  return (
    <Card className={cn('rounded-xl border bg-card p-5 shadow-softSm', className)}>
      <div className="flex flex-col gap-3 border-b pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{selected.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{selected.description}</p>
          </div>
          <Badge variant={selected.active ? 'success' : 'outline'}>{statusLabel}</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Código</span>
          <span>{selected.code}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-background p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Package className="h-4 w-4" />
            <span>Cantidad de productos</span>
          </div>
          <p className="mt-2 text-lg font-semibold text-foreground">
            {selected.productCount.toLocaleString('es-PE')}
          </p>
        </div>

        <div className="rounded-xl border bg-background p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Fecha creación</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">{formatDateTime(selected.createdAt)}</p>
        </div>

        <div className="rounded-xl border bg-background p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="h-4 w-4" />
            <span>Última modificación</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">{formatDateTime(selected.updatedAt)}</p>
        </div>
      </div>
    </Card>
  )
}
