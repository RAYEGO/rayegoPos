import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  AlertTriangle,
  ChevronDown,
  ClipboardList,
  Edit,
  History,
  Layers,
  Loader2,
  MoreVertical,
  PackagePlus,
  Pill,
  Plus,
  Search,
  Trash2,
  Copy,
  TestTubeDiagonal,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
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
  const [laboratoryFilter, setLaboratoryFilter] = useState('TODOS')
  const [showSummary, setShowSummary] = useState(true)
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
    <div className="space-y-4 p-4">
      {/* Header with Title and Summary Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-foreground">Productos</h1>
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
            <PackagePlus className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{portfolioMetrics.activeCatalog}</span>
              <span className="text-xs text-muted-foreground">SKU</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{portfolioMetrics.lowStockCount}</span>
              <span className="text-xs text-muted-foreground">Bajo stock</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <Pill className="h-4 w-4 text-primary" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{portfolioMetrics.withPrescription}</span>
              <span className="text-xs text-muted-foreground">Con receta</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <TestTubeDiagonal className="h-4 w-4 text-info" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{portfolioMetrics.lotEnabled}</span>
              <span className="text-xs text-muted-foreground">Con lotes</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs, Filters, and New Product Button */}
      <Tabs defaultValue="catalogo" className="w-full">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
            <TabsTrigger value="maestros">Maestros</TabsTrigger>
          </TabsList>
          <Button size="sm" onClick={() => setIsCreateDialogOpen(true)} disabled={!masterDataReady || isOptionsLoading}>
            <Plus className="h-4 w-4 mr-1" />
            Nuevo Producto
          </Button>
        </div>

        <TabsContent value="catalogo" className="space-y-4 pt-4">
          <Card className="p-4">
            <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-7">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por SKU, nombre, código"
                    className="pl-9"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'TODOS' | ProductStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
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
                  <SelectItem value="TODAS">Todas</SelectItem>
                  {options.categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={laboratoryFilter} onValueChange={setLaboratoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Laboratorio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  {options.laboratories.map((lab) => (
                    <SelectItem key={lab.id} value={lab.id}>{lab.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3">
            {isCatalogLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="h-7 w-7" />
              </div>
            ) : catalogError ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                {catalogError}
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="text-sm font-medium text-foreground">
                  No se encontraron productos
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ajusta los filtros o registra el primer producto
                </p>
              </div>
            ) : (
              products.map((product) => (
                <Card key={product.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-14 w-14 rounded-lg border bg-muted flex items-center justify-center text-2xl">
                      📦
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {product.sku}
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
                            <DropdownMenuItem>
                              <Layers className="h-4 w-4 mr-2" />
                              Ver lotes
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 items-center">
                        <Badge variant={getStockVariant(product)}>
                          {product.stockUnits.toFixed(0)} {product.unitSymbol}
                        </Badge>
                        <p className="font-medium text-sm text-foreground">{formatCurrency(product.salePrice)}</p>
                        <Badge variant={getProductStatusVariant(product.status)}>
                          {product.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Desktop/Tablet Table View */}
          <div className="hidden md:block">
            {isCatalogLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="h-7 w-7" />
              </div>
            ) : catalogError ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                {catalogError}
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="text-sm font-medium text-foreground">
                  No se encontraron productos con los filtros actuales
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ajusta los filtros o registra el primer SKU del catálogo
                </p>
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[300px]">Producto</TableHead>
                        <TableHead className="hidden lg:table-cell">Categoría</TableHead>
                        <TableHead className="hidden md:table-cell">Precio</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead className="hidden lg:table-cell">Lotes</TableHead>
                        <TableHead className="hidden xl:table-cell">Vencimiento</TableHead>
                        <TableHead className="w-[80px] text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg border bg-muted flex items-center justify-center text-lg">
                                📦
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-foreground truncate">{product.name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {product.sku}
                                  {product.presentation ? ` · ${product.presentation}` : ''}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Badge variant="outline">{product.category}</Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <p className="font-medium text-sm">{formatCurrency(product.salePrice)}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStockVariant(product)}>
                              {product.stockUnits.toFixed(0)} {product.unitSymbol}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Badge variant={product.lotCount > 0 ? 'info' : 'outline'}>
                              {product.lotCount}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                            {formatDate(product.nextExpiry)}
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
                                <DropdownMenuItem>
                                  <Layers className="h-4 w-4 mr-2" />
                                  Ver lotes
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Duplicar
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
            )}
          </div>
        </TabsContent>

        <TabsContent value="maestros" className="space-y-4 pt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  Categorías
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {isOptionsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader className="h-5 w-5" />
                  </div>
                ) : (
                  options.categories.map((category) => (
                    <div key={category.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-sm text-foreground">{category.name}</p>
                        <Badge variant="outline" className="text-xs">{category.skuCount} SKU</Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TestTubeDiagonal className="h-4 w-4 text-primary" />
                  Laboratorios
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {isOptionsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader className="h-5 w-5" />
                  </div>
                ) : (
                  options.laboratories.map((laboratory) => (
                    <div key={laboratory.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-sm text-foreground">{laboratory.name}</p>
                        <Badge variant="info" className="text-xs">{laboratory.country ?? 'Sin país'}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Pill className="h-4 w-4 text-primary" />
                  Principios activos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {isOptionsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader className="h-5 w-5" />
                  </div>
                ) : (
                  options.activePrinciples.map((principle) => (
                    <div key={principle.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-sm text-foreground">{principle.name}</p>
                        <Badge variant="outline" className="text-xs">{principle.productCount} productos</Badge>
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
              Alta inicial del maestro farmacéutico
            </DialogDescription>
          </DialogHeader>

          <form
            className="grid gap-4"
            onSubmit={form.handleSubmit(handleCreateProduct)}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">SKU</label>
                <Input {...form.register('sku')} placeholder="MED-0001" size={1} />
                <FieldError message={form.formState.errors.sku?.message} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Código interno</label>
                <Input {...form.register('codigoInterno')} placeholder="INT-001" />
                <FieldError message={form.formState.errors.codigoInterno?.message} />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-medium">Nombre comercial</label>
                <Input {...form.register('nombre')} placeholder="Paracetamol 500 mg tabletas" />
                <FieldError message={form.formState.errors.nombre?.message} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Categoría</label>
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
                          <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={form.formState.errors.categoriaId?.message} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Laboratorio</label>
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
                          <SelectItem key={laboratory.id} value={laboratory.id}>{laboratory.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Unidad de medida</label>
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

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Precio de venta</label>
                <Input
                  type="number"
                  step="0.01"
                  {...form.register('precioVenta', { valueAsNumber: true })}
                />
                <FieldError message={form.formState.errors.precioVenta?.message} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Costo referencial</label>
                <Input
                  type="number"
                  step="0.01"
                  {...form.register('costoReferencia', { valueAsNumber: true })}
                />
                <FieldError message={form.formState.errors.costoReferencia?.message} />
              </div>
            </div>

            <div className="grid gap-3 rounded-xl border p-3 md:grid-cols-2">
              <Controller
                control={form.control}
                name="requiereReceta"
                render={({ field }) => (
                  <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Requiere receta</p>
                    </div>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </label>
                )}
              />

              <Controller
                control={form.control}
                name="esControlado"
                render={({ field }) => (
                  <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Producto controlado</p>
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
                size="sm"
                onClick={() => {
                  setIsCreateDialogOpen(false)
                  form.reset(defaultFormValues)
                }}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} size="sm">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar producto'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
