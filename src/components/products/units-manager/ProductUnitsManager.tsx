import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import {
  generateMasterCodeFromName,
  generateUniqueMasterCode,
  normalizeMasterKey,
  normalizeUnitSymbol,
} from '@/utils/masterCatalog'

type UnitRecord = {
  id: string
  code: string
  name: string
  symbol: string
  description: string
  active: boolean
  productCount: number
  createdAt: string
  updatedAt: string
}

type UnitStatsSnapshot = {
  totalCount: number
  activeCount: number
  inactiveCount: number
  productCount: number
}

type UnitFormMode = 'create' | 'edit' | 'duplicate'

type UnitFormSubmitPayload = {
  name: string
  symbol: string
  description: string
  active: boolean
}

type DialogState = {
  open: boolean
  mode: UnitFormMode
  record: UnitRecord | null
}

type DeleteBlockedState = {
  open: boolean
  message: string
  record: UnitRecord
}

type ImportRowStatus = 'create' | 'skip' | 'error'

type ImportRow = {
  row: number
  name: string
  symbol: string
  description: string
  active: boolean
  code: string
  status: ImportRowStatus
  message: string
}

export type ProductUnitsManagerProps = {
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

function buildStats(records: UnitRecord[]): UnitStatsSnapshot {
  const totalCount = records.length
  const activeCount = records.filter((record) => record.active).length
  const inactiveCount = totalCount - activeCount
  const productCount = records.reduce((sum, record) => sum + record.productCount, 0)

  return { totalCount, activeCount, inactiveCount, productCount }
}

function buildTemplate() {
  return [
    ['nombre', 'abreviatura', 'estado'],
    ['Unidad', 'und', 'ACTIVO'],
    ['Tableta', 'tab', 'ACTIVO'],
    ['Mililitro', 'ml', 'ACTIVO'],
  ]
}

function downloadTemplate() {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet(buildTemplate())
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Unidades')
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
  link.download = 'rayego-unidades-medida-template.xlsx'
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

type ParsedUnitEntry = {
  row: number
  name: string
  symbol: string
  state: string
}

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function ensureHeaders(headers: string[]) {
  const expected = ['nombre', 'abreviatura', 'estado']
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
  ) as Record<
    string,
    number
  >

  const dataRows = rows.slice(1)
  return dataRows
    .map((cols, index): ParsedUnitEntry => {
      const get = (key: string) => normalizeCell(cols[headerIndex[key]])
      return {
        row: index + 2,
        name: get('nombre'),
        symbol: get('abreviatura'),
        state: get('estado'),
      }
    })
    .filter((entry) => entry.name || entry.symbol || entry.state)
}

async function parseUnitFile(file: File): Promise<ParsedUnitEntry[]> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (extension === 'xlsx') {
    return parseSpreadsheet(await file.arrayBuffer())
  }

  if (file.type.includes('spreadsheet') || file.type.includes('excel') || file.type === '') {
    return parseSpreadsheet(await file.arrayBuffer())
  }

  throw new Error('Formato de archivo no soportado. Usa únicamente archivos Excel (.xlsx).')
}

function resolveUniqueCodePreview(
  name: string,
  existingCodes: Set<string>,
  currentCode?: string,
) {
  const baseCode = generateMasterCodeFromName(name, 'UNIDAD', 20)
  const taken = new Set(existingCodes)
  if (currentCode) {
    taken.delete(currentCode)
  }
  return generateUniqueMasterCode(baseCode, taken, 20)
}

function normalizeText(value: string) {
  return value.trim()
}

