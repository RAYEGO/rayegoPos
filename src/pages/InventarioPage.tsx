import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  AlertTriangle,
  ArrowRightLeft,
  Boxes,
  ChevronDown,
  History,
  Loader2,
  PackagePlus,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  TriangleAlert,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
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
import { inventoryService } from '@/services/inventoryService'
import type {
  AdjustInventoryLotPayload,
  CreateInventoryLotPayload,
  InventoryAdjustmentOperation,
  InventoryAdjustmentTarget,
  InventoryDashboardResponse,
  InventoryLotStatus,
  InventoryMovementType,
  TransferInventoryLotPayload,
} from '@/types/inventory'
import { toast } from 'sonner'

const createLotSchema = z
  .object({
    sucursalId: z.string().uuid({ message: 'Selecciona una sucursal.' }),
    productoId: z.string().uuid({ message: 'Selecciona un producto.' }),
    proveedorId: z.string().optional(),
    numeroLote: z.string().min(2, 'Ingresa un número de lote válido.').max(80),
    fechaFabricacion: z.string().optional(),
    fechaVencimiento: z.string().min(1, 'Selecciona la fecha de vencimiento.'),
    costoUnitario: z.number().nonnegative('El costo unitario no puede ser negativo.'),
    stockInicial: z.number().positive('El stock inicial debe ser mayor a 0.'),
    stockReservado: z.number().nonnegative('El stock reservado no puede ser negativo.'),
    stockBloqueado: z.number().nonnegative('El stock bloqueado no puede ser negativo.'),
    almacen: z.string().max(120).optional(),
    observaciones: z.string().max(255).optional(),
  })
  .superRefine((values, context) => {
    if (values.stockReservado + values.stockBloqueado > values.stockInicial) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stockReservado'],
        message: 'Reservado + bloqueado no puede superar el stock inicial.',
      })
    }

    if (
      values.fechaFabricacion &&
      values.fechaVencimiento &&
      values.fechaFabricacion > values.fechaVencimiento
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fechaFabricacion'],
        message: 'La fecha de fabricación no puede ser posterior al vencimiento.',
      })
    }
  })

const adjustLotSchema = z.object({
  lotId: z.string().uuid({ message: 'Selecciona un lote.' }),
  target: z.enum(['DISPONIBLE', 'RESERVADO', 'BLOQUEADO']),
  operation: z.enum(['SUMAR', 'RESTAR']),
  quantity: z.number().positive('Ingresa una cantidad mayor a 0.'),
  observaciones: z.string().max(255).optional(),
})

const transferLotSchema = z.object({
  lotId: z.string().uuid({ message: 'Selecciona un lote.' }),
  destinationBranchId: z.string().uuid({ message: 'Selecciona una sucursal destino.' }),
  quantity: z.number().positive('Ingresa una cantidad mayor a 0.'),
  destinationWarehouse: z.string().max(120).optional(),
  observaciones: z.string().max(255).optional(),
})

type CreateLotFormValues = z.infer<typeof createLotSchema>
type AdjustLotFormValues = z.infer<typeof adjustLotSchema>
type TransferLotFormValues = z.infer<typeof transferLotSchema>
type InventoryLotView = InventoryDashboardResponse['lots'][number]

const defaultCreateFormValues: CreateLotFormValues = {
  sucursalId: '',
  productoId: '',
  proveedorId: '',
  numeroLote: '',
  fechaFabricacion: '',
  fechaVencimiento: '',
  costoUnitario: 0,
  stockInicial: 0,
  stockReservado: 0,
  stockBloqueado: 0,
  almacen: '',
  observaciones: '',
}

const defaultAdjustFormValues: AdjustLotFormValues = {
  lotId: '',
  target: 'DISPONIBLE',
  operation: 'RESTAR',
  quantity: 0,
  observaciones: '',
}

const defaultTransferFormValues: TransferLotFormValues = {
  lotId: '',
  destinationBranchId: '',
  quantity: 0,
  destinationWarehouse: '',
  observaciones: '',
}

