import { useMemo, useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader } from '@/components/ui/loader'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ApiError } from '@/services/apiClient'
import { productsService } from '@/services/productsService'
import type { CategoryRecord } from './types'
import { generateCategoryCodeFromName, normalizeCategoryKey } from './utils'

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

export type CategoryImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  accessToken: string
  existing: CategoryRecord[]
  onImported: () => void
  disabled?: boolean
}

function buildTemplate() {
  return [
    'nombre,descripcion,estado',
    'ANALGÉSICOS,Medicamentos para dolor,ACTIVO',
    'ANTIBIÓTICOS,,ACTIVO',
    'MATERIAL MÉDICO,Suministros varios,INACTIVO',
    '',
  ].join('\n')
}

function downloadTemplate() {
  const content = buildTemplate()
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'rayego-categorias-template.csv'
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
  const headers = lines[0].split(delimiter).map((header) => normalizeCategoryKey(header))
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

function generateUniqueCode(base: string, taken: Set<string>) {
  const normalizedBase = base.slice(0, 30)
  if (!taken.has(normalizedBase)) return normalizedBase
  for (let attempt = 2; attempt <= 99; attempt += 1) {
    const suffix = `_${attempt}`
    const trimmed = normalizedBase.slice(0, Math.max(1, 30 - suffix.length))
    const candidate = `${trimmed}${suffix}`.slice(0, 30)
    if (!taken.has(candidate)) return candidate
  }
  return normalizedBase
}

export function CategoryImportDialog({
  open,
  onOpenChange,
  accessToken,
  existing,
  onImported,
  disabled,
}: CategoryImportDialogProps) {
  const [rows, setRows] = useState<ImportRow[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

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

      const existingNames = new Set(existing.map((item) => normalizeCategoryKey(item.name)))
      const existingCodes = new Set(existing.map((item) => item.code))
      const takenCodes = new Set(existingCodes)
      const localNames = new Set<string>()

      const nextRows: ImportRow[] = parsed.map((entry) => {
        const name = entry.name.trim()
        const normalizedName = normalizeCategoryKey(name)
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
            message: 'Ya existe una categoría con este nombre.',
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

        const baseCode = generateCategoryCodeFromName(name)
        const code = generateUniqueCode(baseCode, takenCodes)
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
        await productsService.createMasterCategory(accessToken, {
          nombre: row.name,
          descripcion: row.description || undefined,
          activo: row.active,
        })
      }

      toast.success(`Categorías importadas: ${createRows.length}`)
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
          <DialogTitle>Importar categorías</DialogTitle>
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
              accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              disabled={disabled || isParsing || isSubmitting}
              ref={inputRef}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                void handleFile(file)
                event.currentTarget.value = ''
              }}
            />
            <Button
              type="button"
              disabled={disabled || isParsing || isSubmitting}
              onClick={() => inputRef.current?.click()}
            >
              {isParsing ? <Loader className="mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />}
              Seleccionar archivo
            </Button>
          </label>
        </div>

        {rows.length ? (
          <div className="rounded-xl border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3 text-xs text-muted-foreground">
              <span>
                {summary.created} crear · {summary.skipped} omitidos · {summary.errors} errores ·{' '}
                {summary.total} filas
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
                    <TableCell className="text-muted-foreground">
                      {row.active ? 'ACTIVO' : 'INACTIVO'}
                    </TableCell>
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
              Descarga la plantilla, completa tus categorías y vuelve a importarla.
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
