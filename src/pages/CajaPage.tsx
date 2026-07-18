import {
  BadgeDollarSign,
  CircleDollarSign,
  HandCoins,
  WalletCards,
  ChevronDown,
  MoreVertical,
  Edit,
  History,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Textarea } from '@/components/ui/textarea'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAuth } from '@/hooks/useAuth'
import { cashierService } from '@/services/cashierService'
import type {
  CashDrawerStatus,
  CashMovementType,
  CashierDashboardResponse,
  OpenCashDrawerPayload,
  CloseCashDrawerPayload,
  CreateCashMovementPayload,
} from '@/types/cashier'

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

// Zod schemas for forms
const openCashDrawerSchema = z.object({
  branchId: z.string().min(1, 'Selecciona una sucursal'),
  openingAmount: z
    .number()
    .min(0.01, 'El monto debe ser mayor a 0'),
  observations: z.string().optional(),
})

const closeCashDrawerSchema = z.object({
  openingId: z.string().min(1, 'Selecciona una apertura de caja'),
  countedAmount: z
    .number()
    .min(0, 'El monto debe ser mayor o igual a 0'),
  observations: z.string().optional(),
})

const createCashMovementSchema = z.object({
  openingId: z.string().min(1, 'Selecciona una apertura de caja'),
  type: z.enum(['INGRESO', 'EGRESO']),
  amount: z.number().min(0.01, 'El monto debe ser mayor a 0'),
  concept: z.string().min(1, 'El concepto es obligatorio'),
  reference: z.string().optional(),
  observations: z.string().optional(),
})

type OpenCashDrawerFormValues = z.infer<typeof openCashDrawerSchema>
type CloseCashDrawerFormValues = z.infer<typeof closeCashDrawerSchema>
type CreateCashMovementFormValues = z.infer<typeof createCashMovementSchema>

