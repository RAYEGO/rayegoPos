import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, Clock3, Copy, Download, Edit, MoreVertical, Package, Plus, Power, Search, Trash2, Upload } from 'lucide-react'
import * as XLSX from 'xlsx'
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

type MedicationTypeRecord = {
  id: string
  code: string
  name: string
  description: string
  active: boolean
  productCount: number
  createdAt: string
  updatedAt: string
}

type MedicationTypeStatsSnapshot = {
  totalCount: number
  activeCount: number
  inactiveCount: number
  productCount: number
}

type MedicationTypeFormMode = 'create' | 'edit' | 'duplicate'

type MedicationTypeFormSubmitPayload = {
  name: string
  description: string
  active: boolean
}

type DialogState = {
  open: boolean
  mode: MedicationTypeFormMode
  record: MedicationTypeRecord | null
}

type DeleteBlockedState = {
  open: boolean
  message: string
  record: MedicationTypeRecord
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

type ParsedMedicationTypeEntry = {
  row: number
  name: string
  description: string
  state: string
}

export type ProductMedicationTypesManagerProps = {
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

function buildStats(records: MedicationTypeRecord[]): MedicationTypeStatsSnapshot {
  const totalCount = records.length
  const activeCount = records.filter((record) => record.active).length
  const inactiveCount = totalCount - activeCount
  const productCount = records.reduce((sum, record) => sum + record.productCount, 0)

  return { totalCount, activeCount, inactiveCount, productCount }
}

function buildTemplate() {
  return [
    ['nombre', 'descripcion', 'estado'],
    ['Genérico', 'Producto comercializado como genérico', 'ACTIVO'],
    ['Marca', 'Producto comercializado bajo una marca comercial', 'ACTIVO'],
    ['Similar', 'Producto clasificado como similar', 'ACTIVO'],
  ]
}

function downloadTemplate() {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet(buildTemplate())
  XLSX.utils.book_append_sheet(workbook, worksheet, 'TiposComerciales')
  const content = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
  })
  const blob = new Blob([content], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'rayego-tipos-comerciales-template.xlsx'
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

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function ensureHeaders(headers: string[]) {
  const expected = ['nombre', 'descripcion', 'estado']
  const missing = expected.filter((header) => !headers.includes(header))
  if (missing.length) {
    throw new Error(`Faltan columnas en el archivo: ${missing.join(', ')}`)
  }
}

function parseSpreadsheet(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error('El archivo Excel no contiene hojas.')
  }

  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  if (!rows.length) {
    throw new Error('El archivo Excel está vacío.')
  }

  const headerRow = rows[0]?.map((cell) => normalizeMasterKey(normalizeCell(cell))) ?? []
  ensureHeaders(headerRow)

  const headerIndex = Object.fromEntries(
    headerRow.map((header, index) => [header, index]),
  ) as Record<string, number>

  return rows
    .slice(1)
    .map((cols, index): ParsedMedicationTypeEntry => {
      const get = (key: string) => normalizeCell(cols[headerIndex[key]])
      return {
        row: index + 2,
        name: get('nombre'),
        description: get('descripcion'),
        state: get('estado'),
      }
    })
    .filter((entry) => entry.name || entry.description || entry.state)
}

async function parseMedicationTypeFile(file: File): Promise<ParsedMedicationTypeEntry[]> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (extension === 'xlsx') {
    return parseSpreadsheet(await file.arrayBuffer())
  }

  if (file.type.includes('spreadsheet') || file.type.includes('excel') || file.type === '') {
    return parseSpreadsheet(await file.arrayBuffer())
  }

  throw new Error('Formato de archivo no soportado. Usa únicamente archivos Excel (.xlsx).')
}

function resolveUniqueCodePreview(name: string, existingCodes: Set<string>, currentCode?: string) {
  const baseCode = generateMasterCodeFromName(name, 'TIPO_COMERCIAL', 30)
  const taken = new Set(existingCodes)
  if (currentCode) {
    taken.delete(currentCode)
  }
  return generateUniqueMasterCode(baseCode, taken, 30)
}

