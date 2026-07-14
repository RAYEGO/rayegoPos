import { useMemo, useState } from 'react'
import {
  ArrowUpDown,
  ClipboardList,
  PackagePlus,
  Pill,
  Search,
  ShieldAlert,
  TestTubeDiagonal,
} from 'lucide-react'
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
import { Input } from '@/components/ui/input'
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
import {
  activePrinciples,
  laboratories,
  productCategories,
  productRecords,
  type ProductRecord,
  type ProductStatus,
} from '@/modules/products/mock-data'

function getProductStatusVariant(status: ProductStatus) {
  if (status === 'ACTIVO') return 'success'
  if (status === 'BAJO_REVISION') return 'warning'
  return 'outline'
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(value)
}

function getStockVariant(product: ProductRecord) {
  if (product.stockUnits === 0) return 'destructive'
  if (product.stockUnits <= 20 || product.lotCount <= 1) return 'warning'
  return 'success'
}

export function ProductosPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'TODOS' | ProductStatus>('TODOS')
  const [categoryFilter, setCategoryFilter] = useState('TODAS')

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return productRecords.filter((product) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.sku.toLowerCase().includes(normalizedSearch) ||
        product.genericName.toLowerCase().includes(normalizedSearch) ||
        product.laboratory.toLowerCase().includes(normalizedSearch)

      const matchesStatus =
        statusFilter === 'TODOS' || product.status === statusFilter

      const matchesCategory =
        categoryFilter === 'TODAS' || product.category === categoryFilter

      return matchesSearch && matchesStatus && matchesCategory
    })
  }, [categoryFilter, search, statusFilter])

  const portfolioMetrics = useMemo(() => {
    const lowStockCount = productRecords.filter((product) => product.stockUnits <= 20).length
    const withPrescription = productRecords.filter(
      (product) => product.requiresPrescription,
    ).length
    const lotEnabled = productRecords.filter((product) => product.lotCount > 0).length

    return {
      activeCatalog: productRecords.filter((product) => product.status === 'ACTIVO').length,
      lowStockCount,
      withPrescription,
      lotEnabled,
    }
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader title="Productos" />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>Base maestra del catalogo</CardTitle>
            <CardDescription>
              Catalogo farmacéutico preparado para enlazar precios, stock por lote y compras.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                SKU activos
              </p>
              <p className="mt-2 text-display text-foreground">{portfolioMetrics.activeCatalog}</p>
              <p className="text-small text-muted-foreground">
                listos para operaciones de venta
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Bajo stock
              </p>
              <p className="mt-2 text-display text-foreground">{portfolioMetrics.lowStockCount}</p>
              <p className="text-small text-muted-foreground">
                productos que pediran reposicion
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Con receta
              </p>
              <p className="mt-2 text-display text-foreground">
                {portfolioMetrics.withPrescription}
              </p>
              <p className="text-small text-muted-foreground">
                requieren control de dispensacion
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Con lotes
              </p>
              <p className="mt-2 text-display text-foreground">{portfolioMetrics.lotEnabled}</p>
              <p className="text-small text-muted-foreground">
                ya conectables con FIFO y vencimiento
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Siguiente impacto operativo</CardTitle>
            <CardDescription>
              Este modulo ya queda orientado a lo que sigue en inventario.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Lotes y expiracion</p>
              <p className="mt-1 text-small text-muted-foreground">
                Cada SKU ya muestra cobertura, lotes y proximo vencimiento como base visual.
              </p>
            </div>
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Compras y recepcion</p>
              <p className="mt-1 text-small text-muted-foreground">
                El catalogo ya tiene costo, laboratorio y presentacion para entradas futuras.
              </p>
            </div>
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Dispensacion segura</p>
              <p className="mt-1 text-small text-muted-foreground">
                Separamos receta, controlados y cadena de frio para trazabilidad posterior.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="catalogo">
        <TabsList className="grid w-full grid-cols-3 lg:w-fit">
          <TabsTrigger value="catalogo">Catalogo</TabsTrigger>
          <TabsTrigger value="maestros">Maestros</TabsTrigger>
          <TabsTrigger value="inventario">Puente a inventario</TabsTrigger>
        </TabsList>

        <TabsContent value="catalogo" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <PackagePlus className="h-5 w-5 text-primary" />
                  Catalogo de productos
                </CardTitle>
                <CardDescription>
                  Vista operativa del maestro de productos con enfoque farmaceutico.
                </CardDescription>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm">
                  <ArrowUpDown className="h-4 w-4" />
                  Exportar catalogo
                </Button>
                <Button type="button" size="sm">
                  <PackagePlus className="h-4 w-4" />
                  Nuevo producto
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.5fr_0.5fr]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por SKU, nombre, generico o laboratorio"
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
                    <SelectItem value="BAJO_REVISION">Bajo revision</SelectItem>
                    <SelectItem value="DESCONTINUADO">Descontinuado</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAS">Todas las categorias</SelectItem>
                    {productCategories.map((category) => (
                      <SelectItem key={category.name} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Clasificacion</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Lotes</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{product.name}</p>
                          <p className="text-small text-muted-foreground">
                            {product.sku} · {product.presentation}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Badge variant="outline">{product.category}</Badge>
                          <p className="text-small text-muted-foreground">
                            {product.genericName} · {product.laboratory}
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
                            {product.stockUnits} und
                          </Badge>
                          <p className="text-small text-muted-foreground">
                            {product.reservedUnits} reservadas
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
                        {product.nextExpiry}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={getProductStatusVariant(product.status)}>
                            {product.status}
                          </Badge>
                          {product.requiresPrescription ? (
                            <Badge variant="warning">Receta</Badge>
                          ) : null}
                          {product.coldChain ? (
                            <Badge variant="info">Frio</Badge>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maestros" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Categorias
                </CardTitle>
                <CardDescription>
                  Agrupacion comercial lista para listas, filtros y reportes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {productCategories.map((category) => (
                  <div key={category.name} className="rounded-2xl border p-4">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-medium text-foreground">{category.name}</p>
                      <Badge variant="outline">{category.skuCount} SKU</Badge>
                    </div>
                    <p className="mt-1 text-small text-muted-foreground">
                      {category.activeCount} referencias activas en catalogo.
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TestTubeDiagonal className="h-5 w-5 text-primary" />
                  Laboratorios
                </CardTitle>
                <CardDescription>
                  Base para compras, trazabilidad y analisis por proveedor.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {laboratories.map((laboratory) => (
                  <div key={laboratory.name} className="rounded-2xl border p-4">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-medium text-foreground">{laboratory.name}</p>
                      <Badge variant="info">{laboratory.country}</Badge>
                    </div>
                    <p className="mt-1 text-small text-muted-foreground">
                      {laboratory.skuCount} SKU asociados al laboratorio.
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pill className="h-5 w-5 text-primary" />
                  Principios activos
                </CardTitle>
                <CardDescription>
                  Punto de partida para equivalencias y busquedas por generico.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {activePrinciples.map((principle) => (
                  <div key={principle.name} className="rounded-2xl border p-4">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-medium text-foreground">{principle.name}</p>
                      <Badge variant="outline">{principle.form}</Badge>
                    </div>
                    <p className="mt-1 text-small text-muted-foreground">
                      {principle.productCount} productos derivados en el maestro.
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="inventario" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <CardHeader>
                <CardTitle>Preparacion para inventario por lotes</CardTitle>
                <CardDescription>
                  Lo que ya queda cubierto desde productos para el siguiente modulo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Identificacion del SKU</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Codigo, nombre comercial, generico, concentracion y presentacion estandarizados.
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Politicas de dispensacion</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    El catalogo diferencia receta, controlados y cadena de frio para reglas futuras.
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Costo y cobertura</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Ya se ve costo base, sucursales y volumen disponible para compras e inventario.
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
                  Casos que inventario debera resolver de inmediato al conectarse.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {productRecords
                  .filter((product) => product.stockUnits <= 20 || product.lotCount <= 1)
                  .map((product) => (
                    <div key={product.id} className="rounded-2xl border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-foreground">{product.name}</p>
                          <p className="mt-1 text-small text-muted-foreground">
                            {product.stockUnits} und · {product.lotCount} lotes · vence {product.nextExpiry}
                          </p>
                        </div>
                        <Badge variant={getStockVariant(product)}>
                          {product.stockUnits === 0 ? 'Sin stock' : 'Atencion'}
                        </Badge>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