const emptyDashboard: InventoryDashboardResponse = {
  summary: {
    totalAvailableUnits: 0,
    totalReservedUnits: 0,
    totalBlockedUnits: 0,
    expiringSoonCount: 0,
    branchCount: 0,
    lotCount: 0,
  },
  branchSummary: [],
  lots: [],
  movements: [],
  alerts: [],
  fifoCandidates: [],
  options: {
    branches: [],
    products: [],
    suppliers: [],
    warehouses: [],
  },
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Sin fecha'
  }

  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Sin fecha'
  }

  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getLotStatusVariant(status: InventoryLotStatus) {
  if (status === 'ACTIVO') return 'success'
  if (status === 'BLOQUEADO') return 'destructive'
  if (status === 'VENCIDO') return 'warning'
  return 'outline'
}

function getMovementVariant(type: InventoryMovementType) {
  if (type === 'ENTRADA') return 'success'
  if (type === 'RESERVA') return 'warning'
  if (type === 'AJUSTE') return 'destructive'
  if (type === 'TRANSFERENCIA') return 'info'
  if (type === 'LIBERACION') return 'info'
  return 'outline'
}

function getAlertVariant(type: InventoryDashboardResponse['alerts'][number]['alertType']) {
  if (type === 'BLOQUEADO') return 'destructive'
  if (type === 'VENCIDO') return 'warning'
  if (type === 'POR_VENCER') return 'warning'
  return 'outline'
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

function getAdjustmentPreview(
  lot: InventoryLotView | undefined,
  target: InventoryAdjustmentTarget,
  operation: InventoryAdjustmentOperation,
  quantity: number,
) {
  if (!lot) {
    return {
      availableUnits: 0,
      reservedUnits: 0,
      blockedUnits: 0,
    }
  }

  const preview = {
    availableUnits: lot.availableUnits,
    reservedUnits: lot.reservedUnits,
    blockedUnits: lot.blockedUnits,
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return preview
  }

  if (target === 'DISPONIBLE') {
    preview.availableUnits += operation === 'SUMAR' ? quantity : -quantity
  }

  if (target === 'RESERVADO') {
    if (operation === 'SUMAR') {
      preview.availableUnits -= quantity
      preview.reservedUnits += quantity
    } else {
      preview.availableUnits += quantity
      preview.reservedUnits -= quantity
    }
  }

  if (target === 'BLOQUEADO') {
    if (operation === 'SUMAR') {
      preview.availableUnits -= quantity
      preview.blockedUnits += quantity
    } else {
      preview.availableUnits += quantity
      preview.blockedUnits -= quantity
    }
  }

  return preview
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <p className="text-xs text-destructive">{message}</p>
}

export function InventarioPage() {
  const { logout, session } = useAuth()
  const accessToken = session?.accessToken ?? ''
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'TODOS' | InventoryLotStatus>('TODOS')
  const [branchFilter, setBranchFilter] = useState('TODAS')
  const [productFilter, setProductFilter] = useState('TODOS')
  const [dashboard, setDashboard] = useState<InventoryDashboardResponse>(emptyDashboard)
  const [isLoading, setIsLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false)
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
  const [showSummary, setShowSummary] = useState(false)

  const createForm = useForm<CreateLotFormValues>({
    resolver: zodResolver(createLotSchema),
    defaultValues: defaultCreateFormValues,
  })

  const adjustForm = useForm<AdjustLotFormValues>({
    resolver: zodResolver(adjustLotSchema),
    defaultValues: defaultAdjustFormValues,
  })

  const transferForm = useForm<TransferLotFormValues>({
    resolver: zodResolver(transferLotSchema),
    defaultValues: defaultTransferFormValues,
  })

  const watchedStockInitial = createForm.watch('stockInicial')
  const watchedReserved = createForm.watch('stockReservado')
  const watchedBlocked = createForm.watch('stockBloqueado')
  const selectedAdjustLotId = adjustForm.watch('lotId')
  const adjustTarget = adjustForm.watch('target')
  const adjustOperation = adjustForm.watch('operation')
  const adjustQuantity = adjustForm.watch('quantity')
  const selectedTransferLotId = transferForm.watch('lotId')

  const availablePreview = Math.max(
    0,
    Number(watchedStockInitial || 0) -
      Number(watchedReserved || 0) -
      Number(watchedBlocked || 0),
  )

  const selectedAdjustLot = useMemo(
    () => dashboard.lots.find((lot) => lot.id === selectedAdjustLotId),
    [dashboard.lots, selectedAdjustLotId],
  )

  const selectedTransferLot = useMemo(
    () => dashboard.lots.find((lot) => lot.id === selectedTransferLotId),
    [dashboard.lots, selectedTransferLotId],
  )

  const adjustmentPreview = useMemo(
    () =>
      getAdjustmentPreview(
        selectedAdjustLot,
        adjustTarget,
        adjustOperation,
        Number(adjustQuantity || 0),
      ),
    [adjustOperation, adjustQuantity, adjustTarget, selectedAdjustLot],
  )

  const createWarehouseSuggestions = useMemo(() => {
    const selectedBranchId = createForm.watch('sucursalId')

    return dashboard.options.warehouses.filter(
      (warehouse) => warehouse.branchId === selectedBranchId,
    )
  }, [createForm, dashboard.options.warehouses])

  const transferWarehouseSuggestions = useMemo(() => {
    const selectedBranchId = transferForm.watch('destinationBranchId')

    return dashboard.options.warehouses.filter(
      (warehouse) => warehouse.branchId === selectedBranchId,
    )
  }, [dashboard.options.warehouses, transferForm])

  const destinationBranchOptions = useMemo(() => {
    if (!selectedTransferLot) {
      return dashboard.options.branches
    }

    return dashboard.options.branches.filter(
      (branch) => branch.id !== selectedTransferLot.branchId,
    )
  }, [dashboard.options.branches, selectedTransferLot])

  const canTransferLots = dashboard.options.branches.length > 1

  const handleUnauthorized = useCallback(async () => {
    toast.error('Tu sesión ya no es válida. Ingresa nuevamente para continuar.')
    await logout()
  }, [logout])

  const loadDashboard = useCallback(async () => {
    if (!accessToken) {
      return
    }

    setIsLoading(true)
    setDashboardError(null)

    try {
      const response = await inventoryService.getDashboard(accessToken, {
        search,
        status: statusFilter === 'TODOS' ? undefined : statusFilter,
        branchId: branchFilter === 'TODAS' ? undefined : branchFilter,
        productId: productFilter === 'TODOS' ? undefined : productFilter,
      })

      setDashboard(response)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await handleUnauthorized()
        return
      }

      setDashboardError(getApiErrorMessage(error))
      setDashboard(emptyDashboard)
    } finally {
      setIsLoading(false)
    }
  }, [
    accessToken,
    branchFilter,
    handleUnauthorized,
    productFilter,
    search,
    statusFilter,
  ])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  function openAdjustDialog(lot?: InventoryLotView) {
    adjustForm.reset({
      ...defaultAdjustFormValues,
      lotId: lot?.id ?? dashboard.lots[0]?.id ?? '',
    })
    setIsAdjustDialogOpen(true)
  }

  function openTransferDialog(lot?: InventoryLotView) {
    transferForm.reset({
      ...defaultTransferFormValues,
      lotId: lot?.id ?? dashboard.lots[0]?.id ?? '',
    })
    setIsTransferDialogOpen(true)
  }

  async function handleCreateLot(values: CreateLotFormValues) {
    if (!accessToken) {
      toast.error('La sesión no está disponible.')
      return
    }

    const payload: CreateInventoryLotPayload = {
      sucursalId: values.sucursalId,
      productoId: values.productoId,
      proveedorId: values.proveedorId || undefined,
      numeroLote: values.numeroLote.trim(),
      fechaFabricacion: values.fechaFabricacion || undefined,
      fechaVencimiento: values.fechaVencimiento,
      costoUnitario: values.costoUnitario,
      stockInicial: values.stockInicial,
      stockReservado: values.stockReservado || 0,
      stockBloqueado: values.stockBloqueado || 0,
      almacen: values.almacen?.trim() || undefined,
      observaciones: values.observaciones?.trim() || undefined,
    }

    setIsMutating(true)

    try {
      await inventoryService.createLot(accessToken, payload)
      toast.success('Lote registrado correctamente.')
      setIsCreateDialogOpen(false)
      createForm.reset(defaultCreateFormValues)
      await loadDashboard()
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await handleUnauthorized()
        return
      }

      toast.error(getApiErrorMessage(error))
    } finally {
      setIsMutating(false)
    }
  }

  async function handleAdjustLot(values: AdjustLotFormValues) {
    if (!accessToken) {
      toast.error('La sesión no está disponible.')
      return
    }

    const payload: AdjustInventoryLotPayload = {
      lotId: values.lotId,
      target: values.target,
      operation: values.operation,
      quantity: values.quantity,
      observaciones: values.observaciones?.trim() || undefined,
    }

    setIsMutating(true)

    try {
      await inventoryService.adjustLot(accessToken, payload)
      toast.success('Movimiento operativo registrado correctamente.')
      setIsAdjustDialogOpen(false)
      adjustForm.reset(defaultAdjustFormValues)
      await loadDashboard()
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await handleUnauthorized()
        return
      }

      toast.error(getApiErrorMessage(error))
    } finally {
      setIsMutating(false)
    }
  }

  async function handleTransferLot(values: TransferLotFormValues) {
    if (!accessToken) {
      toast.error('La sesión no está disponible.')
      return
    }

    const payload: TransferInventoryLotPayload = {
      lotId: values.lotId,
      destinationBranchId: values.destinationBranchId,
      quantity: values.quantity,
      destinationWarehouse: values.destinationWarehouse?.trim() || undefined,
      observaciones: values.observaciones?.trim() || undefined,
    }

    setIsMutating(true)

    try {
      await inventoryService.transferLot(accessToken, payload)
      toast.success('Transferencia registrada correctamente.')
      setIsTransferDialogOpen(false)
      transferForm.reset(defaultTransferFormValues)
      await loadDashboard()
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await handleUnauthorized()
        return
      }

      toast.error(getApiErrorMessage(error))
    } finally {
      setIsMutating(false)
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-foreground">Inventario</h1>
        <Button variant="ghost" size="sm" onClick={() => setShowSummary(!showSummary)}>
          Resumen
          <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${showSummary ? 'rotate-180' : ''}`} />
        </Button>
      </div>

      {showSummary && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <Boxes className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{formatQuantity(dashboard.summary.totalAvailableUnits)}</span>
              <span className="text-xs text-muted-foreground">Disponible</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{formatQuantity(dashboard.summary.totalReservedUnits)}</span>
              <span className="text-xs text-muted-foreground">Reservado</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{formatQuantity(dashboard.summary.totalBlockedUnits)}</span>
              <span className="text-xs text-muted-foreground">Bloqueado</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <TriangleAlert className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{dashboard.summary.expiringSoonCount}</span>
              <span className="text-xs text-muted-foreground">Por vencer</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="hidden xl:block">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Vista por sucursal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dashboard.branchSummary.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
                Aún no hay sucursales con lotes cargados.
              </div>
            ) : (
              dashboard.branchSummary.map((branch) => (
                <div key={branch.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{branch.name}</p>
                    <Badge variant="outline" className="text-xs">{branch.lotCount} lotes</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {branch.skuCount} SKU · {formatQuantity(branch.availableUnits)} disp.
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="lotes">
        <TabsList className="grid w-full grid-cols-3 lg:w-fit">
          <TabsTrigger value="lotes">Stock por lotes</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="alertas">Alertas y FIFO</TabsTrigger>
        </TabsList>

        <TabsContent value="lotes" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Boxes className="h-5 w-5 text-primary" />
                  Stock por lote
                </CardTitle>
                <CardDescription>
                  Ingreso, ajuste y transferencia por lote con trazabilidad real.
                </CardDescription>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openAdjustDialog()}
                  disabled={dashboard.lots.length === 0}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Ajustar lote
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openTransferDialog()}
                  disabled={dashboard.lots.length === 0 || !canTransferLots}
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  Transferir stock
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsCreateDialogOpen(true)}
                  disabled={
                    dashboard.options.branches.length === 0 ||
                    dashboard.options.products.length === 0
                  }
                >
                  <PackagePlus className="h-4 w-4" />
                  Registrar lote
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {dashboard.options.branches.length === 0 ||
              dashboard.options.products.length === 0 ? (
                <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning-foreground">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    Aún faltan maestros de sucursal o productos para registrar lotes. Verifica el seed y vuelve a cargar la pantalla.
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.45fr_0.55fr_0.7fr]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por producto, SKU, lote o proveedor"
                    className="pl-9"
                  />
                </div>

                <Select
                  value={statusFilter}
                  onValueChange={(value) =>
                    setStatusFilter(value as 'TODOS' | InventoryLotStatus)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos los estados</SelectItem>
                    <SelectItem value="ACTIVO">Activo</SelectItem>
                    <SelectItem value="BLOQUEADO">Bloqueado</SelectItem>
                    <SelectItem value="VENCIDO">Vencido</SelectItem>
                    <SelectItem value="AGOTADO">Agotado</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAS">Todas las sucursales</SelectItem>
                    {dashboard.options.branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={productFilter} onValueChange={setProductFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Producto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos los productos</SelectItem>
                    {dashboard.options.products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isLoading ? (
                <div className="flex min-h-56 items-center justify-center rounded-2xl border">
                  <Loader className="h-7 w-7" />
                </div>
              ) : dashboardError ? (
                <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                  {dashboardError}
                </div>
              ) : dashboard.lots.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-10 text-center">
                  <p className="text-sm font-medium text-foreground">
                    Aún no hay lotes registrados con los filtros actuales.
                  </p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Registra el primer lote para empezar el control real del inventario.
                  </p>
                </div>
              ) : (
                <>
                  {!canTransferLots ? (
                    <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning-foreground">
                      Agrega al menos una segunda sucursal para habilitar transferencias entre locales.
                    </div>
                  ) : null}

                  <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead>Sucursal / almacén</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Costo / vencimiento</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard.lots.map((lot) => (
                      <TableRow key={lot.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{lot.productName}</p>
                            <p className="text-small text-muted-foreground">
                              {lot.sku} · {lot.unitSymbol}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{lot.lotCode}</p>
                            <p className="text-small text-muted-foreground">
                              {lot.supplierName}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{lot.branchName}</p>
                            <p className="text-small text-muted-foreground">
                              {lot.warehouseName}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">
                              {formatQuantity(lot.availableUnits)} disponibles
                            </p>
                            <p className="text-small text-muted-foreground">
                              {formatQuantity(lot.reservedUnits)} reservadas ·{' '}
                              {formatQuantity(lot.blockedUnits)} bloqueadas
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">
                              {formatCurrency(lot.unitCost)}
                            </p>
                            <p className="text-small text-muted-foreground">
                              vence {formatDate(lot.expiryDate)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={getLotStatusVariant(lot.status)}>
                              {lot.status}
                            </Badge>
                            {lot.expiresSoon ? (
                              <Badge variant="warning">Por vencer</Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openAdjustDialog(lot)}
                            >
                              Ajustar
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openTransferDialog(lot)}
                              disabled={lot.availableUnits <= 0 || !canTransferLots}
                            >
                              Transferir
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movimientos" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Kardex operativo
              </CardTitle>
              <CardDescription>
                Entradas, reservas, liberaciones, ajustes y transferencias por lote.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex min-h-56 items-center justify-center rounded-2xl border">
                  <Loader className="h-7 w-7" />
                </div>
              ) : dashboard.movements.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-10 text-center text-small text-muted-foreground">
                  Todavía no hay movimientos registrados.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Stock resultante</TableHead>
                      <TableHead>Responsable</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard.movements.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(movement.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getMovementVariant(movement.type)}>
                            {movement.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{movement.productName}</p>
                            <p className="text-small text-muted-foreground">
                              {movement.branchName} · {movement.warehouseName}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {movement.lotCode}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {movement.quantity > 0
                            ? `+${formatQuantity(movement.quantity)}`
                            : formatQuantity(movement.quantity)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatQuantity(movement.stockAfter)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {movement.actorName}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alertas" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TriangleAlert className="h-5 w-5 text-primary" />
                  Alertas operativas
                </CardTitle>
                <CardDescription>
                  Lotes que requieren atención por vencimiento, bloqueo o falta de disponibilidad.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard.alerts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-6 text-small text-muted-foreground">
                    No hay alertas activas con los filtros actuales.
                  </div>
                ) : (
                  dashboard.alerts.map((alert) => (
                    <div key={alert.id} className="rounded-2xl border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-foreground">{alert.productName}</p>
                          <p className="mt-1 text-small text-muted-foreground">
                            {alert.lotCode} · {alert.branchName} · {alert.warehouseName}
                          </p>
                          <p className="mt-1 text-small text-muted-foreground">
                            Disponible {formatQuantity(alert.availableUnits)} · vence{' '}
                            {formatDate(alert.expiryDate)}
                          </p>
                        </div>
                        <Badge variant={getAlertVariant(alert.alertType)}>
                          {alert.alertType}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  Recomendación FIFO
                </CardTitle>
                <CardDescription>
                  Orden sugerido de salida para reducir vencimientos y pérdida de rotación.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard.fifoCandidates.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-6 text-small text-muted-foreground">
                    Cuando existan lotes activos con stock disponible, aquí aparecerá la recomendación FIFO.
                  </div>
                ) : (
                  dashboard.fifoCandidates.map((lot, index) => (
                    <div key={lot.id} className="rounded-2xl border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-foreground">
                            {index + 1}. {lot.productName}
                          </p>
                          <p className="mt-1 text-small text-muted-foreground">
                            {lot.lotCode} · {formatQuantity(lot.availableUnits)} disponibles · vence{' '}
                            {formatDate(lot.expiryDate)}
                          </p>
                        </div>
                        <Badge variant="info">{lot.branchName}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Registrar lote</DialogTitle>
            <DialogDescription>
              Ingresa un lote real por producto, sucursal y almacén con control de reservado y bloqueado.
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-6" onSubmit={createForm.handleSubmit(handleCreateLot)}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Sucursal</label>
                <Controller
                  control={createForm.control}
                  name="sucursalId"
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona sucursal" />
                      </SelectTrigger>
                      <SelectContent>
                        {dashboard.options.branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={createForm.formState.errors.sucursalId?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Producto</label>
                <Controller
                  control={createForm.control}
                  name="productoId"
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona producto" />
                      </SelectTrigger>
                      <SelectContent>
                        {dashboard.options.products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} ({product.sku})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={createForm.formState.errors.productoId?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Número de lote</label>
                <Input {...createForm.register('numeroLote')} placeholder="L-2026-0001" />
                <FieldError message={createForm.formState.errors.numeroLote?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Proveedor</label>
                <Controller
                  control={createForm.control}
                  name="proveedorId"
                  render={({ field }) => (
                    <Select
                      value={field.value || 'none'}
                      onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Opcional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin proveedor</SelectItem>
                        {dashboard.options.suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha de fabricación</label>
                <Input type="date" {...createForm.register('fechaFabricacion')} />
                <FieldError message={createForm.formState.errors.fechaFabricacion?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha de vencimiento</label>
                <Input type="date" {...createForm.register('fechaVencimiento')} />
                <FieldError message={createForm.formState.errors.fechaVencimiento?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Costo unitario</label>
                <Input
                  type="number"
                  step="0.000001"
                  {...createForm.register('costoUnitario', { valueAsNumber: true })}
                />
                <FieldError message={createForm.formState.errors.costoUnitario?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Almacén / ubicación</label>
                <Input
                  {...createForm.register('almacen')}
                  placeholder={
                    createWarehouseSuggestions[0]?.name ??
                    'Mostrador principal / refrigerado'
                  }
                />
                {createWarehouseSuggestions.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Sugerencias:{' '}
                    {createWarehouseSuggestions
                      .map((warehouse) => warehouse.name)
                      .join(', ')}
                  </p>
                ) : null}
                <FieldError message={createForm.formState.errors.almacen?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Stock inicial</label>
                <Input
                  type="number"
                  step="0.01"
                  {...createForm.register('stockInicial', { valueAsNumber: true })}
                />
                <FieldError message={createForm.formState.errors.stockInicial?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Stock reservado</label>
                <Input
                  type="number"
                  step="0.01"
                  {...createForm.register('stockReservado', { valueAsNumber: true })}
                />
                <FieldError message={createForm.formState.errors.stockReservado?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Stock bloqueado</label>
                <Input
                  type="number"
                  step="0.01"
                  {...createForm.register('stockBloqueado', { valueAsNumber: true })}
                />
                <FieldError message={createForm.formState.errors.stockBloqueado?.message} />
              </div>

              <div className="rounded-2xl border bg-muted/20 p-4">
                <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                  Disponible estimado
                </p>
                <p className="mt-2 text-display text-foreground">
                  {formatQuantity(availablePreview)}
                </p>
                <p className="text-small text-muted-foreground">
                  stock inicial menos reservado y bloqueado
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Observaciones</label>
                <Textarea
                  {...createForm.register('observaciones')}
                  placeholder="Observaciones operativas del lote"
                  className="min-h-24"
                />
                <FieldError message={createForm.formState.errors.observaciones?.message} />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false)
                  createForm.reset(defaultCreateFormValues)
                }}
                disabled={isMutating}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isMutating}>
                {isMutating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <PackagePlus className="h-4 w-4" />
                    Guardar lote
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ajuste operativo de lote</DialogTitle>
            <DialogDescription>
              Mueve stock disponible, reservado o bloqueado sin salir del módulo.
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-6" onSubmit={adjustForm.handleSubmit(handleAdjustLot)}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Lote</label>
                <Controller
                  control={adjustForm.control}
                  name="lotId"
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona lote" />
                      </SelectTrigger>
                      <SelectContent>
                        {dashboard.lots.map((lot) => (
                          <SelectItem key={lot.id} value={lot.id}>
                            {lot.productName} · {lot.lotCode} · {lot.branchName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={adjustForm.formState.errors.lotId?.message} />
              </div>

              <div className="rounded-2xl border bg-muted/20 p-4 md:col-span-2">
                <p className="text-sm font-medium text-foreground">
                  {selectedAdjustLot
                    ? `${selectedAdjustLot.productName} · ${selectedAdjustLot.lotCode}`
                    : 'Selecciona un lote para ver el resumen'}
                </p>
                <p className="mt-2 text-small text-muted-foreground">
                  Disponible {formatQuantity(selectedAdjustLot?.availableUnits ?? 0)} · Reservado{' '}
                  {formatQuantity(selectedAdjustLot?.reservedUnits ?? 0)} · Bloqueado{' '}
                  {formatQuantity(selectedAdjustLot?.blockedUnits ?? 0)}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Bolsa</label>
                <Controller
                  control={adjustForm.control}
                  name="target"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DISPONIBLE">Disponible</SelectItem>
                        <SelectItem value="RESERVADO">Reservado</SelectItem>
                        <SelectItem value="BLOQUEADO">Bloqueado</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Operación</label>
                <Controller
                  control={adjustForm.control}
                  name="operation"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SUMAR">Sumar</SelectItem>
                        <SelectItem value="RESTAR">Restar</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Cantidad</label>
                <Input
                  type="number"
                  step="0.01"
                  {...adjustForm.register('quantity', { valueAsNumber: true })}
                />
                <FieldError message={adjustForm.formState.errors.quantity?.message} />
              </div>

              <div className="rounded-2xl border bg-muted/20 p-4">
                <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                  Vista previa
                </p>
                <p className="mt-2 text-small text-muted-foreground">
                  Disponible {formatQuantity(adjustmentPreview.availableUnits)} · Reservado{' '}
                  {formatQuantity(adjustmentPreview.reservedUnits)} · Bloqueado{' '}
                  {formatQuantity(adjustmentPreview.blockedUnits)}
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Observaciones</label>
                <Textarea
                  {...adjustForm.register('observaciones')}
                  placeholder="Motivo o contexto del movimiento"
                  className="min-h-24"
                />
                <FieldError message={adjustForm.formState.errors.observaciones?.message} />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAdjustDialogOpen(false)
                  adjustForm.reset(defaultAdjustFormValues)
                }}
                disabled={isMutating}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isMutating}>
                {isMutating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <SlidersHorizontal className="h-4 w-4" />
                    Aplicar ajuste
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transferir stock entre sucursales</DialogTitle>
            <DialogDescription>
              Mueve stock disponible del lote y conserva la trazabilidad del mismo número de lote.
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-6" onSubmit={transferForm.handleSubmit(handleTransferLot)}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Lote origen</label>
                <Controller
                  control={transferForm.control}
                  name="lotId"
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona lote" />
                      </SelectTrigger>
                      <SelectContent>
                        {dashboard.lots.map((lot) => (
                          <SelectItem key={lot.id} value={lot.id}>
                            {lot.productName} · {lot.lotCode} · {lot.branchName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={transferForm.formState.errors.lotId?.message} />
              </div>

              <div className="rounded-2xl border bg-muted/20 p-4 md:col-span-2">
                <p className="text-sm font-medium text-foreground">
                  {selectedTransferLot
                    ? `${selectedTransferLot.productName} · ${selectedTransferLot.lotCode}`
                    : 'Selecciona un lote para ver el resumen'}
                </p>
                <p className="mt-2 text-small text-muted-foreground">
                  Origen {selectedTransferLot?.branchName ?? 'Sin sucursal'} · Disponible{' '}
                  {formatQuantity(selectedTransferLot?.availableUnits ?? 0)}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Sucursal destino</label>
                <Controller
                  control={transferForm.control}
                  name="destinationBranchId"
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona sucursal destino" />
                      </SelectTrigger>
                      <SelectContent>
                        {destinationBranchOptions.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError
                  message={transferForm.formState.errors.destinationBranchId?.message}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Cantidad a transferir</label>
                <Input
                  type="number"
                  step="0.01"
                  {...transferForm.register('quantity', { valueAsNumber: true })}
                />
                <FieldError message={transferForm.formState.errors.quantity?.message} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Almacén destino</label>
                <Input
                  {...transferForm.register('destinationWarehouse')}
                  placeholder={
                    transferWarehouseSuggestions[0]?.name ??
                    'Mostrador principal / tránsito / refrigerado'
                  }
                />
                {transferWarehouseSuggestions.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Sugerencias:{' '}
                    {transferWarehouseSuggestions
                      .map((warehouse) => warehouse.name)
                      .join(', ')}
                  </p>
                ) : null}
                <FieldError
                  message={transferForm.formState.errors.destinationWarehouse?.message}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Observaciones</label>
                <Textarea
                  {...transferForm.register('observaciones')}
                  placeholder="Motivo o contexto de la transferencia"
                  className="min-h-24"
                />
                <FieldError message={transferForm.formState.errors.observaciones?.message} />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsTransferDialogOpen(false)
                  transferForm.reset(defaultTransferFormValues)
                }}
                disabled={isMutating}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isMutating}>
                {isMutating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="h-4 w-4" />
                    Confirmar transferencia
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
