import { Prisma } from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { prisma } from '../../lib/prisma.js'

const productInclude = {
  categoria: {
    select: {
      id: true,
      nombre: true,
    },
  },
  laboratorio: {
    select: {
      id: true,
      nombre: true,
      pais: true,
    },
  },
  presentacion: {
    select: {
      id: true,
      nombre: true,
    },
  },
  unidadMedida: {
    select: {
      id: true,
      nombre: true,
      simbolo: true,
    },
  },
  principiosActivos: {
    where: {
      deletedAt: null,
    },
    include: {
      principioActivo: {
        select: {
          id: true,
          nombre: true,
        },
      },
    },
  },
  lotes: {
    where: {
      deletedAt: null,
    },
    select: {
      sucursalId: true,
      fechaVencimiento: true,
      stockDisponible: true,
      stockReservado: true,
    },
  },
} satisfies Prisma.ProductoInclude

type ProductWithRelations = Prisma.ProductoGetPayload<{
  include: typeof productInclude
}>

type ListProductsFilters = {
  search?: string
  status?: string
  categoryId?: string
}

type CreateProductPayload = {
  categoriaId: string
  laboratorioId?: string
  presentacionId?: string
  unidadMedidaId: string
  principioActivoId?: string
  sku: string
  codigoInterno?: string
  codigoBarras?: string
  nombre: string
  descripcion?: string
  concentracion?: string
  registroSanitario?: string
  requiereReceta: boolean
  esControlado: boolean
  precioVenta: number
  costoReferencia: number
  observaciones?: string
}

type AuthTokenPayload = {
  sub: string
  typ: 'access' | 'refresh' | 'reset-password'
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

function decimalToNumber(value: Prisma.Decimal | null | undefined) {
  return Number(value ?? 0)
}

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return null
  }

  return value.toISOString().slice(0, 10)
}

