import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ShoppingCart,
  WalletCards,
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

const defaultDashboard: DashboardOverviewResponse = {
  sales: {
    todayTotal: 0,
    todayCount: 0,
    averageTicket: 0,
  },
  cash: {
    activeDrawer: null,
  },
  alerts: {
    expiringLotsCount: 0,
    lowStockProductsCount: 0,
    expiringLots: [],
    lowStockProducts: [],
  },
  activity: {
    recentSales: [],
    recentCashMovements: [],
  },
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

  const [branchId, setBranchId] = useState<string>('all')
  const [dashboard, setDashboard] = useState<DashboardOverviewResponse>(defaultDashboard)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAlertDetails, setShowAlertDetails] = useState(false)

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

  const activeDrawer = dashboard.cash.activeDrawer

  const branchOptions = dashboard.options.branches
  const selectedBranchLabel =
    branchId === 'all'
      ? 'Todas las sucursales'
      : branchOptions.find((branch) => branch.id === branchId)?.nombre ?? 'Sucursal'

  const activityRows = useMemo(() => {
    const sales = dashboard.activity.recentSales.map((sale) => ({
      id: `sale-${sale.id}`,
      createdAt: sale.issuedAt,
      title: sale.document ?? 'Venta emitida',
      subtitle: sale.customerName ?? 'Mostrador',
      amount: sale.total,
      variant: 'success' as const,
    }))

    const movements = dashboard.activity.recentCashMovements.map((movement) => ({
      id: `cash-${movement.id}`,
      createdAt: movement.createdAt,
      title: movement.reference ?? movement.type,
      subtitle: `${movement.type} · ${movement.actorName}`,
      amount:
        movement.operation === 'INGRESO' ? movement.amount : -movement.amount,
      variant:
        movement.operation === 'INGRESO' ? ('info' as const) : ('warning' as const),
    }))

    return [...sales, ...movements]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 12)
  }, [dashboard.activity.recentCashMovements, dashboard.activity.recentSales])

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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Ventas del día</CardTitle>
              <CardDescription>Monitor operativo del turno.</CardDescription>
            </div>
            <ShoppingCart className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-display text-foreground">
              {formatCurrency(dashboard.sales.todayTotal)}
            </p>
            <p className="text-small text-muted-foreground">
              {dashboard.sales.todayCount} ventas · ticket{' '}
              {formatCurrency(dashboard.sales.averageTicket)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Estado de caja</CardTitle>
              <CardDescription>Turno actual y saldo esperado.</CardDescription>
            </div>
            <WalletCards className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            {activeDrawer ? (
              <>
                <p className="text-display text-foreground">
                  {formatCurrency(activeDrawer.expectedAmount)}
                </p>
                <p className="text-small text-muted-foreground">
                  {activeDrawer.branchName} · {activeDrawer.cashierName}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  apertura {new Date(activeDrawer.openedAt).toLocaleString('es-PE')}
                </p>
                {activeDrawer.lastCashCount ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    último arqueo {new Date(activeDrawer.lastCashCount.createdAt).toLocaleTimeString('es-PE')} · dif{' '}
                    {formatCurrency(activeDrawer.lastCashCount.differenceCashAmount)}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">sin arqueo registrado</p>
                )}
              </>
            ) : (
              <>
                <p className="text-display text-foreground">—</p>
                <p className="text-small text-muted-foreground">No hay turno abierto</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Alertas críticas
            </CardTitle>
            <CardDescription>Solo lo que requiere atención inmediata.</CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAlertDetails((current) => !current)}
          >
            {showAlertDetails ? 'Ocultar' : 'Ver'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="warning">{dashboard.alerts.expiringLotsCount} por vencer</Badge>
            <Badge variant="info">{dashboard.alerts.lowStockProductsCount} bajo stock</Badge>
            <Badge variant={activeDrawer ? 'success' : 'outline'}>
              {activeDrawer ? 'Caja abierta' : 'Caja cerrada'}
            </Badge>
          </div>

          {showAlertDetails ? (
            <div className="space-y-3">
              {dashboard.alerts.expiringLots.length ? (
                <div className="rounded-2xl border p-4">
                  <p className="text-sm font-medium text-foreground">Lotes por vencer</p>
                  <div className="mt-3 space-y-2">
                    {dashboard.alerts.expiringLots.slice(0, 3).map((lot) => (
                      <div key={lot.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">{lot.productName}</p>
                          <p className="text-xs text-muted-foreground">
                            {lot.branchName} · {lot.lotCode} · vence {lot.expiryDate}
                          </p>
                        </div>
                        <p className="text-sm font-medium text-foreground">
                          {Math.round(lot.availableUnits)} {lot.unitSymbol}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {dashboard.alerts.lowStockProducts.length ? (
                <div className="rounded-2xl border p-4">
                  <p className="text-sm font-medium text-foreground">Stock bajo</p>
                  <div className="mt-3 space-y-2">
                    {dashboard.alerts.lowStockProducts.slice(0, 3).map((row) => (
                      <div key={row.productId} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">{row.name}</p>
                          <p className="text-xs text-muted-foreground">{row.sku}</p>
                        </div>
                        <p className="text-sm font-medium text-foreground">
                          {Math.round(row.stockUnits)} / {Math.round(row.threshold)} {row.unitSymbol}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Actividad reciente
          </CardTitle>
          <CardDescription>Eventos recientes del sistema (ventas y caja).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {activityRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">Sin actividad reciente.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activityRows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-start justify-between gap-3 rounded-2xl border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{row.title}</p>
                    <p className="text-xs text-muted-foreground">{row.subtitle}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(row.createdAt).toLocaleString('es-PE')}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={row.variant}>{row.amount >= 0 ? 'INGRESO' : 'EGRESO'}</Badge>
                    <p className="text-sm font-medium text-foreground">
                      {formatCurrency(row.amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
