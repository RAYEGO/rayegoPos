import { useEffect, useMemo, useRef, useState } from 'react'
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

  const resolvedActive = useMemo(() => selected?.active ?? true, [selected?.active])

  const nameRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const [active, setActive] = useState(resolvedActive)
  const [codePreview, setCodePreview] = useState(() => generateCategoryCodeFromName(resolvedName))
  const openKeyRef = useRef(0)

  useEffect(() => {
    if (!open) return
    openKeyRef.current += 1
    setActive(resolvedActive)
    setCodePreview(generateCategoryCodeFromName(resolvedName))
    // Reset uncontrolled input native values to defaults using key pattern below
  }, [open, resolvedActive, resolvedName])

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

  const currentOpenKey = openKeyRef.current

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
            <Input
              key={`name-${currentOpenKey}`}
              ref={nameRef}
              defaultValue={resolvedName}
              onInput={(event) => {
                setCodePreview(generateCategoryCodeFromName(event.currentTarget.value))
              }}
            />
            <p className="text-xs text-muted-foreground">Código generado: {codePreview}</p>
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground">Descripción</p>
            <Textarea
              key={`desc-${currentOpenKey}`}
              ref={descriptionRef}
              defaultValue={resolvedDescription}
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
            onClick={() => {
              const name = normalize(nameRef.current?.value ?? '')
              const description = normalize(descriptionRef.current?.value ?? '')
              if (!name) return
              onSubmit({ name, description, active })
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null
}
