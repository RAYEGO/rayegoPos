import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  AlertTriangle,
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
import {
  Card,
  CardContent,
} from '@/components/ui/card'
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
import { ApiError, ApiNetworkError } from '@/services/apiClient'
import { productsService } from '@/services/productsService'
import type {
  CreateProductPayload,
  MasterCategoryRecord,
  MasterLaboratoryRecord,
  MasterPresentationRecord,
  MasterUnitRecord,
  ProductCatalogItem,
  ProductOptionsResponse,
  ProductStatus,
  UpdateProductPayload,
  UpsertMasterCategoryPayload,
  UpsertMasterLaboratoryPayload,
  UpsertMasterPresentationPayload,
  UpsertMasterUnitPayload,
} from '@/types/products'
import { toast } from 'sonner'

const createProductSchema = z.object({
  categoriaId: z.string().uuid({ message: 'Selecciona una categoría.' }),
  laboratorioId: z.string().optional(),
  unidadMedidaId: z.string().uuid({ message: 'Selecciona una unidad.' }),
  compraPresentacionId: z.string().uuid({ message: 'Selecciona una presentación de compra.' }),
  basePresentacionId: z.string().uuid({ message: 'Selecciona una presentación base.' }),
  presentacionesEmpaque: z
    .array(
      z.object({
        presentacionId: z.string().uuid({ message: 'Selecciona una presentación.' }),
        permiteCompra: z.boolean(),
        permiteVenta: z.boolean(),
        precioVenta: z.number().nonnegative('El precio debe ser mayor o igual a 0.').optional(),
      }),
    )
    .min(1, 'Agrega al menos una presentación.'),
  conversionesEmpaque: z
    .array(
      z.object({
        desdePresentacionId: z.string().uuid({ message: 'Selecciona el origen.' }),
        haciaPresentacionId: z.string().uuid({ message: 'Selecciona el destino.' }),
        cantidad: z.number().int().positive('La cantidad debe ser un entero mayor a 0.'),
      }),
    )
    .min(0),
  principioActivoId: z.string().optional(),
  sku: z.string().min(3, 'Ingresa un SKU válido.').max(50),
  codigoBarras: z.string().max(50).optional(),
  nombre: z.string().min(3, 'Ingresa el nombre del producto.').max(180),
  descripcion: z.string().max(500).optional(),
  concentracion: z.string().max(120).optional(),
  registroSanitario: z.string().max(100).optional(),
  requiereReceta: z.boolean(),
  esControlado: z.boolean(),
  costoReferencia: z.number().nonnegative('El costo debe ser mayor o igual a 0.'),
}).superRefine((values, ctx) => {
  const presentationIds = values.presentacionesEmpaque.map((entry) => entry.presentacionId)
  if (!presentationIds.includes(values.basePresentacionId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'La presentación base debe estar incluida en las presentaciones configuradas.',
      path: ['basePresentacionId'],
    })
  }

  if (!presentationIds.includes(values.compraPresentacionId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'La presentación de compra debe estar incluida en las presentaciones configuradas.',
      path: ['compraPresentacionId'],
    })
  } else {
    const purchaseEntry = values.presentacionesEmpaque.find(
      (entry) => entry.presentacionId === values.compraPresentacionId,
    )
    if (!purchaseEntry?.permiteCompra) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La presentación principal de compra debe estar habilitada para compra.',
        path: ['compraPresentacionId'],
      })
    }
  }

  if (new Set(presentationIds).size !== presentationIds.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'No se permiten presentaciones duplicadas.',
      path: ['presentacionesEmpaque'],
    })
  }

  values.presentacionesEmpaque.forEach((entry, index) => {
    if (entry.permiteVenta && (entry.precioVenta === undefined || entry.precioVenta === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Define un precio para la presentación habilitada para venta.',
        path: ['presentacionesEmpaque', index, 'precioVenta'],
      })
    }
  })

  if (!values.presentacionesEmpaque.some((entry) => entry.permiteVenta)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'El producto debe tener al menos una presentación habilitada para venta.',
      path: ['presentacionesEmpaque'],
    })
  }

  values.conversionesEmpaque.forEach((entry, index) => {
    if (entry.desdePresentacionId === entry.haciaPresentacionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Origen y destino no pueden ser iguales.',
        path: ['conversionesEmpaque', index, 'haciaPresentacionId'],
      })
    }

    if (!presentationIds.includes(entry.desdePresentacionId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El origen debe ser una presentación configurada.',
        path: ['conversionesEmpaque', index, 'desdePresentacionId'],
      })
    }

    if (!presentationIds.includes(entry.haciaPresentacionId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El destino debe ser una presentación configurada.',
        path: ['conversionesEmpaque', index, 'haciaPresentacionId'],
      })
    }
  })
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
type MasterPresentationFormValues = z.infer<typeof masterPresentationSchema>
type MasterUnitFormValues = z.infer<typeof masterUnitSchema>

