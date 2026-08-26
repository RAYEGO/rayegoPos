import {
  CodigoFormaPago,
  EstadoAperturaCaja,
  EstadoVenta,
  OperacionCaja,
  Prisma,
  TipoDocumentoIdentidad,
  TipoMovimientoCaja,
  TipoPersona,
} from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { getAuthContext } from '../../lib/auth.js'
import { classifyPaymentMethod } from '../../shared/payment-catalog.js'

type CustomersFilters = {
  search?: string
  status?: 'activo' | 'inactivo'
}

type CreateCustomerPayload = {
  tipoPersona?: TipoPersona
  tipoDocumento?: TipoDocumentoIdentidad
  numeroDocumento?: string
  nombres?: string
  apellidos?: string
  razonSocial?: string
  email?: string
  telefono?: string
  direccion?: string
  permitirCredito?: boolean
  limiteCredito?: number
  ubigeo?: string
  fechaNacimiento?: string
  observaciones?: string
}

type UpdateCustomerPayload = Partial<CreateCustomerPayload> & { activo?: boolean }

type RegisterCustomerPaymentPayload = {
  monto: number
  formaPagoId: string
  referenciaExterna?: string | null
  observaciones?: string | null
}

function createHttpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number }
  error.statusCode = statusCode
  return error
}

function toOptionalString(value?: string | null) {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

function decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
  if (typeof value === 'number') {
    return value
  }

  return Number(value ?? 0)
}

function toDecimal(value: number, fractionDigits: number) {
  return new Prisma.Decimal(value.toFixed(fractionDigits))
}

function parseOptionalDate(value?: string | null) {
  const normalized = value?.trim()
  if (!normalized) return undefined
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    throw createHttpError(400, 'La fecha de nacimiento no es válida.')
  }
  return date
}

function normalizePersonName(input?: string | null) {
  const normalized = input?.trim()
  if (!normalized) return undefined
  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}

function buildFullName(payload: {
  tipoPersona: TipoPersona
  nombres?: string
  apellidos?: string
  razonSocial?: string
}) {
  if (payload.tipoPersona === TipoPersona.JURIDICA) {
    const razonSocial = normalizePersonName(payload.razonSocial)
    if (!razonSocial) {
      throw createHttpError(400, 'La razón social es obligatoria para persona jurídica.')
    }
    return {
      nombres: undefined,
      apellidos: undefined,
      razonSocial,
      nombreCompleto: razonSocial,
    }
  }

  const nombres = normalizePersonName(payload.nombres)
  if (!nombres) {
    throw createHttpError(400, 'Los nombres son obligatorios para persona natural.')
  }
  const apellidos = normalizePersonName(payload.apellidos)
  const nombreCompleto = `${nombres} ${apellidos ?? ''}`.trim()

  return {
    nombres,
    apellidos,
    razonSocial: undefined,
    nombreCompleto,
  }
}

const customerInclude = {
  createdBy: {
    select: {
      nombres: true,
      apellidos: true,
    },
  },
  updatedBy: {
    select: {
      nombres: true,
      apellidos: true,
    },
  },
} satisfies Prisma.ClienteInclude

type CustomerWithRelations = Prisma.ClienteGetPayload<{ include: typeof customerInclude }>

function formatFullName(user: { nombres: string; apellidos: string | null }) {
  return `${user.nombres} ${user.apellidos ?? ''}`.trim()
}

function mapCustomer(customer: CustomerWithRelations) {
  return {
    id: customer.id,
    tipoPersona: customer.tipoPersona,
    tipoDocumento: customer.tipoDocumento,
    numeroDocumento: customer.numeroDocumento,
    nombres: customer.nombres,
    apellidos: customer.apellidos,
    razonSocial: customer.razonSocial,
    nombreCompleto: customer.nombreCompleto,
    email: customer.email,
    telefono: customer.telefono,
    direccion: customer.direccion,
    permitirCredito: customer.permitirCredito,
    limiteCredito: decimalToNumber(customer.limiteCredito),
    saldoPendiente: decimalToNumber(customer.saldoPendiente),
    ubigeo: customer.ubigeo,
    fechaNacimiento: customer.fechaNacimiento ? customer.fechaNacimiento.toISOString() : null,
    activo: customer.activo,
    observaciones: customer.observaciones,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
    createdByName: customer.createdBy ? formatFullName(customer.createdBy) : null,
    updatedByName: customer.updatedBy ? formatFullName(customer.updatedBy) : null,
  }
}

