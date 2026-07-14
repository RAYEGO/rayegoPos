import { useMemo, useState } from 'react'
import {
  HeartPulse,
  PhoneCall,
  Search,
  ShieldAlert,
  UserRoundSearch,
  Users,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
    <div className="space-y-6">
      <PageHeader title="Clientes" />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>Padrón comercial y sanitario</CardTitle>
            <CardDescription>
              Fichas de clientes listas para ventas, seguimiento y control de dispensación.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Activos
              </p>
              <p className="mt-2 text-display text-foreground">{customerMetrics.activeCount}</p>
              <p className="text-small text-muted-foreground">clientes operativos</p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Frecuentes
              </p>
              <p className="mt-2 text-display text-foreground">
                {customerMetrics.frequentCount}
              </p>
              <p className="text-small text-muted-foreground">con recurrencia de compra</p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Observados
              </p>
              <p className="mt-2 text-display text-foreground">
                {customerMetrics.observedCount}
              </p>
              <p className="text-small text-muted-foreground">requieren revision</p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Facturación
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {formatCurrency(customerMetrics.totalBilling)}
              </p>
              <p className="text-small text-muted-foreground">valor acumulado del padrón</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Valor operativo</CardTitle>
            <CardDescription>
              Este módulo ya ayuda a vender mejor y a controlar seguimiento clínico básico.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Historial de compra</p>
              <p className="mt-1 text-small text-muted-foreground">
                Identifica recurrencia, ticket promedio y hábitos de recompra.
              </p>
            </div>
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Dispensación segura</p>
              <p className="mt-1 text-small text-muted-foreground">
                Facilita seguimiento a antibióticos y validaciones de receta pendientes.
              </p>
            </div>
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Fidelización</p>
              <p className="mt-1 text-small text-muted-foreground">
                Prepara campañas futuras por segmento, frecuencia y valor comercial.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="padron">
        <TabsList className="grid w-full grid-cols-3 lg:w-fit">
          <TabsTrigger value="padron">Padrón</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="seguimiento">Seguimiento</TabsTrigger>
        </TabsList>

        <TabsContent value="padron" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Base de clientes
                </CardTitle>
                <CardDescription>
                  Registro unificado con documento, contacto, segmento y frecuencia.
                </CardDescription>
              </div>
              <Button type="button" size="sm">
                Nuevo cliente
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nombre, documento, teléfono o distrito"
                  className="pl-9"
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Última compra</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{customer.fullName}</p>
                          <p className="text-small text-muted-foreground">{customer.district}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {customer.documentType} {customer.documentNumber}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-foreground">{customer.phone}</p>
                          <p className="text-small text-muted-foreground">
                            {customer.visitCount} visitas
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {customer.lastPurchaseAt}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {formatCurrency(customer.totalSpent)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getSegmentVariant(customer.segment)}>
                          {customer.segment}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(customer.status)}>
                          {customer.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historial" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserRoundSearch className="h-5 w-5 text-primary" />
                  Historial reciente de compras
                </CardTitle>
                <CardDescription>
                  Vista rápida para atención en mostrador y análisis de recompra.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Venta</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Resumen</TableHead>
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
                        <TableCell className="text-muted-foreground">
                          {purchase.createdAt}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PhoneCall className="h-5 w-5 text-primary" />
                  Oportunidades de contacto
                </CardTitle>
                <CardDescription>
                  Acciones comerciales simples a partir de frecuencia y valor.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Clientes frecuentes</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Priorizar recordatorios de recompra para analgésicos y tratamiento continuo.
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Cuenta corporativa</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Mantener seguimiento a clientes institucionales con mayor ticket acumulado.
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Clientes ocasionales</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Preparar campañas de retorno con base en la última compra y categoría adquirida.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="seguimiento" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HeartPulse className="h-5 w-5 text-primary" />
                  Seguimiento farmacéutico
                </CardTitle>
                <CardDescription>
                  Tareas abiertas para continuidad de tratamiento y validaciones pendientes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Nota</TableHead>
                      <TableHead>Fecha</TableHead>
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
                        <TableCell className="text-muted-foreground">
                          {item.note}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{item.dueAt}</TableCell>
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  Reglas de atención
                </CardTitle>
                <CardDescription>
                  Buenas prácticas para tratar datos, recetas y continuidad de compra.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Validar identidad</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Confirmar documento antes de relacionar recetas y compras sensibles.
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Proteger observaciones</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Los clientes observados deben revisarse antes de una nueva dispensación controlada.
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Cerrar seguimiento</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Toda alerta atendida debe quedar documentada para futuras atenciones.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
