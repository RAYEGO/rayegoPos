import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  Users,
  ChevronDown,
  MoreVertical,
  Edit,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  PhoneCall,
  UserRoundSearch,
} from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
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
import { ApiError, ApiNetworkError } from '@/services/apiClient'
import { customersService } from '@/services/customersService'
import type {
  CreateCustomerPayload,
  CustomerItem,
  CustomerStatusFilter,
  CustomersDashboardResponse,
} from '@/types/customers'
import { toast } from 'sonner'

const optionalEmailSchema = z
  .string()
  .max(150, 'Máximo 150 caracteres.')
  .refine((value) => value === '' || /\S+@\S+\.\S+/.test(value), 'Ingresa un correo válido.')

const customerFormSchema = z
  .object({
    tipoPersona: z.string().min(1, 'Selecciona el tipo de persona.'),
    tipoDocumento: z.string().optional(),
    numeroDocumento: z.string().max(20).optional(),
    nombres: z.string().max(120).optional(),
    apellidos: z.string().max(120).optional(),
    razonSocial: z.string().max(200).optional(),
    email: optionalEmailSchema,
    telefono: z.string().max(30).optional(),
    direccion: z.string().max(255).optional(),
    ubigeo: z.string().max(6).optional(),
    fechaNacimiento: z.string().optional(),
    observaciones: z.string().max(255).optional(),
    activo: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.tipoPersona === 'JURIDICA') {
      if (!values.razonSocial?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'La razón social es obligatoria.',
          path: ['razonSocial'],
        })
      }
      return
    }

    if (!values.nombres?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Los nombres son obligatorios.',
        path: ['nombres'],
      })
    }
  })

type CustomerFormValues = z.infer<typeof customerFormSchema>

const defaultDashboard: CustomersDashboardResponse = {
  summary: {
    totalCustomers: 0,
    activeCustomers: 0,
    inactiveCustomers: 0,
    withDocument: 0,
    withPhone: 0,
  },
  customers: [],
  options: {
    tiposPersona: [],
    tiposDocumento: [],
  },
}

const defaultFormValues: CustomerFormValues = {
  tipoPersona: '',
  tipoDocumento: '',
  numeroDocumento: '',
  nombres: '',
  apellidos: '',
  razonSocial: '',
  email: '',
  telefono: '',
  direccion: '',
  ubigeo: '',
  fechaNacimiento: '',
  observaciones: '',
  activo: true,
}

function getApiErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof ApiNetworkError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'No fue posible completar la operación.'
}

function getCustomerStatusVariant(isActive: boolean) {
  return isActive ? 'success' : 'outline'
}

function toPayload(values: CustomerFormValues): CreateCustomerPayload {
  return {
    tipoPersona: values.tipoPersona,
    tipoDocumento: values.tipoDocumento?.trim() ? values.tipoDocumento : undefined,
    numeroDocumento: values.numeroDocumento?.trim() || undefined,
    nombres: values.nombres?.trim() || undefined,
    apellidos: values.apellidos?.trim() || undefined,
    razonSocial: values.razonSocial?.trim() || undefined,
    email: values.email?.trim() || undefined,
    telefono: values.telefono?.trim() || undefined,
    direccion: values.direccion?.trim() || undefined,
    ubigeo: values.ubigeo?.trim() || undefined,
    fechaNacimiento: values.fechaNacimiento?.trim() || undefined,
    observaciones: values.observaciones?.trim() || undefined,
  }
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <p className="text-xs text-destructive">{message}</p>
}

