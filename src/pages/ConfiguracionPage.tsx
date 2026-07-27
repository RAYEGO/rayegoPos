import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import { Download, ImageUp, Plus, RefreshCcw, Upload, X } from 'lucide-react'
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
import type { CreateProductPayload, ProductCatalogItem } from '@/types/products'
import { formatImplementationMessage, IMPLEMENTATION_MESSAGES } from '@/modules/implementation/messages'
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
                    onProductSelected?.(product)
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
        empaque: z.enum(['UNIDAD', 'BLISTER', 'CAJA'], {
          message: 'Selecciona una presentación.',
        }),
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

const appSystemInfo = {
  version: 'Rayego POS v1.0',
  architecture: 'Multiempresa preparada',
} as const

type PackagingPresentation = 'UNIDAD' | 'BLISTER' | 'CAJA'

const presentationLabels: Record<PackagingPresentation, string> = {
  UNIDAD: 'Unidad',
  BLISTER: 'Blíster',
  CAJA: 'Caja',
}

function resolvePresentationOptions(product: ProductCatalogItem | null): PackagingPresentation[] {
  if (!product) {
    return ['UNIDAD']
  }

  if (product.packagingMode !== 'BLISTER') {
    return ['UNIDAD']
  }

  const options: PackagingPresentation[] = ['UNIDAD']
  const unitsPerBlister = product.unitsPerBlister ?? 0
  const blistersPerBox = product.blistersPerBox ?? 0

  if (unitsPerBlister > 0) {
    options.push('BLISTER')
  }

  if (unitsPerBlister > 0 && blistersPerBox > 0) {
    options.push('CAJA')
  }

  return options
}

function resolveConversionSummary(product: ProductCatalogItem | null) {
  if (!product || product.packagingMode !== 'BLISTER') {
    return null
  }

  const unitsPerBlister = product.unitsPerBlister ?? 0
  const blistersPerBox = product.blistersPerBox ?? 0

  const parts: string[] = []
  if (unitsPerBlister > 0) {
    parts.push(`1 Blíster = ${unitsPerBlister} Unidades`)
  }
  if (unitsPerBlister > 0 && blistersPerBox > 0) {
    parts.push(
      `1 Caja = ${blistersPerBox} Blísteres = ${unitsPerBlister * blistersPerBox} Unidades`,
    )
  }

  return parts.length ? parts.join(' · ') : 'La configuración de empaque del producto está incompleta.'
}

