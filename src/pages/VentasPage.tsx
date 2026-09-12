import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import {
  CreditCard,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingBasket,
  Trash2,
  MoreVertical,
  History,
  ClipboardList,
  X,
  MessageSquarePlus,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { FormPaymentMethodTwoLevelSelect } from '@/components/ui/payment-method-selector'
import { getMethodVariant } from '@/lib/payment-methods'
import { ReceiptDialog } from '@/components/sales/ReceiptDialog'
import { useAuth } from '@/hooks/useAuth'
import { useHandleUnauthorized } from '@/hooks/useHandleUnauthorized'
import { ApiError, ApiNetworkError } from '@/services/apiClient'
import { salesService } from '@/services/salesService'
import type { CreateSalePayload, SaleReceiptResponse, SalesDashboardResponse } from '@/types/sales'
import { toast } from 'sonner'

const saleCheckoutSchema = z.object({
  clienteId: z.string().optional(),
  tipoComprobante: z.enum(['TICKET', 'BOLETA', 'FACTURA']),
  observaciones: z.string().max(255, 'Máximo 255 caracteres.').optional(),
  payments: z
    .array(
      z.object({
        formaPagoId: z.string().uuid({ message: 'Selecciona una forma de pago.' }),
        monto: z.number().positive('El monto debe ser mayor a 0.'),
        referenciaExterna: z.string().max(120, 'Máximo 120 caracteres.').optional(),
        observaciones: z.string().max(255, 'Máximo 255 caracteres.').optional(),
      }),
    )
    .min(1, 'Registra al menos un pago.'),
})

type SaleCheckoutFormValues = z.infer<typeof saleCheckoutSchema>

const ventaRapidaSchema = z
  .object({
    descripcion: z.string().trim().min(1, 'Agrega una descripción.').max(255, 'Máximo 255 caracteres.'),
    simboloUnidad: z.string().trim().min(1, 'Agrega un símbolo.').max(20, 'Máximo 20 caracteres.').default('u'),
    precioUnitario: z.coerce.number().positive('El precio debe ser mayor a 0.'),
    cantidad: z.coerce.number().int().positive('La cantidad debe ser mayor a 0.'),
    descuentoTotal: z.coerce.number().min(0, 'El descuento no puede ser negativo.').optional().default(0),
  })
  .superRefine((value, ctx) => {
    const bruto = value.precioUnitario * value.cantidad
    if (value.descuentoTotal > bruto) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El descuento no puede superar el subtotal de la línea.',
        path: ['descuentoTotal'],
      })
    }
  })

type VentaRapidaFormValues = z.infer<typeof ventaRapidaSchema>

type LocalCartPresentationOption = {
  id: string
  name: string
  salePrice: number
  factorToBase: number
}

type LocalCartItemProductoRegistrado = {
  tipoLinea: 'PRODUCTO_REGISTRADO'
  cartKey: string
  productId: string
  name: string
  sku: string
  unitSymbol: string
  presentationId: string | null
  presentationName: string | null
  presentationPrice: number | null
  presentationFactorToBase: number | null
  presentationOptions: LocalCartPresentationOption[]
  quantity: number
  discountTotal: number
  availableUnits: number
  requiresPrescription: boolean
  isControlled: boolean
  coldChain: boolean
  suggestedLotCode: string
  suggestedLotExpiryDate: string | null
}

type LocalCartItemVentaRapida = {
  tipoLinea: 'VENTA_RAPIDA'
  cartKey: string
  descripcion: string
  simboloUnidad: string
  unitPrice: number
  quantity: number
  discountTotal: number
}

type LocalCartItem = LocalCartItemProductoRegistrado | LocalCartItemVentaRapida

function isLocalCartProductoRegistrado(item: LocalCartItem): item is LocalCartItemProductoRegistrado {
  return item.tipoLinea === 'PRODUCTO_REGISTRADO'
}

function isLocalCartVentaRapida(item: LocalCartItem): item is LocalCartItemVentaRapida {
  return item.tipoLinea === 'VENTA_RAPIDA'
}

function makeProductoRegistradoCartKey(productId: string) {
  return `pr:${productId}`
}

function makeVentaRapidaCartKey(params: { descripcion: string; simboloUnidad: string; precioUnitario: number }) {
  const descripcion = params.descripcion.trim().toLowerCase()
  const simbolo = params.simboloUnidad.trim().toLowerCase()
  const precio = Number.isFinite(params.precioUnitario) ? params.precioUnitario : 0
  return `vr:${descripcion}|${simbolo}|${precio.toFixed(6)}`
}

const defaultCheckoutFormValues: SaleCheckoutFormValues = {
  clienteId: 'SHOWROOM',
  tipoComprobante: 'TICKET',
  observaciones: '',
  payments: [
    {
      formaPagoId: '',
      monto: 0,
      referenciaExterna: '',
      observaciones: '',
    },
  ],
}

const VENTA_RAPIDA_UNIDADES_MEDIDA = [
  { codigo: 'UND', nombre: 'Unidad', simbolo: 'und' },
  { codigo: 'CAJ', nombre: 'Caja', simbolo: 'caj' },
  { codigo: 'BLI', nombre: 'Blíster', simbolo: 'blis' },
  { codigo: 'SOB', nombre: 'Sobre', simbolo: 'sob' },
  { codigo: 'FRA', nombre: 'Frasco', simbolo: 'fra' },
  { codigo: 'PAQ', nombre: 'Paquete', simbolo: 'paq' },
  { codigo: 'PACK', nombre: 'Pack', simbolo: 'pack' },
  { codigo: 'BOL', nombre: 'Bolsa', simbolo: 'bol' },
  { codigo: 'OTR', nombre: 'Otro', simbolo: 'otr' },
] as const

const VENTA_RAPIDA_DEFAULT_SIMBOLO = VENTA_RAPIDA_UNIDADES_MEDIDA[0].simbolo

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

function getSaleStatusVariant(status: SalesDashboardResponse['recentSales'][number]['status']) {
  if (status === 'COBRADA') return 'success'
  if (status === 'EMITIDA') return 'info'
  if (status === 'BORRADOR') return 'warning'
  return 'destructive'
}

function getPaymentVariant(
  method: SalesDashboardResponse['recentSales'][number]['paymentMethods'][number],
) {
  return getMethodVariant(method)
}

function clampQuantity(value: number, max: number) {
  if (!Number.isFinite(value)) {
    return 1
  }
  return Math.min(Math.max(1, Math.floor(value)), Math.max(1, Math.floor(max)))
}

