import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BadgeCheck,
  ChevronLeft,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  History,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Wrench,
  X,
  Zap,
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
import { SidePanel, SidePanelClose, SidePanelContent } from '@/components/ui/side-panel'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { AuthorizationGate } from '@/components/auth/AuthorizationGate'
import { useAuth } from '@/hooks/useAuth'
import { useHandleUnauthorized } from '@/hooks/useHandleUnauthorized'
import { ApiError, ApiNetworkError } from '@/services/apiClient'
import { rtService } from '@/services/rtService'
import type {
  OrdenServicio,
  EstadoOrdenServicio,
  OrdenItem,
  OrdenPago,
  DiagnosticoOrden,
  PresupuestoOrden,
  EstadoHistorialOrden,
  AsignacionTecnicoOrden,
  GarantiaOrden,
} from '@/types/rayegotech'
import { toast } from 'sonner'

function formatFecha(value?: string | Date | null) {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
function formatMoneda(value?: number | null) {
  const n = Number(value ?? 0)
  return `S/ ${n.toFixed(2)}`
}
function estadoBadgeVariant(estado: EstadoOrdenServicio | string):
  | 'default'
  | 'success'
  | 'warning'
  | 'info'
  | 'destructive'
  | 'outline' {
  switch (estado) {
    case 'ENTREGADA':
      return 'success'
    case 'ANULADA':
      return 'destructive'
    case 'EN_REPARACION':
    case 'EN_DIAGNOSTICO':
      return 'warning'
    case 'PENDIENTE_APROBACION_PRESUPUESTO':
    case 'PRESUPUESTO_APROBADO':
      return 'info'
    default:
      return 'default'
  }
}

export function OrdenesServicioPage() {
  const { session } = useAuth()
  const accessToken = session?.accessToken ?? ''
  const handleUnauthorized = useHandleUnauthorized('OrdenesServicioPage')

  useEffect(() => {
    document.title = 'Órdenes de Servicio · RayegoTech'
  }, [])

  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<'TODOS' | EstadoOrdenServicio>('TODOS')
  const [ordenes, setOrdenes] = useState<OrdenServicio[]>([])
  const [ordenesLoading, setOrdenesLoading] = useState(false)
  const [selectedOrden, setSelectedOrden] = useState<OrdenServicio | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerTab, setDrawerTab] = useState<
    | 'resumen'
    | 'diagnosticos'
    | 'presupuestos'
    | 'items'
    | 'pagos'
    | 'historial'
    | 'garantia'
  >('resumen')
  const [isRefreshLoading, setIsRefreshLoading] = useState(false)

  const loadOrdenes = useCallback(async () => {
    if (!accessToken) return
    try {
      setOrdenesLoading(true)
      const res = await rtService.listOrdenes({
        estado: estadoFilter === 'TODOS' ? undefined : estadoFilter,
        search: search.trim() || undefined,
      })
      setOrdenes(res.items || [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await handleUnauthorized()
        return
      }
      if (!(err instanceof ApiNetworkError) && !(err instanceof ApiError)) throw err
      toast.error(getApiErrorMessage(err))
    } finally {
      setOrdenesLoading(false)
    }
  }, [accessToken, handleUnauthorized, estadoFilter, search])

  useEffect(() => {
    void loadOrdenes()
  }, [loadOrdenes])

  async function refreshSelected(id?: string) {
    if (!id) return
    try {
      setIsRefreshLoading(true)
      const res = await rtService.getOrden(id)
      setSelectedOrden(res.item)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await handleUnauthorized()
        return
      }
      toast.error(getApiErrorMessage(err))
    } finally {
      setIsRefreshLoading(false)
    }
  }

  const visibleOrdenes = useMemo(() => {
    return ordenes
  }, [ordenes])

  function openOrden(os: OrdenServicio) {
    setSelectedOrden(os)
    setDrawerTab('resumen')
    setIsDrawerOpen(true)
  }

  function onDrawerOpenChange(open: boolean) {
    setIsDrawerOpen(open)
    if (!open) {
      setTimeout(() => setSelectedOrden(null), 250)
    }
  }

  // ========== Acciones Rápidas botones (permiso ordenesServicio.cambioEstado / aprobar) ==========

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Órdenes de Servicio
          </h1>
          <p className="text-sm text-muted-foreground">
            Taller · Recepción, diagnóstico, presupuestos, reparación, pagos y entrega.
          </p>
        </div>
        <AuthorizationGate permission="ordenesServicio.write" fallback={null}>
          <Button
            size="xl"
            className="min-h-[48px]"
            onClick={() => toast.info('Crear Orden de Servicio · Drawer próximo paso.')}
          >
            <Plus className="mr-2 h-5 w-5" /> Nueva OS
          </Button>
        </AuthorizationGate>
      </div>

      <AuthorizationGate permission="ordenesServicio.read">
        <Card>
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" /> Bandeja de Órdenes
              </CardTitle>
              <CardDescription>
                Gestiona el ciclo de vida completo del Servicio Técnico.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="xl"
              className="min-h-[48px]"
              onClick={() => void loadOrdenes()}
              disabled={ordenesLoading}
            >
              <RefreshCw className={`mr-2 h-5 w-5 ${ordenesLoading ? 'animate-spin' : ''}`} /> Actualizar
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por N° OS, cliente, DNI/RUC, equipo, técnico"
                  className="h-12 pl-9 text-base"
                />
              </div>
              <Select
                value={estadoFilter}
                onValueChange={(v) => setEstadoFilter(v as any)}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos los estados</SelectItem>
                  <SelectItem value="RECEPCIONADA">Receptionada</SelectItem>
                  <SelectItem value="EN_DIAGNOSTICO">En diagnóstico</SelectItem>
                  <SelectItem value="PENDIENTE_APROBACION_PRESUPUESTO">
                    Pend. aprobación
                  </SelectItem>
                  <SelectItem value="PRESUPUESTO_APROBADO">Presupuesto aprobado</SelectItem>
                  <SelectItem value="PRESUPUESTO_RECHAZADO">Presupuesto rechazado</SelectItem>
                  <SelectItem value="EN_REPARACION">En reparación</SelectItem>
                  <SelectItem value="LISTA_ENTREGA">Lista para entrega</SelectItem>
                  <SelectItem value="ENTREGADA">Entregada</SelectItem>
                  <SelectItem value="ANULADA">Anulada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {ordenesLoading ? (
              <div className="flex min-h-56 items-center justify-center rounded-2xl border">
                <Loader className="h-7 w-7" />
              </div>
            ) : visibleOrdenes.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-10 text-center">
                <p className="text-sm font-medium text-foreground">
                  Aún no hay Órdenes de Servicio con los filtros actuales.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Crea la primera desde el botón <b>Nueva OS</b> superior.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° OS</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Equipo</TableHead>
                      <TableHead>Técnico</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Fecha recepción</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleOrdenes.map((os) => (
                      <TableRow
                        key={os.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => openOrden(os)}
                      >
                        <TableCell className="font-mono text-xs font-semibold text-primary">
                          {os.numeroOrden}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="font-medium">
                              {os.cliente?.nombresRazonSocial || '—'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {os.cliente?.numeroDocumento ||
                                (os as any).clienteDocumento ||
                                '—'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p>
                              {os.clienteEquipo?.tipoEquipo?.nombre ||
                                (os.clienteEquipo as any)?.tipoEquipoNombre ||
                                (os as any).equipoResumen ||
                                '—'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {[os.clienteEquipo?.marca, os.clienteEquipo?.modelo]
                                .filter(Boolean)
                                .join(' · ') || '—'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {os.tecnicoAsignado?.usuario
                            ? `${os.tecnicoAsignado.usuario.nombres} ${os.tecnicoAsignado.usuario.apellidos || ''}`.trim()
                            : (os as any).tecnicoNombre ||
                              '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={estadoBadgeVariant(os.estado)}>{os.estado}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatMoneda(os.total ?? 0)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatFecha(os.fechaRecepcion)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="icon-xl"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              openOrden(os)
                            }}
                            className="h-11 w-11"
                          >
                            <ChevronLeft className="rotate-180 h-5 w-5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </AuthorizationGate>

      {/* Drawer Workflow XL 7 tabs */}
      <SidePanel open={isDrawerOpen} onOpenChange={onDrawerOpenChange}>
        <SidePanelContent className="sm:max-w-5xl">
          {selectedOrden ? (
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3 border-b bg-popover px-6 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-lg font-bold text-primary">
                      {selectedOrden.numeroOrden}
                    </p>
                    <Badge variant={estadoBadgeVariant(selectedOrden.estado)}>
                      {selectedOrden.estado}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                    {selectedOrden.cliente?.nombresRazonSocial ||
                      'Cliente —'}
                    {' · '}
                    {formatFecha(selectedOrden.fechaRecepcion)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xl"
                    onClick={() => void refreshSelected(selectedOrden.id)}
                    disabled={isRefreshLoading}
                    className="h-11 w-11"
                  >
                    <RefreshCw
                      className={`h-5 w-5 ${isRefreshLoading ? 'animate-spin' : ''}`}
                    />
                  </Button>
                  <SidePanelClose asChild>
                    <Button type="button" variant="ghost" size="icon-xl" className="h-11 w-11 rounded-xl">
                      <X className="h-5 w-5" />
                    </Button>
                  </SidePanelClose>
                </div>
              </div>

              <Tabs
                value={drawerTab}
                onValueChange={(v) => setDrawerTab(v as any)}
                className="flex-1 flex flex-col min-h-0"
              >
                <div className="overflow-x-auto px-4 pt-3">
                  <TabsList className="w-max">
                    <TabsTrigger value="resumen">
                      <ClipboardList className="mr-1 h-4 w-4" /> Resumen
                    </TabsTrigger>
                    <TabsTrigger value="diagnosticos">
                      <BadgeCheck className="mr-1 h-4 w-4" /> Diagnósticos
                    </TabsTrigger>
                    <TabsTrigger value="presupuestos">
                      <Zap className="mr-1 h-4 w-4" /> Presupuestos
                    </TabsTrigger>
                    <TabsTrigger value="items">
                      <Wrench className="mr-1 h-4 w-4" /> Items / Repuestos
                    </TabsTrigger>
                    <TabsTrigger value="pagos">
                      <CreditCard className="mr-1 h-4 w-4" /> Pagos
                    </TabsTrigger>
                    <TabsTrigger value="historial">
                      <History className="mr-1 h-4 w-4" /> Historial
                    </TabsTrigger>
                    <TabsTrigger value="garantia">
                      <ShieldCheck className="mr-1 h-4 w-4" /> Garantía
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
                  <TabsContent value="resumen" className="mt-0 space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Cliente</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1 text-sm">
                          <p className="font-medium">
                            {selectedOrden.cliente?.nombresRazonSocial ||
                              '—'}
                          </p>
                          <p className="text-muted-foreground">
                            {selectedOrden.cliente?.numeroDocumento ||
                              (selectedOrden as any).clienteDocumento ||
                              '—'}
                          </p>
                          <p className="text-muted-foreground">
                            {selectedOrden.cliente?.telefono ||
                              (selectedOrden as any).clienteTelefono ||
                              '—'}
                          </p>
                          <p className="text-muted-foreground">
                            {selectedOrden.cliente?.email ||
                              (selectedOrden as any).clienteEmail ||
                              '—'}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Equipo</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1 text-sm">
                          <p>
                            Tipo:{' '}
                            <span className="font-medium">
                              {selectedOrden.clienteEquipo?.tipoEquipo?.nombre ||
                                (selectedOrden.clienteEquipo as any)?.tipoEquipoNombre ||
                                '—'}
                            </span>
                          </p>
                          <p>
                            Marca / Modelo:{' '}
                            <span className="text-muted-foreground">
                              {[
                                selectedOrden.clienteEquipo?.marca,
                                selectedOrden.clienteEquipo?.modelo,
                              ]
                                .filter(Boolean)
                                .join(' · ') || '—'}
                            </span>
                          </p>
                          <p>
                            N° Serie:{' '}
                            <span className="text-muted-foreground">
                              {selectedOrden.clienteEquipo?.numeroSerie ||
                                (selectedOrden as any).equipoSerie ||
                                '—'}
                            </span>
                          </p>
                          <p>
                            Estado físico:{' '}
                            <Badge variant="outline">
                              {selectedOrden.clienteEquipo?.estadoFisico || '—'}
                            </Badge>
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Técnico asignado</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1 text-sm">
                          {selectedOrden.asignacionesTecnico?.length ? (
                            (selectedOrden.asignacionesTecnico as AsignacionTecnicoOrden[])
                              .filter((a) => !a.fechaLiberacion)
                              .slice(-1)
                              .map((a) => (
                                <div key={a.id}>
                                  <p className="font-medium">
                                    {a.tecnico?.usuario
                                      ? `${a.tecnico.usuario.nombres} ${a.tecnico.usuario.apellidos || ''}`.trim()
                                      : (a as any).tecnicoNombre || '—'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatFecha(a.fechaAsignacion)}
                                  </p>
                                </div>
                              ))
                          ) : (
                            <p className="text-muted-foreground">Sin asignar</p>
                          )}
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Totales</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span>{formatMoneda(selectedOrden.subTotal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Impuestos</span>
                            <span>{formatMoneda(selectedOrden.igvMonto)}</span>
                          </div>
                          <div className="flex justify-between font-semibold border-t pt-2">
                            <span>Total</span>
                            <span>
                              {formatMoneda(
                                selectedOrden.total ??
                                  (selectedOrden.presupuestos && selectedOrden.presupuestos[selectedOrden.presupuestos.length - 1]?.total) ??
                                  0,
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Abonos</span>
                            <span className="text-emerald-600 font-medium">
                              {formatMoneda(
                                (selectedOrden.pagos || []).reduce(
                                  (sum: number, p) => sum + Number((p as any).monto ?? 0),
                                  0,
                                ),
                              )}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Motivo / Falla reportada</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm whitespace-pre-wrap min-h-[88px]">
                        {selectedOrden.clienteReporto ||
                          selectedOrden.diagnosticoRecepcion ||
                          (selectedOrden as any).fallaReportada ||
                          '—'}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Acciones rápidas</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-wrap gap-3">
                        <AuthorizationGate permission="ordenesServicio.write" fallback={null}>
                          <Button
                            size="xl"
                            onClick={() => {
                              setDrawerTab('diagnosticos')
                              toast.info('Agregar diagnóstico desde pestaña Diagnósticos.')
                            }}
                          >
                            <BadgeCheck className="mr-2 h-5 w-5" /> Registrar diagnóstico
                          </Button>
                        </AuthorizationGate>
                        <AuthorizationGate permission="ordenesServicio.write" fallback={null}>
                          <Button
                            size="xl"
                            variant="secondary"
                            onClick={() => {
                              setDrawerTab('presupuestos')
                              toast.info('Crear presupuesto desde pestaña Presupuestos.')
                            }}
                          >
                            <Zap className="mr-2 h-5 w-5" /> Nuevo presupuesto
                          </Button>
                        </AuthorizationGate>
                        <AuthorizationGate permission="presupuestosOrdenServicio.write" fallback={null}>
                          <Button
                            size="xl"
                            variant="outline"
                            onClick={() =>
                              toast.info('Aprobar presupuesto (presupuestosOrdenServicio.write).')
                            }
                          >
                            <ClipboardCheck className="mr-2 h-5 w-5" /> Aprobar
                          </Button>
                        </AuthorizationGate>
                        <AuthorizationGate
                          permission="ordenesServicio.cambioEstado"
                          fallback={null}
                        >
                          <Button
                            size="xl"
                            variant="ghost"
                            onClick={() =>
                              toast.info('Cambiar estado (Workflow ciclo OS).')
                            }
                          >
                            <History className="mr-2 h-5 w-5" /> Cambiar estado
                          </Button>
                        </AuthorizationGate>
                        <AuthorizationGate
                          permission="pagosOrdenServicio.write"
                          fallback={null}
                        >
                          <Button
                            size="xl"
                            variant="outline"
                            onClick={() => {
                              setDrawerTab('pagos')
                              toast.info('Registrar pago desde pestaña Pagos.')
                            }}
                          >
                            <CreditCard className="mr-2 h-5 w-5" /> Registrar pago
                          </Button>
                        </AuthorizationGate>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="diagnosticos" className="mt-0 space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Diagnósticos</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {!selectedOrden.diagnosticos?.length ? (
                          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                            Sin diagnósticos registrados.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {(selectedOrden.diagnosticos as DiagnosticoOrden[]).map((d) => (
                              <div
                                key={d.id}
                                className="rounded-xl border p-4 space-y-2"
                              >
                                <div className="flex justify-between gap-2">
                                  <Badge variant="info">
                                    {d.usuario
                                      ? `${d.usuario.nombres} ${d.usuario.apellidos || ''}`.trim()
                                      : (d as any).tecnicoNombre ||
                                        'Técnico'}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {formatFecha(d.fechaDiagnostico)}
                                  </span>
                                </div>
                                <Textarea
                                  readOnly
                                  className="min-h-[80px] bg-muted/30"
                                  value={
                                    d.detalle
                                      ? `${d.resumen}\n\n${d.detalle}`
                                      : d.resumen || ''
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="presupuestos" className="mt-0 space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Presupuestos</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {!selectedOrden.presupuestos?.length ? (
                          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                            Sin presupuestos registrados.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {(selectedOrden.presupuestos as PresupuestoOrden[]).map((p) => (
                              <div
                                key={p.id}
                                className="rounded-xl border p-4 space-y-2"
                              >
                                <div className="flex flex-wrap justify-between gap-2">
                                  <Badge
                                    variant={
                                      p.estado === 'APROBADO_CLIENTE'
                                        ? 'success'
                                        : p.estado === 'RECHAZADO_CLIENTE'
                                          ? 'destructive'
                                          : 'info'
                                    }
                                  >
                                    {p.estado}
                                  </Badge>
                                  <div className="text-xs text-muted-foreground">
                                    {formatFecha(p.fechaCreacion)}
                                  </div>
                                </div>
                                <div className="grid gap-2 text-sm md:grid-cols-3">
                                  <div>
                                    <p className="text-muted-foreground">Mano obra</p>
                                    <p className="font-medium">
                                      {formatMoneda(p.montoManoObra)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Repuestos est.</p>
                                    <p className="font-medium">
                                      {formatMoneda(p.montoRepuestos)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Total</p>
                                    <p className="font-semibold">
                                      {formatMoneda(p.total)}
                                    </p>
                                  </div>
                                </div>
                                {p.descripcion ? (
                                  <Textarea
                                    readOnly
                                    className="min-h-[70px] bg-muted/30"
                                    value={p.descripcion}
                                  />
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="items" className="mt-0 space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Items (Repuestos / Mano de Obra)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {!selectedOrden.items?.length ? (
                          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                            Sin items registrados en la Orden.
                          </div>
                        ) : (
                          <div className="overflow-hidden rounded-xl border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Tipo</TableHead>
                                  <TableHead>Concepto</TableHead>
                                  <TableHead className="text-right">Cant.</TableHead>
                                  <TableHead className="text-right">P. Unit</TableHead>
                                  <TableHead className="text-right">Subtotal</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(selectedOrden.items as OrdenItem[]).map((it) => (
                                  <TableRow key={it.id}>
                                    <TableCell>
                                      <Badge variant="outline">{it.tipo}</Badge>
                                    </TableCell>
                                    <TableCell>
                                      {it.producto?.nombre ||
                                        it.descripcion ||
                                        'Concepto'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {it.cantidad}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {formatMoneda(it.precioUnitario)}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                      {formatMoneda(it.subtotal)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="pagos" className="mt-0 space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Pagos</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {!selectedOrden.pagos?.length ? (
                          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                            Sin pagos registrados.
                          </div>
                        ) : (
                          <div className="overflow-hidden rounded-xl border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Fecha</TableHead>
                                  <TableHead>Método</TableHead>
                                  <TableHead>Referencia</TableHead>
                                  <TableHead className="text-right">Monto</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(selectedOrden.pagos as OrdenPago[]).map((p) => (
                                  <TableRow key={p.id}>
                                    <TableCell className="text-xs text-muted-foreground">
                                      {formatFecha(p.fechaPago)}
                                    </TableCell>
                                    <TableCell>{p.formaPago?.nombre || p.formaPagoId || '—'}</TableCell>
                                    <TableCell>{p.referencia || '—'}</TableCell>
                                    <TableCell className="text-right font-semibold text-emerald-600">
                                      {formatMoneda(p.monto)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="historial" className="mt-0 space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Historial de estados</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {!selectedOrden.historialEstados?.length ? (
                          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                            Sin movimientos.
                          </div>
                        ) : (
                          <ol className="relative border-s border-muted pl-6 space-y-4">
                            {(selectedOrden.historialEstados as EstadoHistorialOrden[])
                              .slice()
                              .sort(
                                (a, b) =>
                                  new Date(a.fechaCambio).getTime() -
                                  new Date(b.fechaCambio).getTime(),
                              )
                              .map((h) => (
                                <li key={h.id} className="ms-2">
                                  <div className="absolute -start-1.5 mt-1 h-3 w-3 rounded-full bg-primary" />
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant={estadoBadgeVariant(h.estadoNuevo)}>
                                      {h.estadoNuevo}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {formatFecha(h.fechaCambio)}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      ·{' '}
                                      {h.usuario?.nombres
                                        ? `${h.usuario.nombres} ${h.usuario.apellidos || ''}`.trim()
                                        : (h as any).usuarioNombre ||
                                          'Sistema'}
                                    </span>
                                  </div>
                                  {h.observaciones ? (
                                    <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
                                      {h.observaciones}
                                    </p>
                                  ) : null}
                                </li>
                              ))}
                          </ol>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="garantia" className="mt-0 space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-emerald-600" /> Garantía
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {!selectedOrden.garantia ? (
                          <div className="rounded-xl border border-dashed p-6 text-center text-sm">
                            <p className="font-medium text-foreground">Sin garantía</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Se genera automáticamente al marcar la OS como{' '}
                              <b>ENTREGADA</b>.
                            </p>
                          </div>
                        ) : (
                          <GarantiaCard g={selectedOrden.garantia as GarantiaOrden} />
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          ) : (
            <div className="flex min-h-[300px] items-center justify-center p-6">
              <Loader className="h-8 w-8" />
            </div>
          )}
        </SidePanelContent>
      </SidePanel>
    </div>
  )
}

function GarantiaCard({ g }: { g: GarantiaOrden }) {
  const vence = g.fechaFin ? new Date(g.fechaFin) : null
  const hoy = new Date()
  const vencida = vence ? vence < hoy : false
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-xl border p-4">
        <p className="text-xs text-muted-foreground">Inicio</p>
        <p className="mt-1 font-medium">{formatFecha(g.fechaInicio)}</p>
      </div>
      <div className="rounded-xl border p-4">
        <p className="text-xs text-muted-foreground">Vence</p>
        <p className="mt-1 font-medium">{formatFecha(g.fechaFin)}</p>
      </div>
      <div className="rounded-xl border p-4">
        <p className="text-xs text-muted-foreground">Estado</p>
        <p className="mt-1">
          <Badge variant={vencida ? 'destructive' : 'success'}>
            {vencida ? 'Vencida' : g.estado || 'Vigente'}
          </Badge>
        </p>
      </div>
      {g.terminos ? (
        <div className="md:col-span-3 rounded-xl border p-4">
          <p className="text-xs text-muted-foreground mb-1">Condiciones / cobertura</p>
          <Textarea readOnly className="min-h-[80px] bg-muted/30" value={g.terminos} />
        </div>
      ) : null}
    </div>
  )
}

function getApiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message || `Error ${err.status}`
  }
  if (err instanceof ApiNetworkError) return 'Sin conexión con el servidor.'
  if (err instanceof Error) return err.message
  return 'Ocurrió un error inesperado.'
}
