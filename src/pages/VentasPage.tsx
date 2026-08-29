import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
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

type LocalCartPresentationOption = {
  id: string
  name: string
  salePrice: number
  factorToBase: number
}

type LocalCartItem = {
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
  availableUnits: number
  requiresPrescription: boolean
  isControlled: boolean
  coldChain: boolean
  suggestedLotCode: string
  suggestedLotExpiryDate: string | null
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

  return Math.min(Math.max(1, value), Math.max(1, Math.floor(max)))
}

function getCartItemMax(item: LocalCartItem) {
  const factor = item.presentationFactorToBase ?? null
  if (!factor || !Number.isFinite(factor) || factor <= 0) {
    return Math.max(0, Math.floor(item.availableUnits))
  }
  return Math.max(0, Math.floor(item.availableUnits / factor))
}

function getCartItemUnitPrice(item: LocalCartItem) {
  if (typeof item.presentationPrice === 'number') {
    return item.presentationPrice
  }
  return 0
}

function getCartItemReservedUnits(item: LocalCartItem) {
  const factor = item.presentationFactorToBase ?? null
  if (!factor || !Number.isFinite(factor) || factor <= 0) {
    return item.quantity
  }
  return item.quantity * factor
}

function getStockVariant(product: any) {
  if (product.availableUnits === 0) return 'destructive'
  if (product.availableUnits <= 20) return 'warning'
  return 'success'
}

