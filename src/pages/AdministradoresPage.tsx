import { Plus, RefreshCw, Shield, UserSearch } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type AdminMock = {
  id: string
  fullName: string
  email: string
  empresaRazonSocial: string
  empresaColor: string
  tipoCodigo: string
  asignadoAt: string
  activo: boolean
}

const MOCK_ADMINS: AdminMock[] = [
  {
    id: '00000000-0000-0000-0000-000000000201',
    fullName: 'Administrador General',
    email: 'admin@rayego.pe',
    empresaRazonSocial: 'Rayego Botica SAC',
    empresaColor: '#2563eb',
    tipoCodigo: 'BOTICA',
    asignadoAt: '2026-01-16T09:15:00.000Z',
    activo: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000202',
    fullName: 'Jefe de Servicios',
    email: 'jefe.servicios@electroservicios.pe',
    empresaRazonSocial: 'Electro Servicios SAC',
    empresaColor: '#16a34a',
    tipoCodigo: 'SERVICIO_TECNICO',
    asignadoAt: '2026-04-03T10:30:00.000Z',
    activo: true,
  },
]

export function AdministradoresPage() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Administradores</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona los administradores de empresa asignados en la plataforma.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-[320px]">
            <UserSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar administrador o empresa…" />
          </div>
          <Button type="button" variant="outline" size="icon" title="Actualizar">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button type="button">
            <Plus className="mr-2 h-4 w-4" />
            Asignar administrador
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MOCK_ADMINS.map((admin) => (
          <Card key={admin.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: admin.empresaColor }}
                  >
                    <Shield className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{admin.fullName}</CardTitle>
                    <CardDescription className="truncate">{admin.email}</CardDescription>
                  </div>
                </div>
                <Badge variant={admin.activo ? 'success' : 'outline'}>
                  {admin.activo ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <div className="mt-3 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Empresa:</span>
                  <span className="truncate font-medium text-foreground">{admin.empresaRazonSocial}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Tipo:</span>
                  <Badge variant="outline" style={{ borderColor: admin.empresaColor, color: admin.empresaColor }}>
                    {admin.tipoCodigo}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Asignado el {new Date(admin.asignadoAt).toLocaleDateString('es-PE')}
                </p>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardDescription className="text-sm">
            Las asignaciones y cambios se procesan en modo demostración hasta activar la persistencia real.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
