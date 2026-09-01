import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRightLeft,
  Boxes,
  ChevronDown,
  History,
  Loader2,
  PackagePlus,
  RefreshCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  TriangleAlert,
  Wrench,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AuthorizationGate } from '@/components/auth/AuthorizationGate'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Loader } from '@/components/ui/loader'
import {
  SearchableSelect,
  type SearchableOption,
} from '@/components/ui/searchable-select'
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
import { useHandleUnauthorized } from '@/hooks/useHandleUnauthorized'
import { ApiError, ApiNetworkError } from '@/services/apiClient'
import { inventoryService } from '@/services/inventoryService'
import { productsService } from '@/services/productsService'
import { rtService } from '@/services/rtService'
import type { ProductStatus } from '@/types/products'
import type { MovimientoInventarioRT, UsoServicioTecnico } from '@/types/rayegotech'
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

type LotProductOptionPresentation = {
  id: string
  name: string
  isBase: boolean
  allowsPurchase: boolean
  allowsSale: boolean
  salePrice: number | null
  factorToBase: number | null
}

type LotProductOptionItem = {
  id: string
  name: string
  sku: string
  unitSymbol: string
  status?: ProductStatus
  packaging:
    | {
        basePresentationId: string | null
        presentations: LotProductOptionPresentation[]
      }
    | null
}

const createLotSchema = z
  .object({
    productoId: z.string().uuid({ message: 'Selecciona un producto.' }),
    proveedorId: z.string().optional(),
    numeroLote: z.string().min(2, 'Ingresa un número de lote válido.').max(80),
    fechaFabricacion: z.string().optional(),
    fechaVencimiento: z.string().min(1, 'Selecciona la fecha de vencimiento.'),
    costoUnitario: z.number().nonnegative('El costo unitario no puede ser negativo.'),
    stockInicial: z.number().int().positive('El stock inicial debe ser mayor a 0.'),
    stockReservado: z
      .number()
      .int()
      .min(0, 'El stock reservado no puede ser negativo.'),
    stockBloqueado: z
      .number()
      .int()
      .min(0, 'El stock bloqueado no puede ser negativo.'),
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
  presentacionId: z.string().uuid({ message: 'Selecciona una presentación.' }),
  target: z.enum(['DISPONIBLE', 'RESERVADO', 'BLOQUEADO']),
  operation: z.enum(['SUMAR', 'RESTAR']),
  quantity: z.number().int().positive('Ingresa una cantidad mayor a 0.'),
  observaciones: z.string().max(255).optional(),
})

const transferLotSchema = z.object({
  lotId: z.string().uuid({ message: 'Selecciona un lote.' }),
  destinationBranchId: z.string().uuid({ message: 'Selecciona una sucursal destino.' }),
  presentacionId: z.string().uuid({ message: 'Selecciona una presentación.' }),
  quantity: z.number().int().positive('Ingresa una cantidad mayor a 0.'),
  destinationWarehouse: z.string().max(120).optional(),
  observaciones: z.string().max(255).optional(),
})

type CreateLotFormValues = z.infer<typeof createLotSchema>
type AdjustLotFormValues = z.infer<typeof adjustLotSchema>
type TransferLotFormValues = z.infer<typeof transferLotSchema>
type InventoryLotView = InventoryDashboardResponse['lots'][number]

const defaultCreateFormValues: CreateLotFormValues = {
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
  presentacionId: '',
  target: 'DISPONIBLE',
  operation: 'RESTAR',
  quantity: 0,
  observaciones: '',
}

