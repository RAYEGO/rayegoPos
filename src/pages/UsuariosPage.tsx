import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Edit,
  MoreVertical,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users2,
  X,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AuthorizationGate } from '@/components/auth/AuthorizationGate'
import { RoleBadge } from '@/components/auth/RoleBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SidePanel, SidePanelClose, SidePanelContent } from '@/components/ui/side-panel'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { permissionDefinitions, roleDefinitions, permissionModules } from '@/config/authorization'
import { useBusinessFeatures } from '@/hooks/useBusinessFeatures'
import { useAuth } from '@/hooks/useAuth'
import { useAuthorization } from '@/hooks/useAuthorization'
import { branchesService } from '@/services/branchesService'
import { auditService, type AuditAction, type AuditListEntry } from '@/services/auditService'
import {
  usersService,
  type UsersModuleUserRecord,
} from '@/services/usersService'
import type { AuthPermission, AuthRole, UserStatus } from '@/types/auth'
import type { Branch } from '@/types/settings'
import { toast } from 'sonner'

function getUserStatusVariant(status: 'ACTIVO' | 'BLOQUEADO' | 'INVITADO') {
  if (status === 'ACTIVO') return 'success'
  if (status === 'INVITADO') return 'info'
  return 'warning'
}

type UsersFilters = {
  search: string
  role: 'TODOS' | AuthRole
  status: 'TODOS' | UserStatus
  branchId: 'TODAS' | string
}

