import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  ClipboardCheck,
  FileSpreadsheet,
  Loader2,
  PackageCheck,
  Plus,
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

  const form = useForm<CreatePurchaseFormValues>({
    resolver: zodResolver(createPurchaseSchema),
    defaultValues: defaultFormValues,
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  const watchedItems = form.watch('items')

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

  const purchaseMetrics = dashboard?.summary ?? {
    totalOrders: 0,
    activeOrders: 0,
    scheduledReceipts: 0,
    observedReceipts: 0,
    activeSpend: 0,
    supplierCount: 0,
  }

  const orders = dashboard?.orders ?? []
  const receipts = dashboard?.receipts ?? []
  const suppliers = dashboard?.supplierSummary ?? []
  const options = dashboard?.options ?? {
    branches: [],
    suppliers: [],
    products: [],
  }

  const canCreateOrders =
    options.branches.length > 0 &&
    options.suppliers.length > 0 &&
    options.products.length > 0

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
        <TabsList className="grid w-full grid-cols-3 lg:w-fit">
          <TabsTrigger value="ordenes">Ordenes</TabsTrigger>
          <TabsTrigger value="recepciones">Recepciones</TabsTrigger>
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
                            <p className="text-small text-muted-foreground">
                              saldo {formatCurrency(order.pendingAmount)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getOrderStatusVariant(order.status)}>
                            {order.status}
                          </Badge>
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
                            </div>
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
    </div>
  )
}
