import {
  ArrowLeft,
  BadgeDollarSign,
  CircleDollarSign,
  ClipboardCheck,
  FileDown,
  HandCoins,
  Printer,
  WalletCards,
  ChevronDown,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Loader } from '@/components/ui/loader'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/useAuth'
import { ApiError, ApiNetworkError } from '@/services/apiClient'
import { cashierService } from '@/services/cashierService'
import type {
  CashDrawerStatus,
  CashMovementType,
  CashierDashboardResponse,
  CashReconciliationPreviewResponse,
  OpenCashDrawerPayload,
  CreateCashMovementPayload,
  SaveCashReconciliationPayload,
} from '@/types/cashier'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(value)
}

function getDrawerStatusVariant(status: CashDrawerStatus) {
  if (status === 'ABIERTA') return 'success'
  if (status === 'EN_CIERRE') return 'warning'
  return 'outline'
}

function getMovementVariant(type: CashMovementType) {
  if (type === 'VENTA' || type === 'INGRESO_MANUAL') return 'success'
  if (type === 'CUADRE') return 'info'
  return 'warning'
}

// Zod schemas for forms
const openCashDrawerSchema = z.object({
  branchId: z.string().min(1, 'Selecciona una sucursal'),
  openingAmount: z
    .number()
    .min(0.01, 'El monto debe ser mayor a 0'),
  observations: z.string().optional(),
})

const createCashMovementSchema = z.object({
  openingId: z.string().min(1, 'Selecciona una apertura de caja'),
  type: z.enum(['INGRESO', 'EGRESO']),
  amount: z.number().min(0.01, 'El monto debe ser mayor a 0'),
  concept: z.string().min(1, 'El concepto es obligatorio'),
  reference: z.string().optional(),
  observations: z.string().optional(),
})

type OpenCashDrawerFormValues = z.infer<typeof openCashDrawerSchema>
type CreateCashMovementFormValues = z.infer<typeof createCashMovementSchema>

