import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  CreditCard,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingBasket,
  Trash2,
  ChevronDown,
  MoreVertical,
  History,
  ClipboardList,
  Pill,
  CircleDollarSign,
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ReceiptDialog } from '@/components/sales/ReceiptDialog'
import { useAuth } from '@/hooks/useAuth'
import { ApiError, ApiNetworkError } from '@/services/apiClient'
import { salesService } from '@/services/salesService'
import type { CreateSalePayload, SaleReceiptResponse, SalesDashboardResponse } from '@/types/sales'
import { toast } from 'sonner'

const saleCheckoutSchema = z.object({
  sucursalId: z.string().uuid({ message: 'Selecciona una sucursal.' }),
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

type LocalCartItem = {
  productId: string
  name: string
  sku: string
  unitSymbol: string
  salePrice: number
  quantity: number
  availableUnits: number
  requiresPrescription: boolean
  isControlled: boolean
  coldChain: boolean
  suggestedLotCode: string
  suggestedLotExpiryDate: string | null
}

const defaultCheckoutFormValues: SaleCheckoutFormValues = {
  sucursalId: '',
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
  if (method === 'EFECTIVO') return 'success'
  if (method === 'TARJETA') return 'info'
  if (method === 'YAPE' || method === 'PLIN') return 'warning'
  return 'outline'
}

function clampQuantity(value: number, max: number) {
  if (!Number.isFinite(value)) {
    return 1
  }

  return Math.min(Math.max(1, value), Math.max(1, Math.floor(max)))
}

function getStockVariant(product: any) {
  if (product.availableUnits === 0) return 'destructive'
  if (product.availableUnits <= 20) return 'warning'
  return 'success'
}

export function VentasPage() {
  const { logout, session } = useAuth()
  const accessToken = session?.accessToken ?? ''

  const [dashboard, setDashboard] = useState<SalesDashboardResponse | null>(null)
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState<string>('TODAS')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [cartItems, setCartItems] = useState<LocalCartItem[]>([])
  const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = useState(false)
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false)
  const [receiptSale, setReceiptSale] = useState<{ id: string; code: string } | null>(null)
  const [receiptPayload, setReceiptPayload] = useState<SaleReceiptResponse | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleUnauthorized = useCallback(async () => {
    await logout()
  }, [logout])

  const checkoutForm = useForm<SaleCheckoutFormValues>({
    resolver: zodResolver(saleCheckoutSchema),
    defaultValues: defaultCheckoutFormValues,
  })

  const {
    fields: paymentFields,
    append: appendPayment,
    remove: removePayment,
    replace: replacePayments,
  } = useFieldArray({
    control: checkoutForm.control,
    name: 'payments',
  })

  const watchedPayments = checkoutForm.watch('payments')

  const loadDashboard = useCallback(async () => {
    if (!accessToken) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await salesService.getDashboard(accessToken, {
        search,
        branchId: branchFilter === 'TODAS' ? undefined : branchFilter,
      })

      setDashboard(response)
    } catch (nextError) {
      setError(getApiErrorMessage(nextError))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, branchFilter, search])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const options = {
    branches: dashboard?.options?.branches ?? [],
    customers: dashboard?.options?.customers ?? [],
    paymentMethods: dashboard?.options?.paymentMethods ?? [],
  }

  const availableProducts = dashboard?.products ?? []
  const recentSales = dashboard?.recentSales ?? []
  const dispensations = dashboard?.dispensations ?? []

  const cartMetrics = useMemo(() => {
    const subtotal = cartItems.reduce((sum, item) => sum + item.quantity * item.salePrice, 0)

    return {
      itemCount: cartItems.length,
      totalUnits: cartItems.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      total: subtotal,
      prescriptionItems: cartItems.filter((item) => item.requiresPrescription).length,
      controlledItems: cartItems.filter((item) => item.isControlled).length,
    }
  }, [cartItems])

  const watchedPaymentTotal = useMemo(
    () =>
      watchedPayments.reduce(
        (sum, payment) => sum + (Number.isFinite(payment.monto) ? payment.monto : 0),
        0,
      ),
    [watchedPayments],
  )

  const selectedPaymentMethods = useMemo(
    () =>
      watchedPayments.map((payment) =>
        options.paymentMethods.find((method) => method.id === payment.formaPagoId),
      ),
    [options.paymentMethods, watchedPayments],
  )

  const estimatedChange =
    watchedPayments.length === 1 && selectedPaymentMethods[0]?.allowsChange
      ? Math.max(0, watchedPaymentTotal - cartMetrics.total)
      : 0

  const estimatedOutstanding = Math.max(
    0,
    cartMetrics.total - Math.min(cartMetrics.total, watchedPaymentTotal),
  )

  function syncCartWithProduct(current: LocalCartItem, nextProduct?: SalesDashboardResponse['products'][number]) {
    if (!nextProduct) {
      return current
    }

    return {
      ...current,
      name: nextProduct.name,
      sku: nextProduct.sku,
      unitSymbol: nextProduct.unitSymbol,
      salePrice: nextProduct.salePrice,
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

          return {
            ...syncCartWithProduct(item, product),
            quantity: clampQuantity(item.quantity, product.availableUnits),
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
        if (existing.quantity >= Math.floor(product.availableUnits)) {
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

      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unitSymbol: product.unitSymbol,
          salePrice: product.salePrice,
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
              quantity: clampQuantity(nextQuantity, item.availableUnits),
            }
          : item,
      ),
    )
  }

  function removeFromCart(productId: string) {
    setCartItems((current) => current.filter((item) => item.productId !== productId))
  }

  function openCheckoutDialog() {
    if (!cartItems.length) {
      toast.error('Agrega productos al carrito antes de continuar.')
      return
    }

    const defaultBranchId =
      branchFilter !== 'TODAS' ? branchFilter : (options.branches[0]?.id ?? '')
    const defaultPaymentMethodId = options.paymentMethods[0]?.id ?? ''

    checkoutForm.reset({
      sucursalId: defaultBranchId,
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

    setIsCheckoutDialogOpen(true)
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

    const payload: CreateSalePayload = {
      sucursalId: values.sucursalId,
      clienteId: values.clienteId && values.clienteId !== 'SHOWROOM' ? values.clienteId : undefined,
      tipoComprobante: values.tipoComprobante,
      observaciones: values.observaciones,
      items: cartItems.map((item) => ({
        productoId: item.productId,
        cantidad: item.quantity,
      })),
      payments: values.payments.map((payment) => ({
        formaPagoId: payment.formaPagoId,
        monto: payment.monto,
        referenciaExterna: payment.referenciaExterna,
        observaciones: payment.observaciones,
      })),
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
      setIsCheckoutDialogOpen(false)
      checkoutForm.reset(defaultCheckoutFormValues)
      await loadDashboard()
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        toast.error(
          'Tu sesión venció o cambió con el despliegue. Ingresa nuevamente para registrar ventas.',
        )
        await logout()
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

  const [showSummary, setShowSummary] = useState(true)

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-foreground">Ventas</h1>
        <Button variant="ghost" size="sm" onClick={() => setShowSummary(!showSummary)}>
          Resumen
          <ChevronDown
            className={`ml-1 h-4 w-4 transition-transform ${showSummary ? 'rotate-180' : ''}`}
          />
        </Button>
      </div>

      {showSummary && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <ShoppingBasket className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{cartMetrics.itemCount}</span>
              <span className="text-xs text-muted-foreground">Items</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <CreditCard className="h-4 w-4 text-primary" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">
                {formatCurrency(cartMetrics.total)}
              </span>
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <Pill className="h-4 w-4 text-warning" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">
                {dashboard?.summary?.prescriptionItemsCount ?? 0}
              </span>
              <span className="text-xs text-muted-foreground">Con receta</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <CircleDollarSign className="h-4 w-4 text-info" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">
                {formatCurrency(dashboard?.summary?.totalOutstandingAmount ?? 0)}
              </span>
              <span className="text-xs text-muted-foreground">Pendiente</span>
            </div>
          </div>
        </div>
      )}

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
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nombre o SKU"
                  className="pl-9"
                />
              </div>
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Sucursal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas</SelectItem>
                  {options.branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_340px]">
            <div className="lg:col-span-1 xl:col-span-2">
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
                <div className="grid gap-4 md:grid-cols-2">
                  {availableProducts.map((product) => {
                    const cartEntry = cartItems.find((item) => item.productId === product.id)
                    const remainingUnits = product.availableUnits - (cartEntry?.quantity ?? 0)

                    return (
                      <Card key={product.id} className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-foreground">{product.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{product.sku}</p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge variant="info">{formatCurrency(product.salePrice)}</Badge>
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

            <div className="lg:col-span-1 xl:col-span-1">
              <Card className="p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-hidden">
                <h3 className="mb-3 font-medium text-foreground">Carrito</h3>

                {cartItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <p className="text-sm font-medium text-foreground">
                      Aún no hay productos en el carrito
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Agrega productos desde las tarjetas del mostrador
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 lg:h-[calc(100vh-7rem)]">
                    <div className="space-y-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
                      {cartItems.map((item) => (
                        <div key={item.productId} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-foreground">{item.name}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatCurrency(item.salePrice)} / {item.unitSymbol}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-foreground">
                                {formatCurrency(item.quantity * item.salePrice)}
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
                                onClick={() =>
                                  updateCartQuantity(item.productId, item.quantity - 1)
                                }
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Input
                                type="number"
                                min={1}
                                max={Math.max(1, Math.floor(item.availableUnits))}
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
                                onClick={() =>
                                  updateCartQuantity(item.productId, item.quantity + 1)
                                }
                                disabled={item.quantity >= Math.floor(item.availableUnits)}
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

                    <div className="rounded-lg border bg-background p-3 shadow-sm ring-1 ring-border/60 lg:mt-auto">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Total</span>
                        <span className="text-lg font-semibold text-foreground">
                          {formatCurrency(cartMetrics.total)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setCartItems([])}
                          className="flex-1"
                        >
                          Vaciar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={openCheckoutDialog}
                          className="flex-1"
                        >
                          <CreditCard className="mr-1 h-4 w-4" />
                          Cobrar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
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

      <Dialog
        open={isCheckoutDialogOpen}
        onOpenChange={(open) => {
          setIsCheckoutDialogOpen(open)

          if (!open) {
            checkoutForm.reset(defaultCheckoutFormValues)
            replacePayments(defaultCheckoutFormValues.payments)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Registrar venta</DialogTitle>
            <DialogDescription>
              Confirma los datos del mostrador y emite la venta con dispensación por lotes.
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-6" onSubmit={checkoutForm.handleSubmit(handleCreateSale)}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Sucursal</label>
                <Controller
                  control={checkoutForm.control}
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
                <FieldError message={checkoutForm.formState.errors.sucursalId?.message} />
              </div>

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

              <div className="space-y-2">
                <label className="text-sm font-medium">Observaciones</label>
                <Textarea
                  {...checkoutForm.register('observaciones')}
                  placeholder="Notas para receta, despacho o indicaciones internas"
                  className="min-h-24"
                />
                <FieldError message={checkoutForm.formState.errors.observaciones?.message} />
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-foreground">Pagos</p>
                  <p className="text-small text-muted-foreground">
                    Registra uno o varios medios de pago para cerrar la venta.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
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

              <div className="space-y-4">
                {paymentFields.map((field, index) => {
                  const selectedMethod = selectedPaymentMethods[index]

                  return (
                    <div
                      key={field.id}
                      className="grid gap-4 rounded-2xl border p-4 md:grid-cols-2 xl:grid-cols-[1.2fr_0.8fr_1fr_auto]"
                    >
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Forma de pago</label>
                        <Controller
                          control={checkoutForm.control}
                          name={`payments.${index}.formaPagoId`}
                          render={({ field: inputField }) => (
                            <Select
                              value={inputField.value || undefined}
                              onValueChange={inputField.onChange}
                            >
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
                        <FieldError
                          message={checkoutForm.formState.errors.payments?.[index]?.formaPagoId?.message}
                        />
                      </div>

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
                        <label className="text-sm font-medium">Referencia</label>
                        <Input
                          {...checkoutForm.register(`payments.${index}.referenciaExterna`)}
                          placeholder={
                            selectedMethod?.requiresReference
                              ? 'Voucher, operación o nro. externo'
                              : 'Opcional'
                          }
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
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-2xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Lote sugerido</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cartItems.map((item) => (
                      <TableRow key={item.productId}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{item.name}</p>
                            <p className="text-small text-muted-foreground">
                              {item.sku} · {formatCurrency(item.salePrice)} · {item.unitSymbol}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <div className="space-y-1">
                            <p>{item.suggestedLotCode}</p>
                            <p className="text-small">{formatDate(item.suggestedLotExpiryDate)}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.quantity.toFixed(0)}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {formatCurrency(item.quantity * item.salePrice)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-4 rounded-2xl border bg-muted/20 p-4 md:grid-cols-2 xl:grid-cols-1">
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
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => {
                  setIsCheckoutDialogOpen(false)
                  checkoutForm.reset(defaultCheckoutFormValues)
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || !cartItems.length}>
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