function convertToBaseUnits(
  product: ProductCatalogItem | null,
  presentation: PackagingPresentation,
  quantity: number,
) {
  const normalizedQuantity = Number(quantity)
  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
    return null
  }

  if (!product || product.packagingMode !== 'BLISTER') {
    return normalizedQuantity
  }

  const unitsPerBlister = product.unitsPerBlister ?? 0
  const blistersPerBox = product.blistersPerBox ?? 0

  if (presentation === 'UNIDAD') {
    return normalizedQuantity
  }

  if (presentation === 'BLISTER') {
    return unitsPerBlister > 0 ? normalizedQuantity * unitsPerBlister : null
  }

  if (presentation === 'CAJA') {
    return unitsPerBlister > 0 && blistersPerBox > 0
      ? normalizedQuantity * unitsPerBlister * blistersPerBox
      : null
  }

  return normalizedQuantity
}

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
  const [productCache, setProductCache] = useState<Record<string, ProductCatalogItem>>({})
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
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

  const csvInputRef = useRef<HTMLInputElement | null>(null)
  const catalogCsvInputRef = useRef<HTMLInputElement | null>(null)

  const initialInventoryForm = useForm<InitialInventoryFormValues>({
    resolver: zodResolver(initialInventorySchema),
    defaultValues: {
      items: [
        {
          productoId: '',
          numeroLote: '',
          empaque: 'UNIDAD',
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

  function normalizePresentation(value: string): PackagingPresentation | null {
    const normalized = value.trim().toUpperCase()
    const withoutAccent = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (!withoutAccent) return null
    if (withoutAccent === 'UNIDAD' || withoutAccent === 'UNIDADES') return 'UNIDAD'
    if (withoutAccent === 'BLISTER' || withoutAccent === 'BLISTERS') return 'BLISTER'
    if (withoutAccent === 'CAJA' || withoutAccent === 'CAJAS') return 'CAJA'
    return null
  }

  function buildInitialInventoryCsvTemplate() {
    return [
      'sku,numeroLote,fechaVencimiento,costoUnitario,cantidad,presentacion',
      'PARA-500-CAJA,LOTE-001,2027-12-31,1.80,1,CAJA',
      'PARA-500-CAJA,LOTE-002,2027-12-31,0.18,10,BLISTER',
      'PARA-500-CAJA,LOTE-003,2027-12-31,0.02,100,UNIDAD',
      '',
    ].join('\n')
  }

  function downloadCsvTemplate() {
    const content = buildInitialInventoryCsvTemplate()
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'rayego-carga-inicial-template.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
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
    const expectedHeaders = [
      'sku',
      'numerolote',
      'fechavencimiento',
      'costounitario',
      'cantidad',
      'presentacion',
    ]

    const normalizedHeaders = headers.map((header) => header.toLowerCase())
    const missing = expectedHeaders.filter((header) => !normalizedHeaders.includes(header))
    if (missing.length) {
      throw new Error(
        formatImplementationMessage(
          'INVALID_FILE',
          `Faltan columnas en el CSV: ${missing.join(', ')}`,
        ),
      )
    }

    const headerIndex = Object.fromEntries(
      normalizedHeaders.map((header, index) => [header, index]),
    ) as Record<string, number>

    return lines.slice(1).map((line, rowIndex) => {
      const columns = line.split(delimiter).map((col) => col.trim())
      const get = (key: string) => columns[headerIndex[key]] ?? ''
      return {
        row: rowIndex + 2,
        sku: get('sku'),
        numeroLote: get('numerolote'),
        fechaVencimiento: get('fechavencimiento'),
        costoUnitario: get('costounitario'),
        cantidad: get('cantidad'),
        presentacion: get('presentacion'),
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
        const presentation = normalizePresentation(row.presentacion)
        if (!presentation) {
          throw new Error(`Fila ${row.row}: ${IMPLEMENTATION_MESSAGES.INVALID_PRESENTATION}`)
        }

        const allowed = resolvePresentationOptions(product)
        if (!allowed.includes(presentation)) {
          throw new Error(`Fila ${row.row}: ${IMPLEMENTATION_MESSAGES.INVALID_PRESENTATION}`)
        }

        const quantity = Number(row.cantidad)
        const unitCost = Number(row.costoUnitario)
        if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
          throw new Error(`Fila ${row.row}: La cantidad debe ser un entero mayor a 0.`)
        }
        if (!Number.isFinite(unitCost) || unitCost < 0) {
          throw new Error(`Fila ${row.row}: El costo unitario debe ser mayor o igual a 0.`)
        }

        items.push({
          productoId: product.id,
          numeroLote: row.numeroLote,
          empaque: presentation,
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

  function buildProductCatalogCsvTemplate() {
    return [
      [
        'sku',
        'codigoBarras',
        'nombre',
        'categoria',
        'laboratorio',
        'presentacion',
        'unidadNombre',
        'unidadSimbolo',
        'precioVenta',
        'costoReferencia',
        'requiereReceta',
        'esControlado',
        'modoEmpaque',
        'unidadesPorBlister',
        'blistersPorCaja',
        'precioVentaBlister',
        'descripcion',
        'concentracion',
        'registroSanitario',
        'observaciones',
      ].join(','),
      [
        'PARA-500-CAJA',
        '',
        'Paracetamol 500mg',
        'ANALGÉSICOS',
        'ACME',
        'Tabletas',
        'Unidad',
        'und',
        '0.50',
        '0.10',
        'NO',
        'NO',
        'BLISTER',
        '10',
        '10',
        '0.20',
        'Analgésico',
        '500mg',
        '',
        '',
      ].join(','),
      [
        'VITC-1G-UND',
        '',
        'Vitamina C 1g',
        'VITAMINAS',
        '',
        'Tabletas',
        'Unidad',
        'und',
        '1.50',
        '0.30',
        'NO',
        'NO',
        'SIMPLE',
        '',
        '',
        '',
        '',
        '1g',
        '',
        '',
      ].join(','),
      '',
    ].join('\n')
  }

  function downloadProductCatalogTemplate() {
    const content = buildProductCatalogCsvTemplate()
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'rayego-importar-catalogo-productos-template.csv'
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

  function normalizePackagingMode(value: string): 'SIMPLE' | 'BLISTER' | null {
    const normalized = value.trim().toUpperCase()
    const withoutAccent = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (!withoutAccent) return null
    if (withoutAccent === 'SIMPLE') return 'SIMPLE'
    if (withoutAccent === 'BLISTER') return 'BLISTER'
    return null
  }

  function normalizeMasterKey(value: string) {
    return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  }

  function parseProductCatalogCsv(content: string) {
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    if (!lines.length) {
      throw new Error('El archivo CSV está vacío.')
    }

    const delimiter = lines[0]?.includes(';') ? ';' : ','
    const headers = lines[0].split(delimiter).map((header) => header.trim())
    const normalizedHeaders = headers.map((header) => header.toLowerCase())

    const expectedHeaders = [
      'sku',
      'nombre',
      'categoria',
      'unidadnombre',
      'unidadsimbolo',
      'precioventa',
      'costoreferencia',
      'requiereReceta'.toLowerCase(),
      'escontrolado',
      'modoempaque',
    ].map((header) => header.toLowerCase())

    const missing = expectedHeaders.filter((header) => !normalizedHeaders.includes(header))
    if (missing.length) {
      throw new Error(`Faltan columnas en el CSV: ${missing.join(', ')}`)
    }

    const headerIndex = Object.fromEntries(
      normalizedHeaders.map((header, index) => [header, index]),
    ) as Record<string, number>

    const get = (columns: string[], key: string) => columns[headerIndex[key]] ?? ''

    return lines.slice(1).map((line, rowIndex) => {
      const columns = line.split(delimiter).map((col) => col.trim())
      const value = (key: string) => get(columns, key)
      return {
        row: rowIndex + 2,
        sku: value('sku'),
        codigoBarras: value('codigobarras'),
        nombre: value('nombre'),
        categoria: value('categoria'),
        laboratorio: value('laboratorio'),
        presentacion: value('presentacion'),
        unidadNombre: value('unidadnombre'),
        unidadSimbolo: value('unidadsimbolo'),
        precioVenta: value('precioventa'),
        costoReferencia: value('costoreferencia'),
        requiereReceta: value('requierereceta'),
        esControlado: value('escontrolado'),
        modoEmpaque: value('modoempaque'),
        unidadesPorBlister: value('unidadesporblister'),
        blistersPorCaja: value('blistersporcaja'),
        precioVentaBlister: value('precioventablister'),
        descripcion: value('descripcion'),
        concentracion: value('concentracion'),
        registroSanitario: value('registrosanitario'),
        observaciones: value('observaciones'),
      }
    })
  }

  async function handleProductCatalogImport(file: File) {
    if (!accessToken) return
    setIsCatalogImporting(true)
    setCatalogImportSummary(null)

    try {
      const [categoriesResponse, laboratoriesResponse, presentationsResponse, unitsResponse] =
        await Promise.all([
          productsService.listMasterCategories(accessToken),
          productsService.listMasterLaboratories(accessToken),
          productsService.listMasterPresentations(accessToken),
          productsService.listMasterUnits(accessToken),
        ])

      const categoriesByName = new Map(
        categoriesResponse.rows.map((row) => [normalizeMasterKey(row.nombre), row]),
      )
      const labsByName = new Map(
        laboratoriesResponse.rows.map((row) => [normalizeMasterKey(row.nombre), row]),
      )
      const presentationsByName = new Map(
        presentationsResponse.rows.map((row) => [normalizeMasterKey(row.nombre), row]),
      )
      const unitsByName = new Map(
        unitsResponse.rows.map((row) => [normalizeMasterKey(row.nombre), row]),
      )

      const text = await file.text()
      const rows = parseProductCatalogCsv(text)

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

          const presentationName = row.presentacion.trim()
          let presentationId: string | undefined
          if (presentationName) {
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

            presentationId = presentation.id
          }

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

          const mode = normalizePackagingMode(row.modoEmpaque)
          if (!mode) {
            pushError(row.row, IMPLEMENTATION_MESSAGES.PACKAGE_TYPE_NOT_FOUND)
            continue
          }

          const unitsPerBlister = row.unidadesPorBlister ? Number(row.unidadesPorBlister) : null
          const blistersPerBox = row.blistersPorCaja ? Number(row.blistersPorCaja) : null
          const blisterPrice = row.precioVentaBlister ? Number(row.precioVentaBlister) : null

          if (mode === 'BLISTER') {
            if (!unitsPerBlister || !Number.isInteger(unitsPerBlister) || unitsPerBlister <= 1) {
              pushError(row.row, IMPLEMENTATION_MESSAGES.INVALID_CONVERSION)
              continue
            }
            if (!blistersPerBox || !Number.isInteger(blistersPerBox) || blistersPerBox <= 0) {
              pushError(row.row, IMPLEMENTATION_MESSAGES.INVALID_CONVERSION)
              continue
            }
            if (
              blisterPrice !== null &&
              (!Number.isFinite(blisterPrice) || blisterPrice < 0)
            ) {
              pushError(row.row, IMPLEMENTATION_MESSAGES.INVALID_PRICE)
              continue
            }
          }

          const payload: CreateProductPayload = {
            categoriaId: category.id,
            laboratorioId: labId,
            presentacionId: presentationId,
            unidadMedidaId: unit.id,
            modoEmpaque: mode,
            ...(mode === 'BLISTER'
              ? {
                  unidadesPorBlister: Math.floor(unitsPerBlister ?? 0),
                  blistersPorCaja: Math.floor(blistersPerBox ?? 0),
                  ...(blisterPrice !== null ? { precioVentaBlister: blisterPrice } : {}),
                }
              : {}),
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
            precioVenta: price,
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
                <CardTitle>Importar Catálogo de Productos</CardTitle>
                <CardDescription>
                  Crea masivamente el maestro de productos y sus catálogos relacionados. No genera stock, lotes ni
                  movimientos de inventario.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => downloadProductCatalogTemplate()}>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar plantilla CSV
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
                        La plantilla incluye configuración de empaque (Caja/Blíster/Unidad) y crea categorías,
                        laboratorios, presentaciones y unidades si no existen.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button type="button" variant="outline" onClick={() => downloadProductCatalogTemplate()}>
                          <Download className="mr-2 h-4 w-4" />
                          Descargar plantilla CSV
                        </Button>

                        <input
                          ref={catalogCsvInputRef}
                          type="file"
                          accept=".csv,text/csv"
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
                          Importar CSV
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
                          onClick={() => downloadCsvTemplate()}
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
                        const presentationOptions = resolvePresentationOptions(selectedProduct)
                        const conversionSummary = resolveConversionSummary(selectedProduct)
                        const selectedPresentation = initialInventoryForm.watch(
                          `items.${index}.empaque`,
                        ) as PackagingPresentation
                        const selectedQuantity = initialInventoryForm.watch(
                          `items.${index}.cantidad`,
                        ) as number
                        const baseUnits = convertToBaseUnits(
                          selectedProduct,
                          selectedPresentation,
                          selectedQuantity,
                        )
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
                                  onValueChange={(value) =>
                                    initialInventoryForm.setValue(`items.${index}.productoId`, value, {
                                      shouldValidate: true,
                                      shouldDirty: true,
                                    })
                                  }
                                  onProductSelected={(product) => {
                                    setProductCache((prev) => ({ ...prev, [product.id]: product }))
                                    const defaultPresentation =
                                      product.packagingMode === 'BLISTER'
                                        ? resolvePresentationOptions(product).includes('CAJA')
                                          ? 'CAJA'
                                          : resolvePresentationOptions(product).includes('BLISTER')
                                            ? 'BLISTER'
                                            : 'UNIDAD'
                                        : 'UNIDAD'
                                    initialInventoryForm.setValue(
                                      `items.${index}.empaque`,
                                      defaultPresentation,
                                      { shouldValidate: true, shouldDirty: true },
                                    )
                                  }}
                                  placeholder="Buscar por nombre o SKU"
                                />
                                <FieldError message={itemError?.productoId?.message} />
                              </div>

                              <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">Presentación</p>
                                <Controller
                                  control={initialInventoryForm.control}
                                  name={`items.${index}.empaque` as const}
                                  render={({ field }) => (
                                    <Select
                                      value={field.value}
                                      onValueChange={(value) =>
                                        field.onChange(value as PackagingPresentation)
                                      }
                                      disabled={!selectedProduct}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecciona" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {presentationOptions.map((option) => (
                                          <SelectItem key={option} value={option}>
                                            {presentationLabels[option]}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                />
                                <FieldError message={itemError?.empaque?.message as string | undefined} />
                                {conversionSummary ? (
                                  <p className="text-xs text-muted-foreground">{conversionSummary}</p>
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
                                {baseUnits ? (
                                  <p className="text-xs text-muted-foreground">
                                    Se registrarán {baseUnits} unidades base.
                                  </p>
                                ) : selectedProduct && selectedProduct.packagingMode === 'BLISTER' ? (
                                  <p className="text-xs text-muted-foreground">
                                    No se puede convertir con la configuración de empaque actual.
                                  </p>
                                ) : null}
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
                            empaque: 'UNIDAD',
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