function mapProduct(product: ProductWithRelations) {
  const stockUnits = product.lotes.reduce(
    (total, lote) => total + decimalToNumber(lote.stockDisponible),
    0,
  )
  const reservedUnits = product.lotes.reduce(
    (total, lote) => total + decimalToNumber(lote.stockReservado),
    0,
  )
  const nextExpiry = [...product.lotes]
    .sort(
      (left, right) =>
        left.fechaVencimiento.getTime() - right.fechaVencimiento.getTime(),
    )[0]?.fechaVencimiento

  return {
    id: product.id,
    sku: product.sku,
    internalCode: product.codigoInterno,
    barcode: product.codigoBarras,
    name: product.nombre,
    description: product.descripcion,
    concentration: product.concentracion,
    sanitaryRegistration: product.registroSanitario,
    status: product.estado,
    requiresPrescription: product.requiereReceta,
    isControlled: product.esControlado,
    salePrice: decimalToNumber(product.precioVenta),
    costPrice: decimalToNumber(product.costoReferencia),
    marginReference: decimalToNumber(product.margenReferencia),
    observations: product.observaciones,
    category: product.categoria.nombre,
    categoryId: product.categoria.id,
    laboratory: product.laboratorio?.nombre ?? null,
    laboratoryId: product.laboratorio?.id ?? null,
    laboratoryCountry: product.laboratorio?.pais ?? null,
    presentation: product.presentacion?.nombre ?? null,
    presentationId: product.presentacion?.id ?? null,
    unit: product.unidadMedida.nombre,
    unitSymbol: product.unidadMedida.simbolo,
    unitId: product.unidadMedida.id,
    activePrinciples: product.principiosActivos.map((entry) => ({
      id: entry.principioActivo.id,
      name: entry.principioActivo.nombre,
      concentration: entry.concentracion,
    })),
    stockUnits,
    reservedUnits,
    lotCount: product.lotes.length,
    branchCoverage: new Set(product.lotes.map((lote) => lote.sucursalId)).size,
    nextExpiry: formatDate(nextExpiry),
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

export async function listProductCatalog(filters: ListProductsFilters) {
  const search = filters.search?.trim()

  const where: Prisma.ProductoWhereInput = {
    deletedAt: null,
    ...(filters.status ? { estado: filters.status as never } : {}),
    ...(filters.categoryId ? { categoriaId: filters.categoryId } : {}),
    ...(search
      ? {
          OR: [
            {
              nombre: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              sku: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              codigoInterno: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              codigoBarras: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              laboratorio: {
                nombre: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            },
            {
              principiosActivos: {
                some: {
                  deletedAt: null,
                  principioActivo: {
                    nombre: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                },
              },
            },
          ],
        }
      : {}),
  }

  const products = await prisma.producto.findMany({
    where,
    include: productInclude,
    orderBy: [{ nombre: 'asc' }],
  })

  const items = products.map(mapProduct)

  return {
    items,
    summary: {
      total: items.length,
      activeCatalog: items.filter((item) => item.status === 'ACTIVO').length,
      lowStockCount: items.filter((item) => item.stockUnits <= 20).length,
      withPrescription: items.filter((item) => item.requiresPrescription).length,
      lotEnabled: items.filter((item) => item.lotCount > 0).length,
    },
  }
}

export async function getProductOptions() {
  const [categories, laboratories, presentations, units, activePrinciples] =
    await Promise.all([
      prisma.categoria.findMany({
        where: {
          deletedAt: null,
          activo: true,
        },
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
        include: {
          _count: {
            select: {
              productos: {
                where: {
                  deletedAt: null,
                },
              },
              children: {
                where: {
                  deletedAt: null,
                },
              },
            },
          },
        },
      }),
      prisma.laboratorio.findMany({
        where: {
          deletedAt: null,
          activo: true,
        },
        orderBy: {
          nombre: 'asc',
        },
        include: {
          _count: {
            select: {
              productos: {
                where: {
                  deletedAt: null,
                },
              },
            },
          },
        },
      }),
      prisma.presentacion.findMany({
        where: {
          deletedAt: null,
          activo: true,
        },
        orderBy: {
          nombre: 'asc',
        },
      }),
      prisma.unidadMedida.findMany({
        where: {
          deletedAt: null,
          activo: true,
        },
        orderBy: {
          nombre: 'asc',
        },
      }),
      prisma.principioActivo.findMany({
        where: {
          deletedAt: null,
          activo: true,
        },
        orderBy: {
          nombre: 'asc',
        },
        include: {
          _count: {
            select: {
              productos: {
                where: {
                  deletedAt: null,
                },
              },
            },
          },
        },
      }),
    ])

  return {
    categories: categories.map((category) => ({
      id: category.id,
      parentId: category.parentId,
      code: category.codigo,
      name: category.nombre,
      color: category.color,
      activeCount: category._count.productos,
      skuCount: category._count.productos,
      childCount: category._count.children,
    })),
    laboratories: laboratories.map((laboratory) => ({
      id: laboratory.id,
      name: laboratory.nombre,
      country: laboratory.pais,
      skuCount: laboratory._count.productos,
    })),
    presentations: presentations.map((presentation) => ({
      id: presentation.id,
      name: presentation.nombre,
    })),
    units: units.map((unit) => ({
      id: unit.id,
      code: unit.codigo,
      name: unit.nombre,
      symbol: unit.simbolo,
    })),
    activePrinciples: activePrinciples.map((principle) => ({
      id: principle.id,
      name: principle.nombre,
      productCount: principle._count.productos,
    })),
  }
}

type MasterCategoryPayload = {
  parentId?: string | null
  codigo: string
  nombre: string
  descripcion?: string
  color?: string
  orden?: number
  activo?: boolean
}

type MasterLaboratoryPayload = {
  nombre: string
  pais?: string
  descripcion?: string
  activo?: boolean
}

type MasterPresentationPayload = {
  nombre: string
  descripcion?: string
  activo?: boolean
}

type MasterUnitPayload = {
  codigo: string
  nombre: string
  simbolo: string
  descripcion?: string
  activo?: boolean
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase()
}

function normalizeName(value: string) {
  return value.trim()
}

export async function listMasterCategories() {
  const categories = await prisma.categoria.findMany({
    where: {
      deletedAt: null,
    },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    include: {
      _count: {
        select: {
          productos: {
            where: {
              deletedAt: null,
            },
          },
          children: {
            where: {
              deletedAt: null,
            },
          },
        },
      },
    },
  })

  return {
    rows: categories.map((category) => ({
      id: category.id,
      parentId: category.parentId,
      codigo: category.codigo,
      nombre: category.nombre,
      descripcion: category.descripcion,
      color: category.color,
      orden: category.orden,
      activo: category.activo,
      productCount: category._count.productos,
      childCount: category._count.children,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    })),
  }
}

export async function createMasterCategory(
  payload: MasterCategoryPayload,
  request: FastifyRequest,
) {
  const userId = await getAuthenticatedUserId(request)

  if (payload.parentId) {
    const parent = await prisma.categoria.findFirst({
      where: {
        id: payload.parentId,
        deletedAt: null,
      },
      select: { id: true },
    })
    if (!parent) {
      throw createHttpError(404, 'La categoría padre no existe.')
    }
  }

  try {
    const created = await prisma.categoria.create({
      data: {
        parentId: payload.parentId ?? null,
        codigo: normalizeCode(payload.codigo),
        nombre: normalizeName(payload.nombre),
        descripcion: toOptionalString(payload.descripcion),
        color: toOptionalString(payload.color),
        orden: payload.orden ?? 0,
        activo: payload.activo ?? true,
        createdById: userId,
        updatedById: userId,
      },
    })

    return { success: true, id: created.id }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw createHttpError(409, 'Ya existe una categoría con ese código o nombre.')
    }
    throw error
  }
}

export async function updateMasterCategory(
  categoryId: string,
  payload: MasterCategoryPayload,
  request: FastifyRequest,
) {
  const userId = await getAuthenticatedUserId(request)

  if (payload.parentId === categoryId) {
    throw createHttpError(400, 'La categoría padre no puede ser la misma categoría.')
  }

  if (payload.parentId) {
    const parent = await prisma.categoria.findFirst({
      where: {
        id: payload.parentId,
        deletedAt: null,
      },
      select: { id: true },
    })
    if (!parent) {
      throw createHttpError(404, 'La categoría padre no existe.')
    }
  }

  try {
    await prisma.categoria.update({
      where: {
        id: categoryId,
        deletedAt: null,
      },
      data: {
        parentId: payload.parentId ?? null,
        codigo: normalizeCode(payload.codigo),
        nombre: normalizeName(payload.nombre),
        descripcion: toOptionalString(payload.descripcion),
        color: toOptionalString(payload.color),
        orden: payload.orden ?? 0,
        activo: payload.activo ?? true,
        updatedById: userId,
      },
    })

    return { success: true }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw createHttpError(409, 'Ya existe una categoría con ese código o nombre.')
    }
    throw error
  }
}

export async function deleteMasterCategory(
  categoryId: string,
  request: FastifyRequest,
) {
  const userId = await getAuthenticatedUserId(request)

  const childCount = await prisma.categoria.count({
    where: {
      deletedAt: null,
      parentId: categoryId,
    },
  })

  if (childCount > 0) {
    throw createHttpError(
      409,
      'No se puede eliminar la categoría porque tiene categorías hijas. Reasigna o elimina las categorías hijas primero.',
    )
  }

  const productCount = await prisma.producto.count({
    where: {
      deletedAt: null,
      categoriaId: categoryId,
    },
  })

  if (productCount > 0) {
    throw createHttpError(
      409,
      'No se puede eliminar la categoría porque tiene productos asociados. Desactívala en su lugar.',
    )
  }

  await prisma.categoria.update({
    where: {
      id: categoryId,
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
      activo: false,
      updatedById: userId,
    },
  })

  return { success: true }
}

export async function listMasterLaboratories() {
  const laboratories = await prisma.laboratorio.findMany({
    where: {
      deletedAt: null,
    },
    orderBy: [{ nombre: 'asc' }],
    include: {
      _count: {
        select: {
          productos: {
            where: {
              deletedAt: null,
            },
          },
        },
      },
    },
  })

  return {
    rows: laboratories.map((laboratory) => ({
      id: laboratory.id,
      nombre: laboratory.nombre,
      pais: laboratory.pais,
      descripcion: laboratory.descripcion,
      activo: laboratory.activo,
      productCount: laboratory._count.productos,
      createdAt: laboratory.createdAt.toISOString(),
      updatedAt: laboratory.updatedAt.toISOString(),
    })),
  }
}

export async function createMasterLaboratory(
  payload: MasterLaboratoryPayload,
  request: FastifyRequest,
) {
  const userId = await getAuthenticatedUserId(request)

  try {
    const created = await prisma.laboratorio.create({
      data: {
        nombre: normalizeName(payload.nombre),
        pais: toOptionalString(payload.pais),
        descripcion: toOptionalString(payload.descripcion),
        activo: payload.activo ?? true,
        createdById: userId,
        updatedById: userId,
      },
    })

    return { success: true, id: created.id }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw createHttpError(409, 'Ya existe un laboratorio con ese nombre.')
    }
    throw error
  }
}

export async function updateMasterLaboratory(
  laboratoryId: string,
  payload: MasterLaboratoryPayload,
  request: FastifyRequest,
) {
  const userId = await getAuthenticatedUserId(request)

  try {
    await prisma.laboratorio.update({
      where: {
        id: laboratoryId,
        deletedAt: null,
      },
      data: {
        nombre: normalizeName(payload.nombre),
        pais: toOptionalString(payload.pais),
        descripcion: toOptionalString(payload.descripcion),
        activo: payload.activo ?? true,
        updatedById: userId,
      },
    })

    return { success: true }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw createHttpError(409, 'Ya existe un laboratorio con ese nombre.')
    }
    throw error
  }
}

