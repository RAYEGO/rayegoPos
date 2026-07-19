import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  ChevronDown,
  LineChart,
  PackageOpen,
  ReceiptText,
  Truck,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/useAuth'
import { ApiError, ApiNetworkError } from '@/services/apiClient'
import { reportsService } from '@/services/reportsService'
import type { ReportsOverviewResponse } from '@/types/reports'
import { toast } from 'sonner'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(value)
}

const defaultReport: ReportsOverviewResponse = {
  period: {
    from: '',
    to: '',
  },
  summary: {
    salesTotal: 0,
    salesCount: 0,
    averageTicket: 0,
    purchasesCount: 0,
    purchasesOutstanding: 0,
    expiringLotsCount: 0,
  },
  sales: {
    recent: [],
    byDay: [],
    byPaymentMethod: [],
  },
  purchases: [],
  inventory: {
    expiringLots: [],
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

  return 'No fue posible cargar los reportes.'
}

export function ReportesPage() {
  const { logout, session } = useAuth()
  const accessToken = session?.accessToken ?? ''

  const [showSummary, setShowSummary] = useState(false)
  const [branchId, setBranchId] = useState<string>('all')
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [report, setReport] = useState<ReportsOverviewResponse>(defaultReport)
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

    try {
      const response = await reportsService.getOverview(accessToken, {
        branchId: branchId === 'all' ? undefined : branchId,
        from: from.trim() ? from : undefined,
        to: to.trim() ? to : undefined,
      })
      setReport(response)
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorized()
        return
      }

      setReport(defaultReport)
      setError(getApiErrorMessage(nextError))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, branchId, from, handleUnauthorized, to])

  useEffect(() => {
    void loadReport()
  }, [loadReport])

  const branches = report.options.branches
  const summary = report.summary

  const supplierRanking = useMemo(() => {
    const rankingMap = new Map<
      string,
      { supplierName: string; pending: number; total: number; operations: number }
    >()

    for (const row of report.purchases) {
      const current = rankingMap.get(row.supplierName) ?? {
        supplierName: row.supplierName,
        pending: 0,
        total: 0,
        operations: 0,
      }
      current.pending += row.pending
      current.total += row.total
      current.operations += 1
      rankingMap.set(row.supplierName, current)
    }

    return Array.from(rankingMap.values()).sort((a, b) => b.total - a.total).slice(0, 10)
  }, [report.purchases])

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-foreground">Reportes</h1>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="h-9 w-[220px]">
              <SelectValue placeholder="Sucursal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las sucursales</SelectItem>
              {branches.map((branch) => (
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

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[220px_220px_1fr]">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Desde</p>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Hasta</p>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Periodo: {report.period.from || '—'} → {report.period.to || '—'}
            </p>
            <Button type="button" size="sm" variant="outline" onClick={loadReport}>
              Actualizar
            </Button>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader className="h-7 w-7" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {showSummary && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">
                {formatCurrency(summary.salesTotal)}
              </span>
              <span className="text-xs text-muted-foreground">Ventas</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <PackageOpen className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">
                {summary.expiringLotsCount}
              </span>
              <span className="text-xs text-muted-foreground">Lotes por vencer</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Ventas</CardTitle>
            <CardDescription>Operacion comercial consolidada.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-display text-foreground">
              {formatCurrency(summary.salesTotal)}
            </p>
            <p className="text-small text-muted-foreground">
              {summary.salesCount} ventas · ticket {formatCurrency(summary.averageTicket)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventario</CardTitle>
            <CardDescription>Stock disponible y riesgo.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-display text-foreground">{summary.expiringLotsCount}</p>
            <p className="text-small text-muted-foreground">
              lotes por vencer en el horizonte operativo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compras</CardTitle>
            <CardDescription>Ordenes y saldos con proveedor.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-display text-foreground">{formatCurrency(summary.purchasesOutstanding)}</p>
            <p className="text-small text-muted-foreground">
              {summary.purchasesCount} compras en el periodo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Caja</CardTitle>
            <CardDescription>Recaudación por medio (periodo).</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-display text-foreground">{report.sales.byPaymentMethod.length}</p>
            <p className="text-small text-muted-foreground">
              medios con movimiento
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
                    {report.sales.recent.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium text-foreground">
                          {sale.document ?? '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {sale.customerName ?? 'Cliente'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {sale.issuedAt.slice(0, 10)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {sale.itemCount}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {formatCurrency(sale.total)}
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
                  Ventas por dia
                </CardTitle>
                <CardDescription>
                  Tendencia diaria (solo dias con movimientos en el periodo).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.sales.byDay.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-6 text-center">
                    <p className="text-sm text-muted-foreground">Sin ventas en el periodo.</p>
                  </div>
                ) : (
                  report.sales.byDay.map((row) => (
                    <div key={row.date} className="rounded-2xl border p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-foreground">{row.date}</p>
                          <p className="mt-1 text-small text-muted-foreground">
                            {row.operations} operaciones
                          </p>
                        </div>
                        <Badge variant="info">{formatCurrency(row.total)}</Badge>
                      </div>
                    </div>
                  ))
                )}
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.inventory.expiringLots.slice(0, 12).map((row) => (
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
                          {Math.round(row.availableUnits)} {row.unitSymbol}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.expiryDate}
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
                      <TableHead>Monto</TableHead>
                      <TableHead>Operaciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.sales.byPaymentMethod.map((item) => (
                      <TableRow key={item.method}>
                        <TableCell>
                          <Badge variant="outline">{item.method}</Badge>
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {formatCurrency(item.amount)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{item.operations}</TableCell>
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
                  Compras del periodo
                </CardTitle>
                <CardDescription>
                  Estado y saldos pendientes por proveedor.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Pendiente</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.purchases.map((purchase) => (
                      <TableRow key={purchase.id}>
                        <TableCell className="text-muted-foreground">
                          {purchase.supplierName}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {formatCurrency(purchase.total)}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {formatCurrency(purchase.pending)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              purchase.status === 'PAGADA'
                                ? 'success'
                                : purchase.status === 'ANULADA'
                                  ? 'destructive'
                                  : purchase.status === 'BORRADOR'
                                    ? 'warning'
                                    : 'info'
                            }
                          >
                            {purchase.status}
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
                  Ranking por monto en el periodo (total y pendiente).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {supplierRanking.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-6 text-center">
                    <p className="text-sm text-muted-foreground">Sin compras en el periodo.</p>
                  </div>
                ) : (
                  supplierRanking.map((supplier) => (
                    <div key={supplier.supplierName} className="rounded-2xl border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-foreground">{supplier.supplierName}</p>
                          <p className="mt-1 text-small text-muted-foreground">
                            {supplier.operations} compras · pendiente {formatCurrency(supplier.pending)}
                          </p>
                        </div>
                        <Badge variant="info">{formatCurrency(supplier.total)}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
