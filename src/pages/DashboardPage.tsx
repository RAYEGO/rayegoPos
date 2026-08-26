import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  Building2,
  Layers,
  Shield,
  ShoppingCart,
  Users2,
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
import { useAuth } from '@/hooks/useAuth'
import { useAuthorization } from '@/hooks/useAuthorization'
import { useHandleUnauthorized } from '@/hooks/useHandleUnauthorized'
import { ApiError, ApiNetworkError } from '@/services/apiClient'
import { dashboardService } from '@/services/dashboardService'
import type { DashboardOverviewResponse } from '@/types/dashboard'
import { paths } from '@/routes/paths'

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
    cashClosePending: null,
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
  const { session } = useAuth()
  const { hasRole } = useAuthorization()
  const accessToken = session?.accessToken ?? ''
  const navigate = useNavigate()

  const isPlatformAdmin = hasRole('ADMIN_POS')

  const [dashboard, setDashboard] = useState<DashboardOverviewResponse>(defaultDashboard)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAlertDetails, setShowAlertDetails] = useState(false)

  const handleUnauthorized = useHandleUnauthorized('DashboardPage')

  const loadDashboard = useCallback(async () => {
    if (!accessToken) {
      console.debug(
        '[DASHBOARD] loadDashboard: accessToken NO ESTÁ DISPONIBLE (session?.accessToken vacío). Early return.',
        {
          sessionExists: session !== null,
          accessTokenLength: accessToken.length,
          accessTokenPreview: accessToken.slice(0, 16) || '(vacío)',
        },
      )
      return
    }

    console.debug(
      `[DASHBOARD] loadDashboard INICIADO con accessToken=${accessToken.slice(0, 16)}... (total ${accessToken.length} chars)`,
    )
    setIsLoading(true)
    setError(null)

    try {
      const response = await dashboardService.getOverview(accessToken)
      console.debug(
        '[DASHBOARD] loadDashboard OK → dashboard data recibida.',
        {
          hasActiveDrawer: Boolean(response.cash?.activeDrawer),
          todaySalesCount: response.sales?.todayCount ?? 0,
          alertsCount:
            (response.alerts?.expiringLotsCount ?? 0) +
            (response.alerts?.lowStockProductsCount ?? 0),
        },
      )
      setDashboard(response)
    } catch (nextError) {
      const status = nextError instanceof ApiError ? nextError.status : -1
      const message = getApiErrorMessage(nextError)
      console.warn(
        `[DASHBOARD] loadDashboard ERROR en GET /api/dashboard/overview. status=${status} message="${message}"`,
        nextError,
      )
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorized(status, message, 'GET /api/dashboard/overview')
        return
      }

      setDashboard(defaultDashboard)
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, handleUnauthorized, session])

  useEffect(() => {
    if (isPlatformAdmin) {
      setIsLoading(false)
      return
    }
    void loadDashboard()
  }, [isPlatformAdmin, loadDashboard])

  const activeDrawer = dashboard.cash.activeDrawer

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
        <h1 className="text-xl font-bold text-foreground">
          {isPlatformAdmin ? 'Panel de plataforma' : 'Dashboard'}
        </h1>
      </div>

      {isPlatformAdmin ? (
        <PlatformAdminDashboardContent />
      ) : (
        <CompanyDashboardContent
          isLoading={isLoading}
          error={error}
          dashboard={dashboard}
          activityRows={activityRows}
          showAlertDetails={showAlertDetails}
          onToggleAlertDetails={() => setShowAlertDetails((current) => !current)}
          onNavigateToCashier={() => navigate(paths.caja)}
        />
      )}
    </div>
  )
}

type PlatformStats = {
  empresasRegistradas: number
  empresasActivas: number
  administradoresRegistrados: number
  tiposEmpresa: { codigo: string; nombre: string; color: string; empresasCount: number }[]
  recentActivity: { id: string; createdAt: string; title: string; subtitle: string; variant: 'info' | 'success' | 'warning' }[]
}

const PLATFORM_STATS: PlatformStats = {
  empresasRegistradas: 2,
  empresasActivas: 2,
  administradoresRegistrados: 2,
  tiposEmpresa: [
    { codigo: 'BOTICA', nombre: 'Botica / Farmacia', color: '#2563eb', empresasCount: 1 },
    { codigo: 'SERVICIO_TECNICO', nombre: 'Servicio Técnico', color: '#16a34a', empresasCount: 1 },
  ],
  recentActivity: [
    {
      id: 'a1',
      createdAt: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
      title: 'Nueva empresa registrada',
      subtitle: 'Electro Servicios SAC · SERVICIO_TECNICO',
      variant: 'success',
    },
    {
      id: 'a2',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      title: 'Módulos actualizados',
      subtitle: 'BOTICA · +Equipos · -Lotes',
      variant: 'info',
    },
    {
      id: 'a3',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      title: 'Administrador asignado',
      subtitle: 'Jefe de Servicios · Electro Servicios SAC',
      variant: 'info',
    },
    {
      id: 'a4',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      title: 'Tipo empresa desactivado',
      subtitle: 'OPTICA (próximamente)',
      variant: 'warning',
    },
  ],
}