function UnitForm({
  open,
  onOpenChange,
  mode,
  selected,
  existingCodes,
  existingSymbols,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: UnitFormMode
  selected: UnitRecord | null
  existingCodes: Set<string>
  existingSymbols: Set<string>
  onSubmit: (payload: UnitFormSubmitPayload) => void
}) {
  const nameRef = useRef<HTMLInputElement>(null)
  const symbolRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const openKeyRef = useRef(0)

  const resolvedName = useMemo(() => {
    if (!selected) return ''
    return mode === 'duplicate' ? `${selected.name} (Copia)` : selected.name
  }, [mode, selected])

  const resolvedDescription = useMemo(() => {
    if (!selected) return ''
    return selected.description
  }, [selected])

  const resolvedSymbol = useMemo(() => {
    if (!selected) return ''
    return selected.symbol
  }, [selected])

  const [active, setActive] = useState(selected?.active ?? true)
  const [codePreview, setCodePreview] = useState(() => resolveUniqueCodePreview(resolvedName, existingCodes, selected?.code))
  const [symbolPreview, setSymbolPreview] = useState(resolvedSymbol)

  useEffect(() => {
    if (!open) return
    openKeyRef.current += 1
    setActive(selected?.active ?? true)
    setCodePreview(resolveUniqueCodePreview(resolvedName, existingCodes, selected?.code))
    setSymbolPreview(resolvedSymbol)
  }, [open, resolvedDescription, resolvedName, resolvedSymbol, selected?.active, existingCodes, selected?.code])

  const title =
    mode === 'edit' ? 'Editar unidad de medida' : mode === 'duplicate' ? 'Duplicar unidad de medida' : 'Nueva unidad de medida'

  const subtitle =
    mode === 'edit'
      ? 'Actualiza la información de la unidad seleccionada.'
      : 'Crea una unidad para estandarizar el catálogo de productos.'

  const normalizedSymbol = useMemo(() => normalizeUnitSymbol(symbolPreview, 20), [symbolPreview])
  const isSymbolTaken = useMemo(() => {
    if (!normalizedSymbol) return false
    if (selected?.symbol && normalizeUnitSymbol(selected.symbol, 20) === normalizedSymbol) {
      return false
    }
    return existingSymbols.has(normalizedSymbol)
  }, [existingSymbols, normalizedSymbol, selected?.symbol])

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
              key={`unit-name-${openKeyRef.current}`}
              ref={nameRef}
              defaultValue={resolvedName}
              onInput={(e) => setCodePreview(resolveUniqueCodePreview(e.currentTarget.value, existingCodes, selected?.code))}
            />
            <p className="text-xs text-muted-foreground">Código generado: {codePreview}</p>
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground">Abreviatura *</p>
            <Input
              key={`unit-symbol-${openKeyRef.current}`}
              ref={symbolRef}
              defaultValue={resolvedSymbol}
              placeholder="und / ml / g / tab"
              onInput={(e) => setSymbolPreview(e.currentTarget.value)}
            />
            {isSymbolTaken ? (
              <p className="text-xs text-destructive">La abreviatura ya existe.</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Usa una abreviatura corta para operación diaria (ej. und, ml, g, tab).
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground">Descripción</p>
            <Textarea
              key={`unit-desc-${openKeyRef.current}`}
              ref={descriptionRef}
              defaultValue={resolvedDescription}
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
            onClick={() => {
              const rawName = normalizeText(nameRef.current?.value ?? '')
              const rawSymbol = normalizeUnitSymbol(symbolRef.current?.value ?? '', 20)
              if (!rawName || !rawSymbol) return
              const finalSymbolTaken = (() => {
                if (!rawSymbol) return false
                if (selected?.symbol && normalizeUnitSymbol(selected.symbol, 20) === rawSymbol) return false
                return existingSymbols.has(rawSymbol)
              })()
              if (finalSymbolTaken) return
              onSubmit({
                name: rawName,
                symbol: rawSymbol,
                description: normalizeText(descriptionRef.current?.value ?? ''),
                active,
              })
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null
}

function UnitImportDialog({
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
  existing: UnitRecord[]
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
      const parsed = await parseUnitFile(file)

      const existingNames = new Set(existing.map((item) => normalizeMasterKey(item.name)))
      const takenCodes = new Set(existing.map((item) => item.code))
      const takenSymbols = new Set(existing.map((item) => normalizeUnitSymbol(item.symbol, 20)).filter(Boolean))
      const localNames = new Set<string>()
      const localSymbols = new Set<string>()

      const nextRows: ImportRow[] = parsed.map((entry) => {
        const name = entry.name.trim()
        const normalizedName = normalizeMasterKey(name)
        const description = ''
        const state = parseBooleanState(entry.state)
        const symbolNormalized = normalizeUnitSymbol(entry.symbol, 20)

        if (!name) {
          return {
            row: entry.row,
            name,
            symbol: '',
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
            symbol: '',
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
            symbol: '',
            description,
            active: true,
            code: '',
            status: 'skip',
            message: 'Ya existe una unidad con este nombre.',
          }
        }

        if (state === null) {
          return {
            row: entry.row,
            name,
            symbol: '',
            description,
            active: true,
            code: '',
            status: 'error',
            message: 'Estado inválido. Usa ACTIVO o INACTIVO.',
          }
        }

        if (!symbolNormalized) {
          return {
            row: entry.row,
            name,
            symbol: '',
            description,
            active: true,
            code: '',
            status: 'error',
            message: 'Abreviatura requerida.',
          }
        }

        if (localSymbols.has(symbolNormalized)) {
          return {
            row: entry.row,
            name,
            symbol: symbolNormalized,
            description,
            active: true,
            code: '',
            status: 'error',
            message: 'Abreviatura duplicada dentro del archivo.',
          }
        }
        localSymbols.add(symbolNormalized)

        if (takenSymbols.has(symbolNormalized)) {
          return {
            row: entry.row,
            name,
            symbol: symbolNormalized,
            description,
            active: true,
            code: '',
            status: 'error',
            message: 'Ya existe una unidad con esta abreviatura.',
          }
        }

        const baseCode = generateMasterCodeFromName(name, 'UNIDAD', 20)
        const code = generateUniqueMasterCode(baseCode, takenCodes, 20)
        takenCodes.add(code)

        return {
          row: entry.row,
          name,
          symbol: symbolNormalized,
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
        await productsService.createMasterUnit(accessToken, {
          nombre: row.name,
          simbolo: row.symbol,
          descripcion: row.description || undefined,
          activo: row.active,
        })
      }

      toast.success(`Unidades importadas: ${createRows.length}`)
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

  return open ? (
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
          <DialogTitle>Importar unidades de medida</DialogTitle>
          <DialogDescription>
            Importa un catálogo plano. El código se genera automáticamente desde el nombre.
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
                  <TableHead className="w-[140px]">Abrev.</TableHead>
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
                    <TableCell className="text-muted-foreground">{row.symbol || '—'}</TableCell>
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
              Descarga la plantilla, completa tus unidades y vuelve a importarla.
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
  ) : null
}

export function ProductUnitsManager({ accessToken, canManage }: ProductUnitsManagerProps) {
  const [records, setRecords] = useState<UnitRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>({ open: false, mode: 'create', record: null })
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [deleteBlocked, setDeleteBlocked] = useState<DeleteBlockedState | null>(null)

  const loadUnits = useCallback(async () => {
    if (!accessToken) return
    setIsLoading(true)
    setError(null)

    try {
      const response = await productsService.listMasterUnits(accessToken)
      const mapped: UnitRecord[] = response.rows.map((row) => ({
        id: row.id,
        code: row.codigo,
        name: row.nombre,
        symbol: row.simbolo,
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
    void loadUnits()
  }, [loadUnits])

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
  const existingSymbols = useMemo(
    () => new Set(records.map((record) => normalizeUnitSymbol(record.symbol, 20)).filter(Boolean)),
    [records],
  )

  const openCreate = useCallback(() => {
    if (canManage === false) {
      toast.error('No tienes permisos para gestionar unidades de medida.')
      return
    }
    setDialog({ open: true, mode: 'create', record: null })
  }, [canManage])

  const openEdit = useCallback(() => {
    if (canManage === false) {
      toast.error('No tienes permisos para gestionar unidades de medida.')
      return
    }
    if (!selected) return
    setDialog({ open: true, mode: 'edit', record: selected })
  }, [canManage, selected])

  const openDuplicate = useCallback(() => {
    if (canManage === false) {
      toast.error('No tienes permisos para gestionar unidades de medida.')
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
      await productsService.updateMasterUnit(accessToken, selected.id, {
        nombre: selected.name,
        simbolo: selected.symbol,
        descripcion: selected.description || undefined,
        activo: !selected.active,
      })
      toast.message('Estado actualizado.')
      await loadUnits()
    } catch (nextError) {
      toast.error(getApiErrorMessage(nextError))
    }
  }, [accessToken, loadUnits, selected])

  const handleDelete = useCallback(async () => {
    if (!accessToken) return
    if (!selected) return

    try {
      await productsService.deleteMasterUnit(accessToken, selected.id)
      toast.success('Unidad eliminada.')
      setSelectedId(null)
      await loadUnits()
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 409) {
        setDeleteBlocked({ open: true, message: nextError.message, record: selected })
        return
      }

      toast.error(getApiErrorMessage(nextError))
    }
  }, [accessToken, loadUnits, selected])

  const handleBlockedInactivate = useCallback(async () => {
    if (!accessToken) return
    if (!deleteBlocked) return

    try {
      await productsService.updateMasterUnit(accessToken, deleteBlocked.record.id, {
        nombre: deleteBlocked.record.name,
        simbolo: deleteBlocked.record.symbol,
        descripcion: deleteBlocked.record.description || undefined,
        activo: false,
      })
      toast.success('Unidad marcada como Inactiva.')
      setDeleteBlocked(null)
      await loadUnits()
    } catch (nextError) {
      toast.error(getApiErrorMessage(nextError))
    }
  }, [accessToken, deleteBlocked, loadUnits])

  const handleSubmit = useCallback(
    async (payload: UnitFormSubmitPayload) => {
      if (!accessToken) return

      try {
        if (dialog.mode === 'edit' && dialog.record) {
          await productsService.updateMasterUnit(accessToken, dialog.record.id, {
            nombre: payload.name,
            simbolo: payload.symbol,
            descripcion: payload.description || undefined,
            activo: payload.active,
          })
        } else {
          await productsService.createMasterUnit(accessToken, {
            nombre: payload.name,
            simbolo: payload.symbol,
            descripcion: payload.description || undefined,
            activo: payload.active,
          })
        }

        toast.success('Cambios guardados.')
        closeDialog()
        await loadUnits()
      } catch (nextError) {
        toast.error(getApiErrorMessage(nextError))
      }
    },
    [accessToken, closeDialog, dialog.mode, dialog.record, existingCodes, loadUnits],
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
              <p className="text-xs font-medium text-muted-foreground">Total unidades</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                {stats.totalCount.toLocaleString('es-PE')}
              </p>
            </Card>
            <Card className="rounded-xl border bg-card p-4 shadow-softSm">
              <p className="text-xs font-medium text-muted-foreground">Activas</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                {stats.activeCount.toLocaleString('es-PE')}
              </p>
            </Card>
            <Card className="rounded-xl border bg-card p-4 shadow-softSm">
              <p className="text-xs font-medium text-muted-foreground">Inactivas</p>
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
                <p className="text-base font-semibold text-foreground">Unidades de medida</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Estandariza la unidad base del producto (und, ml, g, frasco, etc.).
                </p>
              </div>
              <div className="w-full max-w-md">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar unidades..."
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button type="button" onClick={openCreate} className="w-full sm:w-auto" disabled={canManage === false}>
                  <Plus className="h-4 w-4" />
                  Nueva unidad
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
                  <p className="text-sm font-semibold text-foreground">Unidades</p>
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
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {record.code} · {record.symbol}
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

            {records.length === 0 ? (
              <Card className="rounded-xl border bg-card p-8 text-center shadow-softSm">
                <p className="text-sm font-medium text-foreground">No existen registros.</p>
                <p className="mt-1 text-xs text-muted-foreground">Crea tu primera unidad para comenzar.</p>
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
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Abreviatura</span>
                    <span>{selected.symbol}</span>
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
                <p className="text-sm font-medium text-foreground">Selecciona una unidad</p>
                <p className="mt-1 text-xs text-muted-foreground">Elige un elemento para ver su información.</p>
                <Button type="button" className="mt-4" onClick={openCreate} disabled={canManage === false}>
                  Nueva unidad
                </Button>
              </Card>
            )}
          </div>

          {dialog.open ? (
            <UnitForm
              open={dialog.open}
              onOpenChange={(open) => {
                if (!open) closeDialog()
              }}
              mode={dialog.mode}
              selected={dialog.record}
              existingCodes={existingCodes}
              existingSymbols={existingSymbols}
              onSubmit={handleSubmit}
            />
          ) : null}

          {isImportOpen ? (
            <UnitImportDialog
              open={isImportOpen}
              onOpenChange={setIsImportOpen}
              accessToken={accessToken}
              existing={records}
              disabled={canManage === false}
              onImported={() => {
                void loadUnits()
              }}
            />
          ) : null}

          {deleteBlocked?.open ? (
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
          ) : null}
        </>
      )}
    </div>
  )
}
