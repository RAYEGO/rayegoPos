import { Prisma, TipoDocumentoIdentidad, TipoPersona } from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { prisma } from '../../lib/prisma.js'

function createHttpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number }
  error.statusCode = statusCode
  return error
}

type AuthTokenPayload = {
  sub: string
  typ: 'access' | 'refresh' | 'reset-password'
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

function toOptionalString(value?: string | null) {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

const supplierInclude = {
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
} satisfies Prisma.ProveedorInclude

type SupplierWithRelations = Prisma.ProveedorGetPayload<{ include: typeof supplierInclude }>

type CreateSupplierPayload = {
  tipoPersona?: TipoPersona
  tipoDocumento?: TipoDocumentoIdentidad
  numeroDocumento: string
  razonSocial: string
  nombreComercial?: string
  contactoNombre?: string
  contactoTelefono?: string
  email?: string
  direccion?: string
  ubigeo?: string
  observaciones?: string
}

type UpdateSupplierPayload = Partial<CreateSupplierPayload> & { activo?: boolean }

type GetSuppliersFilters = {
  search?: string
  status?: 'activo' | 'inactivo'
}

function mapSupplier(supplier: SupplierWithRelations) {
  return {
    id: supplier.id,
    tipoPersona: supplier.tipoPersona,
    tipoDocumento: supplier.tipoDocumento,
    numeroDocumento: supplier.numeroDocumento,
    razonSocial: supplier.razonSocial,
    nombreComercial: supplier.nombreComercial,
    contactoNombre: supplier.contactoNombre,
    contactoTelefono: supplier.contactoTelefono,
    email: supplier.email,
    direccion: supplier.direccion,
    ubigeo: supplier.ubigeo,
    activo: supplier.activo,
    observaciones: supplier.observaciones,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
    createdByName: supplier.createdBy
      ? `${supplier.createdBy.nombres} ${supplier.createdBy.apellidos}`.trim()
      : null,
    updatedByName: supplier.updatedBy
      ? `${supplier.updatedBy.nombres} ${supplier.updatedBy.apellidos}`.trim()
      : null,
  }
}

export async function getSuppliersDashboard(
  filters: GetSuppliersFilters = {},
  request: FastifyRequest,
) {
  await getAuthenticatedUserId(request)
  const search = filters.search?.trim().toLowerCase()
  const isActive =
    filters.status === 'activo' ? true : filters.status === 'inactivo' ? false : undefined

  const where: Prisma.ProveedorWhereInput = {
    deletedAt: null,
    ...(isActive !== undefined ? { activo: isActive } : {}),
  }

  const suppliers = await prisma.proveedor.findMany({
    where,
    include: supplierInclude,
    orderBy: [{ razonSocial: 'asc' }, { createdAt: 'desc' }],
  })

  const filteredSuppliers = search
    ? suppliers.filter((supplier) =>
        [
          supplier.razonSocial,
          supplier.nombreComercial,
          supplier.numeroDocumento,
          supplier.contactoNombre,
          supplier.email,
          supplier.contactoTelefono,
        ]
          .join(' ')
          .toLowerCase()
          .includes(search)
      )
    : suppliers

  const mappedSuppliers = filteredSuppliers.map(mapSupplier)

  const totalSuppliers = mappedSuppliers.length
  const activeSuppliers = mappedSuppliers.filter((s) => s.activo).length
  const inactiveSuppliers = mappedSuppliers.filter((s) => !s.activo).length

  return {
    summary: {
      totalSuppliers,
      activeSuppliers,
      inactiveSuppliers,
    },
    suppliers: mappedSuppliers,
    options: {
      tiposPersona: Object.values(TipoPersona),
      tiposDocumento: Object.values(TipoDocumentoIdentidad),
    },
  }
}

export async function createSupplier(payload: CreateSupplierPayload, request: FastifyRequest) {
  const userId = await getAuthenticatedUserId(request)

  if (!payload.razonSocial.trim()) {
    throw createHttpError(400, 'La razón social es obligatoria.')
  }
  if (!payload.numeroDocumento.trim()) {
    throw createHttpError(400, 'El número de documento es obligatorio.')
  }

  const existingSupplier = await prisma.proveedor.findUnique({
    where: {
      numeroDocumento: payload.numeroDocumento.trim(),
    },
  })
  if (existingSupplier) {
    throw createHttpError(409, 'Ya existe un proveedor con ese número de documento.')
  }

  const supplier = await prisma.proveedor.create({
    data: {
      tipoPersona: payload.tipoPersona ?? TipoPersona.JURIDICA,
      tipoDocumento: payload.tipoDocumento ?? TipoDocumentoIdentidad.RUC,
      numeroDocumento: payload.numeroDocumento.trim(),
      razonSocial: payload.razonSocial.trim(),
      nombreComercial: toOptionalString(payload.nombreComercial),
      contactoNombre: toOptionalString(payload.contactoNombre),
      contactoTelefono: toOptionalString(payload.contactoTelefono),
      email: toOptionalString(payload.email),
      direccion: toOptionalString(payload.direccion),
      ubigeo: toOptionalString(payload.ubigeo),
      observaciones: toOptionalString(payload.observaciones),
      activo: true,
      createdById: userId,
      updatedById: userId,
    },
    include: supplierInclude,
  })

  return {
    item: mapSupplier(supplier),
  }
}

export async function updateSupplier(
  supplierId: string,
  payload: UpdateSupplierPayload,
  request: FastifyRequest,
) {
  const userId = await getAuthenticatedUserId(request)

  const existingSupplier = await prisma.proveedor.findFirst({
    where: {
      id: supplierId,
      deletedAt: null,
    },
  })

  if (!existingSupplier) {
    throw createHttpError(404, 'El proveedor no fue encontrado.')
  }

  if (payload.razonSocial !== undefined && !payload.razonSocial.trim()) {
    throw createHttpError(400, 'La razón social es obligatoria.')
  }

  if (payload.numeroDocumento !== undefined && !payload.numeroDocumento.trim()) {
    throw createHttpError(400, 'El número de documento es obligatorio.')
  }

  if (
    payload.numeroDocumento &&
    payload.numeroDocumento.trim() !== existingSupplier.numeroDocumento
  ) {
    const duplicateSupplier = await prisma.proveedor.findUnique({
      where: {
        numeroDocumento: payload.numeroDocumento.trim(),
      },
    })
    if (duplicateSupplier && duplicateSupplier.id !== supplierId) {
      throw createHttpError(
        409,
        'Ya existe otro proveedor con ese número de documento.',
      )
    }
  }

  const updateData: Prisma.ProveedorUncheckedUpdateInput = {
    ...(payload.tipoPersona !== undefined ? { tipoPersona: payload.tipoPersona } : {}),
    ...(payload.tipoDocumento !== undefined ? { tipoDocumento: payload.tipoDocumento } : {}),
    ...(payload.numeroDocumento !== undefined
      ? { numeroDocumento: payload.numeroDocumento.trim() }
      : {}),
    ...(payload.razonSocial !== undefined ? { razonSocial: payload.razonSocial.trim() } : {}),
    ...(payload.nombreComercial !== undefined
      ? { nombreComercial: toOptionalString(payload.nombreComercial) }
      : {}),
    ...(payload.contactoNombre !== undefined
      ? { contactoNombre: toOptionalString(payload.contactoNombre) }
      : {}),
    ...(payload.contactoTelefono !== undefined
      ? { contactoTelefono: toOptionalString(payload.contactoTelefono) }
      : {}),
    ...(payload.email !== undefined ? { email: toOptionalString(payload.email) } : {}),
    ...(payload.direccion !== undefined
      ? { direccion: toOptionalString(payload.direccion) }
      : {}),
    ...(payload.ubigeo !== undefined ? { ubigeo: toOptionalString(payload.ubigeo) } : {}),
    ...(payload.observaciones !== undefined
      ? { observaciones: toOptionalString(payload.observaciones) }
      : {}),
    ...(payload.activo !== undefined ? { activo: payload.activo } : {}),
    updatedById: userId,
  }

  const updatedSupplier = await prisma.proveedor.update({
    where: { id: supplierId },
    data: updateData,
    include: supplierInclude,
  })

  return { item: mapSupplier(updatedSupplier) }
}

export async function deleteSupplier(supplierId: string, request: FastifyRequest) {
  const userId = await getAuthenticatedUserId(request)

  const supplier = await prisma.proveedor.findFirst({
    where: { id: supplierId, deletedAt: null },
  })

  if (!supplier) {
    throw createHttpError(404, 'El proveedor no fue encontrado.')
  }

  await prisma.proveedor.update({
    where: { id: supplierId },
    data: {
      deletedAt: new Date(),
      activo: false,
      updatedById: userId,
    },
  })

  return { success: true }
}