export function ClientesPage() {
  const { logout, session } = useAuth()
  const accessToken = session?.accessToken ?? ''

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'todos' | CustomerStatusFilter>('todos')
  const [showSummary, setShowSummary] = useState(true)
  const [dashboard, setDashboard] = useState<CustomersDashboardResponse>(defaultDashboard)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<CustomerItem | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CustomerItem | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: defaultFormValues,
  })

  const formTipoPersona = form.watch('tipoPersona')

  const customerMetrics = useMemo(
    () => ({
      total: dashboard.summary.totalCustomers,
      active: dashboard.summary.activeCustomers,
      withDocument: dashboard.summary.withDocument,
      withPhone: dashboard.summary.withPhone,
    }),
    [dashboard],
  )

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
      const response = await customersService.getDashboard(accessToken, {
        search,
        status: statusFilter === 'todos' ? undefined : statusFilter,
      })
      setDashboard(response)
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorized()
        return
      }

      setError(getApiErrorMessage(nextError))
      setDashboard(defaultDashboard)
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, handleUnauthorized, search, statusFilter])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  function openCreateDialog() {
    setEditingCustomer(null)
    form.reset({
      ...defaultFormValues,
      tipoPersona: dashboard.options.tiposPersona[0] ?? 'NATURAL',
      tipoDocumento: '',
      activo: true,
    })
    setIsDialogOpen(true)
  }

  function openEditDialog(customer: CustomerItem) {
    setEditingCustomer(customer)
    form.reset({
      tipoPersona: customer.tipoPersona,
      tipoDocumento: customer.tipoDocumento ?? '',
      numeroDocumento: customer.numeroDocumento ?? '',
      nombres: customer.nombres ?? '',
      apellidos: customer.apellidos ?? '',
      razonSocial: customer.razonSocial ?? '',
      email: customer.email ?? '',
      telefono: customer.telefono ?? '',
      direccion: customer.direccion ?? '',
      ubigeo: customer.ubigeo ?? '',
      fechaNacimiento: customer.fechaNacimiento ? customer.fechaNacimiento.slice(0, 10) : '',
      observaciones: customer.observaciones ?? '',
      activo: customer.activo,
    })
    setIsDialogOpen(true)
  }

  function openDeleteDialog(customer: CustomerItem) {
    setDeleteTarget(customer)
    setIsDeleteDialogOpen(true)
  }

  async function handleSaveCustomer(values: CustomerFormValues) {
    if (!accessToken) {
      toast.error('La sesión no está disponible.')
      return
    }

    setIsSubmitting(true)

    try {
      const payload = toPayload(values)

      if (editingCustomer) {
        await customersService.update(accessToken, editingCustomer.id, {
          ...payload,
          activo: values.activo,
        })
        toast.success('Cliente actualizado correctamente.')
      } else {
        await customersService.create(accessToken, payload)
        toast.success('Cliente registrado correctamente.')
      }

      setIsDialogOpen(false)
      setEditingCustomer(null)
      form.reset(defaultFormValues)
      await loadDashboard()
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorized()
        return
      }

      toast.error(getApiErrorMessage(nextError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleToggleStatus(customer: CustomerItem) {
    if (!accessToken) {
      toast.error('La sesión no está disponible.')
      return
    }

    try {
      await customersService.update(accessToken, customer.id, {
        activo: !customer.activo,
      })
      toast.success(customer.activo ? 'Cliente desactivado.' : 'Cliente reactivado.')
      await loadDashboard()
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorized()
        return
      }

      toast.error(getApiErrorMessage(nextError))
    }
  }

  async function handleDeleteCustomer() {
    if (!accessToken || !deleteTarget) {
      toast.error('No hay cliente seleccionado para eliminar.')
      return
    }

    setIsDeleting(true)

    try {
      await customersService.remove(accessToken, deleteTarget.id)
      toast.success('Cliente eliminado correctamente.')
      setIsDeleteDialogOpen(false)
      setDeleteTarget(null)
      await loadDashboard()
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorized()
        return
      }

      toast.error(getApiErrorMessage(nextError))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-foreground">Clientes</h1>
        <Button variant="ghost" size="sm" onClick={() => setShowSummary(!showSummary)}>
          Resumen
          <ChevronDown
            className={`ml-1 h-4 w-4 transition-transform ${showSummary ? 'rotate-180' : ''}`}
          />
        </Button>
      </div>

      {showSummary && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{customerMetrics.total}</span>
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <UserRoundSearch className="h-4 w-4 text-info" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{customerMetrics.active}</span>
              <span className="text-xs text-muted-foreground">Activos</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <ShieldAlert className="h-4 w-4 text-warning" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{customerMetrics.withDocument}</span>
              <span className="text-xs text-muted-foreground">Con documento</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <PhoneCall className="h-4 w-4 text-primary" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">
                {customerMetrics.withPhone}
              </span>
              <span className="text-xs text-muted-foreground">Con teléfono</span>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="padron" className="w-full">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="padron">Padrón</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
            <TabsTrigger value="seguimiento">Seguimiento</TabsTrigger>
          </TabsList>
          <Button type="button" size="sm" onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-1" />
            Nuevo cliente
          </Button>
        </div>

        <TabsContent value="padron" className="space-y-4 pt-4">
          <Card className="p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nombre, documento, teléfono o correo"
                  className="pl-9"
                />
              </div>

              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as 'todos' | CustomerStatusFilter)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="activo">Activos</SelectItem>
                  <SelectItem value="inactivo">Inactivos</SelectItem>
                </SelectContent>
              </Select>
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
          ) : dashboard.customers.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="text-sm font-medium text-foreground">
                No hay clientes registrados con los filtros actuales
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Crea el primer cliente para registrar ventas nominativas
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {dashboard.customers.map((customer) => (
                  <Card key={customer.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">
                          {customer.nombreCompleto ?? customer.razonSocial ?? 'Cliente'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {customer.tipoDocumento && customer.numeroDocumento
                            ? `${customer.tipoDocumento} · ${customer.numeroDocumento}`
                            : 'Sin documento'}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(customer)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStatus(customer)}>
                            <ShieldAlert className="mr-2 h-4 w-4" />
                            {customer.activo ? 'Desactivar' : 'Reactivar'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => openDeleteDialog(customer)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{customer.tipoPersona}</Badge>
                      <Badge variant={getCustomerStatusVariant(customer.activo)}>
                        {customer.activo ? 'ACTIVO' : 'INACTIVO'}
                      </Badge>
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground">
                      {customer.telefono || 'Sin teléfono'} · {customer.email || 'Sin correo'}
                    </p>
                  </Card>
                ))}
              </div>

              <div className="hidden md:block">
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead className="hidden lg:table-cell">Documento</TableHead>
                          <TableHead className="hidden md:table-cell">Teléfono</TableHead>
                          <TableHead className="hidden lg:table-cell">Correo</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="w-[80px] text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dashboard.customers.map((customer) => (
                          <TableRow key={customer.id}>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium text-foreground">
                                  {customer.nombreCompleto ?? customer.razonSocial ?? 'Cliente'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {customer.tipoPersona}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-muted-foreground">
                              {customer.tipoDocumento && customer.numeroDocumento
                                ? `${customer.tipoDocumento} · ${customer.numeroDocumento}`
                                : '—'}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">
                              {customer.telefono || '—'}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-muted-foreground">
                              {customer.email || '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={getCustomerStatusVariant(customer.activo)}>
                                {customer.activo ? 'ACTIVO' : 'INACTIVO'}
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
                                  <DropdownMenuItem onClick={() => openEditDialog(customer)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleToggleStatus(customer)}>
                                    <ShieldAlert className="mr-2 h-4 w-4" />
                                    {customer.activo ? 'Desactivar' : 'Reactivar'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => openDeleteDialog(customer)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
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
            </>
          )}
        </TabsContent>

        <TabsContent value="historial" className="space-y-4 pt-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">
              Vista referencial. El siguiente paso será conectar el historial de compras del cliente desde Ventas.
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="seguimiento" className="space-y-4 pt-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">
              Vista referencial. Luego integraremos seguimiento comercial (recordatorios, campañas, frecuencia de compra).
            </p>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) {
            setEditingCustomer(null)
            form.reset(defaultFormValues)
          }
        }}
      >
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Editar cliente' : 'Registrar cliente'}</DialogTitle>
            <DialogDescription>
              Completa los datos del cliente para asociar ventas y contacto.
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-6" onSubmit={form.handleSubmit(handleSaveCustomer)}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de persona</label>
                <Controller
                  control={form.control}
                  name="tipoPersona"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {dashboard.options.tiposPersona.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={form.formState.errors.tipoPersona?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de documento</label>
                <Controller
                  control={form.control}
                  name="tipoDocumento"
                  render={({ field }) => (
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Opcional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Sin documento</SelectItem>
                        {dashboard.options.tiposDocumento.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={form.formState.errors.tipoDocumento?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Número de documento</label>
                <Input {...form.register('numeroDocumento')} placeholder="DNI / RUC (opcional)" />
                <FieldError message={form.formState.errors.numeroDocumento?.message} />
              </div>

              {formTipoPersona === 'JURIDICA' ? (
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Razón social</label>
                  <Input {...form.register('razonSocial')} placeholder="Empresa SAC" />
                  <FieldError message={form.formState.errors.razonSocial?.message} />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nombres</label>
                    <Input {...form.register('nombres')} placeholder="Juan" />
                    <FieldError message={form.formState.errors.nombres?.message} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Apellidos</label>
                    <Input {...form.register('apellidos')} placeholder="Pérez" />
                    <FieldError message={form.formState.errors.apellidos?.message} />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Teléfono</label>
                <Input {...form.register('telefono')} placeholder="987654321" />
                <FieldError message={form.formState.errors.telefono?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Correo</label>
                <Input {...form.register('email')} type="email" placeholder="cliente@email.com" />
                <FieldError message={form.formState.errors.email?.message} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Dirección</label>
                <Input {...form.register('direccion')} placeholder="Dirección (opcional)" />
                <FieldError message={form.formState.errors.direccion?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Ubigeo</label>
                <Input {...form.register('ubigeo')} placeholder="150101" />
                <FieldError message={form.formState.errors.ubigeo?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Nacimiento</label>
                <Input {...form.register('fechaNacimiento')} type="date" />
                <FieldError message={form.formState.errors.fechaNacimiento?.message} />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3 md:col-span-2">
                <div>
                  <p className="text-sm font-medium text-foreground">Cliente activo</p>
                  <p className="text-xs text-muted-foreground">
                    Disponible para selección en ventas
                  </p>
                </div>
                <Controller
                  control={form.control}
                  name="activo"
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Observaciones</label>
                <Textarea
                  {...form.register('observaciones')}
                  placeholder="Notas (alergias, referencias, contacto, etc.)"
                  className="min-h-24"
                />
                <FieldError message={form.formState.errors.observaciones?.message} />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false)
                  setEditingCustomer(null)
                  form.reset(defaultFormValues)
                }}
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
                ) : editingCustomer ? (
                  <>
                    <Plus className="mr-1 h-4 w-4" />
                    Guardar cambios
                  </>
                ) : (
                  <>
                    <Plus className="mr-1 h-4 w-4" />
                    Crear cliente
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open)
          if (!open) {
            setDeleteTarget(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar cliente</DialogTitle>
            <DialogDescription>
              Esta acción hará una baja lógica del cliente y dejará de aparecer en el padrón activo.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/20 p-3 text-sm">
            {deleteTarget?.nombreCompleto || deleteTarget?.razonSocial || 'Cliente no seleccionado'}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false)
                setDeleteTarget(null)
              }}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteCustomer}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader className="h-4 w-4 text-current" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="mr-1 h-4 w-4" />
                  Confirmar baja
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