function getCartItemMax(item: LocalCartItem) {
  if (isLocalCartVentaRapida(item)) {
    return 9999
  }
  const factor = item.presentationFactorToBase ?? null
  if (!factor || !Number.isFinite(factor) || factor <= 0) {
    return Math.max(0, Math.floor(item.availableUnits))
  }
  return Math.max(0, Math.floor(item.availableUnits / factor))
}

function getCartItemUnitPrice(item: LocalCartItem) {
  if (isLocalCartVentaRapida(item)) {
    return item.unitPrice
  }
  if (typeof item.presentationPrice === 'number') {
    return item.presentationPrice
  }
  return 0
}

function getCartItemReservedUnits(item: LocalCartItem) {
  if (isLocalCartVentaRapida(item)) {
    return item.quantity
  }
  const factor = item.presentationFactorToBase ?? null
  if (!factor || !Number.isFinite(factor) || factor <= 0) {
    return item.quantity
  }
  return item.quantity * factor
}

function getCartItemLineSubtotal(item: LocalCartItem) {
  return item.quantity * getCartItemUnitPrice(item) - item.discountTotal
}

function getStockVariant(product: SalesDashboardResponse['products'][number]) {
  if (product.availableUnits === 0) return 'destructive'
  if (product.availableUnits <= 20) return 'warning'
  return 'success'
}

