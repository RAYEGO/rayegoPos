import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { useAuth } from '@/hooks/useAuth'
import { ApiError, ApiNetworkError } from '@/services/apiClient'
import { dashboardService } from '@/services/dashboardService'
import type { DashboardOverviewResponse } from '@/types/dashboard'
import { toast } from 'sonner'

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

const defaultDashboard: DashboardOverviewResponse = {
  kpis: {
    salesTodayTotal: 0,
    salesTodayCount: 0,
    averageTicket: 0,
    pendingCollections: 0,
    purchaseOpenCount: 0,
    purchaseOutstanding: 0,
    availableStockUnits: 0,
    expiringLotsCount: 0,
    lowStockProductsCount: 0,
    customersTotalCount: 0,
    customersActiveCount: 0,
    activeProductsCount: 0,
  },
  cashPaymentSummary: [],
  alerts: {
    expiringLots: [],
    lowStockProducts: [],
  },
  topCustomers: [],
  recentSales: [],
  cashDrawer: null,
  options: {
    branches: [],
  },
}

function getApiErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof ApiNetworkError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'No fue posible cargar el dashboard.'
}

export function DashboardPage() {
  const { logout, session } = useAuth()
  const accessToken = session?.accessToken ?? ''

  const [showSummary, setShowSummary] = useState(false)
  const [branchId, setBranchId] = useState<string>('all')
  const [dashboard, setDashboard] = useState<DashboardOverviewResponse>(defaultDashboard)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleUnauthorized = useCallback(async () => {
    toast.error('Tu sesión ya no es válida. Ingresa nuevamente para continuar.')
    await logout()
  }, [logout])

  const loadDashboard = useCallback(async () => {
    if (!accessToken) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await dashboardService.getOverview(accessToken, {
        branchId: branchId === 'all' ? undefined : branchId,
      })
      setDashboard(response)
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorized()
        return
      }

      setDashboard(defaultDashboard)
      setError(getApiErrorMessage(nextError))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, branchId, handleUnauthorized])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const kpis = dashboard.kpis
  const cashDrawer = dashboard.cashDrawer

  const collectedVsSales = useMemo(
    () =>
      dashboard.cashPaymentSummary.reduce(
        (sum, item) => sum + item.collectedAmount - item.salesAmount,
        0,
      ),
    [dashboard.cashPaymentSummary],
  )

  const branchOptions = dashboard.options.branches
  const selectedBranchLabel =
    branchId === 'all'
      ? 'Todas las sucursales'
      : branchOptions.find((branch) => branch.id === branchId)?.nombre ?? 'Sucursal'

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="h-9 w-[220px]">
              <SelectValue placeholder={selectedBranchLabel} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las sucursales</SelectItem>
              {branchOptions.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="ghost" size="sm" onClick={() => setShowSummary(!showSummary)}>
            Resumen
            <ChevronDown
              className={`ml-1 h-4 w-4 transition-transform ${showSummary ? 'rotate-180' : ''}`}
            />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader className="h-8 w-8" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {showSummary && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">
                {formatCurrency(kpis.salesTodayTotal)}
              </span>
              <span className="text-xs text-muted-foreground">Ventas</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <Boxes className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">
                {Math.round(kpis.availableStockUnits)}
              </span>
              <span className="text-xs text-muted-foreground">Stock</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{kpis.customersActiveCount}</span>
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
            <p className="text-display text-foreground">
              {formatCurrency(kpis.salesTodayTotal)}
            </p>
            <p className="text-small text-muted-foreground">
              {kpis.salesTodayCount} operaciones · ticket {formatCurrency(kpis.averageTicket)}
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
              {formatCurrency(kpis.purchaseOutstanding)}
            </p>
            <p className="text-small text-muted-foreground">
              {kpis.purchaseOpenCount} ordenes con saldo pendiente
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
            <p className="text-display text-foreground">
              {Math.round(kpis.availableStockUnits)}
            </p>
            <p className="text-small text-muted-foreground">
              {kpis.expiringLotsCount} lotes por vencer · {kpis.lowStockProductsCount} bajo stock
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
            <p className="text-display text-foreground">{kpis.customersActiveCount}</p>
            <p className="text-small text-muted-foreground">
              {dashboard.topCustomers.length} clientes con mayor valor
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
              <p className="mt-2 text-display text-foreground">{kpis.activeProductsCount}</p>
              <p className="text-small text-muted-foreground">
                SKU listos para venta y reposicion.
              </p>
            </div>
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Caja del turno</p>
              <p className="mt-2 text-display text-foreground">
                {cashDrawer ? formatCurrency(cashDrawer.expectedAmount) : '—'}
              </p>
              <p className="text-small text-muted-foreground">
                diferencia actual {cashDrawer ? formatCurrency(cashDrawer.differenceAmount) : '—'}
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
              <p className="font-medium text-foreground">Cobranza pendiente</p>
              <p className="mt-2 text-display text-foreground">
                {formatCurrency(kpis.pendingCollections)}
              </p>
              <p className="text-small text-muted-foreground">
                saldo de ventas emitidas por cobrar.
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
                <Badge variant="warning">{kpis.expiringLotsCount}</Badge>
              </div>
              <p className="mt-2 text-small text-muted-foreground">
                Priorizar salida FIFO y campañas para productos cercanos a vencimiento.
              </p>
            </div>
            <div className="rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="font-medium text-foreground">Diferencia de caja</p>
                <Badge
                  variant={
                    cashDrawer && cashDrawer.differenceAmount === 0 ? 'success' : 'warning'
                  }
                >
                  {cashDrawer ? formatCurrency(cashDrawer.differenceAmount) : '—'}
                </Badge>
              </div>
              <p className="mt-2 text-small text-muted-foreground">
                Validar soportes de caja antes del cierre definitivo.
              </p>
            </div>
            <div className="rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="font-medium text-foreground">Stock bajo</p>
                <Badge variant="info">{kpis.lowStockProductsCount}</Badge>
              </div>
              <p className="mt-2 text-small text-muted-foreground">
                Productos con stock por debajo del mínimo configurado (o 20 por defecto).
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
                  <TableHead>Operaciones</TableHead>
                  <TableHead>Valor acumulado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.topCustomers.slice(0, 10).map((customer) => (
                  <TableRow key={customer.customerId}>
                    <TableCell className="font-medium text-foreground">
                      {customer.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{customer.operations}</TableCell>
                    <TableCell className="font-medium text-foreground">
                      {formatCurrency(customer.total)}
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
            {dashboard.cashPaymentSummary.map((item) => {
              const width =
                item.salesAmount > 0 ? (item.collectedAmount / item.salesAmount) * 100 : 0

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
