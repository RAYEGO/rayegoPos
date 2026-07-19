import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Boxes,
  ShoppingCart,
  SlidersHorizontal,
  Users,
  WalletCards,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useAuth } from '@/hooks/useAuth'
import { ApiError, ApiNetworkError } from '@/services/apiClient'
import { reportsService } from '@/services/reportsService'
import type {
  CashierReportResponse,
  InventoryReportResponse,
  PlaceholderReportResponse,
  PurchasesReportResponse,
  ReportsCategory,
  SalesReportResponse,
} from '@/types/reports'
import { toast } from 'sonner'

type ReportPayload =
  | SalesReportResponse
  | PurchasesReportResponse
  | InventoryReportResponse
  | CashierReportResponse
  | PlaceholderReportResponse

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(value)
}

function getApiErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof ApiNetworkError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'No fue posible cargar los reportes.'
}

const categories: Array<{
  key: ReportsCategory
  label: string
  Icon: typeof BarChart3
}> = [
  { key: 'VENTAS', label: 'Ventas', Icon: ShoppingCart },
  { key: 'COMPRAS', label: 'Compras', Icon: BarChart3 },
  { key: 'INVENTARIO', label: 'Inventario', Icon: Boxes },
  { key: 'CAJA', label: 'Caja', Icon: WalletCards },
  { key: 'CLIENTES', label: 'Clientes', Icon: Users },
  { key: 'PRODUCTOS', label: 'Productos', Icon: Boxes },
  { key: 'UTILIDADES', label: 'Utilidades', Icon: BarChart3 },
]