export function VentasPage() {
  const { session } = useAuth()
  const accessToken = session?.accessToken ?? ''

  const [dashboard, setDashboard] = useState<SalesDashboardResponse | null>(null)
  const [searchText, setSearchText] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('TODAS')
  const [availabilityFilter, setAvailabilityFilter] = useState<'TODOS' | 'CON_STOCK' | 'SIN_STOCK'>('TODOS')
  const [medicationTypeFilter, _setMedicationTypeFilter] = useState<string>('TODOS')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [cartItems, setCartItems] = useState<LocalCartItem[]>([])
  const [isCartPanelOpen, setIsCartPanelOpen] = useState(false)
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false)
  const [receiptSale, setReceiptSale] = useState<{ id: string; code: string } | null>(null)
  const [receiptPayload, setReceiptPayload] = useState<SaleReceiptResponse | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSaleObservaciones, setShowSaleObservaciones] = useState(false)
  const [cartPulseNonce, setCartPulseNonce] = useState(0)
  const [isCartJustAdded, setIsCartJustAdded] = useState(false)
  const [isVentaRapidaSubmittingAnim, setIsVentaRapidaSubmittingAnim] = useState(false)
  const [expandedPaymentNotes, setExpandedPaymentNotes] = useState<Record<number, boolean>>({})
  const [isVentaRapidaDialogOpen, setIsVentaRapidaDialogOpen] = useState(false)

  const handleUnauthorized = useHandleUnauthorized('VentasPage')

  useEffect(() => {
    const handle = window.setTimeout(() => setSearchDebounced(searchText), 220)
    return () => window.clearTimeout(handle)
  }, [searchText])

  const checkoutForm = useForm<SaleCheckoutFormValues>({
    resolver: zodResolver(saleCheckoutSchema),
    defaultValues: defaultCheckoutFormValues,
  })

  const {
    fields: paymentFields,
    append: appendPayment,
    remove: removePayment,
  } = useFieldArray({
    control: checkoutForm.control,
    name: 'payments',
  })

  const ventaRapidaForm = useForm<VentaRapidaFormValues>({
    resolver: zodResolver(ventaRapidaSchema),
    defaultValues: {
      descripcion: '',
      simboloUnidad: VENTA_RAPIDA_DEFAULT_SIMBOLO,
      precioUnitario: 0,
      cantidad: 1,
      descuentoTotal: 0,
    },
  })

  function handleAddVentaRapida(values: VentaRapidaFormValues) {
    try {
      addVentaRapidaToCart(values)
      toast.success('⚡ Venta rápida agregada al carrito.')
      setIsVentaRapidaSubmittingAnim(true)
      window.setTimeout(() => setIsVentaRapidaSubmittingAnim(false), 220)
      setIsVentaRapidaDialogOpen(false)
      ventaRapidaForm.reset({
        descripcion: '',
        simboloUnidad: VENTA_RAPIDA_DEFAULT_SIMBOLO,
        precioUnitario: 0,
        cantidad: 1,
        descuentoTotal: 0,
      })
    } catch (nextError) {
      toast.error(getApiErrorMessage(nextError))
    }
  }

  const watchedPayments =
    useWatch({
      control: checkoutForm.control,
      name: 'payments',
    }) ?? []

  const watchedCustomerId =
    useWatch({
      control: checkoutForm.control,
      name: 'clienteId',
    }) ?? 'SHOWROOM'

  const watchedSaleObservaciones =
    useWatch({
      control: checkoutForm.control,
      name: 'observaciones',
    }) ?? ''

  const loadDashboard = useCallback(async () => {
    if (!accessToken) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await salesService.getDashboard(accessToken, {
        search: searchDebounced,
        categoryId: categoryFilter === 'TODAS' ? undefined : categoryFilter,
        availability: availabilityFilter,
        commercialTypeId: medicationTypeFilter === 'TODOS' ? undefined : medicationTypeFilter,
      })

      setDashboard(response)
    } catch (nextError) {
      setError(getApiErrorMessage(nextError))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, categoryFilter, availabilityFilter, medicationTypeFilter, searchDebounced])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const options = {
    branches: dashboard?.options?.branches ?? [],
    categories: dashboard?.options?.categories ?? [],
    commercialTypes: dashboard?.options?.commercialTypes ?? [],
    medicationTypes: dashboard?.options?.medicationTypes ?? [],
    customers: dashboard?.options?.customers ?? [],
    paymentMethods: dashboard?.options?.paymentMethods ?? [],
  }

  const availableProducts = dashboard?.products ?? []
  const recentSales = dashboard?.recentSales ?? []
  const dispensations = dashboard?.dispensations ?? []

  const cartMetrics = useMemo(() => {
    const subtotal = cartItems.reduce((sum, item) => sum + getCartItemLineSubtotal(item), 0)
    const pr = cartItems.filter(isLocalCartProductoRegistrado)
    const vr = cartItems.filter(isLocalCartVentaRapida)

    return {
      itemCount: cartItems.length,
      prCount: pr.length,
      vrCount: vr.length,
      totalUnits: cartItems.reduce((sum, item) => sum + getCartItemReservedUnits(item), 0),
      subtotal,
      total: subtotal,
      prescriptionItems: pr.filter((item) => item.requiresPrescription).length,
      controlledItems: pr.filter((item) => item.isControlled).length,
    }
  }, [cartItems])

  useEffect(() => {
    if (cartItems.length === 0) {
      setIsCartPanelOpen(false)
    }
  }, [cartItems.length])

  useEffect(() => {
    if (cartPulseNonce === 0) return
    setIsCartJustAdded(true)
    const handle = window.setTimeout(() => setIsCartJustAdded(false), 420)
    return () => window.clearTimeout(handle)
  }, [cartPulseNonce])

  const watchedPaymentTotal = watchedPayments.reduce(
    (sum, payment) => sum + (Number.isFinite(payment?.monto) ? payment.monto : 0),
    0,
  )

  const selectedPaymentMethods = watchedPayments.map((payment) =>
    options.paymentMethods.find((method) => method.id === payment?.formaPagoId),
  )

  const estimatedChange =
    watchedPayments.length === 1 && selectedPaymentMethods[0]?.allowsChange
      ? Math.max(0, watchedPaymentTotal - cartMetrics.total)
      : 0

  const estimatedOutstanding = Math.max(
    0,
    cartMetrics.total - Math.min(cartMetrics.total, watchedPaymentTotal),
  )

  const selectedCustomer = useMemo(
    () =>
      watchedCustomerId === 'SHOWROOM'
        ? null
        : options.customers.find((customer) => customer.id === watchedCustomerId) ?? null,
    [options.customers, watchedCustomerId],
  )

  const customerAllowsCredit = selectedCustomer?.permitirCredito ?? false
  const availableCreditAmount =
    selectedCustomer && customerAllowsCredit
      ? Math.max(0, Number((selectedCustomer.limiteCredito - selectedCustomer.saldoPendiente).toFixed(2)))
      : 0

  const requiresFullPayment = watchedCustomerId === 'SHOWROOM' || !customerAllowsCredit

  const paymentBlockingMessage =
    requiresFullPayment && estimatedOutstanding > 0
      ? watchedCustomerId === 'SHOWROOM'
        ? 'Las ventas de mostrador deben quedar completamente pagadas.'
        : 'El cliente seleccionado no tiene crédito habilitado. La venta debe quedar completamente pagada.'
      : customerAllowsCredit && estimatedOutstanding > availableCreditAmount
        ? 'El saldo pendiente supera el límite de crédito disponible del cliente.'
        : null

  function syncCartWithProduct(
    current: LocalCartItemProductoRegistrado,
    nextProduct?: SalesDashboardResponse['products'][number],
  ): LocalCartItemProductoRegistrado {
    if (!nextProduct) {
      return current
    }

    const presentationOptions =
      nextProduct.packaging?.presentations
        ?.filter(
          (entry) =>
            entry.allowsSale &&
            entry.salePrice !== null &&
            entry.factorToBase !== null &&
            entry.factorToBase > 0,
        )
        .map((entry) => ({
          id: entry.id,
          name: entry.name,
          salePrice: entry.salePrice ?? 0,
          factorToBase: entry.factorToBase ?? 1,
        })) ?? []

    const basePresentationId = nextProduct.packaging?.basePresentationId ?? null
    const resolvedPresentationId =
      presentationOptions.length > 0
        ? presentationOptions.some((option) => option.id === current.presentationId)
          ? current.presentationId
          : presentationOptions.find((option) => option.id === basePresentationId)?.id ??
            presentationOptions[0]?.id ??
            null
        : null

    const resolvedPresentation = resolvedPresentationId
      ? presentationOptions.find((option) => option.id === resolvedPresentationId) ?? null
      : null

    return {
      ...current,
      name: nextProduct.name,
      sku: nextProduct.sku,
      unitSymbol: nextProduct.unitSymbol,
      presentationId: resolvedPresentationId,
      presentationName: resolvedPresentation?.name ?? null,
      presentationPrice: resolvedPresentation?.salePrice ?? null,
      presentationFactorToBase: resolvedPresentation?.factorToBase ?? null,
      presentationOptions,
      availableUnits: nextProduct.availableUnits,
      requiresPrescription: nextProduct.requiresPrescription,
      isControlled: nextProduct.isControlled,
      coldChain: nextProduct.coldChain,
      suggestedLotCode: nextProduct.suggestedLot?.lotCode ?? current.suggestedLotCode,
      suggestedLotExpiryDate:
        nextProduct.suggestedLot?.expiryDate ?? current.suggestedLotExpiryDate,
    }
  }

  useEffect(() => {
    if (!availableProducts.length) {
      return
    }

    const productMap = new Map(availableProducts.map((product) => [product.id, product]))

    setCartItems((current) =>
      current
        .map((item) => {
          if (isLocalCartVentaRapida(item)) {
            return item
          }
          const product = productMap.get(item.productId)

          if (!product) {
            return item
          }

          const synced = syncCartWithProduct(item, product)
          return {
            ...synced,
            quantity: clampQuantity(item.quantity, getCartItemMax(synced)),
          }
        })
        .filter((item) => (isLocalCartVentaRapida(item) ? true : item.availableUnits > 0)),
    )
  }, [availableProducts])

  function addToCart(product: SalesDashboardResponse['products'][number]) {
    if (!product.suggestedLot || product.availableUnits <= 0) {
      toast.error('El producto no tiene stock disponible para venta inmediata.')
      return
    }

    const suggestedLot = product.suggestedLot
    const cartKey = makeProductoRegistradoCartKey(product.id)

    setCartItems((current) => {
      const existing = current.find((item) => item.cartKey === cartKey)

      if (existing && isLocalCartProductoRegistrado(existing)) {
        const synced = syncCartWithProduct(existing, product)
        if (existing.quantity >= getCartItemMax(synced)) {
          toast.error('Ya alcanzaste el stock disponible para este producto.')
          return current
        }

        return current.map((item) =>
          item.cartKey === cartKey && isLocalCartProductoRegistrado(item)
            ? syncCartWithProduct(
                {
                  ...item,
                  quantity: item.quantity + 1,
                },
                product,
              )
            : item,
        )
      }

      const presentationOptions =
        product.packaging?.presentations
          ?.filter(
            (entry) =>
              entry.allowsSale &&
              entry.salePrice !== null &&
              entry.factorToBase !== null &&
              entry.factorToBase > 0,
          )
          .map((entry) => ({
            id: entry.id,
            name: entry.name,
            salePrice: entry.salePrice ?? 0,
            factorToBase: entry.factorToBase ?? 1,
          })) ?? []

      if (!presentationOptions.length) {
        toast.error('El producto no tiene presentaciones habilitadas para venta.')
        return current
      }

      const basePresentationId = product.packaging?.basePresentationId ?? null
      const selectedPresentationId =
        presentationOptions.find((option) => option.id === basePresentationId)?.id ??
        presentationOptions[0]?.id ??
        null
      const selectedPresentation = selectedPresentationId
        ? presentationOptions.find((option) => option.id === selectedPresentationId) ?? null
        : null

      return [
        ...current,
        {
          tipoLinea: 'PRODUCTO_REGISTRADO',
          cartKey,
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unitSymbol: product.unitSymbol,
          presentationId: selectedPresentationId,
          presentationName: selectedPresentation?.name ?? null,
          presentationPrice: selectedPresentation?.salePrice ?? null,
          presentationFactorToBase: selectedPresentation?.factorToBase ?? null,
          presentationOptions,
          quantity: 1,
          discountTotal: 0,
          availableUnits: product.availableUnits,
          requiresPrescription: product.requiresPrescription,
          isControlled: product.isControlled,
          coldChain: product.coldChain,
          suggestedLotCode: suggestedLot.lotCode,
          suggestedLotExpiryDate: suggestedLot.expiryDate,
        },
      ]
    })
  }

  function addVentaRapidaToCart(values: VentaRapidaFormValues) {
    const cartKey = makeVentaRapidaCartKey({
      descripcion: values.descripcion,
      simboloUnidad: values.simboloUnidad,
      precioUnitario: values.precioUnitario,
    })

    let added = false
    setCartItems((current) => {
      const existing = current.find((item) => item.cartKey === cartKey)
      if (existing && isLocalCartVentaRapida(existing)) {
        toast.warning('⚡ Esta venta rápida ya está en el carrito; ajusta la cantidad desde allí.')
        return current
      }

      const next: LocalCartItemVentaRapida = {
        tipoLinea: 'VENTA_RAPIDA',
        cartKey,
        descripcion: values.descripcion.trim(),
        simboloUnidad: values.simboloUnidad.trim(),
        unitPrice: Number.isFinite(values.precioUnitario) ? values.precioUnitario : 0,
        quantity: Number.isInteger(values.cantidad) ? Math.max(1, values.cantidad) : 1,
        discountTotal: Number.isFinite(values.descuentoTotal) ? Math.max(0, values.descuentoTotal) : 0,
      }
      added = true
      return [...current, next]
    })
    if (added) {
      setCartPulseNonce((n) => n + 1)
    }
  }

  function updateCartQuantity(cartKey: string, nextQuantity: number) {
    setCartItems((current) =>
      current.map((item) =>
        item.cartKey === cartKey
          ? {
              ...item,
              quantity: clampQuantity(nextQuantity, getCartItemMax(item)),
            }
          : item,
      ),
    )
  }

  function updateCartPresentation(productCartKey: string, presentationId: string) {
    setCartItems((current) =>
      current.map((item) => {
        if (item.cartKey !== productCartKey) return item
        if (!isLocalCartProductoRegistrado(item)) return item
        if (!item.presentationOptions.length) return item

        const selected = item.presentationOptions.find((option) => option.id === presentationId) ?? null
        if (!selected) return item

        const next: LocalCartItemProductoRegistrado = {
          ...item,
          presentationId: selected.id,
          presentationName: selected.name,
          presentationPrice: selected.salePrice,
          presentationFactorToBase: selected.factorToBase,
        }

        return {
          ...next,
          quantity: clampQuantity(next.quantity, getCartItemMax(next)),
        }
      }),
    )
  }

  function removeFromCart(cartKey: string) {
    setCartItems((current) => current.filter((item) => item.cartKey !== cartKey))
  }

  function openCartPanel() {
    if (!cartItems.length) {
      toast.error('Agrega productos al carrito antes de continuar.')
      return
    }

    const hasPayments = checkoutForm.getValues('payments')?.length > 0

    if (!hasPayments) {
      const defaultPaymentMethodId = options.paymentMethods[0]?.id ?? ''

      checkoutForm.reset({
        clienteId: 'SHOWROOM',
        tipoComprobante: 'TICKET',
        observaciones: '',
        payments: [
          {
            formaPagoId: defaultPaymentMethodId,
            monto: Number(cartMetrics.total.toFixed(2)),
            referenciaExterna: '',
            observaciones: '',
          },
        ],
      })
      setShowSaleObservaciones(false)
      setExpandedPaymentNotes({})
    } else {
      const savedObs = checkoutForm.getValues('observaciones') ?? ''
      const savedPays = checkoutForm.getValues('payments') ?? []
      setShowSaleObservaciones(Boolean(savedObs))
      const next: Record<number, boolean> = {}
      savedPays.forEach((p, i) => {
        if (p?.observaciones) next[i] = true
      })
      setExpandedPaymentNotes(next)
    }

    setIsCartPanelOpen(true)
  }

  async function handleCreateSale(values: SaleCheckoutFormValues) {
    if (!accessToken) {
      toast.error('La sesión actual no está disponible.')
      return
    }

    if (!cartItems.length) {
      toast.error('No hay productos en el carrito para emitir la venta.')
      return
    }

    const paidAmount = values.payments.reduce(
      (sum, payment) => sum + (Number.isFinite(payment.monto) ? payment.monto : 0),
      0,
    )
    const outstandingAmount = Math.max(
      0,
      cartMetrics.total - Math.min(cartMetrics.total, paidAmount),
    )
    const customerId = values.clienteId ?? 'SHOWROOM'
    const isShowroom = customerId === 'SHOWROOM'
    const selectedCustomer =
      isShowroom ? null : options.customers.find((customer) => customer.id === customerId) ?? null
    const customerAllowsCredit = selectedCustomer?.permitirCredito ?? false
    const availableCreditAmount =
      selectedCustomer && customerAllowsCredit
        ? Math.max(
            0,
            Number((selectedCustomer.limiteCredito - selectedCustomer.saldoPendiente).toFixed(2)),
          )
        : 0

    if (outstandingAmount > 0 && (isShowroom || !customerAllowsCredit)) {
      toast.error(
        isShowroom
          ? 'Las ventas de mostrador deben quedar completamente pagadas.'
          : 'El cliente seleccionado no tiene crédito habilitado. La venta debe quedar completamente pagada.',
      )
      return
    }

    if (!isShowroom && customerAllowsCredit && outstandingAmount > availableCreditAmount) {
      toast.error('El saldo pendiente supera el límite de crédito disponible del cliente.')
      return
    }

    const payload: CreateSalePayload = {
      clienteId: values.clienteId && values.clienteId !== 'SHOWROOM' ? values.clienteId : undefined,
      tipoComprobante: values.tipoComprobante,
      observaciones: values.observaciones,
      items: cartItems.map((item) => {
        if (isLocalCartVentaRapida(item)) {
          return {
            tipoLinea: 'VENTA_RAPIDA',
            descripcion: item.descripcion,
            simboloUnidad: item.simboloUnidad,
            precioUnitario: item.unitPrice,
            cantidad: item.quantity,
            descuentoTotal: item.discountTotal > 0 ? item.discountTotal : undefined,
          } as const
        }
        return {
          tipoLinea: 'PRODUCTO_REGISTRADO',
          productoId: item.productId,
          presentacionId: item.presentationId ?? '',
          cantidad: item.quantity,
          descuentoTotal: item.discountTotal > 0 ? item.discountTotal : undefined,
        } as const
      }),
      payments: values.payments.map((payment) => {
        const reference = payment.referenciaExterna?.trim()
        return {
          formaPagoId: payment.formaPagoId,
          monto: payment.monto,
          referenciaExterna: reference ? reference : undefined,
          observaciones: payment.observaciones,
        }
      }),
    }

    setIsSubmitting(true)

    try {
      const response = await salesService.create(accessToken, payload)

      toast.success(
        `Venta ${response.item.code} registrada. Total ${formatCurrency(response.item.totalAmount)}.`,
      )

      setReceiptSale({ id: response.item.id, code: response.item.code })
      setIsReceiptDialogOpen(true)
      try {
        const receipt = await salesService.getReceipt(accessToken, response.item.id)
        setReceiptPayload(receipt)
      } catch (error) {
        setReceiptPayload(null)
      }
      setCartItems([])
      setIsCartPanelOpen(false)
      checkoutForm.reset(defaultCheckoutFormValues)
      await loadDashboard()
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorized(nextError.status, nextError.message, 'sales.create')
        return
      }

      toast.error(getApiErrorMessage(nextError))
    } finally {
      setIsSubmitting(false)
    }
  }

  const openReceiptDialog = useCallback((saleId: string, saleCode: string) => {
    setReceiptSale({ id: saleId, code: saleCode })
    setReceiptPayload(null)
    setIsReceiptDialogOpen(true)
  }, [])

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-foreground">Ventas</h1>
      </div>

      <Tabs defaultValue="mostrador" className="w-full">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="mostrador">Mostrador</TabsTrigger>
            <TabsTrigger value="operaciones">Operaciones</TabsTrigger>
            <TabsTrigger value="dispensacion">Dispensación</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="mostrador" className="space-y-4 pt-4">
          <Card className="p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchText}
                  onChange={(event) => setSearchText(event.currentTarget.value)}
                  placeholder="Buscar por nombre, código de barras o principio activo"
                  className="pl-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas las categorías</SelectItem>
                  {(options?.categories ?? []).map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={availabilityFilter} onValueChange={(value) => setAvailabilityFilter(value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Disponibilidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos los productos</SelectItem>
                  <SelectItem value="CON_STOCK">Con stock disponible</SelectItem>
                  <SelectItem value="SIN_STOCK">Sin stock disponible</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="default"
                onClick={() => setIsVentaRapidaDialogOpen(true)}
                className="justify-center gap-2 h-9 bg-green-600 hover:bg-green-700 text-white active:scale-95 shadow-md shadow-green-100 rounded-xl transition-all duration-200"
              >
                <Zap className="h-4 w-4 fill-white/90" />
                ⚡ Venta rápida
              </Button>
            </div>
          </Card>

          <div>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="h-7 w-7" />
              </div>
            ) : error ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            ) : availableProducts.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="text-sm font-medium text-foreground">
                  No hay productos con stock disponible
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ajusta la búsqueda o filtros
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {availableProducts.map((product) => {
                  const cartEntry = cartItems.find(
                    (item) => isLocalCartProductoRegistrado(item) && item.productId === product.id,
                  )
                  const reservedUnits = cartEntry ? getCartItemReservedUnits(cartEntry) : 0
                  const remainingUnits = product.availableUnits - reservedUnits
                  const sellablePresentationPrices =
                    product.packaging?.presentations
                      ?.filter((entry) => entry.allowsSale && entry.salePrice !== null)
                      .map((entry) => entry.salePrice ?? 0) ?? []
                  const displayPrice =
                    sellablePresentationPrices.length > 0
                      ? Math.min(...sellablePresentationPrices)
                      : product.salePrice

                  return (
                    <Card key={product.id} className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground">{product.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {product.sku}
                            {(product.commercialTypeName ?? product.medicationTypeName)
                              ? ` · ${product.commercialTypeName ?? product.medicationTypeName}`
                              : ''}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge variant="info">{formatCurrency(displayPrice)}</Badge>
                        <Badge variant={getStockVariant(product)}>
                          {product.availableUnits.toFixed(0)} {product.unitSymbol}
                        </Badge>
                        {product.requiresPrescription && <Badge variant="warning">R</Badge>}
                        {product.isControlled && <Badge variant="destructive">C</Badge>}
                        {product.coldChain && <Badge variant="info">❄️</Badge>}
                      </div>

                      {product.suggestedLot && (
                        <div className="mt-3 rounded-lg border bg-muted/20 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium text-foreground">
                              Lote: {product.suggestedLot.lotCode}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Vence: {formatDate(product.suggestedLot.expiryDate)}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="mt-3 flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="flex-1"
                          onClick={() => addToCart(product)}
                          disabled={!product.suggestedLot || remainingUnits <= 0}
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          {cartEntry ? `Agregar (${cartEntry.quantity})` : 'Agregar'}
                        </Button>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>

          {cartItems.length > 0 ? (
            <button
              type="button"
              onClick={openCartPanel}
              className={
                'fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-2xl border bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80 transition-all duration-300 ease-out ' +
                (isCartJustAdded
                  ? 'ring-2 ring-green-500 ring-offset-2 scale-105 -translate-y-0.5 shadow-xl shadow-green-200/60'
                  : '')
              }
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600 text-white shadow-md shadow-green-200/60">
                <ShoppingBasket className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">🛒 Carrito</p>
                <p className="text-xs text-muted-foreground">
                  {cartMetrics.vrCount > 0
                    ? `Productos: ${cartMetrics.prCount} · ⚡ VR: ${cartMetrics.vrCount} · Total: ${formatCurrency(cartMetrics.total)}`
                    : `Productos: ${cartMetrics.itemCount} · Total: ${formatCurrency(cartMetrics.total)}`}
                </p>
              </div>
            </button>
          ) : null}
        </TabsContent>

        <TabsContent value="operaciones" className="space-y-4 pt-4">
          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="h-7 w-7" />
              </div>
            ) : recentSales.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="text-sm font-medium text-foreground">
                  No hay ventas recientes
                </p>
              </div>
            ) : (
              recentSales.map((sale) => (
                <Card key={sale.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{sale.code}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateTime(sale.createdAt)}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openReceiptDialog(sale.id, sale.code)}>
                          <ClipboardList className="h-4 w-4 mr-2" />
                          Ver comprobante
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <History className="h-4 w-4 mr-2" />
                          Ver detalles
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 items-center">
                    <Badge variant={getSaleStatusVariant(sale.status)}>{sale.status}</Badge>
                    <p className="font-medium text-sm text-foreground">
                      {formatCurrency(sale.totalAmount)}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {sale.customerName} · {sale.itemCount} items
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {sale.paymentMethods.map((method) => (
                      <Badge key={method} variant={getPaymentVariant(method)} className="text-xs">
                        {method}
                      </Badge>
                    ))}
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="h-7 w-7" />
              </div>
            ) : recentSales.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="text-sm font-medium text-foreground">
                  No hay ventas recientes
                </p>
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Comprobante</TableHead>
                        <TableHead className="hidden lg:table-cell">Cliente</TableHead>
                        <TableHead className="hidden md:table-cell">Cajero</TableHead>
                        <TableHead className="hidden md:table-cell">Fecha</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead className="hidden lg:table-cell">Pagos</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-[80px] text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentSales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{sale.code}</p>
                              <p className="text-xs text-muted-foreground hidden sm:block">
                                {sale.itemCount} items
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground">
                            {sale.customerName}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">
                            {sale.cashierName}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">
                            {formatDateTime(sale.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">
                                {formatCurrency(sale.totalAmount)}
                              </p>
                              {sale.outstandingAmount > 0 ? (
                                <p className="text-xs text-amber-700">
                                  saldo {formatCurrency(sale.outstandingAmount)}
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {sale.paymentMethods.map((method) => (
                                <Badge key={method} variant={getPaymentVariant(method)} className="text-xs">
                                  {method}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getSaleStatusVariant(sale.status)}>{sale.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openReceiptDialog(sale.id, sale.code)}>
                                  <ClipboardList className="h-4 w-4 mr-2" />
                                  Ver comprobante
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <History className="h-4 w-4 mr-2" />
                                  Ver detalles
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="dispensacion" className="space-y-4 pt-4">
          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="h-7 w-7" />
              </div>
            ) : dispensations.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="text-sm font-medium text-foreground">
                  No hay dispensaciones registradas
                </p>
              </div>
            ) : (
              dispensations.map((record) => (
                <Card key={record.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{record.productName}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Venta: {record.saleCode}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 items-center">
                    <Badge variant="success">{record.status}</Badge>
                    {record.isControlled && <Badge variant="destructive">Controlado</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cliente: {record.customerName} · Lotes: {record.lotCodes.join(', ')}
                  </p>
                </Card>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="h-7 w-7" />
              </div>
            ) : dispensations.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="text-sm font-medium text-foreground">
                  No hay dispensaciones registradas
                </p>
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Venta</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead className="hidden lg:table-cell">Cliente</TableHead>
                        <TableHead className="hidden md:table-cell">Responsable</TableHead>
                        <TableHead className="hidden lg:table-cell">Lotes</TableHead>
                        <TableHead className="hidden md:table-cell">Fecha</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dispensations.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{record.saleCode}</p>
                              <p className="text-xs text-muted-foreground">
                                {record.requiresPrescription ? 'Con receta' : 'Controlado'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {record.productName}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground">
                            {record.customerName}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">
                            {record.cashierName}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground">
                            {record.lotCodes.join(', ')}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">
                            {formatDateTime(record.dispensedAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="success">{record.status}</Badge>
                              {record.isControlled && <Badge variant="destructive">Controlado</Badge>}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <SidePanel open={isCartPanelOpen} onOpenChange={setIsCartPanelOpen}>
        <SidePanelContent className="p-0">
          <form
            className="flex h-full flex-col"
            onSubmit={checkoutForm.handleSubmit(handleCreateSale)}
          >
            <div className="flex items-start justify-between gap-4 border-b bg-popover px-6 py-4">
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">🛒 Carrito</p>
                <p className="text-sm text-muted-foreground">
                  {cartMetrics.vrCount > 0
                    ? `Productos: ${cartMetrics.prCount} · ⚡ VR: ${cartMetrics.vrCount} · Total: ${formatCurrency(cartMetrics.total)}`
                    : `Productos: ${cartMetrics.itemCount} · Total: ${formatCurrency(cartMetrics.total)}`}
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
                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">Ítems agregados</p>
                      <p className="text-xs text-muted-foreground">
                        Ajusta cantidades, presentación y elimina ítems si es necesario.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCartItems([])}
                      disabled={cartItems.length === 0}
                    >
                      Vaciar
                    </Button>
                  </div>

                  {cartItems.length === 0 ? (
                    <div className="mt-4 rounded-lg border border-dashed p-6 text-center">
                      <p className="text-sm font-medium text-foreground">
                        Aún no hay ítems en el carrito
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Agrega productos desde el catálogo o ⚡ ventas rápidas.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {cartItems.map((item) => (
                        <div key={item.cartKey} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-medium text-foreground">
                                  {isLocalCartProductoRegistrado(item) ? item.name : item.descripcion}
                                </p>
                                {isLocalCartVentaRapida(item) ? (
                                  <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 text-[11px]">
                                    ⚡ Venta rápida
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground break-words">
                                {formatCurrency(getCartItemUnitPrice(item))} /{' '}
                                {isLocalCartProductoRegistrado(item)
                                  ? item.presentationName ?? item.unitSymbol
                                  : item.simboloUnidad}
                              </p>
                              {isLocalCartProductoRegistrado(item) && item.presentationOptions.length > 1 ? (
                                <div className="mt-2 w-full max-w-[220px]">
                                  <Select
                                    value={item.presentationId ?? ''}
                                    onValueChange={(value) => updateCartPresentation(item.cartKey, value)}
                                  >
                                    <SelectTrigger className="h-8">
                                      <SelectValue placeholder="Presentación" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {item.presentationOptions.map((option) => (
                                        <SelectItem key={option.id} value={option.id}>
                                          {option.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              ) : null}
                            </div>

                            <div className="text-right">
                              <p className="font-medium text-foreground">
                                {formatCurrency(getCartItemLineSubtotal(item))}
                              </p>
                              {isLocalCartProductoRegistrado(item) ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Lote: {item.suggestedLotCode}
                                </p>
                              ) : null}
                              {item.discountTotal > 0 ? (
                                <p className="mt-1 text-xs text-destructive">
                                  Desc: {formatCurrency(item.discountTotal)}
                                </p>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateCartQuantity(item.cartKey, item.quantity - 1)}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Input
                                type="number"
                                min={1}
                                max={Math.max(1, getCartItemMax(item))}
                                value={item.quantity}
                                onChange={(event) =>
                                  updateCartQuantity(
                                    item.cartKey,
                                    Number(event.target.value || item.quantity),
                                  )
                                }
                                className="h-8 w-16 text-center"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateCartQuantity(item.cartKey, item.quantity + 1)}
                                disabled={item.quantity >= getCartItemMax(item)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFromCart(item.cartKey)}
                              className="h-8 px-2"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">Detalle de venta</p>
                      <p className="text-xs text-muted-foreground">
                        Cliente, comprobante y observaciones.
                      </p>
                    </div>
                    {!showSaleObservaciones && !watchedSaleObservaciones ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSaleObservaciones(true)}
                        className="gap-1.5 h-8"
                      >
                        <MessageSquarePlus className="h-3.5 w-3.5" />
                        <span className="text-xs">Agregar observación</span>
                      </Button>
                    ) : null}
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Cliente</label>
                      <Controller
                        control={checkoutForm.control}
                        name="clienteId"
                        render={({ field }) => (
                          <Select value={field.value || 'SHOWROOM'} onValueChange={field.onChange}>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Venta mostrador" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="SHOWROOM">Venta mostrador</SelectItem>
                              {options.customers.map((customer) => (
                                <SelectItem key={customer.id} value={customer.id}>
                                  {customer.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Tipo de comprobante</label>
                      <Controller
                        control={checkoutForm.control}
                        name="tipoComprobante"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="TICKET">Ticket</SelectItem>
                              <SelectItem value="BOLETA">Boleta</SelectItem>
                              <SelectItem value="FACTURA">Factura</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    {showSaleObservaciones || watchedSaleObservaciones ? (
                      <div className="space-y-1.5 md:col-span-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Observaciones</label>
                          {showSaleObservaciones && !watchedSaleObservaciones ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                checkoutForm.setValue('observaciones', '', { shouldDirty: false })
                                setShowSaleObservaciones(false)
                              }}
                              className="h-7 px-2 text-xs"
                            >
                              Quitar
                            </Button>
                          ) : null}
                        </div>
                        <Textarea
                          {...checkoutForm.register('observaciones')}
                          placeholder="Notas para receta, despacho o indicaciones internas"
                          className="min-h-9 h-9 resize-none py-2 leading-5"
                        />
                        <FieldError message={checkoutForm.formState.errors.observaciones?.message} />
                      </div>
                    ) : null}
                  </div>
                </Card>

                <Card className="p-3 sm:p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">Pagos</p>
                      <p className="text-xs text-muted-foreground">
                        Registra uno o varios medios de pago para cerrar la venta.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={paymentFields.length >= 3}
                      onClick={() =>
                        appendPayment({
                          formaPagoId: options.paymentMethods[0]?.id ?? '',
                          monto: 0,
                          referenciaExterna: '',
                          observaciones: '',
                        })
                      }
                    >
                      Agregar pago
                    </Button>
                  </div>

                  <div className="mt-3 space-y-3">
                    {paymentFields.map((field, index) => {
                      const hasNoteField = expandedPaymentNotes[index] || Boolean(watchedPayments[index]?.observaciones)
                      return (
                        <div
                          key={field.id}
                          className="grid gap-3 rounded-2xl border p-3 sm:p-4 md:grid-cols-2 lg:grid-cols-[1.25fr_0.9fr_1fr_auto]"
                        >
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium">
                              Medio de pago
                              <span className="ml-1 text-rose-600">*</span>
                            </label>
                            <FormPaymentMethodTwoLevelSelect
                              control={checkoutForm.control}
                              name={`payments.${index}.formaPagoId`}
                              methods={options.paymentMethods}
                              hideInternalLabel
                              placeholderCategory="Seleccionar"
                              placeholderSubmethod="Selecciona tipo"
                              id={`sale-payment-${index}`}
                              required
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-sm font-medium">Monto</label>
                            <Input
                              type="number"
                              step="0.01"
                              className="h-9"
                              {...checkoutForm.register(`payments.${index}.monto`, {
                                valueAsNumber: true,
                              })}
                            />
                            <FieldError
                              message={checkoutForm.formState.errors.payments?.[index]?.monto?.message}
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-sm font-medium">
                              Referencia
                              <span className="ml-1 text-xs font-normal text-muted-foreground">
                                (opcional)
                              </span>
                            </label>
                            <Input
                              {...checkoutForm.register(`payments.${index}.referenciaExterna`)}
                              placeholder="Código de operación, voucher, N° externo..."
                              className="h-9"
                            />
                            <FieldError
                              message={
                                checkoutForm.formState.errors.payments?.[index]?.referenciaExterna
                                  ?.message
                              }
                            />
                          </div>

                          <div className="flex items-end justify-end pb-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removePayment(index)}
                              disabled={paymentFields.length === 1}
                              className="h-9 w-9"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="space-y-1.5 md:col-span-2 lg:col-span-4">
                            {!hasNoteField ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setExpandedPaymentNotes((prev) => ({ ...prev, [index]: true }))
                                }
                                className="h-8 px-2 gap-1.5"
                              >
                                <MessageSquarePlus className="h-3.5 w-3.5" />
                                <span className="text-xs">Agregar nota al pago</span>
                              </Button>
                            ) : (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <label className="text-sm font-medium">Observaciones del pago</label>
                                  {expandedPaymentNotes[index] &&
                                  !watchedPayments[index]?.observaciones ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        checkoutForm.setValue(
                                          `payments.${index}.observaciones`,
                                          '',
                                          { shouldDirty: false },
                                        )
                                        setExpandedPaymentNotes((prev) => {
                                          const n = { ...prev }
                                          delete n[index]
                                          return n
                                        })
                                      }}
                                      className="h-7 px-2 text-xs"
                                    >
                                      Quitar
                                    </Button>
                                  ) : null}
                                </div>
                                <Textarea
                                  {...checkoutForm.register(`payments.${index}.observaciones`)}
                                  placeholder="Notas del cobro o conciliación"
                                  className="min-h-9 h-9 resize-none py-2 leading-5"
                                />
                                <FieldError
                                  message={
                                    checkoutForm.formState.errors.payments?.[index]?.observaciones
                                      ?.message
                                  }
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>

                <Card className="p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground">Totales</p>
                    <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <span>Usa pagos combinados</span>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:gap-x-6">
                    <div className="flex items-baseline justify-between gap-3 py-0.5">
                      <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                        Total venta
                      </p>
                      <p className="text-[15px] font-semibold text-foreground tabular-nums">
                        {formatCurrency(cartMetrics.total)}
                      </p>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 py-0.5">
                      <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                        Pagos registrados
                      </p>
                      <p className="text-[15px] font-semibold text-foreground tabular-nums">
                        {formatCurrency(watchedPaymentTotal)}
                      </p>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 py-0.5">
                      <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                        Vuelto estimado
                      </p>
                      <p className="text-[15px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatCurrency(estimatedChange)}
                      </p>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 py-0.5">
                      <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                        Saldo estimado
                      </p>
                      <p
                        className={`text-[15px] font-semibold tabular-nums ${
                          estimatedOutstanding > 0
                            ? 'text-destructive'
                            : 'text-foreground'
                        }`}
                      >
                        {formatCurrency(estimatedOutstanding)}
                      </p>
                    </div>
                  </div>
                  {paymentBlockingMessage ? (
                    <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      {paymentBlockingMessage}
                    </div>
                  ) : null}
                </Card>
              </div>
            </div>

            <div className="border-t bg-popover px-4 py-3 sm:px-6 sm:py-4">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => setIsCartPanelOpen(false)}
                >
                  Seguir vendiendo
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !cartItems.length || Boolean(paymentBlockingMessage)}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      Emitir venta
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </SidePanelContent>
      </SidePanel>

      <Dialog
        open={isVentaRapidaDialogOpen}
        onOpenChange={(nextOpen) => {
          setIsVentaRapidaDialogOpen(nextOpen)
          if (!nextOpen) {
            ventaRapidaForm.reset({
              descripcion: '',
              simboloUnidad: VENTA_RAPIDA_DEFAULT_SIMBOLO,
              precioUnitario: 0,
              cantidad: 1,
              descuentoTotal: 0,
            })
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Agregar ⚡ Venta rápida</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Ítem ocasional sin catálogo (servicios, delivery, envoltura, etc.). No genera
              movimiento de inventario ni lotes.
            </p>
          </DialogHeader>
          <form
            onSubmit={ventaRapidaForm.handleSubmit(handleAddVentaRapida)}
            className="grid gap-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="venta-rapida-descripcion">
                Descripción <span className="text-rose-600">*</span>
              </Label>
              <Input
                id="venta-rapida-descripcion"
                autoComplete="off"
                placeholder="Ej. Servicio delivery, Envoltura para regalo..."
                {...ventaRapidaForm.register('descripcion')}
              />
              <FieldError message={ventaRapidaForm.formState.errors.descripcion?.message} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="venta-rapida-unidad">
                  Unidad de medida <span className="text-rose-600">*</span>
                </Label>
                <Controller
                  control={ventaRapidaForm.control}
                  name="simboloUnidad"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="venta-rapida-unidad" className="h-9">
                        <SelectValue placeholder="Seleccionar unidad" />
                      </SelectTrigger>
                      <SelectContent>
                        {VENTA_RAPIDA_UNIDADES_MEDIDA.map((u) => (
                          <SelectItem key={u.codigo} value={u.simbolo}>
                            {u.nombre} ({u.simbolo})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={ventaRapidaForm.formState.errors.simboloUnidad?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="venta-rapida-precio">
                  Precio unitario <span className="text-rose-600">*</span>
                </Label>
                <Input
                  id="venta-rapida-precio"
                  type="number"
                  step="0.01"
                  min={0}
                  className="h-9"
                  {...ventaRapidaForm.register('precioUnitario', { valueAsNumber: true })}
                  onBlur={(event) => {
                    const raw = Number(event.currentTarget.value)
                    if (Number.isFinite(raw)) {
                      ventaRapidaForm.setValue(
                        'precioUnitario',
                        Number(raw.toFixed(2)),
                        { shouldDirty: false },
                      )
                    }
                  }}
                />
                <FieldError message={ventaRapidaForm.formState.errors.precioUnitario?.message} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="venta-rapida-cantidad">
                  Cantidad <span className="text-rose-600">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => {
                      const current = Number(ventaRapidaForm.getValues('cantidad') ?? 1)
                      ventaRapidaForm.setValue(
                        'cantidad',
                        Math.max(1, Math.floor(current) - 1),
                        { shouldDirty: true, shouldTouch: true },
                      )
                    }}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    id="venta-rapida-cantidad"
                    type="number"
                    min={1}
                    step={1}
                    className="h-9 text-center"
                    {...ventaRapidaForm.register('cantidad', { valueAsNumber: true })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => {
                      const current = Number(ventaRapidaForm.getValues('cantidad') ?? 1)
                      ventaRapidaForm.setValue(
                        'cantidad',
                        Math.max(1, Math.floor(current) + 1),
                        { shouldDirty: true, shouldTouch: true },
                      )
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <FieldError message={ventaRapidaForm.formState.errors.cantidad?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="venta-rapida-descuento">Descuento total (opcional)</Label>
                <Input
                  id="venta-rapida-descuento"
                  type="number"
                  step="0.01"
                  min={0}
                  className="h-9"
                  {...ventaRapidaForm.register('descuentoTotal', { valueAsNumber: true })}
                />
                <FieldError message={ventaRapidaForm.formState.errors.descuentoTotal?.message} />
              </div>
            </div>

            <DialogFooter className="sm:justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsVentaRapidaDialogOpen(false)}
                className="h-9"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={ventaRapidaForm.formState.isSubmitting}
                className={
                  'h-9 gap-2 bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-100 transition-all duration-150 ' +
                  (isVentaRapidaSubmittingAnim ? 'scale-95' : 'active:scale-[0.97]')
                }
              >
                {ventaRapidaForm.formState.isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Agregando...
                  </>
                ) : (
                  <>
                    <ShoppingBasket className="h-4 w-4" />
                    🛒 Agregar al carrito
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ReceiptDialog
        open={isReceiptDialogOpen}
        onOpenChange={(nextOpen) => {
          setIsReceiptDialogOpen(nextOpen)
          if (!nextOpen) {
            setReceiptSale(null)
            setReceiptPayload(null)
          }
        }}
        accessToken={accessToken}
        sale={receiptSale}
        initialReceipt={receiptPayload}
        onUnauthorized={handleUnauthorized}
      />
    </div>
  )
}
