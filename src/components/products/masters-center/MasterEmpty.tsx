import { Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export type MasterEmptyProps = {
  title?: string
  actionLabel: string
  onAction: () => void
}

export function MasterEmpty({ title = 'No existen registros.', actionLabel, onAction }: MasterEmptyProps) {
  return (
    <Card className="rounded-xl border bg-card p-10 text-center shadow-softSm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/40">
        <Inbox className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="mt-4 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Crea el primer registro para empezar a estandarizar tu catálogo de productos.
      </p>
      <div className="mt-5 flex justify-center">
        <Button type="button" onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
    </Card>
  )
}

