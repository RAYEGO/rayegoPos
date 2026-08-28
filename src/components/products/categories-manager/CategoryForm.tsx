import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { CategoryRecord } from './types'
import { generateCategoryCodeFromName } from './utils'

export type CategoryFormMode = 'create' | 'edit' | 'duplicate'

export type CategoryFormSubmitPayload = {
  name: string
  description: string
  active: boolean
}

export type CategoryFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: CategoryFormMode
  selected: CategoryRecord | null
  onSubmit: (payload: CategoryFormSubmitPayload) => void
}

function normalize(value: string) {
  return value.trim()
}

export function CategoryForm({
  open,
  onOpenChange,
  mode,
  selected,
  onSubmit,
}: CategoryFormProps) {
  const resolvedName = useMemo(() => {
    if (!selected) return ''
    return mode === 'duplicate' ? `${selected.name} (Copia)` : selected.name
  }, [mode, selected])

  const resolvedDescription = useMemo(() => {
    if (!selected) return ''
    return selected.description
  }, [selected])

  const [name, setName] = useState(resolvedName)
  const [description, setDescription] = useState(resolvedDescription)
  const [active, setActive] = useState(selected?.active ?? true)

  useEffect(() => {
    if (!open) return
    setName(resolvedName)
    setDescription(resolvedDescription)
    setActive(selected?.active ?? true)
  }, [open, resolvedDescription, resolvedName, selected?.active])

  const title =
    mode === 'edit'
      ? 'Editar categoría'
      : mode === 'duplicate'
        ? 'Duplicar categoría'
        : 'Nueva categoría'

  const subtitle =
    mode === 'edit'
      ? 'Actualiza la información de la categoría seleccionada.'
      : 'Crea una categoría para el catálogo de productos.'

  const generatedCode = useMemo(() => generateCategoryCodeFromName(name), [name])

  return open ? (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground">Nombre *</p>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
            <p className="text-xs text-muted-foreground">Código generado: {generatedCode}</p>
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground">Descripción</p>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border bg-muted/20 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Estado</p>
              <p className="text-xs text-muted-foreground">
                {active ? 'Visible para registrar productos' : 'Oculto / inactivo'}
              </p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!normalize(name)}
            onClick={() => {
              const payload: CategoryFormSubmitPayload = {
                name: normalize(name),
                description: normalize(description),
                active,
              }
              onSubmit(payload)
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null
}