export function CajaPage() {
  const { logout, session } = useAuth()
  const accessToken = session?.accessToken ?? ''
  const [dashboard, setDashboard] = useState<CashierDashboardResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSummary, setShowSummary] = useState(true)

  // Dialog state
  const [openDrawerDialogOpen, setOpenDrawerDialogOpen] = useState(false)
  const [createMovementDialogOpen, setCreateMovementDialogOpen] = useState(false)
  const [closeConfirmDialogOpen, setCloseConfirmDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedDrawerId, setSelectedDrawerId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<
    'resumen' | 'turno' | 'movimientos' | 'conciliacion' | 'historial'
  >('resumen')

  const [reconciliationPreview, setReconciliationPreview] =
    useState<CashReconciliationPreviewResponse | null>(null)
  const [reconciliationCounted, setReconciliationCounted] = useState<Record<string, number>>({})
  const [reconciliationObservations, setReconciliationObservations] = useState('')
  const [isReconciliationLoading, setIsReconciliationLoading] = useState(false)
  const [reconciliationError, setReconciliationError] = useState<string | null>(null)

  // Forms
  const openDrawerForm = useForm<OpenCashDrawerFormValues>({
    resolver: zodResolver(openCashDrawerSchema),
    defaultValues: {
      branchId: '',
      openingAmount: 0,
      observations: '',
    },
  })

  const createMovementForm = useForm<CreateCashMovementFormValues>({
    resolver: zodResolver(createCashMovementSchema),
    defaultValues: {
      openingId: '',
      type: 'INGRESO',
      amount: 0,
      concept: '',
      reference: '',
      observations: '',
    },
  })

  const handleUnauthorized = useCallback(async () => {
    toast.error('Tu sesión ya no es válida. Ingresa nuevamente para continuar.')
    await logout()
  }, [logout])

  const loadDashboard = useCallback(async () => {
    if (!accessToken) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await cashierService.getDashboard(accessToken)
      setDashboard(response)
      
      // Set default openingId in forms
      const activeDrawer = response.cashDrawers.find((d) => d.status !== 'CERRADA')
      if (activeDrawer) {
        createMovementForm.setValue('openingId', activeDrawer.id)
        setSelectedDrawerId((current) => current ?? activeDrawer.id)
      } else {
        setSelectedDrawerId(null)
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await handleUnauthorized()
        return
      }

      if (err instanceof ApiError || err instanceof ApiNetworkError) {
        setError(err.message)
        return
      }

      setError(err instanceof Error ? err.message : 'Error al cargar el dashboard')
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, createMovementForm, handleUnauthorized])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  // Handlers
  const handleOpenDrawer = async (values: OpenCashDrawerFormValues) => {
    if (!accessToken) return
    
    setIsSubmitting(true)
    try {
      await cashierService.openDrawer(accessToken, values as OpenCashDrawerPayload)
      toast.success('Caja abierta exitosamente.')
      setOpenDrawerDialogOpen(false)
      openDrawerForm.reset()
      await loadDashboard()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await handleUnauthorized()
        return
      }

      toast.error(err instanceof Error ? err.message : 'Error al abrir la caja.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateMovement = async (values: CreateCashMovementFormValues) => {
    if (!accessToken) return
    
    setIsSubmitting(true)
    try {
      await cashierService.createMovement(accessToken, values as CreateCashMovementPayload)
      toast.success('Movimiento creado exitosamente.')
      setCreateMovementDialogOpen(false)
      createMovementForm.reset({
        ...createMovementForm.getValues(),
        amount: 0,
        concept: '',
        reference: '',
        observations: '',
      })
      await loadDashboard()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await handleUnauthorized()
        return
      }

      toast.error(err instanceof Error ? err.message : 'Error al crear el movimiento.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const loadReconciliationPreview = useCallback(
    async (openingId: string) => {
      if (!accessToken) return

      setIsReconciliationLoading(true)
      setReconciliationError(null)
      try {
        const response = await cashierService.getReconciliationPreview(accessToken, openingId)
        setReconciliationPreview(response)
        setReconciliationObservations(response.lastSaved?.observations ?? '')
        const counted = Object.fromEntries(
          response.rows.map((row) => [row.paymentMethodId, row.countedAmount]),
        )
        setReconciliationCounted(counted)
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          await handleUnauthorized()
          return
        }

        setReconciliationError(err instanceof Error ? err.message : 'Error al cargar conciliación.')
        setReconciliationPreview(null)
      } finally {
        setIsReconciliationLoading(false)
      }
    },
    [accessToken, handleUnauthorized],
  )

  useEffect(() => {
    if (!selectedDrawerId) {
      return
    }

    if (reconciliationPreview?.opening.id === selectedDrawerId) {
      return
    }

    void loadReconciliationPreview(selectedDrawerId)
  }, [loadReconciliationPreview, reconciliationPreview?.opening.id, selectedDrawerId])

  const handleSelectDrawer = useCallback(
    async (openingId: string) => {
      setSelectedDrawerId(openingId)
      setDetailTab('resumen')
      setReconciliationPreview(null)
      setReconciliationCounted({})
      setReconciliationObservations('')
      setReconciliationError(null)
      await loadReconciliationPreview(openingId)
    },
    [loadReconciliationPreview],
  )

  const reconciliationTotals = useMemo(() => {
    const rows = reconciliationPreview?.rows ?? []
    const expectedAmount = rows.reduce((sum, row) => sum + row.expectedAmount, 0)
    const countedAmount = rows.reduce(
      (sum, row) => sum + (reconciliationCounted[row.paymentMethodId] ?? row.countedAmount),
      0,
    )
    const differenceAmount = countedAmount - expectedAmount
    return {
      expectedAmount,
      countedAmount,
      differenceAmount,
    }
  }, [reconciliationCounted, reconciliationPreview?.rows])

  const handleSaveReconciliation = useCallback(async () => {
    if (!accessToken || !selectedDrawerId) return

    if (reconciliationTotals.differenceAmount !== 0 && reconciliationObservations.trim().length === 0) {
      toast.error('Debes registrar observaciones cuando exista diferencia.')
      return
    }

    setIsSubmitting(true)
    try {
      const payload: SaveCashReconciliationPayload = {
        openingId: selectedDrawerId,
        counted: reconciliationCounted,
        observations: reconciliationObservations.trim() || undefined,
      }

      await cashierService.saveReconciliation(accessToken, payload)
      toast.success('Conciliación guardada correctamente.')
      await loadReconciliationPreview(selectedDrawerId)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await handleUnauthorized()
        return
      }

      toast.error(err instanceof Error ? err.message : 'Error al guardar conciliación.')
    } finally {
      setIsSubmitting(false)
    }
  }, [
    accessToken,
    handleUnauthorized,
    loadReconciliationPreview,
    reconciliationCounted,
    reconciliationObservations,
    reconciliationTotals.differenceAmount,
    selectedDrawerId,
  ])

  const handleConfirmCloseDrawer = useCallback(async () => {
    if (!accessToken || !selectedDrawerId || !reconciliationPreview) return

    const efectivoRow = reconciliationPreview.rows.find((row) => row.code === 'EFECTIVO')
    const efectivoCounted =
      efectivoRow ? reconciliationCounted[efectivoRow.paymentMethodId] ?? efectivoRow.countedAmount : 0

    setIsSubmitting(true)
    try {
      await cashierService.closeDrawer(accessToken, {
        openingId: selectedDrawerId,
        countedAmount: efectivoCounted,
      })
      toast.success('Turno cerrado correctamente.')
      setCloseConfirmDialogOpen(false)
      await loadDashboard()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await handleUnauthorized()
        return
      }

      toast.error(err instanceof Error ? err.message : 'Error al cerrar el turno.')
    } finally {
      setIsSubmitting(false)
    }
  }, [
    accessToken,
    handleUnauthorized,
    loadDashboard,
    reconciliationCounted,
    reconciliationPreview,
    selectedDrawerId,
  ])

  const cashDrawers = dashboard?.cashDrawers ?? []
  const cashMovements = dashboard?.cashMovements ?? []
  const dashboardTotals = dashboard?.dashboardTotals ?? {
    totalSales: 0,
    totalInternalMovements: 0,
    pendingCollections: 0,
  }
  const branches = dashboard?.options?.branches ?? []
  const activeDrawer = cashDrawers.find((drawer) => drawer.status !== 'CERRADA') ?? cashDrawers[0]
  const hasOpenDrawer = cashDrawers.some((drawer) => drawer.status !== 'CERRADA')
  const selectedDrawer = selectedDrawerId
    ? cashDrawers.find((drawer) => drawer.id === selectedDrawerId) ?? null
    : null
  const selectedMovements = selectedDrawerId
    ? cashMovements.filter((movement) => movement.openingId === selectedDrawerId)
    : []
  const canOperateSelected = selectedDrawer?.status === 'ABIERTA'

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader className="h-10 w-10" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="font-medium text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-foreground">Caja</h1>
        <Button variant="ghost" size="sm" onClick={() => setShowSummary(!showSummary)}>
          Resumen
          <ChevronDown
            className={`ml-1 h-4 w-4 transition-transform ${
              showSummary ? 'rotate-180' : ''
            }`}
          />
        </Button>
      </div>

      {/* KPIs Section (Collapsible on Mobile) */}
      {showSummary && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <WalletCards className="h-4 w-4 text-primary" />
            <div className="flex flex-col">
              <p className="text-lg font-bold text-foreground">{activeDrawer?.code ?? '-'}</p>
              <p className="text-xs text-muted-foreground">Caja</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <HandCoins className="h-4 w-4 text-success" />
            <div className="flex flex-col">
              <p className="text-lg font-bold text-foreground">{formatCurrency(dashboardTotals.totalSales)}</p>
              <p className="text-xs text-muted-foreground">Ventas</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <BadgeDollarSign className="h-4 w-4 text-info" />
            <div className="flex flex-col">
              <p className="text-lg font-bold text-foreground">{formatCurrency(dashboardTotals.totalInternalMovements)}</p>
              <p className="text-xs text-muted-foreground">Movimientos</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <CircleDollarSign className="h-4 w-4 text-warning" />
            <div className="flex flex-col">
              <p className="text-lg font-bold text-foreground">{formatCurrency(dashboardTotals.pendingCollections)}</p>
              <p className="text-xs text-muted-foreground">Pendiente</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={hasOpenDrawer}
            onClick={() => setOpenDrawerDialogOpen(true)}
          >
            <HandCoins className="mr-1 h-4 w-4" />
            Abrir caja
          </Button>
        </div>

        <div className="md:hidden space-y-3">
          {cashDrawers.map((drawer) => (
            <button
              key={drawer.id}
              type="button"
              className="w-full text-left"
              onClick={() => void handleSelectDrawer(drawer.id)}
            >
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{drawer.code}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{drawer.branchName}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      fondo {formatCurrency(drawer.openingAmount)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={getDrawerStatusVariant(drawer.status)}>{drawer.status}</Badge>
                    <p className="text-sm font-medium text-foreground">
                      {formatCurrency(drawer.expectedAmount)}
                    </p>
                  </div>
                </div>
              </Card>
            </button>
          ))}
        </div>

        <div className="hidden md:block">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Caja</TableHead>
                    <TableHead className="hidden lg:table-cell">Sucursal</TableHead>
                    <TableHead className="hidden lg:table-cell">Responsable</TableHead>
                    <TableHead className="hidden md:table-cell">Apertura</TableHead>
                    <TableHead>Esperado</TableHead>
                    <TableHead className="hidden md:table-cell">Contado</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashDrawers.map((drawer) => (
                    <TableRow
                      key={drawer.id}
                      className="cursor-pointer"
                      onClick={() => void handleSelectDrawer(drawer.id)}
                    >
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{drawer.code}</p>
                          <p className="text-xs text-muted-foreground">
                            fondo {formatCurrency(drawer.openingAmount)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {drawer.branchName}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {drawer.cashierName}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {drawer.openedAt}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {formatCurrency(drawer.expectedAmount)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">
                            {formatCurrency(drawer.countedAmount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            dif. {formatCurrency(drawer.differenceAmount)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getDrawerStatusVariant(drawer.status)}>{drawer.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {selectedDrawer ? (
        <Card className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => {
                  setSelectedDrawerId(null)
                  setReconciliationPreview(null)
                  setReconciliationCounted({})
                  setReconciliationObservations('')
                  setReconciliationError(null)
                }}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-foreground">{selectedDrawer.code}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedDrawer.branchName} · {selectedDrawer.cashierName}
                </p>
              </div>
            </div>
            <Badge variant={getDrawerStatusVariant(selectedDrawer.status)}>{selectedDrawer.status}</Badge>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {canOperateSelected ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    createMovementForm.setValue('openingId', selectedDrawer.id)
                    createMovementForm.setValue('type', 'INGRESO')
                    setCreateMovementDialogOpen(true)
                  }}
                >
                  Registrar ingreso
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    createMovementForm.setValue('openingId', selectedDrawer.id)
                    createMovementForm.setValue('type', 'EGRESO')
                    setCreateMovementDialogOpen(true)
                  }}
                >
                  Registrar egreso
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => toast.message('Arqueo en desarrollo.')}
                >
                  <ClipboardCheck className="mr-1 h-4 w-4" />
                  Realizar arqueo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setDetailTab('movimientos')}
                >
                  Ver movimientos
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setDetailTab('conciliacion')}
                >
                  Iniciar conciliación
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    !reconciliationPreview?.lastSaved ||
                    (reconciliationTotals.differenceAmount !== 0 &&
                      reconciliationObservations.trim().length === 0)
                  }
                  onClick={() => setCloseConfirmDialogOpen(true)}
                >
                  Cerrar turno
                </Button>
              </>
            ) : (
              <>
                <Button type="button" size="sm" variant="outline" onClick={() => setDetailTab('resumen')}>
                  Ver detalle
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setDetailTab('historial')}>
                  Ver historial
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => toast.message('Impresión en desarrollo.')}>
                  <Printer className="mr-1 h-4 w-4" />
                  Imprimir reporte
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => toast.message('Exportación en desarrollo.')}>
                  <FileDown className="mr-1 h-4 w-4" />
                  Exportar PDF
                </Button>
              </>
            )}
          </div>

          <Tabs value={detailTab} onValueChange={(value) => setDetailTab(value as any)} className="mt-6">
            <TabsList className="grid w-full grid-cols-2 sm:w-fit sm:grid-cols-5">
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="turno">Turno</TabsTrigger>
              <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
              <TabsTrigger value="conciliacion">Conciliación</TabsTrigger>
              <TabsTrigger value="historial">Historial</TabsTrigger>
            </TabsList>

            <TabsContent value="resumen" className="space-y-4 pt-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border p-4">
                  <p className="text-xs text-muted-foreground">Esperado</p>
                  <p className="mt-2 text-xl font-bold text-foreground">
                    {formatCurrency(reconciliationTotals.expectedAmount || selectedDrawer.expectedAmount)}
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="text-xs text-muted-foreground">Contado</p>
                  <p className="mt-2 text-xl font-bold text-foreground">
                    {formatCurrency(reconciliationTotals.countedAmount || selectedDrawer.countedAmount)}
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="text-xs text-muted-foreground">Diferencia</p>
                  <p className="mt-2 text-xl font-bold text-foreground">
                    {formatCurrency(reconciliationTotals.differenceAmount || selectedDrawer.differenceAmount)}
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="turno" className="space-y-4 pt-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border p-4">
                  <p className="text-xs text-muted-foreground">Sucursal</p>
                  <p className="mt-1 font-medium text-foreground">{selectedDrawer.branchName}</p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="text-xs text-muted-foreground">Responsable</p>
                  <p className="mt-1 font-medium text-foreground">{selectedDrawer.cashierName}</p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="text-xs text-muted-foreground">Apertura</p>
                  <p className="mt-1 font-medium text-foreground">{selectedDrawer.openedAt ?? '—'}</p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="text-xs text-muted-foreground">Fondo inicial</p>
                  <p className="mt-1 font-medium text-foreground">
                    {formatCurrency(selectedDrawer.openingAmount)}
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="movimientos" className="space-y-4 pt-4">
              {selectedMovements.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center">
                  <p className="text-sm font-medium text-foreground">No hay movimientos registrados</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Los cobros de ventas y movimientos manuales aparecerán aquí
                  </p>
                </div>
              ) : (
                <>
                  <div className="md:hidden space-y-3">
                    {selectedMovements.map((movement) => (
                      <Card key={movement.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-foreground">{movement.description}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{movement.createdAt}</p>
                            <p className="mt-2 text-xs text-muted-foreground">{movement.actorName}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant={getMovementVariant(movement.type)}>{movement.type}</Badge>
                            <p className="font-medium text-foreground">{formatCurrency(movement.amount)}</p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Detalle</TableHead>
                          <TableHead className="hidden md:table-cell">Referencia</TableHead>
                          <TableHead className="hidden lg:table-cell">Medio</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedMovements.map((movement) => (
                          <TableRow key={movement.id}>
                            <TableCell className="text-muted-foreground">{movement.createdAt}</TableCell>
                            <TableCell>
                              <Badge variant={getMovementVariant(movement.type)}>{movement.type}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium text-foreground">{movement.description}</p>
                                <p className="text-xs text-muted-foreground">{movement.actorName}</p>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">
                              {movement.reference}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <Badge variant={movement.paymentMethod === 'INTERNO' ? 'outline' : 'info'}>
                                {movement.paymentMethod}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium text-foreground">
                              {formatCurrency(movement.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="conciliacion" className="space-y-4 pt-4">
              {isReconciliationLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader className="h-8 w-8" />
                </div>
              ) : reconciliationError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  {reconciliationError}
                </div>
              ) : reconciliationPreview ? (
                <>
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Medio</TableHead>
                            <TableHead>Esperado</TableHead>
                            <TableHead>Contado</TableHead>
                            <TableHead>Diferencia</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reconciliationPreview.rows.map((row) => {
                            const countedAmount = reconciliationCounted[row.paymentMethodId] ?? row.countedAmount
                            const difference = countedAmount - row.expectedAmount
                            return (
                              <TableRow key={row.paymentMethodId}>
                                <TableCell>
                                  <div className="space-y-1">
                                    <Badge variant="outline">{row.code}</Badge>
                                    <p className="text-xs text-muted-foreground">{row.name}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium text-foreground">
                                  {formatCurrency(row.expectedAmount)}
                                </TableCell>
                                <TableCell className="w-[160px]">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={countedAmount}
                                    onChange={(event) =>
                                      setReconciliationCounted((current) => ({
                                        ...current,
                                        [row.paymentMethodId]: Number(event.target.value || 0),
                                      }))
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Badge variant={difference === 0 ? 'success' : 'warning'}>
                                    {formatCurrency(difference)}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border p-4">
                      <p className="text-xs text-muted-foreground">Total esperado</p>
                      <p className="mt-2 text-xl font-bold text-foreground">
                        {formatCurrency(reconciliationTotals.expectedAmount)}
                      </p>
                    </div>
                    <div className="rounded-2xl border p-4">
                      <p className="text-xs text-muted-foreground">Total contado</p>
                      <p className="mt-2 text-xl font-bold text-foreground">
                        {formatCurrency(reconciliationTotals.countedAmount)}
                      </p>
                    </div>
                    <div className="rounded-2xl border p-4">
                      <p className="text-xs text-muted-foreground">Diferencia</p>
                      <p className="mt-2 text-xl font-bold text-foreground">
                        {formatCurrency(reconciliationTotals.differenceAmount)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {reconciliationTotals.differenceAmount === 0
                          ? 'Caja conciliada correctamente.'
                          : 'Existen diferencias en el cierre.'}
                      </p>
                    </div>
                  </div>

                  {reconciliationTotals.differenceAmount !== 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-foreground">Observaciones del cajero</p>
                      <Textarea
                        value={reconciliationObservations}
                        onChange={(event) => setReconciliationObservations(event.target.value)}
                        placeholder="Explica la diferencia encontrada (obligatorio)."
                      />
                      {reconciliationObservations.trim().length === 0 ? (
                        <p className="text-xs text-destructive">
                          Las observaciones son obligatorias cuando existe diferencia.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={handleSaveReconciliation}
                      disabled={isSubmitting}
                    >
                      Guardar conciliación
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void loadReconciliationPreview(selectedDrawer.id)}
                      disabled={isSubmitting}
                    >
                      Actualizar
                    </Button>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed p-8 text-center">
                  <p className="text-sm text-muted-foreground">Selecciona una caja para conciliar.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="historial" className="space-y-4 pt-4">
              {reconciliationPreview?.history?.length ? (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Esperado</TableHead>
                          <TableHead>Contado</TableHead>
                          <TableHead>Diferencia</TableHead>
                          <TableHead className="hidden md:table-cell">Usuario</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reconciliationPreview.history.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="text-muted-foreground">{entry.createdAt}</TableCell>
                            <TableCell className="font-medium text-foreground">
                              {formatCurrency(entry.expectedAmount)}
                            </TableCell>
                            <TableCell className="font-medium text-foreground">
                              {formatCurrency(entry.countedAmount)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={entry.differenceAmount === 0 ? 'success' : 'warning'}>
                                {formatCurrency(entry.differenceAmount)}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">
                              {entry.actorName}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ) : (
                <div className="rounded-2xl border border-dashed p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    Aún no hay conciliaciones registradas para este turno.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>
      ) : null}

      {/* Dialogs */}

      {/* Open Cash Drawer Dialog */}
      <Dialog open={openDrawerDialogOpen} onOpenChange={setOpenDrawerDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Registrar fondo (Apertura de caja)</DialogTitle>
            <DialogDescription>
              Registra el monto de apertura para una caja.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={openDrawerForm.handleSubmit(handleOpenDrawer)} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="branchId"
                className="text-xs font-medium text-foreground"
              >
                Sucursal
              </label>
              <Select
                onValueChange={(value) => openDrawerForm.setValue('branchId', value)}
                defaultValue={openDrawerForm.getValues('branchId')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una sucursal" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {openDrawerForm.formState.errors.branchId ? (
                <p className="text-xs text-destructive">
                  {openDrawerForm.formState.errors.branchId.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="openingAmount"
                className="text-xs font-medium text-foreground"
              >
                Monto de apertura
              </label>
              <Input
                id="openingAmount"
                type="number"
                step="0.01"
                {...openDrawerForm.register('openingAmount', {
                  valueAsNumber: true,
                })}
              />
              {openDrawerForm.formState.errors.openingAmount ? (
                <p className="text-xs text-destructive">
                  {openDrawerForm.formState.errors.openingAmount.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="observations"
                className="text-xs font-medium text-foreground"
              >
                Observaciones (opcional)
              </label>
              <Textarea
                id="observations"
                placeholder="Agrega observaciones si es necesario..."
                {...openDrawerForm.register('observations')}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpenDrawerDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} size="sm">
                {isSubmitting ? (
                  <>
                    <Loader className="h-4 w-4 text-current mr-2" />
                    Guardando...
                  </>
                ) : (
                  'Abrir caja'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={closeConfirmDialogOpen} onOpenChange={setCloseConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cerrar turno</DialogTitle>
            <DialogDescription>
              Confirma el cierre del turno. La conciliación debe estar registrada antes de cerrar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded-lg border bg-muted/20 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total esperado</span>
              <span className="font-medium text-foreground">
                {formatCurrency(reconciliationTotals.expectedAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total contado</span>
              <span className="font-medium text-foreground">
                {formatCurrency(reconciliationTotals.countedAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Diferencia</span>
              <span className="font-medium text-foreground">
                {formatCurrency(reconciliationTotals.differenceAmount)}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCloseConfirmDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleConfirmCloseDrawer} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader className="h-4 w-4 text-current" />
                  Cerrando...
                </>
              ) : (
                'Cerrar turno'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Cash Movement Dialog */}
      <Dialog open={createMovementDialogOpen} onOpenChange={setCreateMovementDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Movimiento manual de caja</DialogTitle>
            <DialogDescription>
              Registra un ingreso o egreso manual en la caja.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createMovementForm.handleSubmit(handleCreateMovement)} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="openingId"
                className="text-xs font-medium text-foreground"
              >
                Apertura de caja
              </label>
              <Select
                onValueChange={(value) => createMovementForm.setValue('openingId', value)}
                value={createMovementForm.getValues('openingId')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una apertura de caja" />
                </SelectTrigger>
                <SelectContent>
                  {cashDrawers
                    .filter((d) => d.status !== 'CERRADA')
                    .map((drawer) => (
                      <SelectItem key={drawer.id} value={drawer.id}>
                        {drawer.code} - {drawer.branchName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {createMovementForm.formState.errors.openingId ? (
                <p className="text-xs text-destructive">
                  {createMovementForm.formState.errors.openingId.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="type"
                className="text-xs font-medium text-foreground"
              >
                Tipo de movimiento
              </label>
              <Select
                onValueChange={(value) => createMovementForm.setValue('type', value as 'INGRESO' | 'EGRESO')}
                value={createMovementForm.getValues('type')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INGRESO">Ingreso</SelectItem>
                  <SelectItem value="EGRESO">Egreso</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="amount"
                className="text-xs font-medium text-foreground"
              >
                Monto
              </label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                {...createMovementForm.register('amount', {
                  valueAsNumber: true,
                })}
              />
              {createMovementForm.formState.errors.amount ? (
                <p className="text-xs text-destructive">
                  {createMovementForm.formState.errors.amount.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="concept"
                className="text-xs font-medium text-foreground"
              >
                Concepto
              </label>
              <Input
                id="concept"
                placeholder="Ej: Pago de servicios, gasto de papelería..."
                {...createMovementForm.register('concept')}
              />
              {createMovementForm.formState.errors.concept ? (
                <p className="text-xs text-destructive">
                  {createMovementForm.formState.errors.concept.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="reference"
                className="text-xs font-medium text-foreground"
              >
                Referencia (opcional)
              </label>
              <Input
                id="reference"
                placeholder="Número de factura o referencia..."
                {...createMovementForm.register('reference')}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="observations"
                className="text-xs font-medium text-foreground"
              >
                Observaciones (opcional)
              </label>
              <Textarea
                id="observations"
                placeholder="Agrega observaciones si es necesario..."
                {...createMovementForm.register('observations')}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateMovementDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} size="sm">
                {isSubmitting ? (
                  <>
                    <Loader className="h-4 w-4 text-current mr-2" />
                    Guardando...
                  </>
                ) : (
                  'Registrar movimiento'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