const defaultFormValues: CreateProductFormValues = {
  categoriaId: '',
  laboratorioId: '',
  unidadMedidaId: '',
  compraPresentacionId: '',
  basePresentacionId: '',
  presentacionesEmpaque: [],
  conversionesEmpaque: [],
  principioActivoId: '',
  sku: '',
  codigoBarras: '',
  nombre: '',
  descripcion: '',
  concentracion: '',
  registroSanitario: '',
  requiereReceta: false,
  esControlado: false,
  costoReferencia: 0,
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

export function ProductosPage() {
  const { logout, session } = useAuth()
  const authorization = useAuthorization()
  const accessToken = session?.accessToken ?? ''
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'TODOS' | ProductStatus>('TODOS')
  const [categoryFilter, setCategoryFilter] = useState('TODAS')
  const [laboratoryFilter, setLaboratoryFilter] = useState('TODOS')
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
    'categoria' | 'laboratorio' | 'presentacion' | 'unidad'
  >('categoria')
  const [masterDialogMode, setMasterDialogMode] = useState<'create' | 'edit'>('create')
  const [masterDialogTargetField, setMasterDialogTargetField] = useState<
    'categoriaId' | 'laboratorioId' | 'presentacionId' | 'unidadMedidaId' | null
  >(null)
  const [editingCategory, setEditingCategory] = useState<MasterCategoryRecord | null>(null)
  const [editingLaboratory, setEditingLaboratory] = useState<MasterLaboratoryRecord | null>(null)
  const [editingPresentation, setEditingPresentation] = useState<MasterPresentationRecord | null>(null)
  const [editingUnit, setEditingUnit] = useState<MasterUnitRecord | null>(null)

  const form = useForm<CreateProductFormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: defaultFormValues,
  })

  const packagingPresentations = useFieldArray({
    control: form.control,
    name: 'presentacionesEmpaque',
  })

  const packagingConversions = useFieldArray({
    control: form.control,
    name: 'conversionesEmpaque',
  })

  const watchedBasePresentationId = form.watch('basePresentacionId')
  const watchedPackagingPresentations = form.watch('presentacionesEmpaque')

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

  const handleUnauthorized = useCallback(async () => {
    toast.error('Tu sesión ya no es válida. Ingresa nuevamente para continuar.')
    await logout()
  }, [logout])

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
        await handleUnauthorized()
        return
      }
      toast.error(getApiErrorMessage(error))
    } finally {
      setIsOptionsLoading(false)
    }
  }, [accessToken, handleUnauthorized])

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
        page,
        pageSize,
        sortBy,
        sortDir,
      })

      setProducts(response.items)
      setSummary(response.summary)
      setTotalItems(response.pagination.totalItems)
      setTotalPages(response.pagination.totalPages)
      setSortBy(response.sort.by)
      setSortDir(response.sort.dir)

      if (page > response.pagination.totalPages) {
        setPage(response.pagination.totalPages)
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await handleUnauthorized()
        return
      }
      setCatalogError(getApiErrorMessage(error))
    } finally {
      setIsCatalogLoading(false)
    }
  }, [
    accessToken,
    categoryFilter,
    handleUnauthorized,
    laboratoryFilter,
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
  }, [categoryFilter, laboratoryFilter, pageSize, search, sortBy, sortDir, statusFilter])

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

  const resetMasterDialogState = useCallback(() => {
    setMasterDialogOpen(false)
    setMasterDialogTargetField(null)
    setMasterDialogMode('create')
    setEditingCategory(null)
    setEditingLaboratory(null)
    setEditingPresentation(null)
    setEditingUnit(null)
    categoryForm.reset()
    laboratoryForm.reset()
    presentationForm.reset()
    unitForm.reset()
  }, [categoryForm, laboratoryForm, presentationForm, unitForm])

  const openCreateMaster = useCallback(
    (
      type: 'categoria' | 'laboratorio' | 'presentacion' | 'unidad',
      targetField:
        | 'categoriaId'
        | 'laboratorioId'
        | 'presentacionId'
        | 'unidadMedidaId'
        | null = null,
    ) => {
      setMasterDialogType(type)
      setMasterDialogMode('create')
      setMasterDialogTargetField(targetField)
      setEditingCategory(null)
      setEditingLaboratory(null)
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
    [categoryForm, laboratoryForm, presentationForm, unitForm],
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
      unidadMedidaId: product.unitId,
      compraPresentacionId: product.packaging.purchasePresentationId ?? '',
      basePresentacionId: product.packaging.basePresentationId ?? '',
      presentacionesEmpaque: product.packaging.presentations.map((entry) => ({
        presentacionId: entry.id,
        permiteCompra: entry.allowsPurchase,
        permiteVenta: entry.allowsSale,
        precioVenta: entry.salePrice ?? undefined,
      })),
      conversionesEmpaque: product.packaging.conversions.map((entry) => ({
        desdePresentacionId: entry.fromPresentationId,
        haciaPresentacionId: entry.toPresentationId,
        cantidad: entry.quantity,
      })),
      principioActivoId: '',
      sku: product.sku,
      codigoBarras: product.barcode ?? '',
      nombre: product.name,
      descripcion: product.description ?? '',
      concentracion: product.concentration ?? '',
      registroSanitario: product.sanitaryRegistration ?? '',
      requiereReceta: product.requiresPrescription,
      esControlado: product.isControlled,
      costoReferencia: product.costPrice,
    }
  }

  function openCreateDialog() {
    setEditingProduct(null)
    form.reset({ ...defaultFormValues, sku: buildSkuSuggestion() })
    setIsCreateDialogOpen(true)
  }

  function openEditDialog(product: ProductCatalogItem) {
    setEditingProduct(product)
    form.reset(mapProductToFormValues(product))
    setIsCreateDialogOpen(true)
  }

  function openDuplicateDialog(product: ProductCatalogItem) {
    const nextSkuBase = `${product.sku}-COPIA`
    const nextSku = nextSkuBase.length > 50 ? nextSkuBase.slice(0, 50) : nextSkuBase
    const nextValues = mapProductToFormValues(product)
    nextValues.sku = nextSku
    nextValues.codigoBarras = ''
    setEditingProduct(null)
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

    const payload: CreateProductPayload | UpdateProductPayload = {
      ...values,
      laboratorioId: values.laboratorioId || undefined,
      principioActivoId: values.principioActivoId || undefined,
      codigoBarras: values.codigoBarras?.trim() || undefined,
      descripcion: values.descripcion?.trim() || undefined,
      concentracion: values.concentracion?.trim() || undefined,
      registroSanitario: values.registroSanitario?.trim() || undefined,
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
        toast.error('Tu sesión venció o cambió con el despliegue. Ingresa nuevamente para guardar productos.')
        await logout()
        return
      }

      toast.error(getApiErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
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
            <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-7">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por SKU, nombre, código"
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
            onCategoriesChanged={loadOptions}
            canManageMasters={canManageMasters}
          />
        </TabsContent>
      </Tabs>

      <SidePanel
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open)
          if (!open) {
            setEditingProduct(null)
            form.reset(defaultFormValues)
          }
        }}
      >
        <SidePanelContent className="p-0">
          <form className="flex h-full flex-col" onSubmit={form.handleSubmit(handleCreateProduct)}>
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
                <label className="text-xs font-medium">Costo referencial</label>
                <Input
                  type="number"
                  step="0.01"
                  {...form.register('costoReferencia', { valueAsNumber: true })}
                />
                <FieldError message={form.formState.errors.costoReferencia?.message} />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-medium">Empaque y conversión</label>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between gap-3"
                  onClick={() => {
                    createDialogScrollTopRef.current = createDialogContentRef.current?.scrollTop ?? 0
                    if (packagingPresentations.fields.length === 0 && options.presentations.length > 0) {
                      const firstPresentationId = options.presentations[0].id
                      packagingPresentations.append({
                        presentacionId: firstPresentationId,
                        permiteCompra: true,
                        permiteVenta: true,
                        precioVenta: 0,
                      })
                      form.setValue('basePresentacionId', firstPresentationId, { shouldValidate: true })
                      form.setValue('compraPresentacionId', firstPresentationId, { shouldValidate: true })
                    }
                    setIsPackagingDialogOpen(true)
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Configurar empaque
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {`${watchedPackagingPresentations.length} presentación(es) · base ${
                      options.presentations.find((item) => item.id === watchedBasePresentationId)?.name ??
                      'sin definir'
                    }`}
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

      <Dialog open={isPackagingDialogOpen} onOpenChange={setIsPackagingDialogOpen}>
        <DialogContent className="bottom-0 left-0 top-auto h-[92vh] w-full max-w-none translate-x-0 translate-y-0 rounded-t-2xl rounded-b-none p-4 overflow-y-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:h-auto sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:p-6">
          <DialogHeader>
            <DialogTitle>Empaque y conversión</DialogTitle>
            <DialogDescription>
              Configura cómo se compra y vende este producto sin duplicar stock.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Presentación principal de compra</label>
              <Controller
                control={form.control}
                name="compraPresentacionId"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona compra" />
                    </SelectTrigger>
                    <SelectContent>
                      {watchedPackagingPresentations
                        .filter((entry) => entry.permiteCompra)
                        .map((entry) => {
                        const label =
                          options.presentations.find((item) => item.id === entry.presentacionId)?.name ??
                          entry.presentacionId
                        return (
                          <SelectItem key={entry.presentacionId} value={entry.presentacionId}>
                            {label}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={form.formState.errors.compraPresentacionId?.message} />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Unidad mínima (base)</label>
              <Controller
                control={form.control}
                name="basePresentacionId"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona base" />
                    </SelectTrigger>
                    <SelectContent>
                      {watchedPackagingPresentations.map((entry) => {
                        const label =
                          options.presentations.find((item) => item.id === entry.presentacionId)?.name ??
                          entry.presentacionId
                        return (
                          <SelectItem key={entry.presentacionId} value={entry.presentacionId}>
                            {label}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={form.formState.errors.basePresentacionId?.message} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium">Presentaciones</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    packagingPresentations.append({
                      presentacionId: options.presentations[0]?.id ?? '',
                      permiteCompra: false,
                      permiteVenta: false,
                      precioVenta: undefined,
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar
                </Button>
              </div>

              <div className="grid gap-2">
                {packagingPresentations.fields.map((field, index) => (
                  <div key={field.id} className="grid gap-2 rounded-xl border p-3">
                    <Controller
                      control={form.control}
                      name={`presentacionesEmpaque.${index}.presentacionId`}
                      render={({ field }) => (
                        <Select value={field.value || undefined} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona presentación" />
                          </SelectTrigger>
                          <SelectContent>
                            {options.presentations.map((presentation) => (
                              <SelectItem key={presentation.id} value={presentation.id}>
                                {presentation.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Controller
                        control={form.control}
                        name={`presentacionesEmpaque.${index}.permiteCompra`}
                        render={({ field }) => (
                          <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                            <p className="text-sm font-medium text-foreground">Compra</p>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </label>
                        )}
                      />
                      <Controller
                        control={form.control}
                        name={`presentacionesEmpaque.${index}.permiteVenta`}
                        render={({ field }) => (
                          <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                            <p className="text-sm font-medium text-foreground">Venta</p>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </label>
                        )}
                      />
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">Precio</label>
                        <Input
                          type="number"
                          step="0.01"
                          {...form.register(`presentacionesEmpaque.${index}.precioVenta`, {
                            valueAsNumber: true,
                            setValueAs: (value) =>
                              value === '' || value === null || value === undefined ? undefined : Number(value),
                          })}
                        />
                        <FieldError
                          message={
                            form.formState.errors.presentacionesEmpaque?.[index]?.precioVenta?.message
                          }
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => packagingPresentations.remove(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <FieldError message={form.formState.errors.presentacionesEmpaque?.message as string | undefined} />
            </div>

            {watchedPackagingPresentations.length <= 1 ? null : (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium">Equivalencias (enteros)</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      packagingConversions.append({
                        desdePresentacionId: watchedPackagingPresentations[0]?.presentacionId ?? '',
                        haciaPresentacionId: watchedPackagingPresentations[0]?.presentacionId ?? '',
                        cantidad: 1,
                      })
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar
                  </Button>
                </div>

                <div className="grid gap-2">
                  {packagingConversions.fields.map((field, index) => (
                    <div key={field.id} className="grid gap-2 rounded-xl border p-3">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Controller
                          control={form.control}
                          name={`conversionesEmpaque.${index}.desdePresentacionId`}
                          render={({ field }) => (
                            <Select value={field.value || undefined} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Desde" />
                              </SelectTrigger>
                              <SelectContent>
                                {watchedPackagingPresentations.map((entry) => {
                                  const label =
                                    options.presentations.find((item) => item.id === entry.presentacionId)?.name ??
                                    entry.presentacionId
                                  return (
                                    <SelectItem key={entry.presentacionId} value={entry.presentacionId}>
                                      {label}
                                    </SelectItem>
                                  )
                                })}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        <Controller
                          control={form.control}
                          name={`conversionesEmpaque.${index}.haciaPresentacionId`}
                          render={({ field }) => (
                            <Select value={field.value || undefined} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Hacia" />
                              </SelectTrigger>
                              <SelectContent>
                                {watchedPackagingPresentations.map((entry) => {
                                  const label =
                                    options.presentations.find((item) => item.id === entry.presentacionId)?.name ??
                                    entry.presentacionId
                                  return (
                                    <SelectItem key={entry.presentacionId} value={entry.presentacionId}>
                                      {label}
                                    </SelectItem>
                                  )
                                })}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">Cantidad</label>
                          <Input
                            type="number"
                            step="1"
                            {...form.register(`conversionesEmpaque.${index}.cantidad`, {
                              valueAsNumber: true,
                              setValueAs: (value) =>
                                value === '' || value === null || value === undefined
                                  ? undefined
                                  : Number(value),
                            })}
                          />
                          <FieldError
                            message={form.formState.errors.conversionesEmpaque?.[index]?.cantidad?.message}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => packagingConversions.remove(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsPackagingDialogOpen(false)}>
              Cerrar
            </Button>
            <Button type="button" size="sm" onClick={() => setIsPackagingDialogOpen(false)}>
              Listo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              </div>

              <div className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">Empaque</p>
                <p className="mt-1 font-medium text-foreground">
                  {selectedProductDetail.packaging.presentations.find((item) => item.isBase)?.name ??
                    'Sin base definida'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedProductDetail.packaging.presentations.length} presentaciones ·{' '}
                  {selectedProductDetail.packaging.conversions.length} equivalencias
                </p>
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
    </div>
  )
}
