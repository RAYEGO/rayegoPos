import {
  BadgeDollarSign,
  CircleDollarSign,
  HandCoins,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
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
import { Loader } from '@/components/ui/loader'
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
import { cashierService } from '@/services/cashierService'
import type { CashDrawerStatus, CashMovementType, CashierDashboardResponse } from '@/types/cashier'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(value)
}

function getDrawerStatusVariant(status: CashDrawerStatus) {
  if (status === 'ABIERTA') return 'success'
  if (status === 'EN_CIERRE') return 'warning'
  return 'outline'
}

function getMovementVariant(type: CashMovementType) {
  if (type === 'VENTA' || type === 'INGRESO_MANUAL') return 'success'
  if (type === 'CUADRE') return 'info'
  return 'warning'
}

export function CajaPage() {
  const { logout, session } = useAuth()
  const accessToken = session?.accessToken ?? ''
  const [dashboard, setDashboard] = useState<CashierDashboardResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    if (!accessToken) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await cashierService.getDashboard(accessToken)
      setDashboard(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el dashboard')
    } finally {
      setIsLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const cashDrawers = dashboard?.cashDrawers ?? []
  const cashMovements = dashboard?.cashMovements ?? []
  const cashPaymentSummary = dashboard?.cashPaymentSummary ?? []
  const dashboardTotals = dashboard?.dashboardTotals ?? {
    totalSales: 0,
    totalInternalMovements: 0,
    pendingCollections: 0,
  }
  const activeDrawer = cashDrawers.find((drawer) => drawer.status !== 'CERRADA') ?? cashDrawers[0]

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader className="h-10 w-10" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="font-medium text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Caja" />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>Control diario de caja</CardTitle>
            <CardDescription>
              Apertura, recaudacion, movimientos internos y cierre conectados con ventas.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Caja activa
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {activeDrawer?.code ?? '-'}
              </p>
              <p className="text-small text-muted-foreground">{activeDrawer?.branchName ?? '-'}</p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Ventas emitidas
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {formatCurrency(dashboardTotals.totalSales)}
              </p>
              <p className="text-small text-muted-foreground">integradas desde ventas</p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Movimientos internos
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {formatCurrency(dashboardTotals.totalInternalMovements)}
              </p>
              <p className="text-small text-muted-foreground">ingresos y egresos manuales</p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Pendiente de cobro
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {formatCurrency(dashboardTotals.pendingCollections)}
              </p>
              <p className="text-small text-muted-foreground">ventas aun no conciliadas</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estado actual</CardTitle>
            <CardDescription>
              Lectura rapida para apertura, cuadre y cierre operativo del turno.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Cajero responsable</p>
              <p className="mt-1 text-small text-muted-foreground">
                {activeDrawer?.cashierName ?? '-'} · apertura {activeDrawer?.openedAt ?? '-'}
              </p>
            </div>
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Fondo inicial</p>
              <p className="mt-1 text-small text-muted-foreground">
                {formatCurrency(activeDrawer?.openingAmount ?? 0)} para operaciones del turno.
              </p>
            </div>
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Resultado preliminar</p>
              <p className="mt-1 text-small text-muted-foreground">
                esperado {formatCurrency(activeDrawer?.expectedAmount ?? 0)} · contado {formatCurrency(activeDrawer?.countedAmount ?? 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="turnos">
        <TabsList className="grid w-full grid-cols-3 lg:w-fit">
          <TabsTrigger value="turnos">Turnos</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="conciliacion">Conciliacion</TabsTrigger>
        </TabsList>

        <TabsContent value="turnos" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <WalletCards className="h-5 w-5 text-primary" />
                  Apertura y cierre de caja
                </CardTitle>
                <CardDescription>
                  Seguimiento del turno por sucursal, operador y resultado de cuadre.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm">
                  <HandCoins className="h-4 w-4" />
                  Registrar fondo
                </Button>
                <Button type="button" size="sm">
                  Cerrar turno
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Caja</TableHead>
                    <TableHead>Sucursal</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead>Apertura</TableHead>
                    <TableHead>Esperado</TableHead>
                    <TableHead>Contado</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashDrawers.map((drawer) => (
                    <TableRow key={drawer.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{drawer.code}</p>
                          <p className="text-small text-muted-foreground">
                            fondo {formatCurrency(drawer.openingAmount)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {drawer.branchName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {drawer.cashierName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {drawer.openedAt}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {formatCurrency(drawer.expectedAmount)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">
                            {formatCurrency(drawer.countedAmount)}
                          </p>
                          <p className="text-small text-muted-foreground">
                            dif. {formatCurrency(drawer.differenceAmount)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getDrawerStatusVariant(drawer.status)}>
                          {drawer.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movimientos" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BadgeDollarSign className="h-5 w-5 text-primary" />
                  Libro de movimientos
                </CardTitle>
                <CardDescription>
                  Ingresos por venta, egresos, retiros y cuadre de turno en una sola vista.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Detalle</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead>Medio</TableHead>
                      <TableHead>Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashMovements.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell className="text-muted-foreground">
                          {movement.createdAt}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getMovementVariant(movement.type)}>
                            {movement.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{movement.description}</p>
                            <p className="text-small text-muted-foreground">
                              {movement.actorName}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {movement.reference}
                        </TableCell>
                        <TableCell>
                          <Badge variant={movement.paymentMethod === 'INTERNO' ? 'outline' : 'info'}>
                            {movement.paymentMethod}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {formatCurrency(movement.amount)}
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
                  Alertas de control
                </CardTitle>
                <CardDescription>
                  Señales operativas para revisar antes de aprobar el cierre.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Diferencia en caja</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    El turno activo muestra una diferencia de {formatCurrency(activeDrawer?.differenceAmount ?? 0)} frente al esperado.
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Venta pendiente</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Hay comprobantes pendientes de cobro por {formatCurrency(dashboardTotals.pendingCollections)}.
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Movimientos manuales</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Todo ingreso o egreso interno debe quedar sustentado antes del cierre final.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="conciliacion" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CircleDollarSign className="h-5 w-5 text-primary" />
                  Conciliacion por medio de pago
                </CardTitle>
                <CardDescription>
                  Comparacion entre ventas registradas y dinero efectivamente recibido.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medio</TableHead>
                      <TableHead>Ventas</TableHead>
                      <TableHead>Cobrado</TableHead>
                      <TableHead>Operaciones</TableHead>
                      <TableHead>Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashPaymentSummary.map((row) => {
                      const difference = row.collectedAmount - row.salesAmount

                      return (
                        <TableRow key={row.method}>
                          <TableCell>
                            <Badge variant="outline">{row.method}</Badge>
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {formatCurrency(row.salesAmount)}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {formatCurrency(row.collectedAmount)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.operations}
                          </TableCell>
                          <TableCell>
                            <Badge variant={difference === 0 ? 'success' : 'warning'}>
                              {formatCurrency(difference)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Reglas de cierre
                </CardTitle>
                <CardDescription>
                  Checklist minimo antes de confirmar el cuadre de caja.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Validar ventas emitidas</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Revisar que todas las ventas del turno tengan medio de pago y comprobante conciliado.
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Sustentar diferencias</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Toda diferencia entre esperado y contado debe quedar observada o resuelta.
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Cerrar con trazabilidad</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    El cierre debe registrar responsable, hora, monto final y movimientos internos.
                  </p>
                </div>
                <Button type="button" className="w-full">
                  Aprobar cierre de caja
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
