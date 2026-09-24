import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  Building2,
  Calendar as CalendarIcon,
  Clock,
  Layers,
  MoreHorizontal,
  PackagePlus,
  PackageSearch,
  Plus,
  ReceiptText,
  ScrollText,
  Shield,
  ShoppingBag,
  ShoppingCart,
  TriangleAlert,
  TrendingUp,
  Users,
  Users2,
  WalletCards,
  Zap,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Loader } from '@/components/ui/loader'
import { useAuth } from '@/hooks/useAuth'
import { useAuthorization } from '@/hooks/useAuthorization'
import { useBusinessFeatures } from '@/hooks/useBusinessFeatures'
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

function daysUntil(dateStr: string): number {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(dateStr)
    target.setHours(0, 0, 0, 0)
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  } catch {
    return Number.NaN
  }
}

function formatDateTimeShort(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
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
  const [now, setNow] = useState(() => new Date())

  const handleUnauthorized = useHandleUnauthorized('DashboardPage')

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30 * 1000)
    return () => clearInterval(t)
  }, [])

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

  const greetingName =
    session?.user?.fullName?.split(' ')[0] ??
    session?.user?.email?.split('@')[0] ??
    'Administrador'
  const dateLabel = now.toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const timeLabel = now.toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto w-full max-w-[1440px] space-y-4 p-3 pb-10 sm:p-4 lg:p-6">
        {isPlatformAdmin ? (
          <PlatformAdminDashboardContent />
        ) : (
          <CompanyDashboardContent
            greetingName={greetingName}
            dateLabel={dateLabel}
            timeLabel={timeLabel}
            isLoading={isLoading}
            error={error}
            dashboard={dashboard}
            activityRows={activityRows}
            onNavigateToInventory={() => navigate(paths.inventario)}
            onNavigateToNewSale={() => navigate(paths.ventas)}
            onNavigateToVentaRapida={() => navigate(paths.ventas)}
            onNavigateToProducts={() => navigate(paths.productos)}
            onNavigateToPurchases={() => navigate(paths.compras)}
            onNavigateToUsers={() => navigate(paths.usuarios)}
            onNavigateToReports={() => navigate(paths.reportes)}
            onNavigateToCashier={() => navigate(paths.caja)}
            onNavigateToActivity={() => navigate(paths.usuarios)}
          />
        )}
      </div>
    </div>
  )
}

type PlatformStatsTipoEmpresa = { codigo: string; nombre: string; color: string; empresasCount: number }
type PlatformStatsActivity = { id: string; createdAt: string; title: string; subtitle: string; variant: 'info' | 'success' | 'warning' }

