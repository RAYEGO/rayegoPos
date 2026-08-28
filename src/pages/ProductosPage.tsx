import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Edit,
  Eye,
  Layers,
  Loader2,
  MoreVertical,
  PackagePlus,
  Pill,
  Plus,
  Power,
  Search,
  Trash2,
  Copy,
  TestTubeDiagonal,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Loader } from '@/components/ui/loader'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { ProductMastersCenter } from '@/components/products/masters-center/ProductMastersCenter'
import { useAuth } from '@/hooks/useAuth'
import { useAuthorization } from '@/hooks/useAuthorization'
import { useHandleUnauthorized } from '@/hooks/useHandleUnauthorized'
import { ApiError, ApiNetworkError } from '@/services/apiClient'
import { productsService } from '@/services/productsService'
import {
  buildCumulativePackagingLabels as buildPackagingChainPreview,
  buildPackagingSummary,
} from '@/utils/packaging'
import type {
  CreateProductPayload,
  MasterActivePrincipleRecord,
  MasterCategoryRecord,
  MasterLaboratoryRecord,
  MasterMedicationTypeRecord,
  MasterPresentationRecord,
  MasterUnitRecord,
  ProductCatalogItem,
  ProductOptionsResponse,
  ProductPackagingPreviewPayload,
  ProductPackagingPreviewResponse,
  ProductStatus,
  UpdateProductPayload,
  UpsertMasterActivePrinciplePayload,
  UpsertMasterCategoryPayload,
  UpsertMasterLaboratoryPayload,
  UpsertMasterMedicationTypePayload,
  UpsertMasterPresentationPayload,
  UpsertMasterUnitPayload,
} from '@/types/products'
import { toast } from 'sonner'

const packagingRowSchema = z.object({
  presentacionId: z.string().uuid({ message: 'Selecciona una presentación.' }),
  permiteCompra: z.boolean(),
  permiteVenta: z.boolean(),
  precioVenta: z.number().nonnegative('El precio debe ser mayor o igual a 0.').optional(),
  cantidadEquivalencia: z
    .number()
    .int('La cantidad debe ser un entero.')
    .positive('La cantidad debe ser un entero mayor a 0.')
    .optional(),
})

const createProductSchema = z.object({
  categoriaId: z.string().uuid({ message: 'Selecciona una categoría.' }),
  laboratorioId: z.string().optional(),
  tipoMedicamentoId: z.string().uuid({ message: 'Selecciona un tipo comercial.' }),
  unidadMedidaId: z.string().uuid({ message: 'Selecciona una unidad.' }),
  empaque: z.array(packagingRowSchema).min(1, 'Agrega al menos una presentación.'),
  principioActivoId: z.string().uuid({ message: 'Selecciona un principio activo.' }),
  sku: z.string().min(3, 'Ingresa un SKU válido.').max(50),
  codigoBarras: z.string().max(50).optional(),
  nombre: z.string().min(3, 'Ingresa el nombre del producto.').max(180),
  descripcion: z.string().max(500).optional(),
  concentracion: z.string().max(120).optional(),
  registroSanitario: z.string().max(100).optional(),
  requiereReceta: z.boolean(),
  esControlado: z.boolean(),
}).superRefine((values, ctx) => {
  const presentationIds = values.empaque.map((entry) => entry.presentacionId)

  if (new Set(presentationIds).size !== presentationIds.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'No se permiten presentaciones duplicadas.',
      path: ['empaque'],
    })
  }

  values.empaque.forEach((entry, index) => {
    const isLastStep = index === values.empaque.length - 1

    if (entry.permiteVenta && (entry.precioVenta === undefined || entry.precioVenta === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Define un precio para la presentación habilitada para venta.',
        path: ['empaque', index, 'precioVenta'],
      })
    }

    const hasQuantity = typeof entry.cantidadEquivalencia === 'number'

    if (!isLastStep && !hasQuantity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Define cuántas unidades equivalen a la siguiente presentación.',
        path: ['empaque', index, 'cantidadEquivalencia'],
      })
    }
  })

  if (!values.empaque.some((entry) => entry.permiteCompra)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'El producto debe tener al menos una presentación habilitada para compra.',
      path: ['empaque'],
    })
  }

  if (!values.empaque.some((entry) => entry.permiteVenta)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'El producto debe tener al menos una presentación habilitada para venta.',
      path: ['empaque'],
    })
  }
})

const masterCategorySchema = z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio.').max(120),
  descripcion: z.string().max(255).optional(),
  color: z.string().max(20).optional(),
  orden: z.number().int().nonnegative().optional(),
  activo: z.boolean().optional(),
})

const masterLaboratorySchema = z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio.').max(150),
  pais: z.string().max(80).optional(),
  descripcion: z.string().max(255).optional(),
  activo: z.boolean().optional(),
})

const masterMedicationTypeSchema = z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio.').max(120),
  descripcion: z.string().max(255).optional(),
  activo: z.boolean().optional(),
})

const masterActivePrincipleSchema = z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio.').max(150),
  descripcion: z.string().max(255).optional(),
  activo: z.boolean().optional(),
})

const masterPresentationSchema = z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio.').max(120),
  descripcion: z.string().max(255).optional(),
  activo: z.boolean().optional(),
})

const masterUnitSchema = z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio.').max(80),
  simbolo: z.string().min(1, 'El símbolo es obligatorio.').max(20),
  descripcion: z.string().max(255).optional(),
  activo: z.boolean().optional(),
})

type CreateProductFormValues = z.infer<typeof createProductSchema>
type MasterCategoryFormValues = z.infer<typeof masterCategorySchema>
type MasterLaboratoryFormValues = z.infer<typeof masterLaboratorySchema>
type MasterMedicationTypeFormValues = z.infer<typeof masterMedicationTypeSchema>
type MasterActivePrincipleFormValues = z.infer<typeof masterActivePrincipleSchema>
type MasterPresentationFormValues = z.infer<typeof masterPresentationSchema>
type MasterUnitFormValues = z.infer<typeof masterUnitSchema>
type PackagingFormRow = CreateProductFormValues['empaque'][number]

const defaultFormValues: CreateProductFormValues = {
  categoriaId: '',
  laboratorioId: '',
  tipoMedicamentoId: '',
  unidadMedidaId: '',
  empaque: [],
  principioActivoId: '',
  sku: '',
  codigoBarras: '',
  nombre: '',
  descripcion: '',
  concentracion: '',
  registroSanitario: '',
  requiereReceta: false,
  esControlado: false,
}

function buildPackagingPayload(values: CreateProductFormValues): ProductPackagingPreviewPayload {
  return {
    cadenaEmpaque: values.empaque.map((entry, index) => ({
      presentacionId: entry.presentacionId,
      permiteCompra: entry.permiteCompra,
      permiteVenta: entry.permiteVenta,
      ...(entry.permiteVenta && typeof entry.precioVenta === 'number'
        ? { precioVenta: entry.precioVenta }
        : {}),
      ...(index < values.empaque.length - 1 && typeof entry.cantidadEquivalencia === 'number'
        ? { cantidad: entry.cantidadEquivalencia }
        : {}),
    })),
  }
}

function buildPackagingPreviewPayloadFromRows(rows: PackagingFormRow[]): ProductPackagingPreviewPayload {
  return {
    cadenaEmpaque: rows.map((entry, index) => ({
      presentacionId: entry.presentacionId,
      permiteCompra: entry.permiteCompra,
      permiteVenta: entry.permiteVenta,
      ...(entry.permiteVenta && typeof entry.precioVenta === 'number'
        ? { precioVenta: entry.precioVenta }
        : {}),
      ...(index < rows.length - 1 && typeof entry.cantidadEquivalencia === 'number'
        ? { cantidad: entry.cantidadEquivalencia }
        : {}),
    })),
  }
}

