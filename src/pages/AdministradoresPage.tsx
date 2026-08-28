import { useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw, Shield, UserSearch, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SidePanel, SidePanelClose, SidePanelContent } from '@/components/ui/side-panel'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/useToast'
import { useAuth } from '@/hooks/useAuth'
import { adminPosService } from '@/services/adminPosService'
import type { AdministradorListItem, EmpresaListItem, EmpresaSucursalListItem } from '@/types/admin-pos'

const TIPO_DOCUMENTO_OPTIONS = [
  { value: 'DNI', label: 'DNI' },
  { value: 'RUC', label: 'RUC' },
  { value: 'CE', label: 'Carné de extranjería' },
  { value: 'PASAPORTE', label: 'Pasaporte' },
  { value: 'OTRO', label: 'Otro' },
] as const

const createAdminSchema = z
  .object({
    empresaId: z.string().uuid('Selecciona una empresa.'),
    sucursalId: z.string().uuid('Selecciona una sucursal.').nullable().optional(),
    username: z.string().trim().min(3, 'Mínimo 3 caracteres.').max(50, 'Máximo 50 caracteres.'),
    email: z
      .string()
      .trim()
      .max(150, 'Máximo 150 caracteres.')
      .email('Correo inválido.')
      .nullable()
      .optional()
      .or(z.literal('')),
    password: z.string().trim().min(8, 'Mínimo 8 caracteres.').max(100, 'Máximo 100 caracteres.'),
    confirmPassword: z.string().trim().min(8, 'Mínimo 8 caracteres.'),
    nombres: z.string().trim().min(2, 'Mínimo 2 caracteres.').max(120, 'Máximo 120 caracteres.'),
    apellidos: z.string().trim().min(2, 'Mínimo 2 caracteres.').max(120, 'Máximo 120 caracteres.'),
    tipoDocumento: z.enum(['DNI', 'RUC', 'CE', 'PASAPORTE', 'OTRO']).optional(),
    numeroDocumento: z
      .string()
      .trim()
      .max(20, 'Máximo 20 caracteres.')
      .nullable()
      .optional()
      .or(z.literal('')),
    telefono: z
      .string()
      .trim()
      .max(30, 'Máximo 30 caracteres.')
      .nullable()
      .optional()
      .or(z.literal('')),
    activo: z.boolean().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  })
  .refine(
    (data) => {
      const needBranch = Boolean(data.empresaId)
      if (!needBranch) return true
      return Boolean(data.sucursalId)
    },
    {
      message: 'Selecciona una sucursal válida para la empresa.',
      path: ['sucursalId'],
    },
  )

type CreateAdminForm = z.infer<typeof createAdminSchema>

