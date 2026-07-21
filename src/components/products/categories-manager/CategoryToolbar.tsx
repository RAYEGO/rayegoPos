import { Plus, MoreVertical, Copy, Edit, Power, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { CategoryRecord } from './types'

export type CategoryToolbarProps = {
  selected: CategoryRecord | null
  disabled?: boolean
  onCreate: () => void
  onEdit: () => void
  onDuplicate: () => void
  onToggleActive: () => void
  onDelete: () => void
}

export function CategoryToolbar({
  selected,
  disabled,
  onCreate,
  onEdit,
  onDuplicate,
  onToggleActive,
  onDelete,
}: CategoryToolbarProps) {
  const hasSelection = Boolean(selected)
  const isDisabled = disabled ?? false

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="button" onClick={onCreate} className="w-full sm:w-auto" disabled={isDisabled}>
          <Plus className="h-4 w-4" />
          Nueva categoría
        </Button>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={isDisabled || !hasSelection}
          >
            <MoreVertical className="h-4 w-4" />
            Acciones
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit} disabled={isDisabled || !hasSelection}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate} disabled={isDisabled || !hasSelection}>
            <Copy className="h-4 w-4 mr-2" />
            Duplicar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onToggleActive} disabled={isDisabled || !hasSelection}>
            <Power className="h-4 w-4 mr-2" />
            {selected?.active ? 'Desactivar' : 'Activar'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive"
            disabled={isDisabled || !hasSelection}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