function normalizeText(value: string) {
  return value.trim()
}

function MedicationTypeForm({
  open,
  onOpenChange,
  mode,
  selected,
  existingCodes,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: MedicationTypeFormMode
  selected: MedicationTypeRecord | null
  existingCodes: Set<string>
  onSubmit: (payload: MedicationTypeFormSubmitPayload) => void
}) {
  const resolvedName = useMemo(() => {
    if (!selected) return ''
    return mode === 'duplicate' ? `${selected.name} (Copia)` : selected.name
  }, [mode, selected])

  const resolvedDescription = useMemo(() => selected?.description ?? '', [selected])

  const [name, setName] = useState(resolvedName)
  const [description, setDescription] = useState(resolvedDescription)
  const [active, setActive] = useState(selected?.active ?? true)

  useEffect(() => {
    if (!open) return
    setName(resolvedName)
    setDescription(resolvedDescription)
    setActive(selected?.active ?? true)
  }, [open, resolvedDescription, resolvedName, selected?.active])

  const generatedCode = useMemo(
    () => resolveUniqueCodePreview(name, existingCodes, selected?.code),
    [existingCodes, name, selected?.code],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit'
              ? 'Editar tipo comercial'
              : mode === 'duplicate'
                ? 'Duplicar tipo comercial'
                : 'Nuevo tipo comercial'}
          </DialogTitle>
          <DialogDescription>
            Crea un tipo reutilizable para clasificar productos como Genérico, Marca o Similar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground">Nombre *</p>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
            <p className="text-xs text-muted-foreground">Código generado: {generatedCode}</p>
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground">Descripción</p>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
          </div>

          <div className="flex items-center justify-between rounded-xl border bg-muted/20 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Estado</p>
              <p className="text-xs text-muted-foreground">
                {active ? 'Disponible para seleccionar en productos' : 'Oculto / inactivo'}
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
            disabled={!normalizeText(name)}
            onClick={() =>
              onSubmit({
                name: normalizeText(name),
                description: normalizeText(description),
                active,
              })
            }
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MedicationTypeImportDialog({
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
  existing: MedicationTypeRecord[]
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
      const parsed = await parseMedicationTypeFile(file)
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
            message: 'Ya existe un tipo comercial con este nombre.',
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

        const baseCode = generateMasterCodeFromName(name, 'TIPO_COMERCIAL', 30)
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
        await productsService.createMasterMedicationType(accessToken, {
          nombre: row.name,
          descripcion: row.description || undefined,
          activo: row.active,
        })
      }

      toast.success(`Tipos comerciales importados: ${createRows.length}`)
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
          <DialogTitle>Importar tipos comerciales</DialogTitle>
          <DialogDescription>
            Importa un catálogo simple para clasificar productos sin fijar opciones en código.
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
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
                    <TableCell className={row.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}>
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
              Descarga la plantilla, completa tus tipos y vuelve a importarla.
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

export function ProductMedicationTypesManager({
  accessToken,
  canManage,
}: ProductMedicationTypesManagerProps) {
  const [records, setRecords] = useState<MedicationTypeRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>({ open: false, mode: 'create', record: null })
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [deleteBlocked, setDeleteBlocked] = useState<DeleteBlockedState | null>(null)

  const loadRecords = useCallback(async () => {
    if (!accessToken) return
    setIsLoading(true)
    setError(null)

    try {
      const response = await productsService.listMasterMedicationTypes(accessToken)
      const mapped = response.rows.map((row) => ({
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
      setSelectedId((current) => (current && mapped.some((item) => item.id === current) ? current : mapped[0]?.id ?? null))
    } catch (nextError) {
      setError(getApiErrorMessage(nextError))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    void loadRecords()
  }, [loadRecords])

  const stats = useMemo(() => buildStats(records), [records])
  const existingCodes = useMemo(() => new Set(records.map((record) => record.code)), [records])

  const filteredRecords = useMemo(() => {
    const search = normalizeMasterKey(query)
    if (!search) return records
    return records.filter((record) => normalizeMasterKey(record.name).includes(search))
  }, [query, records])

  const selected = useMemo(
    () => records.find((record) => record.id === selectedId) ?? null,
    [records, selectedId],
  )

  const openCreate = useCallback(() => {
    if (canManage === false) {
      toast.error('No tienes permisos para gestionar tipos comerciales.')
      return
    }
    setDialog({ open: true, mode: 'create', record: null })
  }, [canManage])

  const openEdit = useCallback(() => {
    if (canManage === false) {
      toast.error('No tienes permisos para gestionar tipos comerciales.')
      return
    }
    if (!selected) return
    setDialog({ open: true, mode: 'edit', record: selected })
  }, [canManage, selected])

  const openDuplicate = useCallback(() => {
    if (canManage === false) {
      toast.error('No tienes permisos para gestionar tipos comerciales.')
      return
    }
    if (!selected) return
    setDialog({ open: true, mode: 'duplicate', record: selected })
  }, [canManage, selected])

  const handleSave = useCallback(
    async (payload: MedicationTypeFormSubmitPayload) => {
      if (!accessToken) return
      try {
        if (dialog.mode === 'edit' && dialog.record) {
          await productsService.updateMasterMedicationType(accessToken, dialog.record.id, {
            nombre: payload.name,
            descripcion: payload.description || undefined,
            activo: payload.active,
          })
          toast.success('Tipo comercial actualizado.')
        } else {
          await productsService.createMasterMedicationType(accessToken, {
            nombre: payload.name,
            descripcion: payload.description || undefined,
            activo: payload.active,
          })
          toast.success('Tipo comercial creado.')
        }

        setDialog({ open: false, mode: 'create', record: null })
        await loadRecords()
      } catch (nextError) {
        toast.error(getApiErrorMessage(nextError))
      }
    },
    [accessToken, dialog.mode, dialog.record, loadRecords],
  )

  const handleToggleActive = useCallback(async () => {
    if (!accessToken || !selected) return
    try {
      await productsService.updateMasterMedicationType(accessToken, selected.id, {
        nombre: selected.name,
        descripcion: selected.description || undefined,
        activo: !selected.active,
      })
      toast.message('Estado actualizado.')
      await loadRecords()
    } catch (nextError) {
      toast.error(getApiErrorMessage(nextError))
    }
  }, [accessToken, loadRecords, selected])

  const handleDelete = useCallback(async () => {
    if (!accessToken || !selected) return
    try {
      await productsService.deleteMasterMedicationType(accessToken, selected.id)
      toast.success('Tipo comercial eliminado.')
      setSelectedId(null)
      await loadRecords()
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 409) {
        setDeleteBlocked({ open: true, message: nextError.message, record: selected })
        return
      }
      toast.error(getApiErrorMessage(nextError))
    }
  }, [accessToken, loadRecords, selected])

  const handleBlockedInactivate = useCallback(async () => {
    if (!accessToken || !deleteBlocked) return
    try {
      await productsService.updateMasterMedicationType(accessToken, deleteBlocked.record.id, {
        nombre: deleteBlocked.record.name,
        descripcion: deleteBlocked.record.description || undefined,
        activo: false,
      })
      toast.success('Tipo comercial marcado como inactivo.')
      setDeleteBlocked(null)
      await loadRecords()
    } catch (nextError) {
      toast.error(getApiErrorMessage(nextError))
    }
  }, [accessToken, deleteBlocked, loadRecords])

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
          <div className="grid gap-3 md:grid-cols-4">
            <Card className="rounded-xl border bg-card p-4 shadow-softSm">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-lg font-semibold text-foreground">{stats.totalCount}</p>
                  <p className="text-xs text-muted-foreground">Total tipos</p>
                </div>
              </div>
            </Card>
            <Card className="rounded-xl border bg-card p-4 shadow-softSm">
              <div className="flex items-center gap-3">
                <Power className="h-5 w-5 text-success" />
                <div>
                  <p className="text-lg font-semibold text-foreground">{stats.activeCount}</p>
                  <p className="text-xs text-muted-foreground">Activos</p>
                </div>
              </div>
            </Card>
            <Card className="rounded-xl border bg-card p-4 shadow-softSm">
              <div className="flex items-center gap-3">
                <Clock3 className="h-5 w-5 text-warning" />
                <div>
                  <p className="text-lg font-semibold text-foreground">{stats.inactiveCount}</p>
                  <p className="text-xs text-muted-foreground">Inactivos</p>
                </div>
              </div>
            </Card>
            <Card className="rounded-xl border bg-card p-4 shadow-softSm">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-info" />
                <div>
                  <p className="text-lg font-semibold text-foreground">{stats.productCount}</p>
                  <p className="text-xs text-muted-foreground">Productos asociados</p>
                </div>
              </div>
            </Card>
          </div>

          <Card className="rounded-xl border bg-card p-4 shadow-softSm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                  <p className="text-base font-semibold text-foreground">Tipos comerciales</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Administra las clasificaciones comerciales reutilizables como Genérico, Marca o Similar.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar tipo..."
                    className="pl-9"
                  />
                </div>
                <Button type="button" variant="outline" onClick={() => setIsImportOpen(true)} disabled={canManage === false}>
                  <Upload className="mr-2 h-4 w-4" />
                  Importar
                </Button>
                <Button type="button" onClick={openCreate} disabled={canManage === false}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo
                </Button>
              </div>
            </div>
          </Card>

          {filteredRecords.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="text-sm font-medium text-foreground">No hay tipos comerciales para mostrar</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Crea el primer tipo o ajusta el criterio de búsqueda.
              </p>
            </div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="w-[140px]">Estado</TableHead>
                    <TableHead className="hidden md:table-cell w-[120px]">Productos</TableHead>
                    <TableHead className="hidden lg:table-cell w-[180px]">Actualizado</TableHead>
                    <TableHead className="w-[72px] text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow
                      key={record.id}
                      className={selectedId === record.id ? 'bg-muted/30' : undefined}
                      onClick={() => setSelectedId(record.id)}
                    >
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{record.name}</p>
                          <p className="text-xs text-muted-foreground">{record.code}</p>
                          {record.description ? (
                            <p className="mt-1 text-xs text-muted-foreground">{record.description}</p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={record.active ? 'success' : 'outline'}>
                          {record.active ? 'ACTIVO' : 'INACTIVO'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {record.productCount}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {formatDateTime(record.updatedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={openEdit}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={openDuplicate}>
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => void handleToggleActive()}>
                              <Power className="mr-2 h-4 w-4" />
                              {record.active ? 'Desactivar' : 'Activar'}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => void handleDelete()}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          <MedicationTypeForm
            open={dialog.open}
            onOpenChange={(open) => {
              if (!open) setDialog({ open: false, mode: 'create', record: null })
            }}
            mode={dialog.mode}
            selected={dialog.record}
            existingCodes={existingCodes}
            onSubmit={handleSave}
          />

          <MedicationTypeImportDialog
            open={isImportOpen}
            onOpenChange={setIsImportOpen}
            accessToken={accessToken}
            existing={records}
            disabled={canManage === false}
            onImported={() => {
              void loadRecords()
            }}
          />

          <Dialog
            open={deleteBlocked?.open ?? false}
            onOpenChange={(open) => {
              if (!open) setDeleteBlocked(null)
            }}
          >
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>No se puede eliminar</DialogTitle>
                <DialogDescription className="whitespace-pre-line">
                  {deleteBlocked?.message}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setDeleteBlocked(null)}>
                  Cerrar
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleBlockedInactivate()}
                  disabled={!deleteBlocked?.record.active || canManage === false}
                >
                  Marcar Inactivo
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}
