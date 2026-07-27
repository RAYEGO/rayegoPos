import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { CategoryRecord } from './types'

export type CategoryListProps = {
  records: CategoryRecord[]
  selectedId: string | null
  onSelect: (id: string) => void
  className?: string
}

export function CategoryList({ records, selectedId, onSelect, className }: CategoryListProps) {
  return (
    <Card className={cn('rounded-xl border bg-card shadow-softSm', className)}>
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">Categorías</p>
          <p className="text-xs text-muted-foreground">{records.length.toLocaleString('es-PE')}</p>
        </div>
      </div>

      <div className="max-h-[540px] space-y-1 overflow-y-auto p-3">
        {records.map((record) => {
          const selected = selectedId === record.id
          return (
            <button
              key={record.id}
              type="button"
              className={cn(
                'flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                selected ? 'border-primary/40 bg-primary/5' : 'border-transparent hover:bg-muted/40',
              )}
              onClick={() => onSelect(record.id)}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {record.name}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {record.code}
                </span>
              </span>
              <Badge variant={record.active ? 'success' : 'outline'} className="shrink-0">
                {record.active ? 'ACTIVO' : 'INACTIVO'}
              </Badge>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