const defaultTransferFormValues: TransferLotFormValues = {
  lotId: '',
  destinationBranchId: '',
  presentacionId: '',
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
    maximumFractionDigits: 0,
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

function parseDateValue(value: string | null | undefined) {
  if (!value) return 0

  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  const time = date.getTime()
  return Number.isNaN(time) ? 0 : time
}

function getLotStatusVariant(status: InventoryLotStatus) {
  if (status === 'ACTIVO') return 'success'
  if (status === 'BLOQUEADO') return 'destructive'
  if (status === 'VENCIDO') return 'warning'
  return 'outline'
}

function getMovementVariant(type: InventoryMovementType | 'INVENTARIO_INICIAL') {
  if (type === 'INVENTARIO_INICIAL') return 'success'
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

function LotProductAutocomplete({
  accessToken,
  value,
  onValueChange,
  onProductSelected,
  fallbackProducts,
  inputKeySuffix,
}: {
  accessToken: string
  value: string
  onValueChange: (value: string) => void
  onProductSelected?: (product: LotProductOptionItem) => void
  fallbackProducts?: LotProductOptionItem[]
  inputKeySuffix?: string
}) {
  const queryTextRef = useRef('')
  const queryInputRef = useRef<HTMLInputElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [items, setItems] = useState<LotProductOptionItem[]>([])
  const triggerSearchRef = useRef<() => void>(() => {})

  useEffect(() => {
    let handle: number | null = null
    let cancelled = false

    const run = () => {
      const search = queryTextRef.current.trim()
      if (!search || !accessToken) {
        setItems([])
        return
      }

      setIsLoading(true)
      productsService
        .list(accessToken, {
          search,
          status: 'ACTIVO',
          page: 1,
          pageSize: 12,
          sortBy: 'name',
          sortDir: 'asc',
        })
        .then((response) => {
          if (cancelled) return
          const subset: LotProductOptionItem[] = response.items.map((product) => ({
            id: product.id,
            name: product.name,
            sku: product.sku,
            unitSymbol: product.unitSymbol,
            status: product.status,
            packaging: product.packaging
              ? {
                  basePresentationId: product.packaging.basePresentationId,
                  presentations: product.packaging.presentations.map((entry) => ({
                    id: entry.id,
                    name: entry.name,
                    isBase: entry.isBase,
                    allowsPurchase: entry.allowsPurchase,
                    allowsSale: entry.allowsSale,
                    salePrice: entry.salePrice,
                    factorToBase: entry.factorToBase,
                  })),
                }
              : null,
          }))
          setItems(subset)
        })
        .catch(() => {
          if (!cancelled) setItems([])
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false)
        })
    }

    triggerSearchRef.current = () => {
      setIsOpen(true)
      if (handle) window.clearTimeout(handle)
      handle = window.setTimeout(() => {
        if (!cancelled) run()
      }, 250)
    }

    return () => {
      cancelled = true
      if (handle) window.clearTimeout(handle)
    }
  }, [accessToken])

  useEffect(() => {
    if (!value) {
      return
    }

    const match =
      items.find((product) => product.id === value) ??
      fallbackProducts?.find((product) => product.id === value) ??
      null

    if (match) {
      const display = `${match.name} · ${match.sku}`
      queryTextRef.current = display
      if (queryInputRef.current) queryInputRef.current.value = display
      onProductSelected?.(match)
    }
  }, [fallbackProducts, items, onProductSelected, value])

  return (
    <div className="relative">
      <Input
        key={`lot-product-search-${inputKeySuffix ?? 'v1'}`}
        ref={queryInputRef}
        defaultValue={queryTextRef.current}
        onInput={(event) => {
          queryTextRef.current = event.currentTarget.value
          triggerSearchRef.current()
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 160)}
        placeholder="Buscar producto por nombre, código o SKU"
      />
      {isOpen ? (
        <Card className="absolute z-50 mt-1 w-full overflow-hidden p-1 shadow-lg">
          <div className="max-h-72 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader className="h-6 w-6" />
              </div>
            ) : items.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</div>
            ) : (
              items.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted/60"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onValueChange(product.id)
                    onProductSelected?.(product)
                    const display = `${product.name} · ${product.sku}`
                    queryTextRef.current = display
                    if (queryInputRef.current) queryInputRef.current.value = display
                    setIsOpen(false)
                  }}
                >
                  <span className="min-w-0 flex-1 truncate text-foreground">
                    {product.name}
                    <span className="text-muted-foreground"> · {product.sku}</span>
                  </span>
                  <Badge variant={(product.status ?? 'ACTIVO') === 'ACTIVO' ? 'success' : 'outline'}>
                    {product.status ?? 'ACTIVO'}
                  </Badge>
                </button>
              ))
            )}
          </div>
        </Card>
      ) : null}
    </div>
  )
}

