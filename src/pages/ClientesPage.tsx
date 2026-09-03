import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  ChevronDown,
  CreditCard,
  MoreVertical,
  Edit,
  MonitorCog,
  Plus,
  Search,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AuthorizationGate } from '@/components/auth/AuthorizationGate'
import { useAuth } from '@/hooks/useAuth'
import { useHandleUnauthorized } from '@/hooks/useHandleUnauthorized'
import { ApiError, ApiNetworkError } from '@/services/apiClient'
import { customersService } from '@/services/customersService'
import { rtService } from '@/services/rtService'
import type {
  CreateCustomerPayload,
  CustomerAccountStatementResponse,
  CustomerItem,
  CustomerSalesResponse,
  CustomerStatusFilter,
  CustomersDashboardResponse,
  RegisterCustomerPaymentPayload,
} from '@/types/customers'
import type {
  ClienteEquipo,
  GarantiaOrden,
  OrdenPago,
  OrdenServicio,
} from '@/types/rayegotech'
import { toast } from 'sonner'
import { FormPaymentMethodTwoLevelSelect } from '@/components/ui/payment-method-selector'
import type { PaymentMethodOption } from '@/lib/payment-methods'

const optionalEmailSchema = z
  .string()
  .max(150, 'Máximo 150 caracteres.')
  .refine((value) => value === '' || /\S+@\S+\.\S+/.test(value), 'Ingresa un correo válido.')

const customerFormSchema = z
  .object({
    tipoPersona: z.string().min(1, 'Selecciona el tipo de persona.'),
    tipoDocumento: z.string().min(1, 'Selecciona el tipo de documento.'),
    numeroDocumento: z
      .string()
      .trim()
      .min(1, 'Ingresa el número de documento.')
      .max(20, 'Máximo 20 caracteres.'),
    nombres: z.string().max(120).optional(),
    apellidos: z.string().max(120).optional(),
    razonSocial: z.string().max(200).optional(),
    email: optionalEmailSchema,
    telefono: z.string().max(30).optional(),
    direccion: z.string().max(255).optional(),
    permitirCredito: z.boolean(),
    limiteCredito: z.number().min(0),
    ubigeo: z.string().max(6).optional(),
    fechaNacimiento: z.string().optional(),
    observaciones: z.string().max(255).optional(),
    activo: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.tipoPersona === 'JURIDICA') {
      if (!values.razonSocial?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'La razón social es obligatoria.',
          path: ['razonSocial'],
        })
      }
      return
    }

    if (!values.nombres?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Los nombres son obligatorios.',
        path: ['nombres'],
      })
    }
  })

type CustomerFormValues = z.infer<typeof customerFormSchema>

const customerPaymentSchema = z
  .object({
    monto: z
      .number({
        message: 'Ingresa un monto válido.',
      })
      .min(0.01, 'El monto debe ser mayor a 0.'),
    formaPagoId: z.string().min(1, 'Selecciona un medio de pago.'),
    referenciaExterna: z.string().max(120).optional().nullable(),
    observaciones: z.string().max(255).optional().nullable(),
  })

type CustomerPaymentFormValues = z.infer<typeof customerPaymentSchema>

const defaultDashboard: CustomersDashboardResponse = {
  summary: {
    totalCustomers: 0,
    activeCustomers: 0,
    inactiveCustomers: 0,
    withDocument: 0,
    withPhone: 0,
  },
  customers: [],
  options: {
    tiposPersona: [],
    tiposDocumento: [],
  },
}

const defaultFormValues: CustomerFormValues = {
  tipoPersona: '',
  tipoDocumento: '',
  numeroDocumento: '',
  nombres: '',
  apellidos: '',
  razonSocial: '',
  email: '',
  telefono: '',
  direccion: '',
  permitirCredito: false,
  limiteCredito: 0,
  ubigeo: '',
  fechaNacimiento: '',
  observaciones: '',
  activo: true,
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(value)
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

function getCustomerStatusVariant(isActive: boolean) {
  return isActive ? 'success' : 'outline'
}

function getCustomerDisplayName(customer: CustomerItem) {
  return customer.nombreCompleto ?? customer.razonSocial ?? 'Cliente'
}

function getCustomerSearchTokens(customer: CustomerItem) {
  return [
    getCustomerDisplayName(customer),
    customer.numeroDocumento ?? '',
    customer.telefono ?? '',
    customer.email ?? '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getSaleStatusVariant(status: string) {
  if (status === 'COBRADA') return 'success'
  if (status === 'EMITIDA') return 'info'
  if (status === 'BORRADOR') return 'warning'
  return 'destructive'
}

function getSaleStatusLabel(status: string) {
  if (status === 'COBRADA') return 'COBRADA'
  if (status === 'EMITIDA') return 'EMITIDA'
  if (status === 'BORRADOR') return 'BORRADOR'
  return 'ANULADA'
}

function CustomerAutocomplete({
  customers,
  value,
  onValueChange,
  placeholder,
}: {
  customers: CustomerItem[]
  value: string
  onValueChange: (value: string) => void
  placeholder: string
}) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const filteredCustomers = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const source = normalized
      ? customers.filter((customer) => getCustomerSearchTokens(customer).includes(normalized))
      : customers
    return source.slice(0, 12)
  }, [customers, query])

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
            {filteredCustomers.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</div>
            ) : (
              filteredCustomers.map((customer) => {
                const name = getCustomerDisplayName(customer)
                const document = customer.numeroDocumento ? ` · ${customer.numeroDocumento}` : ''
                const isActive = customer.id === value

                return (
                  <button
                    key={customer.id}
                    type="button"
                    className={
                      'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm ' +
                      (isActive ? 'bg-muted/80' : 'hover:bg-muted/60')
                    }
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onValueChange(customer.id)
                      setQuery('')
                      setIsOpen(false)
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate text-foreground">
                      {name}
                      <span className="text-muted-foreground">{document}</span>
                    </span>
                    <Badge variant={getCustomerStatusVariant(customer.activo)}>
                      {customer.activo ? 'ACTIVO' : 'INACTIVO'}
                    </Badge>
                  </button>
                )
              })
            )}
          </div>
        </Card>
      ) : null}
    </div>
  )
}

