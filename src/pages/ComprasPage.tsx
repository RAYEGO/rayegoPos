import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import {
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  Edit3,
  Eye,
  FileDown,
  FileSpreadsheet,
  Loader2,
  PackageCheck,
  PackageOpen,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Share2,
  ShoppingCart,
  Trash2,
  Truck,
  Wallet,
  X,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { FormPaymentMethodTwoLevelSelect } from '@/components/ui/payment-method-selector'
import { useAuth } from '@/hooks/useAuth'
import { useHandleUnauthorized } from '@/hooks/useHandleUnauthorized'
import { ApiError, ApiNetworkError } from '@/services/apiClient'
import { cashierService } from '@/services/cashierService'
import { purchasesService } from '@/services/purchasesService'
import { paths } from '@/routes/paths'
import {
  buildPackagingSummary,
  buildPurchasePresentationChain,
  resolveLabelForPresentationId,
  type PurchasePresentationOption,
} from '@/utils/packaging'
import type {
  CreatePurchaseReceptionPayload,
  CreatePurchaseOrderPayload,
  PurchaseFinancialStatus,
  PurchaseLogisticsStatus,
  PurchaseOrderDetail,
  PurchaseReceiptStatus,
  PurchasesDashboardResponse,
  RegisterPurchasePaymentPayload,
  ReceivePurchaseItemPayload,
  ReturnPurchaseItemPayload,
} from '@/types/purchases'
import type { CreateCashMovementPayload } from '@/types/cashier'
import { toast } from 'sonner'
import { PurchaseOrderDocument } from '@/components/purchases/PurchaseOrderDocument'
import {
  copyPurchaseOrderText,
  generatePurchaseOrderPDFBlob,
  printPurchaseOrderFromElement,
  sharePurchaseOrder,
} from '@/utils/purchaseDocument'
import { formatCurrency, formatQuantity } from '@/lib/utils'

const createPurchaseSchema = z.object({
  proveedorId: z.string().uuid({ message: 'Selecciona un proveedor.' }),
  fechaEmision: z.string().min(1, 'Ingresa la fecha de emisión.'),
  fechaRecepcion: z.string().optional(),
  estado: z.enum(['BORRADOR', 'REGISTRADA']),
  observaciones: z.string().max(255).optional(),
  items: z
    .array(
      z.object({
        productoId: z.string().uuid({ message: 'Selecciona un producto.' }),
        cantidad: z.number().int().positive('La cantidad debe ser mayor a 0.'),
        costoUnitario: z.number().nonnegative('El costo debe ser mayor o igual a 0.'),
        porcentajeImpuesto: z
          .number()
          .min(0, 'El impuesto no puede ser negativo.')
          .max(100, 'El impuesto no puede superar 100.'),
      }),
    )
    .min(1, 'Agrega al menos una línea.'),
})

type CreatePurchaseFormValues = z.infer<typeof createPurchaseSchema>

const receivePurchaseSchema = z.object({
  numeroLote: z.string().min(1, 'Ingresa el número de lote.').max(80),
  fechaFabricacion: z.string().optional(),
  fechaVencimiento: z.string().min(1, 'Ingresa la fecha de vencimiento.'),
  cantidadRecibida: z.number().int().positive('La cantidad recibida debe ser mayor a 0.'),
  stockReservado: z.number().int().min(0, 'El stock reservado no puede ser negativo.'),
  stockBloqueado: z.number().int().min(0, 'El stock bloqueado no puede ser negativo.'),
  almacen: z.string().max(120).optional(),
  observaciones: z.string().max(255).optional(),
})

type ReceivePurchaseFormValues = z.infer<typeof receivePurchaseSchema>

const returnPurchaseSchema = z.object({
  target: z.enum(['DISPONIBLE', 'RESERVADO', 'BLOQUEADO']),
  quantity: z.number().int().positive('La cantidad a devolver debe ser mayor a 0.'),
  observaciones: z.string().max(255).optional(),
})

type ReturnPurchaseFormValues = z.infer<typeof returnPurchaseSchema>

const registerPaymentSchema = z.object({
  formaPagoId: z.string().uuid({ message: 'Selecciona una forma de pago.' }),
  fechaPago: z.string().min(1, 'Ingresa la fecha de pago.'),
  monto: z.number().positive('El monto debe ser mayor a 0.'),
  referenciaExterna: z.string().max(120).optional(),
  observaciones: z.string().max(255).optional(),
})

type RegisterPaymentFormValues = z.infer<typeof registerPaymentSchema>

const registerCashIncomeSchema = z.object({
  paymentMethodId: z.string().min(1, 'Selecciona un medio de dinero.'),
  amount: z.number().positive('El monto debe ser mayor a 0.'),
  concept: z.string().min(1, 'Selecciona un motivo de ingreso.').max(120),
  reference: z.string().max(120).optional(),
  observations: z.string().max(255).optional(),
})

type RegisterCashIncomeFormValues = z.infer<typeof registerCashIncomeSchema>

type LoteReceiptDraft = {
  id: string
  numeroLote: string
  fechaFabricacion: string
  fechaVencimiento: string
  cantidadRecibida: number
  stockReservado: number
  stockBloqueado: number
  costoUnitarioRecepcion: number
}

type LineReceiptDraft = {
  detailId: string
  productId: string
  productName: string
  sku: string
  unitSymbol: string
  presentationId: string
  presentationName: string
  presentationFactor: number
  requestedPresentationQty: number
  requestedBaseUnits: number
  previouslyReceivedPresentationUnits: number
  previouslyReceivedBaseUnits: number
  pendingPresentationUnits: number
  pendingBaseUnits: number
  receivedPresentationQty: number
  receivedBaseUnits: number
  missingPresentationQty: number
  missingBaseUnits: number
  unitCostPresentation: number
  packaging: {
    basePresentationId: string | null
    purchasePresentationId: string | null
    presentations: PurchasePresentationOption[]
  } | null
  include: boolean
  almacen: string
  observacionesLinea: string
  lotes: LoteReceiptDraft[]
  equivalenceText: string
}

const RECEPTION_LOTES_DEFAULT_LIMIT = 5

const today = new Date().toISOString().slice(0, 10)

const defaultFormValues: CreatePurchaseFormValues = {
  proveedorId: '',
  fechaEmision: today,
  fechaRecepcion: '',
  estado: 'REGISTRADA',
  observaciones: '',
  items: [],
}

const defaultReceiveFormValues: ReceivePurchaseFormValues = {
  numeroLote: '',
  fechaFabricacion: '',
  fechaVencimiento: '',
  cantidadRecibida: 1,
  stockReservado: 0,
  stockBloqueado: 0,
  almacen: '',
  observaciones: '',
}

const defaultReturnFormValues: ReturnPurchaseFormValues = {
  target: 'DISPONIBLE',
  quantity: 1,
  observaciones: '',
}

const defaultPaymentFormValues: RegisterPaymentFormValues = {
  formaPagoId: '',
  fechaPago: new Date().toISOString().slice(0, 10),
  monto: 0,
  referenciaExterna: '',
  observaciones: '',
}

const defaultCashIncomeFormValues: RegisterCashIncomeFormValues = {
  paymentMethodId: '',
  amount: 0,
  concept: 'Fondo adicional',
  reference: '',
  observations: '',
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Pendiente'
  }

  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Pendiente'
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

function getApiErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof ApiNetworkError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'No fue posible completar la operación.'
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <p className="text-xs text-destructive">{message}</p>
}

function getLogisticsStatusVariant(status: PurchaseLogisticsStatus) {
  if (status === 'RECEPCION_COMPLETA') return 'success'
  if (status === 'RECEPCION_PARCIAL' || status === 'EN_RECEPCION') return 'info'
  if (status === 'REGISTRADA') return 'warning'
  return 'destructive'
}

function getFinancialStatusVariant(status: PurchaseFinancialStatus) {
  if (status === 'PAGADA') return 'success'
  if (status === 'PAGO_PARCIAL') return 'info'
  return 'warning'
}

function formatLogisticsStatus(status: PurchaseLogisticsStatus) {
  if (status === 'REGISTRADA') return 'Registrada'
  if (status === 'EN_RECEPCION') return 'En recepción'
  if (status === 'RECEPCION_PARCIAL') return 'Recepción parcial'
  if (status === 'RECEPCION_COMPLETA') return 'Recepción completa'
  return 'Cancelada'
}

function formatFinancialStatus(status: PurchaseFinancialStatus) {
  if (status === 'SIN_PAGAR') return 'Sin pagar'
  if (status === 'PAGO_PARCIAL') return 'Pago parcial'
  return 'Pagada'
}

function getReceiptStatusVariant(status: PurchaseReceiptStatus) {
  if (status === 'RECIBIDA') return 'success'
  if (status === 'PROGRAMADA') return 'info'
  return 'warning'
}