export function InventarioPage() {
  const { session } = useAuth()
  const accessToken = session?.accessToken ?? ''
  const activeBranchId = session?.user.branchId ?? ''
  const activeBranchName = session?.user.branchName ?? ''
  const [searchParams] = useSearchParams()
  const initialProductId = searchParams.get('productId')
  const initialTab = searchParams.get('tab')
  const initialAction = searchParams.get('action')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'TODOS' | InventoryLotStatus>('TODOS')
  const [productFilter, setProductFilter] = useState(() => initialProductId ?? 'TODOS')
  const [usoServicioTecnicoFilter, setUsoServicioTecnicoFilter] = useState<'TODOS' | UsoServicioTecnico>('TODOS')
  const lotCreateInputKeyRef = useRef(0)
  const isCreateDialogPrev = useRef(false)
  const [activeTab, setActiveTab] = useState<
    'lotes' | 'movimientos' | 'alertas' | 'consumo-rt'
  >(() => {
    if (
      initialTab === 'movimientos' ||
      initialTab === 'alertas' ||
      initialTab === 'lotes' ||
      initialTab === 'consumo-rt'
    ) {
      return initialTab
    }
    return 'lotes'
  })
  const [pendingAction, setPendingAction] = useState(() => initialAction)
  const [dashboard, setDashboard] = useState<InventoryDashboardResponse>(emptyDashboard)
  const [isLoading, setIsLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false)
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [lotsPage, setLotsPage] = useState(1)

  // ================ RayegoTech: Movimientos Consumo RT ================
  const [movimientosRT, setMovimientosRT] = useState<MovimientoInventarioRT[]>([])
  const [movimientosRTLoading, setMovimientosRTLoading] = useState(false)
  const lotsPageSize = 8
  const isTransferEnabled = useMemo(() => false, [])
  const isManualLotEnabled = useMemo(() => true, [])

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
  const adjustPresentationId = adjustForm.watch('presentacionId')
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

  const selectedAdjustProduct = useMemo(() => {
    if (!selectedAdjustLot) return null
    return dashboard.options.products.find((product) => product.id === selectedAdjustLot.productId) ?? null
  }, [dashboard.options.products, selectedAdjustLot])

  const selectedTransferProduct = useMemo(() => {
    if (!selectedTransferLot) return null
    return dashboard.options.products.find((product) => product.id === selectedTransferLot.productId) ?? null
  }, [dashboard.options.products, selectedTransferLot])

  const adjustFactorToBase = useMemo(() => {
    const factor =
      selectedAdjustProduct?.packaging?.presentations.find(
        (entry) => entry.id === adjustPresentationId,
      )?.factorToBase ?? null

    return factor && factor > 0 ? factor : 1
  }, [adjustPresentationId, selectedAdjustProduct])

  const adjustmentPreview = useMemo(
    () =>
      getAdjustmentPreview(
        selectedAdjustLot,
        adjustTarget,
        adjustOperation,
        Number(adjustQuantity || 0) * adjustFactorToBase,
      ),
    [adjustFactorToBase, adjustOperation, adjustQuantity, adjustTarget, selectedAdjustLot],
  )

  const createWarehouseSuggestions = useMemo(() => {
    return dashboard.options.warehouses.filter(
      (warehouse) => warehouse.branchId === activeBranchId,
    )
  }, [activeBranchId, dashboard.options.warehouses])

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

  const canTransferLots = isTransferEnabled && dashboard.options.branches.length > 1

  const sortedLots = useMemo(() => {
    const q = search.trim().toLowerCase()
    return [...dashboard.lots]
      .filter((lot) => {
        if (q) {
          const haystack = [
            lot.productName,
            lot.sku,
            lot.lotCode,
            lot.supplierName || '',
          ].join(' ').toLowerCase()
          if (!haystack.includes(q)) return false
        }
        if (statusFilter !== 'TODOS' && lot.status !== statusFilter) return false
        if (productFilter !== 'TODOS' && lot.productId !== productFilter) return false
        if (usoServicioTecnicoFilter !== 'TODOS' && (lot as any).productoUsoServicioTecnico !== usoServicioTecnicoFilter) return false
        return true
      })
      .sort(
        (a, b) => parseDateValue(b.receivedAt) - parseDateValue(a.receivedAt),
      )
  }, [dashboard.lots, search, statusFilter, productFilter, usoServicioTecnicoFilter])
  const lotOptions = useMemo<SearchableOption[]>(
    () =>
      sortedLots.map((lot) => ({
        value: lot.id,
        title: `${lot.productName} · ${lot.lotCode}`,
        subtitle: `Disponible ${formatQuantity(lot.availableUnits)} · Reservado ${formatQuantity(lot.reservedUnits)} · Bloqueado ${formatQuantity(lot.blockedUnits)}`,
      })),
    [sortedLots],
  )
  const lotsTotalPages = Math.max(1, Math.ceil(sortedLots.length / lotsPageSize))
  const safeLotsPage = Math.min(lotsPage, lotsTotalPages)
  const lotsPageStart = (safeLotsPage - 1) * lotsPageSize
  const visibleLots = sortedLots.slice(lotsPageStart, lotsPageStart + lotsPageSize)

  const handleUnauthorized = useHandleUnauthorized('InventarioPage')

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
    handleUnauthorized,
    productFilter,
    search,
    statusFilter,
  ])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const loadMovimientosRT = useCallback(async () => {
    if (!accessToken) return
    try {
      setMovimientosRTLoading(true)
      const res = await rtService.listMovimientosInventario({
        origen: 'SERVICIO_TECNICO',
      })
      setMovimientosRT(res.items || [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await handleUnauthorized()
        return
      }
      if (!(err instanceof ApiNetworkError) && !(err instanceof ApiError)) throw err
    } finally {
      setMovimientosRTLoading(false)
    }
  }, [accessToken, handleUnauthorized])

  useEffect(() => {
    if (activeTab === 'consumo-rt') void loadMovimientosRT()
  }, [activeTab, loadMovimientosRT])

  useEffect(() => {
    if (isCreateDialogOpen && !isCreateDialogPrev.current) {
      lotCreateInputKeyRef.current += 1
    }
    isCreateDialogPrev.current = isCreateDialogOpen
  }, [isCreateDialogOpen])

  useEffect(() => {
    setLotsPage(1)
  }, [productFilter, search, statusFilter])

  function openAdjustDialog(lot?: InventoryLotView) {
    const lotId = lot?.id ?? dashboard.lots[0]?.id ?? ''
    const nextLot = lotId ? dashboard.lots.find((entry) => entry.id === lotId) ?? lot : lot
    const product =
      nextLot
        ? dashboard.options.products.find((entry) => entry.id === nextLot.productId) ?? null
        : null
    const presentacionId =
      product?.packaging?.basePresentationId ??
      product?.packaging?.presentations[0]?.id ??
      ''

    adjustForm.reset({
      ...defaultAdjustFormValues,
      lotId,
      presentacionId,
    })
    setIsAdjustDialogOpen(true)
  }

  useEffect(() => {
    if (pendingAction !== 'adjust') {
      return
    }

    if (isLoading) {
      return
    }

    if (dashboard.lots.length === 0) {
      return
    }

    openAdjustDialog(dashboard.lots[0])
    setPendingAction(null)
  }, [dashboard.lots, isLoading, pendingAction])

  function openTransferDialog(lot?: InventoryLotView) {
    const lotId = lot?.id ?? dashboard.lots[0]?.id ?? ''
    const nextLot = lotId ? dashboard.lots.find((entry) => entry.id === lotId) ?? lot : lot
    const product =
      nextLot
        ? dashboard.options.products.find((entry) => entry.id === nextLot.productId) ?? null
        : null
    const presentacionId =
      product?.packaging?.basePresentationId ??
      product?.packaging?.presentations[0]?.id ??
      ''

    transferForm.reset({
      ...defaultTransferFormValues,
      lotId,
      presentacionId,
    })
    setIsTransferDialogOpen(true)
  }

  async function handleCreateLot(values: CreateLotFormValues) {
    if (!accessToken) {
      toast.error('La sesión no está disponible.')
      return
    }

    const payload: CreateInventoryLotPayload = {
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
      presentacionId: values.presentacionId,
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
      presentacionId: values.presentacionId,
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

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-4 lg:w-fit">
          <TabsTrigger value="lotes">Stock por lotes</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="alertas">Alertas y FIFO</TabsTrigger>
          <TabsTrigger value="consumo-rt">
            <Wrench className="mr-1 h-4 w-4" /> Consumo ST
          </TabsTrigger>
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
                  Control y ajuste de stock por lote con trazabilidad real.
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
                {isTransferEnabled ? (
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
                ) : null}
                {isManualLotEnabled ? (
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
                ) : null}
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {dashboard.options.branches.length === 0 ||
              dashboard.options.products.length === 0 ? (
                <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning-foreground">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    Aún faltan maestros de sucursal o productos para visualizar inventario. Verifica el seed y vuelve a cargar la pantalla.
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.45fr_0.6fr_0.6fr]">
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

                <Select
                  value={usoServicioTecnicoFilter}
                  onValueChange={(value) =>
                    setUsoServicioTecnicoFilter(value as 'TODOS' | UsoServicioTecnico)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Uso Serv. Técnico" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos los usos</SelectItem>
                    <SelectItem value="SOLO_VENTA">Solo venta</SelectItem>
                    <SelectItem value="SERVICIO_TECNICO">Servicio técnico</SelectItem>
                    <SelectItem value="AMBOS">Ambos</SelectItem>
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
                    Registra una compra o realiza la carga inicial para empezar el control real del inventario.
                  </p>
                </div>
              ) : (
                <>
                  {isTransferEnabled && !canTransferLots ? (
                    <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning-foreground">
                      Agrega al menos una segunda sucursal para habilitar transferencias entre locales.
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead>Lote</TableHead>
                          <TableHead>Ubicación</TableHead>
                          <TableHead>Stock</TableHead>
                          <TableHead>Costo / vencimiento</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleLots.map((lot) => (
                          <TableRow
                            key={lot.id}
                            className="cursor-pointer"
                            onClick={() => openAdjustDialog(lot)}
                          >
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
                                <p className="font-medium text-foreground">
                                  {lot.warehouseName || 'Sin ubicación'}
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
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-small text-muted-foreground">
                        Mostrando {lotsPageStart + 1}-
                        {Math.min(lotsPageStart + lotsPageSize, sortedLots.length)} de{' '}
                        {sortedLots.length}
                      </p>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setLotsPage((current) => Math.max(1, current - 1))}
                          disabled={safeLotsPage <= 1}
                        >
                          Anterior
                        </Button>
                        <span className="text-small text-muted-foreground">
                          Página {safeLotsPage} de {lotsTotalPages}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setLotsPage((current) => Math.min(lotsTotalPages, current + 1))
                          }
                          disabled={safeLotsPage >= lotsTotalPages}
                        >
                          Siguiente
                        </Button>
                      </div>
                    </div>
                  </div>
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
                Entradas, reservas, liberaciones y ajustes por lote.
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
                    {dashboard.movements.map((movement) => {
                      const movementTypeLabel =
                        movement.origin === 'INVENTARIO_INICIAL'
                          ? 'INVENTARIO_INICIAL'
                          : movement.type

                      return (
                        <TableRow key={movement.id}>
                          <TableCell className="text-muted-foreground">
                            {formatDateTime(movement.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getMovementVariant(movementTypeLabel)}>
                              {movementTypeLabel}
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
                      )
                    })}
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
                      <div>
                        <p className="font-medium text-foreground">
                          {index + 1}. {lot.productName}
                        </p>
                        <p className="mt-1 text-small text-muted-foreground">
                          {lot.lotCode} · {formatQuantity(lot.availableUnits)} disponibles · vence{' '}
                          {formatDate(lot.expiryDate)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="consumo-rt" className="space-y-6">
          <AuthorizationGate permission="consumoInventarioRT.write">
            <Card>
              <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-primary" /> Consumo de Repuestos · Servicio Técnico
                  </CardTitle>
                  <CardDescription>
                    Movimientos de inventario asociados a Órdenes de Servicio (Consumo y Devolución).
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="xl"
                  className="min-h-[48px]"
                  onClick={() => void loadMovimientosRT()}
                >
                  <RefreshCcw className="mr-2 h-5 w-5" /> Actualizar
                </Button>
              </CardHeader>
              <CardContent>
                {movimientosRTLoading ? (
                  <div className="flex min-h-56 items-center justify-center rounded-2xl border">
                    <Loader className="h-7 w-7" />
                  </div>
                ) : movimientosRT.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-10 text-center">
                    <p className="text-sm font-medium text-foreground">
                      Sin movimientos de consumo/devolución por Órdenes de Servicio.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Cuando una Orden de Servicio consuma repuestos, quedará registrada aquí con vínculo a la OS.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Producto / Lote</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                          <TableHead>Orden Servicio</TableHead>
                          <TableHead>Técnico</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movimientosRT.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {typeof m.createdAt === 'string' && m.createdAt
                                ? new Date(m.createdAt).toLocaleString('es-PE', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '—'}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  m.tipoMovimiento === 'SERVICIO_TECNICO_CONSUMO'
                                    ? 'default'
                                    : m.tipoMovimiento === 'SERVICIO_TECNICO_DEVOLUCION'
                                      ? 'info'
                                      : 'outline'
                                }
                              >
                                {m.tipoMovimiento === 'SERVICIO_TECNICO_CONSUMO'
                                  ? 'Consumo OS'
                                  : m.tipoMovimiento === 'SERVICIO_TECNICO_DEVOLUCION'
                                    ? 'Devolución OS'
                                    : (m.tipoMovimiento as string)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                <p className="font-medium">{m.productoNombre || '—'}</p>
                                <p className="text-xs text-muted-foreground">
                                  Lote: {m.loteCodigo || '—'}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {m.cantidadSigno ?? (m.tipoMovimiento === 'SERVICIO_TECNICO_DEVOLUCION' ? '+' : '-')}
                              {Math.abs(m.cantidad ?? 0)}
                            </TableCell>
                            <TableCell>
                              {m.ordenServicioNumero ? (
                                <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                  {m.ordenServicioNumero}
                                </span>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {m.tecnicoNombre || '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </AuthorizationGate>
        </TabsContent>
      </Tabs>

      {isManualLotEnabled ? (
        <SidePanel
          open={isCreateDialogOpen}
          onOpenChange={(open) => {
            setIsCreateDialogOpen(open)
            if (!open) {
              createForm.reset(defaultCreateFormValues)
            }
          }}
        >
          <SidePanelContent className="p-0">
            <form
              className="flex h-full flex-col"
              onSubmit={createForm.handleSubmit(handleCreateLot)}
            >
            <div className="flex items-start justify-between gap-4 border-b bg-popover px-6 py-4">
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">Registrar lote</p>
                <p className="text-sm text-muted-foreground">
                  Ingresa un lote real por producto y almacén con control de reservado y bloqueado.
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
              <div className="grid gap-6">
                <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Sucursal</label>
                <Input value={activeBranchName || 'Sin sucursal'} disabled />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Producto</label>
                <Controller
                  control={createForm.control}
                  name="productoId"
                  render={({ field }) => (
                    <LotProductAutocomplete
                      accessToken={accessToken}
                      value={field.value ?? ''}
                      onValueChange={(value) => field.onChange(value)}
                      fallbackProducts={dashboard.options.products}
                      inputKeySuffix={`create-${lotCreateInputKeyRef.current}`}
                    />
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
                <p className="text-xs text-muted-foreground">Opcional. Úsala solo si el producto la reporta.</p>
                <FieldError message={createForm.formState.errors.fechaFabricacion?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha de vencimiento</label>
                <Input type="date" {...createForm.register('fechaVencimiento')} />
                <FieldError message={createForm.formState.errors.fechaVencimiento?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Costo de adquisición</label>
                <Input
                  type="number"
                  step="0.000001"
                  {...createForm.register('costoUnitario', { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">
                  Costo real de compra por unidad base. Se conserva por lote para valorización de inventario, costo de ventas y margen. No modifica los precios de venta del producto.
                </p>
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
                  step="1"
                  {...createForm.register('stockInicial', { valueAsNumber: true })}
                />
                <FieldError message={createForm.formState.errors.stockInicial?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Stock reservado</label>
                <Input
                  type="number"
                  step="1"
                  disabled
                  {...createForm.register('stockReservado', { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">
                  Se inicializa en 0 al crear el lote. Los movimientos posteriores (ventas/reservas) lo actualizarán.
                </p>
                <FieldError message={createForm.formState.errors.stockReservado?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Stock bloqueado</label>
                <Input
                  type="number"
                  step="1"
                  disabled
                  {...createForm.register('stockBloqueado', { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">
                  Se inicializa en 0 al crear el lote. Bloqueos operativos se registran desde el ajuste de stock.
                </p>
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
              </div>
            </div>

            <div className="border-t bg-popover px-6 py-4">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
              </div>
            </div>
            </form>
          </SidePanelContent>
        </SidePanel>
      ) : null}

      <SidePanel
        open={isAdjustDialogOpen}
        onOpenChange={(open) => {
          setIsAdjustDialogOpen(open)
          if (!open) {
            adjustForm.reset(defaultAdjustFormValues)
          }
        }}
      >
        <SidePanelContent className="p-0">
          <form className="flex h-full flex-col" onSubmit={adjustForm.handleSubmit(handleAdjustLot)}>
            <div className="flex items-start justify-between gap-4 border-b bg-popover px-6 py-4">
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">Ajuste operativo de lote</p>
                <p className="text-sm text-muted-foreground">
                  Mueve stock disponible, reservado o bloqueado sin salir del módulo.
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
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Lote</label>
                  <Controller
                    control={adjustForm.control}
                    name="lotId"
                    render={({ field }) => (
                      <SearchableSelect
                        value={field.value || undefined}
                        onValueChange={(nextValue) => {
                          field.onChange(nextValue)
                          const nextLot =
                            dashboard.lots.find((entry) => entry.id === nextValue) ?? null
                          const product =
                            nextLot
                              ? dashboard.options.products.find(
                                  (entry) => entry.id === nextLot.productId,
                                ) ?? null
                              : null
                          const presentacionId =
                            product?.packaging?.basePresentationId ??
                            product?.packaging?.presentations[0]?.id ??
                            ''
                          adjustForm.setValue('presentacionId', presentacionId, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }}
                        options={lotOptions}
                        placeholder="Buscar producto, SKU o código de lote..."
                        searchPlaceholder="Buscar producto, SKU o código de lote..."
                        emptyMessage="No se encontraron lotes con ese texto."
                      />
                    )}
                  />
                  <FieldError message={adjustForm.formState.errors.lotId?.message} />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Presentación</label>
                  <Controller
                    control={adjustForm.control}
                    name="presentacionId"
                    render={({ field }) => (
                      <Select value={field.value || undefined} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona presentación" />
                        </SelectTrigger>
                        <SelectContent>
                          {(selectedAdjustProduct?.packaging?.presentations ?? [])
                            .filter(
                              (entry) => entry.factorToBase !== null && entry.factorToBase > 0,
                            )
                            .map((entry) => (
                              <SelectItem key={entry.id} value={entry.id}>
                                {entry.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError message={adjustForm.formState.errors.presentacionId?.message} />
                </div>

                <div className="rounded-2xl border bg-muted/25 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Stock actual
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <div className="space-y-1 rounded-xl bg-card px-3 py-2 text-center shadow-sm ring-1 ring-border/40">
                      <p className="text-[11px] font-medium text-muted-foreground">Disponible</p>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        {formatQuantity(selectedAdjustLot?.availableUnits ?? 0)}
                      </p>
                    </div>
                    <div className="space-y-1 rounded-xl bg-card px-3 py-2 text-center shadow-sm ring-1 ring-border/40">
                      <p className="text-[11px] font-medium text-muted-foreground">Reservado</p>
                      <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                        {formatQuantity(selectedAdjustLot?.reservedUnits ?? 0)}
                      </p>
                    </div>
                    <div className="space-y-1 rounded-xl bg-card px-3 py-2 text-center shadow-sm ring-1 ring-border/40">
                      <p className="text-[11px] font-medium text-muted-foreground">Bloqueado</p>
                      <p className="text-lg font-bold text-rose-600 dark:text-rose-400">
                        {formatQuantity(selectedAdjustLot?.blockedUnits ?? 0)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo de stock</label>
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
                      min={1}
                      step="1"
                      {...adjustForm.register('quantity', { valueAsNumber: true })}
                    />
                    <FieldError message={adjustForm.formState.errors.quantity?.message} />
                  </div>
                </div>

                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                    Vista previa
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[11px] font-medium uppercase text-muted-foreground">
                        {adjustTarget === 'DISPONIBLE'
                          ? 'Disponible actual'
                          : adjustTarget === 'RESERVADO'
                            ? 'Reservado actual'
                            : 'Bloqueado actual'}
                      </p>
                      <p className="mt-1 text-lg font-bold text-foreground">
                        {formatQuantity(
                          adjustTarget === 'DISPONIBLE'
                            ? selectedAdjustLot?.availableUnits ?? 0
                            : adjustTarget === 'RESERVADO'
                              ? selectedAdjustLot?.reservedUnits ?? 0
                              : selectedAdjustLot?.blockedUnits ?? 0,
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase text-muted-foreground">
                        {adjustTarget === 'DISPONIBLE'
                          ? 'Nuevo disponible'
                          : adjustTarget === 'RESERVADO'
                            ? 'Nuevo reservado'
                            : 'Nuevo bloqueado'}
                      </p>
                      <p
                        className={
                          'mt-1 text-lg font-bold ' +
                          (adjustTarget === 'DISPONIBLE'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : adjustTarget === 'RESERVADO'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-rose-600 dark:text-rose-400')
                        }
                      >
                        {formatQuantity(
                          adjustTarget === 'DISPONIBLE'
                            ? adjustmentPreview.availableUnits
                            : adjustTarget === 'RESERVADO'
                              ? adjustmentPreview.reservedUnits
                              : adjustmentPreview.blockedUnits,
                        )}
                      </p>
                    </div>
                  </div>
                  {selectedAdjustLot &&
                  Number.isFinite(adjustQuantity) &&
                  Number(adjustQuantity) > 0 &&
                  adjustOperation === 'RESTAR' &&
                  adjustTarget === 'DISPONIBLE' &&
                  adjustmentPreview.availableUnits < 0 ? (
                    <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                      No puedes restar una cantidad mayor al stock disponible.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Observaciones</label>
                  <Textarea
                    {...adjustForm.register('observaciones')}
                    placeholder="Motivo del ajuste (ej: diferencia en conteo físico, producto dañado, corrección de inventario)."
                    className="min-h-24"
                  />
                  <FieldError message={adjustForm.formState.errors.observaciones?.message} />
                </div>
              </div>
            </div>

            <div className="border-t bg-popover px-6 py-4">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
              </div>
            </div>
          </form>
        </SidePanelContent>
      </SidePanel>

      {isTransferEnabled ? (
        <SidePanel
          open={isTransferDialogOpen}
          onOpenChange={(open) => {
            setIsTransferDialogOpen(open)
            if (!open) {
              transferForm.reset(defaultTransferFormValues)
            }
          }}
        >
          <SidePanelContent className="p-0">
            <form
              className="flex h-full flex-col"
              onSubmit={transferForm.handleSubmit(handleTransferLot)}
            >
            <div className="flex items-start justify-between gap-4 border-b bg-popover px-6 py-4">
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">
                  Transferir stock entre sucursales
                </p>
                <p className="text-sm text-muted-foreground">
                  Mueve stock disponible del lote y conserva la trazabilidad del mismo número de lote.
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
              <div className="grid gap-6">
                <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Lote origen</label>
                <Controller
                  control={transferForm.control}
                  name="lotId"
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value || undefined}
                      onValueChange={(nextValue) => {
                        field.onChange(nextValue)
                        const nextLot =
                          dashboard.lots.find((entry) => entry.id === nextValue) ?? null
                        const product =
                          nextLot
                            ? dashboard.options.products.find(
                                (entry) => entry.id === nextLot.productId,
                              ) ?? null
                            : null
                        const presentacionId =
                          product?.packaging?.basePresentationId ??
                          product?.packaging?.presentations[0]?.id ??
                          ''
                        transferForm.setValue('presentacionId', presentacionId, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }}
                      options={lotOptions}
                      placeholder="Buscar producto, SKU o código de lote..."
                      searchPlaceholder="Buscar producto, SKU o código de lote..."
                      emptyMessage="No se encontraron lotes con ese texto."
                    />
                  )}
                />
                <FieldError message={transferForm.formState.errors.lotId?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Presentación</label>
                <Controller
                  control={transferForm.control}
                  name="presentacionId"
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona presentación" />
                      </SelectTrigger>
                      <SelectContent>
                        {(selectedTransferProduct?.packaging?.presentations ?? [])
                          .filter(
                            (entry) =>
                              entry.factorToBase !== null && entry.factorToBase > 0,
                          )
                          .map((entry) => (
                            <SelectItem key={entry.id} value={entry.id}>
                              {entry.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError
                  message={transferForm.formState.errors.presentacionId?.message}
                />
              </div>

              <div className="rounded-2xl border bg-muted/20 p-4 md:col-span-2">
                <p className="text-sm font-medium text-foreground">
                  {selectedTransferLot
                    ? `${selectedTransferLot.productName} · ${selectedTransferLot.lotCode}`
                    : 'Selecciona un lote para ver el resumen'}
                </p>
                <p className="mt-2 text-small text-muted-foreground">
                  Disponible {formatQuantity(selectedTransferLot?.availableUnits ?? 0)}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Sucursal origen</label>
                <Input value={activeBranchName || 'Sin sucursal'} disabled />
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
                  step="1"
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
              </div>
            </div>

            <div className="border-t bg-popover px-6 py-4">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
              </div>
            </div>
          </form>
          </SidePanelContent>
        </SidePanel>
      ) : null}
    </div>
  )
}
