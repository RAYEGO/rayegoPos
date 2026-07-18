import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  AlertTriangle,
  ArrowUpDown,
  ClipboardList,
  Loader2,
  PackagePlus,
  Pill,
  Search,
  ShieldAlert,
  TestTubeDiagonal,
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
import { useAuth } from '@/hooks/useAuth'
import { ApiError, ApiNetworkError } from '@/services/apiClient'
import { productsService } from '@/services/productsService'
import type {
  CreateProductPayload,
  ProductCatalogItem,
  ProductOptionsResponse,
  ProductStatus,
} from '@/types/products'
import { toast } from 'sonner'

const createProductSchema = z.object({
  categoriaId: z.string().uuid({ message: 'Selecciona una categoría.' }),
  laboratorioId: z.string().optional(),
  presentacionId: z.string().optional(),
  unidadMedidaId: z.string().uuid({ message: 'Selecciona una unidad.' }),
  principioActivoId: z.string().optional(),
  sku: z.string().min(3, 'Ingresa un SKU válido.').max(50),
  codigoInterno: z.string().max(50).optional(),
  codigoBarras: z.string().max(50).optional(),
  nombre: z.string().min(3, 'Ingresa el nombre del producto.').max(180),
  descripcion: z.string().max(500).optional(),
  concentracion: z.string().max(120).optional(),
  registroSanitario: z.string().max(100).optional(),
  requiereReceta: z.boolean(),
  esControlado: z.boolean(),
  precioVenta: z.number().nonnegative('El precio debe ser mayor o igual a 0.'),
  costoReferencia: z.number().nonnegative('El costo debe ser mayor o igual a 0.'),
})

type CreateProductFormValues = z.infer<typeof createProductSchema>

const defaultFormValues: CreateProductFormValues = {
  categoriaId: '',
  laboratorioId: '',
  presentacionId: '',
  unidadMedidaId: '',
  principioActivoId: '',
  sku: '',
  codigoInterno: '',
  codigoBarras: '',
  nombre: '',
  descripcion: '',
  concentracion: '',
  registroSanitario: '',
  requiereReceta: false,
  esControlado: false,
  precioVenta: 0,
  costoReferencia: 0,
}

function getProductStatusVariant(status: ProductStatus) {
  if (status === 'ACTIVO') return 'success'
  if (status === 'INACTIVO') return 'outline'
  return 'warning'
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Sin lotes'
  }

  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

function getStockVariant(product: ProductCatalogItem) {
  if (product.stockUnits === 0) return 'destructive'
  if (product.stockUnits <= 20 || product.lotCount <= 1) return 'warning'
  return 'success'
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

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <p className="text-xs text-destructive">{message}</p>
}

