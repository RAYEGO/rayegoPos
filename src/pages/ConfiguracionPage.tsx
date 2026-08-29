import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  Building2,
  Download,
  ImageUp,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Loader } from '@/components/ui/loader'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SidePanel, SidePanelClose, SidePanelContent } from '@/components/ui/side-panel'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { branchesService } from '@/services/branchesService'
import { implementationService } from '@/services/implementationService'
import { companyService } from '@/services/companyService'
import { productsService } from '@/services/productsService'
import type { InitialInventoryLoadRow } from '@/types/implementation'
import type { CreateProductPayload, ProductCatalogItem } from '@/types/products'
import type { Branch } from '@/types/settings'
import { formatImplementationMessage, IMPLEMENTATION_MESSAGES } from '@/modules/implementation/messages'
import { useAuth } from '@/hooks/useAuth'
import { useAuthorization } from '@/hooks/useAuthorization'
import { useHandleUnauthorized } from '@/hooks/useHandleUnauthorized'
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
  onProductSelected,
  placeholder,
}: {
  accessToken: string
  value: string
  onValueChange: (value: string) => void
  onProductSelected?: (product: ProductCatalogItem) => void
  placeholder: string
}) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [items, setItems] = useState<ProductCatalogItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

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
    const el = inputRef.current
    if (!el) return

    const handleFocus = () => setIsOpen(true)
    const handleBlur = () => window.setTimeout(() => setIsOpen(false), 120)
    const handleInput = () => {
      setQuery(el.value)
      setIsOpen(true)
    }

    el.addEventListener('focus', handleFocus)
    el.addEventListener('blur', handleBlur)
    el.addEventListener('input', handleInput)

    return () => {
      el.removeEventListener('focus', handleFocus)
      el.removeEventListener('blur', handleBlur)
      el.removeEventListener('input', handleInput)
    }
  }, [])

  useEffect(() => {
    if (!value) {
      return
    }
  }, [value])

  return (
    <div className="relative">
      <Input
        ref={inputRef}
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
                    onProductSelected?.(product)
                    if (inputRef.current) {
                      inputRef.current.value = `${product.name} · ${product.sku}`
                    }
                    setQuery('')
                    setItems([])
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

const initialInventoryItemSchema = z
  .object({
    productoId: z.string().uuid({ message: 'Selecciona un producto.' }),
    presentacionId: z.string().uuid({ message: 'Selecciona una presentación.' }),
    numeroLote: z.string().min(2, 'Ingresa un lote.').max(80, 'Máximo 80 caracteres.'),
    fechaVencimiento: z.string().min(1, 'Ingresa una fecha de vencimiento.'),
    costoUnitario: z.number().min(0, 'El costo debe ser mayor o igual a 0.'),
    cantidad: z.number().int().min(1, 'La cantidad debe ser mayor a 0.'),
  })

const initialInventorySchema = z.object({
  items: z.array(initialInventoryItemSchema).min(1, 'Agrega al menos un lote.'),
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
  moneda: z.string().min(3).max(3),
  igvPorDefecto: z
    .number()
    .min(0, 'El IGV debe estar entre 0 y 100.')
    .max(100, 'El IGV debe estar entre 0 y 100.'),
  activo: z.boolean(),
})

type CompanyProfileFormValues = z.infer<typeof companyProfileSchema>

const supportedCurrencies = [
  { code: 'PEN', label: 'Soles' },
  { code: 'USD', label: 'Dólares' },
] as const

const branchFormSchema = z.object({
  nombre: z
    .string({ message: 'El nombre es obligatorio.' })
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres.')
    .max(120, 'Máximo 120 caracteres.'),
  codigo: z
    .string({ message: 'El código es obligatorio.' })
    .trim()
    .min(2, 'El código debe tener al menos 2 caracteres.')
    .max(20, 'Máximo 20 caracteres.')
    .regex(/^[A-Z0-9_-]+$/i, 'Usa letras, números, guion bajo o guion.')
    .transform((value) => value.toUpperCase()),
  direccion: nullableText(z.string().max(255).nullable().optional()),
  telefono: nullableText(z.string().max(30).nullable().optional()),
  email: z
    .string()
    .email('Ingresa un correo válido.')
    .max(150)
    .nullable()
    .optional()
    .or(z.literal(''))
    .transform((value) => (value === '' ? null : value)),
  activo: z.boolean().default(true),
})

const branchUpdateSchema = branchFormSchema
  .partial()
  .omit({ codigo: true })
  .extend({
    nombre: branchFormSchema.shape.nombre.optional(),
  })

type BranchFormValues = z.infer<typeof branchFormSchema>

const appSystemInfo = {
  version: 'Rayego POS v1.0',
  architecture: 'Multiempresa preparada',
} as const

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-destructive">{message}</p>
}

