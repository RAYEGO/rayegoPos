import { useMemo, useState } from 'react'
import {
  PhoneCall,
  Search,
  ShieldAlert,
  UserRoundSearch,
  Users,
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
  customerFollowUps,
  customerPurchases,
  customerRecords,
  type CustomerSegment,
  type CustomerStatus,
} from '@/modules/customers/mock-data'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(value)
}

function getStatusVariant(status: CustomerStatus) {
  if (status === 'ACTIVO') return 'success'
  if (status === 'OBSERVADO') return 'warning'
  return 'outline'
}

function getSegmentVariant(segment: CustomerSegment) {
  if (segment === 'FRECUENTE') return 'info'
  if (segment === 'CORPORATIVO') return 'success'
  return 'outline'
}

export function ClientesPage() {
  const [search, setSearch] = useState('')
  const [showSummary, setShowSummary] = useState(true)

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return customerRecords.filter((customer) => {
      if (normalizedSearch.length === 0) {
        return true
      }

      return (
        customer.fullName.toLowerCase().includes(normalizedSearch) ||
        customer.documentNumber.toLowerCase().includes(normalizedSearch) ||
        customer.phone.toLowerCase().includes(normalizedSearch) ||
        customer.district.toLowerCase().includes(normalizedSearch)
      )
    })
  }, [search])

  const customerMetrics = useMemo(() => {
    const activeCount = customerRecords.filter((customer) => customer.status === 'ACTIVO').length
    const frequentCount = customerRecords.filter(
      (customer) => customer.segment === 'FRECUENTE',
    ).length
    const observedCount = customerRecords.filter(
      (customer) => customer.status === 'OBSERVADO',
    ).length
    const totalBilling = customerRecords.reduce(
      (sum, customer) => sum + customer.totalSpent,
      0,
    )

    return { activeCount, frequentCount, observedCount, totalBilling }
  }, [])

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
              <span className="text-lg font-bold text-foreground">{customerMetrics.activeCount}</span>
              <span className="text-xs text-muted-foreground">Activos</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <UserRoundSearch className="h-4 w-4 text-info" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{customerMetrics.frequentCount}</span>
              <span className="text-xs text-muted-foreground">Frecuentes</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <ShieldAlert className="h-4 w-4 text-warning" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{customerMetrics.observedCount}</span>
              <span className="text-xs text-muted-foreground">Observados</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <PhoneCall className="h-4 w-4 text-primary" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">
                {formatCurrency(customerMetrics.totalBilling)}
              </span>
              <span className="text-xs text-muted-foreground">Facturación</span>
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
          <Button type="button" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nuevo cliente
          </Button>
        </div>

        <TabsContent value="padron" className="space-y-4 pt-4">
          <Card className="p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre, documento, teléfono o distrito"
                className="pl-9"
              />
            </div>
          </Card>

          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3">
            {filteredCustomers.map((customer) => (
              <Card key={customer.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{customer.fullName}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {customer.district} · {customer.visitCount} visitas
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
                  <Badge variant={getSegmentVariant(customer.segment)}>
                    {customer.segment}
                  </Badge>
                  <Badge variant={getStatusVariant(customer.status)}>
                    {customer.status}
                  </Badge>
                  <p className="font-medium text-sm text-foreground">{formatCurrency(customer.totalSpent)}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {customer.documentType} {customer.documentNumber} · {customer.phone}
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
                      <TableHead>Cliente</TableHead>
                      <TableHead className="hidden lg:table-cell">Documento</TableHead>
                      <TableHead className="hidden md:table-cell">Contacto</TableHead>
                      <TableHead className="hidden lg:table-cell">Última compra</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead className="hidden md:table-cell">Segmento</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="w-[80px] text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{customer.fullName}</p>
                            <p className="text-xs text-muted-foreground hidden sm:block">{customer.district}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {customer.documentType} {customer.documentNumber}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {customer.phone}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {customer.lastPurchaseAt}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {formatCurrency(customer.totalSpent)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant={getSegmentVariant(customer.segment)}>
                            {customer.segment}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(customer.status)}>
                            {customer.status}
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

        <TabsContent value="historial" className="space-y-4 pt-4">
          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3">
            {customerPurchases.map((purchase) => (
              <Card key={purchase.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{purchase.customerName}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {purchase.saleCode} · {purchase.createdAt}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <Badge variant="outline">{purchase.paymentMethod}</Badge>
                  <p className="font-medium text-sm text-foreground">{formatCurrency(purchase.totalAmount)}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{purchase.itemSummary}</p>
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
                      <TableHead>Cliente</TableHead>
                      <TableHead>Venta</TableHead>
                      <TableHead className="hidden md:table-cell">Fecha</TableHead>
                      <TableHead className="hidden lg:table-cell">Resumen</TableHead>
                      <TableHead>Pago</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerPurchases.map((purchase) => (
                      <TableRow key={purchase.id}>
                        <TableCell className="font-medium text-foreground">
                          {purchase.customerName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {purchase.saleCode}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {purchase.createdAt}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {purchase.itemSummary}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{purchase.paymentMethod}</Badge>
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {formatCurrency(purchase.totalAmount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="seguimiento" className="space-y-4 pt-4">
          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3">
            {customerFollowUps.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{item.customerName}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.productName}
                    </p>
                  </div>
                  <Badge
                    variant={
                      item.priority === 'ALTA'
                        ? 'warning'
                        : item.priority === 'MEDIA'
                          ? 'info'
                          : 'outline'
                    }
                  >
                    {item.priority}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{item.note}</p>
                <p className="text-xs text-muted-foreground mt-1">Vence: {item.dueAt}</p>
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
                      <TableHead>Cliente</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="hidden md:table-cell">Nota</TableHead>
                      <TableHead className="hidden lg:table-cell">Fecha</TableHead>
                      <TableHead>Prioridad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerFollowUps.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-foreground">
                          {item.customerName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.productName}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {item.note}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">{item.dueAt}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.priority === 'ALTA'
                                ? 'warning'
                                : item.priority === 'MEDIA'
                                  ? 'info'
                                  : 'outline'
                            }
                          >
                            {item.priority}
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
