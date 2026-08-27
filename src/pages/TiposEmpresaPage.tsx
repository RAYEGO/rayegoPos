import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  Building2,
  CheckCircle2,
  Edit3,
  Layers,
  MoreHorizontal,
  Pill,
  Plus,
  RefreshCcw,
  Search,
  Settings,
  ToggleLeft,
  Wrench,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader } from '@/components/ui/loader'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SidePanel, SidePanelClose, SidePanelContent } from '@/components/ui/side-panel'
import { Switch } from '@/components/ui/switch'
import { adminPosService } from '@/services/adminPosService'
import { useAuth } from '@/hooks/useAuth'
import { useAuthorization } from '@/hooks/useAuthorization'
import { useHandleUnauthorized } from '@/hooks/useHandleUnauthorized'
import { ApiError, ApiNetworkError } from '@/services/apiClient'
import type {
  CreateTipoEmpresaPayload,
  ModuloCatalogoItem,
  TipoEmpresaDetail,
  TipoEmpresaListItem,
  UpdateTipoEmpresaPayload,
} from '@/types/admin-pos'

type DrawerMode = 'create' | 'edit' | 'view'

const iconoOpciones = [
  { id: 'Pill', label: '💊 Botica', component: Pill },
  { id: 'Wrench', label: '🔧 Servicio Técnico', component: Wrench },
  { id: 'Building2', label: '🏢 Empresa', component: Building2 },
  { id: 'Layers', label: '🧩 Módulo', component: Layers },
  { id: 'Settings', label: '⚙️ Configuración', component: Settings },
] as const

const colorOpciones = [
  { id: '#2563eb', label: 'Azul' },
  { id: '#16a34a', label: 'Verde' },
  { id: '#9333ea', label: 'Morado' },
  { id: '#ea580c', label: 'Naranja' },
  { id: '#0891b2', label: 'Cian' },
  { id: '#db2777', label: 'Rosa' },
  { id: '#ca8a04', label: 'Ámbar' },
  { id: '#6b7280', label: 'Gris' },
] as const

function getIconByName(name: string | null) {
  const found = iconoOpciones.find((opt) => opt.id === name)
  return found?.component ?? Building2
}

function normalizeTipoEmpresaCode(input: string) {
  return input.trim().toUpperCase().replace(/\s+/g, '_')
}

const nullableText = () =>
  z.preprocess((value) => {
    if (typeof value === 'string' && value.trim() === '') {
      return null
    }
    return value
  }, z.string().nullable().optional())

const tipoEmpresaFormSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(2, 'Al menos 2 caracteres.')
    .max(50, 'Máximo 50 caracteres.')
    .regex(/^[A-Z0-9_]+$/, 'Usa mayúsculas, números o guion bajo.'),
  nombre: z.string().trim().min(3, 'Al menos 3 caracteres.').max(120, 'Máximo 120 caracteres.'),
  descripcion: nullableText(),
  icono: nullableText(),
  color: nullableText(),
  orden: z.number().int().min(0).max(9999),
  activo: z.boolean(),
  modulosHabilitados: z.array(z.string()),
})

