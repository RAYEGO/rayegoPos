import { useMemo, useState } from 'react'
import {
  CreditCard,
  Receipt,
  ScanSearch,
  Search,
  ShoppingBasket,
  ShieldPlus,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { inventoryLots } from '@/modules/inventory/mock-data'
import { productRecords } from '@/modules/products/mock-data'
import {
  prescriptionControls,
  recentSales,
  salesCartItems,
  type PaymentMethod,
  type SaleStatus,
} from '@/modules/sales/mock-data'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(value)
}

function getSaleStatusVariant(status: SaleStatus) {
  if (status === 'EMITIDA') return 'success'
  if (status === 'PENDIENTE_PAGO') return 'warning'
  return 'destructive'
}

function getPaymentVariant(method: PaymentMethod) {
  if (method === 'EFECTIVO') return 'success'
  if (method === 'TARJETA') return 'info'
  return 'outline'
}

export function VentasPage() {
  const [search, setSearch] = useState('')

  const searchableProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return productRecords
      .filter((product) => product.status !== 'DESCONTINUADO')
      .filter((product) => {
        if (normalizedSearch.length === 0) {
          return true
        }

        return (
          product.name.toLowerCase().includes(normalizedSearch) ||
          product.sku.toLowerCase().includes(normalizedSearch) ||
          product.genericName.toLowerCase().includes(normalizedSearch)
        )
      })
      .map((product) => {
        const availableLots = inventoryLots
          .filter(
            (lot) =>
              lot.sku === product.sku &&
              lot.status !== 'BLOQUEADO' &&
              lot.status !== 'AGOTADO' &&
              lot.availableUnits > 0,
          )
          .sort(
            (left, right) =>
              left.fifoPriority - right.fifoPriority ||
              left.expiryDate.localeCompare(right.expiryDate),
          )

        return {
          ...product,
          suggestedLot: availableLots[0] ?? null,
        }
      })
  }, [search])

  const salesMetrics = useMemo(() => {
    const subtotal = salesCartItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    )
    const discount = salesCartItems.reduce((sum, item) => sum + item.discount, 0)
    const total = subtotal - discount

    return {
      subtotal,
      discount,
      total,
      rxItems: salesCartItems.filter((item) => item.requiresPrescription).length,
      mixedPayments: recentSales.filter((sale) => sale.paymentMethods.length > 1).length,
    }
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader title="Ventas" />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>Mostrador de venta</CardTitle>
            <CardDescription>
              Flujo listo para busqueda de productos, seleccion FIFO y cierre de cobro.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Items en carrito
              </p>
              <p className="mt-2 text-display text-foreground">{salesCartItems.length}</p>
              <p className="text-small text-muted-foreground">
                productos listos para facturar
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Total actual
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {formatCurrency(salesMetrics.total)}
              </p>
              <p className="text-small text-muted-foreground">
                descuento aplicado {formatCurrency(salesMetrics.discount)}
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Con receta
              </p>
              <p className="mt-2 text-display text-foreground">{salesMetrics.rxItems}</p>
              <p className="text-small text-muted-foreground">
                requieren validacion antes de salida
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Cobro mixto
              </p>
              <p className="mt-2 text-display text-foreground">
                {salesMetrics.mixedPayments}
              </p>
              <p className="text-small text-muted-foreground">
                ventas recientes con mas de un medio
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reglas operativas</CardTitle>
            <CardDescription>
              Ventas ya queda alineado con inventario y seguridad farmaceutica.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Salida FIFO</p>
              <p className="mt-1 text-small text-muted-foreground">
                Cada producto propone el lote correcto segun prioridad y vencimiento.
              </p>
            </div>
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Control de receta</p>
              <p className="mt-1 text-small text-muted-foreground">
                Los antibioticos y otros sensibles quedan visibles antes del cobro.
              </p>
            </div>
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Cobro flexible</p>
              <p className="mt-1 text-small text-muted-foreground">
                La estructura ya soporta efectivo, tarjeta y billeteras digitales.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="mostrador">
        <TabsList className="grid w-full grid-cols-3 lg:w-fit">
          <TabsTrigger value="mostrador">Mostrador</TabsTrigger>
          <TabsTrigger value="operaciones">Operaciones recientes</TabsTrigger>
          <TabsTrigger value="dispensacion">Dispensacion</TabsTrigger>
        </TabsList>

        <TabsContent value="mostrador" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ScanSearch className="h-5 w-5 text-primary" />
                  Busqueda de productos
                </CardTitle>
                <CardDescription>
                  Catalogo de venta con disponibilidad operativa por lote.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por nombre, SKU o generico"
                    className="pl-9"
                  />
                </div>

                <div className="space-y-3">
                  {searchableProducts.map((product) => (
                    <div key={product.id} className="rounded-2xl border p-4">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <p className="font-medium text-foreground">{product.name}</p>
                          <p className="mt-1 text-small text-muted-foreground">
                            {product.sku} · {product.presentation} · {product.genericName}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge variant="outline">{product.category}</Badge>
                            <Badge variant="info">{formatCurrency(product.salePrice)}</Badge>
                            {product.requiresPrescription ? (
                              <Badge variant="warning">Receta</Badge>
                            ) : null}
                            {product.coldChain ? (
                              <Badge variant="info">Cadena de frio</Badge>
                            ) : null}
                          </div>
                        </div>

                        <div className="min-w-64 rounded-2xl border bg-muted/20 p-4">
                          <p className="text-small font-medium text-foreground">
                            Lote sugerido para salida
                          </p>
                          {product.suggestedLot ? (
                            <>
                              <p className="mt-2 text-small text-muted-foreground">
                                {product.suggestedLot.lotCode} · {product.suggestedLot.availableUnits} und
                              </p>
                              <p className="text-small text-muted-foreground">
                                vence {product.suggestedLot.expiryDate} · FIFO {product.suggestedLot.fifoPriority}
                              </p>
                            </>
                          ) : (
                            <p className="mt-2 text-small text-muted-foreground">
                              Sin lote disponible para venta inmediata.
                            </p>
                          )}
                          <Button type="button" size="sm" className="mt-3 w-full">
                            Agregar al carrito
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBasket className="h-5 w-5 text-primary" />
                  Carrito actual
                </CardTitle>
                <CardDescription>
                  Resumen de items, descuentos y sugerencia de salida por lote.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {salesCartItems.map((item) => (
                  <div key={item.id} className="rounded-2xl border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-foreground">{item.productName}</p>
                        <p className="mt-1 text-small text-muted-foreground">
                          {item.quantity} und · {formatCurrency(item.unitPrice)} c/u
                        </p>
                        <p className="text-small text-muted-foreground">
                          lote {item.suggestedLotCode} · vence {item.expiresAt}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-foreground">
                          {formatCurrency(item.quantity * item.unitPrice - item.discount)}
                        </p>
                        {item.discount > 0 ? (
                          <p className="text-small text-muted-foreground">
                            desc. {formatCurrency(item.discount)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {item.requiresPrescription ? (
                      <Badge variant="warning" className="mt-3">
                        Validar receta antes de emitir
                      </Badge>
                    ) : null}
                  </div>
                ))}

                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-small text-muted-foreground">Subtotal</span>
                    <span className="font-medium text-foreground">
                      {formatCurrency(salesMetrics.subtotal)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-small text-muted-foreground">Descuento</span>
                    <span className="font-medium text-foreground">
                      {formatCurrency(salesMetrics.discount)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t pt-3">
                    <span className="font-medium text-foreground">Total</span>
                    <span className="text-base font-semibold text-foreground">
                      {formatCurrency(salesMetrics.total)}
                    </span>
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <Button type="button" variant="outline">
                    Reservar venta
                  </Button>
                  <Button type="button">
                    <CreditCard className="h-4 w-4" />
                    Cobrar ahora
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="operaciones" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Ventas recientes
              </CardTitle>
              <CardDescription>
                Historial inmediato para caja, seguimiento y conciliacion operativa.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Comprobante</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Cajero</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Pagos</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{sale.code}</p>
                          <p className="text-small text-muted-foreground">
                            {sale.itemCount} items
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {sale.customerName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {sale.cashierName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {sale.createdAt}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {formatCurrency(sale.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {sale.paymentMethods.map((method) => (
                            <Badge key={method} variant={getPaymentVariant(method)}>
                              {method}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getSaleStatusVariant(sale.status)}>{sale.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dispensacion" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldPlus className="h-5 w-5 text-primary" />
                  Control de dispensacion
                </CardTitle>
                <CardDescription>
                  Validacion operativa para productos con receta y trazabilidad sanitaria.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Profesional</TableHead>
                      <TableHead>Receta</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prescriptionControls.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium text-foreground">
                          {record.productName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {record.customerName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {record.doctorName}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{record.prescriptionCode}</p>
                            <p className="text-small text-muted-foreground">
                              {record.dispensedAt}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {record.lotCode}
                        </TableCell>
                        <TableCell>
                          <Badge variant={record.status === 'VALIDADA' ? 'success' : 'warning'}>
                            {record.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reglas de salida</CardTitle>
                <CardDescription>
                  Controles inmediatos antes de confirmar una venta sensible.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Validar receta vigente</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Confirmar fecha, medico y coincidencia entre prescripcion y producto dispensado.
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Respetar lote FIFO</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Priorizar el lote sugerido para reducir merma y mantener trazabilidad.
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Registrar medio de pago</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    El cierre debe reflejar efectivo, tarjeta o billeteras segun la operacion real.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
