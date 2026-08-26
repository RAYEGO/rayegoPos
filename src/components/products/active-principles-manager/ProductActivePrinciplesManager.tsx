import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, Copy, Edit, MoreVertical, Package, Plus, Power, Search, Trash2 } from 'lucide-react'
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
import type { MasterActivePrincipleRecord, UpsertMasterActivePrinciplePayload } from '@/types/products'

type ActivePrincipleRecord = {
  id: string
  code: string
  name: string
  description: string
  active: boolean
  productCount: number
  createdAt: string
  updatedAt: string
}

type ActivePrincipleFormMode = 'create' | 'edit' | 'duplicate'

type DialogState = {
  open: boolean
  mode: ActivePrincipleFormMode
  record: ActivePrincipleRecord | null
}

type DeleteBlockedState = {
  open: boolean
  message: string
  record: ActivePrincipleRecord
}

export type ProductActivePrinciplesManagerProps = {
  accessToken: string
  canManage?: boolean
  onChanged?: () => void
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

function normalizeKey(value: string) {
  return value.trim().toLocaleLowerCase('es-PE')
}

function buildStats(records: ActivePrincipleRecord[]) {
  const totalCount = records.length
  const activeCount = records.filter((record) => record.active).length
  const inactiveCount = totalCount - activeCount
  const productCount = records.reduce((sum, record) => sum + record.productCount, 0)
  return { totalCount, activeCount, inactiveCount, productCount }
}

function ActivePrincipleFormDialog({
  open,
  onOpenChange,
  mode,
  selected,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: ActivePrincipleFormMode
  selected: ActivePrincipleRecord | null
  onSubmit: (payload: UpsertMasterActivePrinciplePayload) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [active, setActive] = useState(true)

  useEffect(() => {
    if (!open) return
    setName(mode === 'duplicate' ? `${selected?.name ?? ''} (Copia)` : selected?.name ?? '')
    setDescription(selected?.description ?? '')
    setActive(selected?.active ?? true)
  }, [mode, open, selected])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit'
              ? 'Editar principio activo'
              : mode === 'duplicate'
                ? 'Duplicar principio activo'
                : 'Nuevo principio activo'}
          </DialogTitle>
          <DialogDescription>
            Crea un maestro reutilizable para clasificar productos por sustancia activa.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground">Nombre *</p>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-medium text-muted-foreground">Descripción</p>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
          </div>

          <div className="flex items-center justify-between rounded-xl border bg-muted/20 p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Estado</p>
              <p className="text-xs text-muted-foreground">
                {active ? 'Disponible para productos, filtros e importación' : 'Oculto / inactivo'}
              </p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!name.trim()}
            onClick={() =>
              onSubmit({
                nombre: name.trim(),
                descripcion: description.trim() || undefined,
                activo: active,
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

export function ProductActivePrinciplesManager({
  accessToken,
  canManage,
  onChanged,
}: ProductActivePrinciplesManagerProps) {
  const [records, setRecords] = useState<ActivePrincipleRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>({ open: false, mode: 'create', record: null })
  const [deleteBlocked, setDeleteBlocked] = useState<DeleteBlockedState | null>(null)

  const loadRecords = useCallback(async () => {
    if (!accessToken) return
    setIsLoading(true)
    setError(null)

    try {
      const response = await productsService.listMasterActivePrinciples(accessToken)
      const mapped: ActivePrincipleRecord[] = response.rows.map((row: MasterActivePrincipleRecord) => ({
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
    void loadRecords()
  }, [loadRecords])

  const stats = useMemo(() => buildStats(records), [records])
  const filteredRecords = useMemo(() => {
    const normalizedQuery = normalizeKey(query)
    if (!normalizedQuery) return records
    return records.filter(
      (record) =>
        normalizeKey(record.name).includes(normalizedQuery) ||
        normalizeKey(record.code).includes(normalizedQuery),
    )
  }, [query, records])
  const selectedRecord = useMemo(
    () => filteredRecords.find((record) => record.id === selectedId) ?? filteredRecords[0] ?? null,
    [filteredRecords, selectedId],
  )

  const refreshAfterChange = useCallback(async () => {
    await loadRecords()
    await onChanged?.()
  }, [loadRecords, onChanged])

  async function handleSave(payload: UpsertMasterActivePrinciplePayload) {
    if (!accessToken) return

    try {
      if (dialog.mode === 'edit' && dialog.record) {
        await productsService.updateMasterActivePrinciple(accessToken, dialog.record.id, payload)
        toast.success('Principio activo actualizado.')
      } else {
        await productsService.createMasterActivePrinciple(accessToken, payload)
        toast.success('Principio activo creado.')
      }

      setDialog({ open: false, mode: 'create', record: null })
      await refreshAfterChange()
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  async function handleToggleActive(record: ActivePrincipleRecord) {
    if (!accessToken || canManage === false) return

    try {
      await productsService.updateMasterActivePrinciple(accessToken, record.id, {
        nombre: record.name,
        descripcion: record.description || undefined,
        activo: !record.active,
      })
      toast.success(record.active ? 'Principio activo desactivado.' : 'Principio activo activado.')
      await refreshAfterChange()
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  async function handleDelete(record: ActivePrincipleRecord) {
    if (!accessToken || canManage === false) return

    try {
      await productsService.deleteMasterActivePrinciple(accessToken, record.id)
      toast.success('Principio activo eliminado.')
      await refreshAfterChange()
    } catch (error) {
      const message = getApiErrorMessage(error)
      if (error instanceof ApiError && error.status === 409) {
        setDeleteBlocked({ open: true, message, record })
        return
      }
      toast.error(message)
    }
  }

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
                  <p className="text-xs text-muted-foreground">Total principios</p>
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
                <Power className="h-5 w-5 text-warning" />
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
                <p className="text-base font-semibold text-foreground">Principios activos</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Administra el maestro reutilizable para productos, filtros y búsquedas por sustancia activa.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar principio activo..."
                    className="pl-9"
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => setDialog({ open: true, mode: 'create', record: null })}
                  disabled={canManage === false}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo
                </Button>
              </div>
            </div>
          </Card>

          {filteredRecords.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="text-sm font-medium text-foreground">No hay principios activos para mostrar</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Crea el primero o ajusta el criterio de búsqueda.
              </p>
            </div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Principio activo</TableHead>
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
                      className={selectedRecord?.id === record.id ? 'bg-muted/30' : undefined}
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
                            <DropdownMenuItem
                              onClick={() => setDialog({ open: true, mode: 'edit', record })}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDialog({ open: true, mode: 'duplicate', record })}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => void handleToggleActive(record)}>
                              <Power className="mr-2 h-4 w-4" />
                              {record.active ? 'Desactivar' : 'Activar'}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => void handleDelete(record)}>
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

          <ActivePrincipleFormDialog
            open={dialog.open}
            onOpenChange={(open) => {
              if (!open) {
                setDialog({ open: false, mode: 'create', record: null })
              }
            }}
            mode={dialog.mode}
            selected={dialog.record}
            onSubmit={handleSave}
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
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDeleteBlocked(null)}>
                  Cerrar
                </Button>
                <Button
                  type="button"
                  onClick={() => deleteBlocked && void handleToggleActive(deleteBlocked.record)}
                  disabled={!deleteBlocked?.record.active || canManage === false}
                >
                  Marcar inactivo
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}