function PlatformAdminDashboardContent() {
  const navigate = useNavigate()
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Empresas registradas</CardTitle>
              <CardDescription>Total de clientes en la plataforma.</CardDescription>
            </div>
            <Building2 className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-display text-foreground">{PLATFORM_STATS.empresasRegistradas}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => navigate(paths.empresas)}
            >
              Ver empresas
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Empresas activas</CardTitle>
              <CardDescription>En producción actualmente.</CardDescription>
            </div>
            <Shield className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <p className="text-display text-foreground">{PLATFORM_STATS.empresasActivas}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {PLATFORM_STATS.empresasActivas === PLATFORM_STATS.empresasRegistradas
                ? 'Todas las empresas están activas.'
                : `${PLATFORM_STATS.empresasRegistradas - PLATFORM_STATS.empresasActivas} inactiva(s).`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Administradores</CardTitle>
              <CardDescription>Administradores de empresa asignados.</CardDescription>
            </div>
            <Users2 className="h-5 w-5 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <p className="text-display text-foreground">{PLATFORM_STATS.administradoresRegistrados}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => navigate(paths.administradores)}
            >
              Gestionar
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Tipos de empresa</CardTitle>
              <CardDescription>Categorías y módulos configurados.</CardDescription>
            </div>
            <Layers className="h-5 w-5 text-violet-600" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_STATS.tiposEmpresa.map((tipo) => (
                <Badge
                  key={tipo.codigo}
                  variant="outline"
                  style={{ borderColor: tipo.color, color: tipo.color }}
                >
                  {tipo.nombre} · {tipo.empresasCount}
                </Badge>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => navigate(paths.tiposEmpresa)}
            >
              Tipos y módulos
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Empresas por tipo
          </CardTitle>
          <CardDescription>Distribución de clientes según su vertical.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {PLATFORM_STATS.tiposEmpresa.map((tipo) => (
              <div
                key={tipo.codigo}
                className="rounded-2xl border p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: tipo.color }}
                    />
                    <p className="text-sm font-semibold text-foreground">{tipo.nombre}</p>
                    <Badge variant="outline" className="text-xs">
                      {tipo.codigo}
                    </Badge>
                  </div>
                  <p className="text-lg font-bold text-foreground">{tipo.empresasCount}</p>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {tipo.empresasCount === 1 ? '1 empresa' : `${tipo.empresasCount} empresas`}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Actividad reciente de plataforma
          </CardTitle>
          <CardDescription>Cambios y eventos globales de la plataforma.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {PLATFORM_STATS.recentActivity.map((row) => (
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
              <Badge variant={row.variant}>
                {row.variant === 'success' ? 'Nuevo' : row.variant === 'warning' ? 'Aviso' : 'Cambio'}
              </Badge>
            </div>
          ))}
          <span
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Ver auditoría completa (próximamente)
          </span>
        </CardContent>
      </Card>
    </>
  )
}

type CompanyDashboardContentProps = {
  isLoading: boolean
  error: string | null
  dashboard: DashboardOverviewResponse
  activityRows: { id: string; createdAt: string; title: string; subtitle: string; amount: number; variant: 'info' | 'success' | 'warning' }[]
  showAlertDetails: boolean
  onToggleAlertDetails: () => void
  onNavigateToCashier: () => void
}

function CompanyDashboardContent({
  isLoading,
  error,
  dashboard,
  activityRows,
  showAlertDetails,
  onToggleAlertDetails,
  onNavigateToCashier,
}: CompanyDashboardContentProps) {
  const activeDrawer = dashboard.cash.activeDrawer
  return (
    <>
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
                  {activeDrawer.cashRegisterName} · {activeDrawer.cashierName}
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
            onClick={onToggleAlertDetails}
          >
            {showAlertDetails ? 'Ocultar' : 'Ver'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="warning">{dashboard.alerts.expiringLotsCount} por vencer</Badge>
            <Badge variant="info">{dashboard.alerts.lowStockProductsCount} bajo stock</Badge>
          </div>

          {dashboard.alerts.cashClosePending ? (
            <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning-foreground">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p>
                  Caja pendiente de cierre desde el {dashboard.alerts.cashClosePending.openedDateLabel}
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={onNavigateToCashier}
                >
                  Ir a Caja
                </Button>
              </div>
            </div>
          ) : null}

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
    </>
  )
}
