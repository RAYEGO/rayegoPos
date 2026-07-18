import { useState } from 'react'
import { ChevronDown, History, MonitorSmartphone, RefreshCcw, ShieldCheck, UserPlus, Users2 } from 'lucide-react'
import { AuthorizationGate } from '@/components/auth/AuthorizationGate'
import { PermissionBadge } from '@/components/auth/PermissionBadge'
import { RoleBadge } from '@/components/auth/RoleBadge'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  permissionDefinitions,
  permissionModules,
  roleDefinitions,
} from '@/config/authorization'
import { useAuthorization } from '@/hooks/useAuthorization'
import type { AuthPermission } from '@/types/auth'
import {
  auditRecords,
  securitySessions,
  securityUsers,
} from '@/modules/security/mock-data'

function roleGrantsPermission(
  rolePermissions: AuthPermission[],
  permission: Exclude<AuthPermission, '*'>,
) {
  return rolePermissions.includes('*') || rolePermissions.includes(permission)
}

function getUserStatusVariant(status: 'ACTIVO' | 'BLOQUEADO' | 'INVITADO') {
  if (status === 'ACTIVO') return 'success'
  if (status === 'INVITADO') return 'info'
  return 'warning'
}

function getSessionStatusVariant(status: 'ACTIVA' | 'INACTIVA' | 'REVOCADA') {
  if (status === 'ACTIVA') return 'success'
  if (status === 'INACTIVA') return 'warning'
  return 'destructive'
}

function getSeverityVariant(severity: 'INFO' | 'WARNING' | 'CRITICAL') {
  if (severity === 'INFO') return 'info'
  if (severity === 'WARNING') return 'warning'
  return 'destructive'
}

