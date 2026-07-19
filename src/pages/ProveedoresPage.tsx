import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  ChevronDown,
  ClipboardCheck,
  Edit,
  History,
  Loader2,
  MoreVertical,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Truck,
  Warehouse,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { useAuth } from '@/hooks/useAuth'
import {
  supplierAlerts,
  supplierDocuments,
} from '@/modules/suppliers/mock-data'
import { ApiError, ApiNetworkError } from '@/services/apiClient'
import { suppliersService } from '@/services/suppliersService'
import type {
  CreateSupplierPayload,
  SupplierItem,
  SupplierStatusFilter,
  SuppliersDashboardResponse,
} from '@/types/suppliers'
import { toast } from 'sonner'

const optionalEmailSchema = z
  .string()
  .max(150, 'Máximo 150 caracteres.')
  .refine((value) => value === '' || /\S+@\S+\.\S+/.test(value), 'Ingresa un correo válido.')

const supplierFormSchema = z.object({
  tipoPersona: z.string().min(1, 'Selecciona el tipo de persona.'),
  tipoDocumento: z.string().min(1, 'Selecciona el tipo de documento.'),
  numeroDocumento: z.string().min(8, 'Ingresa un documento válido.').max(20),
  razonSocial: z.string().min(2, 'Ingresa la razón social.').max(200),
  nombreComercial: z.string().max(200).optional(),
  contactoNombre: z.string().max(150).optional(),
  contactoTelefono: z.string().max(30).optional(),
  email: optionalEmailSchema,
  direccion: z.string().max(255).optional(),
  ubigeo: z.string().max(6).optional(),
  observaciones: z.string().max(255).optional(),
  activo: z.boolean(),
})

type SupplierFormValues = z.infer<typeof supplierFormSchema>

const defaultDashboard: SuppliersDashboardResponse = {
  summary: {
    totalSuppliers: 0,
    activeSuppliers: 0,
    inactiveSuppliers: 0,
  },
  suppliers: [],
  options: {
    tiposPersona: [],
    tiposDocumento: [],
  },
}