export function ProductosPage() {
  const { logout, session } = useAuth()
  const accessToken = session?.accessToken ?? ''
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'TODOS' | ProductStatus>('TODOS')
  const [categoryFilter, setCategoryFilter] = useState('TODAS')
  const [products, setProducts] = useState<ProductCatalogItem[]>([])
  const [summary, setSummary] = useState({
    total: 0,
    activeCatalog: 0,
    lowStockCount: 0,
    withPrescription: 0,
    lotEnabled: 0,
  })
  const [options, setOptions] = useState<ProductOptionsResponse>({
    categories: [],
    laboratories: [],
    presentations: [],
    units: [],
    activePrinciples: [],
  })
  const [isCatalogLoading, setIsCatalogLoading] = useState(true)
  const [isOptionsLoading, setIsOptionsLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<CreateProductFormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: defaultFormValues,
  })

  const loadOptions = useCallback(async () => {
    if (!accessToken) {
      return
    }

    setIsOptionsLoading(true)

    try {
      const nextOptions = await productsService.getOptions(accessToken)
      setOptions(nextOptions)
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    } finally {
      setIsOptionsLoading(false)
    }
  }, [accessToken])

  const loadProducts = useCallback(async () => {
    if (!accessToken) {
      return
    }

    setIsCatalogLoading(true)
    setCatalogError(null)

    try {
      const response = await productsService.list(accessToken, {
        search,
        status: statusFilter === 'TODOS' ? undefined : statusFilter,
        categoryId: categoryFilter === 'TODAS' ? undefined : categoryFilter,
      })

      setProducts(response.items)
      setSummary(response.summary)
    } catch (error) {
      setCatalogError(getApiErrorMessage(error))
    } finally {
      setIsCatalogLoading(false)
    }
  }, [accessToken, categoryFilter, search, statusFilter])

  useEffect(() => {
    void loadOptions()
  }, [loadOptions])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  const portfolioMetrics = useMemo(
    () => ({
      activeCatalog: summary.activeCatalog,
      lowStockCount: summary.lowStockCount,
      withPrescription: summary.withPrescription,
      lotEnabled: summary.lotEnabled,
    }),
    [summary],
  )

  const inventoryAlerts = useMemo(
    () =>
      products.filter((product) => product.stockUnits <= 20 || product.lotCount <= 1),
    [products],
  )

  const masterDataReady =
    options.categories.length > 0 && options.units.length > 0

  async function handleCreateProduct(values: CreateProductFormValues) {
    if (!accessToken) {
      toast.error('La sesión no está disponible.')
      return
    }

    const payload: CreateProductPayload = {
      ...values,
      laboratorioId: values.laboratorioId || undefined,
      presentacionId: values.presentacionId || undefined,
      principioActivoId: values.principioActivoId || undefined,
      codigoInterno: values.codigoInterno?.trim() || undefined,
      codigoBarras: values.codigoBarras?.trim() || undefined,
      descripcion: values.descripcion?.trim() || undefined,
      concentracion: values.concentracion?.trim() || undefined,
      registroSanitario: values.registroSanitario?.trim() || undefined,
    }

    setIsSubmitting(true)

    try {
      await productsService.create(accessToken, payload)
      toast.success('Producto registrado correctamente.')
      setIsCreateDialogOpen(false)
      form.reset(defaultFormValues)
      await Promise.all([loadProducts(), loadOptions()])
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        toast.error('Tu sesión venció o cambió con el despliegue. Ingresa nuevamente para guardar productos.')
        await logout()
        return
      }

      toast.error(getApiErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-foreground">Productos</h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <div>
            <span className="font-semibold text-foreground">{portfolioMetrics.activeCatalog}</span> SKU
          </div>
          <div>
            <span className="font-semibold text-foreground">{portfolioMetrics.lowStockCount}</span> Bajo Stock
          </div>
          <div>
            <span className="font-semibold text-foreground">{portfolioMetrics.withPrescription}</span> Con receta
          </div>
          <div>
            <span className="font-semibold text-foreground">{portfolioMetrics.lotEnabled}</span> Con lotes
          </div>
        </div>
      </div>

      <Tabs defaultValue="catalogo">
        <TabsList className="grid w-full grid-cols-3 lg:w-fit">
          <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
          <TabsTrigger value="maestros">Maestros</TabsTrigger>
          <TabsTrigger value="inventario">Puente a inventario</TabsTrigger>
        </TabsList>

        <TabsContent value="catalogo" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <PackagePlus className="h-5 w-5 text-primary" />
                  Catálogo de productos
                </CardTitle>
                <CardDescription>
                  Listado vivo del maestro de productos, conectado a Supabase vía Fastify y Prisma.
                </CardDescription>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled>
                  <ArrowUpDown className="h-4 w-4" />
                  Exportar catálogo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsCreateDialogOpen(true)}
                  disabled={!masterDataReady || isOptionsLoading}
                >
                  <PackagePlus className="h-4 w-4" />
                  Nuevo producto
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {!masterDataReady && !isOptionsLoading ? (
                <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning-foreground">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    Aún no hay maestros suficientes para registrar productos. Ejecuta el seed actualizado para cargar categorías, unidades y laboratorios base.
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.5fr_0.5fr]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por SKU, nombre, código, principio activo o laboratorio"
                    className="pl-9"
                  />
                </div>

                <Select
                  value={statusFilter}
                  onValueChange={(value) =>
                    setStatusFilter(value as 'TODOS' | ProductStatus)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos los estados</SelectItem>
                    <SelectItem value="ACTIVO">Activo</SelectItem>
                    <SelectItem value="INACTIVO">Inactivo</SelectItem>
                    <SelectItem value="DESCONTINUADO">Descontinuado</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAS">Todas las categorías</SelectItem>
                    {options.categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isCatalogLoading ? (
                <div className="flex min-h-56 items-center justify-center rounded-2xl border">
                  <Loader className="h-7 w-7" />
                </div>
              ) : catalogError ? (
                <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                  {catalogError}
                </div>
              ) : products.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-10 text-center">
                  <p className="text-sm font-medium text-foreground">
                    No se encontraron productos con los filtros actuales.
                  </p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Ajusta los filtros o registra el primer SKU del catálogo.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Clasificación</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Lotes</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{product.name}</p>
                            <p className="text-small text-muted-foreground">
                              {product.sku}
                              {product.presentation ? ` · ${product.presentation}` : ''}
                              {product.concentration ? ` · ${product.concentration}` : ''}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <Badge variant="outline">{product.category}</Badge>
                            <p className="text-small text-muted-foreground">
                              {product.activePrinciples.map((entry) => entry.name).join(', ') || 'Sin principio activo'}
                              {product.laboratory ? ` · ${product.laboratory}` : ''}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">
                              {formatCurrency(product.salePrice)}
                            </p>
                            <p className="text-small text-muted-foreground">
                              costo {formatCurrency(product.costPrice)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <Badge variant={getStockVariant(product)}>
                              {product.stockUnits.toFixed(2)} {product.unitSymbol}
                            </Badge>
                            <p className="text-small text-muted-foreground">
                              {product.reservedUnits.toFixed(2)} reservadas
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <Badge variant={product.lotCount > 0 ? 'info' : 'outline'}>
                              {product.lotCount} lotes
                            </Badge>
                            <p className="text-small text-muted-foreground">
                              {product.branchCoverage} sucursales
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(product.nextExpiry)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={getProductStatusVariant(product.status)}>
                              {product.status}
                            </Badge>
                            {product.requiresPrescription ? (
                              <Badge variant="warning">Receta</Badge>
                            ) : null}
                            {product.isControlled ? (
                              <Badge variant="destructive">Controlado</Badge>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maestros" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Categorías
                </CardTitle>
                <CardDescription>
                  Agrupación comercial real para filtros, compras y reportes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isOptionsLoading ? (
                  <div className="flex min-h-40 items-center justify-center">
                    <Loader className="h-6 w-6" />
                  </div>
                ) : (
                  options.categories.map((category) => (
                    <div key={category.id} className="rounded-2xl border p-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-medium text-foreground">{category.name}</p>
                        <Badge variant="outline">{category.skuCount} SKU</Badge>
                      </div>
                      <p className="mt-1 text-small text-muted-foreground">
                        {category.activeCount} referencias activas en catálogo.
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TestTubeDiagonal className="h-5 w-5 text-primary" />
                  Laboratorios
                </CardTitle>
                <CardDescription>
                  Base operativa para abastecimiento y trazabilidad de origen.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isOptionsLoading ? (
                  <div className="flex min-h-40 items-center justify-center">
                    <Loader className="h-6 w-6" />
                  </div>
                ) : (
                  options.laboratories.map((laboratory) => (
                    <div key={laboratory.id} className="rounded-2xl border p-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-medium text-foreground">{laboratory.name}</p>
                        <Badge variant="info">{laboratory.country ?? 'Sin país'}</Badge>
                      </div>
                      <p className="mt-1 text-small text-muted-foreground">
                        {laboratory.skuCount} SKU asociados al laboratorio.
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pill className="h-5 w-5 text-primary" />
                  Principios activos
                </CardTitle>
                <CardDescription>
                  Base clínica para búsquedas por genérico y homologación terapéutica.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isOptionsLoading ? (
                  <div className="flex min-h-40 items-center justify-center">
                    <Loader className="h-6 w-6" />
                  </div>
                ) : (
                  options.activePrinciples.map((principle) => (
                    <div key={principle.id} className="rounded-2xl border p-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-medium text-foreground">{principle.name}</p>
                        <Badge variant="outline">{principle.productCount} productos</Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="inventario" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <CardHeader>
                <CardTitle>Preparación para inventario por lotes</CardTitle>
                <CardDescription>
                  Lo que ya queda cubierto desde Productos para el siguiente sprint.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Identificación del SKU</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Código, nombre, principio activo, concentración y presentación ya están normalizados.
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Políticas de dispensación</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    El maestro diferencia receta y controlados para aplicar reglas clínicas y comerciales.
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Costo y cobertura</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Ya medimos costo referencial, lotes activos y cobertura por sucursal desde la API.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  Alertas para el siguiente sprint
                </CardTitle>
                <CardDescription>
                  Casos que inventario deberá resolver apenas empecemos el manejo de lotes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {inventoryAlerts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-6 text-small text-muted-foreground">
                    Aún no hay alertas operativas. Cuando existan lotes y stock real, aquí se mostrará el foco inmediato.
                  </div>
                ) : (
                  inventoryAlerts.map((product) => (
                    <div key={product.id} className="rounded-2xl border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-foreground">{product.name}</p>
                          <p className="mt-1 text-small text-muted-foreground">
                            {product.stockUnits.toFixed(2)} {product.unitSymbol} · {product.lotCount} lotes · vence {formatDate(product.nextExpiry)}
                          </p>
                        </div>
                        <Badge variant={getStockVariant(product)}>
                          {product.stockUnits === 0 ? 'Sin stock' : 'Atención'}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar producto</DialogTitle>
            <DialogDescription>
              Alta inicial del maestro farmacéutico con maestros reales y validación de catálogo.
            </DialogDescription>
          </DialogHeader>

          <form
            className="grid gap-6"
            onSubmit={form.handleSubmit(handleCreateProduct)}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">SKU</label>
                <Input {...form.register('sku')} placeholder="MED-0001" />
                <FieldError message={form.formState.errors.sku?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Código interno</label>
                <Input {...form.register('codigoInterno')} placeholder="INT-001" />
                <FieldError message={form.formState.errors.codigoInterno?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Código de barras</label>
                <Input {...form.register('codigoBarras')} placeholder="7751234567890" />
                <FieldError message={form.formState.errors.codigoBarras?.message} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Nombre comercial</label>
                <Input {...form.register('nombre')} placeholder="Paracetamol 500 mg tabletas" />
                <FieldError message={form.formState.errors.nombre?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Categoría</label>
                <Controller
                  control={form.control}
                  name="categoriaId"
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={form.formState.errors.categoriaId?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Laboratorio</label>
                <Controller
                  control={form.control}
                  name="laboratorioId"
                  render={({ field }) => (
                    <Select
                      value={field.value || 'none'}
                      onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Opcional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin laboratorio</SelectItem>
                        {options.laboratories.map((laboratory) => (
                          <SelectItem key={laboratory.id} value={laboratory.id}>
                            {laboratory.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Presentación</label>
                <Controller
                  control={form.control}
                  name="presentacionId"
                  render={({ field }) => (
                    <Select
                      value={field.value || 'none'}
                      onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Opcional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin presentación</SelectItem>
                        {options.presentations.map((presentation) => (
                          <SelectItem key={presentation.id} value={presentation.id}>
                            {presentation.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Unidad de medida</label>
                <Controller
                  control={form.control}
                  name="unidadMedidaId"
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona unidad" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.units.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name} ({unit.symbol})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={form.formState.errors.unidadMedidaId?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Principio activo</label>
                <Controller
                  control={form.control}
                  name="principioActivoId"
                  render={({ field }) => (
                    <Select
                      value={field.value || 'none'}
                      onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Opcional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin principio activo</SelectItem>
                        {options.activePrinciples.map((principle) => (
                          <SelectItem key={principle.id} value={principle.id}>
                            {principle.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Concentración</label>
                <Input {...form.register('concentracion')} placeholder="500 mg" />
                <FieldError message={form.formState.errors.concentracion?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Registro sanitario</label>
                <Input {...form.register('registroSanitario')} placeholder="RS-12345" />
                <FieldError message={form.formState.errors.registroSanitario?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Precio de venta</label>
                <Input
                  type="number"
                  step="0.01"
                  {...form.register('precioVenta', { valueAsNumber: true })}
                />
                <FieldError message={form.formState.errors.precioVenta?.message} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Costo referencial</label>
                <Input
                  type="number"
                  step="0.01"
                  {...form.register('costoReferencia', { valueAsNumber: true })}
                />
                <FieldError message={form.formState.errors.costoReferencia?.message} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Descripción</label>
                <Textarea
                  {...form.register('descripcion')}
                  placeholder="Detalle comercial o farmacéutico relevante"
                  className="min-h-24"
                />
                <FieldError message={form.formState.errors.descripcion?.message} />
              </div>
            </div>

            <div className="grid gap-4 rounded-2xl border p-4 md:grid-cols-2">
              <Controller
                control={form.control}
                name="requiereReceta"
                render={({ field }) => (
                  <label className="flex items-center justify-between gap-4 rounded-xl border p-4">
                    <div>
                      <p className="font-medium text-foreground">Requiere receta</p>
                      <p className="text-small text-muted-foreground">
                        Activa reglas de dispensación y validación clínica.
                      </p>
                    </div>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </label>
                )}
              />

              <Controller
                control={form.control}
                name="esControlado"
                render={({ field }) => (
                  <label className="flex items-center justify-between gap-4 rounded-xl border p-4">
                    <div>
                      <p className="font-medium text-foreground">Producto controlado</p>
                      <p className="text-small text-muted-foreground">
                        Marca el SKU para controles más estrictos y seguimiento.
                      </p>
                    </div>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </label>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false)
                  form.reset(defaultFormValues)
                }}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <PackagePlus className="h-4 w-4" />
                    Guardar producto
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
