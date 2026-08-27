import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
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
import { Loader } from '@/components/ui/loader'
import { ApiError, ApiNetworkError } from '@/services/apiClient'
import { productsService } from '@/services/productsService'
import { CategoryDetails } from './CategoryDetails'
import { CategoryEmptyState } from './CategoryEmptyState'
import { CategoryForm } from './CategoryForm'
import type { CategoryFormMode, CategoryFormSubmitPayload } from './CategoryForm'
import { CategoryImportDialog } from './CategoryImportDialog'
import { CategoryList } from './CategoryList'
import { CategorySearch } from './CategorySearch'
import { CategoryStats } from './CategoryStats'
import { CategoryToolbar } from './CategoryToolbar'
import type { CategoryRecord } from './types'
import { getCategoryStats, normalizeCategoryKey } from './utils'

type DialogState = {
  open: boolean
  mode: CategoryFormMode
  record: CategoryRecord | null
}

type DeleteBlockedState = {
  open: boolean
  message: string
  record: CategoryRecord
}

export type ProductCategoriesManagerProps = {
  accessToken: string
  onCategoriesChanged?: () => void
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

export function ProductCategoriesManager({
  accessToken,
  onCategoriesChanged,
  canManage,
}: ProductCategoriesManagerProps) {
  const [records, setRecords] = useState<CategoryRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [deleteBlocked, setDeleteBlocked] = useState<DeleteBlockedState | null>(null)
  const [dialog, setDialog] = useState<DialogState>({
    open: false,
    mode: 'create',
    record: null,
  })

  const loadCategories = useCallback(async () => {
    if (!accessToken) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await productsService.listMasterCategories(accessToken)
      const mapped: CategoryRecord[] = response.rows.map((row) => ({
        id: row.id,
        code: row.codigo,
        name: row.nombre,
        description: row.descripcion ?? '',
        color: row.color,
        order: row.orden,
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
    void loadCategories()
  }, [loadCategories])

  const stats = useMemo(() => getCategoryStats(records), [records])

  const filteredRecords = useMemo(() => {
    const search = normalizeCategoryKey(query)
    if (!search) return records
    return records.filter((record) => normalizeCategoryKey(record.name).includes(search))
  }, [query, records])

  const selected = useMemo(
    () => records.find((record) => record.id === selectedId) ?? null,
    [records, selectedId],
  )

  const handleSelect = useCallback((id: string) => setSelectedId(id), [])

  const openCreate = useCallback(() => {
    if (canManage === false) {
      toast.error('No tienes permisos para gestionar categorías.')
      return
    }
    setDialog({ open: true, mode: 'create', record: null })
  }, [canManage])

  const openEdit = useCallback(() => {
    if (canManage === false) {
      toast.error('No tienes permisos para gestionar categorías.')
      return
    }
    if (!selected) return
    setDialog({ open: true, mode: 'edit', record: selected })
  }, [canManage, selected])

  const openDuplicate = useCallback(() => {
    if (canManage === false) {
      toast.error('No tienes permisos para gestionar categorías.')
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
      await productsService.updateMasterCategory(accessToken, selected.id, {
        nombre: selected.name,
        descripcion: selected.description || undefined,
        color: selected.color ?? undefined,
        orden: selected.order,
        activo: !selected.active,
      })
      toast.message('Estado actualizado.')
      await loadCategories()
      onCategoriesChanged?.()
    } catch (nextError) {
      toast.error(getApiErrorMessage(nextError))
    }
  }, [accessToken, loadCategories, onCategoriesChanged, selected])

  const handleDelete = useCallback(async () => {
    if (!accessToken) return
    if (!selected) return

    try {
      await productsService.deleteMasterCategory(accessToken, selected.id)
      toast.success('Categoría eliminada.')
      setSelectedId(null)
      await loadCategories()
      onCategoriesChanged?.()
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 409) {
        setDeleteBlocked({ open: true, message: nextError.message, record: selected })
        return
      }

      toast.error(getApiErrorMessage(nextError))
    }
  }, [accessToken, loadCategories, onCategoriesChanged, selected])

  const handleBlockedInactivate = useCallback(async () => {
    if (!accessToken) return
    if (!deleteBlocked) return

    try {
      await productsService.updateMasterCategory(accessToken, deleteBlocked.record.id, {
        nombre: deleteBlocked.record.name,
        descripcion: deleteBlocked.record.description || undefined,
        color: deleteBlocked.record.color ?? undefined,
        orden: deleteBlocked.record.order,
        activo: false,
      })
      toast.success('Categoría marcada como Inactiva.')
      setDeleteBlocked(null)
      await loadCategories()
      onCategoriesChanged?.()
    } catch (nextError) {
      toast.error(getApiErrorMessage(nextError))
    }
  }, [accessToken, deleteBlocked, loadCategories, onCategoriesChanged])

  const handleSubmit = useCallback(
    async (payload: CategoryFormSubmitPayload) => {
      if (!accessToken) return

      try {
        if (dialog.mode === 'edit' && dialog.record) {
          await productsService.updateMasterCategory(accessToken, dialog.record.id, {
            nombre: payload.name,
            descripcion: payload.description || undefined,
            color: dialog.record.color ?? undefined,
            orden: dialog.record.order,
            activo: payload.active,
          })
        } else {
          await productsService.createMasterCategory(accessToken, {
            nombre: payload.name,
            descripcion: payload.description || undefined,
            activo: payload.active,
          })
        }

        toast.success('Cambios guardados.')
        closeDialog()
        await loadCategories()
        onCategoriesChanged?.()
      } catch (nextError) {
        toast.error(getApiErrorMessage(nextError))
      }
    },
    [accessToken, closeDialog, dialog.mode, dialog.record, loadCategories, onCategoriesChanged],
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
          <CategoryStats stats={stats} />

          <Card className="rounded-xl border bg-card p-4 shadow-softSm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-base font-semibold text-foreground">Categorías</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Administra un catálogo simple y plano para el registro de productos.
                </p>
              </div>
              <div className="w-full max-w-md">
                <CategorySearch value={query} onChange={setQuery} />
              </div>
            </div>

            <div className="mt-4">
              <CategoryToolbar
                selected={selected}
                disabled={canManage === false}
                onCreate={openCreate}
                onImport={() => setIsImportOpen(true)}
                onEdit={openEdit}
                onDuplicate={openDuplicate}
                onToggleActive={handleToggleActive}
                onDelete={handleDelete}
              />
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <CategoryList records={filteredRecords} selectedId={selectedId} onSelect={handleSelect} />

            {records.length === 0 ? (
              <CategoryEmptyState
                title="No existen registros."
                description="Crea tu primera categoría para comenzar."
                actionLabel="Crear primero"
                onAction={openCreate}
              />
            ) : selected ? (
              <CategoryDetails selected={selected} />
            ) : (
              <CategoryEmptyState
                title="Selecciona una categoría"
                description="Elige un elemento del árbol para ver su información."
                actionLabel="Nueva categoría"
                onAction={openCreate}
              />
            )}
          </div>

          {dialog.open ? (
            <CategoryForm
              open={dialog.open}
              onOpenChange={(open) => {
                if (!open) closeDialog()
              }}
              mode={dialog.mode}
              selected={dialog.record}
              onSubmit={handleSubmit}
            />
          ) : null}

          {isImportOpen ? (
            <CategoryImportDialog
              open={isImportOpen}
              onOpenChange={setIsImportOpen}
              accessToken={accessToken}
              existing={records}
              disabled={canManage === false}
              onImported={() => {
                void loadCategories()
                onCategoriesChanged?.()
              }}
            />
          ) : null}

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