function toPayload(values: CustomerFormValues): CreateCustomerPayload {
  const rawCreditLimit = Number.isFinite(values.limiteCredito) ? values.limiteCredito : 0
  const limiteCredito = values.permitirCredito ? Math.max(0, rawCreditLimit) : 0

  return {
    tipoPersona: values.tipoPersona,
    tipoDocumento: values.tipoDocumento?.trim() ? values.tipoDocumento : undefined,
    numeroDocumento: values.numeroDocumento?.trim() || undefined,
    nombres: values.nombres?.trim() || undefined,
    apellidos: values.apellidos?.trim() || undefined,
    razonSocial: values.razonSocial?.trim() || undefined,
    email: values.email?.trim() || undefined,
    telefono: values.telefono?.trim() || undefined,
    direccion: values.direccion?.trim() || undefined,
    permitirCredito: values.permitirCredito,
    limiteCredito: Number(limiteCredito.toFixed(2)),
    ubigeo: values.ubigeo?.trim() || undefined,
    fechaNacimiento: values.fechaNacimiento?.trim() || undefined,
    observaciones: values.observaciones?.trim() || undefined,
  }
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <p className="text-xs text-destructive">{message}</p>
}

export function ClientesPage() {
  const { session } = useAuth()
  const accessToken = session?.accessToken ?? ''

  const [activeTab, setActiveTab] = useState<
    | 'padron'
    | 'historial-compras'
    | 'estado-cuenta'
    | 'equipos-cliente'
    | 'ordenes-rt'
    | 'pagos-os'
    | 'garantias'
  >('padron')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customerSales, setCustomerSales] = useState<CustomerSalesResponse['sales']>([])
  const [customerSalesLoading, setCustomerSalesLoading] = useState(false)
  const [customerSalesError, setCustomerSalesError] = useState<string | null>(null)

  const [accountStatement, setAccountStatement] =
    useState<CustomerAccountStatementResponse | null>(null)
  const [accountStatementLoading, setAccountStatementLoading] = useState(false)
  const [accountStatementError, setAccountStatementError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'todos' | CustomerStatusFilter>('todos')
  const [dashboard, setDashboard] = useState<CustomersDashboardResponse>(defaultDashboard)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<CustomerItem | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CustomerItem | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false)
  const [paymentMethodResetKey, setPaymentMethodResetKey] = useState(0)
  const paymentAmountInputRef = useRef<HTMLInputElement | null>(null)

  // ================ RayegoTech: tabs RT por cliente ================
  const [equiposCliente, setEquiposCliente] = useState<ClienteEquipo[]>([])
  const [equiposClienteLoading, setEquiposClienteLoading] = useState(false)
  const [ordenesRT, setOrdenesRT] = useState<OrdenServicio[]>([])
  const [ordenesRTLoading, setOrdenesRTLoading] = useState(false)
  const [pagosOS, setPagosOS] = useState<OrdenPago[]>([])
  const [pagosOSLoading, setPagosOSLoading] = useState(false)
  const [garantiasRT, setGarantiasRT] = useState<GarantiaOrden[]>([])
  const [garantiasRTLoading, setGarantiasRTLoading] = useState(false)

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: defaultFormValues,
  })

  const paymentForm = useForm<CustomerPaymentFormValues>({
    resolver: zodResolver(customerPaymentSchema),
    defaultValues: {
      monto: 0,
      formaPagoId: '',
      referenciaExterna: null,
      observaciones: null,
    },
  })

  const formTipoPersona = form.watch('tipoPersona')
  const formTipoDocumento = form.watch('tipoDocumento')
  const formPermitirCredito = form.watch('permitirCredito')

  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) {
      return null
    }

    return dashboard.customers.find((customer) => customer.id === selectedCustomerId) ?? null
  }, [dashboard.customers, selectedCustomerId])

  const _accountSummary = useMemo(() => {
    if (!selectedCustomer) {
      return null
    }

    const creditLimit = accountStatement?.summary.creditLimit ?? selectedCustomer.limiteCredito
    const outstanding = accountStatement?.summary.outstandingAmount ?? selectedCustomer.saldoPendiente
    const available =
      accountStatement?.summary.availableCredit ??
      Math.max(0, Number((creditLimit - outstanding).toFixed(2)))

    return { creditLimit, outstanding, available }
  }, [accountStatement, selectedCustomer])
  void _accountSummary

  const handleUnauthorized = useHandleUnauthorized('ClientesPage')

  const loadDashboard = useCallback(async () => {
    if (!accessToken) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await customersService.getDashboard(accessToken, {
        search,
        status: statusFilter === 'todos' ? undefined : statusFilter,
      })
      setDashboard(response)
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorized()
        return
      }

      setError(getApiErrorMessage(nextError))
      setDashboard(defaultDashboard)
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, handleUnauthorized, search, statusFilter])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const loadCustomerSales = useCallback(
    async (customerId: string) => {
      if (!accessToken) {
        return
      }

      setCustomerSalesLoading(true)
      setCustomerSalesError(null)

      try {
        const response = await customersService.getSales(accessToken, customerId)
        setCustomerSales(response.sales)
      } catch (nextError) {
        if (nextError instanceof ApiError && nextError.status === 401) {
          await handleUnauthorized()
          return
        }

        setCustomerSales([])
        setCustomerSalesError(getApiErrorMessage(nextError))
      } finally {
        setCustomerSalesLoading(false)
      }
    },
    [accessToken, handleUnauthorized],
  )

  const loadAccountStatement = useCallback(
    async (customerId: string) => {
      if (!accessToken) {
        return
      }

      setAccountStatementLoading(true)
      setAccountStatementError(null)

      try {
        const response = await customersService.getAccountStatement(accessToken, customerId)
        setAccountStatement(response)
      } catch (nextError) {
        if (nextError instanceof ApiError && nextError.status === 401) {
          await handleUnauthorized()
          return
        }

        setAccountStatement(null)
        setAccountStatementError(getApiErrorMessage(nextError))
      } finally {
        setAccountStatementLoading(false)
      }
    },
    [accessToken, handleUnauthorized],
  )

  // ================ RayegoTech: loaders tabs RT por cliente ================
  const loadEquiposCliente = useCallback(
    async (clienteId: string) => {
      if (!accessToken) return
      try {
        setEquiposClienteLoading(true)
        const res = await rtService.listEquipos(clienteId)
        setEquiposCliente(res.items || [])
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          await handleUnauthorized()
          return
        }
        if (!(err instanceof ApiNetworkError) && !(err instanceof ApiError)) throw err
        setEquiposCliente([])
      } finally {
        setEquiposClienteLoading(false)
      }
    },
    [accessToken, handleUnauthorized],
  )
  const loadOrdenesRT = useCallback(
    async (clienteId: string) => {
      if (!accessToken) return
      try {
        setOrdenesRTLoading(true)
        const res = await rtService.listOrdenes({ clienteId })
        setOrdenesRT(res.items || [])
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          await handleUnauthorized()
          return
        }
        if (!(err instanceof ApiNetworkError) && !(err instanceof ApiError)) throw err
        setOrdenesRT([])
      } finally {
        setOrdenesRTLoading(false)
      }
    },
    [accessToken, handleUnauthorized],
  )
  const loadPagosOS = useCallback(
    async (clienteId: string) => {
      setPagosOS([])
      setPagosOSLoading(true)
      try {
        const ordenes = await rtService.listOrdenes({ clienteId })
        const todos: OrdenPago[] = []
        for (const o of ordenes.items || []) {
          if (o.pagos && o.pagos.length > 0) todos.push(...o.pagos)
        }
        setPagosOS(todos)
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          await handleUnauthorized()
          return
        }
        if (!(err instanceof ApiNetworkError) && !(err instanceof ApiError)) throw err
      } finally {
        setPagosOSLoading(false)
      }
    },
    [accessToken, handleUnauthorized],
  )
  const loadGarantiasRT = useCallback(
    async (clienteId: string) => {
      setGarantiasRT([])
      setGarantiasRTLoading(true)
      try {
        const ordenes = await rtService.listOrdenes({ clienteId })
        const todas: GarantiaOrden[] = []
        for (const o of ordenes.items || []) {
          if (o.garantia) todas.push(o.garantia)
        }
        setGarantiasRT(todas)
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          await handleUnauthorized()
          return
        }
        if (!(err instanceof ApiNetworkError) && !(err instanceof ApiError)) throw err
      } finally {
        setGarantiasRTLoading(false)
      }
    },
    [accessToken, handleUnauthorized],
  )

  useEffect(() => {
    if (!selectedCustomerId) {
      setCustomerSales([])
      setCustomerSalesError(null)
      setAccountStatement(null)
      setAccountStatementError(null)
      setEquiposCliente([])
      setOrdenesRT([])
      setPagosOS([])
      setGarantiasRT([])
      return
    }

    if (activeTab === 'historial-compras') {
      void loadCustomerSales(selectedCustomerId)
      return
    }

    if (activeTab === 'estado-cuenta') {
      void loadAccountStatement(selectedCustomerId)
      return
    }

    if (activeTab === 'equipos-cliente') {
      void loadEquiposCliente(selectedCustomerId)
      return
    }

    if (activeTab === 'ordenes-rt') {
      void loadOrdenesRT(selectedCustomerId)
      return
    }

    if (activeTab === 'pagos-os') {
      void loadPagosOS(selectedCustomerId)
      return
    }

    if (activeTab === 'garantias') {
      void loadGarantiasRT(selectedCustomerId)
    }
  }, [
    activeTab,
    loadAccountStatement,
    loadCustomerSales,
    loadEquiposCliente,
    loadGarantiasRT,
    loadOrdenesRT,
    loadPagosOS,
    selectedCustomerId,
  ])

  function handleClearSelectedClient() {
    setSelectedCustomerId('')
    setCustomerSales([])
    setCustomerSalesError(null)
    setAccountStatement(null)
    setAccountStatementError(null)
    setEquiposCliente([])
    setOrdenesRT([])
    setPagosOS([])
    setGarantiasRT([])
    setIsPaymentDialogOpen(false)
    paymentForm.reset({
      monto: 0,
      formaPagoId: '',
      referenciaExterna: null,
      observaciones: null,
    })
  }

  function openPaymentDialog() {
    const outstanding = accountStatement?.totals?.outstandingAmount ?? 0
    const defaultAmount = Number(outstanding.toFixed(2))
    paymentForm.reset({
      monto: defaultAmount,
      formaPagoId: '',
      referenciaExterna: null,
      observaciones: null,
    })
    setPaymentMethodResetKey((prev) => prev + 1)
    setIsPaymentDialogOpen(true)
    window.requestAnimationFrame(() => {
      if (paymentAmountInputRef.current) {
        paymentAmountInputRef.current.value = defaultAmount > 0 ? defaultAmount.toFixed(2) : ''
      }
    })
  }

  async function handleSubmitPayment() {
    if (!selectedCustomerId) {
      return
    }

    const maxAmount = accountStatement?.totals?.outstandingAmount ?? 0
    let rawAmount = 0
    if (paymentAmountInputRef.current) {
      const raw = paymentAmountInputRef.current.value
      if (raw === '' || raw === null || raw === undefined) {
        paymentForm.setError('monto', {
          type: 'manual',
          message: 'Ingresa el monto a pagar.',
        })
        return
      }
      const parsed = Number(raw)
      if (!Number.isFinite(parsed)) {
        paymentForm.setError('monto', {
          type: 'manual',
          message: 'Ingresa un monto válido.',
        })
        return
      }
      rawAmount = parsed
    } else {
      rawAmount = Number(paymentForm.getValues('monto'))
    }

    const amount = Number(rawAmount.toFixed(2))

    if (amount <= 0) {
      paymentForm.setError('monto', {
        type: 'manual',
        message: 'El monto debe ser mayor a 0.',
      })
      return
    }

    if (amount > maxAmount + 0.0001) {
      paymentForm.setError('monto', {
        type: 'manual',
        message: `El monto no puede superar el saldo pendiente de ${formatCurrency(
          maxAmount,
        )}.`,
      })
      return
    }

    paymentForm.setValue('monto', amount, { shouldValidate: true })

    const formaPagoId = paymentForm.getValues('formaPagoId')
    if (!formaPagoId?.trim()) {
      paymentForm.setError('formaPagoId', {
        type: 'manual',
        message: 'Selecciona un medio de pago.',
      })
      return
    }

    const isValid = await paymentForm.trigger()
    if (!isValid) {
      return
    }

    const values = paymentForm.getValues()

    setIsPaymentSubmitting(true)
    try {
      const payload: RegisterCustomerPaymentPayload = {
        monto: Number(values.monto.toFixed(2)),
        formaPagoId: values.formaPagoId,
        referenciaExterna: values.referenciaExterna?.trim() || null,
        observaciones: values.observaciones?.trim() || null,
      }

      const response = await customersService.registerPayment(
        accessToken,
        selectedCustomerId,
        payload,
      )

      toast.success(
        `Pago de ${formatCurrency(payload.monto)} registrado. Nuevo saldo: ${formatCurrency(
          response.newBalance,
        )}`,
      )
      setIsPaymentDialogOpen(false)
      paymentForm.reset({
        monto: 0,
        formaPagoId: '',
        referenciaExterna: null,
        observaciones: null,
      })

      await Promise.all([
        loadAccountStatement(selectedCustomerId),
        loadCustomerSales(selectedCustomerId),
      ])
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorized()
        return
      }
      toast.error(getApiErrorMessage(nextError))
    } finally {
      setIsPaymentSubmitting(false)
    }
  }

  useEffect(() => {
    if (!selectedCustomerId) {
      return
    }

    const interval = window.setInterval(() => {
      if (activeTab === 'historial-compras') {
        void loadCustomerSales(selectedCustomerId)
        return
      }

      if (activeTab === 'estado-cuenta') {
        void loadAccountStatement(selectedCustomerId)
      }
    }, 15000)

    return () => window.clearInterval(interval)
  }, [activeTab, loadAccountStatement, loadCustomerSales, selectedCustomerId])

  function openCreateDialog() {
    setEditingCustomer(null)
    form.reset({
      ...defaultFormValues,
      tipoPersona: dashboard.options.tiposPersona[0] ?? 'NATURAL',
      tipoDocumento: dashboard.options.tiposDocumento[0] ?? '',
      activo: true,
    })
    setIsDialogOpen(true)
  }

  function openEditDialog(customer: CustomerItem) {
    setEditingCustomer(customer)
    form.reset({
      tipoPersona: customer.tipoPersona,
      tipoDocumento: customer.tipoDocumento ?? '',
      numeroDocumento: customer.numeroDocumento ?? '',
      nombres: customer.nombres ?? '',
      apellidos: customer.apellidos ?? '',
      razonSocial: customer.razonSocial ?? '',
      email: customer.email ?? '',
      telefono: customer.telefono ?? '',
      direccion: customer.direccion ?? '',
      permitirCredito: customer.permitirCredito,
      limiteCredito: customer.limiteCredito,
      ubigeo: customer.ubigeo ?? '',
      fechaNacimiento: customer.fechaNacimiento ? customer.fechaNacimiento.slice(0, 10) : '',
      observaciones: customer.observaciones ?? '',
      activo: customer.activo,
    })
    setIsDialogOpen(true)
  }

  function openDeleteDialog(customer: CustomerItem) {
    setDeleteTarget(customer)
    setIsDeleteDialogOpen(true)
  }

  async function handleSaveCustomer(values: CustomerFormValues) {
    if (!accessToken) {
      toast.error('La sesión no está disponible.')
      return
    }

    setIsSubmitting(true)

    try {
      const payload = toPayload(values)

      if (editingCustomer) {
        await customersService.update(accessToken, editingCustomer.id, {
          ...payload,
          activo: values.activo,
        })
        toast.success('Cliente actualizado correctamente.')
      } else {
        await customersService.create(accessToken, payload)
        toast.success('Cliente registrado correctamente.')
      }

      setIsDialogOpen(false)
      setEditingCustomer(null)
      form.reset(defaultFormValues)
      await loadDashboard()
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorized()
        return
      }

      toast.error(getApiErrorMessage(nextError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleToggleStatus(customer: CustomerItem) {
    if (!accessToken) {
      toast.error('La sesión no está disponible.')
      return
    }

    try {
      await customersService.update(accessToken, customer.id, {
        activo: !customer.activo,
      })
      toast.success(customer.activo ? 'Cliente desactivado.' : 'Cliente reactivado.')
      await loadDashboard()
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorized()
        return
      }

      toast.error(getApiErrorMessage(nextError))
    }
  }

  async function handleDeleteCustomer() {
    if (!accessToken || !deleteTarget) {
      toast.error('No hay cliente seleccionado para eliminar.')
      return
    }

    setIsDeleting(true)

    try {
      await customersService.remove(accessToken, deleteTarget.id)
      toast.success('Cliente eliminado correctamente.')
      setIsDeleteDialogOpen(false)
      setDeleteTarget(null)
      await loadDashboard()
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) {
        await handleUnauthorized()
        return
      }

      toast.error(getApiErrorMessage(nextError))
    } finally {
      setIsDeleting(false)
    }
  }

  const documentInputPlaceholder = useMemo(() => {
    if (formTipoDocumento === 'RUC') return 'Número de RUC'
    if (formTipoDocumento === 'DNI') return 'Número de DNI'
    if (formTipoDocumento === 'CE') return 'Carné de extranjería'
    return 'Número de documento'
  }, [formTipoDocumento])

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-foreground">Clientes</h1>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value as typeof activeTab)
        }
        className="w-full"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="padron">Padrón</TabsTrigger>
            <TabsTrigger value="historial-compras">Historial de compras</TabsTrigger>
            <TabsTrigger value="estado-cuenta">Estado de cuenta</TabsTrigger>
            <TabsTrigger value="equipos-cliente">
              <MonitorCog className="mr-1 h-4 w-4" /> Equipos
            </TabsTrigger>
            <TabsTrigger value="ordenes-rt">
              <Wrench className="mr-1 h-4 w-4" /> Órdenes ST
            </TabsTrigger>
            <TabsTrigger value="pagos-os">
              <CreditCard className="mr-1 h-4 w-4" /> Pagos OS
            </TabsTrigger>
            <TabsTrigger value="garantias">
              <ShieldCheck className="mr-1 h-4 w-4" /> Garantías
            </TabsTrigger>
          </TabsList>
          <Button type="button" size="sm" onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-1" />
            Nuevo cliente
          </Button>
        </div>

        <TabsContent value="padron" className="space-y-4 pt-4">
          <Card className="p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nombre, documento, teléfono o correo"
                  className="pl-9"
                />
              </div>

              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as 'todos' | CustomerStatusFilter)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="activo">Activos</SelectItem>
                  <SelectItem value="inactivo">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader className="h-7 w-7" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : dashboard.customers.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="text-sm font-medium text-foreground">
                No hay clientes registrados con los filtros actuales
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Crea el primer cliente para registrar ventas nominativas
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {dashboard.customers.map((customer) => (
                  <Card key={customer.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">
                          {customer.nombreCompleto ?? customer.razonSocial ?? 'Cliente'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {customer.tipoDocumento && customer.numeroDocumento
                            ? `${customer.tipoDocumento} · ${customer.numeroDocumento}`
                            : 'Sin documento'}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(customer)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStatus(customer)}>
                            <ShieldAlert className="mr-2 h-4 w-4" />
                            {customer.activo ? 'Desactivar' : 'Reactivar'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => openDeleteDialog(customer)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant={getCustomerStatusVariant(customer.activo)}>
                        {customer.activo ? 'ACTIVO' : 'INACTIVO'}
                      </Badge>
                    </div>

                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center justify-between gap-2">
                        <span>Teléfono</span>
                        <span className="text-foreground/80">{customer.telefono || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span>Última compra</span>
                        <span className="text-foreground/80">Nunca</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span>Saldo pendiente</span>
                        <span className="font-medium text-foreground">
                          {formatCurrency(customer.saldoPendiente)}
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="hidden md:block">
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead className="hidden lg:table-cell">Documento</TableHead>
                          <TableHead className="hidden md:table-cell">Teléfono</TableHead>
                          <TableHead className="hidden lg:table-cell">Última compra</TableHead>
                          <TableHead className="hidden lg:table-cell">Saldo pendiente</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="w-[80px] text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dashboard.customers.map((customer) => (
                          <TableRow key={customer.id}>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium text-foreground">
                                  {customer.nombreCompleto ?? customer.razonSocial ?? 'Cliente'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {customer.tipoPersona}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-muted-foreground">
                              {customer.tipoDocumento && customer.numeroDocumento
                                ? `${customer.tipoDocumento} · ${customer.numeroDocumento}`
                                : '—'}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">
                              {customer.telefono || '—'}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-muted-foreground">
                              Nunca
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-muted-foreground">
                              {formatCurrency(customer.saldoPendiente)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={getCustomerStatusVariant(customer.activo)}>
                                {customer.activo ? 'ACTIVO' : 'INACTIVO'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEditDialog(customer)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleToggleStatus(customer)}>
                                    <ShieldAlert className="mr-2 h-4 w-4" />
                                    {customer.activo ? 'Desactivar' : 'Reactivar'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => openDeleteDialog(customer)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Eliminar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="historial-compras" className="space-y-4 pt-4">
          <Card className="p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_260px] md:items-end">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Historial de compras</p>
                <p className="text-xs text-muted-foreground">
                  Visualiza todas las ventas emitidas a nombre del cliente.
                </p>
              </div>
              <CustomerAutocomplete
                customers={dashboard.customers}
                value={selectedCustomerId}
                onValueChange={(value) => {
                  setSelectedCustomerId(value)
                }}
                placeholder="Buscar cliente por nombre o documento"
              />
            </div>

            {selectedCustomer ? (
              <div className="mt-4 rounded-xl border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      Cliente seleccionado
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground">
                      {getCustomerDisplayName(selectedCustomer)}
                      {selectedCustomer.tipoDocumento && selectedCustomer.numeroDocumento
                        ? ` · ${selectedCustomer.tipoDocumento} ${selectedCustomer.numeroDocumento}`
                        : ''}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={handleClearSelectedClient}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Limpiar cliente</span>
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>

          {!selectedCustomer ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="text-sm font-medium text-foreground">
                Selecciona un cliente para consultar su historial de compras.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Usa el buscador superior o el padrón para comenzar.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => setActiveTab('padron')}
              >
                Ir al padrón
              </Button>
            </div>
          ) : customerSalesLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader className="h-7 w-7" />
            </div>
          ) : customerSalesError ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {customerSalesError}
            </div>
          ) : customerSales.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="text-sm font-medium text-foreground">
                Este cliente aún no registra compras.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cuando se emitan ventas a su nombre aparecerán aquí.
              </p>
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Comprobante</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Pagado</TableHead>
                      <TableHead className="text-right">Saldo pendiente</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="w-[160px] text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerSales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(sale.createdAt)}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{sale.document}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(sale.totalAmount)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(sale.paidAmount)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(sale.outstandingAmount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getSaleStatusVariant(sale.status)}>
                            {getSaleStatusLabel(sale.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" size="sm" disabled>
                              Ver
                            </Button>
                            <Button type="button" variant="outline" size="sm" disabled>
                              PDF
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="estado-cuenta" className="space-y-4 pt-4">
          <Card className="p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_260px] md:items-end">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Estado de cuenta</p>
                <p className="text-xs text-muted-foreground">
                  Resumen del crédito del cliente y movimientos futuros.
                </p>
              </div>
              <CustomerAutocomplete
                customers={dashboard.customers}
                value={selectedCustomerId}
                onValueChange={(value) => {
                  setSelectedCustomerId(value)
                }}
                placeholder="Buscar cliente por nombre o documento"
              />
            </div>

            {selectedCustomer ? (
              <div className="mt-4 rounded-xl border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      Cliente seleccionado
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground">
                      {getCustomerDisplayName(selectedCustomer)}
                      {selectedCustomer.tipoDocumento && selectedCustomer.numeroDocumento
                        ? ` · ${selectedCustomer.tipoDocumento} ${selectedCustomer.numeroDocumento}`
                        : ''}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={handleClearSelectedClient}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Limpiar cliente</span>
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>

          {!selectedCustomer || !accountStatement?.totals ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="text-sm font-medium text-foreground">
                Selecciona un cliente para consultar su saldo y movimientos.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Usa el buscador superior o el padrón para comenzar.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => setActiveTab('padron')}
              >
                Ir al padrón
              </Button>
            </div>
          ) : accountStatementLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader className="h-7 w-7" />
            </div>
          ) : accountStatementError ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {accountStatementError}
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground">Total comprado</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {formatCurrency(accountStatement.totals.totalPurchased)}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground">Total pagado</p>
                  <p className="mt-2 text-lg font-semibold text-emerald-600">
                    {formatCurrency(accountStatement.totals.totalPaid)}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground">Saldo pendiente</p>
                  <p
                    className={
                      'mt-2 text-lg font-semibold ' +
                      (accountStatement.totals.outstandingAmount > 0
                        ? 'text-rose-600'
                        : 'text-emerald-600')
                    }
                  >
                    {formatCurrency(accountStatement.totals.outstandingAmount)}
                  </p>
                </Card>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={openPaymentDialog}
                  disabled={
                    accountStatement.totals.outstandingAmount <= 0 || accountStatementLoading
                  }
                >
                  Registrar pago
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo de movimiento</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>Medio</TableHead>
                        <TableHead className="text-right">Cargo</TableHead>
                        <TableHead className="text-right">Abono</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accountStatement?.movements.length ? (
                        accountStatement.movements.map((movement) => (
                          <TableRow key={movement.id}>
                            <TableCell className="text-muted-foreground">
                              {formatDateTime(movement.createdAt)}
                            </TableCell>
                            <TableCell className="font-medium text-foreground">
                              {movement.movement}
                              {movement.reference ? (
                                <span className="block text-xs font-normal text-muted-foreground">
                                  Ref. {movement.reference}
                                </span>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{movement.document}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {movement.paymentMethodName ? (
                                <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                                  {movement.paymentMethodName}
                                </span>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {movement.chargeAmount > 0 ? formatCurrency(movement.chargeAmount) : '—'}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {movement.paymentAmount > 0 ? formatCurrency(movement.paymentAmount) : '—'}
                            </TableCell>
                            <TableCell className="text-right font-medium text-foreground">
                              {formatCurrency(movement.balanceAmount)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                            No existen movimientos para este cliente.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="equipos-cliente" className="space-y-4 pt-4">
          <AuthorizationGate permission="equiposCliente.read">
            <Card className="p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_260px] md:items-end">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MonitorCog className="h-4 w-4 text-primary" /> Equipos del cliente
                  </CardTitle>
                  <CardDescription>
                    Equipos registrados del cliente en el módulo Servicio Técnico.
                  </CardDescription>
                </div>
                <CustomerAutocomplete
                  customers={dashboard.customers}
                  value={selectedCustomerId}
                  onValueChange={(value) => setSelectedCustomerId(value)}
                  placeholder="Seleccionar cliente"
                />
              </div>
              {selectedCustomer ? (
                <div className="mt-4 rounded-xl border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Cliente</p>
                      <p className="mt-1 truncate text-sm font-semibold text-foreground">
                        {getCustomerDisplayName(selectedCustomer)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={handleClearSelectedClient}
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Limpiar</span>
                    </Button>
                  </div>
                </div>
              ) : null}
            </Card>

            {!selectedCustomer ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="text-sm font-medium text-foreground">Selecciona un cliente</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Usa el buscador superior o el padrón.
                </p>
              </div>
            ) : equiposClienteLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader className="h-7 w-7" />
              </div>
            ) : equiposCliente.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="text-sm font-medium text-foreground">Sin equipos registrados</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Los equipos se pueden asociar desde la Orden de Servicio.
                </p>
              </div>
            ) : (
              <Card className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo equipo</TableHead>
                      <TableHead>Marca / Modelo</TableHead>
                      <TableHead>N° Serie</TableHead>
                      <TableHead>Estado físico</TableHead>
                      <TableHead>Garantía</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equiposCliente.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">
                          {e.tipoEquipo?.nombre || (e as any).tipoEquipoNombre || '—'}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p>{e.marca || '—'}</p>
                            <p className="text-xs text-muted-foreground">{e.modelo || '—'}</p>
                          </div>
                        </TableCell>
                        <TableCell>{e.numeroSerie || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{e.estadoFisico || '—'}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {e.createdAt
                            ? new Date(e.createdAt).toLocaleDateString('es-PE')
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </AuthorizationGate>
        </TabsContent>

        <TabsContent value="ordenes-rt" className="space-y-4 pt-4">
          <AuthorizationGate permission="ordenesServicio.read">
            <Card className="p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_260px] md:items-end">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Wrench className="h-4 w-4 text-primary" /> Órdenes de Servicio
                  </CardTitle>
                  <CardDescription>
                    Historial de Órdenes de Servicio del cliente seleccionado.
                  </CardDescription>
                </div>
                <CustomerAutocomplete
                  customers={dashboard.customers}
                  value={selectedCustomerId}
                  onValueChange={(value) => setSelectedCustomerId(value)}
                  placeholder="Seleccionar cliente"
                />
              </div>
              {selectedCustomer ? (
                <div className="mt-4 rounded-xl border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Cliente</p>
                      <p className="mt-1 truncate text-sm font-semibold text-foreground">
                        {getCustomerDisplayName(selectedCustomer)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={handleClearSelectedClient}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </Card>

            {!selectedCustomer ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="text-sm font-medium text-foreground">Selecciona un cliente</p>
              </div>
            ) : ordenesRTLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader className="h-7 w-7" />
              </div>
            ) : ordenesRT.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="text-sm font-medium text-foreground">Sin órdenes de servicio</p>
              </div>
            ) : (
              <Card className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° OS</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Equipo</TableHead>
                      <TableHead>Técnico</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordenesRT.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs font-semibold text-primary">
                          {o.numeroOrden}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              (o.estado as string) === 'ENTREGADO' || (o.estado as string) === 'CERRADO'
                                ? 'success'
                                : (o.estado as string) === 'CANCELADO' || (o.estado as string) === 'RECHAZADO' || (o.estado as string) === 'DEVUELTO'
                                  ? 'destructive'
                                  : (o.estado as string) === 'DIAGNOSTICO' || (o.estado as string) === 'PRESUPUESTO'
                                    ? 'warning'
                                    : (o.estado as string) === 'ESPERANDO_APROBACION'
                                      ? 'info'
                                      : 'default'
                            }
                          >
                            {o.estado}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {o.clienteEquipo?.tipoEquipo?.nombre ||
                            (o.clienteEquipo as any)?.tipoEquipoNombre ||
                            '—'}
                        </TableCell>
                        <TableCell>
                          {o.tecnicoAsignado?.usuario
                            ? `${o.tecnicoAsignado.usuario.nombres} ${o.tecnicoAsignado.usuario.apellidos || ''}`.trim()
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          S/ {Number(o.total ?? 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {o.fechaRecepcion
                            ? new Date(o.fechaRecepcion).toLocaleDateString('es-PE')
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </AuthorizationGate>
        </TabsContent>

        <TabsContent value="pagos-os" className="space-y-4 pt-4">
          <AuthorizationGate permission="pagosOrdenServicio.write">
            <Card className="p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_260px] md:items-end">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCard className="h-4 w-4 text-primary" /> Pagos · Órdenes Servicio
                  </CardTitle>
                  <CardDescription>
                    Pagos asociados a Órdenes de Servicio del cliente seleccionado.
                  </CardDescription>
                </div>
                <CustomerAutocomplete
                  customers={dashboard.customers}
                  value={selectedCustomerId}
                  onValueChange={(value) => setSelectedCustomerId(value)}
                  placeholder="Seleccionar cliente"
                />
              </div>
              {selectedCustomer ? (
                <div className="mt-4 rounded-xl border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Cliente</p>
                      <p className="mt-1 truncate text-sm font-semibold text-foreground">
                        {getCustomerDisplayName(selectedCustomer)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={handleClearSelectedClient}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </Card>

            {!selectedCustomer ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="text-sm font-medium text-foreground">Selecciona un cliente</p>
              </div>
            ) : pagosOSLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader className="h-7 w-7" />
              </div>
            ) : pagosOS.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="text-sm font-medium text-foreground">Sin pagos por Órdenes</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Los pagos de Órdenes de Servicio se registran en la misma OS.
                </p>
              </div>
            ) : (
              <Card className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>N° OS</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagosOS.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.fechaPago
                            ? new Date(p.fechaPago).toLocaleDateString('es-PE')
                            : '—'}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-primary">
                          {(p as any).numeroOrden || '—'}
                        </TableCell>
                        <TableCell>{(p as any).formaPago?.nombre || p.formaPagoId || '—'}</TableCell>
                        <TableCell>{p.referencia || '—'}</TableCell>
                        <TableCell className="text-right font-medium">
                          S/ {Number(p.monto ?? 0).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </AuthorizationGate>
        </TabsContent>

        <TabsContent value="garantias" className="space-y-4 pt-4">
          <AuthorizationGate permission="ordenesServicio.read">
            <Card className="p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_260px] md:items-end">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldCheck className="h-4 w-4 text-primary" /> Garantías
                  </CardTitle>
                  <CardDescription>
                    Garantías generadas al entregar Órdenes de Servicio del cliente.
                  </CardDescription>
                </div>
                <CustomerAutocomplete
                  customers={dashboard.customers}
                  value={selectedCustomerId}
                  onValueChange={(value) => setSelectedCustomerId(value)}
                  placeholder="Seleccionar cliente"
                />
              </div>
              {selectedCustomer ? (
                <div className="mt-4 rounded-xl border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Cliente</p>
                      <p className="mt-1 truncate text-sm font-semibold text-foreground">
                        {getCustomerDisplayName(selectedCustomer)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={handleClearSelectedClient}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </Card>

            {!selectedCustomer ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="text-sm font-medium text-foreground">Selecciona un cliente</p>
              </div>
            ) : garantiasRTLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader className="h-7 w-7" />
              </div>
            ) : garantiasRT.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="text-sm font-medium text-foreground">Sin garantías activas</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Las garantías se generan al entregar una Orden de Servicio.
                </p>
              </div>
            ) : (
              <Card className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° OS</TableHead>
                      <TableHead>Inicio</TableHead>
                      <TableHead>Vence</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {garantiasRT.map((g) => {
                      const vence = g.fechaFin ? new Date(g.fechaFin) : null
                      const hoy = new Date()
                      const vencida = vence ? vence < hoy : false
                      return (
                        <TableRow key={g.id}>
                          <TableCell className="font-mono text-xs font-semibold text-primary">
                            {(g as any).numeroOrden || '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {g.fechaInicio
                              ? new Date(g.fechaInicio).toLocaleDateString('es-PE')
                              : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {vence ? vence.toLocaleDateString('es-PE') : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={vencida ? 'destructive' : 'success'}>
                              {vencida ? 'Vencida' : g.estado || 'Vigente'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {g.terminos || '—'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </AuthorizationGate>
        </TabsContent>
      </Tabs>

      <Dialog
        open={isPaymentDialogOpen}
        onOpenChange={(open) => {
          setIsPaymentDialogOpen(open)
          if (!open) {
            paymentForm.reset({
              monto: 0,
              formaPagoId: '',
              referenciaExterna: null,
              observaciones: null,
            })
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Registrar pago de cliente</DialogTitle>
            <DialogDescription>
              Aplica un pago a la deuda pendiente. Se afectarán las ventas más antiguas primero.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-5"
            onSubmit={(ev) => {
              ev.preventDefault()
              void handleSubmitPayment()
            }}
          >
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs font-medium text-muted-foreground">Saldo pendiente</p>
              <p className="mt-1 text-xl font-semibold text-rose-600">
                {formatCurrency(accountStatement?.totals?.outstandingAmount ?? 0)}
              </p>
              {accountStatement?.pendingSales?.length ? (
                <div className="mt-3 border-t border-muted pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Se aplicará a (FIFO):
                  </p>
                  <ul className="mt-1.5 space-y-1.5 text-xs">
                    {accountStatement.pendingSales.slice(0, 3).map((sale) => (
                      <li key={sale.saleId} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500/80" />
                          <span className="font-medium text-foreground">{sale.document}</span>
                          <span className="text-muted-foreground">
                            {formatDateTime(sale.issueDate).slice(0, 10)}
                          </span>
                        </span>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(sale.outstandingAmount)}
                        </span>
                      </li>
                    ))}
                    {accountStatement.pendingSales.length > 3 ? (
                      <li className="pt-1 text-[11px] text-muted-foreground">
                        +{accountStatement.pendingSales.length - 3} comprobante
                        {accountStatement.pendingSales.length - 3 === 1 ? '' : 's'} más por{' '}
                        <span className="font-semibold text-foreground">
                          {formatCurrency(
                            accountStatement.pendingSales
                              .slice(3)
                              .reduce((sum, s) => sum + s.outstandingAmount, 0),
                          )}
                        </span>
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Monto a pagar <span className="text-rose-600">*</span>
              </label>
              {(() => {
                const maxAmount = accountStatement?.totals?.outstandingAmount ?? 0
                const montoError = paymentForm.formState.errors.monto?.message
                return (
                  <div className="space-y-1">
                    <Input
                      ref={paymentAmountInputRef}
                      type="number"
                      step="0.01"
                      min={0.01}
                      max={maxAmount}
                      onBlur={(ev) => {
                        const raw = ev.target.value
                        if (!raw) {
                          paymentForm.setValue('monto', 0)
                          paymentForm.setError('monto', {
                            type: 'manual',
                            message: 'Ingresa el monto a pagar.',
                          })
                          return
                        }
                        const parsed = Number(raw)
                        if (!Number.isFinite(parsed)) {
                          paymentForm.setValue('monto', 0)
                          paymentForm.setError('monto', {
                            type: 'manual',
                            message: 'Ingresa un monto válido.',
                          })
                          return
                        }
                        const amount = Number(parsed.toFixed(2))
                        paymentForm.setValue('monto', amount)
                        if (amount <= 0) {
                          paymentForm.setError('monto', {
                            type: 'manual',
                            message: 'El monto debe ser mayor a 0.',
                          })
                          return
                        }
                        if (amount > maxAmount + 0.0001) {
                          paymentForm.setError('monto', {
                            type: 'manual',
                            message: `El monto no puede superar el saldo pendiente de ${formatCurrency(
                              maxAmount,
                            )}.`,
                          })
                          return
                        }
                        paymentForm.clearErrors('monto')
                      }}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      Máximo a pagar: <span className="font-medium">{formatCurrency(maxAmount)}</span>
                    </p>
                    {montoError && (
                      <p className="text-xs font-medium text-rose-600">{montoError}</p>
                    )}
                  </div>
                )
              })()}
            </div>

            <FormPaymentMethodTwoLevelSelect
              key={paymentMethodResetKey}
              control={paymentForm.control}
              name="formaPagoId"
              methods={
                (accountStatement?.options?.paymentMethods ??
                  []) as PaymentMethodOption[]
              }
              required
              id="customer-payment"
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">Referencia</label>
              <Controller
                control={paymentForm.control}
                name="referenciaExterna"
                render={({ field }) => (
                  <Input
                    value={field.value ?? ''}
                    onChange={(ev) =>
                      field.onChange(ev.target.value === '' ? null : ev.target.value)
                    }
                    onBlur={field.onBlur}
                    placeholder="Opcional: código operación, voucher, N° externo..."
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Observaciones</label>
              <Controller
                control={paymentForm.control}
                name="observaciones"
                render={({ field }) => (
                  <Textarea
                    value={field.value ?? ''}
                    onChange={(ev) =>
                      field.onChange(ev.target.value === '' ? null : ev.target.value)
                    }
                    onBlur={field.onBlur}
                    rows={3}
                    placeholder="Opcional: comentarios internos sobre este pago..."
                  />
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isPaymentSubmitting}
                onClick={() => {
                  setIsPaymentDialogOpen(false)
                  paymentForm.reset({
                    monto: 0,
                    formaPagoId: '',
                    referenciaExterna: null,
                    observaciones: null,
                  })
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPaymentSubmitting}>
                {isPaymentSubmitting ? (
                  <>
                    <Loader className="mr-2 h-4 w-4" />
                    Registrando...
                  </>
                ) : (
                  'Registrar pago'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <SidePanel
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) {
            setEditingCustomer(null)
            form.reset(defaultFormValues)
          }
        }}
      >
        <SidePanelContent className="p-0">
          <form className="flex h-full flex-col" onSubmit={form.handleSubmit(handleSaveCustomer)}>
            <div className="flex items-start justify-between gap-4 border-b bg-popover px-6 py-4">
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">
                  {editingCustomer ? 'Editar cliente' : 'Registrar cliente'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Registra lo indispensable para vender rápido. RENIEC y SUNAT podrán completar
                  estos datos automáticamente más adelante.
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
                <Card className="p-4">
                  <p className="font-medium text-foreground">Datos principales</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Solo pedimos lo necesario para registrar al cliente en menos de un minuto.
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Tipo de persona</label>
                        <Controller
                          control={form.control}
                          name="tipoPersona"
                          render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona un tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                {dashboard.options.tiposPersona.map((item) => (
                                  <SelectItem key={item} value={item}>
                                    {item}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        <FieldError message={form.formState.errors.tipoPersona?.message} />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Tipo de documento</label>
                        <Controller
                          control={form.control}
                          name="tipoDocumento"
                          render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona un documento" />
                              </SelectTrigger>
                              <SelectContent>
                                {dashboard.options.tiposDocumento.map((item) => (
                                  <SelectItem key={item} value={item}>
                                    {item}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        <FieldError message={form.formState.errors.tipoDocumento?.message} />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Número de documento</label>
                        <Input
                          {...form.register('numeroDocumento')}
                          placeholder={documentInputPlaceholder}
                        />
                        <FieldError message={form.formState.errors.numeroDocumento?.message} />
                      </div>

                      {formTipoPersona === 'JURIDICA' ? (
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-sm font-medium">Razón social</label>
                          <Input {...form.register('razonSocial')} placeholder="Empresa SAC" />
                          <FieldError message={form.formState.errors.razonSocial?.message} />
                          <p className="text-xs text-muted-foreground">
                            Preparado para completar automáticamente desde SUNAT.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Nombre completo</label>
                            <Input {...form.register('nombres')} placeholder="Juan Pérez" />
                            <FieldError message={form.formState.errors.nombres?.message} />
                            <p className="text-xs text-muted-foreground">
                              Preparado para completar automáticamente desde RENIEC.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Apellidos (opcional)</label>
                            <Input {...form.register('apellidos')} placeholder="Pérez Gómez" />
                            <FieldError message={form.formState.errors.apellidos?.message} />
                          </div>
                        </>
                      )}

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Teléfono</label>
                        <Input {...form.register('telefono')} placeholder="987654321" />
                        <FieldError message={form.formState.errors.telefono?.message} />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Correo</label>
                        <Input
                          {...form.register('email')}
                          type="email"
                          placeholder="cliente@email.com"
                        />
                        <FieldError message={form.formState.errors.email?.message} />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium">Dirección</label>
                        <Input {...form.register('direccion')} placeholder="Dirección (opcional)" />
                        <FieldError message={form.formState.errors.direccion?.message} />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium">Observaciones</label>
                        <Textarea
                          {...form.register('observaciones')}
                          placeholder="Notas (alergias, referencias, contacto, etc.)"
                          className="min-h-24"
                        />
                        <FieldError message={form.formState.errors.observaciones?.message} />
                      </div>
                    </div>

                    <details className="mt-4 rounded-lg border bg-muted/20 p-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground">
                        <span>Información adicional</span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </summary>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Estos datos no son necesarios para registrar al cliente en caja.
                      </p>
                      <div className="mt-3 grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Fecha de nacimiento</label>
                          <Input {...form.register('fechaNacimiento')} type="date" />
                          <FieldError message={form.formState.errors.fechaNacimiento?.message} />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Ubigeo</label>
                          <Input {...form.register('ubigeo')} placeholder="150101" />
                          <FieldError message={form.formState.errors.ubigeo?.message} />
                        </div>
                      </div>
                    </details>
                  </Card>

                  <details className="rounded-xl border bg-card p-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">Configuración comercial</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Opcional. Úsalo cuando el cliente maneje crédito.
                        </p>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </summary>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">Permitir crédito</p>
                          <p className="text-xs text-muted-foreground">
                            Disponible próximamente en Ventas
                          </p>
                        </div>
                        <Controller
                          control={form.control}
                          name="permitirCredito"
                          render={({ field }) => (
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          )}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Límite de crédito</label>
                        <Input
                          type="number"
                          step="0.01"
                          disabled={!formPermitirCredito}
                          {...form.register('limiteCredito', {
                            setValueAs: (value) => {
                              if (value === '' || value === null || typeof value === 'undefined') {
                                return 0
                              }
                              const next = Number(value)
                              return Number.isFinite(next) ? next : 0
                            },
                          })}
                          placeholder="S/ 0.00"
                        />
                        <FieldError message={form.formState.errors.limiteCredito?.message} />
                      </div>
                    </div>
                  </details>

                  {editingCustomer ? (
                    <Card className="p-4">
                      <p className="font-medium text-foreground">Estado</p>
                      <div className="mt-3 flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">Cliente activo</p>
                          <p className="text-xs text-muted-foreground">
                            Disponible para selección en ventas
                          </p>
                        </div>
                        <Controller
                          control={form.control}
                          name="activo"
                          render={({ field }) => (
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          )}
                        />
                      </div>
                    </Card>
                  ) : null}
              </div>
            </div>

            <div className="border-t bg-popover px-6 py-4">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false)
                    setEditingCustomer(null)
                    form.reset(defaultFormValues)
                  }}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader className="h-4 w-4 text-current" />
                      Guardando...
                    </>
                  ) : editingCustomer ? (
                    <>
                      <Plus className="mr-1 h-4 w-4" />
                      Guardar cambios
                    </>
                  ) : (
                    <>
                      <Plus className="mr-1 h-4 w-4" />
                      Crear cliente
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </SidePanelContent>
      </SidePanel>

      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open)
          if (!open) {
            setDeleteTarget(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar cliente</DialogTitle>
            <DialogDescription>
              Esta acción hará una baja lógica del cliente y dejará de aparecer en el padrón activo.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/20 p-3 text-sm">
            {deleteTarget?.nombreCompleto || deleteTarget?.razonSocial || 'Cliente no seleccionado'}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false)
                setDeleteTarget(null)
              }}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteCustomer}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader className="h-4 w-4 text-current" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="mr-1 h-4 w-4" />
                  Confirmar baja
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
