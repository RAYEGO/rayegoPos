import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Loader } from '@/components/ui/loader'
import { ApiError, ApiNetworkError } from '@/services/apiClient'
import { productsService } from '@/services/productsService'
import { CategoryDetails } from './CategoryDetails'
import { CategoryEmptyState } from './CategoryEmptyState'
import { CategoryForm } from './CategoryForm'
import type { CategoryFormMode, CategoryFormSubmitPayload } from './CategoryForm'
import { CategorySearch } from './CategorySearch'
import { CategoryStats } from './CategoryStats'
import { CategoryToolbar } from './CategoryToolbar'
import { CategoryTree } from './CategoryTree'
import type { CategoryRecord } from './types'
import { buildCategoryTree, filterCategoryTree, findCategoryAncestors, getCategoryStats } from './utils'

type DialogState = {
  open: boolean
  mode: CategoryFormMode
  defaultParentId: string | null
  record: CategoryRecord | null
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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>({
    open: false,
    mode: 'create',
    defaultParentId: null,
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
        parentId: row.parentId,
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

  const { roots } = useMemo(() => buildCategoryTree(records), [records])
  const stats = useMemo(() => getCategoryStats(records), [records])

  const filteredTree = useMemo(() => filterCategoryTree(roots, query), [query, roots])

  const selected = useMemo(
    () => records.find((record) => record.id === selectedId) ?? null,
    [records, selectedId],
  )

  const childCount = useMemo(() => {
    if (!selected) return 0
    return records.filter((record) => record.parentId === selected.id).length
  }, [records, selected])

  const forcedExpandedIds = useMemo(() => filteredTree.ancestorIds, [filteredTree.ancestorIds])

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedId(id)
      const ancestors = findCategoryAncestors(id, records)
        .map((record) => record.id)
        .slice(0, -1)

      if (ancestors.length) {
        setExpandedIds((current) => {
          const next = new Set(current)
          ancestors.forEach((ancestorId) => next.add(ancestorId))
          return next
        })
      }
    },
    [records],
  )

  const openCreateRoot = useCallback(() => {
    if (canManage === false) {
      toast.error('No tienes permisos para gestionar categorías.')
      return
    }
    setDialog({ open: true, mode: 'create', defaultParentId: null, record: null })
  }, [canManage])

  const openCreateChild = useCallback(() => {
    if (canManage === false) {
      toast.error('No tienes permisos para gestionar categorías.')
      return
    }
    if (!selected) {
      toast.message('Selecciona una categoría para crear una subcategoría.')
      return
    }
    setDialog({ open: true, mode: 'create', defaultParentId: selected.id, record: null })
  }, [canManage, selected])

  const openEdit = useCallback(() => {
    if (canManage === false) {
      toast.error('No tienes permisos para gestionar categorías.')
      return
    }
    if (!selected) return
    setDialog({ open: true, mode: 'edit', defaultParentId: selected.parentId, record: selected })
  }, [canManage, selected])

  const openDuplicate = useCallback(() => {
    if (canManage === false) {
      toast.error('No tienes permisos para gestionar categorías.')
      return
    }
    if (!selected) return
    setDialog({ open: true, mode: 'duplicate', defaultParentId: selected.parentId, record: selected })
  }, [canManage, selected])

  const closeDialog = useCallback(() => {
    setDialog((current) => ({ ...current, open: false }))
  }, [])

  const handleToggleActive = useCallback(async () => {
    if (!accessToken) return
    if (!selected) return

    try {
      await productsService.updateMasterCategory(accessToken, selected.id, {
        parentId: selected.parentId,
        codigo: selected.code,
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
      toast.error(getApiErrorMessage(nextError))
    }
  }, [accessToken, loadCategories, onCategoriesChanged, selected])

  const handleSubmit = useCallback(
    async (payload: CategoryFormSubmitPayload) => {
      if (!accessToken) return

      try {
        if (dialog.mode === 'edit' && dialog.record) {
          await productsService.updateMasterCategory(accessToken, dialog.record.id, {
            parentId: payload.parentId,
            codigo: payload.code,
            nombre: payload.name,
            descripcion: payload.description || undefined,
            color: dialog.record.color ?? undefined,
            orden: dialog.record.order,
            activo: payload.active,
          })
        } else {
          await productsService.createMasterCategory(accessToken, {
            parentId: payload.parentId,
            codigo: payload.code,
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
                  Visualiza la jerarquía y administra un catálogo consistente para el registro de productos.
                </p>
              </div>
              <div className="w-full max-w-md">
                <CategorySearch value={query} onChange={setQuery} />
              </div>
            </div>

            <div className="mt-4">
              <CategoryToolbar
                selected={selected}
                canCreateSubcategory={Boolean(selected)}
                disabled={canManage === false}
                onCreateRoot={openCreateRoot}
                onCreateChild={openCreateChild}
                onEdit={openEdit}
                onDuplicate={openDuplicate}
                onToggleActive={handleToggleActive}
                onDelete={handleDelete}
              />
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <CategoryTree
              nodes={filteredTree.nodes}
              expandedIds={expandedIds}
              forcedExpandedIds={forcedExpandedIds}
              selectedId={selectedId}
              matchIds={filteredTree.matchIds}
              onToggle={handleToggle}
              onSelect={handleSelect}
            />

            {records.length === 0 ? (
              <CategoryEmptyState
                title="No existen registros."
                description="Crea tu primera categoría para comenzar."
                actionLabel="Crear primero"
                onAction={openCreateRoot}
              />
            ) : selected ? (
              <CategoryDetails selected={selected} records={records} childCount={childCount} />
            ) : (
              <CategoryEmptyState
                title="Selecciona una categoría"
                description="Elige un elemento del árbol para ver su información."
                actionLabel="Nueva categoría"
                onAction={openCreateRoot}
              />
            )}
          </div>

          <CategoryForm
            open={dialog.open}
            onOpenChange={(open) => {
              if (!open) closeDialog()
            }}
            mode={dialog.mode}
            records={records}
            selected={dialog.record}
            defaultParentId={dialog.defaultParentId}
            onSubmit={handleSubmit}
          />
        </>
      )}
    </div>
  )
}
