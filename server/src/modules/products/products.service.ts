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
      name: category.nombre,
      activeCount: category._count.productos,
      skuCount: category._count.productos,
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