export async function getCustomersDashboard(
  filters: CustomersFilters = {},
  request: FastifyRequest,
) {
  const { companyId } = await getAuthContext(request)

  const search = filters.search?.trim()
  const isActive =
    filters.status === 'activo' ? true : filters.status === 'inactivo' ? false : undefined

  const where: Prisma.ClienteWhereInput = {
    deletedAt: null,
    empresaId: companyId,
    ...(isActive !== undefined ? { activo: isActive } : {}),
    ...(search
      ? {
          OR: [
            {
              nombreCompleto: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              razonSocial: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              numeroDocumento: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              telefono: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              email: {
                contains: search,
                mode: 'insensitive',
              },
            },
          ],
        }
      : {}),
  }

  const customers = await prisma.cliente.findMany({
    where,
    include: customerInclude,
    orderBy: [{ nombreCompleto: 'asc' }, { createdAt: 'desc' }],
  })

  const mappedCustomers = customers.map(mapCustomer)
  const totalCustomers = mappedCustomers.length
  const activeCustomers = mappedCustomers.filter((c) => c.activo).length
  const inactiveCustomers = mappedCustomers.filter((c) => !c.activo).length
  const withDocument = mappedCustomers.filter((c) => c.numeroDocumento).length
  const withPhone = mappedCustomers.filter((c) => c.telefono).length

  return {
    summary: {
      totalCustomers,
      activeCustomers,
      inactiveCustomers,
      withDocument,
      withPhone,
    },
    customers: mappedCustomers,
    options: {
      tiposPersona: Object.values(TipoPersona),
      tiposDocumento: Object.values(TipoDocumentoIdentidad),
    },
  }
}

export async function createCustomer(payload: CreateCustomerPayload, request: FastifyRequest) {
  const { userId, companyId } = await getAuthContext(request)
  const tipoPersona = payload.tipoPersona ?? TipoPersona.NATURAL

  const normalizedDocument = toOptionalString(payload.numeroDocumento)

  if (normalizedDocument) {
    const existingCustomer = await prisma.cliente.findFirst({
      where: { numeroDocumento: normalizedDocument, empresaId: companyId, deletedAt: null },
    })
    if (existingCustomer) {
      throw createHttpError(409, 'Ya existe un cliente con ese número de documento.')
    }
  }

  const nameFields = buildFullName({
    tipoPersona,
    nombres: payload.nombres,
    apellidos: payload.apellidos,
    razonSocial: payload.razonSocial,
  })

  const rawCreditLimit = payload.limiteCredito ?? 0
  if (!Number.isFinite(rawCreditLimit) || rawCreditLimit < 0) {
    throw createHttpError(400, 'El límite de crédito debe ser mayor o igual a 0.')
  }

  const permitirCredito = payload.permitirCredito ?? false
  const limiteCredito = permitirCredito ? Number(rawCreditLimit.toFixed(2)) : 0

  const customer = await prisma.cliente.create({
    data: {
      empresaId: companyId,
      tipoPersona,
      tipoDocumento: payload.tipoDocumento ?? null,
      numeroDocumento: normalizedDocument,
      ...nameFields,
      email: toOptionalString(payload.email),
      telefono: toOptionalString(payload.telefono),
      direccion: toOptionalString(payload.direccion),
      permitirCredito,
      limiteCredito: toDecimal(limiteCredito, 2),
      ubigeo: toOptionalString(payload.ubigeo),
      fechaNacimiento: parseOptionalDate(payload.fechaNacimiento) ?? null,
      observaciones: toOptionalString(payload.observaciones),
      activo: true,
      createdById: userId,
      updatedById: userId,
    },
    include: customerInclude,
  })

  return { item: mapCustomer(customer) }
}

