import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3,
  Boxes,
  Calendar,
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
import { useHandleUnauthorized } from '@/hooks/useHandleUnauthorized'
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

type ReportPayload =
  | SalesReportResponse
  | PurchasesReportResponse
  | InventoryReportResponse
  | CashierReportResponse
  | PlaceholderReportResponse

type SalesPeriodPreset = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'CUSTOM'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(value)
}

function pad2(value: number) {
  return value < 10 ? `0${value}` : `${value}`
}

function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function fmtDate(iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    if (iso.length >= 10) {
      const [y, m, d] = iso.slice(0, 10).split('-')
      return `${d}/${m}/${y}`
    }
    return iso
  }
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`
}

function fmtTime(iso: string): string {
  if (!iso) return '—'
  if (iso.length >= 16 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso.slice(0, 16))) {
    return iso.slice(11, 16)
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

function titleCaseMethod(value: string): string {
  if (!value) return '—'
  const v = value.trim()
  if (!v) return '—'
  if (v.length <= 4) return v.toUpperCase()
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase()
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
  const { session } = useAuth()
  const accessToken = session?.accessToken ?? ''

  const [category, setCategory] = useState<ReportsCategory>('VENTAS')
  const [branchId, setBranchId] = useState<string>('all')
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)
  const [salesPeriodPreset, setSalesPeriodPreset] = useState<SalesPeriodPreset>('TODAY')
  const salesPeriodPresetRef = useRef<SalesPeriodPreset>('TODAY')

  const [report, setReport] = useState<ReportPayload | null>(null)
  const [branches, setBranches] = useState<Array<{ id: string; nombre: string; codigo: string }>>(
    [],
  )
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleUnauthorized = useHandleUnauthorized('ReportesPage')

  useEffect(() => {
    const today = startOfDay(new Date())
    const preset: SalesPeriodPreset = 'TODAY'
    salesPeriodPresetRef.current = preset
    setSalesPeriodPreset(preset)
    setFrom(toDateInput(today))
    setTo(toDateInput(today))
  }, [])

  const applySalesPeriodPreset = useCallback((next: SalesPeriodPreset) => {
    const today = startOfDay(new Date())
    if (next === 'CUSTOM') {
      salesPeriodPresetRef.current = next
      setSalesPeriodPreset(next)
      setShowFilters(true)
      return
    }
    let fromDate = today
    let toDate = today
    if (next === 'TODAY') {
      fromDate = today
      toDate = today
    } else if (next === 'YESTERDAY') {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      fromDate = yesterday
      toDate = yesterday
    } else if (next === 'LAST_7_DAYS') {
      const past = new Date(today)
      past.setDate(past.getDate() - 6)
      fromDate = past
      toDate = today
    } else if (next === 'THIS_MONTH') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1)
      fromDate = first
      toDate = today
    }
    salesPeriodPresetRef.current = next
    setSalesPeriodPreset(next)
    setFrom(toDateInput(fromDate))
    setTo(toDateInput(toDate))
  }, [])

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
    if (category !== 'VENTAS') return
    if (salesPeriodPresetRef.current === 'CUSTOM') return
    const preset = salesPeriodPresetRef.current
    const today = startOfDay(new Date())
    let fromDate = today
    let toDate = today
    if (preset === 'TODAY') {
      fromDate = today
      toDate = today
    } else if (preset === 'YESTERDAY') {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      fromDate = yesterday
      toDate = yesterday
    } else if (preset === 'LAST_7_DAYS') {
      const past = new Date(today)
      past.setDate(past.getDate() - 6)
      fromDate = past
      toDate = today
    } else if (preset === 'THIS_MONTH') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1)
      fromDate = first
      toDate = today
    }
    const nextFrom = toDateInput(fromDate)
    const nextTo = toDateInput(toDate)
    if (nextFrom !== from || nextTo !== to) {
      setFrom(nextFrom)
      setTo(nextTo)
    }
  }, [category, from, to])

  useEffect(() => {
    if (category !== 'VENTAS') return
    if (salesPeriodPresetRef.current === 'CUSTOM') return
    setSalesPeriodPreset('CUSTOM')
    salesPeriodPresetRef.current = 'CUSTOM'
  }, [category, from, to])

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

  const salesPeriodDisplayLabel = useMemo(() => {
    const fallbackFrom = from ? fmtDate(from) : null
    const fallbackTo = to ? fmtDate(to) : null
    const periodInResponse =
      report && 'period' in report && report.period
        ? { from: fmtDate(report.period.from), to: fmtDate(report.period.to) }
        : null
    const labelFrom = periodInResponse?.from ?? fallbackFrom
    const labelTo = periodInResponse?.to ?? fallbackTo
    if (!labelFrom && !labelTo) return 'Período actual'
    if (labelFrom === labelTo) return labelFrom ?? 'Período actual'
    return `${labelFrom} — ${labelTo}`
  }, [from, report, to])

  const salesMetrics = useMemo(() => {
    if (!report || !('summary' in report) || !('recent' in report) || category !== 'VENTAS') {
      return null
    }
    const summary = (report as SalesReportResponse).summary
    const recent = (report as SalesReportResponse).recent
    const unitsSold = recent.reduce((acc, s) => acc + (s.itemCount ?? 0), 0)
    return {
      salesTotal: summary.salesTotal,
      salesCount: summary.salesCount,
      averageTicket: summary.averageTicket,
      unitsSold,
      methods: (report as SalesReportResponse).charts?.byPaymentMethod ?? [],
    }
  }, [category, report])

  return (
    <div className="space-y-4 p-4">
      {category === 'VENTAS' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" aria-hidden />
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                  Reporte de ventas
                </h1>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Resumen de las ventas realizadas en el período seleccionado.
              </p>
              <p className="mt-2 inline-flex items-center gap-2 rounded-full border bg-muted/30 px-3 py-1 text-xs font-medium text-foreground">
                <Calendar className="h-3.5 w-3.5 text-primary" aria-hidden />
                Período: <span className="text-primary">{salesPeriodDisplayLabel}</span>
              </p>
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

          <div className="flex flex-wrap items-stretch gap-2">
            {([
              ['TODAY', 'Hoy'],
              ['YESTERDAY', 'Ayer'],
              ['LAST_7_DAYS', 'Últimos 7 días'],
              ['THIS_MONTH', 'Este mes'],
              ['CUSTOM', 'Personalizado'],
            ] as Array<[SalesPeriodPreset, string]>).map(([preset, label]) => {
              const isActive = salesPeriodPreset === preset
              return (
                <Button
                  key={preset}
                  type="button"
                  variant={isActive ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => applySalesPeriodPreset(preset)}
                >
                  {label}
                </Button>
              )
            })}
          </div>
        </div>
      ) : (
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
      )}

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
              {category === 'VENTAS' && salesMetrics ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground">Total vendido</p>
                      <p className="mt-2 text-xl font-bold text-foreground">
                        {formatCurrency(salesMetrics.salesTotal)}
                      </p>
                    </Card>
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground">N.º de ventas</p>
                      <p className="mt-2 text-xl font-bold text-foreground">
                        {salesMetrics.salesCount}
                      </p>
                    </Card>
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground">Ticket promedio</p>
                      <p className="mt-2 text-xl font-bold text-foreground">
                        {formatCurrency(salesMetrics.averageTicket)}
                      </p>
                    </Card>
                    <Card className="p-4">
                      <p className="text-xs text-muted-foreground">Unidades vendidas</p>
                      <p className="mt-2 text-xl font-bold text-foreground">
                        {salesMetrics.unitsSold}
                      </p>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Métodos de pago</CardTitle>
                      <CardDescription>
                        Distribución de ingresos en el período seleccionado.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {salesMetrics.methods.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Sin datos de métodos de pago para el período seleccionado.
                        </p>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {salesMetrics.methods.map((row) => (
                            <div
                              key={row.method}
                              className="rounded-xl border p-4"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-medium text-muted-foreground">
                                  {titleCaseMethod(row.method)}
                                </p>
                                <Badge variant="outline">{row.operations}</Badge>
                              </div>
                              <p className="mt-3 text-lg font-bold text-foreground">
                                {formatCurrency(row.amount)}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                operación{row.operations === 1 ? '' : 'es'}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Ventas del período</CardTitle>
                      <CardDescription>
                        Detalle de las ventas realizadas durante el período seleccionado.
                      </CardDescription>
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
                                  {sale.customerName ?? 'Mostrador'} · {fmtDate(sale.issuedAt)}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Hora: {fmtTime(sale.issuedAt)}
                                </p>
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {sale.itemCount} ítems · {sale.receiptType}
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
                              <TableHead>Hora</TableHead>
                              <TableHead>Ítems</TableHead>
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
                                  {fmtDate(sale.issuedAt)}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {fmtTime(sale.issuedAt)}
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
                  <Card>
                    <CardHeader>
                      <CardTitle>Resumen del turno</CardTitle>
                      <CardDescription>
                        Dinero físico de caja. El vuelto no se cuenta como ingreso ni egreso manual.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                        <div className="rounded-2xl border p-4">
                          <p className="text-xs text-muted-foreground">Apertura</p>
                          <p className="mt-2 text-xl font-bold text-foreground">
                            {formatCurrency(
                              (report as CashierReportResponse).summary.turnover.openingCash,
                            )}
                          </p>
                        </div>
                        <div className="rounded-2xl border p-4">
                          <p className="text-xs text-muted-foreground">Ventas en efectivo</p>
                          <p className="mt-2 text-xl font-bold text-emerald-600 dark:text-emerald-500">
                            +{' '}
                            {formatCurrency(
                              (report as CashierReportResponse).summary.turnover.salesCashNet,
                            )}
                          </p>
                        </div>
                        <div className="rounded-2xl border p-4">
                          <p className="text-xs text-muted-foreground">Ingresos adicionales</p>
                          <p className="mt-2 text-xl font-bold text-sky-600 dark:text-sky-500">
                            +{' '}
                            {formatCurrency(
                              (report as CashierReportResponse).summary.turnover.manualIncomes,
                            )}
                          </p>
                        </div>
                        <div className="rounded-2xl border p-4">
                          <p className="text-xs text-muted-foreground">Egresos / retiros</p>
                          <p className="mt-2 text-xl font-bold text-rose-600 dark:text-rose-500">
                            −{' '}
                            {formatCurrency(
                              (report as CashierReportResponse).summary.turnover.manualExpenses,
                            )}
                          </p>
                        </div>
                        <div className="rounded-2xl border p-4 bg-muted/40">
                          <p className="text-xs text-muted-foreground">Efectivo esperado</p>
                          <p className="mt-2 text-xl font-bold text-foreground">
                            {formatCurrency(
                              (report as CashierReportResponse).summary.turnover.expectedCash,
                            )}
                          </p>
                        </div>
                        <div className="rounded-2xl border p-4 bg-muted/40">
                          <p className="text-xs text-muted-foreground">Efectivo contado</p>
                          <p className="mt-2 text-xl font-bold text-foreground">
                            {formatCurrency(
                              (report as CashierReportResponse).summary.turnover.countedCash,
                            )}
                          </p>
                        </div>
                        <div className="rounded-2xl border p-4">
                          <p className="text-xs text-muted-foreground">Diferencia</p>
                          <p className="mt-2">
                            <Badge
                              variant={
                                (report as CashierReportResponse).summary.turnover.difference ===
                                0
                                  ? 'success'
                                  : 'warning'
                              }
                              className="text-base px-3 py-1 rounded-xl"
                            >
                              {formatCurrency(
                                (report as CashierReportResponse).summary.turnover.difference,
                              )}
                            </Badge>
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Ventas por método de pago</CardTitle>
                        <CardDescription>
                          Importe neto vendido por cada método. Total del período:{' '}
                          <span className="font-semibold text-foreground">
                            {formatCurrency(
                              (report as CashierReportResponse).summary.turnover.totalSales,
                            )}
                          </span>
                          .
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {(report as CashierReportResponse).rows.salesByPaymentMethod.length ===
                        0 ? (
                          <div className="rounded-2xl border border-dashed p-6 text-center">
                            <p className="text-sm text-muted-foreground">Sin ventas en el período.</p>
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Método</TableHead>
                                <TableHead className="text-right">Operaciones</TableHead>
                                <TableHead className="text-right">Vendido</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(report as CashierReportResponse).rows.salesByPaymentMethod.map(
                                (row) => (
                                  <TableRow key={row.method}>
                                    <TableCell>
                                      <Badge variant="outline">{titleCaseMethod(row.method)}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground">
                                      {row.operations}
                                    </TableCell>
                                    <TableCell className="text-right font-medium text-foreground">
                                      {formatCurrency(row.soldAmount)}
                                    </TableCell>
                                  </TableRow>
                                ),
                              )}
                              <TableRow className="bg-muted/40 font-semibold">
                                <TableCell>Total</TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {(
                                    report as CashierReportResponse
                                  ).rows.salesByPaymentMethod.reduce(
                                    (sum, r) => sum + r.operations,
                                    0,
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-foreground">
                                  {formatCurrency(
                                    (report as CashierReportResponse).summary.turnover.totalSales,
                                  )}
                                </TableCell>
                              </TableRow>
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
                                  <TableCell className="text-muted-foreground">
                                    {opening.branchName}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {opening.openedAt.slice(0, 10)}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {opening.cashierName}
                                  </TableCell>
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
                                  <Badge
                                    variant={
                                      row.differenceCashAmount === 0 ? 'success' : 'warning'
                                    }
                                  >
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
                                        variant={
                                          row.differenceCashAmount === 0 ? 'success' : 'warning'
                                        }
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
