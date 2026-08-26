import { Building2, Plus, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type EmpresaMock = {
  id: string
  razonSocial: string
  ruc: string
  tipoCodigo: string
  tipoNombre: string
  color: string
  sucursalesCount: number
  usuariosCount: number
  activo: boolean
  createdAt: string
}

const MOCK_EMPRESAS: EmpresaMock[] = [
  {
    id: '00000000-0000-0000-0000-000000000101',
    razonSocial: 'Rayego Botica SAC',
    ruc: '20612345678',
    tipoCodigo: 'BOTICA',
    tipoNombre: 'Botica / Farmacia',
    color: '#2563eb',
    sucursalesCount: 2,
    usuariosCount: 3,
    activo: true,
    createdAt: '2026-01-15T09:30:00.000Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000102',
    razonSocial: 'Electro Servicios SAC',
    ruc: '20987654321',
    tipoCodigo: 'SERVICIO_TECNICO',
    tipoNombre: 'Servicio Técnico',
    color: '#16a34a',
    sucursalesCount: 1,
    usuariosCount: 2,
    activo: true,
    createdAt: '2026-04-02T11:00:00.000Z',
  },
]

export function EmpresasPage() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Empresas</h1>
          <p className="text-sm text-muted-foreground">Administra las empresas registradas en la plataforma.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input className="w-[280px]" placeholder="Buscar empresa, RUC o tipo…" />
          <Button type="button" variant="outline" size="icon" title="Actualizar">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button type="button">
            <Plus className="mr-2 h-4 w-4" />
            Nueva empresa
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {MOCK_EMPRESAS.map((empresa) => (
          <Card key={empresa.id} className="overflow-hidden">
            <div
              className="h-2"
              style={{ backgroundColor: empresa.color }}
              aria-hidden
            />
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="truncate text-base">{empresa.razonSocial}</CardTitle>
                  </div>
                  <CardDescription className="mt-1">RUC {empresa.ruc}</CardDescription>
                </div>
                <Badge variant={empresa.activo ? 'success' : 'outline'}>
                  {empresa.activo ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline" style={{ borderColor: empresa.color, color: empresa.color }}>
                  {empresa.tipoNombre}
                </Badge>
                <Badge variant="outline">{empresa.sucursalesCount} sucursales</Badge>
                <Badge variant="outline">{empresa.usuariosCount} usuarios</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Registro {new Date(empresa.createdAt).toLocaleDateString('es-PE')}
              </p>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardDescription className="text-sm">
            Las operaciones de creación y edición están habilitadas en modo demostración (sin persistencia en base de datos).
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