export async function updateCustomer(
  customerId: string,
  payload: UpdateCustomerPayload,
  request: FastifyRequest,
) {
  const { userId, companyId } = await getAuthContext(request)

  const existingCustomer = await prisma.cliente.findFirst({
    where: { id: customerId, deletedAt: null, empresaId: companyId },
  })

  if (!existingCustomer) {
    throw createHttpError(404, 'El cliente no fue encontrado.')
  }

  const normalizedDocument =
    payload.numeroDocumento !== undefined ? toOptionalString(payload.numeroDocumento) : undefined

  if (normalizedDocument && normalizedDocument !== existingCustomer.numeroDocumento) {
    const duplicateCustomer = await prisma.cliente.findFirst({
      where: { numeroDocumento: normalizedDocument, deletedAt: null, empresaId: companyId },
    })
    if (duplicateCustomer && duplicateCustomer.id !== customerId) {
      throw createHttpError(409, 'Ya existe otro cliente con ese número de documento.')
    }
  }

  const tipoPersona = payload.tipoPersona ?? existingCustomer.tipoPersona
  const shouldRebuildName =
    payload.tipoPersona !== undefined ||
    payload.nombres !== undefined ||
    payload.apellidos !== undefined ||
    payload.razonSocial !== undefined

  const nameFields = shouldRebuildName
    ? buildFullName({
        tipoPersona,
        nombres: payload.nombres ?? existingCustomer.nombres ?? undefined,
        apellidos: payload.apellidos ?? existingCustomer.apellidos ?? undefined,
        razonSocial: payload.razonSocial ?? existingCustomer.razonSocial ?? undefined,
      })
    : null

  const shouldUpdateCredit =
    payload.permitirCredito !== undefined || payload.limiteCredito !== undefined
  const nextPermitirCredito =
    payload.permitirCredito ?? existingCustomer.permitirCredito
  const nextCreditLimitRaw =
    payload.limiteCredito ?? decimalToNumber(existingCustomer.limiteCredito)

  if (shouldUpdateCredit) {
    if (!Number.isFinite(nextCreditLimitRaw) || nextCreditLimitRaw < 0) {
      throw createHttpError(400, 'El límite de crédito debe ser mayor o igual a 0.')
    }
  }

  const nextLimiteCredito = nextPermitirCredito ? Number(nextCreditLimitRaw.toFixed(2)) : 0

  const updateData: Prisma.ClienteUncheckedUpdateInput = {
    ...(payload.tipoPersona !== undefined ? { tipoPersona } : {}),
    ...(payload.tipoDocumento !== undefined ? { tipoDocumento: payload.tipoDocumento } : {}),
    ...(payload.numeroDocumento !== undefined ? { numeroDocumento: normalizedDocument } : {}),
    ...(nameFields ? nameFields : {}),
    ...(payload.email !== undefined ? { email: toOptionalString(payload.email) } : {}),
    ...(payload.telefono !== undefined ? { telefono: toOptionalString(payload.telefono) } : {}),
    ...(payload.direccion !== undefined ? { direccion: toOptionalString(payload.direccion) } : {}),
    ...(shouldUpdateCredit
      ? {
          permitirCredito: nextPermitirCredito,
          limiteCredito: toDecimal(nextLimiteCredito, 2),
        }
      : {}),
    ...(payload.ubigeo !== undefined ? { ubigeo: toOptionalString(payload.ubigeo) } : {}),
    ...(payload.fechaNacimiento !== undefined
      ? { fechaNacimiento: parseOptionalDate(payload.fechaNacimiento) ?? null }
      : {}),
    ...(payload.observaciones !== undefined
      ? { observaciones: toOptionalString(payload.observaciones) }
      : {}),
    ...(payload.activo !== undefined ? { activo: payload.activo } : {}),
    updatedById: userId,
  }

  const updatedCustomer = await prisma.cliente.update({
    where: { id: customerId },
    data: updateData,
    include: customerInclude,
  })

  return { item: mapCustomer(updatedCustomer) }
}

