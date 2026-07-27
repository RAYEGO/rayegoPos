import { EstadoVenta, Prisma, TipoDocumentoIdentidad, TipoPersona } from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { getAuthContext } from '../../lib/auth.js'

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

  const customer = await prisma.cliente.findFirst({
    where: { id: customerId, deletedAt: null, empresaId: companyId },
    select: {
      id: true,
      permitirCredito: true,
      limiteCredito: true,
      saldoPendiente: true,
    },
  })

  if (!customer) {
    throw createHttpError(404, 'El cliente no fue encontrado.')
  }

  const creditLimit = toMoney(customer.limiteCredito)
  const outstandingAmount = toMoney(customer.saldoPendiente)
  const availableCredit = toMoney(Math.max(0, creditLimit - outstandingAmount))

  const creditSales = await prisma.venta.findMany({
    where: {
      deletedAt: null,
      clienteId: customerId,
      sucursal: {
        empresaId: companyId,
      },
      saldoPendiente: {
        gt: 0,
      },
      estado: {
        in: [EstadoVenta.EMITIDA, EstadoVenta.COBRADA, EstadoVenta.BORRADOR, EstadoVenta.ANULADA],
      },
    },
    select: {
      id: true,
      serie: true,
      numero: true,
      fechaEmision: true,
      updatedAt: true,
      estado: true,
      saldoPendiente: true,
    },
    orderBy: [{ fechaEmision: 'asc' }, { createdAt: 'asc' }],
  })

  const movements: Array<{
    id: string
    createdAt: string
    movement: string
    document: string
    chargeAmount: number
    paymentAmount: number
    balanceAmount: number
    saleId: string
  }> = []

  for (const sale of creditSales) {
    const chargeAmount = toMoney(sale.saldoPendiente)
    movements.push({
      id: `sale-${sale.id}`,
      createdAt: sale.fechaEmision.toISOString(),
      movement: 'Venta a crédito',
      document: formatDocumentNumber(sale),
      chargeAmount,
      paymentAmount: 0,
      balanceAmount: 0,
      saleId: sale.id,
    })

    if (sale.estado === EstadoVenta.ANULADA) {
      movements.push({
        id: `cancel-${sale.id}`,
        createdAt: sale.updatedAt.toISOString(),
        movement: 'Anulación de venta',
        document: formatDocumentNumber(sale),
        chargeAmount: 0,
        paymentAmount: chargeAmount,
        balanceAmount: 0,
        saleId: sale.id,
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

  return {
    summary: {
      creditLimit,
      outstandingAmount,
      availableCredit,
    },
    movements: mappedMovements,
  }
}
