import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import { ImageUp, Plus, RefreshCcw, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Loader } from '@/components/ui/loader'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SidePanel, SidePanelClose, SidePanelContent } from '@/components/ui/side-panel'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { implementationService } from '@/services/implementationService'
import { companyService } from '@/services/companyService'
import { productsService } from '@/services/productsService'
import type { InitialInventoryLoadRow } from '@/types/implementation'
import type { ProductCatalogItem } from '@/types/products'
import { useAuth } from '@/hooks/useAuth'
import { ApiError, ApiNetworkError } from '@/services/apiClient'
import { toast } from 'sonner'
import type { CompanyProfile, UpdateCompanyProfilePayload } from '@/types/company'

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function getApiErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof ApiNetworkError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'No fue posible completar la operación.'
}

function getLoadStatusVariant(status: string) {
  if (status === 'COMPLETADA') return 'success'
  if (status === 'FALLIDA') return 'destructive'
  if (status === 'ANULADA') return 'warning'
  return 'outline'
}

function ProductAutocomplete({
  accessToken,
  value,
  onValueChange,
  placeholder,
}: {
  accessToken: string
  value: string
  onValueChange: (value: string) => void
  placeholder: string
}) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [items, setItems] = useState<ProductCatalogItem[]>([])

  useEffect(() => {
    if (!query.trim() || !accessToken) {
      setItems([])
      return
    }

    const handle = window.setTimeout(() => {
      setIsLoading(true)
      productsService
        .list(accessToken, {
          search: query.trim(),
          status: 'ACTIVO',
          page: 1,
          pageSize: 12,
          sortBy: 'name',
          sortDir: 'asc',
        })
        .then((response) => setItems(response.items))
        .catch(() => setItems([]))
        .finally(() => setIsLoading(false))
    }, 250)

    return () => window.clearTimeout(handle)
  }, [accessToken, query])

  useEffect(() => {
    if (!value) {
      return
    }
  }, [value])

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        placeholder={placeholder}
      />
      {isOpen ? (
        <Card className="absolute z-50 mt-1 w-full overflow-hidden p-1 shadow-lg">
          <div className="max-h-72 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader className="h-6 w-6" />
              </div>
            ) : items.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</div>
            ) : (
              items.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted/60"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onValueChange(product.id)
                    setQuery(`${product.name} · ${product.sku}`)
                    setIsOpen(false)
                  }}
                >
                  <span className="min-w-0 flex-1 truncate text-foreground">
                    {product.name}
                    <span className="text-muted-foreground"> · {product.sku}</span>
                  </span>
                  <Badge variant={product.status === 'ACTIVO' ? 'success' : 'outline'}>
                    {product.status}
                  </Badge>
                </button>
              ))
            )}
          </div>
        </Card>
      ) : null}
    </div>
  )
}

const initialInventorySchema = z.object({
  items: z
    .array(
      z.object({
        productoId: z.string().uuid({ message: 'Selecciona un producto.' }),
        numeroLote: z.string().min(2, 'Ingresa un lote.').max(80, 'Máximo 80 caracteres.'),
        fechaVencimiento: z.string().min(1, 'Ingresa una fecha de vencimiento.'),
        costoUnitario: z.number().min(0, 'El costo debe ser mayor o igual a 0.'),
        cantidad: z.number().int().min(1, 'La cantidad debe ser mayor a 0.'),
      }),
    )
    .min(1, 'Agrega al menos un lote.'),
})

type InitialInventoryFormValues = z.infer<typeof initialInventorySchema>

const nullableText = (schema: z.ZodTypeAny) =>
  z.preprocess((value) => {
    if (typeof value === 'string' && value.trim() === '') {
      return null
    }
    return value
  }, schema)

const companyProfileSchema = z.object({
  logoUrl: nullableText(z.string().max(500).nullable().optional()),
  razonSocial: z.string().min(3, 'Ingresa la razón social.').max(200),
  nombreComercial: nullableText(z.string().max(200).nullable().optional()),
  ruc: z.string().regex(/^\d{11}$/, 'El RUC debe tener 11 dígitos.'),
  direccionFiscal: nullableText(z.string().max(255).nullable().optional()),
  telefono: nullableText(z.string().max(30).nullable().optional()),
  email: nullableText(z.string().email('Ingresa un correo válido.').max(150).nullable().optional()),
  moneda: z.enum(['PEN', 'USD']),
  igvPorDefecto: z
    .number()
    .min(0, 'El IGV debe estar entre 0 y 100.')
    .max(100, 'El IGV debe estar entre 0 y 100.'),
  activo: z.boolean(),
})

