import { Prisma, TipoDocumentoIdentidad, TipoPersona } from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { prisma } from '../../lib/prisma.js'

type AuthTokenPayload = {
  sub: string
  typ: 'access' | 'refresh' | 'reset-password'
}

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

async function getAuthenticatedUserId(request: FastifyRequest) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')

  if (!token) {
    throw createHttpError(401, 'Sesión no disponible.')
  }

  let decoded: AuthTokenPayload | null = null

  try {
    decoded = await request.server.jwt.verify<AuthTokenPayload>(token)
  } catch {
    decoded = null
  }

  if (!decoded || decoded.typ !== 'access') {
    throw createHttpError(401, 'El token de acceso no es válido.')
  }

  return decoded.sub
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
  await getAuthenticatedUserId(request)

  const search = filters.search?.trim()
  const isActive =
    filters.status === 'activo' ? true : filters.status === 'inactivo' ? false : undefined

  const where: Prisma.ClienteWhereInput = {
    deletedAt: null,
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
  const userId = await getAuthenticatedUserId(request)
  const tipoPersona = payload.tipoPersona ?? TipoPersona.NATURAL

  const normalizedDocument = toOptionalString(payload.numeroDocumento)

  if (normalizedDocument) {
    const existingCustomer = await prisma.cliente.findUnique({
      where: { numeroDocumento: normalizedDocument },
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

  const customer = await prisma.cliente.create({
    data: {
      tipoPersona,
      tipoDocumento: payload.tipoDocumento ?? null,
      numeroDocumento: normalizedDocument,
      ...nameFields,
      email: toOptionalString(payload.email),
      telefono: toOptionalString(payload.telefono),
      direccion: toOptionalString(payload.direccion),
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
  const userId = await getAuthenticatedUserId(request)

  const existingCustomer = await prisma.cliente.findFirst({
    where: { id: customerId, deletedAt: null },
  })

  if (!existingCustomer) {
    throw createHttpError(404, 'El cliente no fue encontrado.')
  }

  const normalizedDocument =
    payload.numeroDocumento !== undefined ? toOptionalString(payload.numeroDocumento) : undefined

  if (normalizedDocument && normalizedDocument !== existingCustomer.numeroDocumento) {
    const duplicateCustomer = await prisma.cliente.findUnique({
      where: { numeroDocumento: normalizedDocument },
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

  const updateData: Prisma.ClienteUncheckedUpdateInput = {
    ...(payload.tipoPersona !== undefined ? { tipoPersona } : {}),
    ...(payload.tipoDocumento !== undefined ? { tipoDocumento: payload.tipoDocumento } : {}),
    ...(payload.numeroDocumento !== undefined ? { numeroDocumento: normalizedDocument } : {}),
    ...(nameFields ? nameFields : {}),
    ...(payload.email !== undefined ? { email: toOptionalString(payload.email) } : {}),
    ...(payload.telefono !== undefined ? { telefono: toOptionalString(payload.telefono) } : {}),
    ...(payload.direccion !== undefined ? { direccion: toOptionalString(payload.direccion) } : {}),
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
  const userId = await getAuthenticatedUserId(request)

  const existingCustomer = await prisma.cliente.findFirst({
    where: { id: customerId, deletedAt: null },
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

