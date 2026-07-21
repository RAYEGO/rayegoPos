import { useCallback, useMemo, useState } from 'react'
import { Plus, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MasterDialog } from './MasterDialog'
import type { MasterDialogMode, MasterDialogSubmitPayload } from './MasterDialog'
import { MasterEmpty } from './MasterEmpty'
import { MasterImportDialog } from './MasterImportDialog'
import { MasterSidebar } from './MasterSidebar'
import { MasterStats } from './MasterStats'
import { MasterTable } from './MasterTable'
import { MasterToolbar } from './MasterToolbar'
import type { MasterStatusFilter } from './MasterToolbar'
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

export function ProductMastersCenter() {
  const [activeKey, setActiveKey] = useState<MasterCatalogKey>('categorias')
  const [store, setStore] = useState<MasterStore>(() => buildInitialMastersStore())
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<MasterStatusFilter>('TODOS')
  const [page, setPage] = useState(1)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [dialog, setDialog] = useState<DialogState>({ open: false, mode: 'create', record: null })

  const catalog = useMemo(() => getCatalogConfig(activeKey), [activeKey])

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

  const handleSelectCatalog = useCallback((key: MasterCatalogKey) => {
    setActiveKey(key)
    setQuery('')
    setStatus('TODOS')
    setPage(1)
  }, [])

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

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      <MasterSidebar activeKey={activeKey} onSelect={handleSelectCatalog} />

      <section className="space-y-4">
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
      </section>

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
    </div>
  )
}

