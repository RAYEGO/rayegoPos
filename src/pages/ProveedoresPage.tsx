import { useMemo, useState } from 'react'
import {
  ClipboardCheck,
  FileCheck2,
  Search,
  ShieldAlert,
  Truck,
  Warehouse,
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
    <div className="space-y-6">
      <PageHeader title="Proveedores" />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>Base de abastecimiento</CardTitle>
            <CardDescription>
              Padrón de proveedores listo para compras, compliance y seguimiento comercial.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Activos
              </p>
              <p className="mt-2 text-display text-foreground">{supplierMetrics.activeCount}</p>
              <p className="text-small text-muted-foreground">proveedores operativos</p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Observados
              </p>
              <p className="mt-2 text-display text-foreground">
                {supplierMetrics.observedCount}
              </p>
              <p className="text-small text-muted-foreground">requieren seguimiento</p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Nivel de servicio
              </p>
              <p className="mt-2 text-display text-foreground">
                {supplierMetrics.avgServiceLevel}%
              </p>
              <p className="text-small text-muted-foreground">promedio del padrón</p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Portafolio activo
              </p>
              <p className="mt-2 text-display text-foreground">
                {supplierMetrics.activePortfolio}
              </p>
              <p className="text-small text-muted-foreground">productos relacionados</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uso operativo</CardTitle>
            <CardDescription>
              Este módulo complementa compras y ayuda a decidir con quién reabastecer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Lead time</p>
              <p className="mt-1 text-small text-muted-foreground">
                Ayuda a priorizar órdenes para productos críticos o por vencer.
              </p>
            </div>
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Documentación</p>
              <p className="mt-1 text-small text-muted-foreground">
                Permite anticipar vencimientos de certificados y registros sanitarios.
              </p>
            </div>
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Rendimiento comercial</p>
              <p className="mt-1 text-small text-muted-foreground">
                Resume cumplimiento, cobertura y alertas por proveedor.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="padron">
        <TabsList className="grid w-full grid-cols-3 lg:w-fit">
          <TabsTrigger value="padron">Padrón</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="alertas">Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="padron" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Warehouse className="h-5 w-5 text-primary" />
                  Registro de proveedores
                </CardTitle>
                <CardDescription>
                  Ficha maestra con categoría, contacto, cumplimiento y cobertura comercial.
                </CardDescription>
              </div>
              <Button type="button" size="sm">
                Nuevo proveedor
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por razón social, RUC, contacto o correo"
                  className="pl-9"
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Lead time</TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Portafolio</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{supplier.businessName}</p>
                          <p className="text-small text-muted-foreground">
                            {supplier.country} · {supplier.taxId}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getCategoryVariant(supplier.category)}>
                          {supplier.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-foreground">{supplier.contactName}</p>
                          <p className="text-small text-muted-foreground">
                            {supplier.phone} · {supplier.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {supplier.leadTimeDays} días
                      </TableCell>
                      <TableCell>
                        <Badge variant={supplier.serviceLevel >= 95 ? 'success' : 'warning'}>
                          {supplier.serviceLevel}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {supplier.activeProducts} SKU
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(supplier.status)}>
                          {supplier.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentos" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck2 className="h-5 w-5 text-primary" />
                  Documentación y vigencia
                </CardTitle>
                <CardDescription>
                  Control simple de contratos, listas de precios y soporte sanitario.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead>Vence</TableHead>
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
                        <TableCell className="text-muted-foreground">
                          {document.reference}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  Buenas prácticas
                </CardTitle>
                <CardDescription>
                  Controles mínimos antes de emitir o renovar compras relevantes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Validar vigencia documental</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Ningún proveedor crítico debería operar con documentación vencida.
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Revisar condiciones comerciales</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Confirmar precio, plazo y entregas antes de nuevas órdenes grandes.
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Registrar soporte sanitario</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Especialmente importante en cadena de frío y productos sensibles.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alertas" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  Alertas de proveedores
                </CardTitle>
                <CardDescription>
                  Seguimiento a caídas de servicio, documentos y condiciones comerciales.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {supplierAlerts.map((alert) => (
                  <div key={alert.id} className="rounded-2xl border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-foreground">{alert.title}</p>
                        <p className="mt-1 text-small text-muted-foreground">
                          {alert.supplierName}
                        </p>
                        <p className="mt-2 text-small text-muted-foreground">{alert.note}</p>
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
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  Reglas de gestión
                </CardTitle>
                <CardDescription>
                  Criterios simples para mantener una red de abastecimiento saludable.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Escalar proveedores observados</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Si el nivel de servicio cae o se repiten incidencias, revisar continuidad.
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Diversificar críticos</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Los productos de alta rotación no deberían depender de una sola fuente.
                  </p>
                </div>
                <div className="rounded-2xl border p-4">
                  <p className="font-medium text-foreground">Cerrar alertas con evidencia</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Toda alerta atendida debe documentar la acción comercial o sanitaria tomada.
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
