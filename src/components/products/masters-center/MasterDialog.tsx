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
import type { MasterCatalogConfig, MasterRecord } from './catalogs'

export type MasterDialogMode = 'create' | 'edit' | 'duplicate'

export type MasterDialogSubmitPayload = {
  code: string
  name: string
  description: string
  active: boolean
}

export type MasterDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalog: MasterCatalogConfig
  mode: MasterDialogMode
  record: MasterRecord | null
  onSubmit: (payload: MasterDialogSubmitPayload) => void
}

function normalize(value: string) {
  return value.trim()
}

export function MasterDialog({
  open,
  onOpenChange,
  catalog,
  mode,
  record,
  onSubmit,
}: MasterDialogProps) {
  const defaultCode = useMemo(() => {
    if (!record) return `${catalog.codePrefix}-${new Date().getTime().toString().slice(-3)}`
    if (mode === 'duplicate') return `${record.code}-COPY`
    return record.code
  }, [catalog.codePrefix, mode, record])

  const [code, setCode] = useState(defaultCode)
  const [name, setName] = useState(record?.name ?? '')
  const [description, setDescription] = useState(record?.description ?? '')
  const [active, setActive] = useState(record?.active ?? true)

  useEffect(() => {
    if (!open) return

    setCode(defaultCode)
    setName(record?.name ?? '')
    setDescription(record?.description ?? '')
    setActive(record?.active ?? true)
  }, [defaultCode, open, record])

  const dialogTitle =
    mode === 'edit' ? `Editar ${catalog.label}` : mode === 'duplicate' ? `Duplicar ${catalog.label}` : `Nuevo ${catalog.label}`

  const dialogDescription =
    mode === 'edit'
      ? 'Actualiza la información del catálogo.'
      : mode === 'duplicate'
        ? 'Crea un registro basado en uno existente.'
        : 'Registra un nuevo elemento para mantener consistencia en tu catálogo.'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground">Código</p>
            <Input value={code} onChange={(event) => setCode(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground">Nombre</p>
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
              const payload: MasterDialogSubmitPayload = {
                code: normalize(code),
                name: normalize(name),
                description: normalize(description),
                active,
              }
              onSubmit(payload)
            }}
            disabled={!normalize(code) || !normalize(name)}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