export function AdministradoresPage() {
  const { session } = useAuth()
  const { toast } = useToast()
  const accessToken = session?.accessToken ?? ''

  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [empresaFilter, setEmpresaFilter] = useState<string>('all')

  const [administradores, setAdministradores] = useState<AdministradorListItem[]>([])
  const [empresas, setEmpresas] = useState<EmpresaListItem[]>([])
  const [sucursalesByEmpresa, setSucursalesByEmpresa] = useState<Record<string, EmpresaSucursalListItem[]>>({})

  const [loadingList, setLoadingList] = useState(false)
  const [loadingForm, setLoadingForm] = useState(false)
  const [creating, setCreating] = useState(false)

  const [loadingSucursales, setLoadingSucursales] = useState<Record<string, boolean>>({})

  const methods = useForm<CreateAdminForm>({
    resolver: zodResolver(createAdminSchema),
    defaultValues: {
      empresaId: '',
      sucursalId: null,
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      nombres: '',
      apellidos: '',
      tipoDocumento: 'DNI',
      numeroDocumento: '',
      telefono: '',
      activo: true,
    },
  })

  const register = methods.register
  const handleSubmit = methods.handleSubmit
  const setValue = methods.setValue
  const reset = methods.reset
  const watch = methods.watch
  const errors = methods.formState.errors
  const isSubmitting = methods.formState.isSubmitting
  const canCreate = !isSubmitting && !creating && Boolean(accessToken)

  const watchEmpresaId = watch('empresaId')
  const watchActivo = watch('activo')
  const watchTipoDoc = watch('tipoDocumento')
  const watchSucursalId = watch('sucursalId')

  const currentEmpresaBranches: EmpresaSucursalListItem[] = watchEmpresaId
    ? sucursalesByEmpresa[watchEmpresaId] ?? []
    : []
  const selectedEmpresaObj = watchEmpresaId ? empresas.find((e) => e.id === watchEmpresaId) : undefined

  async function loadAdministradores() {
    if (!accessToken) return
    try {
      setLoadingList(true)
      const rows = await adminPosService.listAdministradores(accessToken)
      setAdministradores(rows)
    } catch (err) {
      toast({
        title: 'No se pudo cargar administradores',
        variant: 'destructive',
        description: err instanceof Error ? err.message : 'Error de red.',
      })
    } finally {
      setLoadingList(false)
    }
  }

  async function loadEmpresas() {
    if (!accessToken) return
    try {
      const rows = await adminPosService.listEmpresas(accessToken)
      setEmpresas(rows.filter((e) => e.activo))
    } catch (err) {
      toast({
        title: 'No se pudo cargar empresas',
        variant: 'destructive',
        description: err instanceof Error ? err.message : 'Error de red.',
      })
    }
  }

  async function loadEmpresaSucursales(empresaId: string) {
    if (!accessToken) return
    if (sucursalesByEmpresa[empresaId]) return
    try {
      setLoadingSucursales((prev) => ({ ...prev, [empresaId]: true }))
      const rows = await adminPosService.listEmpresaSucursales(accessToken, empresaId)
      setSucursalesByEmpresa((prev) => ({ ...prev, [empresaId]: rows.filter((s) => s.activo) }))
    } catch (err) {
      toast({
        title: 'No se pudieron cargar sucursales',
        variant: 'destructive',
        description: err instanceof Error ? err.message : 'Error de red.',
      })
    } finally {
      setLoadingSucursales((prev) => ({ ...prev, [empresaId]: false }))
    }
  }

  useEffect(() => {
    if (!accessToken) return
    setLoadingForm(true)
    Promise.all([loadAdministradores(), loadEmpresas()]).finally(() => setLoadingForm(false))
    void methods
    void watchSucursalId
  }, [accessToken])

  useEffect(() => {
    if (!watchEmpresaId) return
    loadEmpresaSucursales(watchEmpresaId)
  }, [watchEmpresaId])

  const filteredAdministradores = useMemo(() => {
    const q = search.trim().toLowerCase()
    return administradores.filter((a) => {
      if (empresaFilter !== 'all' && a.empresa.id !== empresaFilter) return false
      if (!q) return true
      return (
        a.nombres.toLowerCase().includes(q) ||
        a.apellidos.toLowerCase().includes(q) ||
        a.username.toLowerCase().includes(q) ||
        (a.email ?? '').toLowerCase().includes(q) ||
        a.empresa.razonSocial.toLowerCase().includes(q) ||
        (a.empresa.nombreComercial ?? '').toLowerCase().includes(q)
      )
    })
  }, [administradores, search, empresaFilter])

  const colorOf = (admin: AdministradorListItem) => admin.empresa.color ?? '#6366f1'
  const initialsOf = (admin: AdministradorListItem) =>
    `${(admin.nombres.split(' ')[0] ?? '').slice(0, 1)}${(admin.apellidos.split(' ')[0] ?? '').slice(0, 1)}`.toUpperCase()

  function openPanel() {
    reset({
      empresaId: '',
      sucursalId: null,
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      nombres: '',
      apellidos: '',
      tipoDocumento: 'DNI',
      numeroDocumento: '',
      telefono: '',
      activo: true,
    })
    setIsPanelOpen(true)
  }

  function closePanel() {
    setIsPanelOpen(false)
  }

  function onChangeEmpresa(nextId: string) {
    setValue('empresaId', nextId, { shouldValidate: true })
    setValue('sucursalId', null, { shouldValidate: true })
  }

  async function onSubmitValid(data: CreateAdminForm) {
    if (!accessToken) return
    try {
      setCreating(true)
      const empresaId = data.empresaId
      const sucursalId = data.sucursalId ?? null
      const created = await adminPosService.createEmpresaAdministrador(accessToken, empresaId, {
        username: data.username,
        email: data.email || null,
        password: data.password,
        nombres: data.nombres,
        apellidos: data.apellidos,
        tipoDocumento: data.tipoDocumento,
        numeroDocumento: data.numeroDocumento || null,
        telefono: data.telefono || null,
        activo: data.activo ?? true,
        sucursalId,
      })
      toast({
        title: 'Administrador asignado',
        description: `${created.nombres} ${created.apellidos} · ${created.username}`,
        variant: 'default',
      })
      await loadAdministradores()
      await loadEmpresas()
      closePanel()
    } catch (err) {
      toast({
        title: 'No se pudo asignar administrador',
        variant: 'destructive',
        description: err instanceof Error ? err.message : 'Error de red.',
      })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Administradores</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona los administradores de empresa asignados en la plataforma (solo rol ADMIN_EMPRESA).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-[260px]">
            <UserSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar administrador, correo o empresa…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={empresaFilter} onValueChange={(v) => setEmpresaFilter(v)}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Todas las empresas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las empresas</SelectItem>
              {empresas.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.razonSocial}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Actualizar"
            onClick={() => loadAdministradores()}
            disabled={loadingList}
          >
            <RefreshCw className={`h-4 w-4 ${loadingList ? 'animate-spin' : ''}`} />
          </Button>
          <Button type="button" onClick={openPanel} disabled={!canCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Asignar administrador
          </Button>
        </div>
      </div>

      {loadingForm ? (
        <div className="flex items-center justify-center p-10 text-sm text-muted-foreground">
          Cargando administradores…
        </div>
      ) : filteredAdministradores.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardDescription className="text-sm">
              No hay administradores de empresa con los filtros actuales. Usa &quot;Asignar
              administrador&quot; para crear el primero.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredAdministradores.map((admin) => (
            <Card key={admin.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                      style={{ backgroundColor: colorOf(admin) }}
                    >
                      {initialsOf(admin) || <Shield className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">
                        {admin.nombres} {admin.apellidos}
                      </CardTitle>
                      <CardDescription className="truncate">
                        {admin.username}
                        {admin.email ? ` · ${admin.email}` : ''}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={admin.activo ? 'success' : 'outline'}>
                    {admin.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                <div className="mt-3 space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Empresa:</span>
                    <span className="truncate font-medium text-foreground">
                      {admin.empresa.razonSocial}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Tipo:</span>
                    <Badge
                      variant="outline"
                      style={{ borderColor: colorOf(admin), color: colorOf(admin) }}
                    >
                      {admin.empresa.tipoCodigo}
                    </Badge>
                    <Badge variant="default">Administrador de empresa</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Sucursal(es):</span>
                    {admin.sucursales.length === 0 ? (
                      <span className="text-xs italic text-muted-foreground">
                        Sin sucursal asignada
                      </span>
                    ) : (
                      admin.sucursales.slice(0, 2).map((s) => (
                        <Badge key={s.id} variant="outline">
                          {s.esPrincipal ? '★ ' : ''}
                          {s.nombre}
                        </Badge>
                      ))
                    )}
                    {admin.sucursales.length > 2 ? (
                      <Badge variant="outline">+{admin.sucursales.length - 2}</Badge>
                    ) : null}
                  </div>
                  {admin.asignadoAt ? (
                    <p className="text-xs text-muted-foreground">
                      Asignado el {new Date(admin.asignadoAt).toLocaleDateString('es-PE')}
                    </p>
                  ) : null}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {isPanelOpen ? (
        <SidePanel open={isPanelOpen} onOpenChange={(o) => !o && closePanel()}>
          <SidePanelContent>
            <div className="space-y-5 p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Asignar administrador de empresa</h2>
                  <p className="text-sm text-muted-foreground">
                    Asigna un nuevo administrador (rol ADMIN_EMPRESA) a una empresa existente.
                  </p>
                </div>
                <SidePanelClose asChild>
                  <Button type="button" variant="outline" size="sm" onClick={closePanel}>
                    Cerrar
                  </Button>
                </SidePanelClose>
              </div>

              <div className="space-y-1 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Rol (forzado)
                  </Label>
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    Administrador de empresa (ADMIN_EMPRESA)
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Este flujo solo puede crear administradores de empresa. No permite ADMIN_POS ni ADMIN Legacy.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmitValid)} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="adm-empresa">Empresa *</Label>
                  <Select value={watchEmpresaId || ''} onValueChange={onChangeEmpresa}>
                    <SelectTrigger id="adm-empresa">
                      <SelectValue placeholder="Selecciona empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {empresas.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.razonSocial}
                          {e.hasAdminEmpresa ? ' · (ya tiene admin)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.empresaId ? (
                    <p className="text-xs text-destructive">{errors.empresaId.message}</p>
                  ) : null}
                </div>

                {selectedEmpresaObj ? (
                  <div className="space-y-2">
                    <Label htmlFor="adm-sucursal">Sucursal *</Label>
                    {loadingSucursales[selectedEmpresaObj.id] ? (
                      <p className="text-xs text-muted-foreground">Cargando sucursales…</p>
                    ) : currentEmpresaBranches.length === 0 ? (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                        <div className="text-xs text-amber-900">
                          <p className="font-medium">Esta empresa aún no tiene sucursales activas.</p>
                          <p>Primero crea una sucursal para la empresa y vuelve a asignar el administrador.</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Select
                          value={watchSucursalId || ''}
                          onValueChange={(v) =>
                            setValue('sucursalId', v || null, { shouldValidate: true })
                          }
                        >
                          <SelectTrigger id="adm-sucursal">
                            <SelectValue placeholder="Selecciona sucursal" />
                          </SelectTrigger>
                          <SelectContent>
                            {currentEmpresaBranches.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.esPrincipal ? '★ ' : ''}
                                {s.nombre} ({s.codigo})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.sucursalId ? (
                          <p className="text-xs text-destructive">{errors.sucursalId.message}</p>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <Shield className="mt-0.5 h-4 w-4 text-slate-500" />
                    <p className="text-xs text-slate-700">
                      Selecciona una empresa para ver sus sucursales disponibles.
                    </p>
                  </div>
                )}

                <div className="space-y-2 border-t pt-2">
                  <h3 className="text-sm font-semibold">Información personal</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="adm-nombres">Nombres *</Label>
                      <Input id="adm-nombres" {...register('nombres')} />
                      {errors.nombres ? (
                        <p className="text-xs text-destructive">{errors.nombres.message}</p>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="adm-apellidos">Apellidos *</Label>
                      <Input id="adm-apellidos" {...register('apellidos')} />
                      {errors.apellidos ? (
                        <p className="text-xs text-destructive">{errors.apellidos.message}</p>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="adm-tipodoc">Tipo documento</Label>
                      <Select
                        value={watchTipoDoc || 'DNI'}
                        onValueChange={(v) =>
                          setValue(
                            'tipoDocumento',
                            v as CreateAdminForm['tipoDocumento'],
                            { shouldValidate: true },
                          )
                        }
                      >
                        <SelectTrigger id="adm-tipodoc">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPO_DOCUMENTO_OPTIONS.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="adm-numdoc">N° documento</Label>
                      <Input id="adm-numdoc" {...register('numeroDocumento')} />
                      {errors.numeroDocumento ? (
                        <p className="text-xs text-destructive">
                          {errors.numeroDocumento.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor="adm-telefono">Celular</Label>
                      <Input id="adm-telefono" {...register('telefono')} />
                      {errors.telefono ? (
                        <p className="text-xs text-destructive">{errors.telefono.message}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t pt-2">
                  <h3 className="text-sm font-semibold">Cuenta</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="adm-username">Usuario *</Label>
                      <Input id="adm-username" {...register('username')} />
                      {errors.username ? (
                        <p className="text-xs text-destructive">{errors.username.message}</p>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="adm-email">Correo</Label>
                      <Input id="adm-email" type="email" {...register('email')} />
                      {errors.email ? (
                        <p className="text-xs text-destructive">{errors.email.message}</p>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="adm-password">Contraseña *</Label>
                      <Input id="adm-password" type="password" {...register('password')} />
                      {errors.password ? (
                        <p className="text-xs text-destructive">{errors.password.message}</p>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="adm-confirm">Confirmar contraseña *</Label>
                      <Input id="adm-confirm" type="password" {...register('confirmPassword')} />
                      {errors.confirmPassword ? (
                        <p className="text-xs text-destructive">
                          {errors.confirmPassword.message}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t pt-2">
                  <h3 className="text-sm font-semibold">Configuración</h3>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <div className="text-sm font-medium">Usuario activo</div>
                      <div className="text-xs text-muted-foreground">
                        Determina si el nuevo admin puede iniciar sesión.
                      </div>
                    </div>
                    <Switch
                      checked={Boolean(watchActivo)}
                      onCheckedChange={(v) => setValue('activo', v, { shouldValidate: true })}
                    />
                  </div>
                  <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
                    <XCircle className="mt-0.5 h-4 w-4 text-rose-600" />
                    <p className="text-xs text-rose-900">
                      Este formulario NO permite crear administradores de plataforma (ADMIN_POS) ni
                      el rol legacy ADMIN. Solo crea ADMIN_EMPRESA validado en el servidor.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
                  <Button type="button" variant="outline" onClick={closePanel} disabled={creating}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={!canCreate}>
                    {creating ? 'Asignando…' : 'Asignar administrador'}
                  </Button>
                </div>
              </form>
            </div>
          </SidePanelContent>
        </SidePanel>
      ) : null}
    </div>
  )
}