type PlatformStats = {
  empresasRegistradas: number
  empresasActivas: number
  administradoresRegistrados: number
  tiposEmpresa: PlatformStatsTipoEmpresa[]
  recentActivity: PlatformStatsActivity[]
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
  const { isFeatureEnabled } = useBusinessFeatures()
  const hasSTCard = isFeatureEnabled('dashboard_card_technical_service')
  const filteredPlatformStats: PlatformStats = useMemo(() => {
    const base = PLATFORM_STATS
    const tiposEmpresa = hasSTCard
      ? base.tiposEmpresa
      : base.tiposEmpresa.filter((t: PlatformStatsTipoEmpresa) => t.codigo !== 'SERVICIO_TECNICO')
    const recentActivity = hasSTCard
      ? base.recentActivity
      : base.recentActivity.filter(
          (r: PlatformStatsActivity) =>
            !/SERVICIO_TECNICO|RayegoTech|Servicio Técnico|Electro Servicios|Técnico|Jefe de Servicios/i.test(
              `${r.title} ${r.subtitle}`,
            ),
        )
    return {
      ...base,
      tiposEmpresa,
      recentActivity,
    }
  }, [hasSTCard])
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
            <p className="text-display text-foreground">{filteredPlatformStats.empresasRegistradas}</p>
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
            <p className="text-display text-foreground">{filteredPlatformStats.empresasActivas}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {filteredPlatformStats.empresasActivas === filteredPlatformStats.empresasRegistradas
                ? 'Todas las empresas están activas.'
                : `${filteredPlatformStats.empresasRegistradas - filteredPlatformStats.empresasActivas} inactiva(s).`}
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
            <p className="text-display text-foreground">{filteredPlatformStats.administradoresRegistrados}</p>
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
              {filteredPlatformStats.tiposEmpresa.map((tipo) => (
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
            {filteredPlatformStats.tiposEmpresa.map((tipo) => (
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
          {filteredPlatformStats.recentActivity.map((row) => (
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
  greetingName: string
  dateLabel: string
  timeLabel: string
  isLoading: boolean
  error: string | null
  dashboard: DashboardOverviewResponse
  activityRows: { id: string; createdAt: string; title: string; subtitle: string; amount: number; variant: 'info' | 'success' | 'warning' }[]
  onNavigateToInventory: () => void
  onNavigateToNewSale: () => void
  onNavigateToVentaRapida: () => void
  onNavigateToProducts: () => void
  onNavigateToPurchases: () => void
  onNavigateToUsers: () => void
  onNavigateToReports: () => void
  onNavigateToCashier: () => void
  onNavigateToActivity: () => void
}

function DashboardEmptyState({
  icon: Icon,
  title,
  subtitle,
  ctaLabel,
  onCta,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle: string
  ctaLabel?: string
  onCta?: () => void
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 p-6 text-center sm:p-8">
      <Icon className="h-8 w-8 text-muted-foreground/50" />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
      {ctaLabel && onCta ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-1 h-8 text-xs"
          onClick={onCta}
        >
          {ctaLabel}
        </Button>
      ) : null}
    </div>
  )
}

function CompanyDashboardContent({
  greetingName,
  dateLabel,
  timeLabel,
  isLoading,
  error,
  dashboard,
  activityRows,
  onNavigateToInventory,
  onNavigateToNewSale,
  onNavigateToVentaRapida,
  onNavigateToProducts,
  onNavigateToPurchases,
  onNavigateToUsers,
  onNavigateToReports,
  onNavigateToCashier,
  onNavigateToActivity,
}: CompanyDashboardContentProps) {
  const activeDrawer = dashboard.cash.activeDrawer
  const isTablet =
    typeof window !== 'undefined' &&
    window.matchMedia('(min-width: 768px) and (max-width: 1279px)').matches
  const lowStockSlice = isTablet ? 3 : 5
  const expiringLotsSlice = isTablet ? 3 : 5
  const activitySlice = isTablet ? 4 : 6

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-14">
        <Loader className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive sm:p-4">
          {error}
        </div>
      ) : null}

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0 space-y-0.5">
          <p className="text-base font-semibold text-foreground sm:text-lg">
            ¡Hola, {greetingName}!
          </p>
          <p className="text-sm text-muted-foreground">
            Resumen de la operación de tu botica
          </p>
          <p className="mt-0.5 hidden text-[11px] text-muted-foreground md:block">
            Rayego POS · Control diario de farmacia
          </p>
        </div>
        <div className="flex flex-col items-start gap-0.5 sm:items-end">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CalendarIcon className="h-4 w-4 text-primary" />
            <span className="capitalize">{dateLabel}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{timeLabel}</span>
          </div>
        </div>
      </section>

      <section className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-semibold">Ventas de hoy</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShoppingCart className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-bold text-foreground sm:text-3xl">
              {formatCurrency(dashboard.sales.todayTotal)}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span>{dashboard.sales.todayCount} ventas</span>
              <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
              <span>Ticket {formatCurrency(dashboard.sales.averageTicket)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-semibold">Estado de caja</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <WalletCards className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-bold text-foreground sm:text-3xl">
              {activeDrawer ? formatCurrency(activeDrawer.expectedAmount) : '—'}
            </p>
            {activeDrawer ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[11px]">
                  <Badge variant="success" className="h-5 px-1.5 text-[10px]">
                    ABIERTA
                  </Badge>
                  <span className="truncate text-muted-foreground">
                    {activeDrawer.cashierName}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Apertura {formatDateTimeShort(activeDrawer.openedAt)}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[11px]">
                <Badge
                  variant="outline"
                  className="h-5 px-1.5 text-[10px] text-muted-foreground"
                >
                  CERRADA
                </Badge>
                <span className="text-muted-foreground">Sin turno</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-semibold">Productos por vencer</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 text-warning">
              <PackageSearch className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-bold text-foreground sm:text-3xl">
              {dashboard.alerts.expiringLotsCount}
            </p>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Próximos 30 días</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={onNavigateToInventory}
              >
                Ver
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[13px] font-semibold">Bajo stock</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <TriangleAlert className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-bold text-foreground sm:text-3xl">
              {dashboard.alerts.lowStockProductsCount}
            </p>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Productos críticos</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={onNavigateToInventory}
              >
                Ver
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {dashboard.alerts.cashClosePending ? (
        <div className="rounded-2xl border border-warning/40 bg-warning/10 p-3 text-sm sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-medium text-warning-foreground">
              Caja pendiente de cierre desde {dashboard.alerts.cashClosePending.openedDateLabel}
            </p>
            <Button type="button" size="sm" onClick={onNavigateToCashier}>
              Ir a Caja
            </Button>
          </div>
        </div>
      ) : null}

      <section className="grid gap-3 grid-cols-1 lg:grid-cols-12">
        <Card className="lg:col-span-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-[15px] font-semibold">
                <TrendingUp className="h-[18px] w-[18px] text-primary" />
                Ventas de los últimos 7 días
              </CardTitle>
              <CardDescription className="text-[11px]">
                Evolución diaria del monto vendido
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Últimos 7 días
            </Badge>
          </CardHeader>
          <CardContent>
            <DashboardEmptyState
              icon={ScrollText}
              title="Histórico de ventas no disponible"
              subtitle="La información detallada de los últimos 7 días se integrará próximamente desde el panel de Reportes. Los datos aparecerán automáticamente cuando existan registros históricos."
              ctaLabel="Ir a Reportes"
              onCta={onNavigateToReports}
            />
          </CardContent>
        </Card>

        <Card className="md:hidden lg:col-span-3 lg:block">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-[15px] font-semibold">
              <ShoppingBag className="h-[18px] w-[18px] text-primary" />
              Ventas por categoría
            </CardTitle>
            <CardDescription className="text-[11px]">
              Desglose por línea de producto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardEmptyState
              icon={Layers}
              title="Sin agrupación disponible"
              subtitle="La distribución por categoría se habilitará en una actualización posterior del Dashboard. Mientras tanto, puedes revisar los reportes de ventas."
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-[15px] font-semibold">
                <Activity className="h-[18px] w-[18px] text-primary" />
                Actividad reciente
              </CardTitle>
              <CardDescription className="text-[11px]">
                Últimos eventos operativos
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-[11px]"
              onClick={onNavigateToActivity}
            >
              Ver todas
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {activityRows.length === 0 ? (
              <DashboardEmptyState
                icon={Activity}
                title="Sin actividad reciente"
                subtitle="Aquí aparecerán las ventas y movimientos de caja a medida que operes en el sistema."
              />
            ) : (
              <ul className="space-y-2">
                {activityRows.slice(0, activitySlice).map((row) => (
                  <li
                    key={row.id}
                    className="flex items-start justify-between gap-3 rounded-xl border p-2.5 sm:p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {row.title}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {row.subtitle}
                      </p>
                      <p className="mt-0.5 hidden text-[11px] text-muted-foreground sm:block">
                        {formatDateTimeShort(row.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant={row.variant}
                        className="h-5 px-1.5 text-[10px]"
                      >
                        {row.variant === 'success'
                          ? 'Venta'
                          : row.amount >= 0
                            ? 'Ingreso'
                            : 'Egreso'}
                      </Badge>
                      <span className="text-xs font-semibold text-foreground">
                        {formatCurrency(row.amount)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-[15px] font-semibold">
                <TriangleAlert className="h-[18px] w-[18px] text-destructive" />
                Productos con bajo stock
              </CardTitle>
              <CardDescription className="text-[11px]">
                Stock actual por debajo del mínimo
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-[11px]"
              onClick={onNavigateToInventory}
            >
              Ver todos
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {dashboard.alerts.lowStockProducts.length === 0 ? (
              <DashboardEmptyState
                icon={TriangleAlert}
                title="Sin productos en stock crítico"
                subtitle="Excelente. Todos tus productos cuentan con stock suficiente para la operación diaria."
              />
            ) : (
              <ul className="space-y-2">
                {dashboard.alerts.lowStockProducts.slice(0, lowStockSlice).map((row) => (
                  <li
                    key={row.productId}
                    className="flex items-center justify-between gap-3 rounded-xl border p-2.5 sm:p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {row.name}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {row.sku ? `${row.sku} · ` : ''}
                        Mínimo {Math.round(row.threshold)} {row.unitSymbol}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                        Crítico
                      </Badge>
                      <span className="text-xs font-semibold text-destructive">
                        {Math.round(row.stockUnits)} {row.unitSymbol}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-[15px] font-semibold">
                <PackageSearch className="h-[18px] w-[18px] text-warning" />
                Productos por vencer
              </CardTitle>
              <CardDescription className="text-[11px]">
                Lotes próximos a fecha de vencimiento
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-[11px]"
              onClick={onNavigateToInventory}
            >
              Ver todos
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {dashboard.alerts.expiringLots.length === 0 ? (
              <DashboardEmptyState
                icon={PackageSearch}
                title="Sin lotes por vencer"
                subtitle="Tu inventario está en buen estado. Sin vencimientos cercanos en el período."
              />
            ) : (
              <ul className="space-y-2">
                {dashboard.alerts.expiringLots.slice(0, expiringLotsSlice).map((lot) => {
                  const days = daysUntil(lot.expiryDate)
                  const isCritical = Number.isFinite(days) && days <= 7
                  return (
                    <li
                      key={lot.id}
                      className="flex items-center justify-between gap-3 rounded-xl border p-2.5 sm:p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {lot.productName}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {lot.branchName} · Lote {lot.lotCode} · Vence {lot.expiryDate}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge
                          variant={isCritical ? 'destructive' : 'warning'}
                          className="h-5 px-1.5 text-[10px]"
                        >
                          {isCritical ? 'Urgente' : 'Próximo'}
                        </Badge>
                        <span
                          className={`text-xs font-semibold ${
                            isCritical ? 'text-destructive' : 'text-warning-foreground'
                          }`}
                        >
                          {Number.isFinite(days)
                            ? days === 0
                              ? 'Vence hoy'
                              : days < 0
                                ? `Vencido ${Math.abs(days)}d`
                                : `${days} días`
                            : '-'}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-label="Acciones rápidas del Dashboard">
        <Card className="border-muted/60 bg-card shadow-softSm">
          <CardHeader className="space-y-1 pb-3">
            <CardTitle className="flex items-center gap-2 text-[14px] font-semibold">
              <Zap className="h-[17px] w-[17px] text-secondary" />
              Acciones rápidas
            </CardTitle>
            <CardDescription className="text-[11px]">
              Atajos para las operaciones más frecuentes de tu botica
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Button
                type="button"
                variant="outline"
                className="justify-start gap-2 h-10 text-[13px]"
                onClick={onNavigateToNewSale}
              >
                <ReceiptText className="h-[18px] w-[18px] shrink-0 text-primary" />
                <span className="truncate text-sm font-medium">Nueva venta</span>
              </Button>

              <Button
                type="button"
                className="justify-start gap-2 h-10 text-[13px] bg-green-600 text-white shadow-md shadow-green-100 hover:bg-green-700 active:scale-[0.98] transition-all duration-200"
                onClick={onNavigateToVentaRapida}
              >
                <Zap className="h-[18px] w-[18px] shrink-0 fill-white/90 text-white" />
                <span className="truncate text-sm font-semibold">Venta rápida</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="justify-start gap-2 h-10 text-[13px] hidden lg:inline-flex"
                onClick={onNavigateToProducts}
              >
                <Plus className="h-[18px] w-[18px] shrink-0 text-primary" />
                <span className="truncate text-sm">Registrar producto</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="justify-start gap-2 h-10 text-[13px] hidden lg:inline-flex"
                onClick={onNavigateToPurchases}
              >
                <PackagePlus className="h-[18px] w-[18px] shrink-0 text-primary" />
                <span className="truncate text-sm">Registrar compra</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="justify-start gap-2 h-10 text-[13px] hidden lg:inline-flex"
                onClick={onNavigateToUsers}
              >
                <Users className="h-[18px] w-[18px] shrink-0 text-primary" />
                <span className="truncate text-sm">Gestionar usuarios</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="justify-start gap-2 h-10 text-[13px] hidden lg:inline-flex"
                onClick={onNavigateToReports}
              >
                <ScrollText className="h-[18px] w-[18px] shrink-0 text-primary" />
                <span className="truncate text-sm">Ver reportes</span>
              </Button>

              <div className="lg:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start gap-2 h-10 text-[13px] border-dashed"
                    >
                      <MoreHorizontal className="h-[18px] w-[18px] shrink-0 text-primary" />
                      <span className="text-sm font-medium">Más acciones</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    sideOffset={6}
                    className="w-[260px]"
                  >
                    <DropdownMenuItem
                      className="gap-2 h-10"
                      onSelect={() => onNavigateToProducts()}
                    >
                      <Plus className="h-[16px] w-[16px] shrink-0 text-primary" />
                      <span className="text-[13px]">Registrar producto</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="gap-2 h-10"
                      onSelect={() => onNavigateToPurchases()}
                    >
                      <PackagePlus className="h-[16px] w-[16px] shrink-0 text-primary" />
                      <span className="text-[13px]">Registrar compra</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="gap-2 h-10"
                      onSelect={() => onNavigateToUsers()}
                    >
                      <Users className="h-[16px] w-[16px] shrink-0 text-primary" />
                      <span className="text-[13px]">Gestionar usuarios</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="gap-2 h-10"
                      onSelect={() => onNavigateToReports()}
                    >
                      <ScrollText className="h-[16px] w-[16px] shrink-0 text-primary" />
                      <span className="text-[13px]">Ver reportes</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
