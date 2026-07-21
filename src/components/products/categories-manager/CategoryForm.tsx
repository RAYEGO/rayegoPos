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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { CategoryRecord } from './types'
import { flattenCategoriesForSelect, formatCategoryPath } from './utils'

export type CategoryFormMode = 'create' | 'edit' | 'duplicate'

export type CategoryFormSubmitPayload = {
  code: string
  name: string
  description: string
  parentId: string | null
  active: boolean
}

export type CategoryFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: CategoryFormMode
  records: CategoryRecord[]
  selected: CategoryRecord | null
  defaultParentId: string | null
  onSubmit: (payload: CategoryFormSubmitPayload) => void
}

function normalize(value: string) {
  return value.trim()
}

export function CategoryForm({
  open,
  onOpenChange,
  mode,
  records,
  selected,
  defaultParentId,
  onSubmit,
}: CategoryFormProps) {
  const parentOptions = useMemo(() => flattenCategoriesForSelect(records), [records])

  const resolvedName = useMemo(() => {
    if (!selected) return ''
    return mode === 'duplicate' ? `${selected.name} (Copia)` : selected.name
  }, [mode, selected])

  const resolvedCode = useMemo(() => {
    if (!selected) return ''
    return mode === 'duplicate' ? `${selected.code}-COPY` : selected.code
  }, [mode, selected])

  const resolvedDescription = useMemo(() => {
    if (!selected) return ''
    return selected.description
  }, [selected])

  const resolvedParentId = useMemo(() => {
    if (mode === 'create') return defaultParentId
    if (!selected) return defaultParentId
    return mode === 'duplicate' ? selected.parentId : selected.parentId
  }, [defaultParentId, mode, selected])

  const [code, setCode] = useState(resolvedCode)
  const [name, setName] = useState(resolvedName)
  const [description, setDescription] = useState(resolvedDescription)
  const [parentId, setParentId] = useState<string>(resolvedParentId ?? 'NONE')
  const [active, setActive] = useState(selected?.active ?? true)

  useEffect(() => {
    if (!open) return
    setCode(resolvedCode)
    setName(resolvedName)
    setDescription(resolvedDescription)
    setParentId(resolvedParentId ?? 'NONE')
    setActive(selected?.active ?? true)
  }, [open, resolvedCode, resolvedDescription, resolvedName, resolvedParentId, selected?.active])

  const title =
    mode === 'edit'
      ? 'Editar categoría'
      : mode === 'duplicate'
        ? 'Duplicar categoría'
        : 'Nueva categoría'

  const subtitle =
    mode === 'edit'
      ? 'Actualiza la información de la categoría seleccionada.'
      : 'Crea una categoría y define su categoría padre solo si lo necesitas.'

  const parentPreview = useMemo(() => {
    if (parentId === 'NONE') return 'Ninguna'
    return formatCategoryPath(parentId, records)
  }, [parentId, records])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground">Código *</p>
            <Input value={code} onChange={(event) => setCode(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground">Nombre *</p>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground">Descripción</p>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground">Categoría padre</p>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Ninguna</SelectItem>
                {parentOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id} disabled={!option.active}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Se creará dentro de: {parentPreview}</p>
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
            disabled={!normalize(code) || !normalize(name)}
            onClick={() => {
              const payload: CategoryFormSubmitPayload = {
                code: normalize(code),
                name: normalize(name),
                description: normalize(description),
                parentId: parentId === 'NONE' ? null : parentId,
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
  )
}
