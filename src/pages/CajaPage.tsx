import {
  ArrowLeft,
  BadgeDollarSign,
  CircleDollarSign,
  ClipboardCheck,
  FileDown,
  HandCoins,
  Printer,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardContent,
  CardHeader,
  CardTitle,
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
import { SidePanel, SidePanelClose, SidePanelContent } from '@/components/ui/side-panel'
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
import { paths } from '@/routes/paths'
import type {
  CashDrawerStatus,
  CashMovementType,
  CashierDashboardResponse,
  CashCountsResponse,
  CashReconciliationPreviewResponse,
  CreateCashCountPayload,
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

function formatDateTimeDisplay(value: string | null | undefined) {
  if (!value) {
    return { date: '—', time: '' }
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return { date: value, time: '' }
  }

  return {
    date: new Intl.DateTimeFormat('es-PE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date),
    time: new Intl.DateTimeFormat('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date),
  }
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

const cashCountSchema = z.object({
  openingId: z.string().min(1, 'Selecciona una apertura de caja'),
  countedCashAmount: z.number().min(0, 'El monto debe ser mayor o igual a 0'),
  observations: z.string().optional(),
})

type OpenCashDrawerFormValues = z.infer<typeof openCashDrawerSchema>
type CreateCashMovementFormValues = z.infer<typeof createCashMovementSchema>
type CashCountFormValues = z.infer<typeof cashCountSchema>

export function CajaPage() {
  const { logout, session } = useAuth()
  const navigate = useNavigate()
  const accessToken = session?.accessToken ?? ''
  const [dashboard, setDashboard] = useState<CashierDashboardResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cashDrawersPage, setCashDrawersPage] = useState(1)
  const cashDrawersPageSize = 4

  // Dialog state
  const [openDrawerDialogOpen, setOpenDrawerDialogOpen] = useState(false)
  const [createMovementDialogOpen, setCreateMovementDialogOpen] = useState(false)
  const [cashCountDialogOpen, setCashCountDialogOpen] = useState(false)
  const [closeConfirmDialogOpen, setCloseConfirmDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedDrawerId, setSelectedDrawerId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<
    'resumen' | 'movimientos' | 'conciliacion' | 'historial'
  >('resumen')

  const [reconciliationPreview, setReconciliationPreview] =
    useState<CashReconciliationPreviewResponse | null>(null)
  const [reconciliationCounted, setReconciliationCounted] = useState<Record<string, number>>({})
  const [reconciliationObservations, setReconciliationObservations] = useState('')
  const [isReconciliationLoading, setIsReconciliationLoading] = useState(false)
  const [reconciliationError, setReconciliationError] = useState<string | null>(null)

  const [cashCounts, setCashCounts] = useState<CashCountsResponse | null>(null)
  const [isCashCountsLoading, setIsCashCountsLoading] = useState(false)
  const [cashCountsError, setCashCountsError] = useState<string | null>(null)

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

  const cashCountForm = useForm<CashCountFormValues>({
    resolver: zodResolver(cashCountSchema),
    defaultValues: {
      openingId: '',
      countedCashAmount: 0,
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

      if (window.sessionStorage.getItem('pos_pending_purchase_payment')) {
        navigate(paths.compras)
      }
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

  const handleCreateCashCount = async (values: CashCountFormValues) => {
    if (!accessToken) return

    setIsSubmitting(true)
    try {
      await cashierService.createCashCount(accessToken, values as CreateCashCountPayload)
      toast.success('Arqueo registrado correctamente.')
      setCashCountDialogOpen(false)
      cashCountForm.reset({
        openingId: values.openingId,
        countedCashAmount: 0,
        observations: '',
      })
      await Promise.all([loadDashboard(), loadCashCounts(values.openingId)])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await handleUnauthorized()
        return
      }

      toast.error(err instanceof Error ? err.message : 'Error al registrar el arqueo.')
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

  const loadCashCounts = useCallback(
    async (openingId: string) => {
      if (!accessToken) return

      setIsCashCountsLoading(true)
      setCashCountsError(null)
      try {
        const response = await cashierService.getCashCounts(accessToken, openingId)
        setCashCounts(response)
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          await handleUnauthorized()
          return
        }

        setCashCounts(null)
        setCashCountsError(err instanceof Error ? err.message : 'Error al cargar arqueos.')
      } finally {
        setIsCashCountsLoading(false)
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
    void loadCashCounts(selectedDrawerId)
  }, [
    loadCashCounts,
    loadReconciliationPreview,
    reconciliationPreview?.opening.id,
    selectedDrawerId,
  ])

  const handleSelectDrawer = useCallback(
    async (openingId: string) => {
      setSelectedDrawerId(openingId)
      setDetailTab('resumen')
      setReconciliationPreview(null)
      setReconciliationCounted({})
      setReconciliationObservations('')
      setReconciliationError(null)
      setCashCounts(null)
      setCashCountsError(null)
      await Promise.all([loadReconciliationPreview(openingId), loadCashCounts(openingId)])
    },
    [loadCashCounts, loadReconciliationPreview],
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

  const digitalReconciliation = useMemo(() => {
    const rows = (reconciliationPreview?.rows ?? []).filter((row) => row.code !== 'EFECTIVO')
    const expectedAmount = rows.reduce((sum, row) => sum + row.expectedAmount, 0)
    const countedAmount = rows.reduce(
      (sum, row) => sum + (reconciliationCounted[row.paymentMethodId] ?? row.countedAmount),
      0,
    )
    const differenceAmount = countedAmount - expectedAmount

    return {
      rows,
      totals: {
        expectedAmount,
        countedAmount,
        differenceAmount,
      },
    }
  }, [reconciliationCounted, reconciliationPreview?.rows])

  const handleSaveReconciliation = useCallback(async () => {
    if (!accessToken || !selectedDrawerId) return

    if (digitalReconciliation.totals.differenceAmount !== 0 && reconciliationObservations.trim().length === 0) {
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
    digitalReconciliation.totals.differenceAmount,
    handleUnauthorized,
    loadReconciliationPreview,
    reconciliationCounted,
    reconciliationObservations,
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
  const summaryDrawer = selectedDrawer ?? activeDrawer ?? null
  const summaryMovements = summaryDrawer
    ? cashMovements.filter((movement) => movement.openingId === summaryDrawer.id)
    : []
  const cashSummaryMovements = summaryMovements.filter(
    (movement) =>
      (movement.paymentMethod === 'EFECTIVO' || movement.paymentMethod === 'INTERNO') &&
      movement.type !== 'CUADRE' &&
      movement.description !== 'Apertura de caja',
  )
  const summaryEntriesAmount = cashSummaryMovements.reduce(
    (sum, movement) => sum + (movement.amount > 0 ? movement.amount : 0),
    0,
  )
  const summaryExitsAmount = cashSummaryMovements.reduce(
    (sum, movement) => sum + (movement.amount < 0 ? Math.abs(movement.amount) : 0),
    0,
  )
  const summaryExpectedCashAmount =
    (summaryDrawer?.openingAmount ?? 0) + summaryEntriesAmount - summaryExitsAmount
  const latestCashCount = cashCounts?.rows?.[0] ?? null
  const expectedCashAmountForCount =
    reconciliationPreview?.rows.find((row) => row.code === 'EFECTIVO')?.expectedAmount ?? 0
  const watchedCountedCashAmount = cashCountForm.watch('countedCashAmount')
  const watchedCashCountObservations = cashCountForm.watch('observations')
  const cashCountDifferenceAmount = watchedCountedCashAmount - expectedCashAmountForCount
  const watchedMovementType = createMovementForm.watch('type')
  const isMovementIngreso = watchedMovementType === 'INGRESO'
  const cashDrawersTotalPages = Math.max(
    1,
    Math.ceil(cashDrawers.length / cashDrawersPageSize),
  )
  const safeCashDrawersPage = Math.min(cashDrawersPage, cashDrawersTotalPages)
  const cashDrawersPageStart = (safeCashDrawersPage - 1) * cashDrawersPageSize
  const visibleCashDrawers = cashDrawers.slice(
    cashDrawersPageStart,
    cashDrawersPageStart + cashDrawersPageSize,
  )

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
      </div>

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
          {visibleCashDrawers.map((drawer) => (
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
                  {visibleCashDrawers.map((drawer) => (
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
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">
                            {formatDateTimeDisplay(drawer.openedAt).date}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTimeDisplay(drawer.openedAt).time}
                          </p>
                        </div>
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

        {cashDrawers.length > cashDrawersPageSize ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/20 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Mostrando {cashDrawersPageStart + 1}-
              {Math.min(cashDrawersPageStart + cashDrawersPageSize, cashDrawers.length)} de{' '}
              {cashDrawers.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={safeCashDrawersPage <= 1}
                onClick={() => setCashDrawersPage((current) => Math.max(1, current - 1))}
              >
                Anterior
              </Button>
              <p className="text-xs text-muted-foreground">
                Página {safeCashDrawersPage} de {cashDrawersTotalPages}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={safeCashDrawersPage >= cashDrawersTotalPages}
                onClick={() =>
                  setCashDrawersPage((current) =>
                    Math.min(cashDrawersTotalPages, current + 1),
                  )
                }
              >
                Siguiente
              </Button>
            </div>
          </div>
        ) : null}
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
                  Registrar movimiento
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const expectedCashAmount =
                      reconciliationPreview?.rows.find((row) => row.code === 'EFECTIVO')?.expectedAmount ?? 0
                    cashCountForm.reset({
                      openingId: selectedDrawer.id,
                      countedCashAmount: expectedCashAmount,
                      observations: '',
                    })
                    setCashCountDialogOpen(true)
                  }}
                >
                  <ClipboardCheck className="mr-1 h-4 w-4" />
                  Realizar arqueo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setDetailTab('conciliacion')}
                >
                  Conciliación
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setDetailTab('movimientos')}
                >
                  Movimientos
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    !reconciliationPreview?.lastSaved ||
                    (digitalReconciliation.totals.differenceAmount !== 0 &&
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
            <TabsList className="grid w-full grid-cols-2 sm:w-fit sm:grid-cols-4">
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
              <TabsTrigger value="conciliacion">Conciliación</TabsTrigger>
              <TabsTrigger value="historial">Historial</TabsTrigger>
            </TabsList>

            <TabsContent value="resumen" className="space-y-4 pt-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Apertura</p>
                      <p className="mt-2 truncate text-2xl font-semibold text-foreground">
                        {formatCurrency(summaryDrawer?.openingAmount ?? 0)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {summaryDrawer?.code ?? '—'}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-2">
                      <HandCoins className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Movimientos</p>
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm text-muted-foreground">Entradas</p>
                          <p className="text-sm font-semibold text-emerald-600">
                            + {formatCurrency(summaryEntriesAmount)}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm text-muted-foreground">Salidas</p>
                          <p className="text-sm font-semibold text-rose-600">
                            - {formatCurrency(summaryExitsAmount)}
                          </p>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Incluye efectivo: ventas, ingresos manuales, egresos, retiros y devoluciones.
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-2">
                      <BadgeDollarSign className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Caja esperada</p>
                      <p className="mt-2 truncate text-2xl font-semibold text-foreground">
                        {formatCurrency(summaryExpectedCashAmount)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Apertura + Entradas - Salidas
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-2">
                      <CircleDollarSign className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Arqueo</p>
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm text-muted-foreground">Contado</p>
                          <p className="text-sm font-semibold text-foreground">
                            {latestCashCount
                              ? formatCurrency(latestCashCount.countedCashAmount)
                              : 'Pendiente'}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm text-muted-foreground">Diferencia</p>
                          <p className="text-sm font-semibold text-foreground">
                            {latestCashCount
                              ? formatCurrency(latestCashCount.differenceCashAmount)
                              : '--'}
                          </p>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {latestCashCount ? 'Arqueo registrado.' : 'Aún no se realizó arqueo.'}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-2">
                      <ClipboardCheck className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </Card>
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
                  <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                    Conciliación de pagos digitales (Yape, Plin, tarjeta, transferencias). El efectivo se controla en el
                    resumen y el arqueo.
                  </div>
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
                          {digitalReconciliation.rows.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4}>
                                <div className="p-6 text-center text-sm text-muted-foreground">
                                  No hay medios digitales para conciliar.
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            digitalReconciliation.rows.map((row) => {
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
                          })
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border p-4">
                      <p className="text-xs text-muted-foreground">Total esperado</p>
                      <p className="mt-2 text-xl font-bold text-foreground">
                        {formatCurrency(digitalReconciliation.totals.expectedAmount)}
                      </p>
                    </div>
                    <div className="rounded-2xl border p-4">
                      <p className="text-xs text-muted-foreground">Total contado</p>
                      <p className="mt-2 text-xl font-bold text-foreground">
                        {formatCurrency(digitalReconciliation.totals.countedAmount)}
                      </p>
                    </div>
                    <div className="rounded-2xl border p-4">
                      <p className="text-xs text-muted-foreground">Diferencia</p>
                      <p className="mt-2 text-xl font-bold text-foreground">
                        {formatCurrency(digitalReconciliation.totals.differenceAmount)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {digitalReconciliation.totals.differenceAmount === 0
                          ? 'Caja conciliada correctamente.'
                          : 'Existen diferencias en el cierre.'}
                      </p>
                    </div>
                  </div>

                  {digitalReconciliation.totals.differenceAmount !== 0 ? (
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
              <Card>
                <CardHeader>
                  <CardTitle>Arqueos (efectivo)</CardTitle>
                  <CardDescription>Conteos físicos registrados durante el turno.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isCashCountsLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader className="h-7 w-7" />
                    </div>
                  ) : cashCountsError ? (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                      {cashCountsError}
                    </div>
                  ) : cashCounts?.rows?.length ? (
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
                        {cashCounts.rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="text-muted-foreground">{row.createdAt}</TableCell>
                            <TableCell className="font-medium text-foreground">
                              {formatCurrency(row.expectedCashAmount)}
                            </TableCell>
                            <TableCell className="font-medium text-foreground">
                              {formatCurrency(row.countedCashAmount)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={row.differenceCashAmount === 0 ? 'success' : 'warning'}>
                                {formatCurrency(row.differenceCashAmount)}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">
                              {row.actorName}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="rounded-2xl border border-dashed p-8 text-center">
                      <p className="text-sm text-muted-foreground">Aún no hay arqueos registrados.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Conciliaciones</CardTitle>
                  <CardDescription>Conciliaciones guardadas por medio de pago.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {reconciliationPreview?.history?.length ? (
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
                  ) : (
                    <div className="rounded-2xl border border-dashed p-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        Aún no hay conciliaciones registradas para este turno.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
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

      <Dialog open={cashCountDialogOpen} onOpenChange={setCashCountDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Arqueo de efectivo</DialogTitle>
            <DialogDescription>
              Registra el conteo físico de efectivo durante el turno. No cierra la caja.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={cashCountForm.handleSubmit(handleCreateCashCount)} className="space-y-4">
            <input type="hidden" {...cashCountForm.register('openingId')} />
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Esperado</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(expectedCashAmountForCount)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Diferencia</span>
                <Badge variant={cashCountDifferenceAmount === 0 ? 'success' : 'warning'}>
                  {formatCurrency(cashCountDifferenceAmount)}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="countedCashAmount" className="text-xs font-medium text-foreground">
                Contado (efectivo)
              </label>
              <Input
                id="countedCashAmount"
                type="number"
                step="0.01"
                {...cashCountForm.register('countedCashAmount', { valueAsNumber: true })}
              />
              {cashCountForm.formState.errors.countedCashAmount ? (
                <p className="text-xs text-destructive">
                  {cashCountForm.formState.errors.countedCashAmount.message}
                </p>
              ) : null}
            </div>

            {cashCountDifferenceAmount !== 0 ? (
              <div className="space-y-2">
                <label htmlFor="cashCountObservations" className="text-xs font-medium text-foreground">
                  Observaciones del cajero (obligatorio)
                </label>
                <Textarea
                  id="cashCountObservations"
                  placeholder="Explica la diferencia encontrada."
                  {...cashCountForm.register('observations')}
                />
                {watchedCashCountObservations?.trim() ? null : (
                  <p className="text-xs text-destructive">
                    Las observaciones son obligatorias cuando existe diferencia.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label htmlFor="cashCountObservations" className="text-xs font-medium text-foreground">
                  Observaciones (opcional)
                </label>
                <Textarea
                  id="cashCountObservations"
                  placeholder="Agrega observaciones si es necesario."
                  {...cashCountForm.register('observations')}
                />
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCashCountDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader className="h-4 w-4 text-current" />
                    Guardando...
                  </>
                ) : (
                  'Registrar arqueo'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Cash Movement Dialog */}
      <SidePanel
        open={createMovementDialogOpen}
        onOpenChange={(open) => {
          setCreateMovementDialogOpen(open)
          if (!open) {
            createMovementForm.reset({
              ...createMovementForm.getValues(),
              amount: 0,
              concept: '',
              reference: '',
              observations: '',
            })
          }
        }}
      >
        <SidePanelContent className="p-0">
          <form
            onSubmit={createMovementForm.handleSubmit(handleCreateMovement)}
            className="flex h-full flex-col"
          >
            <div className="flex items-start justify-between gap-4 border-b bg-popover px-6 py-4">
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">Registrar movimiento</p>
                <p className="text-sm text-muted-foreground">
                  {isMovementIngreso ? 'Ingreso de efectivo en caja.' : 'Egreso de efectivo desde caja.'}
                </p>
              </div>
              <SidePanelClose asChild>
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Cerrar</span>
                </Button>
              </SidePanelClose>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="grid gap-4">
                <div className="rounded-2xl border p-4">
                  <p className="text-xs text-muted-foreground">Turno</p>
                  <p className="mt-1 font-medium text-foreground">{summaryDrawer?.code ?? '—'}</p>
                  {summaryDrawer?.branchName ? (
                    <p className="mt-1 text-xs text-muted-foreground">{summaryDrawer.branchName}</p>
                  ) : null}
                </div>

                <div className="rounded-2xl border p-4">
                  <p className="text-xs font-medium text-foreground">Tipo</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={isMovementIngreso ? 'primary' : 'outline'}
                      onClick={() =>
                        createMovementForm.setValue('type', 'INGRESO', {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                      className={isMovementIngreso ? 'bg-emerald-600 hover:bg-emerald-600/90' : undefined}
                    >
                      Ingreso
                    </Button>
                    <Button
                      type="button"
                      variant={!isMovementIngreso ? 'primary' : 'outline'}
                      onClick={() =>
                        createMovementForm.setValue('type', 'EGRESO', {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                      className={!isMovementIngreso ? 'bg-rose-600 hover:bg-rose-600/90' : undefined}
                    >
                      Egreso
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 rounded-2xl border p-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="amount" className="text-xs font-medium text-foreground">
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
                    <label htmlFor="reference" className="text-xs font-medium text-foreground">
                      Referencia (opcional)
                    </label>
                    <Input
                      id="reference"
                      placeholder="Número de factura o referencia..."
                      {...createMovementForm.register('reference')}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label htmlFor="concept" className="text-xs font-medium text-foreground">
                      Concepto
                    </label>
                    <Input
                      id="concept"
                      placeholder={
                        isMovementIngreso
                          ? 'Ej: Fondo adicional, ingreso por vuelto...'
                          : 'Ej: Pago de servicios, retiro, gasto de papelería...'
                      }
                      {...createMovementForm.register('concept')}
                    />
                    {createMovementForm.formState.errors.concept ? (
                      <p className="text-xs text-destructive">
                        {createMovementForm.formState.errors.concept.message}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label htmlFor="observations" className="text-xs font-medium text-foreground">
                      Observaciones (opcional)
                    </label>
                    <Textarea
                      id="observations"
                      placeholder="Agrega observaciones si es necesario..."
                      {...createMovementForm.register('observations')}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t bg-popover px-6 py-4">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateMovementDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader className="mr-2 h-4 w-4 text-current" />
                      Guardando...
                    </>
                  ) : (
                    'Registrar movimiento'
                  )}
                </Button>
              </div>
            </div>
          </form>
        </SidePanelContent>
      </SidePanel>
    </div>
  )
}