type TipoEmpresaFormValues = {
  codigo: string
  nombre: string
  descripcion: string | null | undefined
  icono: string | null | undefined
  color: string | null | undefined
  orden: number
  activo: boolean
  modulosHabilitados: string[]
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

function agruparModulosPorCategoria(modulos: ModuloCatalogoItem[]) {
  const grupos = new Map<string, ModuloCatalogoItem[]>()
  for (const m of modulos) {
    const key = m.categoria ?? 'General'
    const prev = grupos.get(key) ?? []
    prev.push(m)
    grupos.set(key, prev)
  }
  return Array.from(grupos.entries()).sort(([a], [b]) => a.localeCompare(b, 'es'))
}

export function TiposEmpresaPage() {
  const { session } = useAuth()
  const authorization = useAuthorization()
  const handleUnauthorized = useHandleUnauthorized('TiposEmpresaPage')
  const accessToken = session?.accessToken ?? ''

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<TipoEmpresaListItem[]>([])
  const [modulosCatalogo, setModulosCatalogo] = useState<ModuloCatalogoItem[]>([])
  const [search, setSearch] = useState('')

  const [drawerMode, setDrawerMode] = useState<DrawerMode | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canManage = authorization.can('tipos_empresa.manage')

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TipoEmpresaFormValues>({
    resolver: zodResolver(tipoEmpresaFormSchema) as never,
    defaultValues: {
      codigo: '',
      nombre: '',
      descripcion: null,
      icono: null,
      color: null,
      orden: 0,
      activo: true,
      modulosHabilitados: [],
    },
  })

  const watchCodigo = watch('codigo')
  const watchNombre = watch('nombre')
  const watchIcono = watch('icono') as string | null
  const watchColor = watch('color') as string | null
  const watchActivo = watch('activo')
  const watchModulos = (watch('modulosHabilitados') ?? []) as string[]
  const readOnly = drawerMode === 'view'

  const IconCard = useMemo(() => getIconByName(watchIcono), [watchIcono])

  useEffect(() => {
    if (!accessToken) return
    setIsLoading(true)
    setError(null)
    Promise.all([adminPosService.listTiposEmpresa(accessToken), adminPosService.listModulos(accessToken)])
      .then(([tipos, modulos]) => {
        setItems(tipos)
        setModulosCatalogo(modulos)
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          void handleUnauthorized(err.status, err.message, { endpoint: 'listTiposEmpresa', page: 'TiposEmpresaPage' })
        } else if (err instanceof ApiNetworkError) {
          void handleUnauthorized(401, err.message, { endpoint: 'listTiposEmpresa', page: 'TiposEmpresaPage' })
        } else {
          void handleUnauthorized()
        }
        setError(getApiErrorMessage(err))
      })
      .finally(() => setIsLoading(false))
  }, [accessToken, handleUnauthorized])

  function openDrawer(mode: DrawerMode, tipo?: TipoEmpresaListItem | TipoEmpresaDetail) {
    setDrawerMode(mode)
    setSelectedId(tipo?.id ?? null)

    if (mode === 'create') {
      reset({
        codigo: '',
        nombre: '',
        descripcion: null,
        icono: 'Pill',
        color: '#2563eb',
        orden: 0,
        activo: true,
        modulosHabilitados: [],
      })
    } else if (tipo) {
      const detallePromise =
        'modulosHabilitados' in tipo
          ? Promise.resolve(tipo as TipoEmpresaDetail)
          : adminPosService.getTipoEmpresa(accessToken, tipo.id)

      detallePromise
        .then((detail) => {
          reset({
            codigo: detail.codigo,
            nombre: detail.nombre,
            descripcion: detail.descripcion,
            icono: detail.icono,
            color: detail.color,
            orden: detail.orden,
            activo: detail.activo,
            modulosHabilitados: detail.modulosHabilitados.map((m) => m.codigo),
          })
        })
        .catch((err) => {
          if (err instanceof ApiError) {
            void handleUnauthorized(err.status, err.message, { endpoint: 'getTipoEmpresa', page: 'TiposEmpresaPage' })
          } else if (err instanceof ApiNetworkError) {
            void handleUnauthorized(401, err.message, { endpoint: 'getTipoEmpresa', page: 'TiposEmpresaPage' })
          } else {
            void handleUnauthorized()
          }
          toast.error(getApiErrorMessage(err))
        })
    }
  }

  function closeDrawer() {
    setDrawerMode(null)
    setSelectedId(null)
  }

  async function toggleEstado(tipo: TipoEmpresaListItem) {
    if (!canManage) return
    try {
      await adminPosService.toggleTipoEmpresa(accessToken, tipo.id)
      setItems((prev) =>
        prev.map((it) => (it.id === tipo.id ? { ...it, activo: !it.activo } : it)),
      )
      toast.success(tipo.activo ? 'Tipo de empresa desactivado.' : 'Tipo de empresa activado.')
    } catch (err) {
      if (err instanceof ApiError) {
        void handleUnauthorized(err.status, err.message, { endpoint: 'toggleTipoEmpresa', page: 'TiposEmpresaPage' })
      } else if (err instanceof ApiNetworkError) {
        void handleUnauthorized(401, err.message, { endpoint: 'toggleTipoEmpresa', page: 'TiposEmpresaPage' })
      } else {
        void handleUnauthorized()
      }
      toast.error(getApiErrorMessage(err))
    }
  }

  async function onSubmit(values: any) {
    const typedValues = values as TipoEmpresaFormValues
    if (!canManage || readOnly) return
    setIsSubmitting(true)
    try {
      const payload = {
        codigo: typedValues.codigo,
        nombre: typedValues.nombre,
        descripcion: (typedValues.descripcion ?? null) as string | null,
        icono: (typedValues.icono ?? null) as string | null,
        color: (typedValues.color ?? null) as string | null,
        orden: typedValues.orden ?? 0,
        activo: typedValues.activo ?? true,
        modulosHabilitados: typedValues.modulosHabilitados ?? [],
      } as CreateTipoEmpresaPayload & UpdateTipoEmpresaPayload

      const guardado =
        drawerMode === 'create'
          ? await adminPosService.createTipoEmpresa(accessToken, payload)
          : selectedId
            ? await adminPosService.updateTipoEmpresa(accessToken, selectedId, payload)
            : null

      if (guardado) {
        const modulosActualizados =
          selectedId && drawerMode === 'edit'
            ? await adminPosService.updateTipoEmpresaModulos(accessToken, selectedId, {
                modulosHabilitados: typedValues.modulosHabilitados ?? [],
              })
            : null

        if (drawerMode === 'edit' && selectedId && !modulosActualizados && guardado) {
          await adminPosService.updateTipoEmpresaModulos(accessToken, selectedId, {
            modulosHabilitados: typedValues.modulosHabilitados ?? [],
          })
        }

        toast.success(
          drawerMode === 'create'
            ? 'Tipo de empresa creado correctamente.'
            : 'Tipo de empresa actualizado correctamente.',
        )

        const listaRefrescada = await adminPosService.listTiposEmpresa(accessToken)
        setItems(listaRefrescada)
        closeDrawer()
      }
    } catch (err) {
      if (err instanceof ApiError) {
        void handleUnauthorized(err.status, err.message, { endpoint: 'create/updateTipoEmpresa', page: 'TiposEmpresaPage' })
      } else if (err instanceof ApiNetworkError) {
        void handleUnauthorized(401, err.message, { endpoint: 'create/updateTipoEmpresa', page: 'TiposEmpresaPage' })
      } else {
        void handleUnauthorized()
      }
      toast.error(getApiErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (t) =>
        t.nombre.toLowerCase().includes(q) ||
        t.codigo.toLowerCase().includes(q) ||
        (t.descripcion?.toLowerCase() ?? '').includes(q),
    )
  }, [items, search])

  const modulosAgrupados = useMemo(() => agruparModulosPorCategoria(modulosCatalogo), [modulosCatalogo])

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-muted-foreground" />
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Administración POS
            </p>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Tipos de empresa</h1>
          <p className="text-sm text-muted-foreground">
            Define el catálogo de tipos de negocio y los módulos habilitados para cada uno.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar tipo de empresa…"
              className="pl-9"
            />
          </div>
          <Button
            onClick={() => openDrawer('create')}
            disabled={!canManage}
            className="shrink-0"
          >
            <Plus className="h-4 w-4" />
            Nuevo tipo
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              setIsLoading(true)
              try {
                const [tipos, modulos] = await Promise.all([
                  adminPosService.listTiposEmpresa(accessToken),
                  adminPosService.listModulos(accessToken),
                ])
                setItems(tipos)
                setModulosCatalogo(modulos)
              } catch (err) {
                if (err instanceof ApiError) {
                  void handleUnauthorized(err.status, err.message, { endpoint: 'listTiposEmpresa', page: 'TiposEmpresaPage' })
                } else if (err instanceof ApiNetworkError) {
                  void handleUnauthorized(401, err.message, { endpoint: 'listTiposEmpresa', page: 'TiposEmpresaPage' })
                } else {
                  void handleUnauthorized()
                }
                toast.error(getApiErrorMessage(err))
              } finally {
                setIsLoading(false)
              }
            }}
          >
            <RefreshCcw className="h-4 w-4" />
            Actualizar
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
            <Layers className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">
              {search.trim() ? 'No hay resultados para tu búsqueda.' : 'Aún no hay tipos de empresa.'}
            </p>
            <p className="text-sm text-muted-foreground">
              {search.trim()
                ? 'Prueba con otros términos.'
                : 'Crea el primer tipo de empresa para empezar a habilitar módulos.'}
            </p>
            {canManage && !search.trim() && (
              <Button onClick={() => openDrawer('create')} size="sm" className="mt-2">
                <Plus className="h-4 w-4" />
                Crear tipo de empresa
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((tipo) => {
            const Icono = getIconByName(tipo.icono)
            const color = tipo.color ?? '#6b7280'
            return (
              <Card key={tipo.id} className="overflow-hidden transition hover:shadow-md">
                <div className="h-1.5 w-full" style={{ background: color }} />
                <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 pb-3">
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: `${color}14`, color }}
                    >
                      <Icono className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg leading-6">{tipo.nombre}</CardTitle>
                        <Badge variant={tipo.activo ? 'success' : 'outline'} className="shrink-0">
                          {tipo.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                      <CardDescription>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono">
                          {tipo.codigo}
                        </code>
                      </CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Opciones</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>Opciones</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => openDrawer('view', tipo)}>
                        <CheckCircle2 className="mr-2 h-4 w-4 text-muted-foreground" />
                        Ver detalle
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => openDrawer('edit', tipo)}
                        disabled={!canManage}
                      >
                        <Edit3 className="mr-2 h-4 w-4 text-muted-foreground" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => toggleEstado(tipo)}
                        disabled={!canManage}
                      >
                        <ToggleLeft className="mr-2 h-4 w-4 text-muted-foreground" />
                        {tipo.activo ? 'Desactivar' : 'Activar'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="space-y-2 pb-3">
                  {tipo.descripcion && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{tipo.descripcion}</p>
                  )}
                  <div className="grid grid-cols-2 gap-2 pt-1 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Módulos</p>
                      <p className="font-medium">{tipo.modulosHabilitadosCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Empresas</p>
                      <p className="font-medium">{tipo.empresasCount}</p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between border-t bg-muted/30 py-3">
                  <Button variant="outline" size="sm" onClick={() => openDrawer('view', tipo)}>
                    Ver
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => openDrawer('edit', tipo)}
                    disabled={!canManage}
                  >
                    <Edit3 className="h-4 w-4" />
                    Editar
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      <SidePanel open={Boolean(drawerMode)} onOpenChange={(open) => !open && closeDrawer()}>
        <SidePanelContent className="max-w-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
            <header className="flex items-start justify-between gap-4 border-b px-6 py-5">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: `${watchColor ?? '#6b7280'}14`,
                    color: watchColor ?? '#6b7280',
                  }}
                >
                  <IconCard className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold tracking-tight">
                    {drawerMode === 'create'
                      ? 'Nuevo tipo de empresa'
                      : drawerMode === 'edit'
                        ? 'Editar tipo de empresa'
                        : 'Detalle del tipo de empresa'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {drawerMode === 'create'
                      ? 'Define los datos básicos y selecciona los módulos habilitados.'
                      : drawerMode === 'edit'
                        ? 'Actualiza la información y la configuración de módulos.'
                        : 'Consulta los datos y los módulos habilitados para este tipo.'}
                  </p>
                </div>
              </div>
              <SidePanelClose asChild>
                <Button variant="ghost" size="icon">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Cerrar</span>
                </Button>
              </SidePanelClose>
            </header>

            <ScrollArea className="flex-1 px-6 py-5">
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="tp-codigo">
                      Código <span className="text-destructive">*</span>
                    </Label>
                    <Controller
                      control={control}
                      name="codigo"
                      render={({ field }) => (
                        <Input
                          id="tp-codigo"
                          placeholder="BOTICA"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(normalizeTipoEmpresaCode(e.target.value))}
                          disabled={readOnly || drawerMode !== 'create'}
                        />
                      )}
                    />
                    <FieldError message={errors.codigo?.message} />
                    {drawerMode !== 'create' && (
                      <p className="text-xs text-muted-foreground">El código no se puede editar.</p>
                    )}
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="tp-nombre">
                      Nombre <span className="text-destructive">*</span>
                    </Label>
                    <Controller
                      control={control}
                      name="nombre"
                      render={({ field }) => (
                        <Input
                          id="tp-nombre"
                          placeholder="Botica / Farmacia"
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          disabled={readOnly}
                        />
                      )}
                    />
                    <FieldError message={errors.nombre?.message} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tp-descripcion">Descripción</Label>
                  <Controller
                    control={control}
                    name="descripcion"
                    render={({ field }) => (
                      <Input
                        id="tp-descripcion"
                        placeholder="Ej: Negocio orientado a la venta de medicamentos y atención farmacéutica."
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        disabled={readOnly}
                      />
                    )}
                  />
                  <FieldError message={errors.descripcion?.message} />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="tp-orden">Orden</Label>
                    <Controller
                      control={control}
                      name="orden"
                      render={({ field }) => (
                        <Input
                          id="tp-orden"
                          type="number"
                          min={0}
                          max={9999}
                          value={field.value ?? 0}
                          onChange={(e) =>
                            field.onChange(e.target.value === '' ? 0 : Number(e.target.value))
                          }
                          disabled={readOnly}
                        />
                      )}
                    />
                    <FieldError message={errors.orden?.message} />
                  </div>

                  <div className="flex items-end">
                    <div className="flex h-10 w-full items-center gap-3 rounded-md border bg-muted/30 px-3">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={Boolean(watchActivo)}
                          onCheckedChange={(v) => setValue('activo', v, { shouldDirty: true })}
                          disabled={readOnly}
                        />
                        <div>
                          <p className="text-sm font-medium leading-4">Estado</p>
                          <p className="text-xs text-muted-foreground">
                            {watchActivo ? 'Visible y habilitado' : 'Oculto en nuevas operaciones'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Icono</Label>
                    <div className="grid grid-cols-5 gap-2">
                      {iconoOpciones.map((opt) => {
                        const Icon = opt.component
                        const seleccionado = watchIcono === opt.id
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setValue('icono', opt.id, { shouldDirty: true })}
                            disabled={readOnly}
                            className={`flex h-11 flex-col items-center justify-center rounded-md border text-xs transition ${
                              seleccionado
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'hover:bg-muted/60'
                            } disabled:cursor-not-allowed disabled:opacity-70`}
                          >
                            <Icon className="h-4 w-4" />
                            <span className="mt-0.5 text-[10px] text-muted-foreground">
                              {opt.id}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    <FieldError message={errors.icono?.message} />
                  </div>

                  <div className="space-y-2">
                    <Label>Color</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {colorOpciones.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setValue('color', opt.id, { shouldDirty: true })}
                          disabled={readOnly}
                          className={`flex h-11 flex-col items-center justify-center rounded-md border text-xs transition ${
                            watchColor === opt.id
                              ? 'border-foreground ring-2 ring-offset-1'
                              : 'hover:bg-muted/60'
                          } disabled:cursor-not-allowed disabled:opacity-70`}
                          style={{ borderColor: watchColor === opt.id ? opt.id : undefined }}
                        >
                          <span
                            className="h-4 w-4 rounded-full"
                            style={{ background: opt.id }}
                          />
                          <span className="mt-0.5 text-[10px] text-muted-foreground">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                    <FieldError message={errors.color?.message} />
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Módulos habilitados</h3>
                      <p className="text-xs text-muted-foreground">
                        {watchModulos.length} de {modulosCatalogo.length} seleccionados
                      </p>
                    </div>
                    {!readOnly && (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setValue(
                              'modulosHabilitados',
                              modulosCatalogo.map((m) => m.codigo),
                              { shouldDirty: true },
                            )
                          }
                        >
                          Todos
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setValue('modulosHabilitados', [], { shouldDirty: true })}
                        >
                          Limpiar
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border bg-muted/10">
                    {modulosAgrupados.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                        No hay módulos disponibles en el catálogo.
                      </div>
                    ) : (
                      <div className="divide-y">
                        {modulosAgrupados.map(([categoria, mods]) => (
                          <div key={categoria} className="p-4">
                            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              {categoria}
                            </p>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {mods.map((mod) => (
                                <label
                                  key={mod.codigo}
                                  className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted/60"
                                >
                                  <Checkbox
                                    checked={watchModulos.includes(mod.codigo)}
                                    disabled={readOnly}
                                    onCheckedChange={(checked) => {
                                      if (readOnly) return
                                      const next = checked
                                        ? [...watchModulos, mod.codigo]
                                        : watchModulos.filter((c) => c !== mod.codigo)
                                      setValue('modulosHabilitados', next, { shouldDirty: true })
                                    }}
                                  />
                                  <div className="min-w-0 space-y-0.5">
                                    <p className="text-sm font-medium leading-5">{mod.nombre}</p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {mod.descripcion ?? mod.codigo}
                                    </p>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <FieldError message={errors.modulosHabilitados?.message} />
                </div>
              </div>
            </ScrollArea>

            <footer className="flex items-center justify-between gap-3 border-t px-6 py-4">
              <div className="text-xs text-muted-foreground">
                {drawerMode !== 'create' && watchCodigo && (
                  <>
                    Tipo: <code className="font-mono">{watchCodigo}</code>
                    <span className="mx-2 text-muted-foreground/60">·</span>
                    Nombre:{' '}
                    <span className="font-medium text-foreground">{watchNombre ?? '—'}</span>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <SidePanelClose asChild>
                  <Button type="button" variant="outline">
                    Cancelar
                  </Button>
                </SidePanelClose>
                {drawerMode !== 'view' && (
                  <Button type="submit" disabled={isSubmitting || !canManage}>
                    {isSubmitting ? <Loader className="h-4 w-4" /> : null}
                    {drawerMode === 'create' ? 'Crear tipo' : 'Guardar cambios'}
                  </Button>
                )}
              </div>
            </footer>
          </form>
        </SidePanelContent>
      </SidePanel>
    </div>
  )
}
