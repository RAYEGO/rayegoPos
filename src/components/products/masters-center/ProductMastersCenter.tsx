import { useCallback, useMemo, useState } from 'react'
import { ArrowLeft, ChevronRight, Plus, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MasterDialog } from './MasterDialog'
import type { MasterDialogMode, MasterDialogSubmitPayload } from './MasterDialog'
import { MasterEmpty } from './MasterEmpty'
import { MasterImportDialog } from './MasterImportDialog'
import { MasterStats } from './MasterStats'
import { MasterTable } from './MasterTable'
import { MasterToolbar } from './MasterToolbar'
import type { MasterStatusFilter } from './MasterToolbar'
import { ProductCategoriesManager } from '@/components/products/categories-manager/ProductCategoriesManager'
import {
  buildInitialMastersStore,
  getCatalogConfig,
  masterCatalogs,
} from './catalogs'
import type { MasterCatalogKey, MasterRecord, MasterStore } from './catalogs'

type DialogState = {
  open: boolean
  mode: MasterDialogMode
  record: MasterRecord | null
}

function normalizeForSearch(value: string) {
  return value.trim().toLowerCase()
}

export type ProductMastersCenterProps = {
  accessToken: string
  onCategoriesChanged?: () => void
  canManageMasters: boolean
}

export function ProductMastersCenter({
  accessToken,
  onCategoriesChanged,
  canManageMasters,
}: ProductMastersCenterProps) {
  const [view, setView] = useState<'dashboard' | 'catalog'>('dashboard')
  const [activeKey, setActiveKey] = useState<MasterCatalogKey>('categorias')
  const [store, setStore] = useState<MasterStore>(() => buildInitialMastersStore())
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<MasterStatusFilter>('TODOS')
  const [page, setPage] = useState(1)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [dialog, setDialog] = useState<DialogState>({ open: false, mode: 'create', record: null })

  const catalog = useMemo(() => getCatalogConfig(activeKey), [activeKey])
  const isCategoryModule = activeKey === 'categorias'

  const rows = store[activeKey]

  const filteredRows = useMemo(() => {
    const search = normalizeForSearch(query)
    return rows.filter((row) => {
      if (status === 'ACTIVOS' && !row.active) return false
      if (status === 'INACTIVOS' && row.active) return false
      if (!search) return true

      return (
        normalizeForSearch(row.code).includes(search) ||
        normalizeForSearch(row.name).includes(search) ||
        normalizeForSearch(row.description).includes(search)
      )
    })
  }, [query, rows, status])

  const recordCountLabel = useMemo(() => {
    return `${filteredRows.length.toLocaleString('es-PE')} registros`
  }, [filteredRows.length])

  const openCreate = useCallback(() => {
    setDialog({ open: true, mode: 'create', record: null })
  }, [])

  const openEdit = useCallback((row: MasterRecord) => {
    setDialog({ open: true, mode: 'edit', record: row })
  }, [])

  const openDuplicate = useCallback((row: MasterRecord) => {
    setDialog({ open: true, mode: 'duplicate', record: row })
  }, [])

  const closeDialog = useCallback(() => {
    setDialog((current) => ({ ...current, open: false }))
  }, [])

  const handleOpenCatalog = useCallback((key: MasterCatalogKey) => {
    setActiveKey(key)
    setQuery('')
    setStatus('TODOS')
    setPage(1)
    setView('catalog')
    setAdvancedOpen(false)
  }, [])

  const handleBackToDashboard = useCallback(() => {
    setView('dashboard')
    setQuery('')
    setStatus('TODOS')
    setPage(1)
    setImportDialogOpen(false)
    closeDialog()
  }, [closeDialog])

  const handleSubmitDialog = useCallback(
    (payload: MasterDialogSubmitPayload) => {
      setStore((current) => {
        const next = { ...current }
        const list = [...next[activeKey]]
        const now = new Date().toISOString()

        if (dialog.mode === 'edit' && dialog.record) {
          const index = list.findIndex((row) => row.id === dialog.record?.id)
          if (index >= 0) {
            list[index] = {
              ...list[index],
              code: payload.code,
              name: payload.name,
              description: payload.description,
              active: payload.active,
            }
          }
          next[activeKey] = list
          return next
        }

        const created: MasterRecord = {
          id: crypto.randomUUID(),
          code: payload.code,
          name: payload.name,
          description: payload.description,
          active: payload.active,
          productCount: 0,
          createdAt: now,
        }

        next[activeKey] = [created, ...list]
        return next
      })

      toast.success('Cambios guardados (simulado).')
      closeDialog()
      setPage(1)
    },
    [activeKey, closeDialog, dialog.mode, dialog.record],
  )

  const handleToggleStatus = useCallback((row: MasterRecord) => {
    setStore((current) => {
      const next = { ...current }
      next[activeKey] = next[activeKey].map((item) =>
        item.id === row.id ? { ...item, active: !item.active } : item,
      )
      return next
    })
    toast.message('Estado actualizado (simulado).')
  }, [activeKey])

  const handleDelete = useCallback((row: MasterRecord) => {
    setStore((current) => {
      const next = { ...current }
      next[activeKey] = next[activeKey].filter((item) => item.id !== row.id)
      return next
    })
    toast.success('Registro eliminado (simulado).')
  }, [activeKey])

  const quickStats = useMemo(() => {
    const totals = masterCatalogs.reduce<Record<string, number>>((acc, item) => {
      acc[item.key] = store[item.key].length
      return acc
    }, {})

    const activeCount = rows.filter((row) => row.active).length
    const inactiveCount = rows.length - activeCount

    return {
      totals,
      activeCount,
      inactiveCount,
    }
  }, [rows, store])

  const frequentCatalogs = useMemo(
    () =>
      masterCatalogs.filter((item) =>
        ['categorias', 'laboratorios', 'presentaciones', 'unidadesMedida'].includes(item.key),
      ),
    [],
  )

  const advancedCatalogs = useMemo(
    () =>
      masterCatalogs.filter(
        (item) => !['categorias', 'laboratorios', 'presentaciones', 'unidadesMedida'].includes(item.key),
      ),
    [],
  )

  return (
    <div className="space-y-4">
      {view === 'dashboard' ? (
        <div className="space-y-6">
          <Card className="rounded-xl border bg-card p-5 shadow-softSm">
            <p className="text-base font-semibold text-foreground">Dashboard de Catálogos</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Accede rápidamente a los catálogos más usados para mantener consistencia en productos.
            </p>
          </Card>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Catálogos frecuentes</p>
              <p className="text-xs text-muted-foreground">Uso diario</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {frequentCatalogs.map((item) => {
                const Icon = item.icon
                const count = store[item.key].length
                return (
                  <Card key={item.key} className="rounded-xl border bg-card p-5 shadow-softSm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="rounded-xl border bg-muted/30 p-2.5">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenCatalog(item.key)}
                      >
                        Abrir
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="mt-4 text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {count.toLocaleString('es-PE')} registros
                    </p>
                    <p className="mt-3 text-sm text-muted-foreground">{item.description}</p>
                  </Card>
                )
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Catálogos avanzados</p>
              <p className="text-xs text-muted-foreground">Solo cuando se necesiten</p>
            </div>

            <Card className="rounded-xl border bg-card p-5 shadow-softSm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Configuraciones especializadas</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Catálogos menos frecuentes para estandarizar datos farmacéuticos y reglas.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={() => setAdvancedOpen(true)}>
                  Ver Catálogos Avanzados
                </Button>
              </div>
            </Card>
          </div>

          <Dialog open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <DialogContent className="h-[92vh] w-[calc(100vw-1.5rem)] max-w-5xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Catálogos Avanzados</DialogTitle>
                <DialogDescription>
                  Úsalos cuando realmente necesites afinar el catálogo farmacéutico.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {advancedCatalogs.map((item) => {
                  const Icon = item.icon
                  const count = store[item.key].length
                  return (
                    <Card key={item.key} className="rounded-xl border bg-card p-5 shadow-softSm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="rounded-xl border bg-muted/30 p-2.5">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenCatalog(item.key)}
                        >
                          Abrir
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="mt-4 text-sm font-semibold text-foreground">{item.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {count.toLocaleString('es-PE')} registros
                      </p>
                      <p className="mt-3 text-sm text-muted-foreground">{item.description}</p>
                    </Card>
                  )
                })}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="ghost" onClick={handleBackToDashboard} className="w-fit">
              <ArrowLeft className="h-4 w-4" />
              Volver a Catálogos
            </Button>
          </div>

          {isCategoryModule ? (
            <ProductCategoriesManager
              accessToken={accessToken}
              onCategoriesChanged={onCategoriesChanged}
              canManage={canManageMasters}
            />
          ) : (
            <>
              <MasterStats store={store} />

              <div className="rounded-xl border bg-card p-4 shadow-softSm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-foreground">{catalog.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{catalog.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Card className="rounded-xl border bg-muted/20 px-3 py-2 shadow-none">
                        <p className="text-xs text-muted-foreground">Registros</p>
                        <p className="text-sm font-semibold text-foreground">{recordCountLabel}</p>
                      </Card>
                      <Card className="rounded-xl border bg-muted/20 px-3 py-2 shadow-none">
                        <p className="text-xs text-muted-foreground">Activos</p>
                        <p className="text-sm font-semibold text-foreground">
                          {quickStats.activeCount.toLocaleString('es-PE')}
                        </p>
                      </Card>
                      <Card className="rounded-xl border bg-muted/20 px-3 py-2 shadow-none">
                        <p className="text-xs text-muted-foreground">Inactivos</p>
                        <p className="text-sm font-semibold text-foreground">
                          {quickStats.inactiveCount.toLocaleString('es-PE')}
                        </p>
                      </Card>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button type="button" variant="outline" onClick={() => setImportDialogOpen(true)}>
                      <UploadCloud className="h-4 w-4" />
                      Importar Catálogo Base
                    </Button>
                    <Button type="button" onClick={openCreate}>
                      <Plus className="h-4 w-4" />
                      Nuevo
                    </Button>
                  </div>
                </div>
              </div>

              <MasterToolbar
                query={query}
                onQueryChange={(value) => {
                  setQuery(value)
                  setPage(1)
                }}
                placeholder={catalog.searchPlaceholder}
                status={status}
                onStatusChange={(value) => {
                  setStatus(value)
                  setPage(1)
                }}
              />

              {filteredRows.length === 0 ? (
                <MasterEmpty actionLabel="Crear primero" onAction={openCreate} />
              ) : (
                <MasterTable
                  rows={filteredRows}
                  page={page}
                  pageSize={10}
                  onPageChange={setPage}
                  onEdit={openEdit}
                  onDuplicate={openDuplicate}
                  onToggleStatus={handleToggleStatus}
                  onDelete={handleDelete}
                />
              )}

              <MasterDialog
                open={dialog.open}
                onOpenChange={(open) => {
                  if (!open) closeDialog()
                }}
                catalog={catalog}
                mode={dialog.mode}
                record={dialog.record}
                onSubmit={handleSubmitDialog}
              />

              <MasterImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
            </>
          )}
        </div>
      )}
    </div>
  )
}