const defaultFormValues: SupplierFormValues = {
  tipoPersona: '',
  tipoDocumento: '',
  numeroDocumento: '',
  razonSocial: '',
  nombreComercial: '',
  contactoNombre: '',
  contactoTelefono: '',
  email: '',
  direccion: '',
  ubigeo: '',
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

function getSupplierStatusVariant(isActive: boolean) {
  return isActive ? 'success' : 'outline'
}

function getDocumentStatusVariant(status: 'VIGENTE' | 'POR_VENCER' | 'VENCIDO') {
  if (status === 'VIGENTE') return 'success'
  if (status === 'POR_VENCER') return 'warning'
  return 'destructive'
}

function getAlertPriorityVariant(priority: 'ALTA' | 'MEDIA' | 'BAJA') {
  if (priority === 'ALTA') return 'warning'
  if (priority === 'MEDIA') return 'info'
  return 'outline'
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function toPayload(values: SupplierFormValues): CreateSupplierPayload {
  return {
    tipoPersona: values.tipoPersona,
    tipoDocumento: values.tipoDocumento,
    numeroDocumento: values.numeroDocumento.trim(),
    razonSocial: values.razonSocial.trim(),
    nombreComercial: values.nombreComercial?.trim() || undefined,
    contactoNombre: values.contactoNombre?.trim() || undefined,
    contactoTelefono: values.contactoTelefono?.trim() || undefined,
    email: values.email?.trim() || undefined,
    direccion: values.direccion?.trim() || undefined,
    ubigeo: values.ubigeo?.trim() || undefined,
    observaciones: values.observaciones?.trim() || undefined,
  }
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <p className="text-xs text-destructive">{message}</p>
}

export function ProveedoresPage() {
  const { logout, session } = useAuth()
  const accessToken = session?.accessToken ?? ''

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'todos' | SupplierStatusFilter>('todos')
  const [showSummary, setShowSummary] = useState(true)
  const [dashboard, setDashboard] = useState<SuppliersDashboardResponse>(defaultDashboard)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<SupplierItem | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SupplierItem | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: defaultFormValues,
  })

  const supplierMetrics = useMemo(
    () => ({
      total: dashboard.summary.totalSuppliers,
      active: dashboard.summary.activeSuppliers,
      inactive: dashboard.summary.inactiveSuppliers,
      withContact: dashboard.suppliers.filter((supplier) => supplier.contactoNombre).length,
      withEmail: dashboard.suppliers.filter((supplier) => supplier.email).length,
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
      const response = await suppliersService.getDashboard(accessToken, {
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
    setEditingSupplier(null)
    form.reset({
      ...defaultFormValues,
      tipoPersona: dashboard.options.tiposPersona[0] ?? '',
      tipoDocumento: dashboard.options.tiposDocumento[0] ?? '',
      activo: true,
    })
    setIsDialogOpen(true)
  }

  function openEditDialog(supplier: SupplierItem) {
    setEditingSupplier(supplier)
    form.reset({
      tipoPersona: supplier.tipoPersona,
      tipoDocumento: supplier.tipoDocumento,
      numeroDocumento: supplier.numeroDocumento,
      razonSocial: supplier.razonSocial,
      nombreComercial: supplier.nombreComercial ?? '',
      contactoNombre: supplier.contactoNombre ?? '',
      contactoTelefono: supplier.contactoTelefono ?? '',
      email: supplier.email ?? '',
      direccion: supplier.direccion ?? '',
      ubigeo: supplier.ubigeo ?? '',
      observaciones: supplier.observaciones ?? '',
      activo: supplier.activo,
    })
    setIsDialogOpen(true)
  }

  function openDeleteDialog(supplier: SupplierItem) {
    setDeleteTarget(supplier)
    setIsDeleteDialogOpen(true)
  }

  async function handleSaveSupplier(values: SupplierFormValues) {
    if (!accessToken) {
      toast.error('La sesión no está disponible.')
      return
    }

    setIsSubmitting(true)

    try {
      const payload = toPayload(values)

      if (editingSupplier) {
        await suppliersService.update(accessToken, editingSupplier.id, {
          ...payload,
          activo: values.activo,
        })
        toast.success('Proveedor actualizado correctamente.')
      } else {
        await suppliersService.create(accessToken, payload)
        toast.success('Proveedor registrado correctamente.')
      }

      setIsDialogOpen(false)
      setEditingSupplier(null)
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

  async function handleToggleStatus(supplier: SupplierItem) {
    if (!accessToken) {
      toast.error('La sesión no está disponible.')
      return
    }

    try {
      await suppliersService.update(accessToken, supplier.id, {
        activo: !supplier.activo,
      })
      toast.success(
        supplier.activo
          ? 'Proveedor desactivado correctamente.'
          : 'Proveedor reactivado correctamente.',
      )
      await loadDashboard()
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorized()
        return
      }

      toast.error(getApiErrorMessage(nextError))
    }
  }

  async function handleDeleteSupplier() {
    if (!accessToken || !deleteTarget) {
      toast.error('No hay proveedor seleccionado para eliminar.')
      return
    }

    setIsDeleting(true)

    try {
      await suppliersService.remove(accessToken, deleteTarget.id)
      toast.success('Proveedor eliminado correctamente.')
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
        <h1 className="text-xl font-bold text-foreground">Proveedores</h1>
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
            <Warehouse className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{supplierMetrics.total}</span>
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <ShieldAlert className="h-4 w-4 text-warning" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{supplierMetrics.active}</span>
              <span className="text-xs text-muted-foreground">Activos</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{supplierMetrics.withContact}</span>
              <span className="text-xs text-muted-foreground">Con contacto</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <Truck className="h-4 w-4 text-info" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{supplierMetrics.withEmail}</span>
              <span className="text-xs text-muted-foreground">Con correo</span>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="padron" className="w-full">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="padron">Padrón</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="alertas">Alertas</TabsTrigger>
          </TabsList>
          <Button type="button" size="sm" onClick={openCreateDialog}>
            <Plus className="mr-1 h-4 w-4" />
            Nuevo proveedor
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
                  placeholder="Buscar por razón social, documento, contacto o correo"
                  className="pl-9"
                />
              </div>

              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as 'todos' | SupplierStatusFilter)
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
          ) : dashboard.suppliers.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="text-sm font-medium text-foreground">
                No hay proveedores registrados con los filtros actuales
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Crea el primer proveedor para habilitar compras e inventario
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {dashboard.suppliers.map((supplier) => (
                  <Card key={supplier.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{supplier.razonSocial}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {supplier.tipoDocumento} · {supplier.numeroDocumento}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(supplier)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStatus(supplier)}>
                            <ShieldAlert className="mr-2 h-4 w-4" />
                            {supplier.activo ? 'Desactivar' : 'Reactivar'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => toast.info('El historial del proveedor se integrará en el siguiente paso.')}
                          >
                            <History className="mr-2 h-4 w-4" />
                            Historial
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => openDeleteDialog(supplier)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline">{supplier.tipoPersona}</Badge>
                      <Badge variant={getSupplierStatusVariant(supplier.activo)}>
                        {supplier.activo ? 'ACTIVO' : 'INACTIVO'}
                      </Badge>
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground">
                      {supplier.contactoNombre || 'Sin contacto'} ·{' '}
                      {supplier.contactoTelefono || 'Sin teléfono'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {supplier.email || 'Sin correo registrado'}
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
                          <TableHead>Proveedor</TableHead>
                          <TableHead className="hidden lg:table-cell">Documento</TableHead>
                          <TableHead className="hidden md:table-cell">Contacto</TableHead>
                          <TableHead className="hidden lg:table-cell">Correo</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="hidden lg:table-cell">Actualizado</TableHead>
                          <TableHead className="w-[80px] text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dashboard.suppliers.map((supplier) => (
                          <TableRow key={supplier.id}>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium text-foreground">{supplier.razonSocial}</p>
                                <p className="text-xs text-muted-foreground">
                                  {supplier.nombreComercial || supplier.tipoPersona}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-muted-foreground">
                              {supplier.tipoDocumento} · {supplier.numeroDocumento}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">
                              {supplier.contactoNombre || 'Sin contacto'}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-muted-foreground">
                              {supplier.email || 'Sin correo'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={getSupplierStatusVariant(supplier.activo)}>
                                {supplier.activo ? 'ACTIVO' : 'INACTIVO'}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-muted-foreground">
                              {formatDateTime(supplier.updatedAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEditDialog(supplier)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleToggleStatus(supplier)}>
                                    <ShieldAlert className="mr-2 h-4 w-4" />
                                    {supplier.activo ? 'Desactivar' : 'Reactivar'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      toast.info('El historial del proveedor se integrará en el siguiente paso.')
                                    }
                                  >
                                    <History className="mr-2 h-4 w-4" />
                                    Historial
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => openDeleteDialog(supplier)}
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

        <TabsContent value="documentos" className="space-y-4 pt-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">
              Vista referencial. El siguiente paso será conectar documentos de proveedor a la API.
            </p>
          </Card>

          <div className="md:hidden space-y-3">
            {supplierDocuments.map((document) => (
              <Card key={document.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{document.supplierName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{document.documentType}</p>
                  </div>
                  <Badge variant={getDocumentStatusVariant(document.status)}>{document.status}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Vence: {document.expiresAt}</p>
              </Card>
            ))}
          </div>

          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead className="hidden md:table-cell">Referencia</TableHead>
                      <TableHead className="hidden lg:table-cell">Vence</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierDocuments.map((document) => (
                      <TableRow key={document.id}>
                        <TableCell className="font-medium text-foreground">
                          {document.supplierName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {document.documentType}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {document.reference}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {document.expiresAt}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getDocumentStatusVariant(document.status)}>
                            {document.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alertas" className="space-y-4 pt-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">
              Vista referencial. Luego integraremos alertas reales de documentos vencidos y estado comercial.
            </p>
          </Card>

          <div className="md:hidden space-y-3">
            {supplierAlerts.map((alert) => (
              <Card key={alert.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{alert.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{alert.supplierName}</p>
                  </div>
                  <Badge variant={getAlertPriorityVariant(alert.priority)}>{alert.priority}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{alert.note}</p>
              </Card>
            ))}
          </div>

          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alerta</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead className="hidden md:table-cell">Nota</TableHead>
                      <TableHead>Prioridad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierAlerts.map((alert) => (
                      <TableRow key={alert.id}>
                        <TableCell className="font-medium text-foreground">{alert.title}</TableCell>
                        <TableCell className="text-muted-foreground">{alert.supplierName}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {alert.note}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getAlertPriorityVariant(alert.priority)}>
                            {alert.priority}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) {
            setEditingSupplier(null)
            form.reset(defaultFormValues)
          }
        }}
      >
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? 'Editar proveedor' : 'Registrar proveedor'}
            </DialogTitle>
            <DialogDescription>
              Completa la ficha maestra del proveedor para usarlo en compras e inventario.
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-6" onSubmit={form.handleSubmit(handleSaveSupplier)}>
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
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un documento" />
                      </SelectTrigger>
                      <SelectContent>
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
                <Input {...form.register('numeroDocumento')} placeholder="20123456789" />
                <FieldError message={form.formState.errors.numeroDocumento?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Razón social</label>
                <Input {...form.register('razonSocial')} placeholder="Proveedor SAC" />
                <FieldError message={form.formState.errors.razonSocial?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre comercial</label>
                <Input {...form.register('nombreComercial')} placeholder="Opcional" />
                <FieldError message={form.formState.errors.nombreComercial?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Contacto</label>
                <Input {...form.register('contactoNombre')} placeholder="Nombre del contacto" />
                <FieldError message={form.formState.errors.contactoNombre?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Teléfono</label>
                <Input {...form.register('contactoTelefono')} placeholder="987654321" />
                <FieldError message={form.formState.errors.contactoTelefono?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Correo</label>
                <Input {...form.register('email')} type="email" placeholder="contacto@proveedor.com" />
                <FieldError message={form.formState.errors.email?.message} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Dirección</label>
                <Input {...form.register('direccion')} placeholder="Dirección fiscal o comercial" />
                <FieldError message={form.formState.errors.direccion?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Ubigeo</label>
                <Input {...form.register('ubigeo')} placeholder="150101" />
                <FieldError message={form.formState.errors.ubigeo?.message} />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Proveedor activo</p>
                  <p className="text-xs text-muted-foreground">
                    Disponible para compras y selección operativa
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
                  placeholder="Notas comerciales, logísticas o sanitarias"
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
                  setEditingSupplier(null)
                  form.reset(defaultFormValues)
                }}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Plus className="mr-1 h-4 w-4" />
                    {editingSupplier ? 'Guardar cambios' : 'Crear proveedor'}
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
            <DialogTitle>Eliminar proveedor</DialogTitle>
            <DialogDescription>
              Esta acción hará una baja lógica del proveedor y dejará de aparecer en el padrón activo.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/20 p-3 text-sm">
            {deleteTarget?.razonSocial || 'Proveedor no seleccionado'}
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
              onClick={handleDeleteSupplier}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
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