export async function deleteCustomer(customerId: string, request: FastifyRequest) {
  const { userId, companyId } = await getAuthContext(request)

  const existingCustomer = await prisma.cliente.findFirst({
    where: { id: customerId, deletedAt: null, empresaId: companyId },
  })

  if (!existingCustomer) {
    throw createHttpError(404, 'El cliente no fue encontrado.')
  }

  await prisma.cliente.update({
    where: { id: customerId },
    data: {
      deletedAt: new Date(),
      activo: false,
      updatedById: userId,
    },
  })

  return { success: true }
}

function formatDocumentNumber(sale: { id: string; serie: string | null; numero: string | null }) {
  if (sale.serie && sale.numero) {
    return `${sale.serie}-${sale.numero}`
  }

  return `VNT-${sale.id.slice(0, 6).toUpperCase()}`
}

function toMoney(value: Prisma.Decimal | number) {
  return Number(decimalToNumber(value).toFixed(2))
}

export async function getCustomerSales(customerId: string, request: FastifyRequest) {
  const { companyId } = await getAuthContext(request)

  const customer = await prisma.cliente.findFirst({
    where: { id: customerId, deletedAt: null, empresaId: companyId },
    select: { id: true },
  })

  if (!customer) {
    throw createHttpError(404, 'El cliente no fue encontrado.')
  }

  const sales = await prisma.venta.findMany({
    where: {
      deletedAt: null,
      clienteId: customerId,
      sucursal: {
        empresaId: companyId,
      },
    },
    select: {
      id: true,
      tipoComprobante: true,
      serie: true,
      numero: true,
      fechaEmision: true,
      estado: true,
      total: true,
      saldoPendiente: true,
    },
    orderBy: [{ fechaEmision: 'desc' }, { createdAt: 'desc' }],
  })

  return {
    sales: sales.map((sale) => {
      const totalAmount = toMoney(sale.total)
      const outstandingAmount = toMoney(sale.saldoPendiente)
      const paidAmount = toMoney(Math.max(0, totalAmount - outstandingAmount))

      return {
        id: sale.id,
        createdAt: sale.fechaEmision.toISOString(),
        document: formatDocumentNumber(sale),
        tipoComprobante: sale.tipoComprobante,
        totalAmount,
        paidAmount,
        outstandingAmount,
        status: sale.estado,
      }
    }),
  }
}