function buildPackagingRowsFromProduct(product: ProductCatalogItem) {
  const conversionByFromPresentationId = new Map(
    product.packaging.conversions.map((entry) => [entry.fromPresentationId, entry]),
  )
  const incomingPresentationIds = new Set(
    product.packaging.conversions.map((entry) => entry.toPresentationId),
  )

  const startPresentationId =
    product.packaging.summaries[0]?.presentationId ??
    product.packaging.purchasePresentationId ??
    product.packaging.presentations.find((entry) => !incomingPresentationIds.has(entry.id))?.id ??
    product.packaging.presentations[0]?.id ??
    ''

  const orderedPresentationIds: string[] = []
  const visited = new Set<string>()
  let currentPresentationId: string | undefined = startPresentationId

  while (currentPresentationId && !visited.has(currentPresentationId)) {
    visited.add(currentPresentationId)
    orderedPresentationIds.push(currentPresentationId)
    currentPresentationId = conversionByFromPresentationId.get(currentPresentationId)?.toPresentationId
  }

  for (const presentation of product.packaging.presentations) {
    if (!visited.has(presentation.id)) {
      orderedPresentationIds.push(presentation.id)
    }
  }

  return orderedPresentationIds
    .map((presentationId) => {
      const presentation = product.packaging.presentations.find((entry) => entry.id === presentationId)
      if (!presentation) {
        return null
      }

      const conversion = conversionByFromPresentationId.get(presentationId)

      return {
        presentacionId: presentation.id,
        permiteCompra: presentation.allowsPurchase,
        permiteVenta: presentation.allowsSale,
        precioVenta: presentation.salePrice ?? undefined,
        cantidadEquivalencia: conversion?.quantity,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
}

function createEmptyPackagingRow(presentationId = ''): PackagingFormRow {
  return {
    presentacionId: presentationId,
    permiteCompra: false,
    permiteVenta: false,
    precioVenta: undefined,
    cantidadEquivalencia: undefined,
  }
}

function getProductStatusVariant(status: ProductStatus) {
  if (status === 'ACTIVO') return 'success'
  if (status === 'INACTIVO') return 'outline'
  return 'warning'
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(value)
}

function buildSkuSuggestion() {
  const stamp = Date.now().toString().slice(-6)
  return `MED-${stamp}`.slice(0, 50)
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Sin lotes'
  }

  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

function getStockVariant(product: ProductCatalogItem) {
  if (product.stockUnits === 0) return 'destructive'
  if (product.stockUnits <= 20 || product.lotCount <= 1) return 'warning'
  return 'success'
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

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <p className="text-xs text-destructive">{message}</p>
}

function getFirstFormErrorMessage(value: unknown): string | null {
  if (!value) {
    return null
  }

  if (typeof value === 'object' && value !== null) {
    if ('message' in value && typeof value.message === 'string' && value.message.trim().length > 0) {
      return value.message
    }

    for (const nestedValue of Object.values(value)) {
      const nestedMessage = getFirstFormErrorMessage(nestedValue)
      if (nestedMessage) {
        return nestedMessage
      }
    }
  }

  return null
}

export function ProductosPage() {
  const { session } = useAuth()
  const authorization = useAuthorization()
  const accessToken = session?.accessToken ?? ''
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'TODOS' | ProductStatus>('TODOS')
  const [categoryFilter, setCategoryFilter] = useState('TODAS')
  const [laboratoryFilter, setLaboratoryFilter] = useState('TODOS')
  const [medicationTypeFilter, setMedicationTypeFilter] = useState('TODOS')
  const [activePrincipleFilter, setActivePrincipleFilter] = useState('TODOS')
  const [showSummary, setShowSummary] = useState(true)
  const [mainTab, setMainTab] = useState<'catalogo' | 'maestros'>('catalogo')
  const [products, setProducts] = useState<ProductCatalogItem[]>([])
  const [summary, setSummary] = useState({
    total: 0,
    activeCatalog: 0,
    lowStockCount: 0,
    withPrescription: 0,
    lotEnabled: 0,
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [sortBy, setSortBy] = useState<'name' | 'stockUnits' | 'createdAt'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [options, setOptions] = useState<ProductOptionsResponse>({
    categories: [],
    laboratories: [],
    commercialTypes: [],
    medicationTypes: [],
    presentations: [],
    units: [],
    activePrinciples: [],
  })
  const [isCatalogLoading, setIsCatalogLoading] = useState(true)
  const [isOptionsLoading, setIsOptionsLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isMasterSubmitting, setIsMasterSubmitting] = useState(false)
  const [isPackagingDialogOpen, setIsPackagingDialogOpen] = useState(false)
  const [isPackagingGuideOpen, setIsPackagingGuideOpen] = useState(false)
  const [dontShowPackagingGuide, setDontShowPackagingGuide] = useState<boolean>(() => {
    try {
      if (typeof window === 'undefined') return false
      return window.localStorage.getItem('no_volver_a_mostrar_empaque_guia') === '1'
    } catch {
      return false
    }
  })
  const [isPackagingBreakdownOpen, setIsPackagingBreakdownOpen] = useState(false)
  const packagingInputRefs = useRef<
    Record<string, { cantidad: HTMLInputElement | null; precio: HTMLInputElement | null }>
  >({})
  const packagingInputDefaults = useRef<
    Record<string, { cantidad: string; precio: string; mountKey: number }>
  >({})
  const [editingProduct, setEditingProduct] = useState<ProductCatalogItem | null>(null)
  const [selectedProductDetail, setSelectedProductDetail] = useState<ProductCatalogItem | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<
    | { type: 'activate' | 'deactivate' | 'delete'; product: ProductCatalogItem }
    | null
  >(null)
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const createDialogContentRef = useRef<HTMLDivElement | null>(null)
  const createDialogScrollTopRef = useRef(0)
  const previousPackagingOpenRef = useRef(false)

  const [masterDialogOpen, setMasterDialogOpen] = useState(false)
  const [masterDialogType, setMasterDialogType] = useState<
    'categoria' | 'laboratorio' | 'tipoMedicamento' | 'principioActivo' | 'presentacion' | 'unidad'
  >('categoria')
  const [masterDialogMode, setMasterDialogMode] = useState<'create' | 'edit'>('create')
  const [masterDialogTargetField, setMasterDialogTargetField] = useState<
    | 'categoriaId'
    | 'laboratorioId'
    | 'tipoMedicamentoId'
    | 'principioActivoId'
    | 'presentacionId'
    | 'unidadMedidaId'
    | null
  >(null)
  const [editingCategory, setEditingCategory] = useState<MasterCategoryRecord | null>(null)
  const [editingLaboratory, setEditingLaboratory] = useState<MasterLaboratoryRecord | null>(null)
  const [editingMedicationType, setEditingMedicationType] = useState<MasterMedicationTypeRecord | null>(null)
  const [editingActivePrinciple, setEditingActivePrinciple] = useState<MasterActivePrincipleRecord | null>(null)
  const [editingPresentation, setEditingPresentation] = useState<MasterPresentationRecord | null>(null)
  const [editingUnit, setEditingUnit] = useState<MasterUnitRecord | null>(null)

  const form = useForm<CreateProductFormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: defaultFormValues,
  })

  const watchedPackagingRows = form.watch('empaque')
  const detectedBasePresentationId = watchedPackagingRows.at(-1)?.presentacionId ?? ''
  const [packagingDraftRows, setPackagingDraftRows] = useState<PackagingFormRow[]>([])
  const draftBasePresentationId = packagingDraftRows.at(-1)?.presentacionId ?? ''
  const draftPurchasePresentationId =
    packagingDraftRows.find((entry) => entry.permiteCompra)?.presentacionId ?? ''
  const [isPackagingPreviewLoading, setIsPackagingPreviewLoading] = useState(false)
  const [packagingPreview, setPackagingPreview] =
    useState<ProductPackagingPreviewResponse['preview'] | null>(null)
  const [packagingPreviewError, setPackagingPreviewError] = useState<string | null>(null)

  useEffect(() => {
    const wasOpen = previousPackagingOpenRef.current
    previousPackagingOpenRef.current = isPackagingDialogOpen

    if (wasOpen && !isPackagingDialogOpen) {
      const scrollTop = createDialogScrollTopRef.current
      const container = createDialogContentRef.current
      if (!container) {
        return
      }

      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
          container.scrollTop = scrollTop
        })
        return
      }

      setTimeout(() => {
        container.scrollTop = scrollTop
      }, 0)
    }
  }, [isPackagingDialogOpen])

  const categoryForm = useForm<MasterCategoryFormValues>({
    resolver: zodResolver(masterCategorySchema),
    defaultValues: {
      nombre: '',
      descripcion: '',
      color: '',
      orden: 0,
      activo: true,
    },
  })

  const laboratoryForm = useForm<MasterLaboratoryFormValues>({
    resolver: zodResolver(masterLaboratorySchema),
    defaultValues: {
      nombre: '',
      pais: '',
      descripcion: '',
      activo: true,
    },
  })

  const medicationTypeForm = useForm<MasterMedicationTypeFormValues>({
    resolver: zodResolver(masterMedicationTypeSchema),
    defaultValues: {
      nombre: '',
      descripcion: '',
      activo: true,
    },
  })

  const activePrincipleForm = useForm<MasterActivePrincipleFormValues>({
    resolver: zodResolver(masterActivePrincipleSchema),
    defaultValues: {
      nombre: '',
      descripcion: '',
      activo: true,
    },
  })

  const presentationForm = useForm<MasterPresentationFormValues>({
    resolver: zodResolver(masterPresentationSchema),
    defaultValues: {
      nombre: '',
      descripcion: '',
      activo: true,
    },
  })

  const unitForm = useForm<MasterUnitFormValues>({
    resolver: zodResolver(masterUnitSchema),
    defaultValues: {
      nombre: '',
      simbolo: '',
      descripcion: '',
      activo: true,
    },
  })

  const canManageMasters =
    authorization.can('*') || authorization.hasAnyRole(['ADMIN', 'SUPERVISOR'])

  const handleUnauthorized = useHandleUnauthorized('ProductosPage')
  const handleUnauthorizedRef = useRef(handleUnauthorized)
  handleUnauthorizedRef.current = handleUnauthorized

  const loadOptions = useCallback(async () => {
    if (!accessToken) {
      return
    }

    setIsOptionsLoading(true)

    try {
      const nextOptions = await productsService.getOptions(accessToken)
      setOptions(nextOptions)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await handleUnauthorizedRef.current()
        return
      }
      toast.error(getApiErrorMessage(error))
    } finally {
      setIsOptionsLoading(false)
    }
  }, [accessToken])

  const loadProducts = useCallback(async () => {
    if (!accessToken) {
      return
    }

    setIsCatalogLoading(true)
    setCatalogError(null)

    try {
      const response = await productsService.list(accessToken, {
        search,
        status: statusFilter === 'TODOS' ? undefined : statusFilter,
        categoryId: categoryFilter === 'TODAS' ? undefined : categoryFilter,
        laboratoryId: laboratoryFilter === 'TODOS' ? undefined : laboratoryFilter,
        commercialTypeId: medicationTypeFilter === 'TODOS' ? undefined : medicationTypeFilter,
        activePrincipleId: activePrincipleFilter === 'TODOS' ? undefined : activePrincipleFilter,
        page,
        pageSize,
        sortBy,
        sortDir,
      })

      setProducts(response.items)
      setSummary(response.summary)
      setTotalItems(response.pagination.totalItems)
      setTotalPages(response.pagination.totalPages)

      if (
        sortBy !== response.sort.by ||
        sortDir !== response.sort.dir
      ) {
        setSortBy(response.sort.by)
        setSortDir(response.sort.dir)
      }

      if (page > response.pagination.totalPages) {
        setPage(response.pagination.totalPages)
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await handleUnauthorizedRef.current()
        return
      }
      setCatalogError(getApiErrorMessage(error))
    } finally {
      setIsCatalogLoading(false)
    }
  }, [
    accessToken,
    categoryFilter,
    laboratoryFilter,
    activePrincipleFilter,
    medicationTypeFilter,
    page,
    pageSize,
    search,
    sortBy,
    sortDir,
    statusFilter,
  ])

  useEffect(() => {
    void loadOptions()
  }, [loadOptions])

  useEffect(() => {
    setPage(1)
  }, [activePrincipleFilter, categoryFilter, laboratoryFilter, medicationTypeFilter, pageSize, search, sortBy, sortDir, statusFilter])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  const portfolioMetrics = useMemo(
    () => ({
      activeCatalog: summary.activeCatalog,
      lowStockCount: summary.lowStockCount,
      withPrescription: summary.withPrescription,
      lotEnabled: summary.lotEnabled,
    }),
    [summary],
  )

  const masterDataReady =
    options.categories.length > 0 && options.units.length > 0

  const presentationNameById = useMemo(
    () => new Map(options.presentations.map((presentation) => [presentation.id, presentation.name])),
    [options.presentations],
  )

  const _loadPracticalPackagingExample = useCallback(() => {
    const normalize = (name: string) =>
      name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()

    const byNormalized = new Map(options.presentations.map((p) => [normalize(p.name), p]))

    const findPresentation = (patterns: string[]) => {
      for (const pattern of patterns) {
        const p = byNormalized.get(pattern)
        if (p) return p
      }
      const needle = patterns[0]
      return options.presentations.find((p) => normalize(p.name).includes(needle)) ?? null
    }

    const caja = findPresentation(['caja'])
    const blister = findPresentation(['blister', 'blister pack', 'blist'])
    const capsulas = findPresentation(['capsulas', 'capsula', 'capsul'])

    if (!caja || !blister || !capsulas) {
      return null
    }

    const rows: PackagingFormRow[] = [
      {
        presentacionId: caja.id,
        permiteCompra: true,
        permiteVenta: true,
        precioVenta: 120,
        cantidadEquivalencia: 10,
      },
      {
        presentacionId: blister.id,
        permiteCompra: false,
        permiteVenta: true,
        precioVenta: 12,
        cantidadEquivalencia: 12,
      },
      {
        presentacionId: capsulas.id,
        permiteCompra: false,
        permiteVenta: true,
        precioVenta: 1,
        cantidadEquivalencia: undefined,
      },
    ]

    setPackagingDraftRows(rows)
    return rows
  }, [options.presentations])
  void _loadPracticalPackagingExample

  const syncPackagingInputValues = useCallback(
    (rows: PackagingFormRow[]) => {
      const defaults = packagingInputDefaults.current
      const refs = packagingInputRefs.current
      const expectedKeys: string[] = []
      rows.forEach((row, index) => {
        const key = `${row.presentacionId || 'row'}-${index}`
        expectedKeys.push(key)
        const cantidad = typeof row.cantidadEquivalencia === 'number' ? row.cantidadEquivalencia.toString() : ''
        const precio = typeof row.precioVenta === 'number' ? row.precioVenta.toString() : ''
        const prev = defaults[key]
        if (!prev || prev.cantidad !== cantidad || prev.precio !== precio) {
          defaults[key] = { cantidad, precio, mountKey: (prev?.mountKey ?? 0) + 1 }
        }
        if (refs[key]) {
          if (refs[key]?.cantidad && refs[key]!.cantidad!.value !== cantidad) refs[key]!.cantidad!.value = cantidad
          if (refs[key]?.precio && refs[key]!.precio!.value !== precio) refs[key]!.precio!.value = precio
        }
      })
      Object.keys(defaults).forEach((key) => {
        if (!expectedKeys.includes(key)) {
          delete defaults[key]
          delete refs[key]
        }
      })
    },
    [],
  )

  const flushPackagingInputValues = useCallback(
    (rows: PackagingFormRow[]): PackagingFormRow[] => {
      return rows.map((row, index) => {
        const key = `${row.presentacionId || 'row'}-${index}`
        const ref = packagingInputRefs.current[key]
        let cantidadStr =
          typeof row.cantidadEquivalencia === 'number' ? row.cantidadEquivalencia.toString() : ''
        let precioStr = typeof row.precioVenta === 'number' ? row.precioVenta.toString() : ''
        if (ref?.cantidad && document.activeElement !== ref.cantidad) {
          cantidadStr = ref.cantidad.value
        } else if (ref?.cantidad) {
          cantidadStr = ref.cantidad.value
        }
        if (ref?.precio && document.activeElement !== ref.precio) {
          precioStr = ref.precio.value
        } else if (ref?.precio) {
          precioStr = ref.precio.value
        }
        const cleanCant = cantidadStr.replace(/[^0-9]/g, '')
        const cantidad = cleanCant === '' ? undefined : Math.trunc(Number(cleanCant))
        const raw = precioStr.replace(/[^0-9.]/g, '')
        const parts = raw.split('.')
        const cleanPrecio = parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('').slice(0, 2) : '')
        const precio = cleanPrecio === '' || cleanPrecio === '.' ? undefined : Number(cleanPrecio)
        if (cantidad === row.cantidadEquivalencia && precio === row.precioVenta) {
          return row
        }
        return { ...row, cantidadEquivalencia: cantidad, precioVenta: precio }
      })
    },
    [],
  )

  const categoryLeafOptions = useMemo(() => {
    const byId = new Map(options.categories.map((category) => [category.id, category]))
    const cache = new Map<string, string>()

    const resolvePath = (id: string) => {
      const cached = cache.get(id)
      if (cached) return cached

      const parts: string[] = []
      const visited = new Set<string>()
      let currentId: string | null = id

      while (currentId) {
        if (visited.has(currentId)) break
        visited.add(currentId)
        const current = byId.get(currentId)
        if (!current) break
        parts.unshift(current.name)
        currentId = current.parentId
      }

      const label = parts.join(' > ')
      cache.set(id, label)
      return label
    }

    return options.categories
      .filter((category) => category.childCount === 0)
      .map((category) => ({
        id: category.id,
        label: resolvePath(category.id),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'))
  }, [options.categories])

  const getPresentationLabel = useCallback(
    (presentationId?: string | null) => {
      if (!presentationId) {
        return 'Sin definir'
      }

      return presentationNameById.get(presentationId) ?? presentationId
    },
    [presentationNameById],
  )

  const getNextPackagingPresentationId = useCallback((rows: PackagingFormRow[] = form.getValues('empaque')) => {
    const usedIds = new Set(
      rows.map((entry) => entry.presentacionId).filter(Boolean),
    )

    return (
      options.presentations.find((presentation) => !usedIds.has(presentation.id))?.id ??
      options.presentations[0]?.id ??
      ''
    )
  }, [form, options.presentations])

  const canAddNextPackagingStep =
    packagingDraftRows.length === 0 ||
    Boolean(packagingDraftRows.at(-1)?.presentacionId)

  const packagingDraftIssues = useMemo(() => {
    if (packagingDraftRows.length === 0) {
      return []
    }

    const issues: string[] = []
    const selectedPresentationIds = packagingDraftRows
      .map((entry) => entry.presentacionId)
      .filter(Boolean)

    if (new Set(selectedPresentationIds).size !== selectedPresentationIds.length) {
      issues.push('Cada paso debe usar una presentación distinta.')
    }

    if (!packagingDraftRows[0]?.presentacionId) {
      issues.push('Empieza seleccionando la presentación más grande o principal en el Paso 1.')
    }

    const purchaseIndex = packagingDraftRows.findIndex((entry) => entry.permiteCompra)
    if (purchaseIndex > 0) {
      issues.push('La presentación de compra debe registrarse al inicio de la cadena.')
    }

    packagingDraftRows.forEach((row, index) => {
      const isLastStep = index === packagingDraftRows.length - 1

      if (!row.presentacionId) {
        issues.push(`Completa la presentación del Paso ${index + 1} antes de continuar.`)
      }

      if (!isLastStep && typeof row.cantidadEquivalencia !== 'number') {
        issues.push(
          `Indica cuántas unidades contiene la presentación del Paso ${index + 1} antes de agregar la siguiente.`,
        )
      }
    })

    return Array.from(new Set(issues))
  }, [packagingDraftRows])

  const packagingChainPreview = useMemo(
    () => buildPackagingChainPreview(packagingDraftRows, getPresentationLabel),
    [getPresentationLabel, packagingDraftRows],
  )

  const packagingSummary = useMemo(
    () => buildPackagingSummary(packagingDraftRows, getPresentationLabel),
    [getPresentationLabel, packagingDraftRows],
  )

  useEffect(() => {
    if (!isPackagingDialogOpen) {
      packagingInputRefs.current = {}
      packagingInputDefaults.current = {}
    }
  }, [isPackagingDialogOpen])

  useEffect(() => {
    if (!isPackagingDialogOpen || !accessToken) {
      return
    }

    const hasRows = packagingDraftRows.length > 0
    const hasIdentifiers = packagingDraftRows.every((entry) => Boolean(entry.presentacionId))

    if (!hasRows || !hasIdentifiers) {
      setPackagingPreview(null)
      setPackagingPreviewError(null)
      setIsPackagingPreviewLoading(false)
      return
    }

    const timeoutId = window.setTimeout(async () => {
      setIsPackagingPreviewLoading(true)
      setPackagingPreviewError(null)

      try {
        const response = await productsService.previewPackaging(
          accessToken,
          buildPackagingPreviewPayloadFromRows(packagingDraftRows),
        )
        setPackagingPreview(response.preview)
      } catch (error) {
        setPackagingPreview(null)
        setPackagingPreviewError(getApiErrorMessage(error))
      } finally {
        setIsPackagingPreviewLoading(false)
      }
    }, 250)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    accessToken,
    isPackagingDialogOpen,
    packagingDraftRows,
  ])

  const resetMasterDialogState = useCallback(() => {
    setMasterDialogOpen(false)
    setMasterDialogTargetField(null)
    setMasterDialogMode('create')
    setEditingCategory(null)
    setEditingLaboratory(null)
    setEditingMedicationType(null)
    setEditingActivePrinciple(null)
    setEditingPresentation(null)
    setEditingUnit(null)
    categoryForm.reset()
    laboratoryForm.reset()
    medicationTypeForm.reset()
    activePrincipleForm.reset()
    presentationForm.reset()
    unitForm.reset()
  }, [activePrincipleForm, categoryForm, laboratoryForm, medicationTypeForm, presentationForm, unitForm])

  const openCreateMaster = useCallback(
    (
      type: 'categoria' | 'laboratorio' | 'tipoMedicamento' | 'principioActivo' | 'presentacion' | 'unidad',
      targetField:
        | 'categoriaId'
        | 'laboratorioId'
        | 'tipoMedicamentoId'
        | 'principioActivoId'
        | 'presentacionId'
        | 'unidadMedidaId'
        | null = null,
    ) => {
      setMasterDialogType(type)
      setMasterDialogMode('create')
      setMasterDialogTargetField(targetField)
      setEditingCategory(null)
      setEditingLaboratory(null)
      setEditingMedicationType(null)
      setEditingActivePrinciple(null)
      setEditingPresentation(null)
      setEditingUnit(null)
      categoryForm.reset({
        nombre: '',
        descripcion: '',
        color: '',
        orden: 0,
        activo: true,
      })
      laboratoryForm.reset({
        nombre: '',
        pais: '',
        descripcion: '',
        activo: true,
      })
      medicationTypeForm.reset({
        nombre: '',
        descripcion: '',
        activo: true,
      })
      activePrincipleForm.reset({
        nombre: '',
        descripcion: '',
        activo: true,
      })
      presentationForm.reset({
        nombre: '',
        descripcion: '',
        activo: true,
      })
      unitForm.reset({
        nombre: '',
        simbolo: '',
        descripcion: '',
        activo: true,
      })
      setMasterDialogOpen(true)
    },
    [activePrincipleForm, categoryForm, laboratoryForm, medicationTypeForm, presentationForm, unitForm],
  )

  const handleSaveMasterCategory = useCallback(
    async (values: MasterCategoryFormValues) => {
      if (!accessToken) {
        toast.error('La sesión no está disponible.')
        return
      }

      const payload: UpsertMasterCategoryPayload = {
        nombre: values.nombre.trim(),
        descripcion: values.descripcion?.trim() || undefined,
        color: values.color?.trim() || undefined,
        orden: typeof values.orden === 'number' ? values.orden : undefined,
        activo: values.activo,
      }

      setIsMasterSubmitting(true)
      try {
        if (masterDialogMode === 'edit' && editingCategory) {
          await productsService.updateMasterCategory(accessToken, editingCategory.id, payload)
          toast.success('Categoría actualizada.')
        } else {
          const created = await productsService.createMasterCategory(accessToken, payload)
          toast.success('Categoría creada.')
          if (masterDialogTargetField === 'categoriaId') {
            form.setValue('categoriaId', created.id, { shouldValidate: true })
          }
        }

        resetMasterDialogState()
        await loadOptions()
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await handleUnauthorized()
          return
        }
        toast.error(getApiErrorMessage(error))
      } finally {
        setIsMasterSubmitting(false)
      }
    },
    [
      accessToken,
      editingCategory,
      form,
      handleUnauthorized,
      loadOptions,
      masterDialogMode,
      masterDialogTargetField,
      resetMasterDialogState,
    ],
  )

  const handleSaveMasterLaboratory = useCallback(
    async (values: MasterLaboratoryFormValues) => {
      if (!accessToken) {
        toast.error('La sesión no está disponible.')
        return
      }

      const payload: UpsertMasterLaboratoryPayload = {
        nombre: values.nombre.trim(),
        pais: values.pais?.trim() || undefined,
        descripcion: values.descripcion?.trim() || undefined,
        activo: values.activo,
      }

      setIsMasterSubmitting(true)
      try {
        if (masterDialogMode === 'edit' && editingLaboratory) {
          await productsService.updateMasterLaboratory(accessToken, editingLaboratory.id, payload)
          toast.success('Laboratorio actualizado.')
        } else {
          const created = await productsService.createMasterLaboratory(accessToken, payload)
          toast.success('Laboratorio creado.')
          if (masterDialogTargetField === 'laboratorioId') {
            form.setValue('laboratorioId', created.id)
          }
        }

        resetMasterDialogState()
        await loadOptions()
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await handleUnauthorized()
          return
        }
        toast.error(getApiErrorMessage(error))
      } finally {
        setIsMasterSubmitting(false)
      }
    },
    [
      accessToken,
      editingLaboratory,
      form,
      handleUnauthorized,
      loadOptions,
      masterDialogMode,
      masterDialogTargetField,
      resetMasterDialogState,
    ],
  )

  const handleSaveMasterMedicationType = useCallback(
    async (values: MasterMedicationTypeFormValues) => {
      if (!accessToken) {
        toast.error('La sesión no está disponible.')
        return
      }

      const payload: UpsertMasterMedicationTypePayload = {
        nombre: values.nombre.trim(),
        descripcion: values.descripcion?.trim() || undefined,
        activo: values.activo,
      }

      setIsMasterSubmitting(true)
      try {
        if (masterDialogMode === 'edit' && editingMedicationType) {
          await productsService.updateMasterMedicationType(
            accessToken,
            editingMedicationType.id,
            payload,
          )
          toast.success('Tipo comercial actualizado.')
        } else {
          const created = await productsService.createMasterMedicationType(accessToken, payload)
          toast.success('Tipo comercial creado.')
          if (masterDialogTargetField === 'tipoMedicamentoId') {
            form.setValue('tipoMedicamentoId', created.id, { shouldValidate: true })
          }
        }

        resetMasterDialogState()
        await loadOptions()
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await handleUnauthorized()
          return
        }
        toast.error(getApiErrorMessage(error))
      } finally {
        setIsMasterSubmitting(false)
      }
    },
    [
      accessToken,
      editingMedicationType,
      form,
      handleUnauthorized,
      loadOptions,
      masterDialogMode,
      masterDialogTargetField,
      resetMasterDialogState,
    ],
  )

  const handleSaveMasterPresentation = useCallback(
    async (values: MasterPresentationFormValues) => {
      if (!accessToken) {
        toast.error('La sesión no está disponible.')
        return
      }

      const payload: UpsertMasterPresentationPayload = {
        nombre: values.nombre.trim(),
        descripcion: values.descripcion?.trim() || undefined,
        activo: values.activo,
      }

      setIsMasterSubmitting(true)
      try {
        if (masterDialogMode === 'edit' && editingPresentation) {
          await productsService.updateMasterPresentation(accessToken, editingPresentation.id, payload)
          toast.success('Presentación actualizada.')
        } else {
          await productsService.createMasterPresentation(accessToken, payload)
          toast.success('Presentación creada.')
        }

        resetMasterDialogState()
        await loadOptions()
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await handleUnauthorized()
          return
        }
        toast.error(getApiErrorMessage(error))
      } finally {
        setIsMasterSubmitting(false)
      }
    },
    [
      accessToken,
      editingPresentation,
      form,
      handleUnauthorized,
      loadOptions,
      masterDialogMode,
      masterDialogTargetField,
      resetMasterDialogState,
    ],
  )

  const handleSaveMasterActivePrinciple = useCallback(
    async (values: MasterActivePrincipleFormValues) => {
      if (!accessToken) {
        toast.error('La sesión no está disponible.')
        return
      }

      const payload: UpsertMasterActivePrinciplePayload = {
        nombre: values.nombre.trim(),
        descripcion: values.descripcion?.trim() || undefined,
        activo: values.activo,
      }

      setIsMasterSubmitting(true)
      try {
        if (masterDialogMode === 'edit' && editingActivePrinciple) {
          await productsService.updateMasterActivePrinciple(accessToken, editingActivePrinciple.id, payload)
          toast.success('Principio activo actualizado.')
        } else {
          const created = await productsService.createMasterActivePrinciple(accessToken, payload)
          toast.success('Principio activo creado.')
          if (masterDialogTargetField === 'principioActivoId') {
            form.setValue('principioActivoId', created.id, { shouldValidate: true })
          }
        }

        resetMasterDialogState()
        await loadOptions()
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await handleUnauthorized()
          return
        }
        toast.error(getApiErrorMessage(error))
      } finally {
        setIsMasterSubmitting(false)
      }
    },
    [
      accessToken,
      editingActivePrinciple,
      form,
      handleUnauthorized,
      loadOptions,
      masterDialogMode,
      masterDialogTargetField,
      resetMasterDialogState,
    ],
  )

  const handleSaveMasterUnit = useCallback(
    async (values: MasterUnitFormValues) => {
      if (!accessToken) {
        toast.error('La sesión no está disponible.')
        return
      }

      const payload: UpsertMasterUnitPayload = {
        nombre: values.nombre.trim(),
        simbolo: values.simbolo.trim(),
        descripcion: values.descripcion?.trim() || undefined,
        activo: values.activo,
      }

      setIsMasterSubmitting(true)
      try {
        if (masterDialogMode === 'edit' && editingUnit) {
          await productsService.updateMasterUnit(accessToken, editingUnit.id, payload)
          toast.success('Unidad actualizada.')
        } else {
          const created = await productsService.createMasterUnit(accessToken, payload)
          toast.success('Unidad creada.')
          if (masterDialogTargetField === 'unidadMedidaId') {
            form.setValue('unidadMedidaId', created.id, { shouldValidate: true })
          }
        }

        resetMasterDialogState()
        await loadOptions()
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await handleUnauthorized()
          return
        }
        toast.error(getApiErrorMessage(error))
      } finally {
        setIsMasterSubmitting(false)
      }
    },
    [
      accessToken,
      editingUnit,
      form,
      handleUnauthorized,
      loadOptions,
      masterDialogMode,
      masterDialogTargetField,
      resetMasterDialogState,
    ],
  )

  function mapProductToFormValues(product: ProductCatalogItem): CreateProductFormValues {
    return {
      categoriaId: product.categoryId,
      laboratorioId: product.laboratoryId ?? '',
      tipoMedicamentoId: product.commercialTypeId ?? product.medicationTypeId ?? '',
      unidadMedidaId: product.unitId,
      empaque: buildPackagingRowsFromProduct(product),
      principioActivoId: product.activePrincipleId ?? product.activePrinciples[0]?.id ?? '',
      sku: product.sku,
      codigoBarras: product.barcode ?? '',
      nombre: product.name,
      descripcion: product.description ?? '',
      concentracion: product.concentration ?? '',
      registroSanitario: product.sanitaryRegistration ?? '',
      requiereReceta: product.requiresPrescription,
      esControlado: product.isControlled,
    }
  }

  function openCreateDialog() {
    setEditingProduct(null)
    form.reset({ ...defaultFormValues, sku: buildSkuSuggestion() })
    setIsCreateDialogOpen(true)
  }

  function openEditDialog(product: ProductCatalogItem) {
    setEditingProduct(product)
    const nextValues = mapProductToFormValues(product)
    setPackagingDraftRows(nextValues.empaque.length > 0 ? nextValues.empaque : [])
    syncPackagingInputValues(nextValues.empaque)
    form.reset(nextValues)
    setIsCreateDialogOpen(true)
  }

  function openDuplicateDialog(product: ProductCatalogItem) {
    const nextSkuBase = `${product.sku}-COPIA`
    const nextSku = nextSkuBase.length > 50 ? nextSkuBase.slice(0, 50) : nextSkuBase
    const nextValues = mapProductToFormValues(product)
    nextValues.sku = nextSku
    nextValues.codigoBarras = ''
    setEditingProduct(null)
    setPackagingDraftRows(nextValues.empaque.length > 0 ? nextValues.empaque : [])
    syncPackagingInputValues(nextValues.empaque)
    form.reset(nextValues)
    setIsCreateDialogOpen(true)
  }

  function openDetailDialog(product: ProductCatalogItem) {
    setSelectedProductDetail(product)
    setIsDetailDialogOpen(true)
  }

  const handleSkuBlur = useCallback(
    async (value: string) => {
      const normalized = value.trim()
      if (!accessToken) return
      if (!normalized) return

      try {
        const response = await productsService.list(accessToken, {
          search: normalized,
          page: 1,
          pageSize: 10,
        })
        const existing =
          response.items.find((item) => item.sku.toLowerCase() === normalized.toLowerCase()) ??
          null

        if (existing && existing.id !== editingProduct?.id) {
          form.setError('sku', { type: 'validate', message: 'Este SKU ya existe.' })
        } else {
          form.clearErrors('sku')
        }
      } catch {
        form.clearErrors('sku')
      }
    },
    [accessToken, editingProduct?.id, form],
  )

  function requestConfirm(type: 'activate' | 'deactivate' | 'delete', product: ProductCatalogItem) {
    setConfirmAction({ type, product })
    setIsConfirmDialogOpen(true)
  }

  async function handleConfirmAction() {
    if (!accessToken) {
      toast.error('La sesión no está disponible.')
      return
    }

    if (!confirmAction) {
      return
    }

    setIsConfirming(true)

    try {
      if (confirmAction.type === 'delete') {
        await productsService.delete(accessToken, confirmAction.product.id)
        toast.success('Producto eliminado.')
      } else {
        const nextStatus = confirmAction.type === 'activate' ? 'ACTIVO' : 'INACTIVO'
        await productsService.updateStatus(accessToken, confirmAction.product.id, nextStatus)
        toast.success(nextStatus === 'ACTIVO' ? 'Producto activado.' : 'Producto desactivado.')
      }

      setIsConfirmDialogOpen(false)
      setConfirmAction(null)
      await loadProducts()
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await handleUnauthorized()
        return
      }
      toast.error(getApiErrorMessage(error))
    } finally {
      setIsConfirming(false)
    }
  }

  async function handleCreateProduct(values: CreateProductFormValues) {
    if (!accessToken) {
      toast.error('La sesión no está disponible.')
      return
    }

    const editingId = editingProduct?.id ?? null
    const packagingPayload = buildPackagingPayload(values)

    const payload: CreateProductPayload | UpdateProductPayload = {
      categoriaId: values.categoriaId,
      laboratorioId: values.laboratorioId || undefined,
      tipoComercialId: values.tipoMedicamentoId,
      unidadMedidaId: values.unidadMedidaId,
      cadenaEmpaque: packagingPayload.cadenaEmpaque,
      principioActivoId: values.principioActivoId,
      principioActivoIds: values.principioActivoId ? [values.principioActivoId] : undefined,
      sku: values.sku.trim(),
      codigoBarras: values.codigoBarras?.trim() || undefined,
      nombre: values.nombre.trim(),
      descripcion: values.descripcion?.trim() || undefined,
      concentracion: values.concentracion?.trim() || undefined,
      registroSanitario: values.registroSanitario?.trim() || undefined,
      requiereReceta: values.requiereReceta,
      esControlado: values.esControlado,
    }

    setIsSubmitting(true)

    try {
      if (editingId) {
        await productsService.update(accessToken, editingId, payload)
        toast.success('Producto actualizado correctamente.')
      } else {
        await productsService.create(accessToken, payload)
        toast.success('Producto registrado correctamente.')
      }
      setIsCreateDialogOpen(false)
      setEditingProduct(null)
      form.reset(defaultFormValues)
      await Promise.all([loadProducts(), loadOptions()])
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await handleUnauthorizedRef.current(error.status, error.message, 'products.createOrUpdate')
        return
      }

      toast.error(getApiErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleCreateProductInvalid(errors: typeof form.formState.errors) {
    const message = getFirstFormErrorMessage(errors) ?? 'Revisa los campos obligatorios antes de guardar.'
    toast.error(message)
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header with Title and Summary Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-foreground">Productos</h1>
        <Button variant="ghost" size="sm" onClick={() => setShowSummary(!showSummary)}>
          Resumen
          <ChevronDown
            className={`ml-1 h-4 w-4 transition-transform ${
              showSummary ? 'rotate-180' : ''
            }`}
          />
        </Button>
      </div>

      {/* KPIs Section (Collapsible on Mobile) */}
      {showSummary && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <PackagePlus className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{portfolioMetrics.activeCatalog}</span>
              <span className="text-xs text-muted-foreground">SKU</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{portfolioMetrics.lowStockCount}</span>
              <span className="text-xs text-muted-foreground">Bajo stock</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <Pill className="h-4 w-4 text-primary" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{portfolioMetrics.withPrescription}</span>
              <span className="text-xs text-muted-foreground">Con receta</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <TestTubeDiagonal className="h-4 w-4 text-info" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground">{portfolioMetrics.lotEnabled}</span>
              <span className="text-xs text-muted-foreground">Con lotes</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs, Filters, and New Product Button */}
      <Tabs
        value={mainTab}
        onValueChange={(value) => setMainTab(value as 'catalogo' | 'maestros')}
        className="w-full"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
            <TabsTrigger value="maestros">Maestros</TabsTrigger>
          </TabsList>
          <Button size="sm" onClick={openCreateDialog} disabled={!masterDataReady || isOptionsLoading}>
            <Plus className="h-4 w-4 mr-1" />
            Nuevo Producto
          </Button>
        </div>

        <TabsContent value="catalogo" className="space-y-4 pt-4">
          <Card className="p-4">
            <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-9">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por SKU, nombre, código o principio activo"
                    className="pl-9"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'TODOS' | ProductStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  <SelectItem value="ACTIVO">Activo</SelectItem>
                  <SelectItem value="INACTIVO">Inactivo</SelectItem>
                  <SelectItem value="DESCONTINUADO">Descontinuado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas</SelectItem>
                  {categoryLeafOptions.map((category) => (
                    <SelectItem key={category.id} value={category.id}>{category.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={laboratoryFilter} onValueChange={setLaboratoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Laboratorio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  {options.laboratories.map((lab) => (
                    <SelectItem key={lab.id} value={lab.id}>{lab.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={medicationTypeFilter} onValueChange={setMedicationTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo comercial" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  {options.commercialTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={activePrincipleFilter} onValueChange={setActivePrincipleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Principio activo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  {options.activePrinciples.map((principle) => (
                    <SelectItem key={principle.id} value={principle.id}>
                      {principle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={`${sortBy}:${sortDir}`}
                onValueChange={(value) => {
                  const [by, dir] = value.split(':')
                  setSortBy(by as 'name' | 'stockUnits' | 'createdAt')
                  setSortDir(dir as 'asc' | 'desc')
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Orden" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name:asc">Nombre (A → Z)</SelectItem>
                  <SelectItem value="name:desc">Nombre (Z → A)</SelectItem>
                  <SelectItem value="stockUnits:desc">Stock (Mayor → Menor)</SelectItem>
                  <SelectItem value="stockUnits:asc">Stock (Menor → Mayor)</SelectItem>
                  <SelectItem value="createdAt:desc">Fecha registro (Recientes)</SelectItem>
                  <SelectItem value="createdAt:asc">Fecha registro (Antiguos)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Por página" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / página</SelectItem>
                  <SelectItem value="20">20 / página</SelectItem>
                  <SelectItem value="50">50 / página</SelectItem>
                  <SelectItem value="100">100 / página</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3">
            {isCatalogLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="h-7 w-7" />
              </div>
            ) : catalogError ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                {catalogError}
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="text-sm font-medium text-foreground">
                  No se encontraron productos
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ajusta los filtros o registra el primer producto
                </p>
              </div>
            ) : (
              products.map((product) => (
                <Card key={product.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-14 w-14 rounded-lg border bg-muted flex items-center justify-center text-2xl">
                      📦
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {product.sku}
                            {(product.commercialType ?? product.medicationType)
                              ? ` · ${product.commercialType ?? product.medicationType}`
                              : ''}
                            {product.activePrinciple ? ` · ${product.activePrinciple}` : ''}
                            {product.presentation ? ` · ${product.presentation}` : ''}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetailDialog(product)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver detalle
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(product)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            {product.status === 'ACTIVO' ? (
                              <>
                                <DropdownMenuItem onClick={() => openDuplicateDialog(product)}>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Duplicar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => requestConfirm('deactivate', product)}>
                                  <Power className="h-4 w-4 mr-2" />
                                  Desactivar
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <>
                                <DropdownMenuItem onClick={() => requestConfirm('activate', product)}>
                                  <Power className="h-4 w-4 mr-2" />
                                  Activar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openDuplicateDialog(product)}>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Duplicar
                                </DropdownMenuItem>
                                {product.status === 'INACTIVO' ? (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      disabled={!product.canDelete}
                                      onClick={() => requestConfirm('delete', product)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Eliminar
                                    </DropdownMenuItem>
                                  </>
                                ) : null}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 items-center">
                        <Badge variant={getStockVariant(product)}>
                          {product.stockUnits.toFixed(0)} {product.unitSymbol}
                        </Badge>
                        <p className="font-medium text-sm text-foreground">{formatCurrency(product.salePrice)}</p>
                        <Badge variant={getProductStatusVariant(product.status)}>
                          {product.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Desktop/Tablet Table View */}
          <div className="hidden md:block">
            {isCatalogLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="h-7 w-7" />
              </div>
            ) : catalogError ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                {catalogError}
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="text-sm font-medium text-foreground">
                  No se encontraron productos con los filtros actuales
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ajusta los filtros o registra el primer SKU del catálogo
                </p>
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[300px]">Producto</TableHead>
                        <TableHead className="hidden lg:table-cell">Categoría</TableHead>
                        <TableHead className="hidden md:table-cell">Precio</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead className="hidden lg:table-cell">Lotes</TableHead>
                        <TableHead className="hidden xl:table-cell">Vencimiento</TableHead>
                        <TableHead className="w-[80px] text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg border bg-muted flex items-center justify-center text-lg">
                                📦
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-foreground truncate">{product.name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {product.sku}
                                  {(product.commercialType ?? product.medicationType)
                                    ? ` · ${product.commercialType ?? product.medicationType}`
                                    : ''}
                                  {product.activePrinciple ? ` · ${product.activePrinciple}` : ''}
                                  {product.presentation ? ` · ${product.presentation}` : ''}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Badge variant="outline">{product.category}</Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <p className="font-medium text-sm">{formatCurrency(product.salePrice)}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStockVariant(product)}>
                              {product.stockUnits.toFixed(0)} {product.unitSymbol}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Badge variant={product.lotCount > 0 ? 'info' : 'outline'}>
                              {product.lotCount}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                            {formatDate(product.nextExpiry)}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openDetailDialog(product)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver detalle
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEditDialog(product)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                {product.status === 'ACTIVO' ? (
                                  <>
                                    <DropdownMenuItem onClick={() => openDuplicateDialog(product)}>
                                      <Copy className="h-4 w-4 mr-2" />
                                      Duplicar
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => requestConfirm('deactivate', product)}>
                                      <Power className="h-4 w-4 mr-2" />
                                      Desactivar
                                    </DropdownMenuItem>
                                  </>
                                ) : (
                                  <>
                                    <DropdownMenuItem onClick={() => requestConfirm('activate', product)}>
                                      <Power className="h-4 w-4 mr-2" />
                                      Activar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openDuplicateDialog(product)}>
                                      <Copy className="h-4 w-4 mr-2" />
                                      Duplicar
                                    </DropdownMenuItem>
                                    {product.status === 'INACTIVO' ? (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-destructive"
                                          disabled={!product.canDelete}
                                          onClick={() => requestConfirm('delete', product)}
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Eliminar
                                        </DropdownMenuItem>
                                      </>
                                    ) : null}
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>

          {!isCatalogLoading && !catalogError && totalItems > 0 ? (
            <Card>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Página {page} de {totalPages} · {totalItems.toLocaleString('es-PE')} registros
                </p>
                {totalPages > 1 ? (
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setPage(Math.max(1, page - 1))}
                          disabled={page <= 1}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink isActive>{page}</PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setPage(Math.min(totalPages, page + 1))}
                          disabled={page >= totalPages}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="maestros" className="space-y-4 pt-4">
          <ProductMastersCenter
            accessToken={accessToken}
            onMastersChanged={loadOptions}
            canManageMasters={canManageMasters}
          />
        </TabsContent>
      </Tabs>

      {isCreateDialogOpen ? (
        <SidePanel
          open={isCreateDialogOpen}
          onOpenChange={(open) => {
            if (!open && (isPackagingDialogOpen || isPackagingGuideOpen)) {
              return
            }
            setIsCreateDialogOpen(open)
            if (!open) {
              setEditingProduct(null)
              form.reset(defaultFormValues)
            }
          }}
        >
          <SidePanelContent className="p-0">
            <form className="flex h-full flex-col" onSubmit={form.handleSubmit(handleCreateProduct, handleCreateProductInvalid)}>
              <div className="flex items-start justify-between gap-4 border-b bg-popover px-6 py-4">
                <div className="space-y-1">
                  <p className="text-base font-semibold text-foreground">
                    {editingProduct ? 'Editar producto' : 'Registrar producto'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {editingProduct ? 'Actualiza el maestro farmacéutico' : 'Alta inicial del maestro farmacéutico'}
                  </p>
                </div>
                <SidePanelClose asChild>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Cerrar</span>
                  </Button>
                </SidePanelClose>
              </div>

            <div
              ref={createDialogContentRef}
              className={`flex-1 px-6 py-4 ${isPackagingDialogOpen ? 'overflow-hidden' : 'overflow-y-auto'}`}
            >
              <div className="grid gap-4">
                <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">SKU</label>
                <Input
                  {...form.register('sku', {
                    onBlur: (event) => {
                      void handleSkuBlur(event.target.value)
                    },
                  })}
                  placeholder="MED-0001"
                  size={1}
                />
                <FieldError message={form.formState.errors.sku?.message} />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-medium">Nombre comercial</label>
                <Input {...form.register('nombre')} placeholder="Paracetamol 500 mg tabletas" />
                <FieldError message={form.formState.errors.nombre?.message} />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium">Categoría</label>
                  {canManageMasters ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => openCreateMaster('categoria', 'categoriaId')}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                <Controller
                  control={form.control}
                  name="categoriaId"
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona categoría" />
                      </SelectTrigger>
                      <SelectContent>
                      {categoryLeafOptions.map((category) => (
                        <SelectItem key={category.id} value={category.id}>{category.label}</SelectItem>
                      ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={form.formState.errors.categoriaId?.message} />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium">Laboratorio</label>
                  {canManageMasters ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => openCreateMaster('laboratorio', 'laboratorioId')}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                <Controller
                  control={form.control}
                  name="laboratorioId"
                  render={({ field }) => (
                    <Select
                      value={field.value || 'none'}
                      onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Opcional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin laboratorio</SelectItem>
                        {options.laboratories.map((laboratory) => (
                          <SelectItem key={laboratory.id} value={laboratory.id}>{laboratory.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium">Unidad de medida</label>
                  {canManageMasters ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => openCreateMaster('unidad', 'unidadMedidaId')}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                <Controller
                  control={form.control}
                  name="unidadMedidaId"
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona unidad" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.units.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name} ({unit.symbol})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={form.formState.errors.unidadMedidaId?.message} />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium">Tipo comercial</label>
                  {canManageMasters ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => openCreateMaster('tipoMedicamento', 'tipoMedicamentoId')}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                <Controller
                  control={form.control}
                  name="tipoMedicamentoId"
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.commercialTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={form.formState.errors.tipoMedicamentoId?.message} />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium">Principio activo</label>
                  {canManageMasters ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => openCreateMaster('principioActivo', 'principioActivoId')}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                <Controller
                  control={form.control}
                  name="principioActivoId"
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona principio activo" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.activePrinciples.map((activePrinciple) => (
                          <SelectItem key={activePrinciple.id} value={activePrinciple.id}>
                            {activePrinciple.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={form.formState.errors.principioActivoId?.message} />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-medium">Empaque y conversión</label>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between gap-3"
                  onClick={() => {
                    createDialogScrollTopRef.current = createDialogContentRef.current?.scrollTop ?? 0
                    const currentRows = form.getValues('empaque')
                    const initialRows =
                      currentRows.length > 0
                        ? currentRows
                        : options.presentations.length > 0
                          ? [
                              {
                                ...createEmptyPackagingRow(
                                  getNextPackagingPresentationId(currentRows),
                                ),
                                permiteCompra: true,
                                permiteVenta: true,
                              },
                            ]
                          : []

                    setPackagingDraftRows(initialRows)
                    syncPackagingInputValues(initialRows)
                    setPackagingPreviewError(null)
                    setIsPackagingDialogOpen(true)
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Configurar empaque
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {`${watchedPackagingRows.length} nivel(es) · base ${getPresentationLabel(
                      detectedBasePresentationId,
                    )}`}
                  </span>
                </Button>
              </div>
            </div>

            <div className="grid gap-3 rounded-xl border p-3 md:grid-cols-2">
              <Controller
                control={form.control}
                name="requiereReceta"
                render={({ field }) => (
                  <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Requiere receta</p>
                    </div>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </label>
                )}
              />

              <Controller
                control={form.control}
                name="esControlado"
                render={({ field }) => (
                  <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Producto controlado</p>
                    </div>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </label>
                )}
              />
            </div>
              </div>
            </div>

            <div className="border-t bg-popover px-6 py-4">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false)
                    setEditingProduct(null)
                    form.reset(defaultFormValues)
                  }}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar producto'
                  )}
                </Button>
              </div>
            </div>
          </form>
          </SidePanelContent>
        </SidePanel>
      ) : null}

      {isPackagingDialogOpen ? (
        <Dialog
          open={isPackagingDialogOpen}
          modal={false}
          onOpenChange={(open) => {
            setIsPackagingDialogOpen(open)
            if (!open) {
              setPackagingPreviewError(null)
              setPackagingPreview(null)
              setIsPackagingBreakdownOpen(false)
            }
          }}
        >
        <DialogContent
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
          className="bottom-0 left-0 top-auto flex h-[94vh] w-full max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-t-2xl rounded-b-none p-3 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:h-[86vh] sm:max-h-[86vh] sm:w-[92vw] sm:max-w-5xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-4">
          <DialogHeader className="shrink-0 space-y-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="text-[19px] leading-6">Empaque y conversión</DialogTitle>
                <DialogDescription className="mt-1 text-[13px]">
                  Agrega las presentaciones de mayor a menor hasta llegar a la unidad base.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
            <div className="flex min-h-0 flex-col gap-2.5 overflow-hidden rounded-xl border bg-background/60 p-3">
              <div className="shrink-0 flex items-center justify-between gap-2">
                <p className="text-[14px] font-semibold text-foreground">Cadena de presentaciones</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canAddNextPackagingStep}
                  onClick={() =>
                    setPackagingDraftRows((current) => {
                      const next = [
                        ...current,
                        createEmptyPackagingRow(getNextPackagingPresentationId(current)),
                      ]
                      syncPackagingInputValues(next)
                      return next
                    })
                  }
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Agregar presentación
                </Button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-background pr-1">
                {packagingDraftRows.map((row, index) => {
                  const isLastStep = index === packagingDraftRows.length - 1
                  const nextStep = packagingDraftRows[index + 1]
                  const currentLabel = getPresentationLabel(row.presentacionId)
                  const nextLabel = getPresentationLabel(nextStep?.presentacionId)
                  const fieldKey = `${row.presentacionId || 'row'}-${index}`
                  const defaults = packagingInputDefaults.current[fieldKey] ?? {
                    cantidad: typeof row.cantidadEquivalencia === 'number' ? row.cantidadEquivalencia.toString() : '',
                    precio: typeof row.precioVenta === 'number' ? row.precioVenta.toString() : '',
                    mountKey: 0,
                  }
                  const mountKey = defaults.mountKey

                  return (
                    <div key={`${row.presentacionId || 'row'}-${index}`}>
                      <div className="space-y-3 p-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant={index === 0 ? 'outline' : 'default'} className="text-[11px]">
                              {index === 0 ? 'Paso 1 · Mayor' : isLastStep ? `Paso ${index + 1} · Base` : `Paso ${index + 1} · Intermedio`}
                            </Badge>
                            {row.presentacionId === draftPurchasePresentationId && draftPurchasePresentationId ? (
                              <Badge variant="info" className="text-[11px]">Compra</Badge>
                            ) : null}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 shrink-0 gap-1 px-2 text-[12px] text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              setPackagingDraftRows((current) => {
                                const next = current.filter((_, currentIndex) => currentIndex !== index)
                                syncPackagingInputValues(next)
                                return next
                              })
                            }
                          >
                            <X className="h-3.5 w-3.5" />
                            Eliminar
                          </Button>
                        </div>

                        <div className="rounded-lg border bg-muted/10 p-3 space-y-3">
                          <div className="space-y-1.5">
                            <label className="text-[12px] font-medium text-muted-foreground">
                              Presentación
                            </label>
                            <Select
                              value={row.presentacionId || undefined}
                              onValueChange={(value) =>
                              setPackagingDraftRows((current) => {
                                const next = current.map((entry, currentIndex) =>
                                  currentIndex === index ? { ...entry, presentacionId: value } : entry,
                                )
                                syncPackagingInputValues(next)
                                return next
                              })
                            }
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Selecciona la presentación" />
                              </SelectTrigger>
                              <SelectContent>
                                {options.presentations
                                  .filter(
                                    (presentation) =>
                                      presentation.id === row.presentacionId ||
                                      !packagingDraftRows.some(
                                        (entry, currentIndex) =>
                                          currentIndex !== index && entry.presentacionId === presentation.id,
                                      ),
                                  )
                                  .map((presentation) => (
                                    <SelectItem key={presentation.id} value={presentation.id}>
                                      {presentation.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] font-medium text-muted-foreground">Compra</span>
                              <Switch
                                checked={row.permiteCompra}
                                onCheckedChange={(checked) =>
                                  setPackagingDraftRows((current) =>
                                    current.map((entry, currentIndex) =>
                                      currentIndex === index ? { ...entry, permiteCompra: checked } : entry,
                                    ),
                                  )
                                }
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] font-medium text-muted-foreground">Venta</span>
                              <Switch
                                checked={row.permiteVenta}
                                onCheckedChange={(checked) =>
                                  setPackagingDraftRows((current) =>
                                    current.map((entry, currentIndex) =>
                                      currentIndex === index
                                        ? {
                                            ...entry,
                                            permiteVenta: checked,
                                            precioVenta: checked ? entry.precioVenta : undefined,
                                          }
                                        : entry,
                                    ),
                                  )
                                }
                              />
                            </div>
                          </div>

                          {!isLastStep ? (
                            <div className="flex flex-wrap items-center gap-2 text-[14px]">
                              <span className="inline-flex items-center rounded-md border bg-background px-2.5 py-1 font-semibold">
                                1 {currentLabel || '…'}
                              </span>
                              <span className="text-[12px] font-medium text-muted-foreground">contiene</span>
                              <Input
                                key={`cant-${fieldKey}-${mountKey}`}
                                type="text"
                                inputMode="numeric"
                                name={`pack_cant_${index}`}
                                autoComplete="off"
                                spellCheck={false}
                                className="h-9 w-28 text-center text-[14px] font-semibold"
                                placeholder="Ej: 10"
                                defaultValue={defaults.cantidad}
                                ref={(el) => {
                                  const bucket = packagingInputRefs.current[fieldKey] ?? { cantidad: null, precio: null }
                                  bucket.cantidad = el
                                  packagingInputRefs.current[fieldKey] = bucket
                                }}
                                onBlur={() => {
                                  const refs = packagingInputRefs.current[fieldKey]
                                  const value = refs?.cantidad?.value ?? ''
                                  const clean = value.replace(/[^0-9]/g, '')
                                  const parsed = clean === '' ? undefined : Math.trunc(Number(clean))
                                  if (parsed === row.cantidadEquivalencia) return
                                  setPackagingDraftRows((current) =>
                                    current.map((entry, currentIndex) =>
                                      currentIndex === index
                                        ? { ...entry, cantidadEquivalencia: parsed }
                                        : entry,
                                    ),
                                  )
                                }}
                              />
                              <span className="inline-flex items-center rounded-md border bg-background px-2.5 py-1 font-semibold">
                                {nextLabel || 'Siguiente presentación'}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Badge variant="success" className="h-7 gap-1 px-2 text-[12px]">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Unidad base
                              </Badge>
                            </div>
                          )}

                          {row.permiteVenta ? (
                            <div className="space-y-1.5">
                              <label className="text-[12px] font-medium text-muted-foreground">
                                Precio de venta por 1 {currentLabel || 'presentación'}
                              </label>
                              <div className="flex h-9 items-stretch overflow-hidden rounded-md border">
                                <span className="flex items-center border-r bg-muted/40 px-3 text-[14px] font-semibold pointer-events-none select-none">
                                  S/
                                </span>
                                <Input
                                  key={`price-${fieldKey}-${mountKey}`}
                                  type="text"
                                  inputMode="decimal"
                                  name={`pack_price_${index}`}
                                  autoComplete="off"
                                  spellCheck={false}
                                  className="h-full border-0 text-[14px] font-semibold shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                  placeholder="0.00"
                                  defaultValue={defaults.precio}
                                  ref={(el) => {
                                    const bucket = packagingInputRefs.current[fieldKey] ?? { cantidad: null, precio: null }
                                    bucket.precio = el
                                    packagingInputRefs.current[fieldKey] = bucket
                                  }}
                                  onBlur={() => {
                                    const refs = packagingInputRefs.current[fieldKey]
                                    const value = refs?.precio?.value ?? ''
                                    const raw = value.replace(/[^0-9.]/g, '')
                                    const parts = raw.split('.')
                                    const clean = parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('').slice(0, 2) : '')
                                    const parsed = clean === '' || clean === '.' ? undefined : Number(clean)
                                    if (parsed === row.precioVenta) return
                                    setPackagingDraftRows((current) =>
                                      current.map((entry, currentIndex) =>
                                        currentIndex === index
                                          ? { ...entry, precioVenta: parsed }
                                          : entry,
                                      ),
                                    )
                                  }}
                                />
                              </div>
                              {row.permiteCompra &&
                              packagingSummary.hasEnoughData &&
                              typeof packagingSummary.baseUnits === 'number' &&
                              typeof row.precioVenta === 'number' ? (
                                <p className="text-[11px] text-muted-foreground">
                                  Equiv. base ({getPresentationLabel(draftBasePresentationId) || 'unidad'}):{' '}
                                  <span className="font-semibold text-foreground">
                                    {formatCurrency(row.precioVenta / packagingSummary.baseUnits)}
                                  </span>
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {index < packagingDraftRows.length - 1 ? (
                        <div className="border-t border-dashed" />
                      ) : null}
                    </div>
                  )
                })}

                {packagingDraftRows.length === 0 ? (
                  <div className="p-5 text-center text-[12px] text-muted-foreground">
                    Agrega la presentación principal para construir la cadena de conversión.
                  </div>
                ) : null}
              </div>

              <FieldError message={form.formState.errors.empaque?.message as string | undefined} />
            </div>

            <div className="flex h-full min-h-0 flex-col gap-2.5 overflow-hidden rounded-xl border bg-background/60 p-3">
              <div className="shrink-0 rounded-lg border bg-background p-2.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Resumen
                </p>
                <p className="mt-1.5 text-[14px] font-semibold leading-snug text-foreground">
                  {packagingSummary.hasEnoughData
                    ? packagingSummary.equivalenceText
                    : packagingDraftRows.length === 0
                      ? 'Agrega presentaciones.'
                      : 'Completa para ver equivalencia.'}
                </p>
                <div className="mt-2 space-y-0.5 text-[12px] text-muted-foreground">
                  <p>
                    Compra principal:{' '}
                    <span className="font-medium text-foreground">
                      {draftPurchasePresentationId
                        ? getPresentationLabel(draftPurchasePresentationId)
                        : 'Sin definir'}
                    </span>
                  </p>
                  <p>
                    Unidad base:{' '}
                    <span className="font-medium text-foreground">
                      {draftBasePresentationId
                        ? getPresentationLabel(draftBasePresentationId)
                        : 'Sin definir'}
                    </span>
                  </p>
                </div>

                {packagingChainPreview.length > 0 ? (
                  <div className="mt-2 rounded-md border">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left"
                      onClick={() => setIsPackagingBreakdownOpen((value) => !value)}
                    >
                      <span className="text-[12px] font-medium text-foreground">Ver desglose</span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
                          isPackagingBreakdownOpen ? '' : '-rotate-90'
                        }`}
                      />
                    </button>
                    {isPackagingBreakdownOpen ? (
                      <div className="max-h-40 space-y-1 overflow-y-auto border-t px-2.5 py-2 text-[12px]">
                        {packagingChainPreview.map((node) => (
                          <div
                            key={node.key}
                            className="flex items-center gap-2 rounded-sm bg-muted/25 px-2 py-1"
                          >
                            <span className="font-semibold text-foreground">
                              {node.quantityLabel ?? '1'}
                            </span>
                            <span className="text-muted-foreground">×</span>
                            <span className="font-medium text-foreground">{node.label}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
                {packagingDraftIssues.length > 0 ? (
                  <div className="rounded-md border border-warning/40 bg-warning/5 px-2.5 py-2 text-[12px] text-warning-foreground leading-relaxed">
                    <p className="font-semibold text-foreground">Revisa la cadena</p>
                    <ul className="mt-1 space-y-0.5 text-[12px] text-muted-foreground">
                      {packagingDraftIssues.map((issue) => (
                        <li key={issue}>• {issue}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {isPackagingPreviewLoading ? (
                  <div className="rounded-md border px-2.5 py-2 text-[12px] text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Validando…
                    </div>
                  </div>
                ) : null}

                {packagingPreviewError ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-2 text-[12px] leading-relaxed text-destructive">
                    {packagingPreviewError}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPackagingGuideOpen(true)}
              className="gap-1.5"
            >
              <BookOpen className="h-4 w-4" />
              📖 Ver guía
            </Button>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPackagingDialogOpen(false)}
              >
                Cerrar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  const flushedRows = flushPackagingInputValues(packagingDraftRows)
                  setPackagingDraftRows(flushedRows)
                  syncPackagingInputValues(flushedRows)

                  if (packagingPreviewError || !packagingPreview) {
                    setPackagingPreviewError(
                      packagingPreviewError ?? 'Completa una cadena válida antes de aplicar.',
                    )
                    return
                  }

                  form.setValue('empaque', flushedRows, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  })
                  const isValid = await form.trigger('empaque')
                  if (!isValid) {
                    return
                  }
                  setIsPackagingDialogOpen(false)
                }}
              >
                Aplicar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
        </Dialog>
      ) : null}

      {isPackagingGuideOpen ? (
        <Dialog
          open={isPackagingGuideOpen}
          modal={false}
          onOpenChange={(open) => {
            setIsPackagingGuideOpen(open)
          }}
        >
        <DialogContent
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
          className="max-h-[88vh] overflow-hidden sm:max-w-2xl"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[18px] leading-6">
              <BookOpen className="h-5 w-5 text-primary" />
              Guía de empaque y conversión
            </DialogTitle>
            <DialogDescription className="text-[13px]">
              Aprende a configurar presentaciones y equivalencias de un producto en pocos pasos. Puedes cerrar esta ventana y continuar configurando sin perder tus datos.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
            <div className="rounded-lg border bg-muted/25 p-3 text-[13px] leading-relaxed">
              <p>
                Agrega las presentaciones <strong>desde la más grande hasta la unidad base</strong>.
                La cantidad indica <strong>cuántas unidades de la siguiente presentación</strong> contiene la presentación actual.
              </p>
            </div>

            <div className="rounded-lg border p-3">
              <p className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide">Ejemplo visual</p>
              <div className="mt-2.5 space-y-1.5 text-[13px]">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-base">📦</span>
                  <span className="font-semibold">Caja</span>
                </div>
                <div className="pl-9 text-[12px] text-muted-foreground">
                  ↓ contiene <span className="font-semibold text-foreground">10</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-base">📋</span>
                  <span className="font-semibold">Blíster</span>
                </div>
                <div className="pl-9 text-[12px] text-muted-foreground">
                  ↓ contiene <span className="font-semibold text-foreground">12</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-base">💊</span>
                  <span className="font-semibold">Tabletas</span>
                </div>
              </div>
              <div className="mt-3 rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-[13px]">
                Resultado: <span className="font-semibold">1 Caja = 10 Blíster = 120 Tabletas</span>
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              <div className="rounded-lg border p-2.5 text-[12px] leading-relaxed">
                <p className="font-semibold text-foreground">Medicamento</p>
                <p className="mt-1 text-muted-foreground">1 Caja → 10 Blíster → 12 Tabletas</p>
                <p className="mt-1 text-foreground">= 120 Tabletas</p>
              </div>
              <div className="rounded-lg border p-2.5 text-[12px] leading-relaxed">
                <p className="font-semibold text-foreground">Pañales</p>
                <p className="mt-1 text-muted-foreground">1 Paquete → 20 Packs → 3 Unidades</p>
                <p className="mt-1 text-foreground">= 60 Unidades</p>
              </div>
              <div className="rounded-lg border p-2.5 text-[12px] leading-relaxed">
                <p className="font-semibold text-foreground">Simple</p>
                <p className="mt-1 text-muted-foreground">1 Caja → 24 Unidades</p>
                <p className="mt-1 text-foreground">= 24 Unidades</p>
              </div>
            </div>

            <div className="rounded-lg border p-3 text-[13px] leading-relaxed">
              <p className="font-semibold text-foreground">Regla de orden</p>
              <p className="mt-1 text-muted-foreground">
                Siempre agrega las presentaciones desde la más grande hasta la más pequeña. La última presentación será automáticamente la unidad base.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 text-[12px]">
                <div className="rounded-md border border-success/30 bg-success/5 px-2.5 py-2">
                  <span className="font-semibold text-success">✓ Correcto</span>
                  <p className="mt-0.5">Caja → Blíster → Tableta</p>
                </div>
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2">
                  <span className="font-semibold text-destructive">✗ Incorrecto</span>
                  <p className="mt-0.5">Tableta → Blíster → Caja</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-dashed p-3 text-[12px] leading-relaxed text-muted-foreground">
              <p>
                Tip: si necesitas volver a consultarla, pulsa <span className="font-semibold text-foreground">📖 Ver guía</span> en la ventana de configuración.
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="dont-show-packaging-guide-global"
                checked={dontShowPackagingGuide}
                onCheckedChange={(value) => {
                  const checked = value === true
                  setDontShowPackagingGuide(checked)
                  try {
                    if (typeof window !== 'undefined') {
                      window.localStorage.setItem('no_volver_a_mostrar_empaque_guia', checked ? '1' : '0')
                    }
                  } catch {
                    // ignore storage errors
                  }
                }}
              />
              <label htmlFor="dont-show-packaging-guide-global" className="text-[12px] text-muted-foreground cursor-pointer">
                Recordar que puedo abrir la guía desde el botón 📖 Ver guía
              </label>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPackagingGuideOpen(false)}
              >
                Cerrar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
        </Dialog>
      ) : null}

      {isDetailDialogOpen ? (
        <Dialog
          open={isDetailDialogOpen}
          onOpenChange={(open) => {
            setIsDetailDialogOpen(open)
            if (!open) {
              setSelectedProductDetail(null)
            }
          }}
        >
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Detalle del producto</DialogTitle>
            <DialogDescription>
              {selectedProductDetail?.sku ? `SKU ${selectedProductDetail.sku}` : 'Información general del SKU.'}
            </DialogDescription>
          </DialogHeader>

          {selectedProductDetail ? (
            <div className="grid gap-3 text-sm">
              <div className="rounded-xl border p-3">
                <p className="font-medium text-foreground">{selectedProductDetail.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedProductDetail.category}
                  {(selectedProductDetail.commercialType ?? selectedProductDetail.medicationType)
                    ? ` · ${selectedProductDetail.commercialType ?? selectedProductDetail.medicationType}`
                    : ''}
                  {selectedProductDetail.presentation ? ` · ${selectedProductDetail.presentation}` : ''}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <p className="mt-1 font-medium text-foreground">{selectedProductDetail.status}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Stock</p>
                  <p className="mt-1 font-medium text-foreground">
                    {selectedProductDetail.stockUnits.toFixed(0)} {selectedProductDetail.unitSymbol}
                  </p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Precio unidad</p>
                  <p className="mt-1 font-medium text-foreground">{formatCurrency(selectedProductDetail.salePrice)}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Costo referencial</p>
                  <p className="mt-1 font-medium text-foreground">{formatCurrency(selectedProductDetail.costPrice)}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Tipo comercial</p>
                  <p className="mt-1 font-medium text-foreground">
                    {selectedProductDetail.commercialType ?? selectedProductDetail.medicationType ?? 'Sin clasificar'}
                  </p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Principio activo</p>
                  <p className="mt-1 font-medium text-foreground">
                    {selectedProductDetail.activePrinciple ?? 'Sin principio activo'}
                  </p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Laboratorio</p>
                  <p className="mt-1 font-medium text-foreground">
                    {selectedProductDetail.laboratory ?? 'Sin laboratorio'}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">Empaque</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Unidad base</p>
                    <p className="mt-1 font-medium text-foreground">
                      {selectedProductDetail.packaging.presentations.find((item) => item.isBase)?.name ??
                        'Sin base definida'}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Compra principal</p>
                    <p className="mt-1 font-medium text-foreground">
                      {selectedProductDetail.packaging.presentations.find(
                        (item) => item.id === selectedProductDetail.packaging.purchasePresentationId,
                      )?.name ?? 'Sin definir'}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {selectedProductDetail.packaging.presentations.length} presentaciones ·{' '}
                  {selectedProductDetail.packaging.conversions.length} equivalencias
                </p>

                {selectedProductDetail.packaging.summaries.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {selectedProductDetail.packaging.summaries.map((entry) => (
                      <div key={entry.presentationId} className="rounded-lg border bg-muted/20 p-3">
                        <p className="text-sm font-medium text-foreground">{entry.presentationName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{entry.expression}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {selectedProductDetail.packaging.stockBreakdown.available.length > 0 ? (
                  <div className="mt-3 rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Stock amigable</p>
                    <p className="mt-1 text-sm text-foreground">
                      {selectedProductDetail.packaging.stockBreakdown.available
                        .filter((entry) => entry.quantity > 0)
                        .map((entry) => `${entry.quantity} ${entry.presentationName}`)
                        .join(' · ') || 'Sin stock disponible'}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsDetailDialogOpen(false)}>
              Cerrar
            </Button>
            {selectedProductDetail ? (
              <Button type="button" size="sm" onClick={() => {
                setIsDetailDialogOpen(false)
                openEditDialog(selectedProductDetail)
              }}>
                Editar
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
        </Dialog>
      ) : null}

      {isConfirmDialogOpen ? (
        <Dialog
          open={isConfirmDialogOpen}
          onOpenChange={(open) => {
            setIsConfirmDialogOpen(open)
            if (!open) {
              setConfirmAction(null)
            }
          }}
        >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.type === 'delete'
                ? 'Eliminar producto'
                : confirmAction?.type === 'activate'
                  ? 'Activar producto'
                  : 'Desactivar producto'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction
                ? confirmAction.type === 'delete'
                  ? 'Esta acción no se puede deshacer.'
                  : 'Puedes revertirlo luego desde el catálogo.'
                : 'Confirma la acción.'}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border bg-muted/20 p-3 text-sm">
            <p className="font-medium text-foreground">{confirmAction?.product.name ?? '—'}</p>
            <p className="mt-1 text-xs text-muted-foreground">{confirmAction?.product.sku ?? ''}</p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsConfirmDialogOpen(false)}
              disabled={isConfirming}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              variant={confirmAction?.type === 'delete' ? 'danger' : 'primary'}
              onClick={handleConfirmAction}
              disabled={isConfirming || !confirmAction}
            >
              {isConfirming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : confirmAction?.type === 'delete' ? (
                'Eliminar'
              ) : confirmAction?.type === 'activate' ? (
                'Activar'
              ) : (
                'Desactivar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
        </Dialog>
      ) : null}

      {masterDialogOpen ? (
        <Dialog
          open={masterDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              resetMasterDialogState()
              return
            }
            setMasterDialogOpen(open)
          }}
        >
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {masterDialogMode === 'edit' ? 'Editar' : 'Crear'}{' '}
              {masterDialogType === 'categoria'
                ? 'categoría'
                : masterDialogType === 'laboratorio'
                  ? 'laboratorio'
                  : masterDialogType === 'tipoMedicamento'
                    ? 'tipo comercial'
                  : masterDialogType === 'principioActivo'
                    ? 'principio activo'
                  : masterDialogType === 'presentacion'
                    ? 'presentación'
                    : 'unidad'}
            </DialogTitle>
            <DialogDescription>
              Este registro se reutiliza en el catálogo de productos.
            </DialogDescription>
          </DialogHeader>

          {masterDialogType === 'categoria' ? (
            <form className="grid gap-4" onSubmit={categoryForm.handleSubmit(handleSaveMasterCategory)}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Orden</label>
                  <Input
                    type="number"
                    {...categoryForm.register('orden', { valueAsNumber: true })}
                    disabled={isMasterSubmitting}
                  />
                  <FieldError message={categoryForm.formState.errors.orden?.message} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium">Nombre</label>
                  <Input {...categoryForm.register('nombre')} placeholder="Analgésicos" disabled={isMasterSubmitting} />
                  <FieldError message={categoryForm.formState.errors.nombre?.message} />
                  <p className="text-xs text-muted-foreground">Código generado automáticamente desde el nombre.</p>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium">Descripción</label>
                  <Textarea {...categoryForm.register('descripcion')} disabled={isMasterSubmitting} />
                  <FieldError message={categoryForm.formState.errors.descripcion?.message} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium">Color (opcional)</label>
                  <Input
                    {...categoryForm.register('color')}
                    placeholder="#10B981"
                    disabled={isMasterSubmitting}
                  />
                  <FieldError message={categoryForm.formState.errors.color?.message} />
                </div>
              </div>

              <Controller
                control={categoryForm.control}
                name="activo"
                render={({ field }) => (
                  <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Activo</p>
                      <p className="text-xs text-muted-foreground">Disponible en selects de Producto.</p>
                    </div>
                    <Switch
                      checked={field.value ?? true}
                      onCheckedChange={field.onChange}
                      disabled={isMasterSubmitting}
                    />
                  </label>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetMasterDialogState}
                  disabled={isMasterSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={!canManageMasters || isMasterSubmitting}>
                  Guardar
                </Button>
              </DialogFooter>
            </form>
          ) : null}

          {masterDialogType === 'laboratorio' ? (
            <form className="grid gap-4" onSubmit={laboratoryForm.handleSubmit(handleSaveMasterLaboratory)}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium">Nombre</label>
                  <Input {...laboratoryForm.register('nombre')} disabled={isMasterSubmitting} />
                  <FieldError message={laboratoryForm.formState.errors.nombre?.message} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">País (opcional)</label>
                  <Input {...laboratoryForm.register('pais')} disabled={isMasterSubmitting} />
                  <FieldError message={laboratoryForm.formState.errors.pais?.message} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium">Descripción</label>
                  <Textarea {...laboratoryForm.register('descripcion')} disabled={isMasterSubmitting} />
                  <FieldError message={laboratoryForm.formState.errors.descripcion?.message} />
                </div>
              </div>

              <Controller
                control={laboratoryForm.control}
                name="activo"
                render={({ field }) => (
                  <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Activo</p>
                      <p className="text-xs text-muted-foreground">Disponible en selects de Producto.</p>
                    </div>
                    <Switch
                      checked={field.value ?? true}
                      onCheckedChange={field.onChange}
                      disabled={isMasterSubmitting}
                    />
                  </label>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetMasterDialogState}
                  disabled={isMasterSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={!canManageMasters || isMasterSubmitting}>
                  Guardar
                </Button>
              </DialogFooter>
            </form>
          ) : null}

          {masterDialogType === 'tipoMedicamento' ? (
            <form className="grid gap-4" onSubmit={medicationTypeForm.handleSubmit(handleSaveMasterMedicationType)}>
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Nombre</label>
                  <Input
                    {...medicationTypeForm.register('nombre')}
                    placeholder="Genérico"
                    disabled={isMasterSubmitting}
                  />
                  <FieldError message={medicationTypeForm.formState.errors.nombre?.message} />
                  <p className="text-xs text-muted-foreground">Código generado automáticamente desde el nombre.</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Descripción</label>
                  <Textarea {...medicationTypeForm.register('descripcion')} disabled={isMasterSubmitting} />
                  <FieldError message={medicationTypeForm.formState.errors.descripcion?.message} />
                </div>
              </div>

              <Controller
                control={medicationTypeForm.control}
                name="activo"
                render={({ field }) => (
                  <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Activo</p>
                      <p className="text-xs text-muted-foreground">Disponible en selects de Producto y filtros de Venta.</p>
                    </div>
                    <Switch
                      checked={field.value ?? true}
                      onCheckedChange={field.onChange}
                      disabled={isMasterSubmitting}
                    />
                  </label>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetMasterDialogState}
                  disabled={isMasterSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={!canManageMasters || isMasterSubmitting}>
                  Guardar
                </Button>
              </DialogFooter>
            </form>
          ) : null}

          {masterDialogType === 'principioActivo' ? (
            <form className="grid gap-4" onSubmit={activePrincipleForm.handleSubmit(handleSaveMasterActivePrinciple)}>
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Nombre</label>
                  <Input
                    {...activePrincipleForm.register('nombre')}
                    placeholder="Paracetamol"
                    disabled={isMasterSubmitting}
                  />
                  <FieldError message={activePrincipleForm.formState.errors.nombre?.message} />
                  <p className="text-xs text-muted-foreground">Código generado automáticamente desde el nombre.</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Descripción</label>
                  <Textarea {...activePrincipleForm.register('descripcion')} disabled={isMasterSubmitting} />
                  <FieldError message={activePrincipleForm.formState.errors.descripcion?.message} />
                </div>
              </div>

              <Controller
                control={activePrincipleForm.control}
                name="activo"
                render={({ field }) => (
                  <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Activo</p>
                      <p className="text-xs text-muted-foreground">Disponible en productos, importación y filtros.</p>
                    </div>
                    <Switch
                      checked={field.value ?? true}
                      onCheckedChange={field.onChange}
                      disabled={isMasterSubmitting}
                    />
                  </label>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetMasterDialogState}
                  disabled={isMasterSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={!canManageMasters || isMasterSubmitting}>
                  Guardar
                </Button>
              </DialogFooter>
            </form>
          ) : null}

          {masterDialogType === 'presentacion' ? (
            <form className="grid gap-4" onSubmit={presentationForm.handleSubmit(handleSaveMasterPresentation)}>
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Nombre</label>
                  <Input {...presentationForm.register('nombre')} disabled={isMasterSubmitting} />
                  <FieldError message={presentationForm.formState.errors.nombre?.message} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Descripción</label>
                  <Textarea {...presentationForm.register('descripcion')} disabled={isMasterSubmitting} />
                  <FieldError message={presentationForm.formState.errors.descripcion?.message} />
                </div>
              </div>

              <Controller
                control={presentationForm.control}
                name="activo"
                render={({ field }) => (
                  <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Activo</p>
                      <p className="text-xs text-muted-foreground">Disponible en selects de Producto.</p>
                    </div>
                    <Switch
                      checked={field.value ?? true}
                      onCheckedChange={field.onChange}
                      disabled={isMasterSubmitting}
                    />
                  </label>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetMasterDialogState}
                  disabled={isMasterSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={!canManageMasters || isMasterSubmitting}>
                  Guardar
                </Button>
              </DialogFooter>
            </form>
          ) : null}

          {masterDialogType === 'unidad' ? (
            <form className="grid gap-4" onSubmit={unitForm.handleSubmit(handleSaveMasterUnit)}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Símbolo</label>
                  <Input {...unitForm.register('simbolo')} disabled={isMasterSubmitting} />
                  <FieldError message={unitForm.formState.errors.simbolo?.message} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium">Nombre</label>
                  <Input {...unitForm.register('nombre')} disabled={isMasterSubmitting} />
                  <FieldError message={unitForm.formState.errors.nombre?.message} />
                  <p className="text-xs text-muted-foreground">Código generado automáticamente desde el nombre.</p>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium">Descripción</label>
                  <Textarea {...unitForm.register('descripcion')} disabled={isMasterSubmitting} />
                  <FieldError message={unitForm.formState.errors.descripcion?.message} />
                </div>
              </div>

              <Controller
                control={unitForm.control}
                name="activo"
                render={({ field }) => (
                  <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Activo</p>
                      <p className="text-xs text-muted-foreground">Disponible en selects de Producto.</p>
                    </div>
                    <Switch
                      checked={field.value ?? true}
                      onCheckedChange={field.onChange}
                      disabled={isMasterSubmitting}
                    />
                  </label>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetMasterDialogState}
                  disabled={isMasterSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={!canManageMasters || isMasterSubmitting}>
                  Guardar
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}
