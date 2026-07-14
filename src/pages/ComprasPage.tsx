import { useMemo, useState } from 'react'
import {
  ClipboardCheck,
  FileSpreadsheet,
  PackageCheck,
  Search,
  ShoppingCart,
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
import { Input } from '@/components/ui/input'
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
import {
  purchaseOrders,
  purchaseReceipts,
  supplierSummary,
  type PurchaseOrderStatus,
  type PurchaseReceiptStatus,
} from '@/modules/purchases/mock-data'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(value)
}

function getOrderStatusVariant(status: PurchaseOrderStatus) {
  if (status === 'CERRADA') return 'success'
  if (status === 'EMITIDA' || status === 'RECIBIDA_PARCIAL') return 'info'
  if (status === 'BORRADOR') return 'warning'
  return 'destructive'
}

function getReceiptStatusVariant(status: PurchaseReceiptStatus) {
  if (status === 'RECIBIDA') return 'success'
  if (status === 'PROGRAMADA') return 'info'
  return 'warning'
}

export function ComprasPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'TODAS' | PurchaseOrderStatus>('TODAS')
  const [branchFilter, setBranchFilter] = useState('TODAS')

  const filteredOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return purchaseOrders.filter((order) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        order.code.toLowerCase().includes(normalizedSearch) ||
        order.supplierName.toLowerCase().includes(normalizedSearch) ||
        order.buyerName.toLowerCase().includes(normalizedSearch)

      const matchesStatus = statusFilter === 'TODAS' || order.status === statusFilter
      const matchesBranch = branchFilter === 'TODAS' || order.branchName === branchFilter

      return matchesSearch && matchesStatus && matchesBranch
    })
  }, [branchFilter, search, statusFilter])

  const purchaseMetrics = useMemo(() => {
    const activeOrders = purchaseOrders.filter(
      (order) => order.status === 'EMITIDA' || order.status === 'RECIBIDA_PARCIAL',
    ).length
    const scheduledReceipts = purchaseReceipts.filter(
      (receipt) => receipt.status === 'PROGRAMADA',
    ).length
    const observedReceipts = purchaseReceipts.filter(
      (receipt) => receipt.status === 'OBSERVADA',
    ).length
    const activeSpend = purchaseOrders
      .filter((order) => order.status !== 'ANULADA')
      .reduce((sum, order) => sum + order.totalAmount, 0)

    return { activeOrders, scheduledReceipts, observedReceipts, activeSpend }
  }, [])

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
                <Button type="button" variant="outline" size="sm">
                  <FileSpreadsheet className="h-4 w-4" />
                  Exportar
                </Button>
                <Button type="button" size="sm">
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
                    <SelectItem value="EMITIDA">Emitida</SelectItem>
                    <SelectItem value="RECIBIDA_PARCIAL">Recibida parcial</SelectItem>
                    <SelectItem value="CERRADA">Cerrada</SelectItem>
                    <SelectItem value="ANULADA">Anulada</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAS">Todas las sucursales</SelectItem>
                    <SelectItem value="Sucursal Principal">Sucursal Principal</SelectItem>
                    <SelectItem value="Sucursal Centro">Sucursal Centro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Orden</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Sucursal</TableHead>
                    <TableHead>Creacion</TableHead>
                    <TableHead>Entrega esperada</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{order.code}</p>
                          <p className="text-small text-muted-foreground">
                            {order.itemCount} items · {order.buyerName}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {order.supplierName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {order.branchName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {order.createdAt}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {order.expectedAt}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {formatCurrency(order.totalAmount)}
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
                    {purchaseReceipts.map((receipt) => (
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
                              {receipt.receivedUnits} und
                            </p>
                            <p className="text-small text-muted-foreground">
                              {receipt.receivedAt}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {receipt.expiryDate}
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Pais</TableHead>
                    <TableHead>Ordenes activas</TableHead>
                    <TableHead>Lead time</TableHead>
                    <TableHead>Nivel de servicio</TableHead>
                    <TableHead>Productos criticos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierSummary.map((supplier) => (
                    <TableRow key={supplier.supplierName}>
                      <TableCell className="font-medium text-foreground">
                        {supplier.supplierName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {supplier.country}
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