export function VentasPage() {
  const { session } = useAuth()
  const accessToken = session?.accessToken ?? ''

  const [dashboard, setDashboard] = useState<SalesDashboardResponse | null>(null)
  const searchTextRef = useRef('')
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [searchKeySuffix, setSearchKeySuffix] = useState(0)
  const [searchDebounced, setSearchDebounced] = useState('')
  const triggerSearchRef = useRef<() => void>(() => {})
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

  const handleUnauthorized = useHandleUnauthorized('VentasPage')

  useEffect(() => {
    let handle: number | null = null
    const run = () => setSearchDebounced(searchTextRef.current)
    triggerSearchRef.current = () => {
      if (handle) window.clearTimeout(handle)
      handle = window.setTimeout(run, 220)
    }
    return () => {
      if (handle) window.clearTimeout(handle)
    }
  }, [])

  useEffect(() => {
    setSearchKeySuffix((x) => x + 1)
  }, [accessToken])

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
    const subtotal = cartItems.reduce(
      (sum, item) => sum + item.quantity * getCartItemUnitPrice(item),
      0,
    )

    return {
      itemCount: cartItems.length,
      totalUnits: cartItems.reduce((sum, item) => sum + getCartItemReservedUnits(item), 0),
      subtotal,
      total: subtotal,
      prescriptionItems: cartItems.filter((item) => item.requiresPrescription).length,
      controlledItems: cartItems.filter((item) => item.isControlled).length,
    }
  }, [cartItems])

  useEffect(() => {
    if (cartItems.length === 0) {
      setIsCartPanelOpen(false)
    }
  }, [cartItems.length])

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
    current: LocalCartItem,
    nextProduct?: SalesDashboardResponse['products'][number],
  ) {
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
        .filter((item) => item.availableUnits > 0),
    )
  }, [availableProducts])

  function addToCart(product: SalesDashboardResponse['products'][number]) {
    if (!product.suggestedLot || product.availableUnits <= 0) {
      toast.error('El producto no tiene stock disponible para venta inmediata.')
      return
    }

    const suggestedLot = product.suggestedLot

    setCartItems((current) => {
      const existing = current.find((item) => item.productId === product.id)

      if (existing) {
        const synced = syncCartWithProduct(existing, product)
        if (existing.quantity >= getCartItemMax(synced)) {
          toast.error('Ya alcanzaste el stock disponible para este producto.')
          return current
        }

        return current.map((item) =>
          item.productId === product.id
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

  function updateCartQuantity(productId: string, nextQuantity: number) {
    setCartItems((current) =>
      current.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity: clampQuantity(nextQuantity, getCartItemMax(item)),
            }
          : item,
      ),
    )
  }

  function updateCartPresentation(productId: string, presentationId: string) {
    setCartItems((current) =>
      current.map((item) => {
        if (item.productId !== productId) return item
        if (!item.presentationOptions.length) return item

        const selected = item.presentationOptions.find((option) => option.id === presentationId) ?? null
        if (!selected) return item

        const next = {
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

  function removeFromCart(productId: string) {
    setCartItems((current) => current.filter((item) => item.productId !== productId))
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
      items: cartItems.map((item) => ({
        productoId: item.productId,
        cantidad: item.quantity,
        presentacionId: item.presentationId ?? '',
      })),
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
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  key={`ventas-search-${searchKeySuffix}`}
                  defaultValue=""
                  onInput={(event) => {
                    searchTextRef.current = event.currentTarget.value
                    triggerSearchRef.current()
                  }}
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
                  const cartEntry = cartItems.find((item) => item.productId === product.id)
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
              className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-2xl border bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <ShoppingBasket className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">Carrito</p>
                <p className="text-xs text-muted-foreground">
                  Productos: {cartMetrics.itemCount} · Total: {formatCurrency(cartMetrics.total)}
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
                <p className="text-base font-semibold text-foreground">Carrito</p>
                <p className="text-sm text-muted-foreground">
                  Productos: {cartMetrics.itemCount} · Total: {formatCurrency(cartMetrics.total)}
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
                      <p className="font-medium text-foreground">Productos agregados</p>
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
                        Aún no hay productos en el carrito
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Agrega productos desde el catálogo
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {cartItems.map((item) => (
                        <div key={item.productId} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-foreground">{item.name}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatCurrency(getCartItemUnitPrice(item))} /{' '}
                                {item.presentationName ?? item.unitSymbol}
                              </p>
                              {item.presentationOptions.length > 1 ? (
                                <div className="mt-2 w-full max-w-[220px]">
                                  <Select
                                    value={item.presentationId ?? ''}
                                    onValueChange={(value) => updateCartPresentation(item.productId, value)}
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
                                {formatCurrency(item.quantity * getCartItemUnitPrice(item))}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Lote: {item.suggestedLotCode}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateCartQuantity(item.productId, item.quantity - 1)}
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
                                    item.productId,
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
                                onClick={() => updateCartQuantity(item.productId, item.quantity + 1)}
                                disabled={item.quantity >= getCartItemMax(item)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFromCart(item.productId)}
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

                <Card className="p-4">
                  <p className="font-medium text-foreground">Detalle de venta</p>
                  <p className="text-xs text-muted-foreground">
                    Cliente, comprobante y observaciones.
                  </p>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Cliente</label>
                      <Controller
                        control={checkoutForm.control}
                        name="clienteId"
                        render={({ field }) => (
                          <Select value={field.value || 'SHOWROOM'} onValueChange={field.onChange}>
                            <SelectTrigger>
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

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tipo de comprobante</label>
                      <Controller
                        control={checkoutForm.control}
                        name="tipoComprobante"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
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

                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium">Observaciones</label>
                      <Textarea
                        {...checkoutForm.register('observaciones')}
                        placeholder="Notas para receta, despacho o indicaciones internas"
                        className="min-h-24"
                      />
                      <FieldError message={checkoutForm.formState.errors.observaciones?.message} />
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
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

                  <div className="mt-4 space-y-6">
                    {paymentFields.map((field, index) => {
                      return (
                        <div
                          key={field.id}
                          className="grid gap-4 rounded-2xl border p-4 md:grid-cols-2 xl:grid-cols-[1.4fr_0.8fr_1fr_auto]"
                        >
                          <FormPaymentMethodTwoLevelSelect
                            control={checkoutForm.control}
                            name={`payments.${index}.formaPagoId`}
                            methods={options.paymentMethods}
                            label="Medio de pago"
                            placeholderCategory="Selecciona medio de pago"
                            placeholderSubmethod="Selecciona tipo"
                            id={`sale-payment-${index}`}
                            required
                          />

                          <div className="space-y-2">
                            <label className="text-sm font-medium">Monto</label>
                            <Input
                              type="number"
                              step="0.01"
                              {...checkoutForm.register(`payments.${index}.monto`, {
                                valueAsNumber: true,
                              })}
                            />
                            <FieldError
                              message={checkoutForm.formState.errors.payments?.[index]?.monto?.message}
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">
                              Referencia
                              <span className="ml-1 text-xs font-normal text-muted-foreground">
                                (opcional)
                              </span>
                            </label>
                            <Input
                              {...checkoutForm.register(`payments.${index}.referenciaExterna`)}
                              placeholder="Código de operación, voucher, N° externo..."
                            />
                            <FieldError
                              message={
                                checkoutForm.formState.errors.payments?.[index]?.referenciaExterna
                                  ?.message
                              }
                            />
                          </div>

                          <div className="flex items-end justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removePayment(index)}
                              disabled={paymentFields.length === 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="space-y-2 md:col-span-2 xl:col-span-4">
                            <label className="text-sm font-medium">Observaciones del pago</label>
                            <Textarea
                              {...checkoutForm.register(`payments.${index}.observaciones`)}
                              placeholder="Notas del cobro o conciliación"
                              className="min-h-20"
                            />
                            <FieldError
                              message={
                                checkoutForm.formState.errors.payments?.[index]?.observaciones?.message
                              }
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>

                <Card className="p-4">
                  <p className="font-medium text-foreground">Totales</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                        Total venta
                      </p>
                      <p className="mt-2 text-base font-semibold text-foreground">
                        {formatCurrency(cartMetrics.total)}
                      </p>
                    </div>
                    <div>
                      <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                        Pagos registrados
                      </p>
                      <p className="mt-2 text-base font-semibold text-foreground">
                        {formatCurrency(watchedPaymentTotal)}
                      </p>
                    </div>
                    <div>
                      <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                        Vuelto estimado
                      </p>
                      <p className="mt-2 text-base font-semibold text-foreground">
                        {formatCurrency(estimatedChange)}
                      </p>
                    </div>
                    <div>
                      <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                        Saldo estimado
                      </p>
                      <p className="mt-2 text-base font-semibold text-foreground">
                        {formatCurrency(estimatedOutstanding)}
                      </p>
                    </div>
                  </div>
                  {paymentBlockingMessage ? (
                    <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      {paymentBlockingMessage}
                    </div>
                  ) : null}
                </Card>
              </div>
            </div>

            <div className="border-t bg-popover px-6 py-4">
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