export async function deleteMasterLaboratory(
  laboratoryId: string,
  request: FastifyRequest,
) {
  const userId = await getAuthenticatedUserId(request)

  const productCount = await prisma.producto.count({
    where: {
      deletedAt: null,
      laboratorioId: laboratoryId,
    },
  })

  if (productCount > 0) {
    throw createHttpError(
      409,
      'No se puede eliminar el laboratorio porque tiene productos asociados. Desactívalo en su lugar.',
    )
  }

  await prisma.laboratorio.update({
    where: {
      id: laboratoryId,
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
      activo: false,
      updatedById: userId,
    },
  })

  return { success: true }
}

export async function listMasterPresentations() {
  const presentations = await prisma.presentacion.findMany({
    where: {
      deletedAt: null,
    },
    orderBy: [{ nombre: 'asc' }],
    include: {
      _count: {
        select: {
          productos: {
            where: {
              deletedAt: null,
            },
          },
        },
      },
    },
  })

  return {
    rows: presentations.map((presentation) => ({
      id: presentation.id,
      nombre: presentation.nombre,
      descripcion: presentation.descripcion,
      activo: presentation.activo,
      productCount: presentation._count.productos,
      createdAt: presentation.createdAt.toISOString(),
      updatedAt: presentation.updatedAt.toISOString(),
    })),
  }
}