export async function getCustomerAccountStatement(customerId: string, request: FastifyRequest) {
  const { companyId } = await getAuthContext(request)

  const [customer, paymentMethods] = await Promise.all([
    prisma.cliente.findFirst({
      where: { id: customerId, deletedAt: null, empresaId: companyId },
      select: {
        id: true,
        permitirCredito: true,
        limiteCredito: true,
        saldoPendiente: true,
      },
    }),
    prisma.formaPago.findMany({
      where: {
        deletedAt: null,
        activo: true,
      },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        requiereReferencia: true,
        permiteVuelto: true,
      },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    }),
  ])

  if (!customer) {
    throw createHttpError(404, 'El cliente no fue encontrado.')
  }

  const creditLimit = toMoney(customer.limiteCredito)
  const outstandingAmount = toMoney(customer.saldoPendiente)
  const availableCredit = toMoney(Math.max(0, creditLimit - outstandingAmount))

  const allCustomerSales = await prisma.venta.findMany({
    where: {
      deletedAt: null,
      clienteId: customerId,
      sucursal: {
        empresaId: companyId,
      },
      estado: {
        in: [EstadoVenta.EMITIDA, EstadoVenta.COBRADA, EstadoVenta.BORRADOR, EstadoVenta.ANULADA],
      },
    },
    include: {
      pagos: {
        where: {
          deletedAt: null,
        },
        include: {
          formaPago: {
            select: {
              nombre: true,
              codigo: true,
            },
          },
        },
        orderBy: [{ fechaPago: 'asc' }, { createdAt: 'asc' }],
      },
    },
    orderBy: [{ fechaEmision: 'asc' }, { createdAt: 'asc' }],
  })

  type AccountMovement = {
    id: string
    createdAt: string
    movement: string
    document: string
    chargeAmount: number
    paymentAmount: number
    balanceAmount: number
    saleId: string
    paymentMethodName: string | null
    paymentMethodCode: string | null
    reference: string | null
  }

  const movements: AccountMovement[] = []
  const pendingSales: Array<{
    saleId: string
    document: string
    issueDate: string
    outstandingAmount: number
  }> = []

  let totalPurchased = 0
  let totalPaid = 0

  for (const sale of allCustomerSales) {
    const isBorradorOAnulada =
      sale.estado === EstadoVenta.ANULADA || sale.estado === EstadoVenta.BORRADOR
    const saleTotal = toMoney(sale.total)
    const saleOutstanding = toMoney(sale.saldoPendiente)

    if (!isBorradorOAnulada) {
      totalPurchased += saleTotal
    }

    if (isBorradorOAnulada) {
      continue
    }

    const documentNumber = formatDocumentNumber(sale)

    movements.push({
      id: `sale-${sale.id}`,
      createdAt: sale.fechaEmision.toISOString(),
      movement: 'Venta',
      document: documentNumber,
      chargeAmount: saleTotal,
      paymentAmount: 0,
      balanceAmount: 0,
      saleId: sale.id,
      paymentMethodName: null,
      paymentMethodCode: null,
      reference: null,
    })

    for (const payment of sale.pagos) {
      const paymentAmount = toMoney(payment.monto)
      if (paymentAmount <= 0.0001) {
        continue
      }
      totalPaid += paymentAmount
      movements.push({
        id: `sale-payment-${payment.id}`,
        createdAt: payment.fechaPago.toISOString(),
        movement: payment.referenciaExterna ? 'Pago de deuda' : 'Pago de deuda',
        document: documentNumber,
        chargeAmount: 0,
        paymentAmount,
        balanceAmount: 0,
        saleId: sale.id,
        paymentMethodName: payment.formaPago?.nombre ?? null,
        paymentMethodCode: payment.formaPago?.codigo ?? null,
        reference: payment.referenciaExterna ?? null,
      })
    }

    if (saleOutstanding > 0.0001) {
      pendingSales.push({
        saleId: sale.id,
        document: documentNumber,
        issueDate: sale.fechaEmision.toISOString(),
        outstandingAmount: saleOutstanding,
      })
    }
  }

  let runningBalance = 0
  const mappedMovements = movements
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((item) => {
      runningBalance = toMoney(runningBalance + item.chargeAmount - item.paymentAmount)
      return { ...item, balanceAmount: runningBalance }
    })

  const outstanding = Math.max(0, totalPurchased - totalPaid)
  totalPaid = Number(totalPaid.toFixed(2))
  totalPurchased = Number(totalPurchased.toFixed(2))
  const totals = {
    totalPurchased,
    totalPaid,
    outstandingAmount: Number(outstanding.toFixed(2)),
  }

  return {
    summary: {
      creditLimit,
      outstandingAmount,
      availableCredit,
    },
    totals,
    options: {
      paymentMethods: paymentMethods.map((method) => {
        const classification = classifyPaymentMethod(method.codigo)
        return {
          id: method.id,
          name: method.nombre,
          code: method.codigo,
          category: classification.category,
          digitalSubmethod: classification.digitalSubmethod ?? undefined,
          requiresReference: method.requiereReferencia,
          allowsChange: method.permiteVuelto,
        }
      }),
    },
    pendingSales: pendingSales.sort((a, b) => a.issueDate.localeCompare(b.issueDate)),
    movements: mappedMovements,
  }
}