type CompanyProfileFormValues = z.infer<typeof companyProfileSchema>

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-destructive">{message}</p>
}

export function ConfiguracionPage() {
  const { logout, session } = useAuth()
  const accessToken = session?.accessToken ?? ''
  const branchName = session?.user.branchName ?? ''

  const [activeTab, setActiveTab] = useState<
    'empresa' | 'sucursales' | 'comprobantes' | 'implementacion' | 'catalogos'
  >('empresa')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loads, setLoads] = useState<InitialInventoryLoadRow[]>([])
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [company, setCompany] = useState<CompanyProfile | null>(null)
  const [companyError, setCompanyError] = useState<string | null>(null)
  const [isCompanyLoading, setIsCompanyLoading] = useState(false)
  const [isCompanySubmitting, setIsCompanySubmitting] = useState(false)

  const initialInventoryForm = useForm<InitialInventoryFormValues>({
    resolver: zodResolver(initialInventorySchema),
    defaultValues: {
      items: [
        {
          productoId: '',
          numeroLote: '',
          fechaVencimiento: '',
          costoUnitario: 0,
          cantidad: 1,
        },
      ],
    },
  })

  const companyForm = useForm<CompanyProfileFormValues>({
    resolver: zodResolver(companyProfileSchema),
    defaultValues: {
      logoUrl: null,
      razonSocial: '',
      nombreComercial: '',
      ruc: '',
      direccionFiscal: '',
      telefono: '',
      email: '',
      moneda: 'PEN',
      igvPorDefecto: 18,
      activo: true,
    },
  })

  const {
    fields: itemFields,
    append: appendItem,
    remove: removeItem,
  } = useFieldArray({
    control: initialInventoryForm.control,
    name: 'items',
  })

  async function handleUnauthorized() {
    toast.error('Tu sesión ya no es válida. Ingresa nuevamente para continuar.')
    await logout()
  }

  async function loadInitialInventoryLoads() {
    if (!accessToken) return
    setIsLoading(true)
    setError(null)
    try {
      const response = await implementationService.listInitialInventoryLoads(accessToken)
      setLoads(response.rows)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await handleUnauthorized()
        return
      }
      setError(getApiErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  function mapCompanyToFormValues(value: CompanyProfile): CompanyProfileFormValues {
    return {
      logoUrl: value.logoUrl,
      razonSocial: value.razonSocial,
      nombreComercial: value.nombreComercial ?? '',
      ruc: value.ruc,
      direccionFiscal: value.direccionFiscal ?? '',
      telefono: value.telefono ?? '',
      email: value.email ?? '',
      moneda: (value.moneda as 'PEN' | 'USD') ?? 'PEN',
      igvPorDefecto: value.igvPorDefecto ?? 18,
      activo: value.activo ?? true,
    }
  }

  async function loadCompanyProfile() {
    if (!accessToken) {
      return
    }

    setIsCompanyLoading(true)
    setCompanyError(null)

    try {
      const response = await companyService.getProfile(accessToken)
      setCompany(response.company)
      companyForm.reset(mapCompanyToFormValues(response.company))
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await handleUnauthorized()
        return
      }
      setCompanyError(getApiErrorMessage(err))
    } finally {
      setIsCompanyLoading(false)
    }
  }

  useEffect(() => {
    void loadInitialInventoryLoads()
    void loadCompanyProfile()
  }, [accessToken])

  const totals = useMemo(() => {
    const values = initialInventoryForm.getValues()
    const products = new Set(values.items.map((item) => item.productoId).filter(Boolean))
    return {
      rows: values.items.length,
      products: products.size,
      lots: values.items.length,
    }
  }, [initialInventoryForm])

  async function handleCreateInitialInventoryLoad(values: InitialInventoryFormValues) {
    if (!accessToken) return
    setIsSubmitting(true)
    try {
      await implementationService.createInitialInventoryLoad(accessToken, values)
      toast.success('Carga inicial registrada correctamente.')
      setIsDrawerOpen(false)
      initialInventoryForm.reset()
      await loadInitialInventoryLoads()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await handleUnauthorized()
        return
      }
      toast.error(getApiErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleUpdateCompany(values: CompanyProfileFormValues) {
    if (!accessToken) return
    setIsCompanySubmitting(true)

    try {
      const response = await companyService.updateProfile(
        accessToken,
        values as UpdateCompanyProfilePayload,
      )
      setCompany(response.company)
      companyForm.reset(mapCompanyToFormValues(response.company))
      toast.success('Empresa actualizada correctamente.')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await handleUnauthorized()
        return
      }
      toast.error(getApiErrorMessage(err))
    } finally {
      setIsCompanySubmitting(false)
    }
  }

  const companyLogoValue = companyForm.watch('logoUrl')
  const companyLogoUrl = typeof companyLogoValue === 'string' ? companyLogoValue : null

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Ajustes administrativos y herramientas de implementación.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList>
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="sucursales" disabled>
            Sucursales
          </TabsTrigger>
          <TabsTrigger value="comprobantes" disabled>
            Comprobantes
          </TabsTrigger>
          <TabsTrigger value="implementacion">Implementación</TabsTrigger>
          <TabsTrigger value="catalogos" disabled>
            Catálogos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="empresa" className="space-y-4 pt-4">
          {companyError ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {companyError}
            </div>
          ) : isCompanyLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader className="h-7 w-7" />
            </div>
          ) : (
            <form
              onSubmit={companyForm.handleSubmit(handleUpdateCompany)}
              className="space-y-4"
            >
              <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-softSm sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Empresa</p>
                  <p className="text-xs text-muted-foreground">
                    Edita los datos de la empresa asociada a tu sesión. No es posible crear, eliminar o cambiar de empresa.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!companyForm.formState.isDirty || isCompanySubmitting}
                    onClick={() => {
                      if (company) {
                        companyForm.reset(mapCompanyToFormValues(company))
                      }
                    }}
                  >
                    Descartar cambios
                  </Button>
                  <Button
                    type="submit"
                    disabled={!companyForm.formState.isDirty || isCompanySubmitting}
                  >
                    {isCompanySubmitting ? <Loader className="h-4 w-4" /> : null}
                    Guardar cambios
                  </Button>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Información general</CardTitle>
                  <CardDescription>Datos legales y comerciales de la empresa.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <p className="text-sm font-medium text-foreground">Logo</p>
                    <div className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-16 w-16 overflow-hidden rounded-2xl border bg-muted">
                          {companyLogoUrl ? (
                            <img
                              src={companyLogoUrl}
                              alt="Logo de la empresa"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <ImageUp className="h-6 w-6" />
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">
                            Logo corporativo
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Se mostrará en comprobantes y pantallas administrativas.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <label className="inline-flex">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0]
                              if (!file) return
                              const reader = new FileReader()
                              reader.onload = () => {
                                const result = typeof reader.result === 'string' ? reader.result : null
                                companyForm.setValue('logoUrl', result, { shouldDirty: true })
                              }
                              reader.readAsDataURL(file)
                            }}
                          />
                          <Button type="button" variant="outline">
                            Subir logo
                          </Button>
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={!companyLogoUrl}
                          onClick={() => companyForm.setValue('logoUrl', null, { shouldDirty: true })}
                        >
                          Quitar
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="razonSocial">
                      Razón social
                    </label>
                    <Input id="razonSocial" {...companyForm.register('razonSocial')} />
                    <FieldError message={companyForm.formState.errors.razonSocial?.message} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="nombreComercial">
                      Nombre comercial
                    </label>
                    <Input id="nombreComercial" {...companyForm.register('nombreComercial')} />
                    <FieldError message={companyForm.formState.errors.nombreComercial?.message as string | undefined} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="ruc">
                      RUC
                    </label>
                    <Input id="ruc" inputMode="numeric" {...companyForm.register('ruc')} />
                    <FieldError message={companyForm.formState.errors.ruc?.message} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Información de contacto</CardTitle>
                  <CardDescription>Datos para comunicación y facturación.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="direccionFiscal">
                      Dirección fiscal
                    </label>
                    <Input id="direccionFiscal" {...companyForm.register('direccionFiscal')} />
                    <FieldError message={companyForm.formState.errors.direccionFiscal?.message as string | undefined} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="telefono">
                      Teléfono
                    </label>
                    <Input id="telefono" {...companyForm.register('telefono')} />
                    <FieldError message={companyForm.formState.errors.telefono?.message as string | undefined} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="email">
                      Correo electrónico
                    </label>
                    <Input id="email" type="email" {...companyForm.register('email')} />
                    <FieldError message={companyForm.formState.errors.email?.message as string | undefined} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Configuración</CardTitle>
                  <CardDescription>Parámetros base para la operación.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Moneda</label>
                    <Controller
                      control={companyForm.control}
                      name="moneda"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una moneda" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PEN">PEN · Soles</SelectItem>
                            <SelectItem value="USD">USD · Dólares</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="igvPorDefecto">
                      IGV por defecto (%)
                    </label>
                    <Input
                      id="igvPorDefecto"
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      {...companyForm.register('igvPorDefecto', { valueAsNumber: true })}
                    />
                    <FieldError message={companyForm.formState.errors.igvPorDefecto?.message} />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border p-4 md:col-span-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">Empresa activa</p>
                      <p className="text-xs text-muted-foreground">
                        Si se desactiva, se bloquea el uso operativo en esta empresa.
                      </p>
                    </div>
                    <Controller
                      control={companyForm.control}
                      name="activo"
                      render={({ field }) => (
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Preparado para SaaS</CardTitle>
                  <CardDescription>Información informativa de solo lectura.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border p-4">
                    <p className="text-xs font-medium text-muted-foreground">Fecha de creación</p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {company?.createdAt ? formatDateTime(company.createdAt) : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border p-4">
                    <p className="text-xs font-medium text-muted-foreground">Última actualización</p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {company?.updatedAt ? formatDateTime(company.updatedAt) : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-dashed p-4 md:col-span-2">
                    <p className="text-sm font-medium text-foreground">Plan contratado</p>
                    <p className="mt-1 text-xs text-muted-foreground">Próximamente</p>
                  </div>
                  <div className="rounded-xl border border-dashed p-4 md:col-span-2">
                    <p className="text-sm font-medium text-foreground">Estado de suscripción</p>
                    <p className="mt-1 text-xs text-muted-foreground">Próximamente</p>
                  </div>
                </CardContent>
              </Card>
            </form>
          )}
        </TabsContent>

        <TabsContent value="sucursales" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Sucursales</CardTitle>
              <CardDescription>Disponible próximamente.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="text-sm font-medium text-foreground">Disponible próximamente</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Esta sección se habilitará luego de cerrar Empresa.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comprobantes" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Comprobantes</CardTitle>
              <CardDescription>Disponible próximamente.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="text-sm font-medium text-foreground">Disponible próximamente</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Esta sección se habilitará luego de cerrar Empresa y Sucursales.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="catalogos" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Catálogos</CardTitle>
              <CardDescription>Disponible próximamente.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="text-sm font-medium text-foreground">Disponible próximamente</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Esta sección se habilitará en una fase posterior.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="implementacion" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle>Carga Inicial de Inventario</CardTitle>
                <CardDescription>
                  Permite registrar el stock existente de la botica antes de iniciar operaciones con Rayego
                  POS.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void loadInitialInventoryLoads()}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Actualizar
                </Button>
                <Button type="button" onClick={() => setIsDrawerOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva carga
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {error ? (
                <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                  {error}
                </div>
              ) : isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader className="h-7 w-7" />
                </div>
              ) : loads.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <p className="text-sm font-medium text-foreground">Aún no existen cargas registradas</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cuando realices una carga inicial aparecerá en esta lista.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Sucursal</TableHead>
                      <TableHead className="text-right">Productos cargados</TableHead>
                      <TableHead className="text-right">Lotes creados</TableHead>
                      <TableHead>Responsable</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loads.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-muted-foreground">{formatDateTime(row.createdAt)}</TableCell>
                        <TableCell className="font-medium text-foreground">{row.branchName}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{row.productsLoaded}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{row.lotsCreated}</TableCell>
                        <TableCell className="text-muted-foreground">{row.responsibleName}</TableCell>
                        <TableCell>
                          <Badge variant={getLoadStatusVariant(row.status)}>{row.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <SidePanel open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SidePanelContent>
              <div className="flex flex-col border-b bg-background/95 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Nueva carga inicial</p>
                    <p className="text-xs text-muted-foreground">
                      Sucursal: <span className="font-medium text-foreground">{branchName}</span>
                    </p>
                  </div>
                  <SidePanelClose asChild>
                    <Button type="button" variant="ghost" size="icon">
                      <X className="h-4 w-4" />
                    </Button>
                  </SidePanelClose>
                </div>
              </div>

              <form
                onSubmit={initialInventoryForm.handleSubmit(handleCreateInitialInventoryLoad)}
                className="flex h-full flex-col"
              >
                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Lotes a registrar</CardTitle>
                      <CardDescription>
                        Esta operación no genera compras, proveedores ni documentos. Registra lotes y kardex como
                        inventario inicial.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {itemFields.map((field, index) => {
                        const itemError = initialInventoryForm.formState.errors.items?.[index]
                        return (
                          <div key={field.id} className="rounded-xl border p-4">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-medium text-foreground">Lote #{index + 1}</p>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={itemFields.length === 1}
                                onClick={() => removeItem(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>

                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                              <div className="space-y-2 md:col-span-2">
                                <p className="text-xs font-medium text-muted-foreground">Producto</p>
                                <ProductAutocomplete
                                  accessToken={accessToken}
                                  value={initialInventoryForm.watch(`items.${index}.productoId`)}
                                  onValueChange={(value) =>
                                    initialInventoryForm.setValue(`items.${index}.productoId`, value, {
                                      shouldValidate: true,
                                      shouldDirty: true,
                                    })
                                  }
                                  placeholder="Buscar por nombre o SKU"
                                />
                                <FieldError message={itemError?.productoId?.message} />
                              </div>

                              <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">Número de lote</p>
                                <Input
                                  {...initialInventoryForm.register(`items.${index}.numeroLote` as const)}
                                />
                                <FieldError message={itemError?.numeroLote?.message} />
                              </div>

                              <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">Vencimiento</p>
                                <Input
                                  type="date"
                                  {...initialInventoryForm.register(`items.${index}.fechaVencimiento` as const)}
                                />
                                <FieldError message={itemError?.fechaVencimiento?.message} />
                              </div>

                              <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">Costo inicial</p>
                                <Input
                                  type="number"
                                  step="0.01"
                                  inputMode="decimal"
                                  {...initialInventoryForm.register(`items.${index}.costoUnitario` as const, {
                                    valueAsNumber: true,
                                  })}
                                />
                                <FieldError message={itemError?.costoUnitario?.message} />
                              </div>

                              <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">Cantidad</p>
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  {...initialInventoryForm.register(`items.${index}.cantidad` as const, {
                                    valueAsNumber: true,
                                  })}
                                />
                                <FieldError message={itemError?.cantidad?.message} />
                              </div>
                            </div>
                          </div>
                        )
                      })}

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          appendItem({
                            productoId: '',
                            numeroLote: '',
                            fechaVencimiento: '',
                            costoUnitario: 0,
                            cantidad: 1,
                          })
                        }
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Agregar lote
                      </Button>
                      <FieldError message={initialInventoryForm.formState.errors.items?.message} />
                    </CardContent>
                  </Card>
                </div>

                <div className="sticky bottom-0 border-t bg-background/95 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs text-muted-foreground">
                      {totals.lots} lotes · {totals.products} productos
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <SidePanelClose asChild>
                        <Button type="button" variant="outline" disabled={isSubmitting}>
                          Cancelar
                        </Button>
                      </SidePanelClose>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader className="mr-2 h-4 w-4" /> : null}
                        Registrar carga
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            </SidePanelContent>
          </SidePanel>
        </TabsContent>
      </Tabs>
    </div>
  )
}