export async function createMasterPresentation(
  payload: MasterPresentationPayload,
  request: FastifyRequest,
) {
  const userId = await getAuthenticatedUserId(request)

  try {
    const created = await prisma.presentacion.create({
      data: {
        nombre: normalizeName(payload.nombre),
        descripcion: toOptionalString(payload.descripcion),
        activo: payload.activo ?? true,
        createdById: userId,
        updatedById: userId,
      },
    })

    return { success: true, id: created.id }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw createHttpError(409, 'Ya existe una presentación con ese nombre.')
    }
    throw error
  }
}

export async function updateMasterPresentation(
  presentationId: string,
  payload: MasterPresentationPayload,
  request: FastifyRequest,
) {
  const userId = await getAuthenticatedUserId(request)

  try {
    await prisma.presentacion.update({
      where: {
        id: presentationId,
        deletedAt: null,
      },
      data: {
        nombre: normalizeName(payload.nombre),
        descripcion: toOptionalString(payload.descripcion),
        activo: payload.activo ?? true,
        updatedById: userId,
      },
    })

    return { success: true }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw createHttpError(409, 'Ya existe una presentación con ese nombre.')
    }
    throw error
  }
}

export async function deleteMasterPresentation(
  presentationId: string,
  request: FastifyRequest,
) {
  const userId = await getAuthenticatedUserId(request)

  const productCount = await prisma.producto.count({
    where: {
      deletedAt: null,
      presentacionId: presentationId,
    },
  })

  if (productCount > 0) {
    throw createHttpError(
      409,
      'No se puede eliminar la presentación porque tiene productos asociados. Desactívala en su lugar.',
    )
  }

  await prisma.presentacion.update({
    where: {
      id: presentationId,
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
      activo: false,
      updatedById: userId,
    },
  })

  return { success: true }
}

export async function listMasterUnits() {
  const units = await prisma.unidadMedida.findMany({
    where: {
      deletedAt: null,
    },
    orderBy: [{ nombre: 'asc' }],
    include: {
      _count: {
        select: {
          productos: {
            where: {
              deletedAt: null,
            },
          },
        },
      },
    },
  })

  return {
    rows: units.map((unit) => ({
      id: unit.id,
      codigo: unit.codigo,
      nombre: unit.nombre,
      simbolo: unit.simbolo,
      descripcion: unit.descripcion,
      activo: unit.activo,
      productCount: unit._count.productos,
      createdAt: unit.createdAt.toISOString(),
      updatedAt: unit.updatedAt.toISOString(),
    })),
  }
}