export function CajaPage() {
  const { session } = useAuth()
  const accessToken = session?.accessToken ?? ''
  const [dashboard, setDashboard] = useState<CashierDashboardResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSummary, setShowSummary] = useState(true)

  // Dialog state
  const [openDrawerDialogOpen, setOpenDrawerDialogOpen] = useState(false)
  const [closeDrawerDialogOpen, setCloseDrawerDialogOpen] = useState(false)
  const [createMovementDialogOpen, setCreateMovementDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Forms
  const openDrawerForm = useForm<OpenCashDrawerFormValues>({
    resolver: zodResolver(openCashDrawerSchema),
    defaultValues: {
      branchId: '',
      openingAmount: 0,
      observations: '',
    },
  })

  const closeDrawerForm = useForm<CloseCashDrawerFormValues>({
    resolver: zodResolver(closeCashDrawerSchema),
    defaultValues: {
      openingId: '',
      countedAmount: 0,
      observations: '',
    },
  })

  const createMovementForm = useForm<CreateCashMovementFormValues>({
    resolver: zodResolver(createCashMovementSchema),
    defaultValues: {
      openingId: '',
      type: 'INGRESO',
      amount: 0,
      concept: '',
      reference: '',
      observations: '',
    },
  })

  const loadDashboard = useCallback(async () => {
    if (!accessToken) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await cashierService.getDashboard(accessToken)
      setDashboard(response)
      
      // Set default openingId in forms
      const activeDrawer = response.cashDrawers.find(d => d.status !== 'CERRADA')
      if (activeDrawer) {
        closeDrawerForm.setValue('openingId', activeDrawer.id)
        createMovementForm.setValue('openingId', activeDrawer.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el dashboard')
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, closeDrawerForm, createMovementForm])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  // Handlers
  const handleOpenDrawer = async (values: OpenCashDrawerFormValues) => {
    if (!accessToken) return
    
    setIsSubmitting(true)
    try {
      await cashierService.openDrawer(accessToken, values as OpenCashDrawerPayload)
      toast.success('Caja abierta exitosamente.')
      setOpenDrawerDialogOpen(false)
      openDrawerForm.reset()
      await loadDashboard()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al abrir la caja.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCloseDrawer = async (values: CloseCashDrawerFormValues) => {
    if (!accessToken) return
    
    setIsSubmitting(true)
    try {
      await cashierService.closeDrawer(accessToken, values as CloseCashDrawerPayload)
      toast.success('Caja cerrada exitosamente.')
      setCloseDrawerDialogOpen(false)
      closeDrawerForm.reset()
      await loadDashboard()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cerrar la caja.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateMovement = async (values: CreateCashMovementFormValues) => {
    if (!accessToken) return
    
    setIsSubmitting(true)
    try {
      await cashierService.createMovement(accessToken, values as CreateCashMovementPayload)
      toast.success('Movimiento creado exitosamente.')
      setCreateMovementDialogOpen(false)
      createMovementForm.reset()
      await loadDashboard()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear el movimiento.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const cashDrawers = dashboard?.cashDrawers ?? []
  const cashMovements = dashboard?.cashMovements ?? []
  const cashPaymentSummary = dashboard?.cashPaymentSummary ?? []
  const dashboardTotals = dashboard?.dashboardTotals ?? {
    totalSales: 0,
    totalInternalMovements: 0,
    pendingCollections: 0,
  }
  const branches = dashboard?.options?.branches ?? []
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
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="font-medium text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-foreground">Caja</h1>
        <Button variant="ghost" size="sm" onClick={() => setShowSummary(!showSummary)}>
          Resumen
          <ChevronDown
            className={`ml-1 h-4 w-4 transition-transform ${
              showSummary ? 'rotate-180' : ''
            }`}
          />
        </Button>
      </div>

      {/* KPIs Section (Collapsible on Mobile) */}
      {showSummary && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <WalletCards className="h-4 w-4 text-primary" />
            <div className="flex flex-col">
              <p className="text-lg font-bold text-foreground">{activeDrawer?.code ?? '-'}</p>
              <p className="text-xs text-muted-foreground">Caja</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <HandCoins className="h-4 w-4 text-success" />
            <div className="flex flex-col">
              <p className="text-lg font-bold text-foreground">{formatCurrency(dashboardTotals.totalSales)}</p>
              <p className="text-xs text-muted-foreground">Ventas</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <BadgeDollarSign className="h-4 w-4 text-info" />
            <div className="flex flex-col">
              <p className="text-lg font-bold text-foreground">{formatCurrency(dashboardTotals.totalInternalMovements)}</p>
              <p className="text-xs text-muted-foreground">Movimientos</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <CircleDollarSign className="h-4 w-4 text-warning" />
            <div className="flex flex-col">
              <p className="text-lg font-bold text-foreground">{formatCurrency(dashboardTotals.pendingCollections)}</p>
              <p className="text-xs text-muted-foreground">Pendiente</p>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="turnos" className="w-full">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="turnos">Turnos</TabsTrigger>
            <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
            <TabsTrigger value="conciliacion">Conciliacion</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="turnos" className="space-y-4 pt-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpenDrawerDialogOpen(true)}
            >
              <HandCoins className="h-4 w-4 mr-1" />
              Registrar fondo
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!activeDrawer || activeDrawer.status === 'CERRADA'}
              onClick={() => {
                if (activeDrawer) {
                  closeDrawerForm.setValue('openingId', activeDrawer.id)
                  closeDrawerForm.setValue('countedAmount', activeDrawer.expectedAmount)
                  setCloseDrawerDialogOpen(true)
                }
              }}
            >
              Cerrar turno
            </Button>
          </div>

          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3">
            {cashDrawers.map((drawer) => (
              <Card key={drawer.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{drawer.code}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {drawer.branchName}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <History className="h-4 w-4 mr-2" />
                            Historial
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 items-center">
                      <Badge variant={getDrawerStatusVariant(drawer.status)}>
                        {drawer.status}
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(drawer.openingAmount)}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop/Tablet Table View */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Caja</TableHead>
                      <TableHead className="hidden lg:table-cell">Sucursal</TableHead>
                      <TableHead className="hidden lg:table-cell">Responsable</TableHead>
                      <TableHead className="hidden md:table-cell">Apertura</TableHead>
                      <TableHead>Esperado</TableHead>
                      <TableHead className="hidden md:table-cell">Contado</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="w-[80px] text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashDrawers.map((drawer) => (
                      <TableRow key={drawer.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{drawer.code}</p>
                            <p className="text-xs text-muted-foreground">
                              fondo {formatCurrency(drawer.openingAmount)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {drawer.branchName}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {drawer.cashierName}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {drawer.openedAt}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {formatCurrency(drawer.expectedAmount)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">
                              {formatCurrency(drawer.countedAmount)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              dif. {formatCurrency(drawer.differenceAmount)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getDrawerStatusVariant(drawer.status)}>
                            {drawer.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <History className="h-4 w-4 mr-2" />
                                Historial
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="movimientos" className="space-y-4 pt-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!activeDrawer || activeDrawer.status === 'CERRADA'}
              onClick={() => {
                if (activeDrawer) {
                  createMovementForm.setValue('openingId', activeDrawer.id)
                  setCreateMovementDialogOpen(true)
                }
              }}
            >
              <HandCoins className="h-4 w-4 mr-1" />
              Nuevo movimiento
            </Button>
          </div>

          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3">
            {cashMovements.map((movement) => (
              <Card key={movement.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{movement.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {movement.createdAt}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <History className="h-4 w-4 mr-2" />
                            Historial
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 items-center">
                      <Badge variant={getMovementVariant(movement.type)}>
                        {movement.type}
                      </Badge>
                      <p className="font-medium text-sm text-foreground">{formatCurrency(movement.amount)}</p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop/Tablet Table View */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Detalle</TableHead>
                      <TableHead className="hidden md:table-cell">Referencia</TableHead>
                      <TableHead className="hidden lg:table-cell">Medio</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead className="w-[80px] text-right">Acciones</TableHead>
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
                            <p className="text-xs text-muted-foreground">
                              {movement.actorName}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {movement.reference}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge variant={movement.paymentMethod === 'INTERNO' ? 'outline' : 'info'}>
                            {movement.paymentMethod}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {formatCurrency(movement.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <History className="h-4 w-4 mr-2" />
                                Historial
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="conciliacion" className="space-y-4 pt-4">
          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3">
            {cashPaymentSummary.map((row) => {
              const difference = row.collectedAmount - row.salesAmount

              return (
                <Card key={row.method} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{row.method}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {row.operations} operaciones
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 items-center">
                        <p className="text-sm text-muted-foreground">Ventas: {formatCurrency(row.salesAmount)}</p>
                        <p className="text-sm text-muted-foreground">Cobrado: {formatCurrency(row.collectedAmount)}</p>
                        <Badge variant={difference === 0 ? 'success' : 'warning'}>
                          {formatCurrency(difference)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Desktop/Tablet Table View */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medio</TableHead>
                      <TableHead>Ventas</TableHead>
                      <TableHead>Cobrado</TableHead>
                      <TableHead className="hidden lg:table-cell">Operaciones</TableHead>
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
                          <TableCell className="hidden lg:table-cell text-muted-foreground">
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
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}

      {/* Open Cash Drawer Dialog */}
      <Dialog open={openDrawerDialogOpen} onOpenChange={setOpenDrawerDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Registrar fondo (Apertura de caja)</DialogTitle>
            <DialogDescription>
              Registra el monto de apertura para una caja.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={openDrawerForm.handleSubmit(handleOpenDrawer)} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="branchId"
                className="text-xs font-medium text-foreground"
              >
                Sucursal
              </label>
              <Select
                onValueChange={(value) => openDrawerForm.setValue('branchId', value)}
                defaultValue={openDrawerForm.getValues('branchId')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una sucursal" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {openDrawerForm.formState.errors.branchId ? (
                <p className="text-xs text-destructive">
                  {openDrawerForm.formState.errors.branchId.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="openingAmount"
                className="text-xs font-medium text-foreground"
              >
                Monto de apertura
              </label>
              <Input
                id="openingAmount"
                type="number"
                step="0.01"
                {...openDrawerForm.register('openingAmount', {
                  valueAsNumber: true,
                })}
              />
              {openDrawerForm.formState.errors.openingAmount ? (
                <p className="text-xs text-destructive">
                  {openDrawerForm.formState.errors.openingAmount.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="observations"
                className="text-xs font-medium text-foreground"
              >
                Observaciones (opcional)
              </label>
              <Textarea
                id="observations"
                placeholder="Agrega observaciones si es necesario..."
                {...openDrawerForm.register('observations')}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpenDrawerDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} size="sm">
                {isSubmitting ? (
                  <>
                    <Loader className="h-4 w-4 text-current mr-2" />
                    Guardando...
                  </>
                ) : (
                  'Abrir caja'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Close Cash Drawer Dialog */}
      <Dialog open={closeDrawerDialogOpen} onOpenChange={setCloseDrawerDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Cerrar turno (Cierre de caja)</DialogTitle>
            <DialogDescription>
              Registra el monto contado y cierra la caja.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={closeDrawerForm.handleSubmit(handleCloseDrawer)} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="openingId"
                className="text-xs font-medium text-foreground"
              >
                Apertura de caja
              </label>
              <Select
                onValueChange={(value) => closeDrawerForm.setValue('openingId', value)}
                value={closeDrawerForm.getValues('openingId')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una apertura de caja" />
                </SelectTrigger>
                <SelectContent>
                  {cashDrawers
                    .filter((d) => d.status !== 'CERRADA')
                    .map((drawer) => (
                      <SelectItem key={drawer.id} value={drawer.id}>
                        {drawer.code} - {drawer.branchName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {closeDrawerForm.formState.errors.openingId ? (
                <p className="text-xs text-destructive">
                  {closeDrawerForm.formState.errors.openingId.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="countedAmount"
                className="text-xs font-medium text-foreground"
              >
                Monto contado
              </label>
              <Input
                id="countedAmount"
                type="number"
                step="0.01"
                {...closeDrawerForm.register('countedAmount', {
                  valueAsNumber: true,
                })}
              />
              {closeDrawerForm.formState.errors.countedAmount ? (
                <p className="text-xs text-destructive">
                  {closeDrawerForm.formState.errors.countedAmount.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="observations"
                className="text-xs font-medium text-foreground"
              >
                Observaciones (opcional)
              </label>
              <Textarea
                id="observations"
                placeholder="Agrega observaciones si es necesario..."
                {...closeDrawerForm.register('observations')}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCloseDrawerDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} size="sm">
                {isSubmitting ? (
                  <>
                    <Loader className="h-4 w-4 text-current mr-2" />
                    Guardando...
                  </>
                ) : (
                  'Cerrar caja'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Cash Movement Dialog */}
      <Dialog open={createMovementDialogOpen} onOpenChange={setCreateMovementDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Movimiento manual de caja</DialogTitle>
            <DialogDescription>
              Registra un ingreso o egreso manual en la caja.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createMovementForm.handleSubmit(handleCreateMovement)} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="openingId"
                className="text-xs font-medium text-foreground"
              >
                Apertura de caja
              </label>
              <Select
                onValueChange={(value) => createMovementForm.setValue('openingId', value)}
                value={createMovementForm.getValues('openingId')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una apertura de caja" />
                </SelectTrigger>
                <SelectContent>
                  {cashDrawers
                    .filter((d) => d.status !== 'CERRADA')
                    .map((drawer) => (
                      <SelectItem key={drawer.id} value={drawer.id}>
                        {drawer.code} - {drawer.branchName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {createMovementForm.formState.errors.openingId ? (
                <p className="text-xs text-destructive">
                  {createMovementForm.formState.errors.openingId.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="type"
                className="text-xs font-medium text-foreground"
              >
                Tipo de movimiento
              </label>
              <Select
                onValueChange={(value) => createMovementForm.setValue('type', value as 'INGRESO' | 'EGRESO')}
                value={createMovementForm.getValues('type')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INGRESO">Ingreso</SelectItem>
                  <SelectItem value="EGRESO">Egreso</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="amount"
                className="text-xs font-medium text-foreground"
              >
                Monto
              </label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                {...createMovementForm.register('amount', {
                  valueAsNumber: true,
                })}
              />
              {createMovementForm.formState.errors.amount ? (
                <p className="text-xs text-destructive">
                  {createMovementForm.formState.errors.amount.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="concept"
                className="text-xs font-medium text-foreground"
              >
                Concepto
              </label>
              <Input
                id="concept"
                placeholder="Ej: Pago de servicios, gasto de papelería..."
                {...createMovementForm.register('concept')}
              />
              {createMovementForm.formState.errors.concept ? (
                <p className="text-xs text-destructive">
                  {createMovementForm.formState.errors.concept.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="reference"
                className="text-xs font-medium text-foreground"
              >
                Referencia (opcional)
              </label>
              <Input
                id="reference"
                placeholder="Número de factura o referencia..."
                {...createMovementForm.register('reference')}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="observations"
                className="text-xs font-medium text-foreground"
              >
                Observaciones (opcional)
              </label>
              <Textarea
                id="observations"
                placeholder="Agrega observaciones si es necesario..."
                {...createMovementForm.register('observations')}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateMovementDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} size="sm">
                {isSubmitting ? (
                  <>
                    <Loader className="h-4 w-4 text-current mr-2" />
                    Guardando...
                  </>
                ) : (
                  'Registrar movimiento'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