export function UsuariosPage() {
  const { can, hasRole } = useAuthorization()
  const [showSummary, setShowSummary] = useState(false)

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-foreground">Usuarios</h1>
        <Button variant="ghost" size="sm" onClick={() => setShowSummary(!showSummary)}>
          Resumen
          <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${showSummary ? 'rotate-180' : ''}`} />
        </Button>
      </div>

      {showSummary && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <Users2 className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{securityUsers.length}</span>
              <span className="text-xs text-muted-foreground">Usuarios</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <MonitorSmartphone className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{securitySessions.filter((s) => s.status === 'ACTIVA').length}</span>
              <span className="text-xs text-muted-foreground">Sesiones</span>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue={can('usuarios.read') ? 'usuarios' : can('sesiones.read') ? 'sesiones' : 'auditoria'}>
        <TabsList className="grid w-full grid-cols-3 lg:w-fit">
          <TabsTrigger value="usuarios">Gestión de usuarios</TabsTrigger>
          <TabsTrigger value="sesiones">Gestión de sesiones</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoría</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="space-y-6">
          <AuthorizationGate
            permission="usuarios.read"
            fallback={
              <Card>
                <CardContent className="p-6">
                  <Badge variant="warning">No tienes acceso al detalle de usuarios.</Badge>
                </CardContent>
              </Card>
            }
          >
            <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
              <Card>
                <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users2 className="h-5 w-5 text-primary" />
                      Gestión de usuarios
                    </CardTitle>
                    <CardDescription>
                      Estado, rol, MFA y última actividad de cada usuario.
                    </CardDescription>
                  </div>

                  <AuthorizationGate
                    permission="usuarios.manage"
                    fallback={
                      <Button type="button" variant="outline" size="sm" disabled>
                        <UserPlus className="h-4 w-4" />
                        Crear usuario
                      </Button>
                    }
                  >
                    <Button type="button" size="sm">
                      <UserPlus className="h-4 w-4" />
                      Crear usuario
                    </Button>
                  </AuthorizationGate>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead>Sucursal</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>MFA</TableHead>
                        <TableHead>Último acceso</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {securityUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-foreground">{user.fullName}</p>
                              <p className="text-small text-muted-foreground">{user.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              {user.roles.map((role) => <RoleBadge key={role} role={role} />)}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{user.branchName}</TableCell>
                          <TableCell>
                            <Badge variant={getUserStatusVariant(user.status)}>{user.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.mfaEnabled ? 'success' : 'outline'}>
                              {user.mfaEnabled ? 'Activo' : 'Pendiente'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{user.lastAccessAt}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Matriz de roles</CardTitle>
                    <CardDescription>
                      Base del sistema de autorización lista para backend.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {roleDefinitions.map((role) => (
                      <div key={role.key} className="rounded-2xl border p-4">
                        <div className="flex items-center justify-between gap-4">
                          <RoleBadge role={role.key} />
                          <Badge variant="outline">
                            {role.permissions.includes('*')
                              ? 'Acceso total'
                              : `${role.permissions.length} permisos`}
                          </Badge>
                        </div>
                        <p className="mt-3 text-small text-muted-foreground">{role.description}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Permisos de seguridad</CardTitle>
                    <CardDescription>
                      Catálogo visible para usuarios, sesiones y auditoría.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {permissionDefinitions
                      .filter((permission) => permission.module === 'Seguridad')
                      .map((permission) => (
                        <PermissionBadge key={permission.key} permission={permission.key} />
                      ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </AuthorizationGate>
        </TabsContent>

        <TabsContent value="sesiones" className="space-y-6">
          <AuthorizationGate
            permission="sesiones.read"
            fallback={
              <Card>
                <CardContent className="p-6">
                  <Badge variant="warning">No tienes acceso al monitoreo de sesiones.</Badge>
                </CardContent>
              </Card>
            }
          >
            <Card>
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MonitorSmartphone className="h-5 w-5 text-primary" />
                    Gestión de sesiones
                  </CardTitle>
                  <CardDescription>
                    Seguimiento de sesiones activas, inactivas y revocadas por dispositivo.
                  </CardDescription>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm">
                    <RefreshCcw className="h-4 w-4" />
                    Actualizar
                  </Button>
                  <AuthorizationGate
                    permission="sesiones.revoke"
                    fallback={
                      <Button type="button" variant="outline" size="sm" disabled>
                        Cerrar sesión remota
                      </Button>
                    }
                  >
                    <Button type="button" variant="danger" size="sm">
                      Cerrar sesión remota
                    </Button>
                  </AuthorizationGate>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Dispositivo</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Inicio</TableHead>
                      <TableHead>Última actividad</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {securitySessions.map((sessionItem) => (
                      <TableRow key={sessionItem.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{sessionItem.userName}</p>
                            <RoleBadge role={sessionItem.role} />
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{sessionItem.device}</TableCell>
                        <TableCell className="text-muted-foreground">{sessionItem.ipAddress}</TableCell>
                        <TableCell className="text-muted-foreground">{sessionItem.startedAt}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-muted-foreground">{sessionItem.lastSeenAt}</p>
                            {sessionItem.isCurrent ? (
                              <Badge variant="info">Sesión actual</Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getSessionStatusVariant(sessionItem.status)}>
                            {sessionItem.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </AuthorizationGate>
        </TabsContent>

        <TabsContent value="auditoria" className="space-y-6">
          <AuthorizationGate
            permission="auditoria.read"
            fallback={
              <Card>
                <CardContent className="p-6">
                  <Badge variant="warning">No tienes acceso al historial de auditoría.</Badge>
                </CardContent>
              </Card>
            }
          >
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    Auditoría operativa
                  </CardTitle>
                  <CardDescription>
                    Historial de acciones sensibles listo para integrarse con la tabla `auditoria`.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Actor</TableHead>
                        <TableHead>Módulo</TableHead>
                        <TableHead>Acción</TableHead>
                        <TableHead>Objetivo</TableHead>
                        <TableHead>Severidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="text-muted-foreground">{record.createdAt}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{record.actorName}</p>
                              <RoleBadge role={record.actorRole} />
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{record.module}</TableCell>
                          <TableCell>{record.action}</TableCell>
                          <TableCell className="text-muted-foreground">{record.target}</TableCell>
                          <TableCell>
                            <Badge variant={getSeverityVariant(record.severity)}>
                              {record.severity}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Controles de auditoría</CardTitle>
                    <CardDescription>
                      Acciones futuras preparadas para exportar, filtrar y retener eventos.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-2xl border p-4">
                      <p className="font-medium text-foreground">Eventos críticos</p>
                      <p className="mt-1 text-small text-muted-foreground">
                        {auditRecords.filter((record) => record.severity === 'CRITICAL').length} registros requieren revisión prioritaria.
                      </p>
                    </div>
                    <div className="rounded-2xl border p-4">
                      <p className="font-medium text-foreground">IP registradas</p>
                      <p className="mt-1 text-small text-muted-foreground">
                        {new Set(auditRecords.map((record) => record.ipAddress)).size} orígenes distintos en el historial mostrado.
                      </p>
                    </div>
                    <AuthorizationGate
                      role="ADMIN"
                      fallback={
                        <Badge variant="warning">
                          Solo administradores podrán exportar bitácoras completas.
                        </Badge>
                      }
                    >
                      <Button type="button" variant="outline" size="sm">
                        <ShieldCheck className="h-4 w-4" />
                        Exportar bitácora
                      </Button>
                    </AuthorizationGate>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Mapa de permisos</CardTitle>
                    <CardDescription>
                      Cobertura por módulo para seguridad y trazabilidad.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Módulo</TableHead>
                          <TableHead>Permiso</TableHead>
                          <TableHead>Roles con acceso</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {permissionModules.flatMap((module) =>
                          permissionDefinitions
                            .filter((permission) => permission.module === module)
                            .map((permission, index) => (
                              <TableRow key={permission.key}>
                                <TableCell className="font-medium">
                                  {index === 0 ? module : ''}
                                </TableCell>
                                <TableCell>
                                  <PermissionBadge permission={permission.key} />
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-2">
                                    {roleDefinitions
                                      .filter((role) =>
                                        roleGrantsPermission(role.permissions, permission.key),
                                      )
                                      .map((role) => (
                                        <RoleBadge key={role.key} role={role.key} />
                                      ))}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )),
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </div>
          </AuthorizationGate>
        </TabsContent>
      </Tabs>

      {hasRole('ADMIN') ? (
        <Card>
          <CardHeader>
            <CardTitle>Acciones administrativas</CardTitle>
            <CardDescription>
              Zona preparada para acciones críticas sobre políticas de acceso.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="info">Crear rol</Badge>
            <Badge variant="info">Asignar permisos</Badge>
            <Badge variant="info">Editar políticas</Badge>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