export async function registerCustomerPayment(
  customerId: string,
  payload: RegisterCustomerPaymentPayload,
  request: FastifyRequest,
) {
  const { userId, branchId, companyId } = await getAuthContext(request)

  const amountRaw = Number(payload.monto)
  if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
    throw createHttpError(400, 'El monto del pago debe ser mayor a 0.')
  }
  const amount = Number(amountRaw.toFixed(2))

  const paymentMethodId = payload.formaPagoId?.trim()
  if (!paymentMethodId) {
    throw createHttpError(400, 'Selecciona un medio de pago.')
  }

  const customer = await prisma.cliente.findFirst({
    where: { id: customerId, deletedAt: null, empresaId: companyId },
    select: {
      id: true,
      saldoPendiente: true,
    },
  })

  if (!customer) {
    throw createHttpError(404, 'El cliente no fue encontrado.')
  }

  const paymentMethod = await prisma.formaPago.findFirst({
    where: {
      id: paymentMethodId,
      deletedAt: null,
      activo: true,
    },
    select: {
      id: true,
      codigo: true,
      nombre: true,
    },
  })

  if (!paymentMethod) {
    throw createHttpError(404, 'El medio de pago seleccionado no está disponible.')
  }

  const pendingSales = await prisma.venta.findMany({
    where: {
      deletedAt: null,
      clienteId: customer.id,
      sucursal: {
        empresaId: companyId,
      },
      saldoPendiente: {
        gt: 0,
      },
      estado: {
        in: [EstadoVenta.EMITIDA, EstadoVenta.COBRADA],
      },
    },
    select: {
      id: true,
      serie: true,
      numero: true,
      saldoPendiente: true,
      estado: true,
    },
    orderBy: [{ fechaEmision: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  })

  const totalPending = Number(
    pendingSales.reduce((sum, sale) => sum.plus(sale.saldoPendiente), new Prisma.Decimal(0)).toFixed(2),
  )

  if (totalPending <= 0) {
    throw createHttpError(400, 'El cliente no registra saldo pendiente para cobrar.')
  }

  if (amount > totalPending + 0.0001) {
    const formatted = new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2,
    }).format(totalPending)
    throw createHttpError(
      400,
      `El monto no puede superar el saldo pendiente de ${formatted}.`,
    )
  }

  const pendingOpening = await prisma.aperturaCaja.findFirst({
    where: {
      deletedAt: null,
      estado: EstadoAperturaCaja.ABIERTA,
      caja: {
        deletedAt: null,
        sucursalId: branchId,
      },
    },
    select: {
      id: true,
      fechaApertura: true,
      cierrePendiente: true,
    },
  })

  function isSameDateInTimeZone(one: Date, two: Date) {
    const oneLima = new Date(one.toLocaleString('en-US', { timeZone: 'America/Lima' }))
    const twoLima = new Date(two.toLocaleString('en-US', { timeZone: 'America/Lima' }))
    return (
      oneLima.getFullYear() === twoLima.getFullYear() &&
      oneLima.getMonth() === twoLima.getMonth() &&
      oneLima.getDate() === twoLima.getDate()
    )
  }

  if (pendingOpening) {
    const now = new Date()
    const closePending =
      pendingOpening.cierrePendiente || !isSameDateInTimeZone(pendingOpening.fechaApertura, now)

    if (closePending) {
      if (!pendingOpening.cierrePendiente) {
        await prisma.aperturaCaja.update({
          where: { id: pendingOpening.id },
          data: {
            cierrePendiente: true,
            updatedById: userId,
          },
        })
      }

      throw createHttpError(
        409,
        'Caja pendiente de cierre. Cierra la caja del día anterior para registrar pagos.',
      )
    }
  }

  const isCashPayment = paymentMethod.codigo === CodigoFormaPago.EFECTIVO

  let effectiveOpening = pendingOpening
  if (!effectiveOpening) {
    if (isCashPayment) {
      throw createHttpError(
        400,
        'No hay una caja abierta para esta sucursal. Abre la caja antes de registrar pagos en efectivo.',
      )
    }

    effectiveOpening =
      (await prisma.aperturaCaja.findFirst({
        where: {
          caja: {
            sucursalId: branchId,
          },
          estado: EstadoAperturaCaja.ABIERTA,
          deletedAt: null,
          cierrePendiente: false,
        },
        orderBy: { fechaApertura: 'desc' },
      })) ?? null
  }

  if (!effectiveOpening) {
    throw createHttpError(
      400,
      'No hay una caja abierta para esta sucursal. Abre una caja antes de registrar pagos.',
    )
  }

  const reference = toOptionalString(payload.referenciaExterna)
  const notes = toOptionalString(payload.observaciones)

  const result = await prisma.$transaction(
    async (tx) => {
      let remaining = amount
      const createdVentaPagos: Array<{
        id: string
        ventaId: string
        monto: number
        serie: string | null
        numero: string | null
      }> = []

      for (const sale of pendingSales) {
        if (remaining <= 0.0001) {
          break
        }
        const saleOutstanding = Number(Number(sale.saldoPendiente).toFixed(2))
        if (saleOutstanding <= 0) {
          continue
        }
        const applyAmount = Number(Math.min(remaining, saleOutstanding).toFixed(2))
        const newSaleOutstanding = Number(Math.max(0, saleOutstanding - applyAmount).toFixed(2))
        const newState =
          newSaleOutstanding <= 0.0001 ? EstadoVenta.COBRADA : sale.estado === EstadoVenta.COBRADA ? EstadoVenta.COBRADA : EstadoVenta.EMITIDA

        const ventaPago = await tx.ventaPago.create({
          data: {
            ventaId: sale.id,
            formaPagoId: paymentMethod.id,
            monto: toDecimal(applyAmount, 2),
            referenciaExterna: reference,
            observaciones: notes,
            createdById: userId,
            updatedById: userId,
          },
          select: {
            id: true,
            ventaId: true,
            monto: true,
          },
        })

        await tx.venta.update({
          where: { id: sale.id },
          data: {
            saldoPendiente: toDecimal(newSaleOutstanding, 2),
            estado: newState,
            updatedById: userId,
          },
        })

        createdVentaPagos.push({
          id: ventaPago.id,
          ventaId: sale.id,
          monto: applyAmount,
          serie: sale.serie,
          numero: sale.numero,
        })

        remaining = Number((remaining - applyAmount).toFixed(2))
      }

      const newCustomerOutstanding = Number(Math.max(0, totalPending - amount).toFixed(2))
      await tx.cliente.update({
        where: { id: customer.id },
        data: {
          saldoPendiente: toDecimal(newCustomerOutstanding, 2),
          updatedById: userId,
        },
      })

      const firstVentaPago = createdVentaPagos[0]
      const mainDocument =
        firstVentaPago && firstVentaPago.serie && firstVentaPago.numero
          ? `${firstVentaPago.serie}-${firstVentaPago.numero}`
          : `CLT-${customer.id.slice(0, 8).toUpperCase()}`

      const movementNotesParts: string[] = []
      movementNotesParts.push('Pago de deuda de cliente')
      if (notes) movementNotesParts.push(notes)
      if (createdVentaPagos.length > 1) {
        movementNotesParts.push(`Aplicado a ${createdVentaPagos.length} comprobantes`)
      }

      await tx.movimientoCaja.create({
        data: {
          aperturaCajaId: effectiveOpening.id,
          tipo: TipoMovimientoCaja.VENTA,
          operacion: OperacionCaja.INGRESO,
          monto: toDecimal(amount, 2),
          referencia: mainDocument,
          formaPagoId: paymentMethod.id,
          ventaPagoId: firstVentaPago?.id ?? null,
          observaciones: movementNotesParts.join(' · '),
          createdById: userId,
          updatedById: userId,
        },
      })

      return {
        payments: createdVentaPagos,
        newBalance: newCustomerOutstanding,
        totalPaid: amount,
      }
    },
    {
      maxWait: 10_000,
      timeout: 20_000,
    },
  )

  return result
}
