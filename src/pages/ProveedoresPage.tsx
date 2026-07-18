import { useMemo, useState } from 'react'
import {
  ClipboardCheck,
  Search,
  ShieldAlert,
  Truck,
  Warehouse,
  ChevronDown,
  MoreVertical,
  Edit,
  History,
  Trash2,
  Plus,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  supplierAlerts,
  supplierDocuments,
  supplierRecords,
  type SupplierCategory,
  type SupplierStatus,
} from '@/modules/suppliers/mock-data'

function getStatusVariant(status: SupplierStatus) {
  if (status === 'ACTIVO') return 'success'
  if (status === 'OBSERVADO') return 'warning'
  return 'outline'
}

function getCategoryVariant(category: SupplierCategory) {
  if (category === 'LABORATORIO') return 'info'
  if (category === 'CADENA_FRIO') return 'warning'
  if (category === 'DROGUERIA') return 'success'
  return 'outline'
}

export function ProveedoresPage() {
  const [search, setSearch] = useState('')
  const [showSummary, setShowSummary] = useState(true)

  const filteredSuppliers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return supplierRecords.filter((supplier) => {
      if (normalizedSearch.length === 0) {
        return true
      }

      return (
        supplier.businessName.toLowerCase().includes(normalizedSearch) ||
        supplier.taxId.toLowerCase().includes(normalizedSearch) ||
        supplier.contactName.toLowerCase().includes(normalizedSearch) ||
        supplier.email.toLowerCase().includes(normalizedSearch)
      )
    })
  }, [search])

  const supplierMetrics = useMemo(() => {
    const activeCount = supplierRecords.filter((supplier) => supplier.status === 'ACTIVO').length
    const observedCount = supplierRecords.filter(
      (supplier) => supplier.status === 'OBSERVADO',
    ).length
    const avgServiceLevel = Math.round(
      supplierRecords.reduce((sum, supplier) => sum + supplier.serviceLevel, 0) /
        supplierRecords.length,
    )
    const activePortfolio = supplierRecords.reduce(
      (sum, supplier) => sum + supplier.activeProducts,
      0,
    )

    return { activeCount, observedCount, avgServiceLevel, activePortfolio }
  }, [])

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
              <span className="text-lg font-bold text-foreground">{supplierMetrics.activeCount}</span>
              <span className="text-xs text-muted-foreground">Activos</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <ShieldAlert className="h-4 w-4 text-warning" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{supplierMetrics.observedCount}</span>
              <span className="text-xs text-muted-foreground">Observados</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{supplierMetrics.avgServiceLevel}%</span>
              <span className="text-xs text-muted-foreground">Servicio</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <Truck className="h-4 w-4 text-info" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{supplierMetrics.activePortfolio}</span>
              <span className="text-xs text-muted-foreground">Portafolio</span>
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
          <Button type="button" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nuevo proveedor
          </Button>
        </div>

        <TabsContent value="padron" className="space-y-4 pt-4">
          <Card className="p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por razón social, RUC, contacto o correo"
                className="pl-9"
              />
            </div>
          </Card>

          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3">
            {filteredSuppliers.map((supplier) => (
              <Card key={supplier.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{supplier.businessName}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {supplier.country} · {supplier.taxId}
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
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <Badge variant={getCategoryVariant(supplier.category)}>
                    {supplier.category}
                  </Badge>
                  <Badge variant={supplier.serviceLevel >= 95 ? 'success' : 'warning'}>
                    {supplier.serviceLevel}%
                  </Badge>
                  <Badge variant={getStatusVariant(supplier.status)}>
                    {supplier.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {supplier.contactName} · {supplier.phone}
                </p>
              </Card>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proveedor</TableHead>
                      <TableHead className="hidden lg:table-cell">Categoría</TableHead>
                      <TableHead className="hidden md:table-cell">Contacto</TableHead>
                      <TableHead className="hidden lg:table-cell">Lead time</TableHead>
                      <TableHead>Servicio</TableHead>
                      <TableHead className="hidden md:table-cell">Portafolio</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="w-[80px] text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSuppliers.map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{supplier.businessName}</p>
                            <p className="text-xs text-muted-foreground hidden sm:block">
                              {supplier.country} · {supplier.taxId}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge variant={getCategoryVariant(supplier.category)}>
                            {supplier.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {supplier.contactName}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {supplier.leadTimeDays} días
                        </TableCell>
                        <TableCell>
                          <Badge variant={supplier.serviceLevel >= 95 ? 'success' : 'warning'}>
                            {supplier.serviceLevel}%
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {supplier.activeProducts} SKU
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(supplier.status)}>
                            {supplier.status}
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

        <TabsContent value="documentos" className="space-y-4 pt-4">
          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3">
            {supplierDocuments.map((document) => (
              <Card key={document.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{document.supplierName}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {document.documentType}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <Badge
                    variant={
                      document.status === 'VIGENTE'
                        ? 'success'
                        : document.status === 'POR_VENCER'
                          ? 'warning'
                          : 'destructive'
                    }
                  >
                    {document.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Vence: {document.expiresAt}
                </p>
              </Card>
            ))}
          </div>

          {/* Desktop Table View */}
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
                          <Badge
                            variant={
                              document.status === 'VIGENTE'
                                ? 'success'
                                : document.status === 'POR_VENCER'
                                  ? 'warning'
                                  : 'destructive'
                            }
                          >
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
          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3">
            {supplierAlerts.map((alert) => (
              <Card key={alert.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {alert.supplierName}
                    </p>
                  </div>
                  <Badge
                    variant={
                      alert.priority === 'ALTA'
                        ? 'warning'
                        : alert.priority === 'MEDIA'
                          ? 'info'
                          : 'outline'
                    }
                  >
                    {alert.priority}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{alert.note}</p>
              </Card>
            ))}
          </div>

          {/* Desktop Table View */}
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
                        <TableCell className="font-medium text-foreground">
                          {alert.title}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {alert.supplierName}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {alert.note}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              alert.priority === 'ALTA'
                                ? 'warning'
                                : alert.priority === 'MEDIA'
                                  ? 'info'
                                  : 'outline'
                            }
                          >
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
    </div>
  )
}
