import { useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Boxes,
  ChevronDown,
  CreditCard,
  PackageSearch,
  ShoppingCart,
  Users,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cashDrawers, cashPaymentSummary } from '@/modules/cashier/mock-data'
import { customerRecords } from '@/modules/customers/mock-data'
import { inventoryLots } from '@/modules/inventory/mock-data'
import { productRecords } from '@/modules/products/mock-data'
import { purchaseOrders } from '@/modules/purchases/mock-data'
import { recentSales } from '@/modules/sales/mock-data'
import { supplierAlerts, supplierDocuments } from '@/modules/suppliers/mock-data'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(value)
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`
}

export function DashboardPage() {
  const [showSummary, setShowSummary] = useState(false)
  const emittedSales = recentSales.filter((sale) => sale.status === 'EMITIDA')
  const grossSales = emittedSales.reduce((sum, sale) => sum + sale.totalAmount, 0)
  const activePurchases = purchaseOrders.filter(
    (order) => order.status === 'EMITIDA' || order.status === 'RECIBIDA_PARCIAL',
  )
  const committedPurchases = activePurchases.reduce(
    (sum, order) => sum + order.totalAmount,
    0,
  )
  const availableStock = inventoryLots.reduce((sum, lot) => sum + lot.availableUnits, 0)
  const activeCustomers = customerRecords.filter((customer) => customer.status === 'ACTIVO')
  const averageTicket =
    emittedSales.length > 0 ? grossSales / emittedSales.length : 0
  const activeCatalog = productRecords.filter((product) => product.status === 'ACTIVO')
  const expiringLots = inventoryLots.filter((lot) => lot.status === 'POR_VENCER')
  const pendingDocs = supplierDocuments.filter((document) => document.status === 'POR_VENCER')
  const activeDrawer =
    cashDrawers.find((drawer) => drawer.status !== 'CERRADA') ?? cashDrawers[0]
  const collectedVsSales = cashPaymentSummary.reduce(
    (sum, item) => sum + item.collectedAmount - item.salesAmount,
    0,
  )
  const topCustomers = [...customerRecords]
    .sort((left, right) => right.totalSpent - left.totalSpent)
    .slice(0, 4)

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
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
              <span className="text-lg font-bold text-foreground">{formatCurrency(grossSales)}</span>
              <span className="text-xs text-muted-foreground">Ventas</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <Boxes className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{availableStock}</span>
              <span className="text-xs text-muted-foreground">Stock</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{activeCustomers.length}</span>
              <span className="text-xs text-muted-foreground">Clientes</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Ventas emitidas</CardTitle>
              <CardDescription>Operacion comercial del periodo actual.</CardDescription>
            </div>
            <ShoppingCart className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-display text-foreground">{formatCurrency(grossSales)}</p>
            <p className="text-small text-muted-foreground">
              ticket promedio {formatCurrency(averageTicket)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Compras comprometidas</CardTitle>
              <CardDescription>Ordenes en curso con proveedor.</CardDescription>
            </div>
            <PackageSearch className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-display text-foreground">
              {formatCurrency(committedPurchases)}
            </p>
            <p className="text-small text-muted-foreground">
              {activePurchases.length} ordenes activas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Stock utilizable</CardTitle>
              <CardDescription>Unidades disponibles por lote.</CardDescription>
            </div>
            <Boxes className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-display text-foreground">{availableStock}</p>
            <p className="text-small text-muted-foreground">
              {expiringLots.length} lotes por vencer
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Clientes activos</CardTitle>
              <CardDescription>Padrón comercial vigente.</CardDescription>
            </div>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-display text-foreground">{activeCustomers.length}</p>
            <p className="text-small text-muted-foreground">
              {topCustomers.length} clientes con mayor valor
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Pulso ejecutivo
            </CardTitle>
            <CardDescription>
              Lectura sintetica del estado comercial, operativo y financiero.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Catalogo activo</p>
              <p className="mt-2 text-display text-foreground">{activeCatalog.length}</p>
              <p className="text-small text-muted-foreground">
                SKU listos para venta y reposicion.
              </p>
            </div>
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Caja del turno</p>
              <p className="mt-2 text-display text-foreground">
                {formatCurrency(activeDrawer.expectedAmount)}
              </p>
              <p className="text-small text-muted-foreground">
                diferencia actual {formatCurrency(activeDrawer.differenceAmount)}
              </p>
            </div>
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Conciliacion medios de pago</p>
              <p className="mt-2 text-display text-foreground">
                {formatCurrency(collectedVsSales)}
              </p>
              <p className="text-small text-muted-foreground">
                saldo agregado entre ventas y cobros.
              </p>
            </div>
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Documentos por vencer</p>
              <p className="mt-2 text-display text-foreground">{pendingDocs.length}</p>
              <p className="text-small text-muted-foreground">
                soporte de proveedor para revisar.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Alertas del dia
            </CardTitle>
            <CardDescription>
              Puntos que merecen accion inmediata antes del siguiente turno.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="font-medium text-foreground">Lotes por vencer</p>
                <Badge variant="warning">{expiringLots.length}</Badge>
              </div>
              <p className="mt-2 text-small text-muted-foreground">
                Priorizar salida FIFO y campañas para productos cercanos a vencimiento.
              </p>
            </div>
            <div className="rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="font-medium text-foreground">Diferencia de caja</p>
                <Badge variant={activeDrawer.differenceAmount === 0 ? 'success' : 'warning'}>
                  {formatCurrency(activeDrawer.differenceAmount)}
                </Badge>
              </div>
              <p className="mt-2 text-small text-muted-foreground">
                Validar soportes de caja antes del cierre definitivo.
              </p>
            </div>
            <div className="rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="font-medium text-foreground">Alertas proveedor</p>
                <Badge variant="info">{supplierAlerts.length}</Badge>
              </div>
              <p className="mt-2 text-small text-muted-foreground">
                Seguimiento comercial activo en documentos y nivel de servicio.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Clientes de mayor valor</CardTitle>
            <CardDescription>
              Base comercial prioritaria para retencion y seguimiento.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead>Visitas</TableHead>
                  <TableHead>Ultima compra</TableHead>
                  <TableHead>Valor acumulado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium text-foreground">
                      {customer.fullName}
                    </TableCell>
                    <TableCell>
                      <Badge variant={customer.segment === 'CORPORATIVO' ? 'success' : 'info'}>
                        {customer.segment}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer.visitCount}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer.lastPurchaseAt}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {formatCurrency(customer.totalSpent)}
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
              <CreditCard className="h-5 w-5 text-primary" />
              Cobros por medio
            </CardTitle>
            <CardDescription>
              Resumen de participacion por canal de pago.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cashPaymentSummary.map((item) => {
              const width = item.salesAmount > 0 ? (item.collectedAmount / item.salesAmount) * 100 : 0

              return (
                <div key={item.method} className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium text-foreground">{item.method}</span>
                    <span className="text-small text-muted-foreground">
                      {formatCurrency(item.collectedAmount)} / {formatCurrency(item.salesAmount)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${Math.min(width, 100)}%` }}
                    />
                  </div>
                  <p className="text-small text-muted-foreground">
                    {item.operations} operaciones · cumplimiento {formatPercent(width)}
                  </p>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