export function ComprasPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const accessToken = session?.accessToken ?? ''
  const activeBranchName = session?.user.branchName ?? ''
  const handleUnauthorized = useHandleUnauthorized('ComprasPage')
  const handleUnauthorizedRef = useRef(handleUnauthorized)
  handleUnauthorizedRef.current = handleUnauthorized
  const [search, setSearch] = useState('')
  const [logisticsStatusFilter, setLogisticsStatusFilter] = useState<
    'TODAS' | PurchaseLogisticsStatus
  >('TODAS')
  const [dashboard, setDashboard] = useState<PurchasesDashboardResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingPurchaseOrderId, setEditingPurchaseOrderId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedViewOrderId, setSelectedViewOrderId] = useState<string | null>(null)
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<PurchaseOrderDetail | null>(null)
  const [isOrderDetailLoading, setIsOrderDetailLoading] = useState(false)
  const orderDocumentRef = useRef<HTMLDivElement>(null)
  const [ordersPage, setOrdersPage] = useState(1)
  const ordersPageSize = 4
  const [isReceiveDialogOpen, setIsReceiveDialogOpen] = useState(false)
  const [isReceiving, setIsReceiving] = useState(false)
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null)
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false)
  const [isReturning, setIsReturning] = useState(false)
  const [selectedReturnReceiptId, setSelectedReturnReceiptId] = useState<string | null>(null)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isPaying, setIsPaying] = useState(false)
  const [selectedPaymentOrderId, setSelectedPaymentOrderId] = useState<string | null>(null)
  const [isOrderReceiveDialogOpen, setIsOrderReceiveDialogOpen] = useState(false)
  const [isClosingOrderReceipt, setIsClosingOrderReceipt] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [orderReceiptDrafts, setOrderReceiptDrafts] = useState<LineReceiptDraft[]>([])
  const [isOrderSummaryDialogOpen, setIsOrderSummaryDialogOpen] = useState(false)
  const [selectedSummaryOrderId, setSelectedSummaryOrderId] = useState<string | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  const [isCashShortageDialogOpen, setIsCashShortageDialogOpen] = useState(false)
  const [cashShortage, setCashShortage] = useState<{
    openingId: string
    available: number
    required: number
    missing: number
  } | null>(null)
  const [incomeMethodBalance, setIncomeMethodBalance] = useState<{
    available: number
    loading: boolean
  } | null>(null)
  const [isCashIncomeDialogOpen, setIsCashIncomeDialogOpen] = useState(false)
  const [isRegisteringCashIncome, setIsRegisteringCashIncome] = useState(false)
  const [isMissingCashDrawerDialogOpen, setIsMissingCashDrawerDialogOpen] = useState(false)
  const globalProductoSearchTextRef = useRef('')
  const [globalProductoSearchText, setGlobalProductoSearchText] = useState('')
  const [globalProductoSearchOpen, setGlobalProductoSearchOpen] = useState<boolean>(false)
  const [createLineaPresentacionId, setCreateLineaPresentacionId] = useState<Record<number, string>>({})

  const form = useForm<CreatePurchaseFormValues>({
    resolver: zodResolver(createPurchaseSchema),
    defaultValues: defaultFormValues,
  })

  const receiveForm = useForm<ReceivePurchaseFormValues>({
    resolver: zodResolver(receivePurchaseSchema),
    defaultValues: defaultReceiveFormValues,
  })

  const returnForm = useForm<ReturnPurchaseFormValues>({
    resolver: zodResolver(returnPurchaseSchema),
    defaultValues: defaultReturnFormValues,
  })

  const paymentForm = useForm<RegisterPaymentFormValues>({
    resolver: zodResolver(registerPaymentSchema),
    defaultValues: defaultPaymentFormValues,
  })

  const cashIncomeForm = useForm<RegisterCashIncomeFormValues>({
    resolver: zodResolver(registerCashIncomeSchema),
    defaultValues: defaultCashIncomeFormValues,
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  const watchedItems =
    useWatch({
      control: form.control,
      name: 'items',
    }) ?? []
  const watchedFechaEmision =
    useWatch({
      control: form.control,
      name: 'fechaEmision',
    }) ?? today
  const watchedReceivedUnits = Number(receiveForm.watch('cantidadRecibida')) || 0
  const watchedReservedUnits = Number(receiveForm.watch('stockReservado')) || 0
  const watchedBlockedUnits = Number(receiveForm.watch('stockBloqueado')) || 0
  const watchedReturnTarget = returnForm.watch('target')
  const watchedReturnQuantity = Number(returnForm.watch('quantity')) || 0
  const watchedPaymentMethodId = paymentForm.watch('formaPagoId')
  const watchedPaymentAmount = Number(paymentForm.watch('monto')) || 0
  const watchedIncomePaymentMethodId = cashIncomeForm.watch('paymentMethodId')

  const draftLineTotals = useMemo(
    () =>
      watchedItems.map((item) => {
        const quantity = Number(item.cantidad)
        const unitCost = Number(item.costoUnitario)
        const taxRate = Number(item.porcentajeImpuesto)

        const safeQuantity = Number.isFinite(quantity) ? quantity : 0
        const safeUnitCost = Number.isFinite(unitCost) ? unitCost : 0
        const safeTaxRate = Number.isFinite(taxRate) ? taxRate : 0
        const subtotal = safeQuantity * safeUnitCost
        const igv = subtotal * (safeTaxRate / 100)
        const total = subtotal + igv

        return { subtotal, igv, total }
      }),
    [watchedItems],
  )

  const draftTotals = useMemo(() => {
    return draftLineTotals.reduce(
      (summary, item) => {
        summary.subtotal += item.subtotal
        summary.tax += item.igv
        summary.total += item.total
        return summary
      },
      { subtotal: 0, tax: 0, total: 0 },
    )
  }, [draftLineTotals])

  const loadDashboard = useCallback(async () => {
    if (!accessToken) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await purchasesService.getDashboard(accessToken, {
        search,
        logisticsStatus: logisticsStatusFilter === 'TODAS' ? undefined : logisticsStatusFilter,
      })

      setDashboard(response)
    } catch (nextError) {
      const message = getApiErrorMessage(nextError)
      setError(message)
      if (nextError instanceof ApiError) {
        if (nextError.status === 401) {
          await handleUnauthorizedRef.current(nextError.status, nextError.message, 'purchases.loadDashboard')
          return
        }
        if (nextError.status === 409) {
          toast.error('No se pudo cargar el módulo de compras', {
            description: message,
          })
        } else {
          toast.error(message)
        }
      } else {
        toast.error(message)
      }
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, search, logisticsStatusFilter])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    if (!selectedViewOrderId) {
      setSelectedOrderDetail(null)
      return
    }
    if (!accessToken) return

    let cancelled = false
    async function run() {
      setIsOrderDetailLoading(true)
      try {
        const detail = await purchasesService.getOrderById(accessToken, selectedViewOrderId!)
        if (cancelled) return
        setSelectedOrderDetail(detail)
      } catch (nextError) {
        if (cancelled) return
        toast.error(getApiErrorMessage(nextError))
        setSelectedViewOrderId(null)
      } finally {
        if (!cancelled) setIsOrderDetailLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [selectedViewOrderId, accessToken, loadDashboard])

  useEffect(() => {
    if (!dashboard) {
      return
    }

    const raw = window.sessionStorage.getItem('pos_pending_purchase_payment')
    if (!raw) {
      return
    }

    try {
      const parsed = JSON.parse(raw) as {
        orderId: string
        values: RegisterPaymentFormValues
      }
      const order = dashboard.orders.find((entry) => entry.id === parsed.orderId)
      if (!order) {
        window.sessionStorage.removeItem('pos_pending_purchase_payment')
        return
      }

      setSelectedPaymentOrderId(order.id)
      paymentForm.reset(parsed.values)
      setIsPaymentDialogOpen(true)
      window.sessionStorage.removeItem('pos_pending_purchase_payment')
    } catch {
      window.sessionStorage.removeItem('pos_pending_purchase_payment')
    }
  }, [dashboard, paymentForm])

  useEffect(() => {
    if (!isCashIncomeDialogOpen || !watchedIncomePaymentMethodId || !accessToken) {
      setIncomeMethodBalance(null)
      return
    }

    let cancelled = false
    setIncomeMethodBalance({ available: 0, loading: true })

    async function run() {
      try {
        const activeDrawer = await cashierService.getActiveDrawer(
          accessToken,
          watchedIncomePaymentMethodId,
        )
        if (cancelled) return
        setIncomeMethodBalance({
          available: Number(activeDrawer.expectedAmount.toFixed(2)),
          loading: false,
        })
      } catch {
        if (cancelled) return
        setIncomeMethodBalance({ available: 0, loading: false })
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [watchedIncomePaymentMethodId, isCashIncomeDialogOpen, accessToken])

  useEffect(() => {
    setOrdersPage(1)
  }, [search, logisticsStatusFilter])

  const purchaseMetrics = {
    totalOrders: dashboard?.summary?.totalOrders ?? 0,
    activeOrders: dashboard?.summary?.activeOrders ?? 0,
    scheduledReceipts: dashboard?.summary?.scheduledReceipts ?? 0,
    observedReceipts: dashboard?.summary?.observedReceipts ?? 0,
    activeSpend: dashboard?.summary?.activeSpend ?? 0,
    returnedAmount: dashboard?.summary?.returnedAmount ?? 0,
    netSpend: dashboard?.summary?.netSpend ?? 0,
    totalPaid: dashboard?.summary?.totalPaid ?? 0,
    pendingPayables: dashboard?.summary?.pendingPayables ?? 0,
    supplierCount: dashboard?.summary?.supplierCount ?? 0,
  }

  const orders = dashboard?.orders ?? []
  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => parseDateValue(b.createdAt) - parseDateValue(a.createdAt))
  }, [orders])
  const ordersTotalPages = Math.max(1, Math.ceil(sortedOrders.length / ordersPageSize))
  const safeOrdersPage = Math.min(ordersPage, ordersTotalPages)
  const ordersPageStart = (safeOrdersPage - 1) * ordersPageSize
  const visibleOrders = sortedOrders.slice(ordersPageStart, ordersPageStart + ordersPageSize)
  const receipts = dashboard?.receipts ?? []
  const suppliers = dashboard?.supplierSummary ?? []
  const payments = dashboard?.payments ?? []
  const selectedReceipt =
    receipts.find((receipt) => receipt.id === selectedReceiptId) ?? null
  const selectedReturnReceipt =
    receipts.find((receipt) => receipt.id === selectedReturnReceiptId) ?? null
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? null
  const selectedPaymentOrder =
    orders.find((order) => order.id === selectedPaymentOrderId) ?? null
  const selectedSummaryOrder =
    orders.find((order) => order.id === selectedSummaryOrderId) ?? null
  const options = {
    branches: dashboard?.options?.branches ?? [],
    suppliers: dashboard?.options?.suppliers ?? [],
    paymentMethods: dashboard?.options?.paymentMethods ?? [],
    products: dashboard?.options?.products ?? [],
  }

  const canCreateOrders = options.branches.length > 0 && options.suppliers.length > 0

  const receiveAvailableUnits = Math.max(
    0,
    watchedReceivedUnits - watchedReservedUnits - watchedBlockedUnits,
  )

  const receiptGroupsByOrder = useMemo(() => {
    return orders.reduce(
      (groups, order) => {
        const orderReceipts = receipts.filter((receipt) => receipt.purchaseId === order.id)
        const pendingReceipts = orderReceipts.filter((receipt) => receipt.pendingUnits > 0)

        groups[order.id] = {
          totalLines: orderReceipts.length,
          pendingLines: pendingReceipts.length,
          pendingUnits: pendingReceipts.reduce((sum, receipt) => sum + receipt.pendingUnits, 0),
          receipts: orderReceipts,
          pendingReceipts,
        }

        return groups
      },
      {} as Record<
        string,
        {
          totalLines: number
          pendingLines: number
          pendingUnits: number
          receipts: PurchasesDashboardResponse['receipts']
          pendingReceipts: PurchasesDashboardResponse['receipts']
        }
      >,
    )
  }, [orders, receipts])

  const selectedOrderReceiptGroup = selectedOrderId
    ? receiptGroupsByOrder[selectedOrderId]
    : null
  const selectedSummaryReceiptGroup = selectedSummaryOrderId
    ? receiptGroupsByOrder[selectedSummaryOrderId]
    : null

  const selectedOrderAvailableUnits = orderReceiptDrafts.reduce((sum, line) => {
    if (!line.include) {
      return sum
    }

    const lineTotalReceived = line.lotes.reduce(
      (loteSum, lote) =>
        loteSum +
        Math.max(
          0,
          (lote.cantidadRecibida || 0) - (lote.stockReservado || 0) - (lote.stockBloqueado || 0),
        ),
      0,
    )
    const factor = line.presentationFactor ?? 1
    return sum + lineTotalReceived * factor
  }, 0)

  const selectedSummaryTotals = selectedSummaryReceiptGroup
    ? {
        receivedUnits: selectedSummaryReceiptGroup.receipts.reduce(
          (sum, item) => sum + item.receivedUnits,
          0,
        ),
        pendingUnits: selectedSummaryReceiptGroup.pendingUnits,
        returnedUnits: selectedSummaryReceiptGroup.receipts.reduce(
          (sum, item) => sum + item.returnedUnits,
          0,
        ),
        returnedAmount: selectedSummaryReceiptGroup.receipts.reduce(
          (sum, item) => sum + item.returnedAmount,
          0,
        ),
        observedLines: selectedSummaryReceiptGroup.receipts.filter(
          (item) => item.status === 'OBSERVADA',
        ).length,
      }
    : null

  const selectedReturnStock = selectedReturnReceipt
    ? watchedReturnTarget === 'RESERVADO'
      ? selectedReturnReceipt.reservedUnits
      : watchedReturnTarget === 'BLOQUEADO'
        ? selectedReturnReceipt.blockedUnits
        : selectedReturnReceipt.availableUnits
    : 0
  const selectedPaymentMethod =
    options.paymentMethods.find((method) => method.id === watchedPaymentMethodId) ?? null

  async function handleCreateOrder(values: CreatePurchaseFormValues) {
    if (!accessToken) {
      toast.error('La sesión no está disponible.')
      return
    }

    const payload: CreatePurchaseOrderPayload = {
      proveedorId: values.proveedorId,
      fechaEmision: values.fechaEmision,
      fechaRecepcion: values.fechaRecepcion?.trim() || undefined,
      estado: values.estado,
      observaciones: values.observaciones?.trim() || undefined,
      items: values.items.map((item) => ({
        productoId: item.productoId,
        cantidad: Number(item.cantidad),
        costoUnitario: Number(item.costoUnitario),
        porcentajeImpuesto: Number(item.porcentajeImpuesto),
      })),
    }

    setIsSubmitting(true)

    try {
      const response = editingPurchaseOrderId
        ? await purchasesService.updateOrder(accessToken, editingPurchaseOrderId, payload)
        : await purchasesService.createOrder(accessToken, payload)

      toast.success(
        editingPurchaseOrderId
          ? 'Orden de compra actualizada correctamente.'
          : 'Orden de compra registrada correctamente. Ya puedes compartirla o preparar la recepción.',
      )
      setIsCreateDialogOpen(false)
      setEditingPurchaseOrderId(null)
      form.reset({
        ...defaultFormValues,
        fechaEmision: new Date().toISOString().slice(0, 10),
      })
      await loadDashboard()
      if (response?.item?.id) {
        setSelectedViewOrderId(response.item.id)
      }
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorizedRef.current(nextError.status, nextError.message, 'purchases.createOrUpdateOrder')
        return
      }

      toast.error(getApiErrorMessage(nextError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function openEditOrder(orderId: string) {
    if (!accessToken) {
      toast.error('La sesión no está disponible.')
      return
    }

    try {
      const detail = await purchasesService.getOrderById(accessToken, orderId)
      const formValues: CreatePurchaseFormValues = {
        proveedorId: detail.supplier.id,
        fechaEmision: detail.fechaEmision ?? new Date().toISOString().slice(0, 10),
        fechaRecepcion: detail.fechaRecepcionEsperada ?? '',
        estado: (detail.order.status === 'BORRADOR' || detail.order.status === 'REGISTRADA'
          ? detail.order.status
          : 'REGISTRADA') as CreatePurchaseFormValues['estado'],
        observaciones: detail.observaciones ?? '',
        items: detail.items.map((item) => ({
          productoId: item.productId,
          cantidad: item.presentationQuantity,
          costoUnitario: item.unitCostPresentation,
          porcentajeImpuesto: item.taxRate,
        })),
      }

      form.reset(formValues)
      setEditingPurchaseOrderId(orderId)
      setIsCreateDialogOpen(true)
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorizedRef.current(nextError.status, nextError.message, 'purchases.getOrderById')
        return
      }
      toast.error(getApiErrorMessage(nextError))
    }
  }

  function openReceiveDialog(receipt: PurchasesDashboardResponse['receipts'][number]) {
    setSelectedReceiptId(receipt.id)
    const pendingQuantity =
      typeof receipt.pendingPresentationQuantity === 'number' &&
      receipt.pendingPresentationQuantity > 0
        ? receipt.pendingPresentationQuantity
        : receipt.pendingUnits
    receiveForm.reset({
      ...defaultReceiveFormValues,
      cantidadRecibida: Math.max(1, Math.floor(pendingQuantity)),
    })
    setIsReceiveDialogOpen(true)
  }

  async function handleReceiveItem(values: ReceivePurchaseFormValues) {
    if (!accessToken || !selectedReceipt) {
      toast.error('La recepción seleccionada no está disponible.')
      return
    }

    const payload: ReceivePurchaseItemPayload = {
      detalleCompraId: selectedReceipt.id,
      numeroLote: values.numeroLote.trim(),
      fechaFabricacion: values.fechaFabricacion?.trim() || undefined,
      fechaVencimiento: values.fechaVencimiento,
      cantidadRecibida: Number(values.cantidadRecibida),
      stockReservado: Number(values.stockReservado),
      stockBloqueado: Number(values.stockBloqueado),
      almacen: values.almacen?.trim() || undefined,
      observaciones: values.observaciones?.trim() || undefined,
    }

    setIsReceiving(true)

    try {
      await purchasesService.receiveItem(accessToken, payload)
      toast.success('Recepción registrada y lote creado correctamente.')
      setIsReceiveDialogOpen(false)
      setSelectedReceiptId(null)
      receiveForm.reset(defaultReceiveFormValues)
      await loadDashboard()
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorizedRef.current(nextError.status, nextError.message, 'purchases.receiveItem')
        return
      }

      toast.error(getApiErrorMessage(nextError))
    } finally {
      setIsReceiving(false)
    }
  }

  function openReturnDialog(receipt: PurchasesDashboardResponse['receipts'][number]) {
    if (!receipt.lotId) {
      toast.error('La línea seleccionada todavía no tiene un lote válido para devolución.')
      return
    }

    const defaultTarget =
      receipt.availableUnits > 0
        ? 'DISPONIBLE'
        : receipt.reservedUnits > 0
          ? 'RESERVADO'
          : 'BLOQUEADO'

    const defaultQuantity =
      defaultTarget === 'RESERVADO'
        ? receipt.reservedUnits
        : defaultTarget === 'BLOQUEADO'
          ? receipt.blockedUnits
          : receipt.availableUnits

    setSelectedReturnReceiptId(receipt.id)
    returnForm.reset({
      target: defaultTarget,
      quantity: Math.max(1, Math.floor(defaultQuantity)),
      observaciones: '',
    })
    setIsReturnDialogOpen(true)
  }

  async function handleReturnItem(values: ReturnPurchaseFormValues) {
    if (!accessToken || !selectedReturnReceipt?.lotId) {
      toast.error('La devolución seleccionada no está disponible.')
      return
    }

    const payload: ReturnPurchaseItemPayload = {
      lotId: selectedReturnReceipt.lotId,
      target: values.target,
      quantity: Number(values.quantity),
      observaciones: values.observaciones?.trim() || undefined,
    }

    setIsReturning(true)

    try {
      await purchasesService.returnItem(accessToken, payload)
      toast.success('Devolución registrada correctamente en compras e inventario.')
      setIsReturnDialogOpen(false)
      setSelectedReturnReceiptId(null)
      returnForm.reset(defaultReturnFormValues)
      await loadDashboard()
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorizedRef.current(nextError.status, nextError.message, 'purchases.returnItem')
        return
      }

      toast.error(getApiErrorMessage(nextError))
    } finally {
      setIsReturning(false)
    }
  }

  function openPaymentDialog(order: PurchasesDashboardResponse['orders'][number]) {
    setSelectedPaymentOrderId(order.id)
    paymentForm.reset({
      ...defaultPaymentFormValues,
      monto: Number(order.adjustedPendingAmount.toFixed(2)),
      fechaPago: new Date().toISOString().slice(0, 10),
    })
    setIsPaymentDialogOpen(true)
  }

  async function handleRegisterPayment(values: RegisterPaymentFormValues) {
    if (!accessToken || !selectedPaymentOrder) {
      toast.error('La orden seleccionada no está disponible para pago.')
      return
    }

    const requiredAmount = Number(values.monto)

    try {
      const activeDrawer = await cashierService.getActiveDrawer(accessToken, values.formaPagoId)

      if (activeDrawer.expectedAmount + 0.0001 < requiredAmount) {
        const available = activeDrawer.expectedAmount
        const missing = Number(Math.max(0, requiredAmount - available).toFixed(2))

        setCashShortage({
          openingId: activeDrawer.openingId,
          available,
          required: requiredAmount,
          missing,
        })
        setIsCashShortageDialogOpen(true)
        cashIncomeForm.reset({
          ...defaultCashIncomeFormValues,
          amount: missing,
          reference: selectedPaymentOrder.code,
        })
        return
      }
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorizedRef.current(nextError.status, nextError.message, 'cashier.getActiveDrawer')
        return
      }

      if (nextError instanceof ApiError && nextError.status === 404) {
        setIsMissingCashDrawerDialogOpen(true)
        return
      }

      toast.error(getApiErrorMessage(nextError))
      return
    }

    const payload: RegisterPurchasePaymentPayload = {
      compraId: selectedPaymentOrder.id,
      formaPagoId: values.formaPagoId,
      fechaPago: values.fechaPago,
      monto: Number(values.monto),
      referenciaExterna: values.referenciaExterna?.trim() || undefined,
      observaciones: values.observaciones?.trim() || undefined,
    }

    setIsPaying(true)

    try {
      await purchasesService.registerPayment(accessToken, payload)
      toast.success('Pago registrado correctamente en cuentas por pagar.')
      setIsPaymentDialogOpen(false)
      setSelectedPaymentOrderId(null)
      paymentForm.reset(defaultPaymentFormValues)
      setIsCashShortageDialogOpen(false)
      setCashShortage(null)
      await loadDashboard()
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorizedRef.current(nextError.status, nextError.message, 'purchases.registerPayment')
        return
      }

      if (nextError instanceof ApiError && nextError.status === 409) {
        try {
          const activeDrawer = await cashierService.getActiveDrawer(accessToken, values.formaPagoId)
          const available = activeDrawer.expectedAmount
          const missing = Number(Math.max(0, requiredAmount - available).toFixed(2))

          setCashShortage({
            openingId: activeDrawer.openingId,
            available,
            required: requiredAmount,
            missing,
          })
          setIsCashShortageDialogOpen(true)
          cashIncomeForm.reset({
            ...defaultCashIncomeFormValues,
            amount: missing,
            reference: selectedPaymentOrder.code,
          })
          return
        } catch (drawerError) {
          if (drawerError instanceof ApiError && drawerError.status === 404) {
            setIsMissingCashDrawerDialogOpen(true)
            return
          }

          toast.error(getApiErrorMessage(drawerError))
          return
        }
      }

      toast.error(getApiErrorMessage(nextError))
    } finally {
      setIsPaying(false)
    }
  }

  async function handleRegisterCashIncome(values: RegisterCashIncomeFormValues) {
    if (!accessToken || !cashShortage) {
      toast.error('No hay una caja activa disponible para registrar el ingreso.')
      return
    }
    if (!values.paymentMethodId) {
      toast.error('Selecciona el medio de dinero del ingreso.')
      return
    }

    const payload: CreateCashMovementPayload = {
      openingId: cashShortage.openingId,
      type: 'INGRESO',
      paymentMethodId: values.paymentMethodId,
      amount: Number(values.amount),
      concept: values.concept,
      reference: values.reference?.trim() || undefined,
      observations: values.observations?.trim() || undefined,
    }

    setIsRegisteringCashIncome(true)

    try {
      await cashierService.createMovement(accessToken, payload)
      toast.success('Ingreso registrado. Puedes completar el pago al proveedor.')
      setIsCashIncomeDialogOpen(false)
      cashIncomeForm.reset(defaultCashIncomeFormValues)
      await handleRegisterPayment(paymentForm.getValues())
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorizedRef.current(nextError.status, nextError.message, 'cashier.createMovement')
        return
      }

      toast.error(getApiErrorMessage(nextError))
    } finally {
      setIsRegisteringCashIncome(false)
    }
  }

  function updateOrderReceiptDraft(
    detailId: string,
    patch: Partial<LineReceiptDraft> | null,
    opts?: { loteId?: string; lotePatch?: Partial<LoteReceiptDraft> },
  ) {
    setOrderReceiptDrafts((current) =>
      current.map((line) => {
        if (line.detailId !== detailId) return line

        let nextLine = patch ? { ...line, ...patch } : line

        if (opts?.loteId && opts.lotePatch) {
          nextLine = {
            ...nextLine,
            lotes: nextLine.lotes.map((lote) =>
              lote.id === opts.loteId ? { ...lote, ...opts.lotePatch } : lote,
            ),
          }

          const totalReceivedPresentation = nextLine.lotes.reduce(
            (sum, l) => sum + (Number(l.cantidadRecibida) || 0),
            0,
          )
          const totalReceivedBase = totalReceivedPresentation * (nextLine.presentationFactor ?? 1)
          nextLine = {
            ...nextLine,
            receivedPresentationQty: totalReceivedPresentation,
            receivedBaseUnits: totalReceivedBase,
            missingPresentationQty: Math.max(
              0,
              nextLine.pendingPresentationUnits - totalReceivedPresentation,
            ),
            missingBaseUnits: Math.max(
              0,
              nextLine.pendingBaseUnits - totalReceivedBase,
            ),
          }
        }

        return nextLine
      }),
    )
  }

  function addLoteToReceiptDraft(detailId: string) {
    setOrderReceiptDrafts((current) =>
      current.map((line) => {
        if (line.detailId !== detailId) return line
        if (line.lotes.length >= RECEPTION_LOTES_DEFAULT_LIMIT) {
          toast.warning(
            `Se alcanzó el límite de ${RECEPTION_LOTES_DEFAULT_LIMIT} lotes por línea en esta recepción.`,
          )
          return line
        }

        const nextLoteIndex = line.lotes.length + 1
        const remaining = Math.max(
          0,
          line.pendingPresentationUnits -
            line.lotes.reduce((sum, l) => sum + (Number(l.cantidadRecibida) || 0), 0),
        )
        const newLote: LoteReceiptDraft = {
          id: crypto.randomUUID(),
          numeroLote: `LOTE-${Date.now().toString().slice(-6)}-${nextLoteIndex}`,
          fechaFabricacion: '',
          fechaVencimiento: '',
          cantidadRecibida: Math.max(1, Math.min(remaining, line.pendingPresentationUnits)),
          stockReservado: 0,
          stockBloqueado: 0,
          costoUnitarioRecepcion: line.unitCostPresentation ?? 0,
        }
        const nextLotes = [...line.lotes, newLote]
        const totalReceived = nextLotes.reduce(
          (sum, l) => sum + (Number(l.cantidadRecibida) || 0),
          0,
        )
        const totalBase = totalReceived * (line.presentationFactor ?? 1)
        return {
          ...line,
          lotes: nextLotes,
          receivedPresentationQty: totalReceived,
          receivedBaseUnits: totalBase,
          missingPresentationQty: Math.max(0, line.pendingPresentationUnits - totalReceived),
          missingBaseUnits: Math.max(0, line.pendingBaseUnits - totalBase),
        }
      }),
    )
  }

  function removeLoteFromReceiptDraft(detailId: string, loteId: string) {
    setOrderReceiptDrafts((current) =>
      current.map((line) => {
        if (line.detailId !== detailId) return line
        if (line.lotes.length <= 1) {
          toast.error('Cada línea debe tener al menos un lote para la recepción.')
          return line
        }
        const nextLotes = line.lotes.filter((l) => l.id !== loteId)
        const totalReceived = nextLotes.reduce(
          (sum, l) => sum + (Number(l.cantidadRecibida) || 0),
          0,
        )
        const totalBase = totalReceived * (line.presentationFactor ?? 1)
        return {
          ...line,
          lotes: nextLotes,
          receivedPresentationQty: totalReceived,
          receivedBaseUnits: totalBase,
          missingPresentationQty: Math.max(0, line.pendingPresentationUnits - totalReceived),
          missingBaseUnits: Math.max(0, line.pendingBaseUnits - totalBase),
        }
      }),
    )
  }

  function openOrderReceiveDialog(orderId: string) {
    const order = orders.find((entry) => entry.id === orderId)
    const detailItems =
      selectedOrderDetail && selectedOrderDetail.order.id === orderId
        ? selectedOrderDetail.items
        : null
    const pendingReceipts = receiptGroupsByOrder[orderId]?.pendingReceipts ?? []

    if (!order) {
      toast.error('La orden seleccionada no está disponible.')
      return
    }

    if (detailItems) {
      const pendingItems = detailItems.filter(
        (item) => item.baseQuantity - item.receivedBaseUnits > 0,
      )

      if (pendingItems.length === 0) {
        toast.error('La orden seleccionada ya no tiene líneas pendientes por recepcionar.')
        return
      }

      const nextDrafts: LineReceiptDraft[] = pendingItems.map((item, index) => {
        const requestedPresentationQty = item.presentationQuantity
        const requestedBaseUnits = item.baseQuantity
        const previouslyReceivedPresentationUnits = item.receivedPresentationUnits
        const previouslyReceivedBaseUnits = item.receivedBaseUnits
        const pendingPresentationUnits =
          requestedPresentationQty - previouslyReceivedPresentationUnits
        const pendingBaseUnits = requestedBaseUnits - previouslyReceivedBaseUnits

        const packagingObj = item.packaging ?? null
        const presentationsArr = packagingObj?.presentations ?? []
        const purchasePresId = packagingObj?.purchasePresentationId ?? item.presentationId
        const chain = buildPurchasePresentationChain(presentationsArr, purchasePresId)

        const labelFn = (id?: string | null) =>
          resolveLabelForPresentationId(presentationsArr.length > 0 ? presentationsArr : null, id)
        const summary = buildPackagingSummary(chain, labelFn)

        const fallbackEquivalence =
          pendingPresentationUnits > 0 && item.presentationFactor > 1
            ? `1 ${item.presentationName} = ${formatQuantity(item.presentationFactor, 0)} ${item.unitSymbol}`
            : pendingPresentationUnits > 0
              ? `${formatQuantity(pendingPresentationUnits, 0)} ${item.presentationName} = ${formatQuantity(pendingBaseUnits, 0)} ${item.unitSymbol}`
              : ''
        const equivalenceText =
          summary && summary.hasEnoughData ? summary.equivalenceText : fallbackEquivalence

        const initialQty = Math.max(1, Math.floor(pendingPresentationUnits))
        const initialLote: LoteReceiptDraft = {
          id: crypto.randomUUID(),
          numeroLote: `${order.code.replace('CMP-', 'RCP-')}-${index + 1}`,
          fechaFabricacion: '',
          fechaVencimiento: '',
          cantidadRecibida: initialQty,
          stockReservado: 0,
          stockBloqueado: 0,
          costoUnitarioRecepcion: item.unitCostPresentation ?? 0,
        }
        const initialReceivedBase = initialQty * item.presentationFactor

        return {
          detailId: item.detailId,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          unitSymbol: item.unitSymbol,
          presentationId: item.presentationId,
          presentationName: item.presentationName,
          presentationFactor: item.presentationFactor,
          requestedPresentationQty,
          requestedBaseUnits,
          previouslyReceivedPresentationUnits,
          previouslyReceivedBaseUnits,
          pendingPresentationUnits,
          pendingBaseUnits,
          receivedPresentationQty: initialQty,
          receivedBaseUnits: initialReceivedBase,
          missingPresentationQty: Math.max(0, pendingPresentationUnits - initialQty),
          missingBaseUnits: Math.max(0, pendingBaseUnits - initialReceivedBase),
          unitCostPresentation: item.unitCostPresentation ?? 0,
          packaging: packagingObj,
          include: true,
          almacen: order.branchName === 'Sucursal Principal' ? 'Mostrador principal' : '',
          observacionesLinea: '',
          lotes: [initialLote],
          equivalenceText,
        }
      })

      setSelectedOrderId(orderId)
      setOrderReceiptDrafts(nextDrafts)
      setIsOrderReceiveDialogOpen(true)
      return
    }

    if (pendingReceipts.length === 0) {
      toast.error('La orden seleccionada ya no tiene líneas pendientes por recepcionar.')
      return
    }

    const nextDrafts: LineReceiptDraft[] = pendingReceipts.map((receipt, index) => {
      const pendingPresentationUnits =
        typeof receipt.pendingPresentationQuantity === 'number' &&
        receipt.pendingPresentationQuantity > 0
          ? receipt.pendingPresentationQuantity
          : receipt.pendingUnits / (receipt.presentationFactor ?? 1)
      const pendingBaseUnits = receipt.pendingUnits
      const presentationFactor = receipt.presentationFactor ?? 1
      const presentationName = receipt.presentationName ?? 'Presentación'

      const initialQty = Math.max(1, Math.floor(pendingPresentationUnits))
      const initialLote: LoteReceiptDraft = {
        id: crypto.randomUUID(),
        numeroLote: `${receipt.purchaseCode.replace('CMP-', 'RCP-')}-${index + 1}`,
        fechaFabricacion: '',
        fechaVencimiento: '',
        cantidadRecibida: initialQty,
        stockReservado: 0,
        stockBloqueado: 0,
        costoUnitarioRecepcion: 0,
      }
      const initialReceivedBase = initialQty * presentationFactor
      const fallbackEquivalence =
        pendingPresentationUnits > 0 && presentationFactor > 1
          ? `1 ${presentationName} = ${formatQuantity(presentationFactor, 0)} Unidades`
          : pendingPresentationUnits > 0
            ? `${formatQuantity(pendingPresentationUnits, 0)} ${presentationName} = ${formatQuantity(pendingBaseUnits, 0)} Unidades`
            : ''

      return {
        detailId: receipt.id,
        productId: receipt.productId ?? '',
        productName: receipt.productName,
        sku: '',
        unitSymbol: 'Unidades',
        presentationId: '',
        presentationName,
        presentationFactor,
        requestedPresentationQty: receipt.orderedPresentationQuantity ?? pendingPresentationUnits,
        requestedBaseUnits: receipt.orderedUnits ?? pendingBaseUnits,
        previouslyReceivedPresentationUnits: receipt.receivedPresentationQuantity ?? 0,
        previouslyReceivedBaseUnits: receipt.receivedUnits ?? 0,
        pendingPresentationUnits,
        pendingBaseUnits,
        receivedPresentationQty: initialQty,
        receivedBaseUnits: initialReceivedBase,
        missingPresentationQty: Math.max(0, pendingPresentationUnits - initialQty),
        missingBaseUnits: Math.max(0, pendingBaseUnits - initialReceivedBase),
        unitCostPresentation: 0,
        packaging: null,
        include: true,
        almacen: receipt.branchName === 'Sucursal Principal' ? 'Mostrador principal' : '',
        observacionesLinea: '',
        lotes: [initialLote],
        equivalenceText: fallbackEquivalence,
      }
    })

    setSelectedOrderId(orderId)
    setOrderReceiptDrafts(nextDrafts)
    setIsOrderReceiveDialogOpen(true)
  }

  function openOrderSummaryDialog(orderId: string) {
    setSelectedSummaryOrderId(orderId)
    setIsOrderSummaryDialogOpen(true)
  }

  async function handleCloseOrderReceipt() {
    if (!accessToken || !selectedOrderId || !selectedOrder) {
      toast.error('La orden seleccionada no está disponible.')
      return
    }

    const linesToReceive = orderReceiptDrafts.filter((line) => line.include)

    if (linesToReceive.length === 0) {
      toast.error('Selecciona al menos una línea pendiente para recepcionar.')
      return
    }

    const payloadItems: ReceivePurchaseItemPayload[] = []

    for (const line of linesToReceive) {
      if (line.lotes.length === 0) {
        toast.error(`Agrega al menos un lote para ${line.productName}.`)
        return
      }

      const totalLineQty = line.lotes.reduce(
        (sum, lote) => sum + (Number(lote.cantidadRecibida) || 0),
        0,
      )

      if (totalLineQty <= 0) {
        toast.error(`La cantidad recibida de ${line.productName} debe ser mayor a 0.`)
        return
      }

      if (totalLineQty > line.pendingPresentationUnits) {
        toast.error(
          `La cantidad de ${line.productName} (${formatQuantity(totalLineQty)} ${line.presentationName}) supera el saldo pendiente (${formatQuantity(line.pendingPresentationUnits)} ${line.presentationName}).`,
        )
        return
      }

      for (const lote of line.lotes) {
        if (!lote.numeroLote.trim()) {
          toast.error(`Ingresa el número de lote para ${line.productName}.`)
          return
        }

        if (!lote.fechaVencimiento.trim()) {
          toast.error(`Ingresa la fecha de vencimiento para el lote ${lote.numeroLote} de ${line.productName}.`)
          return
        }

        const qty = Number(lote.cantidadRecibida)
        const reserved = Number(lote.stockReservado)
        const blocked = Number(lote.stockBloqueado)

        if (
          !Number.isFinite(qty) ||
          !Number.isInteger(qty) ||
          qty <= 0
        ) {
          toast.error(
            `La cantidad recibida en el lote ${lote.numeroLote} de ${line.productName} debe ser un entero mayor a 0.`,
          )
          return
        }

        if (
          !Number.isInteger(reserved) ||
          !Number.isInteger(blocked) ||
          reserved < 0 ||
          blocked < 0
        ) {
          toast.error(
            `Los stocks reservados o bloqueados del lote ${lote.numeroLote} (${line.productName}) no son válidos.`,
          )
          return
        }

        if (reserved + blocked > qty) {
          toast.error(
            `La reserva y bloqueo del lote ${lote.numeroLote} (${line.productName}) superan la cantidad recibida.`,
          )
          return
        }

        payloadItems.push({
          detalleCompraId: line.detailId,
          numeroLote: lote.numeroLote.trim(),
          fechaFabricacion: lote.fechaFabricacion.trim() || undefined,
          fechaVencimiento: lote.fechaVencimiento.trim(),
          cantidadRecibida: qty,
          costoUnitarioRecepcion:
            lote.costoUnitarioRecepcion > 0 ? lote.costoUnitarioRecepcion : undefined,
          stockReservado: reserved > 0 ? reserved : undefined,
          stockBloqueado: blocked > 0 ? blocked : undefined,
          almacen: line.almacen.trim() || undefined,
          observaciones: line.observacionesLinea.trim() || undefined,
        })
      }
    }

    setIsClosingOrderReceipt(true)

    try {
      const closedOrderId = selectedOrderId
      const payload: CreatePurchaseReceptionPayload = {
        compraId: closedOrderId,
        items: payloadItems,
      }

      await purchasesService.createReception(accessToken, payload)

      if (selectedViewOrderId === closedOrderId && selectedOrderDetail) {
        try {
          const refreshed = await purchasesService.getOrderById(accessToken, closedOrderId)
          setSelectedOrderDetail(refreshed)
        } catch {
          // ignore refresh errors; dashboard will still reload
        }
      }

      await loadDashboard()

      setIsOrderReceiveDialogOpen(false)
      setSelectedOrderId(null)
      setOrderReceiptDrafts([])
      setSelectedSummaryOrderId(closedOrderId)
      setIsOrderSummaryDialogOpen(true)

      const allPendingIncluded =
        selectedOrderReceiptGroup &&
        selectedOrderReceiptGroup.pendingLines === linesToReceive.length

      const anyMissing = linesToReceive.some(
        (line) =>
          line.lotes.reduce((sum, l) => sum + (Number(l.cantidadRecibida) || 0), 0) <
          line.pendingPresentationUnits,
      )

      toast.success(
        allPendingIncluded && !anyMissing
          ? 'Recepción completa registrada. La orden quedó actualizada.'
          : 'Recepción parcial registrada para la orden.',
      )
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorizedRef.current(nextError.status, nextError.message, 'purchases.closeReception')
        return
      }

      toast.error(getApiErrorMessage(nextError))
    } finally {
      setIsClosingOrderReceipt(false)
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-foreground">Compras</h1>
        <Button variant="ghost" size="sm" onClick={() => setShowSummary(!showSummary)}>
          Resumen
          <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${showSummary ? 'rotate-180' : ''}`} />
        </Button>
      </div>

      {showSummary && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{purchaseMetrics.activeOrders}</span>
              <span className="text-xs text-muted-foreground">Ordenes activas</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <PackageCheck className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{purchaseMetrics.scheduledReceipts}</span>
              <span className="text-xs text-muted-foreground">Recepciones</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{formatCurrency(purchaseMetrics.totalPaid)}</span>
              <span className="text-xs text-muted-foreground">Pagado</span>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="ordenes">
        <TabsList className="grid w-full grid-cols-4 lg:w-fit">
          <TabsTrigger value="ordenes">Ordenes</TabsTrigger>
          <TabsTrigger value="recepciones">Recepciones</TabsTrigger>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
          <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
        </TabsList>

        <TabsContent value="ordenes" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  Ordenes de compra
                </CardTitle>
                <CardDescription>
                  Seguimiento del ciclo desde borrador hasta cierre o anulacion.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled>
                  <FileSpreadsheet className="h-4 w-4" />
                  Exportar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsCreateDialogOpen(true)}
                  disabled={!canCreateOrders}
                >
                  Nueva orden
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.55fr_0.55fr]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por codigo, proveedor o comprador"
                    className="pl-9"
                  />
                </div>

                <Select
                  value={logisticsStatusFilter}
                  onValueChange={(value) =>
                    setLogisticsStatusFilter(value as 'TODAS' | PurchaseLogisticsStatus)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Estado logístico" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAS">Todos los estados</SelectItem>
                    <SelectItem value="REGISTRADA">Registrada</SelectItem>
                    <SelectItem value="EN_RECEPCION">En recepción</SelectItem>
                    <SelectItem value="RECEPCION_PARCIAL">Recepción parcial</SelectItem>
                    <SelectItem value="RECEPCION_COMPLETA">Recepción completa</SelectItem>
                    <SelectItem value="CANCELADA">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isLoading ? (
                <div className="flex min-h-56 items-center justify-center rounded-2xl border">
                  <Loader className="h-7 w-7" />
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                  {error}
                </div>
              ) : orders.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-10 text-center">
                  <p className="text-sm font-medium text-foreground">
                    No hay órdenes de compra para los filtros actuales.
                  </p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Ajusta la búsqueda o registra la primera orden desde esta pantalla.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Orden</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>Creación</TableHead>
                        <TableHead>Entrega esperada</TableHead>
                        <TableHead>Totales</TableHead>
                        <TableHead>Estados</TableHead>
                        <TableHead className="text-center">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{order.code}</p>
                              <p className="text-small text-muted-foreground">
                                {order.itemCount} items · {order.buyerName}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{order.supplierName}</p>
                              <p className="text-small text-muted-foreground">
                                RUC/DOC {order.supplierDocument}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(order.createdAt)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(order.expectedAt)}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">
                                {formatCurrency(order.totalAmount)}{' '}
                                <span className="text-small font-normal text-muted-foreground">
                                  ordenado
                                </span>
                              </p>
                              <p className="text-small text-muted-foreground">
                                recepcionado {formatCurrency(order.receivedAmount)}
                              </p>
                              <p className="text-small text-emerald-700">
                                pagado {formatCurrency(order.paidAmount)}
                              </p>
                              <p className="text-small text-muted-foreground">
                                saldo pendiente {formatCurrency(order.adjustedPendingAmount)}
                              </p>
                              {order.returnedAmount > 0 ? (
                                <p className="text-small text-amber-700">
                                  devuelto {formatCurrency(order.returnedAmount)}
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Badge variant={getLogisticsStatusVariant(order.logisticsStatus)}>
                                {formatLogisticsStatus(order.logisticsStatus)}
                              </Badge>
                              <Badge variant={getFinancialStatusVariant(order.financialStatus)}>
                                {formatFinancialStatus(order.financialStatus)}
                              </Badge>
                              {receiptGroupsByOrder[order.id]?.pendingLines ? (
                                <p className="text-small text-muted-foreground">
                                  {receiptGroupsByOrder[order.id].pendingLines} líneas pendientes
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center justify-center gap-1.5 min-w-[120px]">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedViewOrderId(order.id)}
                              >
                                <Eye className="h-4 w-4 mr-1" /> Ver orden
                              </Button>
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-slate-600 hover:text-slate-800 hover:bg-slate-100"
                                  title="Imprimir orden"
                                  onClick={async () => {
                                    try {
                                      if (!accessToken) return
                                      const det =
                                        order.id === selectedOrderDetail?.order.id
                                          ? selectedOrderDetail
                                          : await purchasesService.getOrderById(accessToken, order.id)
                                      await printPurchaseOrderFromElement(
                                        { detail: det },
                                        { title: `Orden de compra ${det.order.code}` },
                                      )
                                    } catch (nextErr) {
                                      toast.error(getApiErrorMessage(nextErr))
                                    }
                                  }}
                                >
                                  <Printer className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                  title="Descargar PDF"
                                  onClick={async () => {
                                    try {
                                      if (!accessToken) return
                                      const det =
                                        order.id === selectedOrderDetail?.order.id
                                          ? selectedOrderDetail
                                          : await purchasesService.getOrderById(accessToken, order.id)
                                      await generatePurchaseOrderPDFBlob(
                                        { detail: det },
                                        { filename: `orden-de-compra-${det.order.code.toLowerCase()}.pdf` },
                                      )
                                    } catch (nextErr) {
                                      toast.error(getApiErrorMessage(nextErr))
                                    }
                                  }}
                                >
                                  <FileDown className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-small text-muted-foreground">
                      Mostrando {ordersPageStart + 1}-
                      {Math.min(ordersPageStart + ordersPageSize, sortedOrders.length)} de{' '}
                      {sortedOrders.length}
                    </p>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setOrdersPage((current) => Math.max(1, current - 1))}
                        disabled={safeOrdersPage <= 1}
                      >
                        Anterior
                      </Button>
                      <span className="text-small text-muted-foreground">
                        Página {safeOrdersPage} de {ordersTotalPages}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setOrdersPage((current) => Math.min(ordersTotalPages, current + 1))
                        }
                        disabled={safeOrdersPage >= ordersTotalPages}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recepciones" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PackageCheck className="h-5 w-5 text-primary" />
                  Recepcion por lote
                </CardTitle>
                <CardDescription>
                  Ingreso con lote, vencimiento, sucursal y validacion sanitaria.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex min-h-56 items-center justify-center rounded-2xl border">
                    <Loader className="h-7 w-7" />
                  </div>
                ) : receipts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-10 text-center">
                    <p className="text-sm font-medium text-foreground">
                      Todavía no hay líneas de compra pendientes o recibidas.
                    </p>
                    <p className="mt-1 text-small text-muted-foreground">
                      Cuando las órdenes empiecen a generar recepciones por lote, aparecerán aquí.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Compra</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Lote</TableHead>
                        <TableHead>Ingreso</TableHead>
                        <TableHead>Vencimiento</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receipts.map((receipt) => (
                        <TableRow key={receipt.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{receipt.purchaseCode}</p>
                              <p className="text-small text-muted-foreground">
                                {receipt.supplierName}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{receipt.productName}</p>
                              <p className="text-small text-muted-foreground">
                                {receipt.branchName}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{receipt.lotCode}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">
                                {receipt.receivedUnits.toFixed(0)} / {receipt.orderedUnits.toFixed(0)}
                              </p>
                              <p className="text-small text-muted-foreground">
                                {formatDateTime(receipt.receivedAt)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(receipt.expiryDate)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={getReceiptStatusVariant(receipt.status)}>
                                {receipt.status}
                              </Badge>
                              {receipt.coldChain ? (
                                <Badge variant="info">Cadena de frio</Badge>
                              ) : null}
                              {receipt.returnedUnits > 0 ? (
                                <Badge variant="warning">
                                  Dev. {receipt.returnedUnits.toFixed(0)}
                                </Badge>
                              ) : null}
                              {receipt.availableUnits > 0 ? (
                                <Badge variant="outline">
                                  Disp. {receipt.availableUnits.toFixed(0)}
                                </Badge>
                              ) : null}
                              {receipt.reservedUnits > 0 ? (
                                <Badge variant="outline">
                                  Res. {receipt.reservedUnits.toFixed(0)}
                                </Badge>
                              ) : null}
                              {receipt.blockedUnits > 0 ? (
                                <Badge variant="outline">
                                  Bloq. {receipt.blockedUnits.toFixed(0)}
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {receipt.pendingUnits > 0 ? (
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openOrderSummaryDialog(receipt.purchaseId)}
                                >
                                  Ver orden
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openReceiveDialog(receipt)}
                                >
                                  Recepcionar
                                </Button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-2">
                                {receipt.lotId &&
                                (receipt.availableUnits > 0 ||
                                  receipt.reservedUnits > 0 ||
                                  receipt.blockedUnits > 0) ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openReturnDialog(receipt)}
                                  >
                                    Devolver
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openOrderSummaryDialog(receipt.purchaseId)}
                                >
                                  Ver cierre
                                </Button>
                                <span className="self-center text-small text-muted-foreground">
                                  Completa
                                </span>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  Checklist de recepcion
                </CardTitle>
                <CardDescription>
                  Controles minimos antes de impactar stock disponible.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Validacion documental</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Guia, factura, lote, laboratorio y unidades recibidas deben coincidir.
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Revision sanitaria</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Confirmar integridad, temperatura y fecha de vencimiento antes de liberar.
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Alta en inventario</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Cada recepcion aceptada genera lote y prioridad FIFO para ventas futuras.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pagos" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Pagos a proveedor
                </CardTitle>
                <CardDescription>
                  Historial de abonos y seguimiento del saldo vivo por orden de compra.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex min-h-56 items-center justify-center rounded-2xl border">
                    <Loader className="h-7 w-7" />
                  </div>
                ) : payments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-10 text-center">
                    <p className="text-sm font-medium text-foreground">
                      Aún no hay pagos registrados a proveedores.
                    </p>
                    <p className="mt-1 text-small text-muted-foreground">
                      Desde una orden con saldo pendiente podrás registrar abonos reales.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Compra</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>Forma</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Referencia</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{payment.purchaseCode}</p>
                              <p className="text-small text-muted-foreground">
                                {payment.observations || 'Sin observaciones'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {payment.supplierName}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">
                                {payment.formPaymentName}
                              </p>
                              <p className="text-small text-muted-foreground">
                                {payment.formPaymentCode}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDateTime(payment.paidAt)}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {payment.reference || 'Sin referencia'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lectura financiera</CardTitle>
                <CardDescription>
                  Resumen rápido del estado de cuentas por pagar del abastecimiento.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Saldo pendiente real</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Considera devoluciones y abonos registrados a proveedores.
                  </p>
                  <p className="mt-3 text-base font-semibold text-foreground">
                    {formatCurrency(purchaseMetrics.pendingPayables)}
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Abonos registrados</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Pagos confirmados sobre órdenes activas y recibidas.
                  </p>
                  <p className="mt-3 text-base font-semibold text-foreground">
                    {formatCurrency(purchaseMetrics.totalPaid)}
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Compra neta</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Total comprometido después de devoluciones operativas.
                  </p>
                  <p className="mt-3 text-base font-semibold text-foreground">
                    {formatCurrency(purchaseMetrics.netSpend)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="proveedores" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                Desempeno de proveedores
              </CardTitle>
              <CardDescription>
                Lectura rapida para reabastecimiento, cumplimiento y productos criticos.
              </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                  <div className="flex min-h-56 items-center justify-center rounded-2xl border">
                    <Loader className="h-7 w-7" />
                  </div>
                ) : suppliers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-10 text-center">
                    <p className="text-sm font-medium text-foreground">
                      Aún no hay información suficiente para evaluar proveedores.
                    </p>
                    <p className="mt-1 text-small text-muted-foreground">
                      Registra compras reales y aquí verás cumplimiento, criticidad y ritmo de abastecimiento.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>Ordenes activas</TableHead>
                        <TableHead>Lead time</TableHead>
                        <TableHead>Nivel de servicio</TableHead>
                        <TableHead>Productos criticos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suppliers.map((supplier) => (
                        <TableRow key={supplier.supplierId}>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">
                                {supplier.supplierName}
                              </p>
                              <p className="text-small text-muted-foreground">
                                {supplier.contactPhone || 'Sin teléfono'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {supplier.documentNumber}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {supplier.activeOrders}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {supplier.avgLeadTimeDays} dias
                          </TableCell>
                          <TableCell>
                            <Badge variant={supplier.serviceLevel >= 96 ? 'success' : 'warning'}>
                              {supplier.serviceLevel}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{supplier.criticalProducts} SKU</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SidePanel
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open)
          if (open) {
            globalProductoSearchTextRef.current = ''
            setGlobalProductoSearchText('')
          }
          if (!open) {
            setEditingPurchaseOrderId(null)
            globalProductoSearchTextRef.current = ''
            setGlobalProductoSearchText('')
            form.reset({
              ...defaultFormValues,
              fechaEmision: new Date().toISOString().slice(0, 10),
            })
          }
        }}
      >
        <SidePanelContent className="p-0">
          <form className="flex h-full flex-col" onSubmit={form.handleSubmit(handleCreateOrder)}>
            <div className="flex items-start justify-between gap-4 border-b bg-popover px-6 py-4">
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">
                  {editingPurchaseOrderId
                    ? selectedOrderDetail?.order?.code
                      ? `Editar orden ${selectedOrderDetail.order.code}`
                      : 'Editar orden de compra'
                    : 'Registrar orden de compra'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {editingPurchaseOrderId
                    ? 'Modifica los datos y líneas de la orden. Los totales se recalculan automáticamente.'
                    : 'Alta inicial de la orden con proveedor, costos e impuestos por línea.'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Esta orden de compra será registrada para la sucursal:{' '}
                  <span className="font-medium text-foreground">
                    {activeBranchName || 'Sucursal activa'}
                  </span>
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
                    <label className="text-sm font-medium">Proveedor</label>
                    <Controller
                      control={form.control}
                      name="proveedorId"
                      render={({ field }) => (
                        <Select value={field.value || undefined} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona proveedor" />
                          </SelectTrigger>
                          <SelectContent>
                            {options.suppliers.map((supplier) => (
                              <SelectItem key={supplier.id} value={supplier.id}>
                                {supplier.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldError message={form.formState.errors.proveedorId?.message} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Fecha de emisión</label>
                    <div className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
                      <span className="font-medium text-foreground">
                        {new Date(watchedFechaEmision).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                    </div>
                    <FieldError message={form.formState.errors.fechaEmision?.message} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Recepción esperada</label>
                    <Input type="date" {...form.register('fechaRecepcion')} />
                    <FieldError message={form.formState.errors.fechaRecepcion?.message} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Estado inicial</label>
                    <Controller
                      control={form.control}
                      name="estado"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="BORRADOR">Borrador</SelectItem>
                            <SelectItem value="REGISTRADA">Registrada</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Observaciones</label>
                    <Textarea
                      {...form.register('observaciones')}
                      placeholder="Notas operativas para abastecimiento o recepción"
                      rows={3}
                      className="resize-y"
                    />
                    <FieldError message={form.formState.errors.observaciones?.message} />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Productos</p>
                    <p className="text-xs text-muted-foreground">
                      Busca un producto y agrégalo a la orden. Después configura presentación, cantidad y costo en cada línea.
                    </p>
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={globalProductoSearchText}
                      onChange={(event) => {
                        const v = event.currentTarget.value
                        globalProductoSearchTextRef.current = v
                        setGlobalProductoSearchText(v)
                        setGlobalProductoSearchOpen(true)
                      }}
                      onFocus={() => setGlobalProductoSearchOpen(true)}
                      onBlur={() =>
                        window.setTimeout(() => {
                          setGlobalProductoSearchOpen(false)
                        }, 200)
                      }
                      placeholder="Buscar por nombre, SKU, código o laboratorio"
                      className="h-12 pl-11 pr-4 text-base"
                    />
                    {globalProductoSearchOpen ? (
                      <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-96 overflow-y-auto rounded-xl border bg-popover p-2 shadow-xl">
                        {((): typeof options.products => {
                          const q = globalProductoSearchTextRef.current.trim().toLowerCase()
                          if (!q) return options.products.slice(0, 60)
                          return options.products
                            .filter((entry) => {
                              const haystack = [
                                entry.name,
                                entry.sku,
                                entry.internalCode,
                                entry.barcode,
                                entry.laboratory,
                              ]
                                .filter(Boolean)
                                .join(' ')
                                .toLowerCase()
                              return haystack.includes(q)
                            })
                            .slice(0, 80)
                        })().length === 0 ? (
                          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                            No se encontraron productos con ese criterio.
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {((): typeof options.products => {
                              const q = globalProductoSearchTextRef.current.trim().toLowerCase()
                              if (!q) return options.products.slice(0, 60)
                              return options.products
                                .filter((entry) => {
                                  const haystack = [
                                    entry.name,
                                    entry.sku,
                                    entry.internalCode,
                                    entry.barcode,
                                    entry.laboratory,
                                  ]
                                    .filter(Boolean)
                                    .join(' ')
                                    .toLowerCase()
                                  return haystack.includes(q)
                                })
                                .slice(0, 80)
                            })().map((product) => {
                              const alreadyInOrder = watchedItems.some(
                                (it) => it.productoId === product.id,
                              )
                              const presentations: PurchasePresentationOption[] =
                                product.packaging?.presentations ?? []
                              const basePresentationName =
                                presentations.find((p) => p.isBase)?.name ?? product.unitSymbol ?? 'Unidad'
                              return (
                                <div
                                  key={product.id}
                                  className="grid gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                                >
                                  <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-semibold leading-tight text-foreground">
                                        {product.name}
                                      </p>
                                      {alreadyInOrder ? (
                                        <Badge variant="outline" className="text-[10px] uppercase tracking-[0.1em]">
                                          Ya agregado
                                        </Badge>
                                      ) : null}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                      <span className="font-mono">SKU {product.sku}</span>
                                      {product.laboratory ? (
                                        <span>Laboratorio: {product.laboratory}</span>
                                      ) : null}
                                      <span>Unidad base: {basePresentationName}</span>
                                      {product.barcode ? (
                                        <span className="font-mono">Código {product.barcode}</span>
                                      ) : null}
                                    </div>
                                    {product.lastPurchaseCost > 0 ? (
                                      <p className="text-xs text-muted-foreground">
                                        Último costo:{' '}
                                        <span className="font-medium text-foreground">
                                          {formatCurrency(product.lastPurchaseCost)}
                                        </span>
                                      </p>
                                    ) : null}
                                  </div>
                                  <div className="shrink-0">
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={alreadyInOrder}
                                      onMouseDown={(event) => {
                                        event.preventDefault()
                                      }}
                                      onClick={() => {
                                        const newIndex = fields.length
                                        append({
                                          productoId: product.id,
                                          cantidad: 1,
                                          costoUnitario:
                                            typeof product.lastPurchaseCost === 'number' &&
                                            Number.isFinite(product.lastPurchaseCost)
                                              ? product.lastPurchaseCost
                                              : 0,
                                          porcentajeImpuesto: 0,
                                        })
                                        const autoPres =
                                          product.packaging?.purchasePresentationId ??
                                          product.packaging?.presentations?.find(
                                            (p) => p.allowsPurchase,
                                          )?.id ??
                                          null
                                        if (autoPres) {
                                          setCreateLineaPresentacionId((cur) => ({
                                            ...cur,
                                            [newIndex]: autoPres,
                                          }))
                                        }
                                        setGlobalProductoSearchOpen(false)
                                        globalProductoSearchTextRef.current = ''
                                        setGlobalProductoSearchText('')
                                      }}
                                    >
                                      <Plus className="h-4 w-4" />
                                      Agregar
                                    </Button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Líneas de compra</p>
                        <p className="text-xs text-muted-foreground">
                          {fields.length === 0
                            ? 'Aún no has agregado productos.'
                            : `${fields.length} producto${fields.length === 1 ? '' : 's'} en la orden.`}
                        </p>
                      </div>
                    </div>

                  <div className="space-y-5">
                    {fields.map((field, index) => {
                      const selectedProductId = watchedItems[index]?.productoId ?? ''
                      const selectedProduct = options.products.find(
                        (product) => product.id === selectedProductId,
                      )
                      const presentations: PurchasePresentationOption[] =
                        selectedProduct?.packaging?.presentations ?? []
                      const defaultPurchasePresentationId =
                        selectedProduct?.packaging?.purchasePresentationId ?? null
                      const chosenPresentationId =
                        createLineaPresentacionId[index] ??
                        defaultPurchasePresentationId ??
                        presentations.find((p) => p.allowsPurchase)?.id ??
                        presentations[0]?.id ??
                        null
                      const chosenPresentation =
                        chosenPresentationId
                          ? presentations.find((p) => p.id === chosenPresentationId) ?? null
                          : null
                      const unitLabel = selectedProduct?.unitSymbol ?? 'unidades'
                      const basePresentationName =
                        presentations.find((p) => p.isBase)?.name ?? unitLabel
                      const chain = buildPurchasePresentationChain(
                        presentations,
                        chosenPresentationId,
                      )
                      const summary = buildPackagingSummary(chain, (id) =>
                        resolveLabelForPresentationId(presentations, id),
                      )
                      const lineQuantity = Number(watchedItems[index]?.cantidad) || 0
                      const baseFactor =
                        chosenPresentation?.factorToBase && chosenPresentation.factorToBase > 0
                          ? chosenPresentation.factorToBase
                          : summary.baseUnits ?? 1
                      const baseUnitsTotal = lineQuantity * baseFactor

                      return (
                        <div key={field.id} className="space-y-4 rounded-2xl border p-5">
                          <input
                            type="hidden"
                            {...form.register(`items.${index}.productoId`)}
                          />
                          <FieldError
                            message={
                              form.formState.errors.items?.[index]?.productoId?.message
                            }
                          />

                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <p className="text-base font-semibold leading-tight text-foreground">
                                {selectedProduct?.name ?? 'Producto'}
                              </p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                {selectedProduct?.sku ? (
                                  <span className="font-mono">SKU {selectedProduct.sku}</span>
                                ) : null}
                                {selectedProduct?.laboratory ? (
                                  <span>Laboratorio: {selectedProduct.laboratory}</span>
                                ) : null}
                                {selectedProduct?.unitSymbol ? (
                                  <span>Unidad base: {basePresentationName}</span>
                                ) : null}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Quitar línea</span>
                            </Button>
                          </div>

                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">
                                Presentación de compra
                              </label>
                              {presentations.length === 0 ? (
                                <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                                  El producto no tiene empaque configurado.
                                </div>
                              ) : (
                                <Select
                                  value={chosenPresentationId ?? undefined}
                                  onValueChange={(value) => {
                                    setCreateLineaPresentacionId((cur) => ({
                                      ...cur,
                                      [index]: value,
                                    }))
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecciona presentación" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {presentations.map((pres) => (
                                      <SelectItem
                                        key={pres.id}
                                        value={pres.id}
                                        disabled={!pres.allowsPurchase}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium">{pres.name}</span>
                                          {pres.isBase ? (
                                            <Badge
                                              variant="outline"
                                              className="text-[10px] uppercase tracking-[0.12em]"
                                            >
                                              Base
                                            </Badge>
                                          ) : null}
                                          {!pres.allowsPurchase ? (
                                            <span className="text-[11px] text-muted-foreground">
                                              (solo inventario)
                                            </span>
                                          ) : null}
                                          {pres.factorToBase && pres.factorToBase > 0 ? (
                                            <span className="ml-auto text-[11px] text-muted-foreground">
                                              1 {pres.name} = {pres.factorToBase.toLocaleString('es-PE')} {basePresentationName}
                                            </span>
                                          ) : null}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-medium">Cantidad</label>
                              <Input
                                type="number"
                                min="1"
                                step="1"
                                {...form.register(`items.${index}.cantidad`, {
                                  valueAsNumber: true,
                                })}
                              />
                              <FieldError
                                message={
                                  form.formState.errors.items?.[index]?.cantidad?.message
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-medium">Costo unitario</label>
                              <div className="relative">
                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                  S/
                                </span>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="pl-9"
                                  {...form.register(`items.${index}.costoUnitario`, {
                                    valueAsNumber: true,
                                  })}
                                />
                              </div>
                              <FieldError
                                message={
                                  form.formState.errors.items?.[index]?.costoUnitario
                                    ?.message
                                }
                              />
                            </div>
                          </div>

                          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Afectación IGV</label>
                              <Controller
                                control={form.control}
                                name={`items.${index}.porcentajeImpuesto`}
                                render={({ field }) => (
                                  <Select
                                    value={
                                      field.value === 18
                                        ? 'GRAVADO_18'
                                        : field.value === 0
                                          ? 'EXONERADO'
                                          : String(field.value)
                                    }
                                    onValueChange={(value) => {
                                      if (value === 'GRAVADO_18') field.onChange(18)
                                      else if (value === 'EXONERADO') field.onChange(0)
                                      else {
                                        const n = Number(value)
                                        field.onChange(
                                          Number.isFinite(n) && n >= 0 ? n : 0,
                                        )
                                      }
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="GRAVADO_18">Gravado 18%</SelectItem>
                                      <SelectItem value="EXONERADO">Exonerado / 0%</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                              <FieldError
                                message={
                                  form.formState.errors.items?.[index]?.porcentajeImpuesto
                                    ?.message
                                }
                              />
                            </div>

                            {chosenPresentation?.name && Number.isFinite(baseFactor) ? (
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-transparent select-none">
                                  Cantidad comprada
                                </label>
                                <div className="inline-flex w-full items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/70 px-4 py-2 text-sm text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-500/10 dark:text-indigo-200">
                                  <span className="font-semibold">
                                    {lineQuantity || 0} {chosenPresentation.name}
                                  </span>
                                  <span className="font-medium">=</span>
                                  <span className="font-mono font-bold">
                                    {baseUnitsTotal.toLocaleString('es-PE')} {basePresentationName} base
                                  </span>
                                </div>
                              </div>
                            ) : null}
                          </div>

                          {summary.hasEnoughData && summary.baseUnits && summary.baseUnits > 1 ? (
                            <div className="rounded-xl border bg-muted/30 p-4">
                              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80">
                                Conversión de presentación
                              </p>
                              <p className="mt-1.5 text-sm font-semibold text-foreground">
                                {summary.equivalenceText}
                              </p>
                              {summary.relationTexts.length > 0 ? (
                                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                                  {summary.relationTexts.map((txt, i) => (
                                    <li key={i}>· {txt}</li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          ) : null}

                          <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-3">
                            <div className="space-y-1">
                              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                Subtotal
                              </p>
                              <p className="text-lg font-semibold text-foreground">
                                {formatCurrency(draftLineTotals[index]?.subtotal ?? 0)}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                IGV
                              </p>
                              <p className="text-lg font-semibold text-foreground">
                                {formatCurrency(draftLineTotals[index]?.igv ?? 0)}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                Total de línea
                              </p>
                              <p className="text-xl font-bold text-foreground">
                                {formatCurrency(draftLineTotals[index]?.total ?? 0)}
                              </p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {(watchedItems[index]?.porcentajeImpuesto ?? 0) > 0
                                  ? `S/. ${(watchedItems[index]?.costoUnitario ?? 0).toFixed(2)} × ${lineQuantity || 0}`
                                  : 'Operación exonerada'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {fields.length === 0 ? (
                      <div className="rounded-2xl border border-dashed p-10 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                          <Search className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-foreground">Aún no has agregado productos.</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Busca un producto arriba para comenzar la orden de compra.
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {fields.length > 0 ? (
                    <div className="grid gap-4 rounded-2xl border bg-muted/20 p-5 md:grid-cols-3">
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          Subtotal
                        </p>
                        <p className="mt-1 text-xl font-semibold text-foreground">
                          {formatCurrency(draftTotals.subtotal)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          IGV
                        </p>
                        <p className="mt-1 text-xl font-semibold text-foreground">
                          {formatCurrency(draftTotals.tax)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          Total general
                        </p>
                        <p className="mt-1 text-2xl font-bold text-foreground">
                          {formatCurrency(draftTotals.total)}
                        </p>
                      </div>
                    </div>
                  ) : null}
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
                    form.reset({
                      ...defaultFormValues,
                      fechaEmision: new Date().toISOString().slice(0, 10),
                    })
                  }}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4" />
                      Guardar orden
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </SidePanelContent>
      </SidePanel>

      <SidePanel
        open={isReceiveDialogOpen}
        onOpenChange={(open) => {
          setIsReceiveDialogOpen(open)

          if (!open) {
            setSelectedReceiptId(null)
            receiveForm.reset(defaultReceiveFormValues)
          }
        }}
      >
        <SidePanelContent className="p-0">
          <form className="flex h-full flex-col" onSubmit={receiveForm.handleSubmit(handleReceiveItem)}>
            <div className="flex items-start justify-between gap-4 border-b bg-popover px-6 py-4">
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">Recepcionar compra</p>
                <p className="text-sm text-muted-foreground">
                  {selectedReceipt
                    ? `${selectedReceipt.productName} · ${selectedReceipt.purchaseCode} · pendiente ${
                        typeof selectedReceipt.pendingPresentationQuantity === 'number'
                          ? `${selectedReceipt.pendingPresentationQuantity.toFixed(0)} ${
                              selectedReceipt.presentationName ?? 'unidades'
                            }`
                          : `${selectedReceipt.pendingUnits.toFixed(0)} unidades`
                      }`
                    : 'Registra el lote y define cómo ingresa el stock al inventario.'}
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
                <label className="text-sm font-medium">Número de lote</label>
                <Input {...receiveForm.register('numeroLote')} placeholder="Ej. LT-250715-A" />
                <FieldError message={receiveForm.formState.errors.numeroLote?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Cantidad recibida</label>
                <Input
                  type="number"
                  step="1"
                  {...receiveForm.register('cantidadRecibida', {
                    valueAsNumber: true,
                  })}
                />
                <FieldError
                  message={receiveForm.formState.errors.cantidadRecibida?.message}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha de fabricación</label>
                <Input type="date" {...receiveForm.register('fechaFabricacion')} />
                <FieldError
                  message={receiveForm.formState.errors.fechaFabricacion?.message}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha de vencimiento</label>
                <Input type="date" {...receiveForm.register('fechaVencimiento')} />
                <FieldError
                  message={receiveForm.formState.errors.fechaVencimiento?.message}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Stock reservado</label>
                <Input
                  type="number"
                  step="1"
                  {...receiveForm.register('stockReservado', {
                    valueAsNumber: true,
                  })}
                />
                <FieldError
                  message={receiveForm.formState.errors.stockReservado?.message}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Stock bloqueado</label>
                <Input
                  type="number"
                  step="1"
                  {...receiveForm.register('stockBloqueado', {
                    valueAsNumber: true,
                  })}
                />
                <FieldError
                  message={receiveForm.formState.errors.stockBloqueado?.message}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Almacén / ubicación</label>
                <Input
                  {...receiveForm.register('almacen')}
                  placeholder="Ej. Mostrador principal o almacén frío"
                />
                <FieldError message={receiveForm.formState.errors.almacen?.message} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Observaciones</label>
                <Textarea
                  {...receiveForm.register('observaciones')}
                  placeholder="Notas sanitarias, cadena de frío o incidencias"
                  className="min-h-24"
                />
                <FieldError
                  message={receiveForm.formState.errors.observaciones?.message}
                />
              </div>
            </div>

            <div className="grid gap-4 rounded-2xl border bg-muted/20 p-4 md:grid-cols-3">
              <div>
                <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                  Recibido
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {watchedReceivedUnits.toFixed(0)}
                </p>
              </div>
              <div>
                <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                  Reservado + bloqueado
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {(watchedReservedUnits + watchedBlockedUnits).toFixed(0)}
                </p>
              </div>
              <div>
                <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                  Disponible inicial
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {receiveAvailableUnits.toFixed(0)}
                </p>
              </div>
            </div>
            </div>
            </div>

            <div className="border-t bg-popover px-6 py-4">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isReceiving}
                  onClick={() => {
                    setIsReceiveDialogOpen(false)
                    setSelectedReceiptId(null)
                    receiveForm.reset(defaultReceiveFormValues)
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isReceiving || !selectedReceipt}>
                  {isReceiving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Recepcionando...
                    </>
                  ) : (
                    <>
                      <PackageCheck className="h-4 w-4" />
                      Confirmar recepción
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </SidePanelContent>
      </SidePanel>

      <SidePanel
        open={isOrderReceiveDialogOpen}
        onOpenChange={(open) => {
          setIsOrderReceiveDialogOpen(open)

          if (!open) {
            setSelectedOrderId(null)
            setOrderReceiptDrafts([])
          }
        }}
      >
        <SidePanelContent className="p-0">
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-4 border-b bg-popover px-6 py-4">
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">Registrar recepción</p>
                <p className="text-sm text-muted-foreground">
                  {selectedOrder
                    ? `${selectedOrder.code} · ${selectedOrder.supplierName}${selectedOrderReceiptGroup ? ` · ${selectedOrderReceiptGroup.pendingLines} líneas pendientes` : ''}`
                    : 'Confirma cantidades recibidas, lotes y vencimientos. El inventario y Kardex se actualizarán al confirmar.'}
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
              <div className="space-y-6">
                <div className="grid gap-4 rounded-2xl border bg-muted/20 p-4 md:grid-cols-4">
                  <div>
                    <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                      Líneas a recepcionar
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {orderReceiptDrafts.filter((l) => l.include).length} / {orderReceiptDrafts.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                      Unidades pendientes (base)
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {formatQuantity(
                        orderReceiptDrafts.reduce((sum, l) => sum + (l.include ? l.pendingBaseUnits : 0), 0),
                        0,
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                      Unidades a ingresar (base)
                    </p>
                    <p className="mt-2 text-base font-semibold text-emerald-700">
                      {formatQuantity(selectedOrderAvailableUnits, 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                      Estados actuales
                    </p>
                    <div className="mt-2 flex flex-col gap-1">
                      <Badge
                        variant={
                          selectedOrder
                            ? getLogisticsStatusVariant(selectedOrder.logisticsStatus)
                            : 'outline'
                        }
                      >
                        {selectedOrder ? formatLogisticsStatus(selectedOrder.logisticsStatus) : 'N/A'}
                      </Badge>
                      <Badge
                        variant={
                          selectedOrder
                            ? getFinancialStatusVariant(selectedOrder.financialStatus)
                            : 'outline'
                        }
                      >
                        {selectedOrder ? formatFinancialStatus(selectedOrder.financialStatus) : 'N/A'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  {orderReceiptDrafts.map((line) => {
                    const totalReceivedPresentation = line.lotes.reduce(
                      (sum, l) => sum + (Number(l.cantidadRecibida) || 0),
                      0,
                    )
                    const totalReceivedBase =
                      totalReceivedPresentation * (line.presentationFactor ?? 1)
                    const totalReservedPresentation = line.lotes.reduce(
                      (sum, l) => sum + (Number(l.stockReservado) || 0),
                      0,
                    )
                    const totalBlockedPresentation = line.lotes.reduce(
                      (sum, l) => sum + (Number(l.stockBloqueado) || 0),
                      0,
                    )
                    const lineAvailablePresentation = Math.max(
                      0,
                      totalReceivedPresentation - totalReservedPresentation - totalBlockedPresentation,
                    )
                    const lineAvailableBase =
                      lineAvailablePresentation * (line.presentationFactor ?? 1)
                    const lineTotalCost = line.lotes.reduce(
                      (sum, l) =>
                        sum + (Number(l.cantidadRecibida) || 0) * (Number(l.costoUnitarioRecepcion) || 0),
                      0,
                    )

                    return (
                      <div
                        key={line.detailId}
                        className={`space-y-4 rounded-2xl border p-4 transition-opacity ${
                          line.include ? 'opacity-100' : 'opacity-60'
                        }`}
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-foreground">{line.productName}</p>
                              {line.sku ? (
                                <span className="text-xs text-muted-foreground">
                                  SKU {line.sku}
                                </span>
                              ) : null}
                            </div>
                            <p className="text-small text-muted-foreground">
                              Presentación: {line.presentationName} · Factor {line.presentationFactor}
                              {line.equivalenceText ? (
                                <>
                                  {' · '}
                                  <span className="text-sky-700 font-medium">
                                    {line.equivalenceText}
                                  </span>
                                </>
                              ) : null}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            {line.previouslyReceivedPresentationUnits > 0 ? (
                              <Badge variant="outline" className="text-xs">
                                Ya recibido: {formatQuantity(line.previouslyReceivedPresentationUnits, 0)}{' '}
                                {line.presentationName}
                              </Badge>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              variant={line.include ? 'secondary' : 'outline'}
                              onClick={() =>
                                updateOrderReceiptDraft(line.detailId, {
                                  include: !line.include,
                                })
                              }
                            >
                              {line.include ? 'Incluida' : 'Omitida'}
                            </Button>
                          </div>
                        </div>

                        <div className="grid gap-3 rounded-xl border bg-muted/20 p-3 md:grid-cols-3">
                          <div className="space-y-1">
                            <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                              Pedido
                            </p>
                            <p className="font-semibold text-foreground">
                              {formatQuantity(line.requestedPresentationQty, 0)}{' '}
                              {line.presentationName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              = {formatQuantity(line.requestedBaseUnits, 0)} {line.unitSymbol}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                              Recibido (esta acción)
                            </p>
                            <p className={`font-semibold ${
                              totalReceivedPresentation > line.pendingPresentationUnits
                                ? 'text-rose-700'
                                : 'text-emerald-700'
                            }`}>
                              {formatQuantity(totalReceivedPresentation, 0)}{' '}
                              {line.presentationName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              = {formatQuantity(totalReceivedBase, 0)} {line.unitSymbol}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                              Faltante luego de esta recepción
                            </p>
                            <p className={`font-semibold ${
                              line.missingPresentationQty > 0 ? 'text-amber-700' : 'text-emerald-700'
                            }`}>
                              {formatQuantity(line.missingPresentationQty, 0)}{' '}
                              {line.presentationName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              = {formatQuantity(line.missingBaseUnits, 0)} {line.unitSymbol}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-foreground">
                              Lotes recibidos
                              <span className="ml-2 text-xs text-muted-foreground font-normal">
                                ({line.lotes.length} {line.lotes.length === 1 ? 'lote' : 'lotes'})
                              </span>
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!line.include}
                              onClick={() => addLoteToReceiptDraft(line.detailId)}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              Agregar lote
                            </Button>
                          </div>

                          <div className="space-y-3">
                            {line.lotes.map((lote, loteIndex) => {
                              const loteAvailableQty = Math.max(
                                0,
                                (Number(lote.cantidadRecibida) || 0) -
                                  (Number(lote.stockReservado) || 0) -
                                  (Number(lote.stockBloqueado) || 0),
                              )
                              return (
                                <div
                                  key={lote.id}
                                  className="rounded-xl border p-3 space-y-3 bg-white"
                                >
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                      Lote {loteIndex + 1}
                                    </p>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-rose-700"
                                      disabled={!line.include || line.lotes.length <= 1}
                                      onClick={() => removeLoteFromReceiptDraft(line.detailId, lote.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      <span className="sr-only">Quitar lote</span>
                                    </Button>
                                  </div>

                                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    <div className="space-y-1.5">
                                      <label className="text-sm font-medium">Número de lote</label>
                                      <Input
                                        value={lote.numeroLote}
                                        onChange={(event) =>
                                          updateOrderReceiptDraft(line.detailId, null, {
                                            loteId: lote.id,
                                            lotePatch: { numeroLote: event.target.value },
                                          })
                                        }
                                        disabled={!line.include}
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-sm font-medium">
                                        Cantidad ({line.presentationName})
                                      </label>
                                      <Input
                                        type="number"
                                        step="1"
                                        min="0"
                                        value={lote.cantidadRecibida}
                                        onChange={(event) =>
                                          updateOrderReceiptDraft(line.detailId, null, {
                                            loteId: lote.id,
                                            lotePatch: {
                                              cantidadRecibida: Number(event.target.value) || 0,
                                            },
                                          })
                                        }
                                        disabled={!line.include}
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-sm font-medium">Fecha fabricación</label>
                                      <Input
                                        type="date"
                                        value={lote.fechaFabricacion}
                                        onChange={(event) =>
                                          updateOrderReceiptDraft(line.detailId, null, {
                                            loteId: lote.id,
                                            lotePatch: { fechaFabricacion: event.target.value },
                                          })
                                        }
                                        disabled={!line.include}
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-sm font-medium">Fecha vencimiento</label>
                                      <Input
                                        type="date"
                                        value={lote.fechaVencimiento}
                                        onChange={(event) =>
                                          updateOrderReceiptDraft(line.detailId, null, {
                                            loteId: lote.id,
                                            lotePatch: { fechaVencimiento: event.target.value },
                                          })
                                        }
                                        disabled={!line.include}
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-sm font-medium">Reservado</label>
                                      <Input
                                        type="number"
                                        step="1"
                                        min="0"
                                        value={lote.stockReservado}
                                        onChange={(event) =>
                                          updateOrderReceiptDraft(line.detailId, null, {
                                            loteId: lote.id,
                                            lotePatch: {
                                              stockReservado: Number(event.target.value) || 0,
                                            },
                                          })
                                        }
                                        disabled={!line.include}
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-sm font-medium">Bloqueado</label>
                                      <Input
                                        type="number"
                                        step="1"
                                        min="0"
                                        value={lote.stockBloqueado}
                                        onChange={(event) =>
                                          updateOrderReceiptDraft(line.detailId, null, {
                                            loteId: lote.id,
                                            lotePatch: {
                                              stockBloqueado: Number(event.target.value) || 0,
                                            },
                                          })
                                        }
                                        disabled={!line.include}
                                      />
                                    </div>
                                    <div className="space-y-1.5 md:col-span-2">
                                      <label className="text-sm font-medium">
                                        Costo unitario recepción (por {line.presentationName})
                                      </label>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={lote.costoUnitarioRecepcion}
                                        onChange={(event) =>
                                          updateOrderReceiptDraft(line.detailId, null, {
                                            loteId: lote.id,
                                            lotePatch: {
                                              costoUnitarioRecepcion: Number(event.target.value) || 0,
                                            },
                                          })
                                        }
                                        disabled={!line.include}
                                      />
                                    </div>
                                  </div>

                                  <div className="grid gap-3 rounded-lg border bg-muted/20 p-2.5 text-xs md:grid-cols-3">
                                    <div>
                                      <span className="text-muted-foreground">Recibido / base:</span>{' '}
                                      <span className="font-semibold text-foreground">
                                        {formatQuantity(lote.cantidadRecibida || 0, 0)}{' '}
                                        {line.presentationName} ={' '}
                                        {formatQuantity(
                                          (lote.cantidadRecibida || 0) * (line.presentationFactor ?? 1),
                                          0,
                                        )}{' '}
                                        {line.unitSymbol}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Disponible:</span>{' '}
                                      <span className="font-semibold text-emerald-700">
                                        {formatQuantity(loteAvailableQty, 0)} {line.presentationName}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Costo lote:</span>{' '}
                                      <span className="font-semibold text-foreground">
                                        {formatCurrency(
                                          (lote.cantidadRecibida || 0) *
                                            (lote.costoUnitarioRecepcion || 0),
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium">Almacén / ubicación</label>
                            <Input
                              value={line.almacen}
                              onChange={(event) =>
                                updateOrderReceiptDraft(line.detailId, {
                                  almacen: event.target.value,
                                })
                              }
                              disabled={!line.include}
                              placeholder="Ej: Mostrador principal, Depósito A"
                            />
                          </div>
                          <div className="space-y-1.5 rounded-xl border bg-muted/10 p-3">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Total línea</span>
                              <span className="font-semibold text-foreground">
                                {formatCurrency(lineTotalCost)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs mt-1">
                              <span className="text-muted-foreground">Disponible para venta</span>
                              <span className="font-semibold text-emerald-700">
                                {formatQuantity(lineAvailablePresentation, 0)}{' '}
                                {line.presentationName} ={' '}
                                {formatQuantity(lineAvailableBase, 0)} {line.unitSymbol}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm font-medium">Observaciones de la línea</label>
                          <Textarea
                            value={line.observacionesLinea}
                            onChange={(event) =>
                              updateOrderReceiptDraft(line.detailId, {
                                observacionesLinea: event.target.value,
                              })
                            }
                            className="min-h-16"
                            disabled={!line.include}
                            placeholder="Condición de recepción, daños, faltantes declarados por proveedor..."
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="border-t bg-popover px-6 py-4">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isClosingOrderReceipt}
                  onClick={() => {
                    setIsOrderReceiveDialogOpen(false)
                    setSelectedOrderId(null)
                    setOrderReceiptDrafts([])
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleCloseOrderReceipt()}
                  disabled={
                    isClosingOrderReceipt ||
                    orderReceiptDrafts.length === 0 ||
                    orderReceiptDrafts.every((l) => !l.include)
                  }
                >
                  {isClosingOrderReceipt ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Registrando recepción...
                    </>
                  ) : (
                    <>
                      <PackageCheck className="h-4 w-4" />
                      Confirmar recepción
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </SidePanelContent>
      </SidePanel>

      <SidePanel
        open={isReturnDialogOpen}
        onOpenChange={(open) => {
          setIsReturnDialogOpen(open)

          if (!open) {
            setSelectedReturnReceiptId(null)
            returnForm.reset(defaultReturnFormValues)
          }
        }}
      >
        <SidePanelContent className="p-0">
          <form className="flex h-full flex-col" onSubmit={returnForm.handleSubmit(handleReturnItem)}>
            <div className="flex items-start justify-between gap-4 border-b bg-popover px-6 py-4">
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">Registrar devolución de compra</p>
                <p className="text-sm text-muted-foreground">
                  {selectedReturnReceipt
                    ? `${selectedReturnReceipt.productName} · ${selectedReturnReceipt.lotCode} · ${selectedReturnReceipt.purchaseCode}`
                    : 'Selecciona el origen del stock que volverá al proveedor.'}
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
                <label className="text-sm font-medium">Origen de devolución</label>
                <Controller
                  control={returnForm.control}
                  name="target"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DISPONIBLE">Stock disponible</SelectItem>
                        <SelectItem value="RESERVADO">Stock reservado</SelectItem>
                        <SelectItem value="BLOQUEADO">Stock bloqueado</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={returnForm.formState.errors.target?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Cantidad a devolver</label>
                <Input
                  type="number"
                  step="1"
                  {...returnForm.register('quantity', {
                    valueAsNumber: true,
                  })}
                />
                <FieldError message={returnForm.formState.errors.quantity?.message} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Observaciones</label>
                <Textarea
                  {...returnForm.register('observaciones')}
                  placeholder="Motivo sanitario, daño, error de despacho o no conformidad"
                  className="min-h-24"
                />
                <FieldError message={returnForm.formState.errors.observaciones?.message} />
              </div>
            </div>

            <div className="grid gap-4 rounded-2xl border bg-muted/20 p-4 md:grid-cols-3">
              <div>
                <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                  Stock origen
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {selectedReturnStock.toFixed(0)}
                </p>
              </div>
              <div>
                <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                  A devolver
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {watchedReturnQuantity.toFixed(0)}
                </p>
              </div>
              <div>
                <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                  Saldo estimado
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {Math.max(0, selectedReturnStock - watchedReturnQuantity).toFixed(0)}
                </p>
              </div>
            </div>
            </div>
            </div>

            <div className="border-t bg-popover px-6 py-4">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isReturning}
                  onClick={() => {
                    setIsReturnDialogOpen(false)
                    setSelectedReturnReceiptId(null)
                    returnForm.reset(defaultReturnFormValues)
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isReturning || !selectedReturnReceipt?.lotId}>
                  {isReturning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Registrando devolución...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4" />
                      Confirmar devolución
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </SidePanelContent>
      </SidePanel>

      <SidePanel
        open={isPaymentDialogOpen}
        onOpenChange={(open) => {
          setIsPaymentDialogOpen(open)

          if (!open) {
            setSelectedPaymentOrderId(null)
            paymentForm.reset(defaultPaymentFormValues)
          }
        }}
      >
        <SidePanelContent className="p-0">
          <form className="flex h-full flex-col" onSubmit={paymentForm.handleSubmit(handleRegisterPayment)}>
            <div className="flex items-start justify-between gap-4 border-b bg-popover px-6 py-4">
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">Registrar pago a proveedor</p>
                <p className="text-sm text-muted-foreground">
                  {selectedPaymentOrder
                    ? `${selectedPaymentOrder.code} · ${selectedPaymentOrder.supplierName} · saldo ${formatCurrency(selectedPaymentOrder.adjustedPendingAmount)}`
                    : 'Registra un abono real para actualizar cuentas por pagar.'}
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
                  <FormPaymentMethodTwoLevelSelect
                    control={paymentForm.control}
                    name="formaPagoId"
                    methods={options.paymentMethods}
                    label="Forma de pago"
                    placeholderCategory="Selecciona una categoría"
                    placeholderSubmethod="Selecciona el tipo digital"
                    id="purchases-payment-method"
                    required
                  />

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Fecha de pago</label>
                    <Input type="date" {...paymentForm.register('fechaPago')} />
                    <FieldError message={paymentForm.formState.errors.fechaPago?.message} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Monto</label>
                    <Input
                      type="number"
                      step="0.01"
                      {...paymentForm.register('monto', {
                        valueAsNumber: true,
                      })}
                    />
                    <FieldError message={paymentForm.formState.errors.monto?.message} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Referencia</label>
                    <Input
                      {...paymentForm.register('referenciaExterna')}
                      placeholder={
                        selectedPaymentMethod?.requiresReference
                          ? 'Operación, voucher o nro. de transferencia'
                          : 'Opcional'
                      }
                    />
                    <FieldError
                      message={paymentForm.formState.errors.referenciaExterna?.message}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Observaciones</label>
                    <Textarea
                      {...paymentForm.register('observaciones')}
                      placeholder="Notas del abono, conciliación o compromiso con proveedor"
                      className="min-h-24"
                    />
                    <FieldError message={paymentForm.formState.errors.observaciones?.message} />
                  </div>
                </div>

            <div className="grid gap-4 rounded-2xl border bg-muted/20 p-4 md:grid-cols-3">
              <div>
                <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                  Saldo actual
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {formatCurrency(selectedPaymentOrder?.adjustedPendingAmount ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                  Pago a registrar
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {formatCurrency(watchedPaymentAmount)}
                </p>
              </div>
              <div>
                <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                  Saldo estimado
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {formatCurrency(
                    Math.max(0, (selectedPaymentOrder?.adjustedPendingAmount ?? 0) - watchedPaymentAmount),
                  )}
                </p>
              </div>
            </div>
            </div>
            </div>

            <div className="border-t bg-popover px-6 py-4">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPaying}
                  onClick={() => {
                    setIsPaymentDialogOpen(false)
                    setSelectedPaymentOrderId(null)
                    paymentForm.reset(defaultPaymentFormValues)
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPaying || !selectedPaymentOrder}>
                  {isPaying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Registrando pago...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      Confirmar pago
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </SidePanelContent>
      </SidePanel>

      <SidePanel
        open={isOrderSummaryDialogOpen}
        onOpenChange={(open) => {
          setIsOrderSummaryDialogOpen(open)

          if (!open) {
            setSelectedSummaryOrderId(null)
          }
        }}
      >
        <SidePanelContent className="p-0">
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-4 border-b bg-popover px-6 py-4">
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">Detalle de recepción por orden</p>
                <p className="text-sm text-muted-foreground">
                  {selectedSummaryOrder && selectedSummaryReceiptGroup
                    ? `${selectedSummaryOrder.code} · ${selectedSummaryOrder.supplierName} · ${selectedSummaryReceiptGroup.totalLines} líneas`
                    : 'Revisa el historial de recepciones, lotes y saldos de la orden.'}
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
              {selectedSummaryOrder && selectedSummaryReceiptGroup && selectedSummaryTotals ? (
                <div className="space-y-6">
              <div className="grid gap-4 rounded-2xl border bg-muted/20 p-4 md:grid-cols-5">
                <div>
                  <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                    Estados
                  </p>
                  <div className="mt-2 flex flex-col gap-1">
                    <Badge variant={getLogisticsStatusVariant(selectedSummaryOrder.logisticsStatus)}>
                      {formatLogisticsStatus(selectedSummaryOrder.logisticsStatus)}
                    </Badge>
                    <Badge variant={getFinancialStatusVariant(selectedSummaryOrder.financialStatus)}>
                      {formatFinancialStatus(selectedSummaryOrder.financialStatus)}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                    Recibido acumulado
                  </p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    {selectedSummaryTotals.receivedUnits.toFixed(0)}
                  </p>
                </div>
                <div>
                  <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                    Pendiente
                  </p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    {selectedSummaryTotals.pendingUnits.toFixed(0)}
                  </p>
                </div>
                <div>
                  <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                    Observadas
                  </p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    {selectedSummaryTotals.observedLines}
                  </p>
                </div>
                <div>
                  <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                    Devuelto
                  </p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    {formatCurrency(selectedSummaryTotals.returnedAmount)}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border p-4">
                  <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                    Proveedor
                  </p>
                  <p className="mt-2 font-medium text-foreground">
                    {selectedSummaryOrder.supplierName}
                  </p>
                  <p className="text-small text-muted-foreground">
                    {selectedSummaryOrder.supplierDocument}
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                    Sucursal
                  </p>
                  <p className="mt-2 font-medium text-foreground">
                    {selectedSummaryOrder.branchName}
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                    Creación
                  </p>
                  <p className="mt-2 font-medium text-foreground">
                    {formatDate(selectedSummaryOrder.createdAt)}
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                    Monto
                  </p>
                  <p className="mt-2 font-medium text-foreground">
                    {formatCurrency(selectedSummaryOrder.totalAmount)}
                  </p>
                  <p className="text-small text-muted-foreground">
                    devuelto {formatCurrency(selectedSummaryOrder.returnedAmount)}
                  </p>
                  <p className="text-small text-muted-foreground">
                    neto {formatCurrency(selectedSummaryOrder.netAmount)}
                  </p>
                  <p className="text-small text-muted-foreground">
                    saldo ajustado {formatCurrency(selectedSummaryOrder.adjustedPendingAmount)}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead>Ingreso</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSummaryReceiptGroup.receipts.map((receipt) => (
                      <TableRow key={receipt.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{receipt.productName}</p>
                            <p className="text-small text-muted-foreground">
                              {receipt.branchName}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {receipt.lotCode || 'Pendiente'}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">
                              {receipt.receivedUnits.toFixed(0)} / {receipt.orderedUnits.toFixed(0)}
                            </p>
                            <p className="text-small text-muted-foreground">
                              {formatDateTime(receipt.receivedAt)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(receipt.expiryDate)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={getReceiptStatusVariant(receipt.status)}>
                              {receipt.status}
                            </Badge>
                            {receipt.pendingUnits > 0 ? (
                              <Badge variant="warning">
                                Pendiente {receipt.pendingUnits.toFixed(0)}
                              </Badge>
                            ) : null}
                            {receipt.returnedUnits > 0 ? (
                              <Badge variant="warning">
                                Dev. {receipt.returnedUnits.toFixed(0)}
                              </Badge>
                            ) : null}
                            {receipt.coldChain ? (
                              <Badge variant="info">Cadena de frio</Badge>
                            ) : null}
                            {receipt.availableUnits > 0 ? (
                              <Badge variant="outline">
                                Disp. {receipt.availableUnits.toFixed(0)}
                              </Badge>
                            ) : null}
                            {receipt.reservedUnits > 0 ? (
                              <Badge variant="outline">
                                Res. {receipt.reservedUnits.toFixed(0)}
                              </Badge>
                            ) : null}
                            {receipt.blockedUnits > 0 ? (
                              <Badge variant="outline">
                                Bloq. {receipt.blockedUnits.toFixed(0)}
                              </Badge>
                            ) : null}
                            {receipt.lotId &&
                            (receipt.availableUnits > 0 ||
                              receipt.reservedUnits > 0 ||
                              receipt.blockedUnits > 0) ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setIsOrderSummaryDialogOpen(false)
                                  openReturnDialog(receipt)
                                }}
                              >
                                <RotateCcw className="h-4 w-4" />
                                Devolver
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed p-10 text-center">
                  <p className="text-sm font-medium text-foreground">
                    No se encontró información de recepción para esta orden.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t bg-popover px-6 py-4">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsOrderSummaryDialogOpen(false)
                    setSelectedSummaryOrderId(null)
                  }}
                >
                  Cerrar
                </Button>
                {selectedSummaryOrder &&
                selectedSummaryReceiptGroup &&
                selectedSummaryReceiptGroup.pendingLines > 0 &&
                selectedSummaryOrder.status !== 'BORRADOR' &&
                selectedSummaryOrder.status !== 'ANULADA' &&
                Number(selectedSummaryOrder.adjustedPendingAmount ?? 0) <= 0 ? (
                  <Button
                    type="button"
                    onClick={() => {
                      setIsOrderSummaryDialogOpen(false)
                      setSelectedSummaryOrderId(null)
                      openOrderReceiveDialog(selectedSummaryOrder.id)
                    }}
                    title={
                      Number(selectedSummaryOrder.adjustedPendingAmount ?? 0) > 0
                        ? 'Completa el pago de la orden para habilitar la recepción.'
                        : 'Continuar con el cierre y registro de recepción.'
                    }
                  >
                    <PackageCheck className="h-4 w-4" />
                    Continuar cierre
                  </Button>
                ) :
                selectedSummaryOrder &&
                Number(selectedSummaryOrder.adjustedPendingAmount ?? 0) > 0 &&
                selectedSummaryReceiptGroup &&
                selectedSummaryReceiptGroup.pendingLines > 0 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled
                    title="Completa el pago de la orden para habilitar la recepción."
                  >
                    <PackageCheck className="h-4 w-4" />
                    Continuar cierre
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </SidePanelContent>
      </SidePanel>

      <Dialog
        open={isCashShortageDialogOpen}
        onOpenChange={(open) => {
          setIsCashShortageDialogOpen(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Saldo insuficiente en caja</DialogTitle>
            <DialogDescription>
              La caja activa no cuenta con saldo suficiente para registrar este pago.
            </DialogDescription>
          </DialogHeader>

          {cashShortage ? (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">Saldo disponible</p>
                <p className="text-sm font-semibold text-foreground">
                  {formatCurrency(cashShortage.available)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">Monto requerido</p>
                <p className="text-sm font-semibold text-foreground">
                  {formatCurrency(cashShortage.required)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">Faltante</p>
                <p className="text-sm font-semibold text-destructive">
                  {formatCurrency(cashShortage.missing)}
                </p>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                if (!cashShortage) return
                setIsCashIncomeDialogOpen(true)
                setIsCashShortageDialogOpen(false)
              }}
              disabled={!cashShortage}
            >
              Registrar ingreso de caja
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCashShortageDialogOpen(false)
                setCashShortage(null)
              }}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SidePanel
        open={isCashIncomeDialogOpen}
        onOpenChange={(open) => {
          setIsCashIncomeDialogOpen(open)
          if (!open) {
            cashIncomeForm.reset(defaultCashIncomeFormValues)
          }
        }}
      >
        <SidePanelContent className="p-0">
          <form
            className="flex h-full flex-col"
            onSubmit={cashIncomeForm.handleSubmit(handleRegisterCashIncome)}
          >
            <div className="flex items-start justify-between gap-4 border-b bg-popover px-6 py-4">
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">Registrar ingreso de caja</p>
                <p className="text-sm text-muted-foreground">
                  Registra el ingreso y vuelve automáticamente al flujo de pago a proveedor.
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
              {cashShortage ? (
                <div className="mb-6 grid gap-3 rounded-2xl border bg-muted/20 p-4 sm:grid-cols-3">
                  <div>
                    <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                      Saldo disponible
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {watchedIncomePaymentMethodId && incomeMethodBalance
                        ? incomeMethodBalance.loading
                          ? 'Calculando…'
                          : formatCurrency(incomeMethodBalance.available)
                        : formatCurrency(cashShortage.available)}
                    </p>
                  </div>
                  <div>
                    <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                      Requerido
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {formatCurrency(cashShortage.required)}
                    </p>
                  </div>
                  <div>
                    <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                      Faltante
                    </p>
                    <p className="mt-2 text-base font-semibold text-destructive">
                      {formatCurrency(cashShortage.missing)}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="space-y-4">
                <FormPaymentMethodTwoLevelSelect
                  label="Medio de dinero"
                  name="paymentMethodId"
                  control={cashIncomeForm.control}
                  methods={options.paymentMethods}
                  required
                  placeholderCategory="Selecciona una categoría"
                  placeholderSubmethod="Selecciona un submedio"
                />

                <div className="space-y-1">
                  <label htmlFor="cash-income-amount" className="text-xs font-medium text-foreground">
                    Monto
                  </label>
                  <Input
                    id="cash-income-amount"
                    type="number"
                    step="0.01"
                    {...cashIncomeForm.register('amount', {
                      valueAsNumber: true,
                    })}
                  />
                  <FieldError message={cashIncomeForm.formState.errors.amount?.message} />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Motivo</label>
                  <Controller
                    control={cashIncomeForm.control}
                    name="concept"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un motivo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Fondo adicional">Fondo adicional</SelectItem>
                          <SelectItem value="Transferencia de fondos">
                            Transferencia de fondos
                          </SelectItem>
                          <SelectItem value="Otro ingreso">Otro ingreso</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError message={cashIncomeForm.formState.errors.concept?.message} />
                </div>

                <div className="space-y-1">
                  <label htmlFor="cash-income-reference" className="text-xs font-medium text-foreground">
                    Referencia
                  </label>
                  <Input id="cash-income-reference" {...cashIncomeForm.register('reference')} />
                  <FieldError message={cashIncomeForm.formState.errors.reference?.message} />
                </div>

                <div className="space-y-1">
                  <label htmlFor="cash-income-observations" className="text-xs font-medium text-foreground">
                    Observaciones
                  </label>
                  <Textarea
                    id="cash-income-observations"
                    rows={3}
                    {...cashIncomeForm.register('observations')}
                  />
                  <FieldError message={cashIncomeForm.formState.errors.observations?.message} />
                </div>
              </div>
            </div>

            <div className="border-t bg-popover px-6 py-4">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCashIncomeDialogOpen(false)}
                  disabled={isRegisteringCashIncome}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isRegisteringCashIncome || !watchedIncomePaymentMethodId}
                >
                  {isRegisteringCashIncome ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Guardando ingreso
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Registrar ingreso
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </SidePanelContent>
      </SidePanel>

      <Dialog
        open={isMissingCashDrawerDialogOpen}
        onOpenChange={(open) => setIsMissingCashDrawerDialogOpen(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No hay caja activa</DialogTitle>
            <DialogDescription>
              Para registrar un pago a proveedor necesitas una caja abierta en la sesión.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">
              Abre la Caja y luego se retomará el flujo de pago sin que tengas que buscar nuevamente la orden.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                if (!selectedPaymentOrder) {
                  setIsMissingCashDrawerDialogOpen(false)
                  return
                }

                window.sessionStorage.setItem(
                  'pos_pending_purchase_payment',
                  JSON.stringify({
                    orderId: selectedPaymentOrder.id,
                    values: paymentForm.getValues(),
                  }),
                )
                setIsMissingCashDrawerDialogOpen(false)
                setIsPaymentDialogOpen(false)
                navigate(paths.caja)
              }}
            >
              Abrir Caja
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsMissingCashDrawerDialogOpen(false)}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SidePanel
        open={Boolean(selectedViewOrderId)}
        onOpenChange={(open) => {
          const anyChildOpen =
            isOrderReceiveDialogOpen ||
            isPaymentDialogOpen ||
            isOrderSummaryDialogOpen ||
            isCashShortageDialogOpen ||
            isMissingCashDrawerDialogOpen
          if (!open && anyChildOpen) return
          if (!open) {
            setSelectedViewOrderId(null)
          }
        }}
      >
        <SidePanelContent className="p-0 flex flex-col h-full">
          <style>{`
            @media print {
              body > *:not([data-purchase-order-root]) { display: none !important; }
              [data-order-ui] { display: none !important; }
              [data-purchase-order-root] {
                position: absolute !important;
                inset: 0 !important;
                overflow: visible !important;
                background: #fff !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              [data-purchase-order-root] > div {
                box-shadow: none !important;
                border: 0 !important;
                padding: 0 !important;
                margin: 0 !important;
                border-radius: 0 !important;
                max-width: 100% !important;
              }
              @page {
                size: A4 portrait;
                margin: 12mm 10mm 14mm 10mm;
                @bottom-right {
                  content: "Página " counter(page) " de " counter(pages);
                  font-size: 10px;
                  color: #64748b;
                }
              }
            }
          `}</style>

          <div
            data-order-ui
            className="flex items-start justify-between gap-3 border-b px-6 py-4 print:hidden"
            data-order-internal-only
          >
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Vista interna · Gestión de la orden
                </p>
                <SidePanelClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedViewOrderId(null)}
                  >
                    <X className="h-4 w-4 mr-1" /> Cerrar
                  </Button>
                </SidePanelClose>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-foreground leading-none">
                  Orden de compra {selectedOrderDetail?.order.code ?? ''}
                </h2>
                {selectedOrderDetail?.order.status ? (
                  <Badge variant="outline" title="Estado de la orden">
                    Orden · {selectedOrderDetail.order.status}
                  </Badge>
                ) : null}
                {selectedOrderDetail ? (
                  (() => {
                    const hasPending = selectedOrderDetail.items.some(
                      (i) => Number(i.baseQuantity - i.receivedBaseUnits) > 0,
                    )
                    const logistics = selectedOrderDetail.order.logisticsStatus ?? null
                    const receptionBadgeVariant: 'success' | 'info' | 'warning' | 'default' =
                      logistics === 'RECEPCION_COMPLETA'
                        ? 'success'
                        : logistics === 'RECEPCION_PARCIAL' || logistics === 'EN_RECEPCION'
                          ? 'info'
                          : logistics === 'REGISTRADA'
                            ? 'warning'
                            : hasPending
                              ? 'warning'
                              : 'success'
                    const receptionBadgeLabel =
                      logistics === 'RECEPCION_COMPLETA'
                        ? 'COMPLETA'
                        : logistics === 'RECEPCION_PARCIAL'
                          ? 'PARCIAL'
                          : logistics === 'EN_RECEPCION'
                            ? 'EN RECEPCIÓN'
                            : hasPending
                              ? 'PENDIENTE'
                              : 'COMPLETA'
                    return (
                      <Badge
                        variant={receptionBadgeVariant as any}
                        className="font-normal"
                        title="Estado de recepción"
                      >
                        Recepción · {receptionBadgeLabel}
                      </Badge>
                    )
                  })()
                ) : null}
                {selectedOrderDetail ? (
                  <Badge variant="default" className="font-normal" title="Estado de pago">
                    Pago · {selectedOrderDetail.order.financialStatus ?? '-'}
                  </Badge>
                ) : null}
              </div>
              {selectedOrderDetail?.supplier?.razonSocial ? (
                <p className="text-sm text-muted-foreground">
                  Proveedor · <span className="text-foreground font-medium">{selectedOrderDetail.supplier.razonSocial}</span>
                  {selectedOrderDetail.buyer?.fullName ? (
                    <> · Responsable · <span className="text-foreground font-medium">{selectedOrderDetail.buyer.fullName}</span></>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>

          <div
            data-order-ui
            className="border-b px-6 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-muted/20 print:hidden"
            data-order-internal-only
          >
            <div className="flex flex-wrap items-center gap-2">
              {(() => {
                if (!selectedOrderDetail) return null
                const hasAnyReception = selectedOrderDetail.items.some(
                  (item) => Number(item.receivedBaseUnits) > 0,
                )
                const logisticsBlocked =
                  selectedOrderDetail.order.logisticsStatus === 'RECEPCION_PARCIAL' ||
                  selectedOrderDetail.order.logisticsStatus === 'RECEPCION_COMPLETA'
                const orderClosed =
                  selectedOrderDetail.order.status === 'ANULADA' ||
                  selectedOrderDetail.order.status === 'RECIBIDA' ||
                  selectedOrderDetail.order.status === 'PAGADA'
                const canEdit = !hasAnyReception && !logisticsBlocked && !orderClosed
                if (!canEdit) return null
                return (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={isOrderDetailLoading}
                    onClick={() => void openEditOrder(selectedOrderDetail.order.id)}
                  >
                    <Edit3 className="h-4 w-4 mr-1" /> Editar
                  </Button>
                )
              })()}
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={isOrderDetailLoading || !selectedOrderDetail}
                onClick={async () => {
                  if (!selectedOrderDetail) return
                  try {
                    await printPurchaseOrderFromElement(
                      { detail: selectedOrderDetail },
                      { title: `Orden de compra ${selectedOrderDetail.order.code}` },
                    )
                  } catch (nextErr) {
                    toast.error(getApiErrorMessage(nextErr))
                  }
                }}
              >
                <Printer className="h-4 w-4 mr-1" /> Imprimir
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isOrderDetailLoading || !selectedOrderDetail}
                onClick={async () => {
                  if (!selectedOrderDetail) return
                  try {
                    await generatePurchaseOrderPDFBlob(
                      { detail: selectedOrderDetail },
                      { filename: `orden-de-compra-${selectedOrderDetail.order.code.toLowerCase()}.pdf` },
                    )
                  } catch (nextErr) {
                    toast.error(getApiErrorMessage(nextErr))
                  }
                }}
              >
                <FileDown className="h-4 w-4 mr-1" /> Descargar PDF
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isOrderDetailLoading || !selectedOrderDetail}
                onClick={async () => {
                  if (!selectedOrderDetail) return
                  const det = selectedOrderDetail
                  const orderSummaryForShare = {
                    code: det.order.code,
                    supplierName: det.supplier.razonSocial,
                    fechaEmision: det.fechaEmision,
                    fechaRecepcionEsperada: det.fechaRecepcionEsperada,
                    branchName: det.branch.nombre,
                    items: det.items.map((it) => ({
                      productName: it.productName,
                      sku: it.sku,
                      presentationName: it.presentationName,
                      presentationQuantity: it.presentationQuantity,
                      unitCostPresentation: it.unitCostPresentation,
                      taxRate: it.taxRate,
                      total: it.total,
                    })),
                    subtotalAmount: det.order.subtotalAmount,
                    taxAmount: det.order.taxAmount,
                    totalAmount: det.order.totalAmount,
                    observaciones: det.observaciones,
                  }
                  const textSummary = copyPurchaseOrderText(orderSummaryForShare)
                  toast.loading('Preparando PDF para compartir…', { id: 'share-oc-prep' })
                  let pdfBlob: Blob | null = null
                  try {
                    pdfBlob = await generatePurchaseOrderPDFBlob({ detail: det })
                  } catch (err) {
                    console.error('[shareOC] Fallo generando PDF previo:', err)
                  }
                  if (pdfBlob) {
                    toast.success('PDF listo para compartir.', { id: 'share-oc-prep' })
                  } else {
                    toast.warning('No se pudo generar el PDF para adjuntar; se mostrarán alternativas.', { id: 'share-oc-prep' })
                  }
                  const onDownload = async () => {
                    return generatePurchaseOrderPDFBlob(
                      { detail: det },
                      { filename: `orden-de-compra-${det.order.code.toLowerCase()}.pdf` },
                    )
                  }
                  const onPrint = () => {
                    void printPurchaseOrderFromElement(
                      { detail: det },
                      { title: `Orden de compra ${det.order.code}` },
                    )
                  }
                  await sharePurchaseOrder({
                    orderCode: det.order.code,
                    supplierName: det.supplier.razonSocial,
                    pdfBlob,
                    textSummary,
                    onDownload,
                    onPrint,
                  })
                }}
              >
                <Share2 className="h-4 w-4 mr-1" /> Compartir
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={
                  !selectedOrderDetail ||
                  selectedOrderDetail.order.logisticsStatus === 'RECEPCION_COMPLETA' ||
                  !selectedOrderDetail.items.some(
                    (item) => item.baseQuantity - item.receivedBaseUnits > 0,
                  )
                }
                onClick={() => {
                  if (!selectedOrderDetail) return
                  const hasPending = selectedOrderDetail.items.some(
                    (item) => item.baseQuantity - item.receivedBaseUnits > 0,
                  )
                  if (!hasPending) {
                    toast.info('Esta orden ya fue recibida completamente.')
                    return
                  }
                  if (selectedOrderDetail.order.logisticsStatus === 'RECEPCION_COMPLETA') {
                    toast.info('Esta orden ya está marcada como recibida.')
                    return
                  }
                  openOrderReceiveDialog(selectedOrderDetail.order.id)
                }}
                title={
                  selectedOrderDetail?.order.logisticsStatus === 'RECEPCION_COMPLETA'
                    ? 'La orden ya está completamente recibida.'
                    : 'Registrar cantidades, lotes y vencimientos recibidos del proveedor.'
                }
              >
                <PackageOpen className="h-4 w-4 mr-1" />
                Registrar recepción
              </Button>
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={
                  !selectedOrderDetail ||
                  Number(selectedOrderDetail.order.adjustedPendingAmount ?? 0) <= 0
                }
                onClick={() => {
                  if (selectedOrderDetail) openPaymentDialog(selectedOrderDetail.order)
                }}
                title={
                  Number(selectedOrderDetail?.order.adjustedPendingAmount ?? 0) <= 0
                    ? 'La orden ya se encuentra pagada completamente.'
                    : 'Registrar pago a proveedor (parcial o total).'
                }
              >
                <Wallet className="h-4 w-4 mr-1" />
                Registrar pago
              </Button>
            </div>
          </div>

          <div
            data-purchase-order-root
            className="flex-1 overflow-auto bg-muted/30 px-4 sm:px-6 py-5"
          >
            {isOrderDetailLoading ? (
              <div className="h-full min-h-[520px] grid place-items-center">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Cargando orden de compra…</p>
                </div>
              </div>
            ) : !selectedOrderDetail ? (
              <div className="h-full min-h-[520px] grid place-items-center">
                <p className="text-sm text-muted-foreground">No hay una orden cargada.</p>
              </div>
            ) : (
              <div className="mx-auto max-w-[860px] flex flex-col gap-4 print:hidden mb-3">
                <div
                  data-order-ui
                  data-order-internal-only
                  className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm"
                >
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Sucursal</p>
                    <p className="text-foreground font-medium leading-tight">{selectedOrderDetail.branch.nombre}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Fecha de emisión</p>
                    <p className="text-foreground font-medium leading-tight">{selectedOrderDetail.fechaEmision ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Recepción esperada</p>
                    <p className="text-foreground font-medium leading-tight">{selectedOrderDetail.fechaRecepcionEsperada ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Líneas</p>
                    <p className="text-foreground font-medium leading-tight">{selectedOrderDetail.items.length} productos</p>
                  </div>
                </div>

                <div
                  data-order-ui
                  data-order-internal-only
                  className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-5 text-sm"
                >
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Total documento</p>
                    <p className="text-foreground font-semibold text-2xl leading-none">
                      {formatCurrency(selectedOrderDetail.order.totalAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Pagado</p>
                    <p className="text-emerald-700 font-semibold text-2xl leading-none">
                      {formatCurrency(selectedOrderDetail.order.paidAmount)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedOrderDetail.order.paymentCount ?? 0} pago(s) registrado(s)
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">Saldo pendiente</p>
                    <p className={`font-semibold text-2xl leading-none ${
                      (selectedOrderDetail.order.adjustedPendingAmount ?? 0) > 0
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}>
                      {formatCurrency(selectedOrderDetail.order.adjustedPendingAmount)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(selectedOrderDetail.order.adjustedPendingAmount ?? 0) > 0
                        ? 'Pendiente por cancelar'
                        : 'Sin saldo pendiente'}
                    </p>
                  </div>
                </div>

                <div
                  ref={orderDocumentRef}
                  className="bg-white border border-slate-200 shadow-sm p-6"
                >
                  <PurchaseOrderDocument order={selectedOrderDetail} variant="internal-preview" />
                </div>
              </div>
            )}
          </div>
        </SidePanelContent>
      </SidePanel>
    </div>
  )
}