export async function createMasterUnit(
  payload: MasterUnitPayload,
  request: FastifyRequest,
) {
  const userId = await getAuthenticatedUserId(request)

  try {
    const created = await prisma.unidadMedida.create({
      data: {
        codigo: normalizeCode(payload.codigo),
        nombre: normalizeName(payload.nombre),
        simbolo: normalizeName(payload.simbolo),
        descripcion: toOptionalString(payload.descripcion),
        activo: payload.activo ?? true,
        createdById: userId,
        updatedById: userId,
      },
    })

    return { success: true, id: created.id }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw createHttpError(409, 'Ya existe una unidad con ese código, nombre o símbolo.')
    }
    throw error
  }
}

export async function updateMasterUnit(
  unitId: string,
  payload: MasterUnitPayload,
  request: FastifyRequest,
) {
  const userId = await getAuthenticatedUserId(request)

  try {
    await prisma.unidadMedida.update({
      where: {
        id: unitId,
        deletedAt: null,
      },
      data: {
        codigo: normalizeCode(payload.codigo),
        nombre: normalizeName(payload.nombre),
        simbolo: normalizeName(payload.simbolo),
        descripcion: toOptionalString(payload.descripcion),
        activo: payload.activo ?? true,
        updatedById: userId,
      },
    })

    return { success: true }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw createHttpError(409, 'Ya existe una unidad con ese código, nombre o símbolo.')
    }
    throw error
  }
}

export async function deleteMasterUnit(unitId: string, request: FastifyRequest) {
  const userId = await getAuthenticatedUserId(request)

  const productCount = await prisma.producto.count({
    where: {
      deletedAt: null,
      unidadMedidaId: unitId,
    },
  })

  if (productCount > 0) {
    throw createHttpError(
      409,
      'No se puede eliminar la unidad porque tiene productos asociados. Desactívala en su lugar.',
    )
  }

  await prisma.unidadMedida.update({
    where: {
      id: unitId,
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
      activo: false,
      updatedById: userId,
    },
  })

  return { success: true }
}

export async function createProduct(
  payload: CreateProductPayload,
  request: FastifyRequest,
) {
  const userId = await getAuthenticatedUserId(request)
  const normalizedName = payload.nombre.trim()
  const salePrice = Number(payload.precioVenta)
  const costPrice = Number(payload.costoReferencia)
  const marginReference =
    costPrice > 0 ? (salePrice - costPrice) / costPrice : null

  try {
    const product = await prisma.producto.create({
      data: {
        categoriaId: payload.categoriaId,
        laboratorioId: toOptionalString(payload.laboratorioId),
        presentacionId: toOptionalString(payload.presentacionId),
        unidadMedidaId: payload.unidadMedidaId,
        sku: payload.sku.trim().toUpperCase(),
        codigoInterno: toOptionalString(payload.codigoInterno),
        codigoBarras: toOptionalString(payload.codigoBarras),
        nombre: normalizedName,
        descripcion: toOptionalString(payload.descripcion),
        concentracion: toOptionalString(payload.concentracion),
        registroSanitario: toOptionalString(payload.registroSanitario),
        requiereReceta: payload.requiereReceta,
        esControlado: payload.esControlado,
        precioVenta: new Prisma.Decimal(salePrice.toFixed(2)),
        costoReferencia: new Prisma.Decimal(costPrice.toFixed(2)),
        margenReferencia:
          marginReference === null
            ? undefined
            : new Prisma.Decimal(marginReference.toFixed(4)),
        observaciones: toOptionalString(payload.observaciones),
        createdById: userId,
        updatedById: userId,
        principiosActivos: payload.principioActivoId
          ? {
              create: {
                principioActivoId: payload.principioActivoId,
                concentracion: toOptionalString(payload.concentracion),
                createdById: userId,
                updatedById: userId,
              },
            }
          : undefined,
      },
      include: productInclude,
    })

    return {
      item: mapProduct(product),
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw createHttpError(
        409,
        'Ya existe un producto con el mismo SKU, código interno o código de barras.',
      )
    }

    throw error
  }
}
