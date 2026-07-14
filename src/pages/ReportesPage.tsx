import {
  BarChart3,
  FileSpreadsheet,
  LineChart,
  PackageOpen,
  ReceiptText,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cashDrawers, cashPaymentSummary } from '@/modules/cashier/mock-data'
import { customerRecords } from '@/modules/customers/mock-data'
import { inventoryLots } from '@/modules/inventory/mock-data'
import { productRecords } from '@/modules/products/mock-data'
import { purchaseOrders, purchaseReceipts } from '@/modules/purchases/mock-data'
import { recentSales } from '@/modules/sales/mock-data'
import { supplierRecords } from '@/modules/suppliers/mock-data'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(value)
}

export function ReportesPage() {
  const salesByCustomer = [...recentSales]
    .filter((sale) => sale.status === 'EMITIDA')
    .sort((left, right) => right.totalAmount - left.totalAmount)

  const productPerformance = productRecords
    .filter((product) => product.status !== 'DESCONTINUADO')
    .map((product) => ({
      ...product,
      potentialMargin: product.salePrice - product.costPrice,
      reservedRate:
        product.stockUnits > 0 ? (product.reservedUnits / product.stockUnits) * 100 : 0,
    }))
    .sort((left, right) => right.salePrice - left.salePrice)

  const operationalRows = inventoryLots
    .map((lot) => ({
      branchName: lot.branchName,
      productName: lot.productName,
      lotCode: lot.lotCode,
      availableUnits: lot.availableUnits,
      expiryDate: lot.expiryDate,
      status: lot.status,
    }))
    .sort((left, right) => left.expiryDate.localeCompare(right.expiryDate))

  const purchaseEfficiency = purchaseOrders.map((order) => ({
    ...order,
    receiptCount: purchaseReceipts.filter((receipt) => receipt.purchaseCode === order.code).length,
  }))

  const supplierRanking = [...supplierRecords].sort(
    (left, right) => right.serviceLevel - left.serviceLevel,
  )

  const activeDrawer = cashDrawers.find((drawer) => drawer.status !== 'CERRADA') ?? cashDrawers[0]
  const averageCustomerValue =
    customerRecords.length > 0
      ? customerRecords.reduce((sum, customer) => sum + customer.totalSpent, 0) /
        customerRecords.length
      : 0

  return (
    <div className="space-y-6">
      <PageHeader title="Reportes" />

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm">
          <FileSpreadsheet className="h-4 w-4" />
          Exportar reporte
        </Button>
        <Button type="button" variant="outline" size="sm">
          Actualizar indicadores
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Ventas</CardTitle>
            <CardDescription>Operacion comercial consolidada.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-display text-foreground">
              {formatCurrency(
                recentSales
                  .filter((sale) => sale.status === 'EMITIDA')
                  .reduce((sum, sale) => sum + sale.totalAmount, 0),
              )}
            </p>
            <p className="text-small text-muted-foreground">
              {recentSales.filter((sale) => sale.status === 'EMITIDA').length} ventas emitidas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventario</CardTitle>
            <CardDescription>Stock disponible y riesgo.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-display text-foreground">
              {inventoryLots.reduce((sum, lot) => sum + lot.availableUnits, 0)}
            </p>
            <p className="text-small text-muted-foreground">
              {inventoryLots.filter((lot) => lot.status === 'POR_VENCER').length} lotes por vencer
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clientes</CardTitle>
            <CardDescription>Base comercial activa.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-display text-foreground">
              {formatCurrency(averageCustomerValue)}
            </p>
            <p className="text-small text-muted-foreground">ticket historico por cliente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Caja</CardTitle>
            <CardDescription>Resultado del turno activo.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-display text-foreground">
              {formatCurrency(activeDrawer.expectedAmount)}
            </p>
            <p className="text-small text-muted-foreground">
              diferencia {formatCurrency(activeDrawer.differenceAmount)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="comercial">
        <TabsList className="grid w-full grid-cols-3 lg:w-fit">
          <TabsTrigger value="comercial">Comercial</TabsTrigger>
          <TabsTrigger value="operativo">Operativo</TabsTrigger>
          <TabsTrigger value="abastecimiento">Abastecimiento</TabsTrigger>
        </TabsList>

        <TabsContent value="comercial" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Ventas por comprobante
                </CardTitle>
                <CardDescription>
                  Ranking reciente de ventas emitidas y clientes asociados.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Comprobante</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesByCustomer.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium text-foreground">
                          {sale.code}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {sale.customerName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {sale.createdAt}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {sale.itemCount}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {formatCurrency(sale.totalAmount)}
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
                  <LineChart className="h-5 w-5 text-primary" />
                  Rendimiento del catalogo
                </CardTitle>
                <CardDescription>
                  Lectura comercial por precio, margen potencial y reserva.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {productPerformance.slice(0, 5).map((product) => (
                  <div key={product.id} className="rounded-2xl border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-foreground">{product.name}</p>
                        <p className="mt-1 text-small text-muted-foreground">
                          {product.category} · {product.presentation}
                        </p>
                      </div>
                      <Badge variant="info">{formatCurrency(product.salePrice)}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline">
                        margen {formatCurrency(product.potentialMargin)}
                      </Badge>
                      <Badge variant="outline">
                        reserva {Math.round(product.reservedRate)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="operativo" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PackageOpen className="h-5 w-5 text-primary" />
                  Riesgo operativo por lotes
                </CardTitle>
                <CardDescription>
                  Prioridad de atencion por vencimiento y disponibilidad.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sucursal</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operationalRows.slice(0, 8).map((row) => (
                      <TableRow key={row.lotCode}>
                        <TableCell className="text-muted-foreground">
                          {row.branchName}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {row.productName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.lotCode}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.availableUnits}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.expiryDate}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              row.status === 'DISPONIBLE'
                                ? 'success'
                                : row.status === 'POR_VENCER'
                                  ? 'warning'
                                  : row.status === 'BLOQUEADO'
                                    ? 'destructive'
                                    : 'outline'
                            }
                          >
                            {row.status}
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
                <CardTitle className="flex items-center gap-2">
                  <ReceiptText className="h-5 w-5 text-primary" />
                  Control de caja y cobro
                </CardTitle>
                <CardDescription>
                  Comparacion simple entre ventas y recaudacion por medio.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medio</TableHead>
                      <TableHead>Ventas</TableHead>
                      <TableHead>Cobrado</TableHead>
                      <TableHead>Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashPaymentSummary.map((item) => (
                      <TableRow key={item.method}>
                        <TableCell>
                          <Badge variant="outline">{item.method}</Badge>
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {formatCurrency(item.salesAmount)}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {formatCurrency(item.collectedAmount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.collectedAmount === item.salesAmount ? 'success' : 'warning'
                            }
                          >
                            {formatCurrency(item.collectedAmount - item.salesAmount)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="abastecimiento" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  Eficiencia de compras
                </CardTitle>
                <CardDescription>
                  Estado de ordenes y recepciones asociadas por proveedor.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Orden</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Entrega</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Recepciones</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseEfficiency.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium text-foreground">
                          {order.code}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {order.supplierName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {order.expectedAt}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {formatCurrency(order.totalAmount)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {order.receiptCount}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              order.status === 'CERRADA'
                                ? 'success'
                                : order.status === 'ANULADA'
                                  ? 'destructive'
                                  : order.status === 'BORRADOR'
                                    ? 'warning'
                                    : 'info'
                            }
                          >
                            {order.status}
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
                <CardTitle>Ranking de proveedores</CardTitle>
                <CardDescription>
                  Nivel de servicio, cobertura y capacidad de respuesta.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {supplierRanking.map((supplier) => (
                  <div key={supplier.id} className="rounded-2xl border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-foreground">{supplier.businessName}</p>
                        <p className="mt-1 text-small text-muted-foreground">
                          {supplier.category} · {supplier.activeProducts} SKU
                        </p>
                      </div>
                      <Badge
                        variant={supplier.serviceLevel >= 95 ? 'success' : 'warning'}
                      >
                        {supplier.serviceLevel}%
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline">{supplier.leadTimeDays} dias</Badge>
                      <Badge variant="outline">{supplier.country}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
