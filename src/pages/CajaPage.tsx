import {
  BadgeDollarSign,
  CircleDollarSign,
  HandCoins,
  WalletCards,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'
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
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="font-medium text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Caja" />

      <div className="grid gap-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Resumen de turno</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Caja
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {activeDrawer?.code ?? '-'}
              </p>
              <p className="text-xs text-muted-foreground hidden sm:block">{activeDrawer?.branchName ?? '-'}</p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Ventas
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {formatCurrency(dashboardTotals.totalSales)}
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Movimientos
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {formatCurrency(dashboardTotals.totalInternalMovements)}
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Pendiente
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {formatCurrency(dashboardTotals.pendingCollections)}
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpenDrawerDialogOpen(true)}
                >
                  <HandCoins className="h-4 w-4" />
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
          <div className="grid gap-6">
            <Card>
              <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BadgeDollarSign className="h-5 w-5 text-primary" />
                    Movimientos
                  </CardTitle>
                </div>
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
                  <HandCoins className="h-4 w-4" />
                  Nuevo movimiento
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Detalle</TableHead>
                      <TableHead className="hidden md:table-cell">Referencia</TableHead>
                      <TableHead className="hidden md:table-cell">Medio</TableHead>
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
                            <p className="text-xs text-muted-foreground">
                              {movement.actorName}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {movement.reference}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
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
          </div>
        </TabsContent>

        <TabsContent value="conciliacion" className="space-y-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CircleDollarSign className="h-5 w-5 text-primary" />
                  Conciliación
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medio</TableHead>
                      <TableHead>Ventas</TableHead>
                      <TableHead>Cobrado</TableHead>
                      <TableHead className="hidden md:table-cell">Operaciones</TableHead>
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
                          <TableCell className="hidden md:table-cell text-muted-foreground">
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
                className="text-small font-medium text-foreground"
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
                <p className="text-caption text-destructive">
                  {openDrawerForm.formState.errors.branchId.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="openingAmount"
                className="text-small font-medium text-foreground"
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
                <p className="text-caption text-destructive">
                  {openDrawerForm.formState.errors.openingAmount.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="observations"
                className="text-small font-medium text-foreground"
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
                onClick={() => setOpenDrawerDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader className="h-4 w-4 text-current" />
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
                className="text-small font-medium text-foreground"
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
                <p className="text-caption text-destructive">
                  {closeDrawerForm.formState.errors.openingId.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="countedAmount"
                className="text-small font-medium text-foreground"
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
                <p className="text-caption text-destructive">
                  {closeDrawerForm.formState.errors.countedAmount.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="observations"
                className="text-small font-medium text-foreground"
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
                onClick={() => setCloseDrawerDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader className="h-4 w-4 text-current" />
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
                className="text-small font-medium text-foreground"
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
                <p className="text-caption text-destructive">
                  {createMovementForm.formState.errors.openingId.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="type"
                className="text-small font-medium text-foreground"
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
                className="text-small font-medium text-foreground"
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
                <p className="text-caption text-destructive">
                  {createMovementForm.formState.errors.amount.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="concept"
                className="text-small font-medium text-foreground"
              >
                Concepto
              </label>
              <Input
                id="concept"
                placeholder="Ej: Pago de servicios, gasto de papelería..."
                {...createMovementForm.register('concept')}
              />
              {createMovementForm.formState.errors.concept ? (
                <p className="text-caption text-destructive">
                  {createMovementForm.formState.errors.concept.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="reference"
                className="text-small font-medium text-foreground"
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
                className="text-small font-medium text-foreground"
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
                onClick={() => setCreateMovementDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader className="h-4 w-4 text-current" />
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