export function ConfiguracionPage() {
  const { session } = useAuth()
  const authorization = useAuthorization()
  const accessToken = session?.accessToken ?? ''
  const branchName = session?.user.branchName ?? ''
  const canEditCompany = authorization.hasRole('ADMIN')

  const [activeTab, setActiveTab] = useState<
    'empresa' | 'sucursales' | 'comprobantes' | 'implementacion' | 'herramientas' | 'catalogos'
  >('empresa')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loads, setLoads] = useState<InitialInventoryLoadRow[]>([])
  const [productCache, setProductCache] = useState<Record<string, ProductCatalogItem>>({})
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isDownloadingInitialInventoryTemplate, setIsDownloadingInitialInventoryTemplate] = useState(false)
  const [isCatalogDrawerOpen, setIsCatalogDrawerOpen] = useState(false)
  const [isCatalogImporting, setIsCatalogImporting] = useState(false)
  const [catalogImportSummary, setCatalogImportSummary] = useState<{
    created: number
    skipped: number
    errors: number
    errorDetails: string[]
  } | null>(null)
  const [company, setCompany] = useState<CompanyProfile | null>(null)
  const [companyError, setCompanyError] = useState<string | null>(null)
  const [isCompanyLoading, setIsCompanyLoading] = useState(false)
  const [isCompanySubmitting, setIsCompanySubmitting] = useState(false)
  const [isCompanyLogoUploading, setIsCompanyLogoUploading] = useState(false)
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false)
  const [purgeConfirmText, setPurgeConfirmText] = useState('')
  const [isPurging, setIsPurging] = useState(false)
  const [productionDialogOpen, setProductionDialogOpen] = useState(false)
  const [productionConfirmText, setProductionConfirmText] = useState('')
  const [isSettingProduction, setIsSettingProduction] = useState(false)

  const [branches, setBranches] = useState<Branch[]>([])
  const [isBranchesLoading, setIsBranchesLoading] = useState(false)
  const [branchesError, setBranchesError] = useState<string | null>(null)
  const [isBranchPanelOpen, setIsBranchPanelOpen] = useState(false)
  const [isBranchPanelSubmitting, setIsBranchPanelSubmitting] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)
  const [isBranchesRefreshing, setIsBranchesRefreshing] = useState(false)

  const csvInputRef = useRef<HTMLInputElement | null>(null)
  const catalogCsvInputRef = useRef<HTMLInputElement | null>(null)
  const companyLogoInputRef = useRef<HTMLInputElement | null>(null)

  const initialInventoryForm = useForm<InitialInventoryFormValues>({
    resolver: zodResolver(initialInventorySchema),
    defaultValues: {
      items: [
        {
          productoId: '',
          presentacionId: '',
          numeroLote: '',
          fechaVencimiento: '',
          costoUnitario: 0,
          cantidad: 1,
        },
      ],
    },
  })

  const branchForm = useForm<BranchFormValues>({
    resolver: zodResolver(selectedBranch ? branchUpdateSchema : branchFormSchema) as never,
    defaultValues: {
      nombre: '',
      codigo: '',
      direccion: null,
      telefono: null,
      email: null,
      activo: true,
    },
    mode: 'onChange',
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

  const handleUnauthorized = useHandleUnauthorized('ConfiguracionPage')

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
      moneda: value.moneda ?? 'PEN',
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

  async function loadBranches(options?: { silent?: boolean }) {
    if (!accessToken) return
    if (options?.silent) {
      setIsBranchesRefreshing(true)
    } else {
      setIsBranchesLoading(true)
    }
    setBranchesError(null)
    try {
      const items = await branchesService.list(accessToken)
      setBranches(items)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await handleUnauthorized()
        return
      }
      setBranchesError(getApiErrorMessage(err))
    } finally {
      setIsBranchesLoading(false)
      setIsBranchesRefreshing(false)
    }
  }

  useEffect(() => {
    void loadInitialInventoryLoads()
    void loadCompanyProfile()
    void loadBranches()
  }, [accessToken])

  function openCreateBranchPanel() {
    setSelectedBranch(null)
    branchForm.reset({
      nombre: '',
      codigo: '',
      direccion: null,
      telefono: null,
      email: null,
      activo: true,
    })
    setIsBranchPanelOpen(true)
  }

  function openEditBranchPanel(branch: Branch) {
    setSelectedBranch(branch)
    branchForm.reset({
      nombre: branch.nombre,
      codigo: branch.codigo,
      direccion: branch.direccion ?? null,
      telefono: branch.telefono ?? null,
      email: branch.email ?? null,
      activo: branch.activo,
    })
    setIsBranchPanelOpen(true)
  }

  async function handleBranchSubmit(values: any) {
    const typedValues = values as BranchFormValues
    if (!accessToken) return
    setIsBranchPanelSubmitting(true)
    try {
      if (selectedBranch) {
        const payload = {
          nombre: typedValues.nombre,
          direccion: (typedValues.direccion ?? null) as string | null,
          telefono: (typedValues.telefono ?? null) as string | null,
          email: typedValues.email ?? null,
          activo: typedValues.activo ?? true,
        }
        const updated = await branchesService.update(accessToken, selectedBranch.id, payload)
        toast.success(`Sucursal "${updated.nombre}" actualizada.`)
      } else {
        const payload = {
          nombre: typedValues.nombre,
          codigo: typedValues.codigo,
          direccion: (typedValues.direccion ?? null) as string | null,
          telefono: (typedValues.telefono ?? null) as string | null,
          email: typedValues.email ?? null,
          activo: typedValues.activo ?? true,
        }
        const created = await branchesService.create(accessToken, payload)
        toast.success(`Sucursal "${created.nombre}" creada correctamente.`)
      }
      setIsBranchPanelOpen(false)
      setSelectedBranch(null)
      await loadBranches({ silent: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await handleUnauthorized()
        return
      }
      toast.error(getApiErrorMessage(err))
    } finally {
      setIsBranchPanelSubmitting(false)
    }
  }

  async function handleToggleBranchStatus(branch: Branch) {
    if (!accessToken) return
    try {
      const updated = await branchesService.toggleStatus(accessToken, branch.id)
      toast.success(
        updated.activo
          ? `Sucursal "${updated.nombre}" activada.`
          : `Sucursal "${updated.nombre}" desactivada.`,
      )
      await loadBranches({ silent: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await handleUnauthorized()
        return
      }
      toast.error(getApiErrorMessage(err))
    }
  }

  const totals = useMemo(() => {
    const values = initialInventoryForm.getValues()
    const products = new Set(values.items.map((item) => item.productoId).filter(Boolean))
    return {
      rows: values.items.length,
      products: products.size,
      lots: values.items.length,
    }
  }, [initialInventoryForm])

  const isImplementationMode = company?.operationMode === 'IMPLEMENTACION'

  async function handlePurgeTestData() {
    if (!accessToken) return
    setIsPurging(true)
    try {
      const response = await implementationService.purgeTestData(accessToken, {
        confirmText: purgeConfirmText,
      })
      toast.success(`Datos de prueba eliminados: ${Object.values(response.deleted).reduce((sum, value) => sum + value, 0)} registros.`)
      setPurgeDialogOpen(false)
      setPurgeConfirmText('')
      await loadInitialInventoryLoads()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await handleUnauthorized()
        return
      }
      toast.error(getApiErrorMessage(err))
    } finally {
      setIsPurging(false)
    }
  }

  async function handleSetProductionMode() {
    if (!accessToken) return
    setIsSettingProduction(true)
    try {
      const response = await companyService.setOperationModeProduction(accessToken)
      setCompany(response.company)
      toast.success('La empresa fue marcada como PRODUCCIÓN.')
      setProductionDialogOpen(false)
      setProductionConfirmText('')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await handleUnauthorized()
        return
      }
      toast.error(getApiErrorMessage(err))
    } finally {
      setIsSettingProduction(false)
    }
  }

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

  function escapeCsv(value: string) {
    const normalized = value ?? ''
    if (/[",\n\r]/.test(normalized)) {
      return `"${normalized.replace(/"/g, '""')}"`
    }
    return normalized
  }

  async function buildInitialInventoryCsvTemplate() {
    const headers = [
      'sku',
      'producto',
      'presentacion',
      'factorABase',
      'cantidad',
      'numeroLote',
      'fechaVencimiento',
      'costoAdquisicion',
    ]

    const lines: string[] = [headers.join(',')]
    const skipped: Array<{ sku: string; name: string }> = []

    let page = 1
    let totalPages = 1

    while (page <= totalPages) {
      const response = await productsService.list(accessToken, {
        search: '',
        status: 'ACTIVO',
        page,
        pageSize: 200,
        sortBy: 'name',
        sortDir: 'asc',
      })

      totalPages = response.pagination.totalPages

      for (const product of response.items) {
        const presentations = product.packaging.presentations.filter(
          (entry) => entry.factorToBase && entry.factorToBase > 0,
        )

        if (!presentations.length) {
          skipped.push({ sku: product.sku, name: product.name })
          continue
        }

        for (const presentation of presentations) {
          lines.push(
            [
              escapeCsv(product.sku),
              escapeCsv(product.name),
              escapeCsv(presentation.name),
              String(presentation.factorToBase),
              '',
              '',
              '',
              '',
            ].join(','),
          )
        }
      }

      page += 1
    }

    return {
      content: `${lines.join('\n')}\n`,
      skipped,
    }
  }

  async function downloadCsvTemplate() {
    if (!accessToken) return
    setIsDownloadingInitialInventoryTemplate(true)
    try {
      const { content, skipped } = await buildInitialInventoryCsvTemplate()
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'rayego-carga-inicial-inventario.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      if (skipped.length) {
        toast.warning(
          `Se omitieron ${skipped.length} productos sin equivalencias válidas. Configura presentaciones/conversiones en Productos para incluirlos.`,
        )
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setIsDownloadingInitialInventoryTemplate(false)
    }
  }

  function parseCsv(content: string) {
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    if (!lines.length) {
      throw new Error(
        formatImplementationMessage(
          'INVALID_FILE',
          'El archivo CSV está vacío.',
        ),
      )
    }

    const delimiter = lines[0]?.includes(';') ? ';' : ','
    const headers = lines[0].split(delimiter).map((header) => header.trim())
    const expectedHeadersNew = [
      'sku',
      'producto',
      'presentacion',
      'factorabase',
      'cantidad',
      'numerolote',
      'fechavencimiento',
      'costoadquisicion',
    ]

    const expectedHeadersOld = [
      'sku',
      'numerolote',
      'fechavencimiento',
      'costounitario',
      'cantidad',
    ]

    const normalizedHeaders = headers.map((header) => header.toLowerCase())
    const hasNewFormat = expectedHeadersNew.every((header) => normalizedHeaders.includes(header))
    const hasOldFormat = expectedHeadersOld.every((header) => normalizedHeaders.includes(header))

    if (!hasNewFormat && !hasOldFormat) {
      const missingNew = expectedHeadersNew.filter((header) => !normalizedHeaders.includes(header))
      const missingOld = expectedHeadersOld.filter((header) => !normalizedHeaders.includes(header))
      throw new Error(
        formatImplementationMessage(
          'INVALID_FILE',
          `Faltan columnas en el CSV. Nuevo formato: ${missingNew.join(', ')}. Formato anterior: ${missingOld.join(', ')}.`,
        ),
      )
    }

    const headerIndex = Object.fromEntries(
      normalizedHeaders.map((header, index) => [header, index]),
    ) as Record<string, number>

    return lines.slice(1).map((line, rowIndex) => {
      const columns = line.split(delimiter).map((col) => col.trim())
      const get = (key: string) => columns[headerIndex[key]] ?? ''
      if (hasNewFormat) {
        return {
          row: rowIndex + 2,
          format: 'new' as const,
          sku: get('sku'),
          producto: get('producto'),
          presentacion: get('presentacion'),
          factorABase: get('factorabase'),
          cantidad: get('cantidad'),
          numeroLote: get('numerolote'),
          fechaVencimiento: get('fechavencimiento'),
          costoAdquisicion: get('costoadquisicion'),
        }
      }

      return {
        row: rowIndex + 2,
        format: 'old' as const,
        sku: get('sku'),
        cantidad: get('cantidad'),
        numeroLote: get('numerolote'),
        fechaVencimiento: get('fechavencimiento'),
        costoAdquisicion: get('costounitario'),
      }
    })
  }

  async function resolveProductBySku(sku: string, skuCache: Map<string, ProductCatalogItem>) {
    const normalizedSku = sku.trim()
    if (!normalizedSku) {
      throw new Error('SKU vacío.')
    }

    const cached = skuCache.get(normalizedSku.toLowerCase())
    if (cached) {
      return cached
    }

    const response = await productsService.list(accessToken, {
      search: normalizedSku,
      page: 1,
      pageSize: 30,
      sortBy: 'name',
      sortDir: 'asc',
    })
    const product =
      response.items.find((item) => item.sku.toLowerCase() === normalizedSku.toLowerCase()) ?? null

    if (!product) {
      throw new Error(IMPLEMENTATION_MESSAGES.SKU_NOT_FOUND)
    }

    if (product.status !== 'ACTIVO') {
      throw new Error(IMPLEMENTATION_MESSAGES.PRODUCT_INACTIVE)
    }

    skuCache.set(normalizedSku.toLowerCase(), product)
    setProductCache((prev) => ({ ...prev, [product.id]: product }))
    return product
  }

  async function handleCsvImport(file: File) {
    if (!accessToken) return
    setIsImporting(true)

    try {
      const text = await file.text()
      const rows = parseCsv(text)
      const skuCache = new Map<string, ProductCatalogItem>()

      const items: InitialInventoryFormValues['items'] = []

      for (const row of rows) {
        let product: ProductCatalogItem
        try {
          product = await resolveProductBySku(row.sku, skuCache)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Producto no encontrado.'
          throw new Error(`Fila ${row.row}: ${message}`)
        }

        let presentationId = product.packaging.purchasePresentationId ?? product.packaging.basePresentationId ?? ''

        if (row.format === 'new') {
          const expectedName = product.name.trim().toLowerCase()
          const providedName = row.producto.trim().toLowerCase()
          if (expectedName !== providedName) {
            throw new Error(`Fila ${row.row}: El nombre del producto no coincide con el catálogo.`)
          }

          const presentationName = row.presentacion.trim()
          if (!presentationName) {
            throw new Error(`Fila ${row.row}: La presentación es obligatoria.`)
          }

          const presentation =
            product.packaging.presentations.find(
              (entry) => entry.name.trim().toLowerCase() === presentationName.toLowerCase(),
            ) ?? null

          if (!presentation) {
            throw new Error(`Fila ${row.row}: La presentación no pertenece al producto.`)
          }

          if (!presentation.factorToBase || presentation.factorToBase <= 0) {
            throw new Error(`Fila ${row.row}: La presentación no tiene un factor válido.`)
          }

          const providedFactor = Number(row.factorABase)
          if (
            !Number.isFinite(providedFactor) ||
            Math.floor(providedFactor) !== Math.floor(presentation.factorToBase)
          ) {
            throw new Error(`Fila ${row.row}: El factor a base no coincide con el maestro del producto.`)
          }

          presentationId = presentation.id
        }

        if (!presentationId) {
          throw new Error(`Fila ${row.row}: No se pudo resolver una presentación válida para el producto.`)
        }
        const quantity = Number(row.cantidad)
        const unitCost = Number(row.costoAdquisicion)
        if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
          throw new Error(`Fila ${row.row}: La cantidad debe ser un entero mayor a 0.`)
        }
        if (!Number.isFinite(unitCost) || unitCost < 0) {
          throw new Error(`Fila ${row.row}: El costo unitario debe ser mayor o igual a 0.`)
        }

        items.push({
          productoId: product.id,
          presentacionId: presentationId,
          numeroLote: row.numeroLote,
          fechaVencimiento: row.fechaVencimiento,
          costoUnitario: unitCost,
          cantidad: quantity,
        })
      }

      initialInventoryForm.reset({ items })
      toast.success(`Se importaron ${items.length} filas. Revisa y registra la carga.`)
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'No se pudo importar el archivo.'
      toast.error(`${IMPLEMENTATION_MESSAGES.INVALID_FILE}\n\n${detail}`)
    } finally {
      setIsImporting(false)
      if (csvInputRef.current) {
        csvInputRef.current.value = ''
      }
    }
  }

  function buildProductCatalogTemplate() {
    return [
      [
        'sku',
        'codigoBarras',
        'nombre',
        'categoria',
        'laboratorio',
        'tipoComercial',
        'principioActivo',
        'presentacion',
        'unidadNombre',
        'unidadSimbolo',
        'precioVenta',
        'costoReferencia',
        'requiereReceta',
        'esControlado',
        'descripcion',
        'concentracion',
        'registroSanitario',
        'observaciones',
      ],
      [
        'EJEMPLO-AMOX-500MG',
        '7750001234567',
        'Amoxicilina 500 mg [EJEMPLO - NO IMPORTAR]',
        'ANTIBIÓTICOS',
        'LABORATORIO FARMA S.A.',
        'Genérico',
        'Amoxicilina',
        'Cápsulas',
        'Cápsula',
        'cap',
        '2.50',
        '0.90',
        'SI',
        'NO',
        'Antibiótico betalactámico de amplio espectro. Unidad base = 1 Cápsula. 1 Blíster = 12 cápsulas · 1 Caja = 10 Blísteres · 1 Caja = 120 cápsulas (equivalencias / cadena de empaque se configuran luego en el módulo Productos).',
        '500 mg',
        'RS-PER-2026-0012345',
        'EJEMPLO - NO IMPORTAR. Esta fila se excluye automáticamente al importar. Eliminar o editar para usar como plantilla real.',
      ],
    ]
  }

  function buildProductCatalogInstructions() {
    return [
      ['HOJA DE INSTRUCCIONES — Importación Masiva de Productos (Catálogo Maestro)'],
      [],
      ['⚠️ ANTES DE EMPEZAR'],
      ['1. La hoja "Productos" contiene la plantilla a llenar. La Fila 2 es un EJEMPLO — nunca se importa.'],
      ['2. Las presentaciones y equivalencias (blíster/caja/fraco) NO se importan en esta plantilla.'],
      ['   Se configuran manualmente en el módulo Productos después de crear el catálogo.'],
      ['3. Esta importación crea SOLAMENTE el catálogo maestro. No crea stock ni lotes.'],
      ['   Para cargar stock inicial usar el CSV "Carga inicial de inventario".'],
      ['4. Los maestros Tipos Comerciales y Principios Activos NO se crean automáticamente.'],
      ['   Deben existir primero en: Configuración → Centro de Maestros → Productos.'],
      [],
      ['📋 COLUMNAS Y DESCRIPCIÓN'],
      ['COLUMNA', 'REQUI?', 'FORMATO', 'DESCRIPCIÓN Y EJEMPLO'],
      ['sku', '✅ SI', 'texto ÚNICO uppercase', 'Código interno del producto. No se puede repetir. Ej: AMOX-500-CAP'],
      ['codigoBarras', '— opcional', 'texto numérico', 'Código EAN-13 / GTIN si lo tiene. Dejar vacío si no.'],
      ['nombre', '✅ SI', 'texto', 'Nombre del producto como aparecerá en la venta. Ej: Amoxicilina 500 mg'],
      ['categoria', '✅ SI', 'texto', 'Nombre de la categoría. Se crea automáticamente si no existe. Ej: ANTIBIÓTICOS'],
      ['laboratorio', '— opcional', 'texto', 'Nombre del laboratorio. Se crea automáticamente si no existe.'],
      ['tipoComercial', '✅ SI', 'texto (exacto)', 'Nombre exacto registrado en maestro Tipos Comerciales. Ej: Genérico / Marca / Similar'],
      ['principioActivo', '✅ SI', 'texto (exacto)', 'Nombre exacto registrado en maestro Principios Activos. Ej: Amoxicilina'],
      ['presentacion', '✅ SI', 'texto', 'Cómo se presenta (forma farmacéutica). Se crea auto. Ej: Cápsulas / Tabletas / Jarabe'],
      ['unidadNombre', '✅ SI', 'texto', 'Unidad base de conteo. Se crea auto. Ej: Cápsula / Tableta / Mililitro / Unidad'],
      ['unidadSimbolo', '✅ SI', 'texto corto', 'Símbolo / abreviatura de la unidad. Ej: cap / tab / ml / und'],
      ['precioVenta', '✅ SI', 'número decimal', 'Precio al público en soles (S/). Usa punto decimal. Ej: 2.50'],
      ['costoReferencia', '✅ SI', 'número decimal', 'Costo de referencia (costo compra estimado). S/ con punto decimal. Ej: 0.90'],
      ['requiereReceta', '✅ SI', 'SI / NO', '¿Requiere receta médica para vender? Valores válidos: SI / NO / 1 / 0 / VERDADERO / FALSO'],
      ['esControlado', '✅ SI', 'SI / NO', '¿Producto de control especial (CIS, antibiótico controlado)? Valores válidos = mismas reglas que requiereReceta.'],
      ['descripcion', '— opcional', 'texto', 'Texto libre que aparece en la ficha del producto.'],
      ['concentracion', '— opcional', 'texto', 'Concentración del principio activo. Ej: 500 mg / 250 mg / 120 ml'],
      ['registroSanitario', '— opcional', 'texto', 'Número de registro sanitario de DIGEMID/MINSA si corresponde.'],
      ['observaciones', '— opcional', 'texto', 'Notas internas sobre el producto.'],
      [],
      ['🧪 EJEMPLO CONCEPTUAL DE PRESENTACIONES / EQUIVALENCIAS (para configurar a mano luego)'],
      ['Producto: Amoxicilina 500 mg · Unidad base = Cápsula'],
      ['1 Blíster = 12 Cápsulas'],
      ['1 Caja = 10 Blísteres'],
      ['Resultado final: 1 Caja = 120 Cápsulas (unidades base).'],
      [],
      ['💡 REGLAS DE VALIDACIÓN'],
      ['• El SKU no puede repetirse dentro del archivo ni con un producto ya existente en el sistema.'],
      ['• Precios y costos aceptan mínimo 0.00. No aceptan moneda ni texto.'],
      ['• Unidad: si ingresas nombre + símbolo nuevos, el sistema los crea en el maestro.'],
      ['• Presentación: nombre es formato de presentación (Cápsulas, Tabletas, Jarabe, etc.).'],
      ['• Equivalencias (Blíster ↔ Caja ↔ Unidad) NO están en esta plantilla: configúralas luego en Editar Producto.'],
      ['• Campos marcados como "opcionales" se pueden dejar vacíos.'],
      ['• Si una fila tiene el texto "EJEMPLO - NO IMPORTAR" en observaciones, nombre o sku se OMITIRÁ siempre.'],
    ]
  }

  function downloadProductCatalogTemplate() {
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet(buildProductCatalogTemplate())
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos')
    const instructionsSheet = XLSX.utils.aoa_to_sheet(buildProductCatalogInstructions())
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'INSTRUCCIONES')
    const content = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    })
    const blob = new Blob([content], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'rayego-importar-catalogo-productos-template.xlsx'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  function normalizeBoolean(value: string) {
    const normalized = value.trim().toUpperCase()
    const withoutAccent = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (!withoutAccent) return false
    if (['1', 'SI', 'S', 'TRUE', 'VERDADERO', 'YES'].includes(withoutAccent)) return true
    return false
  }

  function normalizeMasterKey(value: string) {
    return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  }

  function isExampleNoImportRow(entry: {
    sku: string
    nombre: string
    observaciones: string
  }) {
    const marker = 'EJEMPLO - NO IMPORTAR'
    const check = (v: string) =>
      v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().includes(marker)
    return check(entry.sku) || check(entry.nombre) || check(entry.observaciones)
  }

  function normalizeCell(value: unknown) {
    if (value === null || value === undefined) return ''
    return String(value).trim()
  }

  function ensureProductCatalogHeaders(headers: string[]) {
    const expectedHeaders = [
      'sku',
      'codigobarras',
      'nombre',
      'categoria',
      'laboratorio',
      'principioactivo',
      'presentacion',
      'unidadnombre',
      'unidadsimbolo',
      'precioventa',
      'costoreferencia',
      'requierereceta',
      'escontrolado',
      'descripcion',
      'concentracion',
      'registrosanitario',
      'observaciones',
    ]

    const hasCommercialTypeHeader =
      headers.includes('tipocomercial') || headers.includes('tipomedicamento')
    const missing = expectedHeaders.filter((header) => !headers.includes(header))
    if (!hasCommercialTypeHeader) {
      missing.push('tipocomercial')
    }
    if (missing.length) {
      throw new Error(`Faltan columnas en el archivo: ${missing.join(', ')}`)
    }
  }

  function parseProductCatalogSpreadsheet(buffer: ArrayBuffer) {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      throw new Error('El archivo Excel no contiene hojas.')
    }

    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
    if (!rows.length) {
      throw new Error('El archivo Excel está vacío.')
    }

    const normalizedHeaders = rows[0]?.map((cell) => normalizeMasterKey(normalizeCell(cell))) ?? []
    ensureProductCatalogHeaders(normalizedHeaders)

    const headerIndex = Object.fromEntries(
      normalizedHeaders.map((header, index) => [header, index]),
    ) as Record<string, number>

    return rows
      .slice(1)
      .map((cols, rowIndex) => {
        const get = (key: string) => normalizeCell(cols[headerIndex[key]])
        return {
          row: rowIndex + 2,
          sku: get('sku'),
          codigoBarras: get('codigobarras'),
          nombre: get('nombre'),
          categoria: get('categoria'),
          laboratorio: get('laboratorio'),
          tipoMedicamento: get('tipocomercial') || get('tipomedicamento'),
          principioActivo: get('principioactivo'),
          presentacion: get('presentacion'),
          unidadNombre: get('unidadnombre'),
          unidadSimbolo: get('unidadsimbolo'),
          precioVenta: get('precioventa'),
          costoReferencia: get('costoreferencia'),
          requiereReceta: get('requierereceta'),
          esControlado: get('escontrolado'),
          descripcion: get('descripcion'),
          concentracion: get('concentracion'),
          registroSanitario: get('registrosanitario'),
          observaciones: get('observaciones'),
        }
      })
      .filter((entry) =>
        Object.entries(entry).some(([key, value]) => key !== 'row' && String(value).trim() !== ''),
      )
  }

  async function parseProductCatalogFile(file: File) {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (extension === 'xlsx') {
      return parseProductCatalogSpreadsheet(await file.arrayBuffer())
    }

    if (file.type.includes('spreadsheet') || file.type.includes('excel') || file.type === '') {
      return parseProductCatalogSpreadsheet(await file.arrayBuffer())
    }

    throw new Error('Formato de archivo no soportado. Usa únicamente archivos Excel (.xlsx).')
  }

  async function handleProductCatalogImport(file: File) {
    if (!accessToken) return
    setIsCatalogImporting(true)
    setCatalogImportSummary(null)

    try {
      const [
        categoriesResponse,
        laboratoriesResponse,
        commercialTypesResponse,
        activePrinciplesResponse,
        presentationsResponse,
        unitsResponse,
      ] =
        await Promise.all([
          productsService.listMasterCategories(accessToken),
          productsService.listMasterLaboratories(accessToken),
          productsService.listMasterCommercialTypes(accessToken),
          productsService.listMasterActivePrinciples(accessToken),
          productsService.listMasterPresentations(accessToken),
          productsService.listMasterUnits(accessToken),
        ])

      const categoriesByName = new Map(
        categoriesResponse.rows.map((row) => [normalizeMasterKey(row.nombre), row]),
      )
      const labsByName = new Map(
        laboratoriesResponse.rows.map((row) => [normalizeMasterKey(row.nombre), row]),
      )
      const medicationTypesByName = new Map(
        commercialTypesResponse.rows.map((row) => [normalizeMasterKey(row.nombre), row]),
      )
      const activePrinciplesByName = new Map(
        activePrinciplesResponse.rows.map((row) => [normalizeMasterKey(row.nombre), row]),
      )
      const presentationsByName = new Map(
        presentationsResponse.rows.map((row) => [normalizeMasterKey(row.nombre), row]),
      )
      const unitsByName = new Map(
        unitsResponse.rows.map((row) => [normalizeMasterKey(row.nombre), row]),
      )

      const rows = await parseProductCatalogFile(file)

      let created = 0
      let skipped = 0
      let errors = 0
      const errorDetails: string[] = []
      const skuInFile = new Set<string>()

      const pushError = (row: number, message: string) => {
        errors += 1
        if (errorDetails.length < 20) {
          errorDetails.push(`Fila ${row}: ${message}`)
        }
      }

      for (const row of rows) {
        try {
          if (isExampleNoImportRow(row)) {
            skipped += 1
            continue
          }

          const rawSku = row.sku.trim()
          if (!rawSku) {
            skipped += 1
            continue
          }

          const sku = rawSku.toUpperCase()
          if (skuInFile.has(sku)) {
            pushError(
              row.row,
              formatImplementationMessage(
                'INVALID_FILE',
                'El SKU está duplicado en el archivo.',
              ),
            )
            continue
          }
          skuInFile.add(sku)

          const productName = row.nombre.trim()
          if (!productName) {
            pushError(
              row.row,
              formatImplementationMessage(
                'INVALID_REQUIRED_FIELD',
                'Campo: Nombre',
              ),
            )
            continue
          }

          const categoryName = row.categoria.trim()
          if (!categoryName) {
            pushError(
              row.row,
              formatImplementationMessage(
                'INVALID_REQUIRED_FIELD',
                'Campo: Categoría',
              ),
            )
            continue
          }

          const categoryKey = normalizeMasterKey(categoryName)
          let category = categoriesByName.get(categoryKey) ?? null
          if (!category) {
            try {
              await productsService.createMasterCategory(accessToken, { nombre: categoryName })
            } catch (err) {
              if (!(err instanceof ApiError && err.status === 409)) {
                throw err
              }
            }

            const refreshed = await productsService.listMasterCategories(accessToken)
            refreshed.rows.forEach((entry) =>
              categoriesByName.set(normalizeMasterKey(entry.nombre), entry),
            )
            category = categoriesByName.get(categoryKey) ?? null
          }

          if (!category) {
            pushError(row.row, IMPLEMENTATION_MESSAGES.CATEGORY_NOT_FOUND)
            continue
          }

          const unitName = row.unidadNombre.trim()
          const unitSymbol = row.unidadSimbolo.trim()
          if (!unitName || !unitSymbol) {
            pushError(
              row.row,
              formatImplementationMessage(
                'INVALID_REQUIRED_FIELD',
                'Campos: Unidad de medida (Nombre y símbolo)',
              ),
            )
            continue
          }

          let unit = unitsByName.get(normalizeMasterKey(unitName)) ?? null
          if (!unit) {
            try {
              const result = await productsService.createMasterUnit(accessToken, {
                nombre: unitName,
                simbolo: unitSymbol,
              })
              const refreshed = await productsService.listMasterUnits(accessToken)
              refreshed.rows.forEach((entry) => {
                unitsByName.set(normalizeMasterKey(entry.nombre), entry)
              })
              unit =
                refreshed.rows.find((entry) => entry.id === result.id) ??
                unitsByName.get(normalizeMasterKey(unitName)) ??
                null
            } catch (err) {
              if (err instanceof ApiError && err.status === 409) {
                const refreshed = await productsService.listMasterUnits(accessToken)
                refreshed.rows.forEach((entry) => {
                  unitsByName.set(normalizeMasterKey(entry.nombre), entry)
                })
                unit = unitsByName.get(normalizeMasterKey(unitName)) ?? null
              } else {
                throw err
              }
            }
          }

          if (!unit) {
            pushError(row.row, IMPLEMENTATION_MESSAGES.UNIT_NOT_FOUND)
            continue
          }

          const laboratoryName = row.laboratorio.trim()
          let labId: string | undefined
          if (laboratoryName) {
            const labKey = normalizeMasterKey(laboratoryName)
            let lab = labsByName.get(labKey) ?? null
            if (!lab) {
              try {
                const result = await productsService.createMasterLaboratory(accessToken, {
                  nombre: laboratoryName,
                })
                const refreshed = await productsService.listMasterLaboratories(accessToken)
                refreshed.rows.forEach((entry) =>
                  labsByName.set(normalizeMasterKey(entry.nombre), entry),
                )
                lab = refreshed.rows.find((entry) => entry.id === result.id) ?? null
              } catch (err) {
                if (err instanceof ApiError && err.status === 409) {
                  const refreshed = await productsService.listMasterLaboratories(accessToken)
                  refreshed.rows.forEach((entry) =>
                    labsByName.set(normalizeMasterKey(entry.nombre), entry),
                  )
                  lab = labsByName.get(labKey) ?? null
                } else {
                  throw err
                }
              }
            }

            if (!lab) {
              pushError(row.row, IMPLEMENTATION_MESSAGES.LABORATORY_NOT_FOUND)
              continue
            }

            labId = lab.id
          }

          const medicationTypeName = row.tipoMedicamento.trim()
          if (!medicationTypeName) {
            pushError(
              row.row,
              formatImplementationMessage(
                'INVALID_REQUIRED_FIELD',
                'Campo: Tipo comercial',
              ),
            )
            continue
          }

          const medicationTypeKey = normalizeMasterKey(medicationTypeName)
          let medicationType = medicationTypesByName.get(medicationTypeKey) ?? null
          if (!medicationType) {
            pushError(
              row.row,
              `Tipo comercial inválido: "${medicationTypeName}". Verifica el valor en el maestro.`,
            )
            continue
          }

          const activePrincipleName = row.principioActivo.trim()
          if (!activePrincipleName) {
            pushError(
              row.row,
              formatImplementationMessage(
                'INVALID_REQUIRED_FIELD',
                'Campo: Principio activo',
              ),
            )
            continue
          }

          const activePrincipleKey = normalizeMasterKey(activePrincipleName)
          const activePrinciple = activePrinciplesByName.get(activePrincipleKey) ?? null
          if (!activePrinciple) {
            pushError(
              row.row,
              `Principio activo inválido: "${activePrincipleName}". Verifica el valor en el maestro.`,
            )
            continue
          }

          const presentationName = row.presentacion.trim()
          if (!presentationName) {
            pushError(row.row, 'La presentación es obligatoria para configurar el empaque del producto.')
            continue
          }

          const presentationKey = normalizeMasterKey(presentationName)
          let presentation = presentationsByName.get(presentationKey) ?? null
          if (!presentation) {
            try {
              const result = await productsService.createMasterPresentation(accessToken, {
                nombre: presentationName,
              })
              const refreshed = await productsService.listMasterPresentations(accessToken)
              refreshed.rows.forEach((entry) =>
                presentationsByName.set(normalizeMasterKey(entry.nombre), entry),
              )
              presentation =
                refreshed.rows.find((entry) => entry.id === result.id) ??
                presentationsByName.get(presentationKey) ??
                null
            } catch (err) {
              if (err instanceof ApiError && err.status === 409) {
                const refreshed = await productsService.listMasterPresentations(accessToken)
                refreshed.rows.forEach((entry) =>
                  presentationsByName.set(normalizeMasterKey(entry.nombre), entry),
                )
                presentation = presentationsByName.get(presentationKey) ?? null
              } else {
                throw err
              }
            }
          }

          if (!presentation) {
            pushError(row.row, IMPLEMENTATION_MESSAGES.PRESENTATION_NOT_FOUND)
            continue
          }

          const presentationId = presentation.id

          const price = Number(row.precioVenta)
          if (!Number.isFinite(price) || price < 0) {
            pushError(row.row, IMPLEMENTATION_MESSAGES.INVALID_PRICE)
            continue
          }

          const refCost = Number(row.costoReferencia)
          if (!Number.isFinite(refCost) || refCost < 0) {
            pushError(row.row, IMPLEMENTATION_MESSAGES.INVALID_COST)
            continue
          }

          const payload: CreateProductPayload = {
            categoriaId: category.id,
            laboratorioId: labId,
            tipoComercialId: medicationType.id,
            principioActivoId: activePrinciple.id,
            presentacionId: presentationId,
            unidadMedidaId: unit.id,
            compraPresentacionId: presentationId,
            basePresentacionId: presentationId,
            presentacionesEmpaque: [
              {
                presentacionId: presentationId,
                permiteCompra: true,
                permiteVenta: true,
                precioVenta: price,
              },
            ],
            conversionesEmpaque: [],
            sku,
            ...(row.codigoBarras?.trim() ? { codigoBarras: row.codigoBarras.trim() } : {}),
            nombre: productName,
            ...(row.descripcion?.trim() ? { descripcion: row.descripcion.trim() } : {}),
            ...(row.concentracion?.trim() ? { concentracion: row.concentracion.trim() } : {}),
            ...(row.registroSanitario?.trim()
              ? { registroSanitario: row.registroSanitario.trim() }
              : {}),
            requiereReceta: normalizeBoolean(row.requiereReceta),
            esControlado: normalizeBoolean(row.esControlado),
            costoReferencia: refCost,
            ...(row.observaciones?.trim() ? { observaciones: row.observaciones.trim() } : {}),
          }

          await productsService.create(accessToken, payload)
          created += 1
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            throw err
          }

          if (err instanceof ApiError && err.status === 409) {
            pushError(row.row, IMPLEMENTATION_MESSAGES.SKU_ALREADY_EXISTS)
            continue
          }

          const message = err instanceof Error ? err.message : IMPLEMENTATION_MESSAGES.IMPORT_FAILED
          pushError(row.row, message)
        }
      }

      setCatalogImportSummary({ created, skipped, errors, errorDetails })
      const summaryText = `${created} creados · ${errors} con error · ${skipped} omitidos`
      if (errors === 0) {
        toast.success(`${IMPLEMENTATION_MESSAGES.IMPORT_SUCCESS}\n\n${summaryText}`)
      } else if (created > 0) {
        toast.success(`${IMPLEMENTATION_MESSAGES.IMPORT_PARTIAL_SUCCESS}\n\n${summaryText}`)
      } else {
        toast.error(`${IMPLEMENTATION_MESSAGES.IMPORT_FAILED}\n\n${summaryText}`)
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await handleUnauthorized()
        return
      }
      const detail = err instanceof Error ? err.message : 'No se pudo importar el catálogo.'
      if (detail.startsWith(IMPLEMENTATION_MESSAGES.INVALID_FILE)) {
        toast.error(detail)
      } else {
        toast.error(formatImplementationMessage('INVALID_FILE', detail))
      }
    } finally {
      setIsCatalogImporting(false)
      if (catalogCsvInputRef.current) {
        catalogCsvInputRef.current.value = ''
      }
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

  async function handleUploadCompanyLogo(file: File) {
    if (!accessToken) return

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'] as const
    if (!allowedTypes.includes(file.type as (typeof allowedTypes)[number])) {
      toast.error('Formato de imagen no permitido. Use PNG, JPG, JPEG o WEBP.')
      return
    }

    const maxBytes = 2 * 1024 * 1024
    if (file.size > maxBytes) {
      toast.error('El archivo excede el tamaño máximo permitido (2 MB).')
      return
    }

    setIsCompanyLogoUploading(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result)
            return
          }
          reject(new Error('No se pudo leer el archivo.'))
        }
        reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
        reader.readAsDataURL(file)
      })

      const response = await companyService.uploadLogo(accessToken, {
        fileName: file.name,
        mimeType: file.type,
        base64,
      })

      setCompany(response.company)
      companyForm.reset(mapCompanyToFormValues(response.company))
      toast.success('Logo actualizado correctamente.')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await handleUnauthorized()
        return
      }
      toast.error(getApiErrorMessage(err))
    } finally {
      setIsCompanyLogoUploading(false)
    }
  }

  async function handleDeleteCompanyLogo() {
    if (!accessToken) return
    const currentLogoUrl = companyForm.getValues('logoUrl')
    if (!currentLogoUrl) return

    setIsCompanyLogoUploading(true)
    try {
      const response = await companyService.deleteLogo(accessToken)
      setCompany(response.company)
      companyForm.reset(mapCompanyToFormValues(response.company))
      toast.success('Logo eliminado correctamente.')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await handleUnauthorized()
        return
      }
      toast.error(getApiErrorMessage(err))
    } finally {
      setIsCompanyLogoUploading(false)
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
          <TabsTrigger value="sucursales">Sucursales</TabsTrigger>
          <TabsTrigger value="comprobantes" disabled>
            Comprobantes
          </TabsTrigger>
          <TabsTrigger value="implementacion">Implementación</TabsTrigger>
          <TabsTrigger value="herramientas" disabled={!company || !isImplementationMode}>
            Herramientas del sistema
          </TabsTrigger>
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
                    disabled={!companyForm.formState.isDirty || isCompanySubmitting || !canEditCompany}
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
                    disabled={!companyForm.formState.isDirty || isCompanySubmitting || !canEditCompany}
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
                  {!canEditCompany ? (
                    <div className="rounded-xl border border-muted bg-muted/30 p-3 text-xs text-muted-foreground md:col-span-2">
                      Solo un usuario administrador puede editar la información y el logo de la empresa.
                    </div>
                  ) : null}
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
                        <input
                          ref={companyLogoInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          className="sr-only"
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            event.target.value = ''
                            if (!file) return
                            void handleUploadCompanyLogo(file)
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isCompanyLogoUploading || isCompanySubmitting || !canEditCompany}
                          onClick={() => companyLogoInputRef.current?.click()}
                        >
                          {isCompanyLogoUploading ? <Loader className="h-4 w-4" /> : null}
                          Subir logo
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={!companyLogoUrl || isCompanyLogoUploading || isCompanySubmitting || !canEditCompany}
                          onClick={() => void handleDeleteCompanyLogo()}
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
                            {supportedCurrencies.map((currency) => (
                              <SelectItem key={currency.code} value={currency.code}>
                                {currency.code} · {currency.label}
                              </SelectItem>
                            ))}
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
                      min={0}
                      max={100}
                      {...companyForm.register('igvPorDefecto', { valueAsNumber: true })}
                    />
                    <FieldError message={companyForm.formState.errors.igvPorDefecto?.message} />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border p-4 md:col-span-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">Empresa activa</p>
                      <p className="text-xs text-muted-foreground">
                        Al desactivar la empresa, ningún usuario podrá iniciar sesión hasta que vuelva a activarse.
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
                    <p className="mt-1 text-xs text-muted-foreground">
                      Disponible cuando Rayego POS opere como SaaS.
                    </p>
                  </div>
                  <div className="rounded-xl border border-dashed p-4 md:col-span-2">
                    <p className="text-sm font-medium text-foreground">Estado de suscripción</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Disponible en futuras versiones SaaS.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Información del sistema</CardTitle>
                  <CardDescription>Datos informativos para soporte técnico.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border p-4">
                    <p className="text-xs font-medium text-muted-foreground">Empresa ID</p>
                    <p className="mt-1 break-all text-sm font-medium text-foreground">
                      {company?.id ?? '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border p-4">
                    <p className="text-xs font-medium text-muted-foreground">Versión instalada</p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {appSystemInfo.version}
                    </p>
                  </div>
                  <div className="rounded-xl border p-4 md:col-span-2">
                    <p className="text-xs font-medium text-muted-foreground">Arquitectura</p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {appSystemInfo.architecture}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </form>
          )}
        </TabsContent>

        <TabsContent value="sucursales" className="space-y-4 pt-4">
          <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-softSm sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Sucursales</p>
              <p className="text-xs text-muted-foreground">
                Administra las sucursales operativas de la empresa actual. Solo puedes ver y gestionar sucursales de la empresa de tu sesión.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadBranches({ silent: true })}
                disabled={isBranchesRefreshing || !accessToken}
              >
                <RefreshCcw
                  className={`mr-2 h-4 w-4 ${isBranchesRefreshing ? 'animate-spin' : ''}`}
                />
                Actualizar
              </Button>
              <Button type="button" onClick={openCreateBranchPanel} disabled={!accessToken}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva sucursal
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {branchesError ? (
                <div className="p-5 text-sm text-destructive">{branchesError}</div>
              ) : isBranchesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader className="h-6 w-6" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Dirección</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="w-[1%] whitespace-nowrap text-right">
                        Acciones
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branches.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-10 text-center text-sm text-muted-foreground"
                        >
                          No hay sucursales creadas. Crea la primera para habilitar los procesos
                          operativos.
                        </TableCell>
                      </TableRow>
                    ) : (
                      branches.map((branch) => (
                        <TableRow key={branch.id}>
                          <TableCell className="font-medium text-foreground">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-semibold">{branch.nombre}</p>
                                {branch.email ? (
                                  <p className="text-xs text-muted-foreground">{branch.email}</p>
                                ) : null}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{branch.codigo}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {branch.direccion ?? '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {branch.telefono ?? '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={branch.activo ? 'success' : 'outline'}>
                              {branch.activo ? 'Activa' : 'Inactiva'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openEditBranchPanel(branch)}
                              >
                                Editar
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button type="button" variant="outline" size="sm">
                                    <span className="sr-only">Más acciones</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                  <DropdownMenuItem
                                    onSelect={() => void handleToggleBranchStatus(branch)}
                                  >
                                    {branch.activo ? 'Desactivar' : 'Activar'}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
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

        <TabsContent value="herramientas" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle>Modo del sistema</CardTitle>
                <CardDescription>
                  Las herramientas de implementación solo están disponibles antes de iniciar la operación real.
                </CardDescription>
              </div>
              <Badge variant={isImplementationMode ? 'outline' : 'success'}>
                {company?.operationMode ?? 'IMPLEMENTACION'}
              </Badge>
            </CardHeader>
            <CardContent>
              {isImplementationMode ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Cuando confirmes PRODUCCIÓN, las herramientas de implementación quedarán deshabilitadas.
                  </p>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => setProductionDialogOpen(true)}
                    disabled={!company || isSettingProduction}
                  >
                    {isSettingProduction ? <Loader className="mr-2 h-4 w-4" /> : null}
                    Pasar a PRODUCCIÓN
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                  La empresa ya se encuentra en modo PRODUCCIÓN. Las herramientas de implementación están deshabilitadas.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle>Eliminar datos de prueba</CardTitle>
                <CardDescription>
                  Elimina información generada durante la implementación para iniciar la operación real.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="danger"
                onClick={() => setPurgeDialogOpen(true)}
                disabled={!isImplementationMode || isPurging}
              >
                {isPurging ? <Loader className="mr-2 h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Eliminar datos de prueba
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                Esta operación elimina datos de ventas, compras, movimientos de caja, inventario, lotes, productos,
                catálogos maestros, clientes y proveedores. No elimina empresa, usuarios, roles, permisos, configuración ni auditoría.
              </div>
            </CardContent>
          </Card>

          <Dialog
            open={purgeDialogOpen}
            onOpenChange={(open) => {
              setPurgeDialogOpen(open)
              if (!open) setPurgeConfirmText('')
            }}
          >
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Eliminar datos de prueba</DialogTitle>
                <DialogDescription className="whitespace-pre-line">
                  Esta operación es irreversible.
                  {'\n\n'}
                  Escribe ELIMINAR para habilitar la ejecución.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Confirmación</p>
                <Input value={purgeConfirmText} onChange={(event) => setPurgeConfirmText(event.target.value)} />
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setPurgeDialogOpen(false)} disabled={isPurging}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => void handlePurgeTestData()}
                  disabled={
                    isPurging ||
                    !isImplementationMode ||
                    purgeConfirmText.trim().toUpperCase() !== 'ELIMINAR'
                  }
                >
                  {isPurging ? <Loader className="mr-2 h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Eliminar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={productionDialogOpen}
            onOpenChange={(open) => {
              setProductionDialogOpen(open)
              if (!open) setProductionConfirmText('')
            }}
          >
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Pasar a PRODUCCIÓN</DialogTitle>
                <DialogDescription className="whitespace-pre-line">
                  Esta acción deshabilita las herramientas de implementación para evitar eliminaciones accidentales.
                  {'\n\n'}
                  Escribe PRODUCCION para confirmar.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Confirmación</p>
                <Input
                  value={productionConfirmText}
                  onChange={(event) => setProductionConfirmText(event.target.value)}
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setProductionDialogOpen(false)}
                  disabled={isSettingProduction}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => void handleSetProductionMode()}
                  disabled={
                    isSettingProduction ||
                    !isImplementationMode ||
                    productionConfirmText.trim().toUpperCase() !== 'PRODUCCION'
                  }
                >
                  {isSettingProduction ? <Loader className="mr-2 h-4 w-4" /> : null}
                  Confirmar PRODUCCIÓN
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="implementacion" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle>Importar Catálogo de Productos</CardTitle>
                <CardDescription>
                  Crea masivamente el maestro de productos y sus catálogos relacionados. No genera stock, lotes ni
                  movimientos de inventario.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => downloadProductCatalogTemplate()}>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar plantilla Excel
                </Button>
                <Button type="button" onClick={() => setIsCatalogDrawerOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Importar catálogo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border p-4">
                  <p className="text-xs font-medium text-muted-foreground">Stock</p>
                  <p className="mt-1 text-sm font-medium text-foreground">No se crea stock</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-xs font-medium text-muted-foreground">Lotes</p>
                  <p className="mt-1 text-sm font-medium text-foreground">No se crean lotes</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-xs font-medium text-muted-foreground">Inventario</p>
                  <p className="mt-1 text-sm font-medium text-foreground">Sin movimientos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <SidePanel open={isCatalogDrawerOpen} onOpenChange={setIsCatalogDrawerOpen}>
            <SidePanelContent>
              <div className="flex flex-col border-b bg-background/95 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Importar catálogo de productos</p>
                    <p className="text-xs text-muted-foreground">
                      Esta operación solo crea el catálogo. La carga inicial de inventario se realiza por separado.
                    </p>
                  </div>
                  <SidePanelClose asChild>
                    <Button type="button" variant="ghost" size="icon">
                      <X className="h-4 w-4" />
                    </Button>
                  </SidePanelClose>
                </div>
              </div>

              <div className="flex h-full flex-col">
                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Plantilla e importación</CardTitle>
                      <CardDescription>
                        La plantilla incluye configuración de empaque y crea categorías, laboratorios, tipos de
                        medicamento, presentaciones y unidades si no existen.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button type="button" variant="outline" onClick={() => downloadProductCatalogTemplate()}>
                          <Download className="mr-2 h-4 w-4" />
                          Descargar plantilla Excel
                        </Button>

                        <input
                          ref={catalogCsvInputRef}
                          type="file"
                          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            if (!file) return
                            void handleProductCatalogImport(file)
                          }}
                        />
                        <Button
                          type="button"
                          disabled={isCatalogImporting}
                          onClick={() => catalogCsvInputRef.current?.click()}
                        >
                          {isCatalogImporting ? <Loader className="mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />}
                          Importar Excel
                        </Button>
                      </div>

                      {catalogImportSummary ? (
                        <div className="rounded-xl border bg-muted/30 p-4">
                          <p className="text-sm font-medium text-foreground">Resumen</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {catalogImportSummary.created} creados · {catalogImportSummary.errors} con error ·{' '}
                            {catalogImportSummary.skipped} omitidos
                          </p>
                          {catalogImportSummary.errorDetails.length > 0 ? (
                            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                              {catalogImportSummary.errorDetails.map((line) => (
                                <p key={line}>{line}</p>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </div>

                <div className="sticky bottom-0 border-t bg-background/95 p-4">
                  <div className="flex justify-end">
                    <SidePanelClose asChild>
                      <Button type="button" variant="outline" disabled={isCatalogImporting}>
                        Cerrar
                      </Button>
                    </SidePanelClose>
                  </div>
                </div>
              </div>
            </SidePanelContent>
          </SidePanel>

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

          <Card>
            <CardHeader>
              <CardTitle>Verificar implementación</CardTitle>
              <CardDescription>Disponible en futuras versiones.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="text-sm font-medium text-foreground">No disponible en la versión 1.0</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  En futuras versiones se incluirán validaciones automáticas para asegurar que la implementación esté lista para operar.
                </p>
              </div>
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
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isDownloadingInitialInventoryTemplate}
                          onClick={() => void downloadCsvTemplate()}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Descargar plantilla CSV
                        </Button>
                        <input
                          ref={csvInputRef}
                          type="file"
                          accept=".csv,text/csv"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            if (!file) return
                            void handleCsvImport(file)
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isImporting}
                          onClick={() => csvInputRef.current?.click()}
                        >
                          {isImporting ? <Loader className="mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />}
                          Importar CSV
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {itemFields.map((field, index) => {
                        const itemError = initialInventoryForm.formState.errors.items?.[index]
                        const productId = initialInventoryForm.watch(`items.${index}.productoId`)
                        const selectedProduct = productId ? productCache[productId] ?? null : null
                        const selectedPresentationId = initialInventoryForm.watch(
                          `items.${index}.presentacionId`,
                        ) as string
                        const presentationOptions = selectedProduct?.packaging?.presentations?.length
                          ? selectedProduct.packaging.presentations.filter(
                              (entry) => entry.factorToBase && entry.factorToBase > 0,
                            )
                          : []
                        const selectedPresentation = selectedPresentationId
                          ? presentationOptions.find((entry) => entry.id === selectedPresentationId) ?? null
                          : null
                        const selectedFactor =
                          selectedPresentation?.factorToBase && selectedPresentation.factorToBase > 0
                            ? selectedPresentation.factorToBase
                            : null
                        const selectedQuantity = initialInventoryForm.watch(
                          `items.${index}.cantidad`,
                        ) as number
                        const baseUnits =
                          selectedFactor && Number.isFinite(selectedQuantity)
                            ? Math.floor(Number(selectedQuantity)) * selectedFactor
                            : null
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
                                  value={productId}
                                  onValueChange={(value) => {
                                    initialInventoryForm.setValue(`items.${index}.productoId`, value, {
                                      shouldValidate: true,
                                      shouldDirty: true,
                                    })
                                    initialInventoryForm.setValue(`items.${index}.presentacionId`, '', {
                                      shouldValidate: true,
                                      shouldDirty: true,
                                    })
                                  }}
                                  onProductSelected={(product) => {
                                    setProductCache((prev) => ({ ...prev, [product.id]: product }))
                                    const options = product.packaging.presentations.filter(
                                      (entry) => entry.factorToBase && entry.factorToBase > 0,
                                    )
                                    const desired =
                                      (product.packaging.purchasePresentationId &&
                                        options.some(
                                          (entry) => entry.id === product.packaging.purchasePresentationId,
                                        ) &&
                                        product.packaging.purchasePresentationId) ||
                                      (product.packaging.basePresentationId &&
                                        options.some(
                                          (entry) => entry.id === product.packaging.basePresentationId,
                                        ) &&
                                        product.packaging.basePresentationId) ||
                                      options[0]?.id ||
                                      ''
                                    initialInventoryForm.setValue(`items.${index}.presentacionId`, desired, {
                                      shouldValidate: true,
                                      shouldDirty: true,
                                    })
                                  }}
                                  placeholder="Buscar por nombre o SKU"
                                />
                                <FieldError message={itemError?.productoId?.message} />
                              </div>

                              <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">
                                  Presentación de ingreso
                                </p>
                                <Controller
                                  control={initialInventoryForm.control}
                                  name={`items.${index}.presentacionId` as const}
                                  render={({ field }) => (
                                    <Select value={field.value} onValueChange={field.onChange}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecciona presentación" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {presentationOptions.map((entry) => (
                                          <SelectItem key={entry.id} value={entry.id}>
                                            {entry.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                />
                                <FieldError message={itemError?.presentacionId?.message} />
                                {selectedPresentation && selectedFactor ? (
                                  <p className="text-xs text-muted-foreground">
                                    1 {selectedPresentation.name} = {selectedFactor} unidades base
                                  </p>
                                ) : null}
                                {baseUnits ? (
                                  <p className="text-xs text-muted-foreground">
                                    Stock que se registrará: {baseUnits} unidades base
                                  </p>
                                ) : null}
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
                                <p className="text-xs font-medium text-muted-foreground">
                                  Costo de adquisición
                                </p>
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
                            presentacionId: '',
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

      <SidePanel
        open={isBranchPanelOpen}
        onOpenChange={(open) => {
          setIsBranchPanelOpen(open)
          if (!open) {
            setSelectedBranch(null)
            branchForm.reset({
              nombre: '',
              codigo: '',
              direccion: null,
              telefono: null,
              email: null,
              activo: true,
            })
          }
        }}
      >
        <SidePanelContent>
          <form
            className="flex h-full flex-col"
            onSubmit={branchForm.handleSubmit(handleBranchSubmit)}
          >
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-foreground">
                      {selectedBranch ? 'Editar sucursal' : 'Nueva sucursal'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedBranch
                        ? 'Actualiza los datos operativos y el estado de la sucursal.'
                        : 'Crea una nueva sucursal para operar en la empresa actual.'}
                    </p>
                  </div>
                  <SidePanelClose asChild>
                    <Button variant="ghost" size="icon">
                      <X className="h-4 w-4" />
                    </Button>
                  </SidePanelClose>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Nombre <span className="text-rose-600">*</span>
                    </label>
                    <Input
                      placeholder="Ej. Sucursal Pichanaki"
                      {...branchForm.register('nombre')}
                      disabled={isBranchPanelSubmitting}
                    />
                    <FieldError message={branchForm.formState.errors.nombre?.message} />
                  </div>

                  {selectedBranch ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Código</label>
                      <Input
                        value={selectedBranch.codigo}
                        disabled
                        className="cursor-not-allowed bg-muted/60"
                      />
                      <p className="text-xs text-muted-foreground">
                        El código no puede modificarse después de la creación.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Código <span className="text-rose-600">*</span>
                      </label>
                      <Input
                        placeholder="Ej. PICH"
                        {...branchForm.register('codigo')}
                        disabled={isBranchPanelSubmitting}
                      />
                      <FieldError message={branchForm.formState.errors.codigo?.message} />
                      <p className="text-xs text-muted-foreground">
                        Máximo 20 caracteres (letras, números, guion bajo o guion). Debe ser
                        único dentro de la empresa.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Dirección</label>
                    <Input
                      placeholder="Av. principal 123"
                      {...branchForm.register('direccion')}
                      disabled={isBranchPanelSubmitting}
                    />
                    <FieldError message={branchForm.formState.errors.direccion?.message} />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Teléfono</label>
                      <Input
                        placeholder="+51 900 000 000"
                        {...branchForm.register('telefono')}
                        disabled={isBranchPanelSubmitting}
                      />
                      <FieldError
                        message={branchForm.formState.errors.telefono?.message}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Correo</label>
                      <Input
                        type="email"
                        placeholder="sucursal@botica.pe"
                        {...branchForm.register('email')}
                        disabled={isBranchPanelSubmitting}
                      />
                      <FieldError message={branchForm.formState.errors.email?.message} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/20 p-4">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-foreground">Estado</p>
                      <p className="text-xs text-muted-foreground">
                        Una sucursal inactiva no aparecerá como opción para nuevas operaciones
                        ni al iniciar sesión, pero conserva su historial.
                      </p>
                    </div>
                    <Controller
                      control={branchForm.control}
                      name="activo"
                      render={({ field }) => (
                        <Switch
                          checked={Boolean(field.value)}
                          onCheckedChange={(checked) => field.onChange(checked === true)}
                          disabled={isBranchPanelSubmitting}
                        />
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t bg-card p-4 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <SidePanelClose asChild>
                  <Button type="button" variant="outline" disabled={isBranchPanelSubmitting}>
                    Cancelar
                  </Button>
                </SidePanelClose>
                <Button type="submit" disabled={isBranchPanelSubmitting}>
                  {isBranchPanelSubmitting ? (
                    <>
                      <Loader className="mr-2 h-4 w-4" />
                      Guardando
                    </>
                  ) : selectedBranch ? (
                    'Guardar cambios'
                  ) : (
                    'Crear sucursal'
                  )}
                </Button>
              </div>
            </div>
          </form>
        </SidePanelContent>
      </SidePanel>
    </div>
  )
}
