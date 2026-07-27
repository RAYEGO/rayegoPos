import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, Clock3, Copy, Download, Edit, MoreVertical, Package, Plus, Power, Search, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Loader } from '@/components/ui/loader'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ApiError, ApiNetworkError } from '@/services/apiClient'
import { productsService } from '@/services/productsService'
import { generateMasterCodeFromName, generateUniqueMasterCode, normalizeMasterKey } from '@/utils/masterCatalog'

type LaboratoryRecord = {
  id: string
  code: string
  name: string
  description: string
  active: boolean
  productCount: number
  createdAt: string
  updatedAt: string
}

type LaboratoryStatsSnapshot = {
  totalCount: number
  activeCount: number
  inactiveCount: number
  productCount: number
}

type LaboratoryFormMode = 'create' | 'edit' | 'duplicate'

type LaboratoryFormSubmitPayload = {
  name: string
  description: string
  active: boolean
}

type DialogState = {
  open: boolean
  mode: LaboratoryFormMode
  record: LaboratoryRecord | null
}

type ImportRowStatus = 'create' | 'skip' | 'error'

type ImportRow = {
  row: number
  name: string
  description: string
  active: boolean
  code: string
  status: ImportRowStatus
  message: string
}

export type ProductLaboratoriesManagerProps = {
  accessToken: string
  canManage?: boolean
}

function getApiErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof ApiNetworkError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'No fue posible completar la operación.'
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

function buildStats(records: LaboratoryRecord[]): LaboratoryStatsSnapshot {
  const totalCount = records.length
  const activeCount = records.filter((record) => record.active).length
  const inactiveCount = totalCount - activeCount
  const productCount = records.reduce((sum, record) => sum + record.productCount, 0)

  return { totalCount, activeCount, inactiveCount, productCount }
}

function buildTemplate() {
  return [
    'nombre,descripcion,estado',
    'AC FARMA,Laboratorio local,ACTIVO',
    'MEDIFARMA,,ACTIVO',
    'BAYER,,ACTIVO',
    '',
  ].join('\n')
}

function downloadTemplate() {
  const content = buildTemplate()
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'rayego-laboratorios-template.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function parseBooleanState(value: string) {
  const normalized = value.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (!normalized) return true
  if (['ACTIVO', 'SI', 'S', '1', 'TRUE', 'VERDADERO'].includes(normalized)) return true
  if (['INACTIVO', 'NO', 'N', '0', 'FALSE', 'FALSO'].includes(normalized)) return false
  return null
}

function parseCsv(content: string) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length) {
    throw new Error('El archivo CSV está vacío.')
  }

  const delimiter = lines[0]?.includes(';') ? ';' : ','
  const headers = lines[0].split(delimiter).map((header) => normalizeMasterKey(header))
  const expected = ['nombre', 'descripcion', 'estado']
  const missing = expected.filter((header) => !headers.includes(header))
  if (missing.length) {
    throw new Error(`Faltan columnas en el CSV: ${missing.join(', ')}`)
  }

  const headerIndex = Object.fromEntries(headers.map((header, index) => [header, index])) as Record<
    string,
    number
  >

  return lines.slice(1).map((line, index) => {
    const cols = line.split(delimiter).map((col) => col.trim())
    const get = (key: string) => cols[headerIndex[key]] ?? ''
    return {
      row: index + 2,
      name: get('nombre'),
      description: get('descripcion'),
      state: get('estado'),
    }
  })
}

function resolveUniqueCodePreview(
  name: string,
  existingCodes: Set<string>,
  currentCode?: string,
) {
  const baseCode = generateMasterCodeFromName(name, 'LABORATORIO', 30)
  const taken = new Set(existingCodes)
  if (currentCode) {
    taken.delete(currentCode)
  }
  return generateUniqueMasterCode(baseCode, taken, 30)
}

function normalizeText(value: string) {
  return value.trim()
}