const usersFormSchema = z
  .object({
    firstName: z.string().min(1, 'Ingresa los nombres.'),
    lastName: z.string().min(1, 'Ingresa los apellidos.'),
    documentId: z.string().min(1, 'Ingresa el documento.').max(20).or(z.null()),
    phone: z.string().min(1, 'Ingresa el celular.').max(40).or(z.null()),
    email: z.string().min(1, 'Ingresa el correo.').email('Ingresa un correo válido.').or(z.null()),
    username: z.string().min(1, 'Ingresa el usuario.').max(60),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.').or(z.literal('')),
    confirmPassword: z.string().min(8, 'Confirma la contraseña.').or(z.literal('')),
    role: z.enum(['ADMIN_POS', 'ADMIN', 'ADMIN_EMPRESA', 'SUPERVISOR', 'CAJERO', 'ALMACEN']),
    branchIds: z.array(z.string()),
    isActive: z.boolean(),
    mustChangePassword: z.boolean(),
    mfaEnabled: z.boolean(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden.',
  })
  .refine(
    (data) => {
      const requiresBranches = data.role !== 'ADMIN_POS'
      if (!requiresBranches) return true
      return Array.isArray(data.branchIds) && data.branchIds.length > 0
    },
    {
      path: ['branchIds'],
      message: 'Selecciona al menos una sucursal.',
    },
  )

type UsersFormValues = z.infer<typeof usersFormSchema>

const defaultUserFormValues: UsersFormValues = {
  firstName: '',
  lastName: '',
  documentId: '',
  phone: '',
  email: '',
  username: '',
  password: '',
  confirmPassword: '',
  role: 'CAJERO',
  branchIds: [],
  isActive: true,
  mustChangePassword: false,
  mfaEnabled: false,
}

function getUserFullName(user: Pick<UsersModuleUserRecord, 'firstName' | 'lastName'>) {
  return `${user.firstName} ${user.lastName}`.trim()
}

function formatBranchSummary(branchNames: string[]) {
  if (branchNames.length === 0) return '—'
  if (branchNames.length <= 2) return branchNames.join('\n')
  return `${branchNames.length} sucursales`
}

export function UsuariosPage() {
  const { can, hasRole } = useAuthorization()
  const { session } = useAuth()
  const accessToken = session?.accessToken ?? ''
  const canSeePlatformUsers = hasRole('ADMIN_POS')
  const [filters, setFilters] = useState<UsersFilters>({
    search: '',
    role: 'TODOS',
    status: 'TODOS',
    branchId: 'TODAS',
  })
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UsersModuleUserRecord | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [users, setUsers] = useState<UsersModuleUserRecord[]>([])
  const [_loadingBranches, setLoadingBranches] = useState(false)
  const [_loadingUsers, setLoadingUsers] = useState(false)
  const [submittingUserForm, setSubmittingUserForm] = useState(false)
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<UsersModuleUserRecord | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)

  const loadBranches = useCallback(async () => {
    if (!accessToken) return
    try {
      setLoadingBranches(true)
      const response = await branchesService.list(accessToken)
      setBranches(Array.isArray(response) ? response : [])
    } catch (error) {
      toast.error('No se pudieron cargar las sucursales.', {
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      })
    } finally {
      setLoadingBranches(false)
    }
  }, [accessToken])

  const loadUsers = useCallback(async () => {
    if (!accessToken) return
    try {
      setLoadingUsers(true)
      const list = await usersService.list(accessToken)
      setUsers(Array.isArray(list) ? list : [])
    } catch (error) {
      toast.error('No se pudieron cargar los usuarios.', {
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      })
    } finally {
      setLoadingUsers(false)
    }
  }, [accessToken])

  useEffect(() => {
    void loadBranches()
  }, [loadBranches])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const branchNameMap = useMemo(() => {
    return Object.fromEntries(branches.map((branch) => [branch.id, branch.nombre]))
  }, [branches])

  const assignableBranches = useMemo(
    () => branches.filter((branch) => branch.activo),
    [branches],
  )

  const visibleRoleDefinitions = useMemo(() => {
    if (canSeePlatformUsers) return roleDefinitions
    return roleDefinitions.filter((role) => role.key !== 'ADMIN_POS')
  }, [canSeePlatformUsers])

  useEffect(() => {
    if (canSeePlatformUsers) return
    if (filters.role === 'ADMIN_POS') {
      setFilters((current) => ({ ...current, role: 'TODOS' }))
    }
  }, [canSeePlatformUsers, filters.role])

  const filteredUsers = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase()

    return users.filter((user) => {
      const userFullName = getUserFullName(user).toLowerCase()
      const matchesSearch =
        normalizedSearch.length === 0 ||
        userFullName.includes(normalizedSearch) ||
        (user.email ?? '').toLowerCase().includes(normalizedSearch) ||
        user.username.toLowerCase().includes(normalizedSearch)

      const matchesRole = filters.role === 'TODOS' || user.primaryRole === filters.role
      const matchesStatus = filters.status === 'TODOS' || user.status === filters.status
      const matchesBranch =
        filters.branchId === 'TODAS' || (user.branchIds ?? []).includes(filters.branchId)

      return matchesSearch && matchesRole && matchesStatus && matchesBranch
    })
  }, [users, filters])

  const usersMetrics = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((user) => user.status === 'ACTIVO').length,
      blocked: users.filter((user) => user.status === 'BLOQUEADO').length,
    }
  }, [users])

  const userForm = useForm<UsersFormValues>({
    resolver: zodResolver(usersFormSchema),
    defaultValues: defaultUserFormValues,
  })

  const watchedBranchIds = userForm.watch('branchIds')

  function toggleBranch(branchId: string, checked: boolean) {
    const nextValue = checked
      ? Array.from(new Set([...watchedBranchIds, branchId]))
      : watchedBranchIds.filter((id) => id !== branchId)
    userForm.setValue('branchIds', nextValue, { shouldValidate: true })
  }

  function openCreateUserDialog() {
    setEditingUser(null)
    userForm.reset({
      ...defaultUserFormValues,
      branchIds: assignableBranches.length === 1 ? [assignableBranches[0].id] : [],
    })
    setIsUserDialogOpen(true)
  }

  function openEditUserDialog(user: UsersModuleUserRecord) {
    setEditingUser(user)
    userForm.reset({
      firstName: user.firstName,
      lastName: user.lastName,
      documentId: user.documentId ?? '',
      phone: user.phone ?? '',
      email: user.email ?? '',
      username: user.username,
      password: '',
      confirmPassword: '',
      role: user.primaryRole,
      branchIds: user.branchIds,
      isActive: user.status === 'ACTIVO',
      mustChangePassword: user.mustChangePassword,
      mfaEnabled: user.mfaEnabled,
    })
    setIsUserDialogOpen(true)
  }

  function closeUserDialog() {
    setIsUserDialogOpen(false)
    setEditingUser(null)
    setSubmittingUserForm(false)
  }

  async function onSubmitUserForm(values: UsersFormValues) {
    if (!accessToken) return
    try {
      if (!canSeePlatformUsers && values.role === 'ADMIN_POS') {
        toast.error('No puedes asignar el rol Administrador POS.')
        return
      }
      setSubmittingUserForm(true)
      const payload = {
        firstName: values.firstName,
        lastName: values.lastName,
        documentId: values.documentId,
        phone: values.phone ?? '',
        email: values.email ?? '',
        username: values.username,
        password: values.password,
        role: values.role,
        branchIds: values.branchIds,
        isActive: values.isActive,
        mustChangePassword: values.mustChangePassword,
      }
      if (editingUser) {
        const updatePayload = { ...payload }
        if (!values.password) {
          delete (updatePayload as Partial<(typeof payload)>).password
        }
        await usersService.update(accessToken, editingUser.id, updatePayload as any)
        toast.success('Usuario actualizado correctamente.')
      } else {
        await usersService.create(accessToken, payload as any)
        toast.success('Usuario creado correctamente.')
      }
      await loadUsers()
      closeUserDialog()
    } catch (error) {
      toast.error(editingUser ? 'No se pudo actualizar el usuario.' : 'No se pudo crear el usuario.', {
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      })
    } finally {
      setSubmittingUserForm(false)
    }
  }

  async function onConfirmRemoveUser() {
    if (!accessToken || !removeTarget) return
    try {
      setIsRemoving(true)
      const result = await usersService.remove(accessToken, removeTarget.id)
      if (result.kind === 'DELETED') {
        toast.success(result.message)
      } else {
        toast.success(result.message, {
          description: 'El usuario ha sido desactivado por tener registros históricos.',
        })
      }
      await loadUsers()
      if (editingUser?.id === removeTarget.id) {
        closeUserDialog()
      }
      setIsRemoveConfirmOpen(false)
      setRemoveTarget(null)
    } catch (error) {
      toast.error('No se pudo procesar la solicitud.', {
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      })
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <Tabs defaultValue="usuarios" className="space-y-4 p-4">
      <AuthorizationGate
        permission="usuarios.read"
        fallback={
          <Card>
            <CardContent className="p-6">
              <Badge variant="warning">No tienes acceso al módulo de Usuarios.</Badge>
            </CardContent>
          </Card>
        }
      >
        <TabsList className="grid w-full grid-cols-1 sm:inline-flex sm:w-auto sm:grid-cols-none">
          <TabsTrigger value="usuarios" className="inline-flex items-center gap-2">
            <Users2 className="h-4 w-4" />
            Usuarios
          </TabsTrigger>
          <AuthorizationGate
            permission="usuarios.manage"
            fallback={
              <TabsTrigger value="roles" disabled className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Roles y permisos
              </TabsTrigger>
            }
          >
            <TabsTrigger value="roles" className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Roles y permisos
            </TabsTrigger>
          </AuthorizationGate>
          <AuthorizationGate
            permission="auditoria.read"
            fallback={
              <TabsTrigger value="actividad" disabled className="inline-flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Actividad
              </TabsTrigger>
            }
          >
            <TabsTrigger value="actividad" className="inline-flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Actividad
            </TabsTrigger>
          </AuthorizationGate>
        </TabsList>

        <TabsContent value="usuarios">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">Usuarios</h1>
            <p className="text-small text-muted-foreground">
              Administra personas, roles principales y sucursales autorizadas.
            </p>
          </div>

          <AuthorizationGate
            permission="usuarios.manage"
            fallback={
              <Button type="button" size="sm" disabled>
                <UserPlus className="h-4 w-4" />
                Crear usuario
              </Button>
            }
          >
            <Button type="button" size="sm" onClick={openCreateUserDialog}>
              <UserPlus className="h-4 w-4" />
              Crear usuario
            </Button>
          </AuthorizationGate>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <Users2 className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{usersMetrics.total}</span>
              <span className="text-xs text-muted-foreground">Usuarios</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{usersMetrics.active}</span>
              <span className="text-xs text-muted-foreground">Activos</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{usersMetrics.blocked}</span>
              <span className="text-xs text-muted-foreground">Bloqueados</span>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Directorio de usuarios</CardTitle>
                <CardDescription>
                  La sucursal activa se define en el login. Este módulo solo administra usuarios.
                </CardDescription>
              </div>
              {hasRole('ADMIN') || hasRole('ADMIN_EMPRESA') ? (
                <Badge variant="outline">Preparado para roles múltiples</Badge>
              ) : null}
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.4fr_0.6fr_0.6fr_0.6fr]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filters.search}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, search: event.target.value }))
                  }
                  placeholder="Buscar usuario, correo o usuario…"
                  className="pl-9"
                />
              </div>

              <Select
                value={filters.role}
                onValueChange={(value) =>
                  setFilters((current) => ({ ...current, role: value as UsersFilters['role'] }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos los roles</SelectItem>
                  {visibleRoleDefinitions.map((role) => (
                    <SelectItem key={role.key} value={role.key}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.status}
                onValueChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    status: value as UsersFilters['status'],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos los estados</SelectItem>
                  <SelectItem value="ACTIVO">Activo</SelectItem>
                  <SelectItem value="INVITADO">Invitado</SelectItem>
                  <SelectItem value="BLOQUEADO">Bloqueado</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.branchId}
                onValueChange={(value) =>
                  setFilters((current) => ({ ...current, branchId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sucursal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas las sucursales</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 sm:hidden">
              {filteredUsers.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
                  No hay usuarios con los filtros actuales.
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const branchNames = (user.branchIds ?? [])
                    .map((branchId) => branchNameMap[branchId])
                    .filter(Boolean)
                  const branchSummary = formatBranchSummary(branchNames)

                  return (
                    <div key={user.id} className="rounded-2xl border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground">{getUserFullName(user)}</p>
                          <p className="text-small text-muted-foreground">{user.email}</p>
                        </div>
                        <AuthorizationGate
                          permission="usuarios.manage"
                          fallback={
                            <Button type="button" size="icon" variant="ghost" disabled>
                              <Edit className="h-4 w-4" />
                            </Button>
                          }
                        >
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditUserDialog(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </AuthorizationGate>
                      </div>

                      <div className="mt-4 grid gap-3 rounded-xl bg-muted/30 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Rol principal
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            <RoleBadge role={user.primaryRole} />
                            {user.roles.length > 1 ? (
                              <Badge variant="outline">+{user.roles.length - 1}</Badge>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-start justify-between gap-3">
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Sucursales
                          </span>
                          <span className="whitespace-pre-line text-right text-small text-foreground">
                            {branchSummary}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Estado
                          </span>
                          <Badge variant={getUserStatusVariant(user.status)}>{user.status}</Badge>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Último acceso
                          </span>
                          <span className="text-small text-foreground">{user.lastAccessAt}</span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Rol principal</TableHead>
                    <TableHead>Sucursales</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Último acceso</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        No hay usuarios con los filtros actuales.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => {
                      const branchNames = user.branchIds
                        .map((branchId) => branchNameMap[branchId])
                        .filter(Boolean)
                      const branchSummary = formatBranchSummary(branchNames)

                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{getUserFullName(user)}</p>
                              <p className="text-small text-muted-foreground">{user.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <RoleBadge role={user.primaryRole} />
                              {user.roles.length > 1 ? (
                                <Badge variant="outline">+{user.roles.length - 1}</Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-pre-line text-muted-foreground">
                            {branchSummary}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getUserStatusVariant(user.status)}>{user.status}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{user.lastAccessAt}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button type="button" size="icon" variant="ghost">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <AuthorizationGate
                                  permission="usuarios.manage"
                                  fallback={
                                    <DropdownMenuItem disabled>
                                      <Edit className="h-4 w-4" />
                                      Editar
                                    </DropdownMenuItem>
                                  }
                                >
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      queueMicrotask(() => setTimeout(() => openEditUserDialog(user), 0))
                                    }
                                  >
                                    <Edit className="h-4 w-4" />
                                    Editar
                                  </DropdownMenuItem>
                                </AuthorizationGate>
                                <AuthorizationGate
                                  permission="usuarios.manage"
                                  fallback={
                                    <DropdownMenuItem disabled>
                                      <Trash2 className="h-4 w-4" />
                                      Eliminar usuario
                                    </DropdownMenuItem>
                                  }
                                >
                                  <DropdownMenuItem
                                    disabled={
                                      user.primaryRole === 'ADMIN_POS' && !hasRole('ADMIN_POS')
                                    }
                                    onSelect={() => {
                                      queueMicrotask(() => {
                                        setTimeout(() => {
                                          setRemoveTarget(user)
                                          setIsRemoveConfirmOpen(true)
                                        }, 0)
                                      })
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Eliminar usuario
                                  </DropdownMenuItem>
                                </AuthorizationGate>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {isUserDialogOpen ? (
          <SidePanel
            open={isUserDialogOpen}
            onOpenChange={(open) => {
              if (!open) {
                closeUserDialog()
              }
            }}
          >
            <SidePanelContent className="p-0">
              <form className="flex h-full flex-col" onSubmit={userForm.handleSubmit(onSubmitUserForm)}>
              <div className="flex items-start justify-between gap-4 border-b bg-popover px-6 py-4">
                <div className="space-y-1">
                  <p className="text-base font-semibold text-foreground">
                    {editingUser ? 'Editar usuario' : 'Crear usuario'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Asigna los datos del usuario y sus sucursales autorizadas.
                  </p>
                </div>
                <SidePanelClose asChild>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Cerrar</span>
                  </Button>
                </SidePanelClose>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="space-y-4">
                <div className="rounded-2xl border p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Información personal</p>
                    <p className="text-small text-muted-foreground">
                      Datos base para identificar al usuario en el sistema.
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-small font-medium text-foreground" htmlFor="firstName">
                        Nombres
                      </label>
                      <Input id="firstName" {...userForm.register('firstName')} />
                      {userForm.formState.errors.firstName ? (
                        <p className="text-xs text-destructive">
                          {userForm.formState.errors.firstName.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <label className="text-small font-medium text-foreground" htmlFor="lastName">
                        Apellidos
                      </label>
                      <Input id="lastName" {...userForm.register('lastName')} />
                      {userForm.formState.errors.lastName ? (
                        <p className="text-xs text-destructive">
                          {userForm.formState.errors.lastName.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <label
                        className="text-small font-medium text-foreground"
                        htmlFor="documentId"
                      >
                        Documento
                      </label>
                      <Input id="documentId" {...userForm.register('documentId')} />
                      {userForm.formState.errors.documentId ? (
                        <p className="text-xs text-destructive">
                          {userForm.formState.errors.documentId.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <label className="text-small font-medium text-foreground" htmlFor="phone">
                        Celular
                      </label>
                      <Input id="phone" {...userForm.register('phone')} />
                      {userForm.formState.errors.phone ? (
                        <p className="text-xs text-destructive">
                          {userForm.formState.errors.phone.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-small font-medium text-foreground" htmlFor="email">
                        Correo
                      </label>
                      <Input id="email" type="email" {...userForm.register('email')} />
                      {userForm.formState.errors.email ? (
                        <p className="text-xs text-destructive">
                          {userForm.formState.errors.email.message}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Cuenta</p>
                    <p className="text-small text-muted-foreground">
                      Credenciales de acceso para iniciar sesión.
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-small font-medium text-foreground" htmlFor="username">
                        Usuario
                      </label>
                      <Input id="username" {...userForm.register('username')} />
                      {userForm.formState.errors.username ? (
                        <p className="text-xs text-destructive">
                          {userForm.formState.errors.username.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <label className="text-small font-medium text-foreground" htmlFor="password">
                        Contraseña
                      </label>
                      <Input id="password" type="password" {...userForm.register('password')} />
                      {userForm.formState.errors.password ? (
                        <p className="text-xs text-destructive">
                          {userForm.formState.errors.password.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <label
                        className="text-small font-medium text-foreground"
                        htmlFor="confirmPassword"
                      >
                        Confirmar contraseña
                      </label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        {...userForm.register('confirmPassword')}
                      />
                      {userForm.formState.errors.confirmPassword ? (
                        <p className="text-xs text-destructive">
                          {userForm.formState.errors.confirmPassword.message}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Accesos</p>
                    <p className="text-small text-muted-foreground">
                      Rol principal asignado al usuario (preparado para múltiples roles).
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-small font-medium text-foreground" htmlFor="role">
                        Rol
                      </label>
                      <Controller
                        control={userForm.control}
                        name="role"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger id="role">
                              <SelectValue placeholder="Selecciona un rol" />
                            </SelectTrigger>
                            <SelectContent>
                              {visibleRoleDefinitions.map((role) => (
                                <SelectItem key={role.key} value={role.key}>
                                  {role.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {userForm.formState.errors.role ? (
                        <p className="text-xs text-destructive">
                          {userForm.formState.errors.role.message}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Sucursales autorizadas</p>
                    <p className="text-small text-muted-foreground">
                      Selecciona una o varias sucursales donde el usuario podrá operar.
                    </p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {assignableBranches.map((branch) => (
                      <label
                        key={branch.id}
                        className="flex items-center gap-3 rounded-xl border px-3 py-2"
                      >
                        <Checkbox
                          checked={watchedBranchIds.includes(branch.id)}
                          onCheckedChange={(checked) => toggleBranch(branch.id, Boolean(checked))}
                        />
                        <span className="text-small text-foreground">{branch.nombre}</span>
                      </label>
                    ))}
                    {editingUser &&
                      (editingUser.branchIds ?? [])
                        .map((bid) => branches.find((b) => b.id === bid))
                        .filter((b): b is Branch => {
                          if (!b) return false
                          return !b.activo
                        })
                        .map((branch) => (
                          <label
                            key={branch.id}
                            className="flex items-center gap-3 rounded-xl border border-dashed px-3 py-2 opacity-70"
                          >
                            <Checkbox
                              checked={watchedBranchIds.includes(branch.id)}
                              onCheckedChange={(checked) => toggleBranch(branch.id, Boolean(checked))}
                            />
                            <span className="text-small text-foreground">
                              {branch.nombre}{' '}
                              <span className="text-muted-foreground">(inactiva, asignada previamente)</span>
                            </span>
                          </label>
                        ))}
                    {assignableBranches.length === 0 && (!editingUser || editingUser.branchIds.length === 0) && (
                      <p className="text-small text-muted-foreground italic">
                        No hay sucursales activas disponibles para asignar.
                      </p>
                    )}
                    {userForm.formState.errors.branchIds ? (
                      <p className="text-xs text-destructive">
                        {userForm.formState.errors.branchIds.message}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Configuración</p>
                    <p className="text-small text-muted-foreground">
                      Ajustes operativos y soporte futuro para MFA.
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
                      <span className="text-small font-medium text-foreground">Usuario activo</span>
                      <Controller
                        control={userForm.control}
                        name="isActive"
                        render={({ field }) => (
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        )}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
                      <span className="text-small font-medium text-foreground">
                        Requiere cambiar contraseña
                      </span>
                      <Controller
                        control={userForm.control}
                        name="mustChangePassword"
                        render={({ field }) => (
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        )}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 md:col-span-2">
                      <span className="text-small font-medium text-foreground">MFA (futuro)</span>
                      <Controller
                        control={userForm.control}
                        name="mfaEnabled"
                        render={({ field }) => (
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        )}
                      />
                    </label>
                  </div>
                </div>
              </div>
              </div>

              <div className="border-t bg-popover px-6 py-4">
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={closeUserDialog}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={!can('usuarios.manage') || submittingUserForm}>
                    {submittingUserForm
                      ? editingUser
                        ? 'Guardando…'
                        : 'Creando…'
                      : 'Guardar'}
                  </Button>
                </div>
              </div>
            </form>
          </SidePanelContent>
          </SidePanel>
        ) : null}

        <Dialog
          open={isRemoveConfirmOpen}
          onOpenChange={(open) => {
            if (!isRemoving) {
              setIsRemoveConfirmOpen(open)
              if (!open) setRemoveTarget(null)
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Eliminar usuario?</DialogTitle>
              <DialogDescription>
                {removeTarget ? (
                  <>
                    Esta acción afectará a <strong className="text-foreground">@{removeTarget.username}</strong> ({getUserFullName(removeTarget)}).
                    <br />
                    <br />
                    Si el usuario tiene ventas, movimientos de caja, auditoría u otras operaciones históricas, será <strong className="text-foreground">desactivado</strong> en lugar de eliminado para preservar la integridad de los datos.
                    <br />
                    <br />
                    Esta acción no se puede deshacer.
                  </>
                ) : (
                  'Esta acción no se puede deshacer.'
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isRemoving}
                onClick={() => {
                  setIsRemoveConfirmOpen(false)
                  setRemoveTarget(null)
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={isRemoving || !can('usuarios.manage')}
                onClick={() => void onConfirmRemoveUser()}
              >
                {isRemoving ? 'Procesando…' : 'Eliminar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </TabsContent>

        <TabsContent value="roles">
          <RolesMatrixSection
            visibleRoleDefinitions={visibleRoleDefinitions}
            canManage={can('usuarios.manage')}
            canSeePlatformUsers={canSeePlatformUsers}
          />
        </TabsContent>

        <TabsContent value="actividad">
          <ActivityAuditSection
            accessToken={accessToken}
            users={users}
            branches={branches}
            canReadAudit={can('auditoria.read')}
          />
        </TabsContent>
      </AuthorizationGate>
    </Tabs>
  )
}

function RolesMatrixSection({
  visibleRoleDefinitions,
  canManage,
  canSeePlatformUsers,
}: {
  visibleRoleDefinitions: typeof roleDefinitions
  canManage: boolean
  canSeePlatformUsers: boolean
}) {
  const { businessType, isFeatureEnabled } = useBusinessFeatures()
  const isServicioTecnicoEnabled =
    businessType === 'SERVICIO_TECNICO' || isFeatureEnabled('module_ordenes_servicio')
  const [selectedRole, setSelectedRole] = useState<AuthRole>(
    visibleRoleDefinitions[0]?.key ?? 'ADMIN_EMPRESA',
  )

  useEffect(() => {
    if (!visibleRoleDefinitions.some((r) => r.key === selectedRole)) {
      setSelectedRole(visibleRoleDefinitions[0]?.key ?? 'ADMIN_EMPRESA')
    }
  }, [selectedRole, visibleRoleDefinitions])

  const currentRole = useMemo(
    () => roleDefinitions.find((r) => r.key === selectedRole) ?? visibleRoleDefinitions[0],
    [selectedRole, visibleRoleDefinitions],
  )

  const modulesGroupedPermissions = useMemo(() => {
    const allowedModuleLabels = new Set<string>()
    for (const perm of permissionDefinitions) {
      if (!perm.module) continue
      const isRt =
        perm.key.startsWith('ordenesServicio') ||
        perm.key.startsWith('tecnicos') ||
        perm.key.startsWith('equiposCliente') ||
        perm.key.startsWith('presupuestosOrdenServicio') ||
        perm.key.startsWith('pagosOrdenServicio') ||
        perm.key.startsWith('consumoInventarioRT') ||
        perm.key.startsWith('garantiasOrdenServicio')
      if (isRt && !isServicioTecnicoEnabled) continue
      if (perm.module === 'Administración POS' && !canSeePlatformUsers) continue
      allowedModuleLabels.add(perm.module)
    }
    return permissionModules.filter((mod) => allowedModuleLabels.has(mod))
  }, [isServicioTecnicoEnabled, canSeePlatformUsers])

  if (!currentRole) return null

  const rolePermissions = new Set<AuthPermission>(currentRole.permissions)

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">Roles y permisos</h1>
            <p className="text-small text-muted-foreground">
              Matriz de autorizaciones por módulo. Fase 1: visualización (no editable).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" size="sm" variant="outline" disabled={!canManage}>
                  <Settings2 className="h-4 w-4" />
                  Guardar cambios
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs">
                Persistencia de roles y permisos disponible en la próxima actualización.
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <RoleBadge role={currentRole.key} />
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">{currentRole.label}</p>
                  <p className="text-xs text-muted-foreground">{currentRole.description}</p>
                </div>
              </div>
              <div className="w-full md:w-72">
                <Select
                  value={selectedRole}
                  onValueChange={(value) => setSelectedRole(value as AuthRole)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleRoleDefinitions.map((role) => (
                      <SelectItem key={role.key} value={role.key}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Módulo</TableHead>
                    <TableHead className="w-[150px] text-center">
                      Ver
                      <div className="mt-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                        (permiso read)
                      </div>
                    </TableHead>
                    <TableHead className="w-[180px] text-center">
                      Gestionar
                      <div className="mt-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                        (crear · editar · eliminar · anular)
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modulesGroupedPermissions.map((moduleLabel) => {
                    const permRead = permissionDefinitions.find(
                      (p) => p.module === moduleLabel && p.key.endsWith('.read'),
                    )
                    const permManage = permissionDefinitions.find(
                      (p) => p.module === moduleLabel && p.key.endsWith('.manage'),
                    )

                    return (
                      <TableRow key={moduleLabel}>
                        <TableCell className="font-medium text-foreground">{moduleLabel}</TableCell>
                        <TableCell className="text-center">
                          {permRead ? (
                            <Checkbox disabled checked={rolePermissions.has(permRead.key)} />
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              N/A
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {permManage ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center justify-center">
                                  <Checkbox
                                    disabled
                                    checked={rolePermissions.has(permManage.key)}
                                  />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs text-xs">
                                {permManage.description}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              sin manage
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}

function ActivityAuditSection({
  accessToken,
  users,
  branches,
  canReadAudit,
}: {
  accessToken: string
  users: UsersModuleUserRecord[]
  branches: Branch[]
  canReadAudit: boolean
}) {
  type AuditFilters = {
    search: string
    userId: 'TODOS' | string
    tabla: 'TODOS' | string
    accion: 'TODOS' | AuditAction
    fechaDesde: string
    fechaHasta: string
    branchId: 'TODAS' | string
  }

  const [filters, setFilters] = useState<AuditFilters>({
    search: '',
    userId: 'TODOS',
    tabla: 'TODOS',
    accion: 'TODOS',
    fechaDesde: '',
    fechaHasta: '',
    branchId: 'TODAS',
  })
  const [offset, setOffset] = useState(0)
  const [limit] = useState<number>(50)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<AuditListEntry[]>([])
  const [total, setTotal] = useState(0)
  const [moduleOptions, setModuleOptions] = useState<string[]>([])
  const [actionOptions] = useState<AuditAction[]>([
    'INSERT',
    'UPDATE',
    'DELETE',
    'RESTORE',
    'LOGIN',
    'LOGOUT',
    'ANULAR',
    'VIEW_RECEIPT',
    'PRINT_RECEIPT',
    'DOWNLOAD_RECEIPT_PDF',
    'SHARE_RECEIPT',
  ])

  const fetchList = useCallback(
    async (nextOffset = 0) => {
      if (!canReadAudit || !accessToken) return
      try {
        setLoading(true)
        const params: Record<string, unknown> = {
          limit,
          offset: nextOffset,
        }
        if (filters.search.trim()) params.search = filters.search.trim()
        if (filters.userId !== 'TODOS') params.userId = filters.userId
        if (filters.tabla !== 'TODOS') params.tabla = filters.tabla
        if (filters.accion !== 'TODOS') params.accion = filters.accion
        if (filters.fechaDesde) params.fechaDesde = filters.fechaDesde
        if (filters.fechaHasta) params.fechaHasta = filters.fechaHasta
        const res = await auditService.list(accessToken, params as any)
        setData(res.items)
        setTotal(res.total)
        setOffset(nextOffset)
        const tablas = Array.from(
          new Set(
            res.items
              .map((row) => row.tabla)
              .filter((t): t is string => Boolean(t) && t.length > 0),
          ),
        ).sort()
        setModuleOptions((prev) => Array.from(new Set([...prev, ...tablas])).sort())
      } catch (error) {
        toast.error('No se pudo cargar la actividad del sistema.', {
          description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
        })
      } finally {
        setLoading(false)
      }
    },
    [accessToken, canReadAudit, filters, limit],
  )

  useEffect(() => {
    void fetchList(0)
  }, [fetchList])

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const currentPage = Math.min(totalPages, Math.floor(offset / limit) + 1)

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">Actividad</h1>
            <p className="text-small text-muted-foreground">
              Auditoría de acciones importantes realizadas por los usuarios.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{total} registros</Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" size="sm" variant="outline" disabled>
                  Exportar CSV
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs">
                Exportación disponible en la próxima actualización.
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <Card>
          <CardHeader className="gap-3">
            <div className="grid gap-3 lg:grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr_0.9fr_0.9fr_0.7fr]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filters.search}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, search: event.target.value }))
                  }
                  placeholder="Buscar usuario, módulo o detalle…"
                  className="pl-9"
                />
              </div>

              <Select
                value={filters.userId}
                onValueChange={(value) =>
                  setFilters((current) => ({ ...current, userId: value as AuditFilters['userId'] }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Usuario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos los usuarios</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {getUserFullName(user)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.tabla}
                onValueChange={(value) => setFilters((current) => ({ ...current, tabla: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Módulo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos los módulos</SelectItem>
                  {moduleOptions.map((module) => (
                    <SelectItem key={module} value={module}>
                      {formatModuleLabel(module)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.accion}
                onValueChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    accion: value as AuditFilters['accion'],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Acción" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todas las acciones</SelectItem>
                  {actionOptions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {formatAuditActionLabel(action)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div>
                <Input
                  type="date"
                  value={filters.fechaDesde}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, fechaDesde: event.target.value }))
                  }
                />
                <p className="mt-1 text-[11px] text-muted-foreground">Fecha desde</p>
              </div>

              <div>
                <Input
                  type="date"
                  value={filters.fechaHasta}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, fechaHasta: event.target.value }))
                  }
                />
                <p className="mt-1 text-[11px] text-muted-foreground">Fecha hasta</p>
              </div>

              <Select value={filters.branchId} disabled>
                <SelectTrigger>
                  <SelectValue placeholder="Sucursal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas las sucursales</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setFilters({
                    search: '',
                    userId: 'TODOS',
                    tabla: 'TODOS',
                    accion: 'TODOS',
                    fechaDesde: '',
                    fechaHasta: '',
                    branchId: 'TODAS',
                  })
                }}
              >
                Limpiar filtros
              </Button>
              <Button type="button" size="sm" onClick={() => void fetchList(0)}>
                Actualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Fecha/hora</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Módulo</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                        Cargando actividad…
                      </TableCell>
                    </TableRow>
                  ) : data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                        No hay registros de actividad con los filtros seleccionados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-small text-muted-foreground">
                          {formatAuditDateTime(row.fechaEvento)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="font-medium text-foreground">
                              {row.usuario
                                ? `${row.usuario.firstName} ${row.usuario.lastName}`.trim()
                                : 'Sistema'}
                            </p>
                            {row.usuario?.username ? (
                              <p className="text-[11px] text-muted-foreground">
                                @{row.usuario.username}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{formatModuleLabel(row.tabla)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getAuditActionBadgeVariant(row.accion)}>
                            {formatAuditActionLabel(row.accion)}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[420px] text-small text-muted-foreground">
                          {formatAuditDetail(row)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Página {currentPage} de {totalPages} · {total} registros
              </p>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={currentPage <= 1 || loading}
                  onClick={() => void fetchList(Math.max(0, offset - limit))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={currentPage >= totalPages || loading}
                  onClick={() => void fetchList(offset + limit)}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}

function formatModuleLabel(tabla: string | null | undefined): string {
  if (!tabla) return 'Sistema'
  const t = tabla.trim().toLowerCase()
  const map: Record<string, string> = {
    ventas: 'Ventas',
    ventas_ticket: 'Ventas',
    productos: 'Productos',
    compras: 'Compras',
    ordenes_compra: 'Compras',
    inventario: 'Inventario',
    movimientos_inventario: 'Inventario',
    caja: 'Caja',
    sesiones_caja: 'Caja',
    clientes: 'Clientes',
    proveedores: 'Proveedores',
    usuarios: 'Usuarios',
    users: 'Usuarios',
    roles: 'Usuarios',
    sesiones: 'Sesiones',
    auditoria: 'Actividad',
    configuracion: 'Configuración',
    settings: 'Configuración',
    empresas: 'Empresas',
    sucursales: 'Sucursales',
    branches: 'Sucursales',
    auth: 'Autenticación',
    login: 'Autenticación',
    logout: 'Autenticación',
  }
  if (map[t]) return map[t]
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function formatAuditActionLabel(action: AuditAction | string | null | undefined): string {
  if (!action) return '—'
  switch (action) {
    case 'INSERT':
      return 'Creación'
    case 'UPDATE':
      return 'Edición'
    case 'DELETE':
      return 'Eliminación'
    case 'RESTORE':
      return 'Restauración'
    case 'LOGIN':
      return 'Inicio de sesión'
    case 'LOGOUT':
      return 'Cierre de sesión'
    case 'ANULAR':
      return 'Anulación'
    case 'VIEW_RECEIPT':
      return 'Ver ticket'
    case 'PRINT_RECEIPT':
      return 'Imprimir ticket'
    case 'DOWNLOAD_RECEIPT_PDF':
      return 'Descargar PDF'
    case 'SHARE_RECEIPT':
      return 'Compartir ticket'
    default:
      return String(action)
  }
}

function getAuditActionBadgeVariant(
  action: AuditAction | string | null | undefined,
): 'default' | 'success' | 'warning' | 'destructive' | 'outline' | 'info' {
  if (!action) return 'outline'
  switch (action) {
    case 'LOGIN':
      return 'success'
    case 'LOGOUT':
      return 'info'
    case 'INSERT':
      return 'default'
    case 'UPDATE':
      return 'default'
    case 'DELETE':
      return 'destructive'
    case 'ANULAR':
      return 'warning'
    default:
      return 'outline'
  }
}

function formatAuditDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(iso)
  }
}

function formatAuditDetail(row: AuditListEntry): string {
  const raw = row.valorNuevo as Record<string, unknown> | null
  if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) {
    try {
      return JSON.stringify(raw)
        .replace(/"/g, '')
        .replace(/[{}]/g, '')
        .slice(0, 160)
    } catch {
      /* ignore */
    }
  }
  if (row.registroId) return `Registro: ${row.registroId.slice(0, 12)}…`
  return '—'
}