export function ReportesPage() {
  const { logout, session } = useAuth()
  const accessToken = session?.accessToken ?? ''

  const [category, setCategory] = useState<ReportsCategory>('VENTAS')
  const [branchId, setBranchId] = useState<string>('all')
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  const [report, setReport] = useState<ReportPayload | null>(null)
  const [branches, setBranches] = useState<Array<{ id: string; nombre: string; codigo: string }>>(
    [],
  )
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleUnauthorized = useCallback(async () => {
    toast.error('Tu sesión ya no es válida. Ingresa nuevamente para continuar.')
    await logout()
  }, [logout])

  const loadReport = useCallback(async () => {
    if (!accessToken) {
      return
    }

    setIsLoading(true)
    setError(null)

    const filters = {
      branchId: branchId === 'all' ? undefined : branchId,
      from: from.trim() ? from : undefined,
      to: to.trim() ? to : undefined,
    }

    try {
      const response = await (async () => {
        switch (category) {
          case 'VENTAS':
            return reportsService.getSales(accessToken, filters)
          case 'COMPRAS':
            return reportsService.getPurchases(accessToken, filters)
          case 'INVENTARIO':
            return reportsService.getInventory(accessToken, filters)
          case 'CAJA':
            return reportsService.getCashier(accessToken, filters)
          case 'CLIENTES':
            return reportsService.getCustomers(accessToken, filters)
          case 'PRODUCTOS':
            return reportsService.getProducts(accessToken, filters)
          case 'UTILIDADES':
            return reportsService.getUtilities(accessToken, filters)
          default:
            return reportsService.getSales(accessToken, filters)
        }
      })()

      setReport(response)
      setBranches(response.options.branches)
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorized()
        return
      }

      setReport(null)
      setError(getApiErrorMessage(nextError))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, branchId, category, from, handleUnauthorized, to])

  useEffect(() => {
    void loadReport()
  }, [loadReport])

  const selectedCategoryLabel = useMemo(
    () => categories.find((item) => item.key === category)?.label ?? 'Reportes',
    [category],
  )

  const periodLabel = useMemo(() => {
    if (!report) return null
    if ('period' in report && report.period) {
      return `${report.period.from} → ${report.period.to}`
    }
    if ('horizon' in report && report.horizon) {
      return `horizonte hasta ${report.horizon.until}`
    }
    return null
  }, [report])

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground">Reportes</h1>
          <p className="text-xs text-muted-foreground">{selectedCategoryLabel}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="md:hidden">
            <Select value={category} onValueChange={(value) => setCategory(value as ReportsCategory)}>
              <SelectTrigger className="h-9 w-[200px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((item) => (
                  <SelectItem key={item.key} value={item.key}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowFilters((current) => !current)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <div className="hidden md:block">
          <Card>
            <CardHeader>
              <CardTitle>Categorías</CardTitle>
              <CardDescription>Selecciona un reporte.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {categories.map(({ key, label, Icon }) => (
                <Button
                  key={key}
                  type="button"
                  variant={category === key ? 'primary' : 'outline'}
                  className="w-full justify-start gap-2"
                  onClick={() => setCategory(key)}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {showFilters ? (
            <Card className="p-4">
              <div className="grid gap-3 md:grid-cols-[220px_220px_220px_1fr]">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Sucursal</p>
                  <Select value={branchId} onValueChange={setBranchId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Sucursal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Desde</p>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Hasta</p>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>

                <div className="flex items-end justify-between gap-3">
                  <p className="text-xs text-muted-foreground">Periodo: {periodLabel ?? '—'}</p>
                  <Button type="button" size="sm" onClick={loadReport}>
                    Actualizar
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader className="h-7 w-7" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {report ? (
            <>
              {category === 'VENTAS' && 'summary' in report && 'charts' in report ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground">Ventas</p>
                      <p className="mt-2 text-xl font-bold text-foreground">
                        {formatCurrency((report as SalesReportResponse).summary.salesTotal)}
                      </p>
                    </Card>
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground">Operaciones</p>
                      <p className="mt-2 text-xl font-bold text-foreground">
                        {(report as SalesReportResponse).summary.salesCount}
                      </p>
                    </Card>
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground">Ticket promedio</p>
                      <p className="mt-2 text-xl font-bold text-foreground">
                        {formatCurrency((report as SalesReportResponse).summary.averageTicket)}
                      </p>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Ventas recientes</CardTitle>
                      <CardDescription>Últimas operaciones del periodo.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="md:hidden space-y-3">
                        {(report as SalesReportResponse).recent.map((sale) => (
                          <div key={sale.id} className="rounded-2xl border p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">
                                  {sale.document ?? 'Venta'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {sale.customerName ?? 'Mostrador'} · {sale.issuedAt.slice(0, 10)}
                                </p>
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {sale.itemCount} items · {sale.receiptType}
                                </p>
                              </div>
                              <p className="font-medium text-foreground">
                                {formatCurrency(sale.total)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="hidden md:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Comprobante</TableHead>
                              <TableHead>Cliente</TableHead>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Items</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(report as SalesReportResponse).recent.map((sale) => (
                              <TableRow key={sale.id}>
                                <TableCell className="font-medium text-foreground">
                                  {sale.document ?? '—'}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {sale.customerName ?? 'Mostrador'}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {sale.issuedAt.slice(0, 10)}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {sale.itemCount}
                                </TableCell>
                                <TableCell className="text-right font-medium text-foreground">
                                  {formatCurrency(sale.total)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : null}

              {category === 'COMPRAS' && 'rows' in report && 'period' in report ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="mt-2 text-xl font-bold text-foreground">
                        {formatCurrency((report as PurchasesReportResponse).summary.purchasesTotal)}
                      </p>
                    </Card>
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground">Pendiente</p>
                      <p className="mt-2 text-xl font-bold text-foreground">
                        {formatCurrency(
                          (report as PurchasesReportResponse).summary.purchasesOutstanding,
                        )}
                      </p>
                    </Card>
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground">Compras</p>
                      <p className="mt-2 text-xl font-bold text-foreground">
                        {(report as PurchasesReportResponse).summary.purchasesCount}
                      </p>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Compras del periodo</CardTitle>
                      <CardDescription>Últimas órdenes registradas.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="md:hidden space-y-3">
                        {(report as PurchasesReportResponse).rows.map((purchase) => (
                          <div key={purchase.id} className="rounded-2xl border p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">
                                  {purchase.supplierName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {purchase.issuedAt.slice(0, 10)} · {purchase.status}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-foreground">
                                  {formatCurrency(purchase.total)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  pend. {formatCurrency(purchase.pending)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="hidden md:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Proveedor</TableHead>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Total</TableHead>
                              <TableHead>Pendiente</TableHead>
                              <TableHead>Estado</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(report as PurchasesReportResponse).rows.map((purchase) => (
                              <TableRow key={purchase.id}>
                                <TableCell className="font-medium text-foreground">
                                  {purchase.supplierName}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {purchase.issuedAt.slice(0, 10)}
                                </TableCell>
                                <TableCell className="font-medium text-foreground">
                                  {formatCurrency(purchase.total)}
                                </TableCell>
                                <TableCell className="font-medium text-foreground">
                                  {formatCurrency(purchase.pending)}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{purchase.status}</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : null}

              {category === 'INVENTARIO' && 'horizon' in report && 'rows' in report ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground">Por vencer</p>
                      <p className="mt-2 text-xl font-bold text-foreground">
                        {(report as InventoryReportResponse).summary.expiringLotsCount}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        hasta {(report as InventoryReportResponse).horizon.until}
                      </p>
                    </Card>
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground">Bajo stock</p>
                      <p className="mt-2 text-xl font-bold text-foreground">
                        {(report as InventoryReportResponse).summary.lowStockProductsCount}
                      </p>
                    </Card>
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground">Horizonte</p>
                      <p className="mt-2 text-xl font-bold text-foreground">
                        {(report as InventoryReportResponse).horizon.days} días
                      </p>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Riesgo operativo</CardTitle>
                      <CardDescription>Lotes por vencer y productos con bajo stock.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-foreground">Lotes por vencer</p>
                        {(report as InventoryReportResponse).rows.expiringLots.length === 0 ? (
                          <div className="rounded-2xl border border-dashed p-6 text-center">
                            <p className="text-sm text-muted-foreground">Sin lotes por vencer.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {(report as InventoryReportResponse).rows.expiringLots.slice(0, 12).map((lot) => (
                              <div key={lot.id} className="rounded-2xl border p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate font-medium text-foreground">{lot.productName}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {lot.branchName} · {lot.lotCode} · vence {lot.expiryDate}
                                    </p>
                                  </div>
                                  <p className="font-medium text-foreground">
                                    {Math.round(lot.availableUnits)} {lot.unitSymbol}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <p className="text-sm font-medium text-foreground">Productos con bajo stock</p>
                        {(report as InventoryReportResponse).rows.lowStockProducts.length === 0 ? (
                          <div className="rounded-2xl border border-dashed p-6 text-center">
                            <p className="text-sm text-muted-foreground">Sin productos bajo stock.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {(report as InventoryReportResponse).rows.lowStockProducts.slice(0, 12).map((row) => (
                              <div key={row.productId} className="rounded-2xl border p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate font-medium text-foreground">{row.name}</p>
                                    <p className="text-xs text-muted-foreground">{row.sku}</p>
                                  </div>
                                  <p className="font-medium text-foreground">
                                    {Math.round(row.stockUnits)} / {Math.round(row.threshold)} {row.unitSymbol}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : null}

              {category === 'CAJA' && 'rows' in report && 'period' in report ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-5">
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground">Ingreso</p>
                      <p className="mt-2 text-xl font-bold text-foreground">
                        {formatCurrency((report as CashierReportResponse).summary.inflows)}
                      </p>
                    </Card>
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground">Egreso</p>
                      <p className="mt-2 text-xl font-bold text-foreground">
                        {formatCurrency((report as CashierReportResponse).summary.outflows)}
                      </p>
                    </Card>
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground">Neto</p>
                      <p className="mt-2 text-xl font-bold text-foreground">
                        {formatCurrency((report as CashierReportResponse).summary.net)}
                      </p>
                    </Card>
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground">Turnos</p>
                      <p className="mt-2 text-xl font-bold text-foreground">
                        {(report as CashierReportResponse).summary.openingsCount}
                      </p>
                    </Card>
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground">Arqueos</p>
                      <p className="mt-2 text-xl font-bold text-foreground">
                        {(report as CashierReportResponse).summary.cashCountsCount}
                      </p>
                    </Card>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Por medio de pago</CardTitle>
                        <CardDescription>Ingresos y egresos acumulados.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {(report as CashierReportResponse).rows.byPaymentMethod.length === 0 ? (
                          <div className="rounded-2xl border border-dashed p-6 text-center">
                            <p className="text-sm text-muted-foreground">Sin movimientos.</p>
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Medio</TableHead>
                                <TableHead className="text-right">Ingreso</TableHead>
                                <TableHead className="text-right">Egreso</TableHead>
                                <TableHead className="text-right">Neto</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(report as CashierReportResponse).rows.byPaymentMethod.map((row) => (
                                <TableRow key={row.method}>
                                  <TableCell>
                                    <Badge variant="outline">{row.method}</Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-medium text-foreground">
                                    {formatCurrency(row.inflows)}
                                  </TableCell>
                                  <TableCell className="text-right font-medium text-foreground">
                                    {formatCurrency(row.outflows)}
                                  </TableCell>
                                  <TableCell className="text-right font-medium text-foreground">
                                    {formatCurrency(row.net)}
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
                        <CardTitle>Turnos</CardTitle>
                        <CardDescription>Aperturas del periodo.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="md:hidden space-y-3">
                          {(report as CashierReportResponse).rows.openings.map((opening) => (
                            <div key={opening.id} className="rounded-2xl border p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-foreground">
                                    {opening.cashDrawerCode} · {opening.branchName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {opening.openedAt.slice(0, 10)} · {opening.cashierName}
                                  </p>
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    fondo {formatCurrency(opening.openingCash)}
                                  </p>
                                </div>
                                <Badge variant="outline">{opening.status}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="hidden md:block">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Caja</TableHead>
                                <TableHead>Sucursal</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Responsable</TableHead>
                                <TableHead>Estado</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(report as CashierReportResponse).rows.openings.map((opening) => (
                                <TableRow key={opening.id}>
                                  <TableCell className="font-medium text-foreground">
                                    {opening.cashDrawerCode}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">{opening.branchName}</TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {opening.openedAt.slice(0, 10)}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">{opening.cashierName}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{opening.status}</Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Arqueos de efectivo</CardTitle>
                      <CardDescription>
                        Conteos físicos registrados durante el turno.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {(report as CashierReportResponse).rows.cashCounts.length === 0 ? (
                        <div className="rounded-2xl border border-dashed p-6 text-center">
                          <p className="text-sm text-muted-foreground">Sin arqueos en el periodo.</p>
                        </div>
                      ) : (
                        <>
                          <div className="md:hidden space-y-3">
                            {(report as CashierReportResponse).rows.cashCounts.map((row) => (
                              <div key={row.id} className="rounded-2xl border p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate font-medium text-foreground">
                                      {row.cashDrawerCode} · {row.branchName}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {row.createdAt.slice(0, 10)} · {row.actorName}
                                    </p>
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      esperado {formatCurrency(row.expectedCashAmount)} · contado{' '}
                                      {formatCurrency(row.countedCashAmount)}
                                    </p>
                                    {row.observations ? (
                                      <p className="mt-2 text-xs text-muted-foreground">
                                        {row.observations}
                                      </p>
                                    ) : null}
                                  </div>
                                  <Badge variant={row.differenceCashAmount === 0 ? 'success' : 'warning'}>
                                    {formatCurrency(row.differenceCashAmount)}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="hidden md:block">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Fecha</TableHead>
                                  <TableHead>Caja</TableHead>
                                  <TableHead>Sucursal</TableHead>
                                  <TableHead>Responsable</TableHead>
                                  <TableHead className="text-right">Esperado</TableHead>
                                  <TableHead className="text-right">Contado</TableHead>
                                  <TableHead className="text-right">Diferencia</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(report as CashierReportResponse).rows.cashCounts.map((row) => (
                                  <TableRow key={row.id}>
                                    <TableCell className="text-muted-foreground">
                                      {row.createdAt.slice(0, 10)}
                                    </TableCell>
                                    <TableCell className="font-medium text-foreground">
                                      {row.cashDrawerCode}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {row.branchName}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {row.cashierName}
                                    </TableCell>
                                    <TableCell className="text-right font-medium text-foreground">
                                      {formatCurrency(row.expectedCashAmount)}
                                    </TableCell>
                                    <TableCell className="text-right font-medium text-foreground">
                                      {formatCurrency(row.countedCashAmount)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Badge
                                        variant={row.differenceCashAmount === 0 ? 'success' : 'warning'}
                                      >
                                        {formatCurrency(row.differenceCashAmount)}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : null}

              {category === 'CLIENTES' || category === 'PRODUCTOS' || category === 'UTILIDADES' ? (
                <Card>
                  <CardHeader>
                    <CardTitle>En desarrollo</CardTitle>
                    <CardDescription>Este reporte se habilitará en la siguiente fase.</CardDescription>
                  </CardHeader>
                </Card>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
