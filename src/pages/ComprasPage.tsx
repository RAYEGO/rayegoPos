import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  ClipboardCheck,
  CreditCard,
  FileSpreadsheet,
  Loader2,
  PackageCheck,
  Plus,
  RotateCcw,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
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
import { purchasesService } from '@/services/purchasesService'
import type {
  CreatePurchaseOrderPayload,
  PurchaseOrderStatus,
  PurchaseReceiptStatus,
  PurchasesDashboardResponse,
  RegisterPurchasePaymentPayload,
  ReceivePurchaseItemPayload,
  ReturnPurchaseItemPayload,
} from '@/types/purchases'
import { toast } from 'sonner'

const createPurchaseSchema = z.object({
  sucursalId: z.string().uuid({ message: 'Selecciona una sucursal.' }),
  proveedorId: z.string().uuid({ message: 'Selecciona un proveedor.' }),
  fechaEmision: z.string().min(1, 'Ingresa la fecha de emisión.'),
  fechaRecepcion: z.string().optional(),
  estado: z.enum(['BORRADOR', 'REGISTRADA']),
  observaciones: z.string().max(255).optional(),
  items: z
    .array(
      z.object({
        productoId: z.string().uuid({ message: 'Selecciona un producto.' }),
        cantidad: z.number().positive('La cantidad debe ser mayor a 0.'),
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
  cantidadRecibida: z.number().positive('La cantidad recibida debe ser mayor a 0.'),
  stockReservado: z.number().min(0, 'El stock reservado no puede ser negativo.'),
  stockBloqueado: z.number().min(0, 'El stock bloqueado no puede ser negativo.'),
  almacen: z.string().max(120).optional(),
  observaciones: z.string().max(255).optional(),
})

type ReceivePurchaseFormValues = z.infer<typeof receivePurchaseSchema>

const returnPurchaseSchema = z.object({
  target: z.enum(['DISPONIBLE', 'RESERVADO', 'BLOQUEADO']),
  quantity: z.number().positive('La cantidad a devolver debe ser mayor a 0.'),
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

type OrderReceiptDraft = {
  detailId: string
  productName: string
  pendingUnits: number
  include: boolean
  numeroLote: string
  fechaFabricacion: string
  fechaVencimiento: string
  cantidadRecibida: number
  stockReservado: number
  stockBloqueado: number
  almacen: string
  observaciones: string
}

const today = new Date().toISOString().slice(0, 10)

const defaultFormValues: CreatePurchaseFormValues = {
  sucursalId: '',
  proveedorId: '',
  fechaEmision: today,
  fechaRecepcion: '',
  estado: 'REGISTRADA',
  observaciones: '',
  items: [
    {
      productoId: '',
      cantidad: 1,
      costoUnitario: 0,
      porcentajeImpuesto: 18,
    },
  ],
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(value)
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

function getOrderStatusVariant(status: PurchaseOrderStatus) {
  if (status === 'PAGADA') return 'success'
  if (status === 'REGISTRADA' || status === 'PARCIAL') return 'info'
  if (status === 'BORRADOR') return 'warning'
  return 'destructive'
}

function getReceiptStatusVariant(status: PurchaseReceiptStatus) {
  if (status === 'RECIBIDA') return 'success'
  if (status === 'PROGRAMADA') return 'info'
  return 'warning'
}

export function ComprasPage() {
  const { logout, session } = useAuth()
  const accessToken = session?.accessToken ?? ''
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'TODAS' | PurchaseOrderStatus>('TODAS')
  const [branchFilter, setBranchFilter] = useState('TODAS')
  const [dashboard, setDashboard] = useState<PurchasesDashboardResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
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
  const [orderReceiptDrafts, setOrderReceiptDrafts] = useState<OrderReceiptDraft[]>([])
  const [isOrderSummaryDialogOpen, setIsOrderSummaryDialogOpen] = useState(false)
  const [selectedSummaryOrderId, setSelectedSummaryOrderId] = useState<string | null>(null)

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

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  const watchedItems = form.watch('items')
  const watchedReceivedUnits = Number(receiveForm.watch('cantidadRecibida')) || 0
  const watchedReservedUnits = Number(receiveForm.watch('stockReservado')) || 0
  const watchedBlockedUnits = Number(receiveForm.watch('stockBloqueado')) || 0
  const watchedReturnTarget = returnForm.watch('target')
  const watchedReturnQuantity = Number(returnForm.watch('quantity')) || 0
  const watchedPaymentMethodId = paymentForm.watch('formaPagoId')
  const watchedPaymentAmount = Number(paymentForm.watch('monto')) || 0

  const draftTotals = useMemo(() => {
    return watchedItems.reduce(
      (summary, item) => {
        const quantity = Number(item.cantidad) || 0
        const unitCost = Number(item.costoUnitario) || 0
        const taxRate = Number(item.porcentajeImpuesto) || 0
        const baseAmount = quantity * unitCost
        const taxAmount = baseAmount * (taxRate / 100)

        summary.subtotal += baseAmount
        summary.tax += taxAmount
        summary.total += baseAmount + taxAmount
        return summary
      },
      { subtotal: 0, tax: 0, total: 0 },
    )
  }, [watchedItems])

  const loadDashboard = useCallback(async () => {
    if (!accessToken) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await purchasesService.getDashboard(accessToken, {
        search,
        status: statusFilter === 'TODAS' ? undefined : statusFilter,
        branchId: branchFilter === 'TODAS' ? undefined : branchFilter,
      })

      setDashboard(response)
    } catch (nextError) {
      setError(getApiErrorMessage(nextError))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, branchFilter, search, statusFilter])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

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

  const canCreateOrders =
    options.branches.length > 0 &&
    options.suppliers.length > 0 &&
    options.products.length > 0

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

  const selectedOrderAvailableUnits = orderReceiptDrafts.reduce((sum, item) => {
    if (!item.include) {
      return sum
    }

    return sum + Math.max(0, item.cantidadRecibida - item.stockReservado - item.stockBloqueado)
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
      sucursalId: values.sucursalId,
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
      await purchasesService.createOrder(accessToken, payload)
      toast.success('Orden de compra registrada correctamente.')
      setIsCreateDialogOpen(false)
      form.reset({
        ...defaultFormValues,
        fechaEmision: new Date().toISOString().slice(0, 10),
      })
      await loadDashboard()
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        toast.error('Tu sesión venció o cambió con el despliegue. Ingresa nuevamente para registrar compras.')
        await logout()
        return
      }

      toast.error(getApiErrorMessage(nextError))
    } finally {
      setIsSubmitting(false)
    }
  }

  function openReceiveDialog(receipt: PurchasesDashboardResponse['receipts'][number]) {
    setSelectedReceiptId(receipt.id)
    receiveForm.reset({
      ...defaultReceiveFormValues,
      cantidadRecibida: Number(receipt.pendingUnits.toFixed(2)) || 1,
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
        toast.error(
          'Tu sesión venció o cambió con el despliegue. Ingresa nuevamente para recepcionar compras.',
        )
        await logout()
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
      quantity: Number(defaultQuantity.toFixed(2)) || 1,
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
        toast.error(
          'Tu sesión venció o cambió con el despliegue. Ingresa nuevamente para registrar devoluciones.',
        )
        await logout()
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
      await loadDashboard()
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        toast.error(
          'Tu sesión venció o cambió con el despliegue. Ingresa nuevamente para registrar pagos.',
        )
        await logout()
        return
      }

      toast.error(getApiErrorMessage(nextError))
    } finally {
      setIsPaying(false)
    }
  }

  function updateOrderReceiptDraft(
    detailId: string,
    patch: Partial<OrderReceiptDraft>,
  ) {
    setOrderReceiptDrafts((current) =>
      current.map((item) =>
        item.detailId === detailId ? { ...item, ...patch } : item,
      ),
    )
  }

  function openOrderReceiveDialog(orderId: string) {
    const order = orders.find((entry) => entry.id === orderId)
    const pendingReceipts =
      receiptGroupsByOrder[orderId]?.pendingReceipts ?? []

    if (!order || pendingReceipts.length === 0) {
      toast.error('La orden seleccionada ya no tiene líneas pendientes por recepcionar.')
      return
    }

    const nextDrafts: OrderReceiptDraft[] = pendingReceipts.map((receipt, index) => ({
      detailId: receipt.id,
      productName: receipt.productName,
      pendingUnits: receipt.pendingUnits,
      include: true,
      numeroLote: `${receipt.purchaseCode.replace('CMP-', 'RCP-')}-${index + 1}`,
      fechaFabricacion: '',
      fechaVencimiento: '',
      cantidadRecibida: Number(receipt.pendingUnits.toFixed(2)),
      stockReservado: 0,
      stockBloqueado: 0,
      almacen: receipt.branchName === 'Sucursal Principal' ? 'Mostrador principal' : '',
      observaciones: '',
    }))

    setSelectedOrderId(orderId)
    setOrderReceiptDrafts(nextDrafts)
    setIsOrderReceiveDialogOpen(true)
  }

  function openOrderSummaryDialog(orderId: string) {
    setSelectedSummaryOrderId(orderId)
    setIsOrderSummaryDialogOpen(true)
  }

  async function handleCloseOrderReceipt() {
    if (!accessToken || !selectedOrder || !selectedOrderReceiptGroup) {
      toast.error('La orden seleccionada no está disponible.')
      return
    }

    const linesToReceive = orderReceiptDrafts.filter((item) => item.include)

    if (linesToReceive.length === 0) {
      toast.error('Selecciona al menos una línea pendiente para recepcionar.')
      return
    }

    for (const line of linesToReceive) {
      if (!line.numeroLote.trim()) {
        toast.error(`Ingresa el lote para ${line.productName}.`)
        return
      }

      if (!line.fechaVencimiento.trim()) {
        toast.error(`Ingresa el vencimiento para ${line.productName}.`)
        return
      }

      if (!Number.isFinite(line.cantidadRecibida) || line.cantidadRecibida <= 0) {
        toast.error(`La cantidad recibida de ${line.productName} debe ser mayor a 0.`)
        return
      }

      if (line.cantidadRecibida - line.pendingUnits > 0.0001) {
        toast.error(`La cantidad de ${line.productName} supera el saldo pendiente.`)
        return
      }

      if (line.stockReservado < 0 || line.stockBloqueado < 0) {
        toast.error(`Los stocks reservados o bloqueados de ${line.productName} no son válidos.`)
        return
      }

      if (line.stockReservado + line.stockBloqueado - line.cantidadRecibida > 0.0001) {
        toast.error(`La reserva y bloqueo de ${line.productName} superan lo recibido.`)
        return
      }
    }

    setIsClosingOrderReceipt(true)

    try {
      const closedOrderId = selectedOrder.id

      for (const line of linesToReceive) {
        const payload: ReceivePurchaseItemPayload = {
          detalleCompraId: line.detailId,
          numeroLote: line.numeroLote.trim(),
          fechaFabricacion: line.fechaFabricacion.trim() || undefined,
          fechaVencimiento: line.fechaVencimiento,
          cantidadRecibida: Number(line.cantidadRecibida),
          stockReservado: Number(line.stockReservado),
          stockBloqueado: Number(line.stockBloqueado),
          almacen: line.almacen.trim() || undefined,
          observaciones: line.observaciones.trim() || undefined,
        }

        await purchasesService.receiveItem(accessToken, payload)
      }

      await loadDashboard()

      setIsOrderReceiveDialogOpen(false)
      setSelectedOrderId(null)
      setOrderReceiptDrafts([])
      setSelectedSummaryOrderId(closedOrderId)
      setIsOrderSummaryDialogOpen(true)

      toast.success(
        selectedOrderReceiptGroup.pendingLines === linesToReceive.length
          ? 'Recepción completa registrada. La orden quedó actualizada.'
          : 'Recepción parcial registrada para la orden.',
      )
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        toast.error(
          'Tu sesión venció o cambió con el despliegue. Ingresa nuevamente para cerrar la recepción.',
        )
        await logout()
        return
      }

      toast.error(getApiErrorMessage(nextError))
    } finally {
      setIsClosingOrderReceipt(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Compras" />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>Abastecimiento y recepcion</CardTitle>
            <CardDescription>
              Flujo de compras conectado a proveedores, recepcion por lote e impacto en inventario.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Ordenes activas
              </p>
              <p className="mt-2 text-display text-foreground">{purchaseMetrics.activeOrders}</p>
              <p className="text-small text-muted-foreground">
                en curso con proveedor
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Recepciones programadas
              </p>
              <p className="mt-2 text-display text-foreground">
                {purchaseMetrics.scheduledReceipts}
              </p>
              <p className="text-small text-muted-foreground">
                listas para ingreso por lote
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Observadas
              </p>
              <p className="mt-2 text-display text-foreground">
                {purchaseMetrics.observedReceipts}
              </p>
              <p className="text-small text-muted-foreground">
                requieren validacion operativa
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Monto comprometido
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {formatCurrency(purchaseMetrics.activeSpend)}
              </p>
              <p className="text-small text-muted-foreground">
                ordenes no anuladas
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Devuelto
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {formatCurrency(purchaseMetrics.returnedAmount)}
              </p>
              <p className="text-small text-muted-foreground">
                nota de credito operativa
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Neto compras
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {formatCurrency(purchaseMetrics.netSpend)}
              </p>
              <p className="text-small text-muted-foreground">
                despues de devoluciones
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Pagado
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {formatCurrency(purchaseMetrics.totalPaid)}
              </p>
              <p className="text-small text-muted-foreground">
                abonos a proveedor
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Cuentas por pagar
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {formatCurrency(purchaseMetrics.pendingPayables)}
              </p>
              <p className="text-small text-muted-foreground">
                saldo vivo pendiente
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Enlace con inventario</CardTitle>
            <CardDescription>
              Lo recibido en compras alimenta de inmediato los lotes y sus vencimientos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Recepcion por lote</p>
              <p className="mt-1 text-small text-muted-foreground">
                Cada ingreso queda listo para generar lote, fecha de vencimiento y prioridad FIFO.
              </p>
            </div>
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Control sanitario</p>
              <p className="mt-1 text-small text-muted-foreground">
                La recepcion puede marcar observaciones, cadena de frio y trazabilidad de proveedor.
              </p>
            </div>
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Reposicion dirigida</p>
              <p className="mt-1 text-small text-muted-foreground">
                El modulo prepara compras segun quiebres, vencimientos y cobertura por sucursal.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

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
                  value={statusFilter}
                  onValueChange={(value) =>
                    setStatusFilter(value as 'TODAS' | PurchaseOrderStatus)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAS">Todos los estados</SelectItem>
                    <SelectItem value="BORRADOR">Borrador</SelectItem>
                    <SelectItem value="REGISTRADA">Registrada</SelectItem>
                    <SelectItem value="PARCIAL">Parcial</SelectItem>
                    <SelectItem value="PAGADA">Pagada</SelectItem>
                    <SelectItem value="ANULADA">Anulada</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAS">Todas las sucursales</SelectItem>
                    {options.branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Orden</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Sucursal</TableHead>
                      <TableHead>Creación</TableHead>
                      <TableHead>Entrega esperada</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
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
                          {order.branchName}
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
                              {formatCurrency(order.totalAmount)}
                            </p>
                            {order.returnedAmount > 0 ? (
                              <p className="text-small text-amber-700">
                                devuelto {formatCurrency(order.returnedAmount)}
                              </p>
                            ) : null}
                            <p className="text-small text-muted-foreground">
                              neto {formatCurrency(order.netAmount)}
                            </p>
                            <p className="text-small text-emerald-700">
                              pagado {formatCurrency(order.paidAmount)}
                            </p>
                            <p className="text-small text-muted-foreground">
                              saldo ajustado {formatCurrency(order.adjustedPendingAmount)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge variant={getOrderStatusVariant(order.status)}>
                              {order.status}
                            </Badge>
                            {receiptGroupsByOrder[order.id]?.pendingLines ? (
                              <p className="text-small text-muted-foreground">
                                {receiptGroupsByOrder[order.id].pendingLines} líneas pendientes
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {receiptGroupsByOrder[order.id]?.pendingLines > 0 &&
                          order.status !== 'BORRADOR' &&
                          order.status !== 'ANULADA' ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => openOrderSummaryDialog(order.id)}
                              >
                                Ver detalle
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => openPaymentDialog(order)}
                                disabled={order.adjustedPendingAmount <= 0}
                              >
                                Registrar pago
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => openOrderReceiveDialog(order.id)}
                              >
                                Cerrar recepción
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => openPaymentDialog(order)}
                                disabled={order.adjustedPendingAmount <= 0}
                              >
                                {order.adjustedPendingAmount > 0 ? 'Registrar pago' : 'Sin saldo'}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => openOrderSummaryDialog(order.id)}
                              >
                                {order.status === 'PAGADA' ? 'Ver cierre' : 'Ver detalle'}
                              </Button>
                              <span className="self-center text-small text-muted-foreground">
                                {order.status === 'PAGADA' ? 'Finalizada' : 'Sin pendientes'}
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
                                {receipt.receivedUnits.toFixed(2)} / {receipt.orderedUnits.toFixed(2)}
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
                                  Dev. {receipt.returnedUnits.toFixed(2)}
                                </Badge>
                              ) : null}
                              {receipt.availableUnits > 0 ? (
                                <Badge variant="outline">
                                  Disp. {receipt.availableUnits.toFixed(2)}
                                </Badge>
                              ) : null}
                              {receipt.reservedUnits > 0 ? (
                                <Badge variant="outline">
                                  Res. {receipt.reservedUnits.toFixed(2)}
                                </Badge>
                              ) : null}
                              {receipt.blockedUnits > 0 ? (
                                <Badge variant="outline">
                                  Bloq. {receipt.blockedUnits.toFixed(2)}
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

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Registrar orden de compra</DialogTitle>
            <DialogDescription>
              Alta inicial de la orden con proveedor, sucursal, costos e impuestos por línea.
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-6" onSubmit={form.handleSubmit(handleCreateOrder)}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Sucursal</label>
                <Controller
                  control={form.control}
                  name="sucursalId"
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona sucursal" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={form.formState.errors.sucursalId?.message} />
              </div>

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
                <Input type="date" {...form.register('fechaEmision')} />
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
                  className="min-h-24"
                />
                <FieldError message={form.formState.errors.observaciones?.message} />
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-foreground">Líneas de compra</p>
                  <p className="text-small text-muted-foreground">
                    Registra productos, cantidades y costo unitario para calcular la orden.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({
                      productoId: '',
                      cantidad: 1,
                      costoUnitario: 0,
                      porcentajeImpuesto: 18,
                    })
                  }
                >
                  <Plus className="h-4 w-4" />
                  Agregar línea
                </Button>
              </div>

              <div className="space-y-4">
                {fields.map((field, index) => {
                  const selectedProductId = form.watch(`items.${index}.productoId`)
                  const selectedProduct = options.products.find(
                    (product) => product.id === selectedProductId,
                  )

                  return (
                    <div key={field.id} className="grid gap-4 rounded-2xl border p-4 lg:grid-cols-[1.6fr_0.45fr_0.55fr_0.45fr_auto]">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Producto</label>
                        <Controller
                          control={form.control}
                          name={`items.${index}.productoId`}
                          render={({ field: productField }) => (
                            <Select
                              value={productField.value || undefined}
                              onValueChange={(value) => {
                                productField.onChange(value)

                                const product = options.products.find(
                                  (entry) => entry.id === value,
                                )
                                const currentCost = form.getValues(
                                  `items.${index}.costoUnitario`,
                                )

                                if (product && (!currentCost || currentCost === 0)) {
                                  form.setValue(
                                    `items.${index}.costoUnitario`,
                                    product.referenceCost,
                                    { shouldDirty: true },
                                  )
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona producto" />
                              </SelectTrigger>
                              <SelectContent>
                                {options.products.map((product) => (
                                  <SelectItem key={product.id} value={product.id}>
                                    {product.name} · {product.sku}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        <FieldError
                          message={form.formState.errors.items?.[index]?.productoId?.message}
                        />
                        {selectedProduct ? (
                          <p className="text-small text-muted-foreground">
                            {selectedProduct.sku} · costo ref. {formatCurrency(selectedProduct.referenceCost)}
                          </p>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Cantidad</label>
                        <Input
                          type="number"
                          step="0.01"
                          {...form.register(`items.${index}.cantidad`, {
                            valueAsNumber: true,
                          })}
                        />
                        <FieldError
                          message={form.formState.errors.items?.[index]?.cantidad?.message}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Costo unitario</label>
                        <Input
                          type="number"
                          step="0.000001"
                          {...form.register(`items.${index}.costoUnitario`, {
                            valueAsNumber: true,
                          })}
                        />
                        <FieldError
                          message={
                            form.formState.errors.items?.[index]?.costoUnitario?.message
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">IGV %</label>
                        <Input
                          type="number"
                          step="0.01"
                          {...form.register(`items.${index}.porcentajeImpuesto`, {
                            valueAsNumber: true,
                          })}
                        />
                        <FieldError
                          message={
                            form.formState.errors.items?.[index]?.porcentajeImpuesto?.message
                          }
                        />
                      </div>

                      <div className="flex items-end justify-between gap-3 lg:flex-col lg:justify-end">
                        <div className="text-right text-small text-muted-foreground">
                          Total
                          <p className="font-medium text-foreground">
                            {formatCurrency(
                              (Number(watchedItems[index]?.cantidad) || 0) *
                                (Number(watchedItems[index]?.costoUnitario) || 0) *
                                (1 +
                                  (Number(watchedItems[index]?.porcentajeImpuesto) || 0) / 100),
                            )}
                          </p>
                          {selectedProduct ? (
                            <p>{selectedProduct.unitSymbol}</p>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="grid gap-4 rounded-2xl border bg-muted/20 p-4 md:grid-cols-3">
                <div>
                  <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                    Subtotal
                  </p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    {formatCurrency(draftTotals.subtotal)}
                  </p>
                </div>
                <div>
                  <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                    Impuesto
                  </p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    {formatCurrency(draftTotals.tax)}
                  </p>
                </div>
                <div>
                  <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                    Total
                  </p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    {formatCurrency(draftTotals.total)}
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
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
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isReceiveDialogOpen}
        onOpenChange={(open) => {
          setIsReceiveDialogOpen(open)

          if (!open) {
            setSelectedReceiptId(null)
            receiveForm.reset(defaultReceiveFormValues)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Recepcionar compra</DialogTitle>
            <DialogDescription>
              {selectedReceipt
                ? `${selectedReceipt.productName} · ${selectedReceipt.purchaseCode} · pendiente ${selectedReceipt.pendingUnits.toFixed(2)}`
                : 'Registra el lote y define cómo ingresa el stock al inventario.'}
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-6" onSubmit={receiveForm.handleSubmit(handleReceiveItem)}>
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
                  step="0.01"
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
                  step="0.01"
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
                  step="0.01"
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
                  {watchedReceivedUnits.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                  Reservado + bloqueado
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {(watchedReservedUnits + watchedBlockedUnits).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                  Disponible inicial
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {receiveAvailableUnits.toFixed(2)}
                </p>
              </div>
            </div>

            <DialogFooter>
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
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isOrderReceiveDialogOpen}
        onOpenChange={(open) => {
          setIsOrderReceiveDialogOpen(open)

          if (!open) {
            setSelectedOrderId(null)
            setOrderReceiptDrafts([])
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Cerrar recepción por orden</DialogTitle>
            <DialogDescription>
              {selectedOrder && selectedOrderReceiptGroup
                ? `${selectedOrder.code} · ${selectedOrder.supplierName} · ${selectedOrderReceiptGroup.pendingLines} líneas pendientes`
                : 'Completa todas las líneas pendientes y la orden quedará finalizada.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {selectedOrderReceiptGroup ? (
              <div className="grid gap-4 rounded-2xl border bg-muted/20 p-4 md:grid-cols-4">
                <div>
                  <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                    Líneas pendientes
                  </p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    {selectedOrderReceiptGroup.pendingLines}
                  </p>
                </div>
                <div>
                  <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                    Unidades pendientes
                  </p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    {selectedOrderReceiptGroup.pendingUnits.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                    Unidades disponibles
                  </p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    {selectedOrderAvailableUnits.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                    Estado actual
                  </p>
                  <p className="mt-2">
                    <Badge variant={selectedOrder ? getOrderStatusVariant(selectedOrder.status) : 'outline'}>
                      {selectedOrder?.status ?? 'N/A'}
                    </Badge>
                  </p>
                </div>
              </div>
            ) : null}

            <div className="space-y-4">
              {orderReceiptDrafts.map((line) => {
                const draftAvailableUnits = Math.max(
                  0,
                  line.cantidadRecibida - line.stockReservado - line.stockBloqueado,
                )

                return (
                  <div key={line.detailId} className="space-y-4 rounded-2xl border p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="font-medium text-foreground">{line.productName}</p>
                        <p className="text-small text-muted-foreground">
                          Pendiente: {line.pendingUnits.toFixed(2)} und
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
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

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Lote</label>
                        <Input
                          value={line.numeroLote}
                          onChange={(event) =>
                            updateOrderReceiptDraft(line.detailId, {
                              numeroLote: event.target.value,
                            })
                          }
                          disabled={!line.include}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Cantidad recibida</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={line.cantidadRecibida}
                          onChange={(event) =>
                            updateOrderReceiptDraft(line.detailId, {
                              cantidadRecibida: Number(event.target.value),
                            })
                          }
                          disabled={!line.include}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Fecha fabricación</label>
                        <Input
                          type="date"
                          value={line.fechaFabricacion}
                          onChange={(event) =>
                            updateOrderReceiptDraft(line.detailId, {
                              fechaFabricacion: event.target.value,
                            })
                          }
                          disabled={!line.include}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Fecha vencimiento</label>
                        <Input
                          type="date"
                          value={line.fechaVencimiento}
                          onChange={(event) =>
                            updateOrderReceiptDraft(line.detailId, {
                              fechaVencimiento: event.target.value,
                            })
                          }
                          disabled={!line.include}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Reservado</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={line.stockReservado}
                          onChange={(event) =>
                            updateOrderReceiptDraft(line.detailId, {
                              stockReservado: Number(event.target.value),
                            })
                          }
                          disabled={!line.include}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Bloqueado</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={line.stockBloqueado}
                          onChange={(event) =>
                            updateOrderReceiptDraft(line.detailId, {
                              stockBloqueado: Number(event.target.value),
                            })
                          }
                          disabled={!line.include}
                        />
                      </div>

                      <div className="space-y-2 xl:col-span-2">
                        <label className="text-sm font-medium">Almacén / ubicación</label>
                        <Input
                          value={line.almacen}
                          onChange={(event) =>
                            updateOrderReceiptDraft(line.detailId, {
                              almacen: event.target.value,
                            })
                          }
                          disabled={!line.include}
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2 xl:col-span-4">
                        <label className="text-sm font-medium">Observaciones</label>
                        <Textarea
                          value={line.observaciones}
                          onChange={(event) =>
                            updateOrderReceiptDraft(line.detailId, {
                              observaciones: event.target.value,
                            })
                          }
                          className="min-h-20"
                          disabled={!line.include}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 rounded-2xl border bg-muted/20 p-4 md:grid-cols-3">
                      <div>
                        <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                          Pendiente
                        </p>
                        <p className="mt-2 text-base font-semibold text-foreground">
                          {line.pendingUnits.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                          Recibido
                        </p>
                        <p className="mt-2 text-base font-semibold text-foreground">
                          {Number(line.cantidadRecibida || 0).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                          Disponible
                        </p>
                        <p className="mt-2 text-base font-semibold text-foreground">
                          {draftAvailableUnits.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <DialogFooter>
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
                disabled={isClosingOrderReceipt || orderReceiptDrafts.length === 0}
              >
                {isClosingOrderReceipt ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cerrando recepción...
                  </>
                ) : (
                  <>
                    <PackageCheck className="h-4 w-4" />
                    Confirmar recepción completa
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isReturnDialogOpen}
        onOpenChange={(open) => {
          setIsReturnDialogOpen(open)

          if (!open) {
            setSelectedReturnReceiptId(null)
            returnForm.reset(defaultReturnFormValues)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar devolución de compra</DialogTitle>
            <DialogDescription>
              {selectedReturnReceipt
                ? `${selectedReturnReceipt.productName} · ${selectedReturnReceipt.lotCode} · ${selectedReturnReceipt.purchaseCode}`
                : 'Selecciona el origen del stock que volverá al proveedor.'}
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-6" onSubmit={returnForm.handleSubmit(handleReturnItem)}>
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
                  step="0.01"
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
                  {selectedReturnStock.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                  A devolver
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {watchedReturnQuantity.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                  Saldo estimado
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {Math.max(0, selectedReturnStock - watchedReturnQuantity).toFixed(2)}
                </p>
              </div>
            </div>

            <DialogFooter>
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
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isPaymentDialogOpen}
        onOpenChange={(open) => {
          setIsPaymentDialogOpen(open)

          if (!open) {
            setSelectedPaymentOrderId(null)
            paymentForm.reset(defaultPaymentFormValues)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar pago a proveedor</DialogTitle>
            <DialogDescription>
              {selectedPaymentOrder
                ? `${selectedPaymentOrder.code} · ${selectedPaymentOrder.supplierName} · saldo ${formatCurrency(selectedPaymentOrder.adjustedPendingAmount)}`
                : 'Registra un abono real para actualizar cuentas por pagar.'}
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-6" onSubmit={paymentForm.handleSubmit(handleRegisterPayment)}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Forma de pago</label>
                <Controller
                  control={paymentForm.control}
                  name="formaPagoId"
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona forma de pago" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.paymentMethods.map((method) => (
                          <SelectItem key={method.id} value={method.id}>
                            {method.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={paymentForm.formState.errors.formaPagoId?.message} />
              </div>

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

            <DialogFooter>
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
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isOrderSummaryDialogOpen}
        onOpenChange={(open) => {
          setIsOrderSummaryDialogOpen(open)

          if (!open) {
            setSelectedSummaryOrderId(null)
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Detalle de recepción por orden</DialogTitle>
            <DialogDescription>
              {selectedSummaryOrder && selectedSummaryReceiptGroup
                ? `${selectedSummaryOrder.code} · ${selectedSummaryOrder.supplierName} · ${selectedSummaryReceiptGroup.totalLines} líneas`
                : 'Revisa el historial de recepciones, lotes y saldos de la orden.'}
            </DialogDescription>
          </DialogHeader>

          {selectedSummaryOrder && selectedSummaryReceiptGroup && selectedSummaryTotals ? (
            <div className="space-y-6">
              <div className="grid gap-4 rounded-2xl border bg-muted/20 p-4 md:grid-cols-5">
                <div>
                  <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                    Estado
                  </p>
                  <div className="mt-2">
                    <Badge variant={getOrderStatusVariant(selectedSummaryOrder.status)}>
                      {selectedSummaryOrder.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                    Recibido acumulado
                  </p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    {selectedSummaryTotals.receivedUnits.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                    Pendiente
                  </p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    {selectedSummaryTotals.pendingUnits.toFixed(2)}
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
                              {receipt.receivedUnits.toFixed(2)} / {receipt.orderedUnits.toFixed(2)}
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
                                Pendiente {receipt.pendingUnits.toFixed(2)}
                              </Badge>
                            ) : null}
                            {receipt.returnedUnits > 0 ? (
                              <Badge variant="warning">
                                Dev. {receipt.returnedUnits.toFixed(2)}
                              </Badge>
                            ) : null}
                            {receipt.coldChain ? (
                              <Badge variant="info">Cadena de frio</Badge>
                            ) : null}
                            {receipt.availableUnits > 0 ? (
                              <Badge variant="outline">
                                Disp. {receipt.availableUnits.toFixed(2)}
                              </Badge>
                            ) : null}
                            {receipt.reservedUnits > 0 ? (
                              <Badge variant="outline">
                                Res. {receipt.reservedUnits.toFixed(2)}
                              </Badge>
                            ) : null}
                            {receipt.blockedUnits > 0 ? (
                              <Badge variant="outline">
                                Bloq. {receipt.blockedUnits.toFixed(2)}
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

              <DialogFooter>
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
                {selectedSummaryReceiptGroup.pendingLines > 0 &&
                selectedSummaryOrder.status !== 'BORRADOR' &&
                selectedSummaryOrder.status !== 'ANULADA' ? (
                  <Button
                    type="button"
                    onClick={() => {
                      setIsOrderSummaryDialogOpen(false)
                      setSelectedSummaryOrderId(null)
                      openOrderReceiveDialog(selectedSummaryOrder.id)
                    }}
                  >
                    <PackageCheck className="h-4 w-4" />
                    Continuar cierre
                  </Button>
                ) : null}
              </DialogFooter>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed p-10 text-center">
              <p className="text-sm font-medium text-foreground">
                No se encontró información de recepción para esta orden.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
