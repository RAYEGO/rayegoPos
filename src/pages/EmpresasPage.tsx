import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { Building2, MoreHorizontal, Plus, RefreshCcw, Search, ToggleLeft, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader } from '@/components/ui/loader'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SidePanel, SidePanelClose, SidePanelContent } from '@/components/ui/side-panel'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { adminPosService } from '@/services/adminPosService'
import { useAuth } from '@/hooks/useAuth'
import { useAuthorization } from '@/hooks/useAuthorization'
import { useHandleUnauthorized } from '@/hooks/useHandleUnauthorized'
import { ApiError, ApiNetworkError } from '@/services/apiClient'
import type { CreateEmpresaPayload, EmpresaDetail, EmpresaListItem, TipoEmpresaListItem, UpdateEmpresaPayload } from '@/types/admin-pos'

type DrawerMode = 'create' | 'edit' | 'view'

const nullableText = () =>
  z.preprocess((value) => {
    if (typeof value === 'string' && value.trim() === '') {
      return null
    }
    return value
  }, z.string().nullable().optional())

const nullableEmail = () =>
  z.preprocess((value) => {
    if (typeof value === 'string' && value.trim() === '') return null
    return value
  }, z.string().email('Email inválido.').nullable().optional())

const empresaFormSchema = z
  .object({
    tipoEmpresaId: z.string().min(1, 'Selecciona un tipo.'),
    razonSocial: z.string().trim().min(3, 'Al menos 3 caracteres.').max(200, 'Máximo 200 caracteres.'),
    nombreComercial: nullableText(),
    numeroDocumento: z.string().trim().min(8, 'Mínimo 8 caracteres.').max(20, 'Máximo 20 caracteres.'),
    email: nullableEmail(),
    telefono: nullableText(),
    direccion: nullableText(),
    activo: z.boolean(),
    onboarding: z.boolean().optional(),
    sucursalCodigo: z.string().trim().max(20).optional(),
    sucursalNombre: z.string().trim().max(150).optional(),
    sucursalDireccion: nullableText(),
    sucursalTelefono: nullableText(),
    sucursalEmail: nullableEmail(),
    adminUsername: z.string().trim().max(50).optional(),
    adminEmail: nullableEmail(),
    adminPassword: z.string().trim().max(100).optional(),
    adminNombres: z.string().trim().max(120).optional(),
    adminApellidos: z.string().trim().max(120).optional(),
    adminTelefono: nullableText(),
    adminNumeroDocumento: nullableText(),
    adminActivo: z.boolean().optional(),
  })
  .superRefine((values, ctx) => {
    if (!values.onboarding) return
    if (!values.sucursalCodigo || !values.sucursalCodigo.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sucursalCodigo'], message: 'Código de sucursal obligatorio.' })
    }
    if (!values.sucursalNombre || !values.sucursalNombre.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sucursalNombre'], message: 'Nombre de sucursal obligatorio.' })
    }
    if (!values.adminUsername || !values.adminUsername.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['adminUsername'], message: 'Username obligatorio.' })
    }
    if (!values.adminPassword || values.adminPassword.trim().length < 8) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['adminPassword'], message: 'Contraseña obligatoria (mínimo 8 caracteres).' })
    }
    if (!values.adminNombres || !values.adminNombres.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['adminNombres'], message: 'Nombres obligatorios.' })
    }
    if (!values.adminApellidos || !values.adminApellidos.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['adminApellidos'], message: 'Apellidos obligatorios.' })
    }
  })

type EmpresaFormValues = {
  tipoEmpresaId: string
  razonSocial: string
  nombreComercial: string | null | undefined
  numeroDocumento: string
  email: string | null | undefined
  telefono: string | null | undefined
  direccion: string | null | undefined
  activo: boolean
  onboarding?: boolean
  sucursalCodigo?: string
  sucursalNombre?: string
  sucursalDireccion: string | null | undefined
  sucursalTelefono: string | null | undefined
  sucursalEmail: string | null | undefined
  adminUsername?: string
  adminEmail: string | null | undefined
  adminPassword?: string
  adminNombres?: string
  adminApellidos?: string
  adminTelefono: string | null | undefined
  adminNumeroDocumento: string | null | undefined
  adminActivo?: boolean
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-destructive">{message}</p>
}

function getApiErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof ApiNetworkError) return error.message
  if (error instanceof Error) return error.message
  return 'No fue posible completar la operación.'
}

export function EmpresasPage() {
  const { session } = useAuth()
  const authorization = useAuthorization()
  const handleUnauthorized = useHandleUnauthorized('EmpresasPage')
  const accessToken = session?.accessToken ?? ''

  const canManage = authorization.can('empresas.manage')

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<EmpresaListItem[]>([])
  const [tipos, setTipos] = useState<TipoEmpresaListItem[]>([])
  const [search, setSearch] = useState('')

  const [drawerMode, setDrawerMode] = useState<DrawerMode | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EmpresaFormValues>({
    resolver: zodResolver(empresaFormSchema) as never,
    defaultValues: {
      tipoEmpresaId: '',
      razonSocial: '',
      nombreComercial: null,
      numeroDocumento: '',
      email: null,
      telefono: null,
      direccion: null,
      activo: true,
      onboarding: false,
      sucursalCodigo: 'PRINCIPAL',
      sucursalNombre: 'Sucursal principal',
      sucursalDireccion: null,
      sucursalTelefono: null,
      sucursalEmail: null,
      adminUsername: '',
      adminEmail: null,
      adminPassword: '',
      adminNombres: '',
      adminApellidos: '',
      adminTelefono: null,
      adminNumeroDocumento: null,
      adminActivo: true,
    },
  })

  const watchActivo = watch('activo')
  const readOnly = drawerMode === 'view'

  useEffect(() => {
    if (!accessToken) return
    setIsLoading(true)
    setError(null)
    Promise.all([adminPosService.listEmpresas(accessToken), adminPosService.listTiposEmpresa(accessToken)])
      .then(([empresas, tiposEmpresa]) => {
        setItems(empresas)
        setTipos(tiposEmpresa)
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          void handleUnauthorized(err.status, err.message, { endpoint: 'listEmpresas', page: 'EmpresasPage' })
        } else if (err instanceof ApiNetworkError) {
          void handleUnauthorized(401, err.message, { endpoint: 'listEmpresas', page: 'EmpresasPage' })
        } else {
          void handleUnauthorized()
        }
        setError(getApiErrorMessage(err))
      })
      .finally(() => setIsLoading(false))
  }, [accessToken, handleUnauthorized])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((e) => {
      const tipoNombre = e.tipoEmpresa?.nombre ?? ''
      const tipoCodigo = e.tipoEmpresa?.codigo ?? ''
      return (
        e.razonSocial.toLowerCase().includes(q) ||
        e.numeroDocumento.toLowerCase().includes(q) ||
        tipoNombre.toLowerCase().includes(q) ||
        tipoCodigo.toLowerCase().includes(q)
      )
    })
  }, [items, search])

  function closeDrawer() {
    setDrawerMode(null)
    setSelectedId(null)
  }

  function openDrawer(mode: DrawerMode, empresa?: EmpresaListItem | EmpresaDetail) {
    setDrawerMode(mode)
    setSelectedId(empresa?.id ?? null)

    if (mode === 'create') {
      const firstTipo = tipos.find((t) => t.activo) ?? tipos[0]
      reset({
        tipoEmpresaId: firstTipo?.id ?? '',
        razonSocial: '',
        nombreComercial: null,
        numeroDocumento: '',
        email: null,
        telefono: null,
        direccion: null,
        activo: true,
        onboarding: true,
        sucursalCodigo: 'PRINCIPAL',
        sucursalNombre: 'Sucursal principal',
        sucursalDireccion: null,
        sucursalTelefono: null,
        sucursalEmail: null,
        adminUsername: '',
        adminEmail: null,
        adminPassword: '',
        adminNombres: '',
        adminApellidos: '',
        adminTelefono: null,
        adminNumeroDocumento: null,
        adminActivo: true,
      })
      return
    }

    if (!empresa) return
    const detailPromise =
      'tipoDocumento' in empresa
        ? Promise.resolve(empresa as EmpresaDetail)
        : adminPosService.getEmpresa(accessToken, empresa.id)

    detailPromise
      .then((detail) => {
        reset({
          tipoEmpresaId: detail.tipoEmpresaId,
          razonSocial: detail.razonSocial,
          nombreComercial: detail.nombreComercial,
          numeroDocumento: detail.numeroDocumento,
          email: detail.email,
          telefono: detail.telefono,
          direccion: detail.direccion,
          activo: detail.activo,
          onboarding: false,
          sucursalCodigo: 'PRINCIPAL',
          sucursalNombre: 'Sucursal principal',
          sucursalDireccion: null,
          sucursalTelefono: null,
          sucursalEmail: null,
          adminUsername: '',
          adminEmail: null,
          adminPassword: '',
          adminNombres: '',
          adminApellidos: '',
          adminTelefono: null,
          adminNumeroDocumento: null,
          adminActivo: true,
        })
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          void handleUnauthorized(err.status, err.message, { endpoint: 'getEmpresa', page: 'EmpresasPage' })
        } else if (err instanceof ApiNetworkError) {
          void handleUnauthorized(401, err.message, { endpoint: 'getEmpresa', page: 'EmpresasPage' })
        } else {
          void handleUnauthorized()
        }
        toast.error(getApiErrorMessage(err))
      })
  }

  async function reload() {
    if (!accessToken) return
    setIsLoading(true)
    setError(null)
    try {
      const empresas = await adminPosService.listEmpresas(accessToken)
      setItems(empresas)
    } catch (err) {
      if (err instanceof ApiError) {
        void handleUnauthorized(err.status, err.message, { endpoint: 'listEmpresas', page: 'EmpresasPage' })
      } else if (err instanceof ApiNetworkError) {
        void handleUnauthorized(401, err.message, { endpoint: 'listEmpresas', page: 'EmpresasPage' })
      } else {
        void handleUnauthorized()
      }
      setError(getApiErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  async function toggleEstado(empresa: EmpresaListItem) {
    if (!canManage) return
    try {
      await adminPosService.toggleEmpresa(accessToken, empresa.id)
      setItems((prev) => prev.map((e) => (e.id === empresa.id ? { ...e, activo: !e.activo } : e)))
      toast.success(empresa.activo ? 'Empresa desactivada.' : 'Empresa activada.')
    } catch (err) {
      if (err instanceof ApiError) {
        void handleUnauthorized(err.status, err.message, { endpoint: 'toggleEmpresa', page: 'EmpresasPage' })
      } else if (err instanceof ApiNetworkError) {
        void handleUnauthorized(401, err.message, { endpoint: 'toggleEmpresa', page: 'EmpresasPage' })
      } else {
        void handleUnauthorized()
      }
      toast.error(getApiErrorMessage(err))
    }
  }

  async function onSubmit(values: any) {
    const typedValues = values as EmpresaFormValues
    if (!accessToken || readOnly) return
    if (!canManage) return
    setIsSubmitting(true)
    try {
      const payload = {
        tipoEmpresaId: typedValues.tipoEmpresaId,
        razonSocial: typedValues.razonSocial,
        nombreComercial: (typedValues.nombreComercial ?? null) as string | null,
        numeroDocumento: typedValues.numeroDocumento,
        email: (typedValues.email ?? null) as string | null,
        telefono: (typedValues.telefono ?? null) as string | null,
        direccion: (typedValues.direccion ?? null) as string | null,
        activo: typedValues.activo ?? true,
      } as CreateEmpresaPayload & UpdateEmpresaPayload

      if (drawerMode === 'create') {
        const onboarding = Boolean(typedValues.onboarding)
        if (onboarding) {
          await adminPosService.createEmpresaOnboarding(accessToken, {
            empresa: payload,
            sucursal: {
              codigo: (typedValues.sucursalCodigo ?? '').trim(),
              nombre: (typedValues.sucursalNombre ?? '').trim(),
              direccion: (typedValues.sucursalDireccion ?? null) as string | null,
              telefono: (typedValues.sucursalTelefono ?? null) as string | null,
              email: (typedValues.sucursalEmail ?? null) as string | null,
            },
            admin: {
              username: (typedValues.adminUsername ?? '').trim(),
              email: (typedValues.adminEmail ?? null) as string | null,
              password: (typedValues.adminPassword ?? '').trim(),
              nombres: (typedValues.adminNombres ?? '').trim(),
              apellidos: (typedValues.adminApellidos ?? '').trim(),
              numeroDocumento: (typedValues.adminNumeroDocumento ?? null) as string | null,
              telefono: (typedValues.adminTelefono ?? null) as string | null,
              activo: typedValues.adminActivo ?? true,
            },
          })
        } else {
          await adminPosService.createEmpresa(accessToken, payload)
        }
        toast.success('Empresa creada correctamente.')
      } else if (drawerMode === 'edit' && selectedId) {
        await adminPosService.updateEmpresa(accessToken, selectedId, payload)
        toast.success('Empresa actualizada correctamente.')
      }

      await reload()
      closeDrawer()
    } catch (err) {
      if (err instanceof ApiError) {
        void handleUnauthorized(err.status, err.message, { endpoint: 'create/updateEmpresa', page: 'EmpresasPage' })
      } else if (err instanceof ApiNetworkError) {
        void handleUnauthorized(401, err.message, { endpoint: 'create/updateEmpresa', page: 'EmpresasPage' })
      } else {
        void handleUnauthorized()
      }
      toast.error(getApiErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Administración POS</p>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Empresas</h1>
          <p className="text-sm text-muted-foreground">Administra las empresas registradas en la plataforma.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar empresa, RUC o tipo…" className="pl-9" />
          </div>
          <Button variant="outline" onClick={() => void reload()}>
            <RefreshCcw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button onClick={() => openDrawer('create')} disabled={!canManage}>
            <Plus className="h-4 w-4" />
            Nueva empresa
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader className="h-8 w-8" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-sm font-medium text-destructive">No se pudo cargar la información.</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-20 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">{search.trim() ? 'No hay resultados para tu búsqueda.' : 'Aún no hay empresas.'}</p>
            <p className="text-sm text-muted-foreground">{search.trim() ? 'Prueba con otros términos.' : 'Crea la primera empresa para empezar a operar.'}</p>
            {canManage && !search.trim() ? (
              <Button onClick={() => openDrawer('create')} size="sm" className="mt-2">
                <Plus className="h-4 w-4" />
                Crear empresa
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((empresa) => (
            <Card key={empresa.id} className="overflow-hidden">
              <div className="h-1.5" style={{ backgroundColor: empresa.tipoEmpresa?.color ?? '#6b7280' }} aria-hidden />
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="truncate text-base">{empresa.razonSocial}</CardTitle>
                    </div>
                    <CardDescription className="mt-1">RUC {empresa.numeroDocumento}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={empresa.activo ? 'success' : 'outline'}>{empresa.activo ? 'Activa' : 'Inactiva'}</Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuLabel>Opciones</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => openDrawer('view', empresa)}>Ver detalle</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openDrawer('edit', empresa)} disabled={!canManage}>
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => toggleEstado(empresa)} disabled={!canManage}>
                          <ToggleLeft className="mr-2 h-4 w-4 text-muted-foreground" />
                          {empresa.activo ? 'Desactivar' : 'Activar'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline" style={{ borderColor: empresa.tipoEmpresa?.color ?? undefined, color: empresa.tipoEmpresa?.color ?? undefined }}>
                    {empresa.tipoEmpresa?.nombre ?? 'Sin tipo'}
                  </Badge>
                  <Badge variant="outline">{empresa.sucursalesCount} sucursales</Badge>
                  <Badge variant="outline">{empresa.usuariosCount} usuarios</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Registro {empresa.createdAt ? new Date(empresa.createdAt).toLocaleDateString('es-PE') : '—'}
                </p>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <SidePanel open={Boolean(drawerMode)} onOpenChange={(open) => !open && closeDrawer()}>
        <SidePanelContent className="max-w-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
            <header className="flex shrink-0 items-start justify-between gap-4 border-b px-6 py-4">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight">
                  {drawerMode === 'create' ? 'Nueva empresa' : drawerMode === 'edit' ? 'Editar empresa' : 'Detalle de empresa'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {drawerMode === 'create'
                    ? 'Registra una nueva empresa y asigna su tipo.'
                    : drawerMode === 'edit'
                      ? 'Actualiza la información y el tipo de empresa.'
                      : 'Consulta los datos de la empresa.'}
                </p>
              </div>
              <SidePanelClose asChild>
                <Button variant="ghost" size="icon" type="button">
                  <X className="h-4 w-4" />
                </Button>
              </SidePanelClose>
            </header>

            <ScrollArea className="min-h-0 flex-1" viewportClassName="px-6 py-4 pb-32">
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <Label>Tipo de empresa <span className="text-destructive">*</span></Label>
                  <Controller
                    control={control}
                    name="tipoEmpresaId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {tipos.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.nombre} ({t.codigo})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError message={errors.tipoEmpresaId?.message} />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Razón social <span className="text-destructive">*</span></Label>
                    <Controller
                      control={control}
                      name="razonSocial"
                      render={({ field }) => (
                        <Input {...field} value={field.value ?? ''} onChange={field.onChange} disabled={readOnly} />
                      )}
                    />
                    <FieldError message={errors.razonSocial?.message} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>RUC <span className="text-destructive">*</span></Label>
                    <Controller
                      control={control}
                      name="numeroDocumento"
                      render={({ field }) => (
                        <Input {...field} value={field.value ?? ''} onChange={field.onChange} disabled={readOnly} />
                      )}
                    />
                    <FieldError message={errors.numeroDocumento?.message} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Nombre comercial</Label>
                    <Controller
                      control={control}
                      name="nombreComercial"
                      render={({ field }) => (
                        <Input {...field} value={field.value ?? ''} onChange={field.onChange} disabled={readOnly} />
                      )}
                    />
                    <FieldError message={errors.nombreComercial?.message} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Controller
                      control={control}
                      name="email"
                      render={({ field }) => (
                        <Input {...field} value={field.value ?? ''} onChange={field.onChange} disabled={readOnly} />
                      )}
                    />
                    <FieldError message={errors.email?.message} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Teléfono</Label>
                    <Controller
                      control={control}
                      name="telefono"
                      render={({ field }) => (
                        <Input {...field} value={field.value ?? ''} onChange={field.onChange} disabled={readOnly} />
                      )}
                    />
                    <FieldError message={errors.telefono?.message} />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Dirección</Label>
                    <Controller
                      control={control}
                      name="direccion"
                      render={({ field }) => (
                        <Input {...field} value={field.value ?? ''} onChange={field.onChange} disabled={readOnly} />
                      )}
                    />
                    <FieldError message={errors.direccion?.message} />
                  </div>
                </div>

                {drawerMode === 'create' ? (
                  <div className="rounded-2xl border p-4">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Sucursal inicial</p>
                        <p className="text-xs text-muted-foreground">Se creará una sucursal principal para la empresa.</p>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label>Código <span className="text-destructive">*</span></Label>
                          <Controller
                            control={control}
                            name="sucursalCodigo"
                            render={({ field }) => (
                              <Input
                                {...field}
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                                disabled={readOnly}
                              />
                            )}
                          />
                          <FieldError message={errors.sucursalCodigo?.message} />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Nombre <span className="text-destructive">*</span></Label>
                          <Controller
                            control={control}
                            name="sucursalNombre"
                            render={({ field }) => (
                              <Input {...field} value={field.value ?? ''} onChange={field.onChange} disabled={readOnly} />
                            )}
                          />
                          <FieldError message={errors.sucursalNombre?.message} />
                        </div>

                        <div className="space-y-1.5 sm:col-span-2">
                          <Label>Dirección</Label>
                          <Controller
                            control={control}
                            name="sucursalDireccion"
                            render={({ field }) => (
                              <Input {...field} value={field.value ?? ''} onChange={field.onChange} disabled={readOnly} />
                            )}
                          />
                          <FieldError message={errors.sucursalDireccion?.message} />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Teléfono</Label>
                          <Controller
                            control={control}
                            name="sucursalTelefono"
                            render={({ field }) => (
                              <Input {...field} value={field.value ?? ''} onChange={field.onChange} disabled={readOnly} />
                            )}
                          />
                          <FieldError message={errors.sucursalTelefono?.message} />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Email</Label>
                          <Controller
                            control={control}
                            name="sucursalEmail"
                            render={({ field }) => (
                              <Input {...field} value={field.value ?? ''} onChange={field.onChange} disabled={readOnly} />
                            )}
                          />
                          <FieldError message={errors.sucursalEmail?.message} />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {drawerMode === 'create' ? (
                  <div className="rounded-2xl border p-4">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Administrador de empresa</p>
                        <p className="text-xs text-muted-foreground">Se creará el primer administrador asociado a la sucursal principal.</p>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label>Username <span className="text-destructive">*</span></Label>
                          <Controller
                            control={control}
                            name="adminUsername"
                            render={({ field }) => (
                              <Input {...field} value={field.value ?? ''} onChange={field.onChange} disabled={readOnly} />
                            )}
                          />
                          <FieldError message={errors.adminUsername?.message} />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Email</Label>
                          <Controller
                            control={control}
                            name="adminEmail"
                            render={({ field }) => (
                              <Input {...field} value={field.value ?? ''} onChange={field.onChange} disabled={readOnly} />
                            )}
                          />
                          <FieldError message={errors.adminEmail?.message} />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Contraseña <span className="text-destructive">*</span></Label>
                          <Controller
                            control={control}
                            name="adminPassword"
                            render={({ field }) => (
                              <Input {...field} type="password" value={field.value ?? ''} onChange={field.onChange} disabled={readOnly} />
                            )}
                          />
                          <FieldError message={errors.adminPassword?.message} />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Teléfono</Label>
                          <Controller
                            control={control}
                            name="adminTelefono"
                            render={({ field }) => (
                              <Input {...field} value={field.value ?? ''} onChange={field.onChange} disabled={readOnly} />
                            )}
                          />
                          <FieldError message={errors.adminTelefono?.message} />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Nombres <span className="text-destructive">*</span></Label>
                          <Controller
                            control={control}
                            name="adminNombres"
                            render={({ field }) => (
                              <Input {...field} value={field.value ?? ''} onChange={field.onChange} disabled={readOnly} />
                            )}
                          />
                          <FieldError message={errors.adminNombres?.message} />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Apellidos <span className="text-destructive">*</span></Label>
                          <Controller
                            control={control}
                            name="adminApellidos"
                            render={({ field }) => (
                              <Input {...field} value={field.value ?? ''} onChange={field.onChange} disabled={readOnly} />
                            )}
                          />
                          <FieldError message={errors.adminApellidos?.message} />
                        </div>

                        <div className="space-y-1.5 sm:col-span-2">
                          <Label>Documento</Label>
                          <Controller
                            control={control}
                            name="adminNumeroDocumento"
                            render={({ field }) => (
                              <Input {...field} value={field.value ?? ''} onChange={field.onChange} disabled={readOnly} />
                            )}
                          />
                          <FieldError message={errors.adminNumeroDocumento?.message} />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-2xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Estado</p>
                      <p className="text-xs text-muted-foreground">
                        {watchActivo ? 'Visible y habilitada' : 'Inactiva para nuevas operaciones'}
                      </p>
                    </div>
                    <Switch
                      checked={Boolean(watchActivo)}
                      onCheckedChange={(v) => setValue('activo', v, { shouldDirty: true })}
                      disabled={readOnly}
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>

            <footer className="flex shrink-0 items-center justify-end gap-2 border-t bg-background px-6 py-4">
              <Button type="button" variant="outline" onClick={closeDrawer} disabled={isSubmitting}>
                Cerrar
              </Button>
              {!readOnly ? (
                <Button type="submit" disabled={isSubmitting || !canManage}>
                  {drawerMode === 'create' ? 'Crear' : 'Guardar'}
                </Button>
              ) : null}
            </footer>
          </form>
        </SidePanelContent>
      </SidePanel>
    </div>
  )
}