function LaboratoryForm({
  open,
  onOpenChange,
  mode,
  selected,
  existingCodes,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: LaboratoryFormMode
  selected: LaboratoryRecord | null
  existingCodes: Set<string>
  onSubmit: (payload: LaboratoryFormSubmitPayload) => void
}) {
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
    mode === 'edit' ? 'Editar laboratorio' : mode === 'duplicate' ? 'Duplicar laboratorio' : 'Nuevo laboratorio'

  const subtitle =
    mode === 'edit'
      ? 'Actualiza la información del laboratorio seleccionado.'
      : 'Crea un laboratorio para el catálogo de productos.'

  const generatedCode = useMemo(
    () => resolveUniqueCodePreview(name, existingCodes, selected?.code),
    [existingCodes, name, selected?.code],
  )

  return (
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
              <p className="text-xs text-muted-foreground">{active ? 'Visible para registrar productos' : 'Oculto / inactivo'}</p>
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
            disabled={!normalizeText(name)}
            onClick={() => {
              onSubmit({
                name: normalizeText(name),
                description: normalizeText(description),
                active,
              })
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LaboratoryImportDialog({
  open,
  onOpenChange,
  accessToken,
  existing,
  disabled,
  onImported,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accessToken: string
  existing: LaboratoryRecord[]
  disabled?: boolean
  onImported: () => void
}) {
  const [rows, setRows] = useState<ImportRow[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const summary = useMemo(() => {
    const created = rows.filter((row) => row.status === 'create').length
    const skipped = rows.filter((row) => row.status === 'skip').length
    const errors = rows.filter((row) => row.status === 'error').length
    return { created, skipped, errors, total: rows.length }
  }, [rows])

  const canConfirm = summary.created > 0 && summary.errors === 0 && !disabled

  async function handleFile(file: File) {
    if (!accessToken) return
    setIsParsing(true)

    try {
      const text = await file.text()
      const parsed = parseCsv(text)

      const existingNames = new Set(existing.map((item) => normalizeMasterKey(item.name)))
      const takenCodes = new Set(existing.map((item) => item.code))
      const localNames = new Set<string>()

      const nextRows: ImportRow[] = parsed.map((entry) => {
        const name = entry.name.trim()
        const normalizedName = normalizeMasterKey(name)
        const description = entry.description.trim()
        const state = parseBooleanState(entry.state)

        if (!name) {
          return {
            row: entry.row,
            name,
            description,
            active: true,
            code: '',
            status: 'error',
            message: 'Nombre requerido.',
          }
        }

        if (localNames.has(normalizedName)) {
          return {
            row: entry.row,
            name,
            description,
            active: true,
            code: '',
            status: 'error',
            message: 'Nombre duplicado dentro del archivo.',
          }
        }
        localNames.add(normalizedName)

        if (existingNames.has(normalizedName)) {
          return {
            row: entry.row,
            name,
            description,
            active: true,
            code: '',
            status: 'skip',
            message: 'Ya existe un laboratorio con este nombre.',
          }
        }

        if (state === null) {
          return {
            row: entry.row,
            name,
            description,
            active: true,
            code: '',
            status: 'error',
            message: 'Estado inválido. Usa ACTIVO o INACTIVO.',
          }
        }

        const baseCode = generateMasterCodeFromName(name, 'LABORATORIO', 30)
        const code = generateUniqueMasterCode(baseCode, takenCodes, 30)
        takenCodes.add(code)

        return {
          row: entry.row,
          name,
          description,
          active: state,
          code,
          status: 'create',
          message: 'Listo para crear.',
        }
      })

      setRows(nextRows)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo leer el archivo.')
      setRows([])
    } finally {
      setIsParsing(false)
    }
  }

  async function handleConfirm() {
    if (!accessToken) return
    setIsSubmitting(true)

    try {
      const createRows = rows.filter((row) => row.status === 'create')
      for (const row of createRows) {
        await productsService.createMasterLaboratory(accessToken, {
          nombre: row.name,
          descripcion: row.description || undefined,
          activo: row.active,
        })
      }

      toast.success(`Laboratorios importados: ${createRows.length}`)
      setRows([])
      onOpenChange(false)
      onImported()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error('Se detectaron duplicados. Actualiza la lista e intenta nuevamente.')
      } else {
        toast.error(err instanceof Error ? err.message : 'No se pudo completar la importación.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setRows([])
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar laboratorios</DialogTitle>
          <DialogDescription>
            Importa el catálogo base. El código se genera automáticamente desde el nombre.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="outline" onClick={() => downloadTemplate()}>
            <Download className="mr-2 h-4 w-4" />
            Descargar plantilla
          </Button>

          <label className="inline-flex">
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={disabled || isParsing || isSubmitting}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                void handleFile(file)
                event.currentTarget.value = ''
              }}
            />
            <Button type="button" disabled={disabled || isParsing || isSubmitting}>
              {isParsing ? <Loader className="mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />}
              Seleccionar archivo
            </Button>
          </label>
        </div>

        {rows.length ? (
          <div className="rounded-xl border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3 text-xs text-muted-foreground">
              <span>
                {summary.created} crear · {summary.skipped} omitidos · {summary.errors} errores · {summary.total} filas
              </span>
              <span>Revisa antes de confirmar.</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[72px]">Fila</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="w-[140px]">Estado</TableHead>
                  <TableHead className="w-[160px]">Código</TableHead>
                  <TableHead>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={`${row.row}-${row.name}`}>
                    <TableCell className="text-muted-foreground">{row.row}</TableCell>
                    <TableCell className="font-medium text-foreground">{row.name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{row.active ? 'ACTIVO' : 'INACTIVO'}</TableCell>
                    <TableCell className="text-muted-foreground">{row.code || '—'}</TableCell>
                    <TableCell
                      className={
                        row.status === 'error'
                          ? 'text-destructive'
                          : row.status === 'skip'
                            ? 'text-muted-foreground'
                            : 'text-muted-foreground'
                      }
                    >
                      {row.message}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <p className="text-sm font-medium text-foreground">Aún no hay archivo cargado</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Descarga la plantilla, completa tus laboratorios y vuelve a importarla.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={!canConfirm || isSubmitting} onClick={() => void handleConfirm()}>
            {isSubmitting ? <Loader className="mr-2 h-4 w-4" /> : null}
            Confirmar importación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ProductLaboratoriesManager({ accessToken, canManage }: ProductLaboratoriesManagerProps) {
  const [records, setRecords] = useState<LaboratoryRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>({ open: false, mode: 'create', record: null })
  const [isImportOpen, setIsImportOpen] = useState(false)

  const loadLaboratories = useCallback(async () => {
    if (!accessToken) return
    setIsLoading(true)
    setError(null)

    try {
      const response = await productsService.listMasterLaboratories(accessToken)
      const mapped: LaboratoryRecord[] = response.rows.map((row) => ({
        id: row.id,
        code: row.codigo,
        name: row.nombre,
        description: row.descripcion ?? '',
        active: row.activo,
        productCount: row.productCount,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }))

      setRecords(mapped)
      setSelectedId((current) => {
        if (current && mapped.some((item) => item.id === current)) return current
        return mapped[0]?.id ?? null
      })
    } catch (nextError) {
      setError(getApiErrorMessage(nextError))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    void loadLaboratories()
  }, [loadLaboratories])

  const selected = useMemo(
    () => records.find((record) => record.id === selectedId) ?? null,
    [records, selectedId],
  )

  const stats = useMemo(() => buildStats(records), [records])

  const filteredRecords = useMemo(() => {
    const search = normalizeMasterKey(query)
    if (!search) return records
    return records.filter((record) => normalizeMasterKey(record.name).includes(search))
  }, [query, records])

  const existingCodes = useMemo(() => new Set(records.map((record) => record.code)), [records])

  const openCreate = useCallback(() => {
    if (canManage === false) {
      toast.error('No tienes permisos para gestionar laboratorios.')
      return
    }
    setDialog({ open: true, mode: 'create', record: null })
  }, [canManage])

  const openEdit = useCallback(() => {
    if (canManage === false) {
      toast.error('No tienes permisos para gestionar laboratorios.')
      return
    }
    if (!selected) return
    setDialog({ open: true, mode: 'edit', record: selected })
  }, [canManage, selected])

  const openDuplicate = useCallback(() => {
    if (canManage === false) {
      toast.error('No tienes permisos para gestionar laboratorios.')
      return
    }
    if (!selected) return
    setDialog({ open: true, mode: 'duplicate', record: selected })
  }, [canManage, selected])

  const closeDialog = useCallback(() => {
    setDialog((current) => ({ ...current, open: false }))
  }, [])

  const handleToggleActive = useCallback(async () => {
    if (!accessToken) return
    if (!selected) return

    try {
      await productsService.updateMasterLaboratory(accessToken, selected.id, {
        nombre: selected.name,
        descripcion: selected.description || undefined,
        activo: !selected.active,
      })
      toast.message('Estado actualizado.')
      await loadLaboratories()
    } catch (nextError) {
      toast.error(getApiErrorMessage(nextError))
    }
  }, [accessToken, loadLaboratories, selected])

  const handleDelete = useCallback(async () => {
    if (!accessToken) return
    if (!selected) return

    try {
      await productsService.deleteMasterLaboratory(accessToken, selected.id)
      toast.success('Laboratorio eliminado.')
      setSelectedId(null)
      await loadLaboratories()
    } catch (nextError) {
      toast.error(getApiErrorMessage(nextError))
    }
  }, [accessToken, loadLaboratories, selected])

  const handleSubmit = useCallback(
    async (payload: LaboratoryFormSubmitPayload) => {
      if (!accessToken) return

      try {
        if (dialog.mode === 'edit' && dialog.record) {
          await productsService.updateMasterLaboratory(accessToken, dialog.record.id, {
            nombre: payload.name,
            descripcion: payload.description || undefined,
            activo: payload.active,
          })
        } else {
          await productsService.createMasterLaboratory(accessToken, {
            nombre: payload.name,
            descripcion: payload.description || undefined,
            activo: payload.active,
          })
        }

        toast.success('Cambios guardados.')
        closeDialog()
        await loadLaboratories()
      } catch (nextError) {
        toast.error(getApiErrorMessage(nextError))
      }
    },
    [accessToken, closeDialog, dialog.mode, dialog.record, loadLaboratories],
  )

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="h-7 w-7" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="rounded-xl border bg-card p-4 shadow-softSm">
              <p className="text-xs font-medium text-muted-foreground">Total laboratorios</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                {stats.totalCount.toLocaleString('es-PE')}
              </p>
            </Card>
            <Card className="rounded-xl border bg-card p-4 shadow-softSm">
              <p className="text-xs font-medium text-muted-foreground">Activos</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                {stats.activeCount.toLocaleString('es-PE')}
              </p>
            </Card>
            <Card className="rounded-xl border bg-card p-4 shadow-softSm">
              <p className="text-xs font-medium text-muted-foreground">Inactivos</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                {stats.inactiveCount.toLocaleString('es-PE')}
              </p>
            </Card>
            <Card className="rounded-xl border bg-card p-4 shadow-softSm">
              <p className="text-xs font-medium text-muted-foreground">Productos asociados</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-success">
                {stats.productCount.toLocaleString('es-PE')}
              </p>
            </Card>
          </div>

          <Card className="rounded-xl border bg-card p-4 shadow-softSm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-base font-semibold text-foreground">Laboratorios</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Mantén consistencia al registrar productos por fabricante o laboratorio.
                </p>
              </div>
              <div className="w-full max-w-md">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar laboratorios..."
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button type="button" onClick={openCreate} className="w-full sm:w-auto" disabled={canManage === false}>
                  <Plus className="h-4 w-4" />
                  Nuevo laboratorio
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsImportOpen(true)}
                  className="w-full sm:w-auto"
                  disabled={canManage === false}
                >
                  <Upload className="h-4 w-4" />
                  Importar Excel / CSV
                </Button>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={canManage === false || !selected}
                  >
                    <MoreVertical className="h-4 w-4" />
                    Acciones
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={openEdit} disabled={canManage === false || !selected}>
                    <Edit className="mr-2 h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={openDuplicate} disabled={canManage === false || !selected}>
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleToggleActive} disabled={canManage === false || !selected}>
                    <Power className="mr-2 h-4 w-4" />
                    {selected?.active ? 'Desactivar' : 'Activar'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-destructive"
                    disabled={canManage === false || !selected}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <Card className="rounded-xl border bg-card shadow-softSm">
              <div className="border-b px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">Laboratorios</p>
                  <p className="text-xs text-muted-foreground">{filteredRecords.length.toLocaleString('es-PE')}</p>
                </div>
              </div>
              <div className="max-h-[540px] space-y-1 overflow-y-auto p-3">
                {filteredRecords.map((record) => {
                  const isSelected = selectedId === record.id
                  return (
                    <button
                      key={record.id}
                      type="button"
                      className={`flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                        isSelected ? 'border-primary/40 bg-primary/5' : 'border-transparent hover:bg-muted/40'
                      }`}
                      onClick={() => setSelectedId(record.id)}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{record.name}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{record.code}</span>
                      </span>
                      <Badge variant={record.active ? 'success' : 'outline'} className="shrink-0">
                        {record.active ? 'ACTIVO' : 'INACTIVO'}
                      </Badge>
                    </button>
                  )
                })}
              </div>
            </Card>

            {records.length === 0 ? (
              <Card className="rounded-xl border bg-card p-8 text-center shadow-softSm">
                <p className="text-sm font-medium text-foreground">No existen registros.</p>
                <p className="mt-1 text-xs text-muted-foreground">Crea tu primer laboratorio para comenzar.</p>
                <Button type="button" className="mt-4" onClick={openCreate} disabled={canManage === false}>
                  Crear primero
                </Button>
              </Card>
            ) : selected ? (
              <Card className="rounded-xl border bg-card p-5 shadow-softSm">
                <div className="flex flex-col gap-3 border-b pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{selected.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{selected.description}</p>
                    </div>
                    <Badge variant={selected.active ? 'success' : 'outline'}>
                      {selected.active ? 'ACTIVO' : 'INACTIVO'}
                    </Badge>
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
            ) : (
              <Card className="rounded-xl border bg-card p-8 text-center shadow-softSm">
                <p className="text-sm font-medium text-foreground">Selecciona un laboratorio</p>
                <p className="mt-1 text-xs text-muted-foreground">Elige un elemento para ver su información.</p>
                <Button type="button" className="mt-4" onClick={openCreate} disabled={canManage === false}>
                  Nuevo laboratorio
                </Button>
              </Card>
            )}
          </div>

          <LaboratoryForm
            open={dialog.open}
            onOpenChange={(open) => {
              if (!open) closeDialog()
            }}
            mode={dialog.mode}
            selected={dialog.record}
            existingCodes={existingCodes}
            onSubmit={handleSubmit}
          />

          <LaboratoryImportDialog
            open={isImportOpen}
            onOpenChange={setIsImportOpen}
            accessToken={accessToken}
            existing={records}
            disabled={canManage === false}
            onImported={() => {
              void loadLaboratories()
            }}
          />
        </>
      )}
    </div>
  )
}

