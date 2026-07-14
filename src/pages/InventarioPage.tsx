import { useMemo, useState } from 'react'
import {
  ArrowRightLeft,
  Boxes,
  History,
  Search,
  TriangleAlert,
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
  branchInventorySummary,
  inventoryLots,
  inventoryMovements,
  type InventoryLotRecord,
  type InventoryLotStatus,
  type InventoryMovementType,
} from '@/modules/inventory/mock-data'

function getLotStatusVariant(status: InventoryLotStatus) {
  if (status === 'DISPONIBLE') return 'success'
  if (status === 'POR_VENCER') return 'warning'
  if (status === 'BLOQUEADO') return 'destructive'
  return 'outline'
}

function getMovementVariant(type: InventoryMovementType) {
  if (type === 'INGRESO') return 'success'
  if (type === 'SALIDA') return 'warning'
  if (type === 'AJUSTE') return 'destructive'
  return 'info'
}

function getStorageVariant(condition: InventoryLotRecord['storageCondition']) {
  return condition === 'REFRIGERADO' ? 'info' : 'outline'
}

export function InventarioPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'TODOS' | InventoryLotStatus>('TODOS')
  const [branchFilter, setBranchFilter] = useState('TODAS')

  const filteredLots = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return inventoryLots.filter((lot) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        lot.productName.toLowerCase().includes(normalizedSearch) ||
        lot.sku.toLowerCase().includes(normalizedSearch) ||
        lot.lotCode.toLowerCase().includes(normalizedSearch) ||
        lot.supplierName.toLowerCase().includes(normalizedSearch)

      const matchesStatus = statusFilter === 'TODOS' || lot.status === statusFilter
      const matchesBranch = branchFilter === 'TODAS' || lot.branchName === branchFilter

      return matchesSearch && matchesStatus && matchesBranch
    })
  }, [branchFilter, search, statusFilter])

  const inventoryMetrics = useMemo(() => {
    const totalUnits = inventoryLots.reduce((sum, lot) => sum + lot.availableUnits, 0)
    const expiringSoon = inventoryLots.filter((lot) => lot.status === 'POR_VENCER').length
    const coldChain = inventoryLots.filter(
      (lot) => lot.storageCondition === 'REFRIGERADO',
    ).length
    const blocked = inventoryLots.filter((lot) => lot.status === 'BLOQUEADO').length

    return { totalUnits, expiringSoon, coldChain, blocked }
  }, [])

  const fifoCandidates = useMemo(
    () =>
      [...inventoryLots]
        .filter((lot) => lot.availableUnits > 0)
        .sort((a, b) => a.fifoPriority - b.fifoPriority || a.expiryDate.localeCompare(b.expiryDate))
        .slice(0, 5),
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Inventario" />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>Control operativo por lotes</CardTitle>
            <CardDescription>
              Inventario preparado para FIFO, vencimientos y trazabilidad por sucursal.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Unidades disponibles
              </p>
              <p className="mt-2 text-display text-foreground">{inventoryMetrics.totalUnits}</p>
              <p className="text-small text-muted-foreground">
                stock utilizable a nivel de lotes
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Por vencer
              </p>
              <p className="mt-2 text-display text-foreground">
                {inventoryMetrics.expiringSoon}
              </p>
              <p className="text-small text-muted-foreground">
                requieren rotacion o accion comercial
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Cadena de frio
              </p>
              <p className="mt-2 text-display text-foreground">{inventoryMetrics.coldChain}</p>
              <p className="text-small text-muted-foreground">
                lotes con custodia diferenciada
              </p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground">
                Bloqueados
              </p>
              <p className="mt-2 text-display text-foreground">{inventoryMetrics.blocked}</p>
              <p className="text-small text-muted-foreground">
                retenidos para revision interna
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vista por sucursal</CardTitle>
            <CardDescription>
              Cobertura consolidada antes de compras, transferencias o reposicion.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {branchInventorySummary.map((branch) => (
              <div key={branch.branchName} className="rounded-2xl border p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-medium text-foreground">{branch.branchName}</p>
                  <Badge variant="outline">{branch.lotCount} lotes</Badge>
                </div>
                <p className="mt-2 text-small text-muted-foreground">
                  {branch.skuCount} SKU · {branch.availableUnits} unidades ·{' '}
                  {branch.expiringSoonCount} por vencer
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="lotes">
        <TabsList className="grid w-full grid-cols-3 lg:w-fit">
          <TabsTrigger value="lotes">Stock por lotes</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="alertas">Alertas y FIFO</TabsTrigger>
        </TabsList>

        <TabsContent value="lotes" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Boxes className="h-5 w-5 text-primary" />
                  Stock por lote
                </CardTitle>
                <CardDescription>
                  Seguimiento fino de disponibilidad, reservas, proveedor y fecha de vencimiento.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm">
                  <ArrowRightLeft className="h-4 w-4" />
                  Transferir stock
                </Button>
                <Button type="button" size="sm">
                  Registrar ingreso
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.45fr_0.55fr]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por producto, SKU, lote o proveedor"
                    className="pl-9"
                  />
                </div>

                <Select
                  value={statusFilter}
                  onValueChange={(value) =>
                    setStatusFilter(value as 'TODOS' | InventoryLotStatus)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Estado del lote" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos los estados</SelectItem>
                    <SelectItem value="DISPONIBLE">Disponible</SelectItem>
                    <SelectItem value="POR_VENCER">Por vencer</SelectItem>
                    <SelectItem value="BLOQUEADO">Bloqueado</SelectItem>
                    <SelectItem value="AGOTADO">Agotado</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAS">Todas las sucursales</SelectItem>
                    {branchInventorySummary.map((branch) => (
                      <SelectItem key={branch.branchName} value={branch.branchName}>
                        {branch.branchName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Sucursal</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Custodia</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLots.map((lot) => (
                    <TableRow key={lot.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{lot.productName}</p>
                          <p className="text-small text-muted-foreground">{lot.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{lot.lotCode}</p>
                          <p className="text-small text-muted-foreground">
                            proveedor {lot.supplierName}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{lot.branchName}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{lot.availableUnits} und</p>
                          <p className="text-small text-muted-foreground">
                            {lot.reservedUnits} reservadas
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{lot.expiryDate}</p>
                          <p className="text-small text-muted-foreground">
                            ingreso {lot.receivedAt}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={getStorageVariant(lot.storageCondition)}>
                            {lot.storageCondition}
                          </Badge>
                          <Badge variant="outline">FIFO {lot.fifoPriority}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getLotStatusVariant(lot.status)}>{lot.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movimientos" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Kardex operativo
              </CardTitle>
              <CardDescription>
                Entradas, salidas, ajustes y transferencias con referencia trazable.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead>Responsable</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventoryMovements.map((movement) => (
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
                          <p className="font-medium text-foreground">{movement.productName}</p>
                          <p className="text-small text-muted-foreground">
                            {movement.branchName}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{movement.lotCode}</TableCell>
                      <TableCell className="font-medium text-foreground">
                        {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {movement.reference}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {movement.actorName}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alertas" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TriangleAlert className="h-5 w-5 text-primary" />
                  Alertas de vencimiento y bloqueo
                </CardTitle>
                <CardDescription>
                  Lotes que requieren salida prioritaria, bloqueo o accion comercial.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {inventoryLots
                  .filter((lot) => lot.status === 'POR_VENCER' || lot.status === 'BLOQUEADO')
                  .map((lot) => (
                    <div key={lot.id} className="rounded-2xl border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-foreground">{lot.productName}</p>
                          <p className="mt-1 text-small text-muted-foreground">
                            {lot.lotCode} · {lot.branchName} · vence {lot.expiryDate}
                          </p>
                        </div>
                        <Badge variant={getLotStatusVariant(lot.status)}>{lot.status}</Badge>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recomendacion FIFO</CardTitle>
                <CardDescription>
                  Orden sugerido de salida para disminuir mermas por expiracion.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {fifoCandidates.map((lot, index) => (
                  <div key={lot.id} className="rounded-2xl border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-foreground">
                          {index + 1}. {lot.productName}
                        </p>
                        <p className="mt-1 text-small text-muted-foreground">
                          {lot.lotCode} · {lot.availableUnits} und · vence {lot.expiryDate}
                        </p>
                      </div>
                      <Badge variant="info">FIFO {lot.fifoPriority}</Badge>
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
