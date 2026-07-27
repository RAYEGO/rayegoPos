import { EstadoProducto, ModoEmpaqueProducto, Prisma } from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { getAuthContext } from '../../lib/auth.js'
import { IMPLEMENTATION_MESSAGES } from '../../shared/implementation/messages.js'

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
  _count: {
    select: {
      detalleCompras: {
        where: {
          deletedAt: null,
        },
      },
      detalleVentas: {
        where: {
          deletedAt: null,
        },
      },
      MovimientoInventario: {
        where: {
          deletedAt: null,
        },
      },
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
  laboratoryId?: string
  page?: number
  pageSize?: number
  sortBy?: 'name' | 'stockUnits' | 'createdAt'
  sortDir?: 'asc' | 'desc'
}

type CreateProductPayload = {
  categoriaId: string
  laboratorioId?: string
  presentacionId?: string
  unidadMedidaId: string
  modoEmpaque?: ModoEmpaqueProducto
  unidadesPorBlister?: number
  blistersPorCaja?: number
  precioVentaBlister?: number
  principioActivoId?: string
  sku: string
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
    blisterPrice: product.precioVentaBlister ? decimalToNumber(product.precioVentaBlister) : null,
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
    packagingMode: product.modoEmpaque,
    unitsPerBlister: product.unidadesPorBlister,
    blistersPerBox: product.blistersPorCaja,
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
    canDelete:
      product.lotes.length === 0 &&
      (product._count?.MovimientoInventario ?? 0) === 0 &&
      (product._count?.detalleCompras ?? 0) === 0 &&
      (product._count?.detalleVentas ?? 0) === 0,
  }
}

export async function listProductCatalog(
  filters: ListProductsFilters,
  request: FastifyRequest,
) {
  const { branchId, companyId } = await getAuthContext(request)
  const search = filters.search?.trim()
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20))
  const sortBy = filters.sortBy ?? 'name'
  const sortDir = filters.sortDir ?? 'asc'
  const skip = (page - 1) * pageSize

  const where: Prisma.ProductoWhereInput = {
    deletedAt: null,
    empresaId: companyId,
    ...(filters.status ? { estado: filters.status as never } : {}),
    ...(filters.categoryId ? { categoriaId: filters.categoryId } : {}),
    ...(filters.laboratoryId ? { laboratorioId: filters.laboratoryId } : {}),
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

  const productIncludeByBranch = {
    ...productInclude,
    lotes: {
      ...productInclude.lotes,
      where: {
        ...(productInclude.lotes.where as Prisma.LoteWhereInput),
        sucursalId: branchId,
      },
    },
  } satisfies Prisma.ProductoInclude

  const [totalItems, activeCatalog, withPrescription, lotEnabled] =
    await Promise.all([
      prisma.producto.count({ where }),
      prisma.producto.count({
        where: {
          ...where,
          estado: EstadoProducto.ACTIVO,
        },
      }),
      prisma.producto.count({
        where: {
          ...where,
          requiereReceta: true,
        },
      }),
      prisma.producto.count({
        where: {
          ...where,
          lotes: {
            some: {
              deletedAt: null,
              sucursalId: branchId,
            },
          },
        },
      }),
    ])

  const statusFilter = filters.status ?? null
  const categoryIdFilter = filters.categoryId ?? null
  const laboratoryIdFilter = filters.laboratoryId ?? null
  const searchFilter = search ?? null
  const companyIdFilter = companyId
  const branchIdFilter = branchId

  const [{ count: lowStockCount }] = await prisma.$queryRaw<
    Array<{ count: number }>
  >`
    SELECT COUNT(*)::int AS count
    FROM (
      SELECT p.id,
             COALESCE(SUM(l.stock_disponible), 0) AS stock_units
      FROM productos p
      LEFT JOIN lotes l
        ON l.producto_id = p.id
       AND l.deleted_at IS NULL
       AND l.sucursal_id = ${branchIdFilter}::uuid
      WHERE p.deleted_at IS NULL
        AND p.empresa_id = ${companyIdFilter}::uuid
        AND (${statusFilter}::text IS NULL OR p.estado::text = ${statusFilter}::text)
        AND (${categoryIdFilter}::uuid IS NULL OR p.categoria_id = ${categoryIdFilter}::uuid)
        AND (${laboratoryIdFilter}::uuid IS NULL OR p.laboratorio_id = ${laboratoryIdFilter}::uuid)
        AND (
          ${searchFilter}::text IS NULL
          OR p.nombre ILIKE '%' || ${searchFilter} || '%'
          OR p.sku ILIKE '%' || ${searchFilter} || '%'
          OR COALESCE(p.codigo_interno, '') ILIKE '%' || ${searchFilter} || '%'
          OR COALESCE(p.codigo_barras, '') ILIKE '%' || ${searchFilter} || '%'
          OR EXISTS (
            SELECT 1
            FROM laboratorios lab
            WHERE lab.id = p.laboratorio_id
              AND lab.deleted_at IS NULL
              AND lab.nombre ILIKE '%' || ${searchFilter} || '%'
          )
          OR EXISTS (
            SELECT 1
            FROM producto_principio_activo ppa
            JOIN principios_activos pa
              ON pa.id = ppa.principio_activo_id
             AND pa.deleted_at IS NULL
            WHERE ppa.producto_id = p.id
              AND ppa.deleted_at IS NULL
              AND pa.nombre ILIKE '%' || ${searchFilter} || '%'
          )
        )
      GROUP BY p.id
    ) stocks
    WHERE stocks.stock_units <= 20;
  `

  let products: ProductWithRelations[] = []

  if (sortBy === 'stockUnits') {
    const sortRaw = Prisma.raw(sortDir === 'desc' ? 'DESC' : 'ASC')
    const ids = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT p.id
      FROM productos p
      LEFT JOIN lotes l
        ON l.producto_id = p.id
       AND l.deleted_at IS NULL
       AND l.sucursal_id = ${branchIdFilter}::uuid
      WHERE p.deleted_at IS NULL
        AND p.empresa_id = ${companyIdFilter}::uuid
        AND (${statusFilter}::text IS NULL OR p.estado::text = ${statusFilter}::text)
        AND (${categoryIdFilter}::uuid IS NULL OR p.categoria_id = ${categoryIdFilter}::uuid)
        AND (${laboratoryIdFilter}::uuid IS NULL OR p.laboratorio_id = ${laboratoryIdFilter}::uuid)
        AND (
          ${searchFilter}::text IS NULL
          OR p.nombre ILIKE '%' || ${searchFilter} || '%'
          OR p.sku ILIKE '%' || ${searchFilter} || '%'
          OR COALESCE(p.codigo_interno, '') ILIKE '%' || ${searchFilter} || '%'
          OR COALESCE(p.codigo_barras, '') ILIKE '%' || ${searchFilter} || '%'
          OR EXISTS (
            SELECT 1
            FROM laboratorios lab
            WHERE lab.id = p.laboratorio_id
              AND lab.deleted_at IS NULL
              AND lab.nombre ILIKE '%' || ${searchFilter} || '%'
          )
          OR EXISTS (
            SELECT 1
            FROM producto_principio_activo ppa
            JOIN principios_activos pa
              ON pa.id = ppa.principio_activo_id
             AND pa.deleted_at IS NULL
            WHERE ppa.producto_id = p.id
              AND ppa.deleted_at IS NULL
              AND pa.nombre ILIKE '%' || ${searchFilter} || '%'
          )
        )
      GROUP BY p.id
      ORDER BY COALESCE(SUM(l.stock_disponible), 0) ${sortRaw},
               p.nombre ASC
      LIMIT ${pageSize}
      OFFSET ${skip};
    `

    const idList = ids.map((row) => row.id)
    if (idList.length > 0) {
      const entries = await prisma.producto.findMany({
        where: {
          id: { in: idList },
          empresaId: companyId,
        },
        include: productIncludeByBranch,
      })

      const byId = new Map(entries.map((entry) => [entry.id, entry]))
      products = idList.map((id) => byId.get(id)).filter(Boolean) as ProductWithRelations[]
    } else {
      products = []
    }
  } else {
    const orderBy =
      sortBy === 'createdAt'
        ? ([{ createdAt: sortDir }, { nombre: 'asc' }] as Prisma.ProductoOrderByWithRelationInput[])
        : ([{ nombre: sortDir }, { id: 'asc' }] as Prisma.ProductoOrderByWithRelationInput[])

    products = await prisma.producto.findMany({
      where,
      include: productIncludeByBranch,
      orderBy,
      skip,
      take: pageSize,
    })
  }

  const items = products.map(mapProduct)
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  return {
    items,
    summary: {
      total: totalItems,
      activeCatalog,
      lowStockCount,
      withPrescription,
      lotEnabled,
    },
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
    },
    sort: {
      by: sortBy,
      dir: sortDir,
    },
  }
}

export async function getProductOptions(request: FastifyRequest) {
  const { companyId } = await getAuthContext(request)
  const [categories, laboratories, presentations, units, activePrinciples] =
    await Promise.all([
      prisma.categoria.findMany({
        where: {
          deletedAt: null,
          activo: true,
          empresaId: companyId,
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
          empresaId: companyId,
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
          empresaId: companyId,
        },
        orderBy: {
          nombre: 'asc',
        },
      }),
      prisma.unidadMedida.findMany({
        where: {
          deletedAt: null,
          activo: true,
          empresaId: companyId,
        },
        orderBy: {
          nombre: 'asc',
        },
      }),
      prisma.principioActivo.findMany({
        where: {
          deletedAt: null,
          activo: true,
          empresaId: companyId,
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
  codigo?: string
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
  codigo?: string
  nombre: string
  simbolo: string
  descripcion?: string
  activo?: boolean
}

function normalizeCode(value: string, maxLength = 30) {
  const normalized = value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  return normalized.slice(0, maxLength) || 'MASTER'
}

function normalizeName(value: string) {
  return value.trim()
}

function normalizeUnitSymbol(value: string, maxLength = 20) {
  const normalized = value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

  return normalized.slice(0, maxLength)
}

async function resolveUniqueCodeForCategory(
  companyId: string,
  baseCode: string,
  excludeId?: string,
) {
  const normalized = normalizeCode(baseCode, 30)

  for (let attempt = 0; attempt < 99; attempt += 1) {
    const suffix = attempt === 0 ? '' : `_${attempt + 1}`
    const trimmed = normalized.slice(0, Math.max(1, 30 - suffix.length))
    const candidate = `${trimmed}${suffix}`.slice(0, 30)

    const exists = await prisma.categoria.findFirst({
      where: {
        deletedAt: null,
        empresaId: companyId,
        codigo: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    })

    if (!exists) return candidate
  }

  return normalized.slice(0, 30)
}

async function resolveUniqueCodeForLaboratory(
  companyId: string,
  baseCode: string,
  excludeId?: string,
) {
  const normalized = normalizeCode(baseCode, 30)

  for (let attempt = 0; attempt < 99; attempt += 1) {
    const suffix = attempt === 0 ? '' : `_${attempt + 1}`
    const trimmed = normalized.slice(0, Math.max(1, 30 - suffix.length))
    const candidate = `${trimmed}${suffix}`.slice(0, 30)

    const exists = await prisma.laboratorio.findFirst({
      where: {
        deletedAt: null,
        empresaId: companyId,
        codigo: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    })

    if (!exists) return candidate
  }

  return normalized.slice(0, 30)
}

async function resolveUniqueCodeForPresentation(
  companyId: string,
  baseCode: string,
  excludeId?: string,
) {
  const normalized = normalizeCode(baseCode, 30)

  for (let attempt = 0; attempt < 99; attempt += 1) {
    const suffix = attempt === 0 ? '' : `_${attempt + 1}`
    const trimmed = normalized.slice(0, Math.max(1, 30 - suffix.length))
    const candidate = `${trimmed}${suffix}`.slice(0, 30)

    const exists = await prisma.presentacion.findFirst({
      where: {
        deletedAt: null,
        empresaId: companyId,
        codigo: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    })

    if (!exists) return candidate
  }

  return normalized.slice(0, 30)
}

async function resolveUniqueCodeForUnit(companyId: string, baseCode: string, excludeId?: string) {
  const normalized = normalizeCode(baseCode, 20)

  for (let attempt = 0; attempt < 99; attempt += 1) {
    const suffix = attempt === 0 ? '' : `_${attempt + 1}`
    const trimmed = normalized.slice(0, Math.max(1, 20 - suffix.length))
    const candidate = `${trimmed}${suffix}`.slice(0, 20)

    const exists = await prisma.unidadMedida.findFirst({
      where: {
        deletedAt: null,
        empresaId: companyId,
        codigo: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    })

    if (!exists) return candidate
  }

  return normalized.slice(0, 20)
}

async function resolveUniqueInternalProductCode(companyId: string) {
  for (let attempt = 0; attempt < 99; attempt += 1) {
    const stamp = Date.now().toString(36).toUpperCase()
    const entropy = Math.floor(Math.random() * 1_000_000)
      .toString(36)
      .toUpperCase()
      .padStart(4, '0')
    const suffix = attempt === 0 ? '' : `-${attempt + 1}`
    const candidate = `INT-${stamp}-${entropy}${suffix}`.slice(0, 50)

    const exists = await prisma.producto.findFirst({
      where: {
        deletedAt: null,
        empresaId: companyId,
        codigoInterno: candidate,
      },
      select: { id: true },
    })

    if (!exists) return candidate
  }

  return `INT-${Date.now().toString(36).toUpperCase()}`.slice(0, 50)
}

export async function listMasterCategories(request: FastifyRequest) {
  const { companyId } = await getAuthContext(request)
  const categories = await prisma.categoria.findMany({
    where: {
      deletedAt: null,
      empresaId: companyId,
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
  const { userId, companyId } = await getAuthContext(request)

  if (payload.parentId) {
    const parent = await prisma.categoria.findFirst({
      where: {
        id: payload.parentId,
        deletedAt: null,
        empresaId: companyId,
      },
      select: { id: true },
    })
    if (!parent) {
      throw createHttpError(404, 'La categoría padre no existe.')
    }
  }

  try {
    const codigo = await resolveUniqueCodeForCategory(companyId, payload.nombre)
    const created = await prisma.categoria.create({
      data: {
        empresaId: companyId,
        parentId: payload.parentId ?? null,
        codigo,
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
  const { userId, companyId } = await getAuthContext(request)

  if (payload.parentId === categoryId) {
    throw createHttpError(400, 'La categoría padre no puede ser la misma categoría.')
  }

  if (payload.parentId) {
    const parent = await prisma.categoria.findFirst({
      where: {
        id: payload.parentId,
        deletedAt: null,
        empresaId: companyId,
      },
      select: { id: true },
    })
    if (!parent) {
      throw createHttpError(404, 'La categoría padre no existe.')
    }
  }

  try {
    const codigo = await resolveUniqueCodeForCategory(companyId, payload.nombre, categoryId)
    await prisma.categoria.update({
      where: {
        id: categoryId,
        deletedAt: null,
        empresaId: companyId,
      },
      data: {
        parentId: payload.parentId ?? null,
        codigo,
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
  const { userId, companyId } = await getAuthContext(request)

  const childCount = await prisma.categoria.count({
    where: {
      deletedAt: null,
      parentId: categoryId,
      empresaId: companyId,
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
      empresaId: companyId,
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
      empresaId: companyId,
    },
    data: {
      deletedAt: new Date(),
      activo: false,
      updatedById: userId,
    },
  })

  return { success: true }
}

export async function listMasterLaboratories(request: FastifyRequest) {
  const { companyId } = await getAuthContext(request)
  const laboratories = await prisma.laboratorio.findMany({
    where: {
      deletedAt: null,
      empresaId: companyId,
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
      codigo: laboratory.codigo,
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
  const { userId, companyId } = await getAuthContext(request)

  try {
    const codigo = await resolveUniqueCodeForLaboratory(companyId, payload.nombre)
    const created = await prisma.laboratorio.create({
      data: {
        empresaId: companyId,
        codigo,
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
      throw createHttpError(409, 'Ya existe un laboratorio con ese código o nombre.')
    }
    throw error
  }
}

export async function updateMasterLaboratory(
  laboratoryId: string,
  payload: MasterLaboratoryPayload,
  request: FastifyRequest,
) {
  const { userId, companyId } = await getAuthContext(request)

  try {
    const codigo = await resolveUniqueCodeForLaboratory(companyId, payload.nombre, laboratoryId)
    await prisma.laboratorio.update({
      where: {
        id: laboratoryId,
        deletedAt: null,
        empresaId: companyId,
      },
      data: {
        codigo,
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
      throw createHttpError(409, 'Ya existe un laboratorio con ese código o nombre.')
    }
    throw error
  }
}

export async function deleteMasterLaboratory(
  laboratoryId: string,
  request: FastifyRequest,
) {
  const { userId, companyId } = await getAuthContext(request)

  const productCount = await prisma.producto.count({
    where: {
      deletedAt: null,
      laboratorioId: laboratoryId,
      empresaId: companyId,
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
      empresaId: companyId,
    },
    data: {
      deletedAt: new Date(),
      activo: false,
      updatedById: userId,
    },
  })

  return { success: true }
}

export async function listMasterPresentations(request: FastifyRequest) {
  const { companyId } = await getAuthContext(request)
  const presentations = await prisma.presentacion.findMany({
    where: {
      deletedAt: null,
      empresaId: companyId,
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
      codigo: presentation.codigo,
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
  const { userId, companyId } = await getAuthContext(request)

  try {
    const codigo = await resolveUniqueCodeForPresentation(companyId, payload.nombre)
    const created = await prisma.presentacion.create({
      data: {
        empresaId: companyId,
        codigo,
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
      throw createHttpError(409, 'Ya existe una presentación con ese código o nombre.')
    }
    throw error
  }
}

export async function updateMasterPresentation(
  presentationId: string,
  payload: MasterPresentationPayload,
  request: FastifyRequest,
) {
  const { userId, companyId } = await getAuthContext(request)

  try {
    const codigo = await resolveUniqueCodeForPresentation(companyId, payload.nombre, presentationId)
    await prisma.presentacion.update({
      where: {
        id: presentationId,
        deletedAt: null,
        empresaId: companyId,
      },
      data: {
        codigo,
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
      throw createHttpError(409, 'Ya existe una presentación con ese código o nombre.')
    }
    throw error
  }
}

export async function deleteMasterPresentation(
  presentationId: string,
  request: FastifyRequest,
) {
  const { userId, companyId } = await getAuthContext(request)

  const productCount = await prisma.producto.count({
    where: {
      deletedAt: null,
      presentacionId: presentationId,
      empresaId: companyId,
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
      empresaId: companyId,
    },
    data: {
      deletedAt: new Date(),
      activo: false,
      updatedById: userId,
    },
  })

  return { success: true }
}

export async function listMasterUnits(request: FastifyRequest) {
  const { companyId } = await getAuthContext(request)
  const units = await prisma.unidadMedida.findMany({
    where: {
      deletedAt: null,
      empresaId: companyId,
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
  const { userId, companyId } = await getAuthContext(request)

  try {
    const codigo = await resolveUniqueCodeForUnit(companyId, payload.codigo ?? payload.nombre)
    const simbolo = normalizeUnitSymbol(payload.simbolo, 20)
    if (!simbolo) {
      throw createHttpError(400, 'El símbolo de la unidad es obligatorio.')
    }
    const created = await prisma.unidadMedida.create({
      data: {
        empresaId: companyId,
        codigo,
        nombre: normalizeName(payload.nombre),
        simbolo,
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
  const { userId, companyId } = await getAuthContext(request)

  try {
    const codigo = await resolveUniqueCodeForUnit(companyId, payload.codigo ?? payload.nombre, unitId)
    const simbolo = normalizeUnitSymbol(payload.simbolo, 20)
    if (!simbolo) {
      throw createHttpError(400, 'El símbolo de la unidad es obligatorio.')
    }
    await prisma.unidadMedida.update({
      where: {
        id: unitId,
        deletedAt: null,
        empresaId: companyId,
      },
      data: {
        codigo,
        nombre: normalizeName(payload.nombre),
        simbolo,
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
  const { userId, companyId } = await getAuthContext(request)

  const productCount = await prisma.producto.count({
    where: {
      deletedAt: null,
      unidadMedidaId: unitId,
      empresaId: companyId,
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
      empresaId: companyId,
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
  const { userId, companyId } = await getAuthContext(request)
  const normalizedName = payload.nombre.trim()
  const packagingMode = payload.modoEmpaque ?? ModoEmpaqueProducto.SIMPLE
  let unitsPerBlister: number | null = null
  let blistersPerBox: number | null = null
  const salePrice = Number(payload.precioVenta)
  const blisterPrice =
    packagingMode === ModoEmpaqueProducto.BLISTER &&
    payload.precioVentaBlister !== undefined
      ? Number(payload.precioVentaBlister)
      : null
  const costPrice = Number(payload.costoReferencia)
  const marginReference =
    costPrice > 0 ? (salePrice - costPrice) / costPrice : null

  if (!Number.isFinite(salePrice) || salePrice < 0) {
    throw createHttpError(400, IMPLEMENTATION_MESSAGES.INVALID_PRICE)
  }

  if (!Number.isFinite(costPrice) || costPrice < 0) {
    throw createHttpError(400, IMPLEMENTATION_MESSAGES.INVALID_COST)
  }

  if (packagingMode === ModoEmpaqueProducto.BLISTER) {
    const nextUnitsPerBlister = Number(payload.unidadesPorBlister)
    const nextBlistersPerBox = Number(payload.blistersPorCaja)

    if (
      !Number.isFinite(nextUnitsPerBlister) ||
      !Number.isInteger(nextUnitsPerBlister) ||
      nextUnitsPerBlister <= 1
    ) {
      throw createHttpError(400, IMPLEMENTATION_MESSAGES.INVALID_CONVERSION)
    }

    if (
      !Number.isFinite(nextBlistersPerBox) ||
      !Number.isInteger(nextBlistersPerBox) ||
      nextBlistersPerBox <= 0
    ) {
      throw createHttpError(400, IMPLEMENTATION_MESSAGES.INVALID_CONVERSION)
    }

    if (blisterPrice !== null && (!Number.isFinite(blisterPrice) || blisterPrice < 0)) {
      throw createHttpError(400, IMPLEMENTATION_MESSAGES.INVALID_PRICE)
    }

    unitsPerBlister = nextUnitsPerBlister
    blistersPerBox = nextBlistersPerBox
  }

  try {
    const codigoInterno = await resolveUniqueInternalProductCode(companyId)
    const product = await prisma.producto.create({
      data: {
        empresaId: companyId,
        categoriaId: payload.categoriaId,
        laboratorioId: toOptionalString(payload.laboratorioId),
        presentacionId: toOptionalString(payload.presentacionId),
        unidadMedidaId: payload.unidadMedidaId,
        modoEmpaque: packagingMode,
        unidadesPorBlister: unitsPerBlister,
        blistersPorCaja: blistersPerBox,
        sku: payload.sku.trim().toUpperCase(),
        codigoInterno,
        codigoBarras: toOptionalString(payload.codigoBarras),
        nombre: normalizedName,
        descripcion: toOptionalString(payload.descripcion),
        concentracion: toOptionalString(payload.concentracion),
        registroSanitario: toOptionalString(payload.registroSanitario),
        requiereReceta: payload.requiereReceta,
        esControlado: payload.esControlado,
        precioVenta: new Prisma.Decimal(salePrice.toFixed(2)),
        precioVentaBlister:
          blisterPrice === null ? undefined : new Prisma.Decimal(blisterPrice.toFixed(2)),
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
      throw createHttpError(409, IMPLEMENTATION_MESSAGES.SKU_ALREADY_EXISTS)
    }

    throw error
  }
}

export async function updateProduct(
  productId: string,
  payload: CreateProductPayload,
  request: FastifyRequest,
) {
  const { userId, companyId } = await getAuthContext(request)

  const existing = await prisma.producto.findFirst({
    where: {
      id: productId,
      deletedAt: null,
      empresaId: companyId,
    },
    select: {
      id: true,
    },
  })

  if (!existing) {
    throw createHttpError(404, 'El producto no existe.')
  }

  const normalizedName = payload.nombre.trim()
  const packagingMode = payload.modoEmpaque ?? ModoEmpaqueProducto.SIMPLE
  let unitsPerBlister: number | null = null
  let blistersPerBox: number | null = null
  const salePrice = Number(payload.precioVenta)
  const blisterPrice =
    packagingMode === ModoEmpaqueProducto.BLISTER &&
    payload.precioVentaBlister !== undefined
      ? Number(payload.precioVentaBlister)
      : null
  const costPrice = Number(payload.costoReferencia)
  const marginReference =
    costPrice > 0 ? (salePrice - costPrice) / costPrice : null

  if (!Number.isFinite(salePrice) || salePrice < 0) {
    throw createHttpError(400, IMPLEMENTATION_MESSAGES.INVALID_PRICE)
  }

  if (!Number.isFinite(costPrice) || costPrice < 0) {
    throw createHttpError(400, IMPLEMENTATION_MESSAGES.INVALID_COST)
  }

  if (packagingMode === ModoEmpaqueProducto.BLISTER) {
    const nextUnitsPerBlister = Number(payload.unidadesPorBlister)
    const nextBlistersPerBox = Number(payload.blistersPorCaja)

    if (
      !Number.isFinite(nextUnitsPerBlister) ||
      !Number.isInteger(nextUnitsPerBlister) ||
      nextUnitsPerBlister <= 1
    ) {
      throw createHttpError(400, IMPLEMENTATION_MESSAGES.INVALID_CONVERSION)
    }

    if (
      !Number.isFinite(nextBlistersPerBox) ||
      !Number.isInteger(nextBlistersPerBox) ||
      nextBlistersPerBox <= 0
    ) {
      throw createHttpError(400, IMPLEMENTATION_MESSAGES.INVALID_CONVERSION)
    }

    if (blisterPrice !== null && (!Number.isFinite(blisterPrice) || blisterPrice < 0)) {
      throw createHttpError(400, IMPLEMENTATION_MESSAGES.INVALID_PRICE)
    }

    unitsPerBlister = nextUnitsPerBlister
    blistersPerBox = nextBlistersPerBox
  }

  try {
    const updated = await prisma.producto.update({
      where: {
        id: productId,
        deletedAt: null,
        empresaId: companyId,
      },
      data: {
        categoriaId: payload.categoriaId,
        laboratorioId: toOptionalString(payload.laboratorioId),
        presentacionId: toOptionalString(payload.presentacionId),
        unidadMedidaId: payload.unidadMedidaId,
        modoEmpaque: packagingMode,
        unidadesPorBlister: unitsPerBlister,
        blistersPorCaja: blistersPerBox,
        sku: payload.sku.trim().toUpperCase(),
        codigoBarras: toOptionalString(payload.codigoBarras),
        nombre: normalizedName,
        descripcion: toOptionalString(payload.descripcion),
        concentracion: toOptionalString(payload.concentracion),
        registroSanitario: toOptionalString(payload.registroSanitario),
        requiereReceta: payload.requiereReceta,
        esControlado: payload.esControlado,
        precioVenta: new Prisma.Decimal(salePrice.toFixed(2)),
        precioVentaBlister:
          blisterPrice === null ? undefined : new Prisma.Decimal(blisterPrice.toFixed(2)),
        costoReferencia: new Prisma.Decimal(costPrice.toFixed(2)),
        margenReferencia:
          marginReference === null
            ? undefined
            : new Prisma.Decimal(marginReference.toFixed(4)),
        observaciones: toOptionalString(payload.observaciones),
        updatedById: userId,
      },
      include: productInclude,
    })

    return { item: mapProduct(updated) }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw createHttpError(409, IMPLEMENTATION_MESSAGES.SKU_ALREADY_EXISTS)
    }

    throw error
  }
}

export async function updateProductStatus(
  productId: string,
  status: EstadoProducto,
  request: FastifyRequest,
) {
  const { userId, companyId } = await getAuthContext(request)

  const updated = await prisma.producto.updateMany({
    where: {
      id: productId,
      deletedAt: null,
      empresaId: companyId,
    },
    data: {
      estado: status,
      updatedById: userId,
    },
  })

  if (updated.count === 0) {
    throw createHttpError(404, 'El producto no existe.')
  }

  return { success: true }
}

export async function deleteProduct(productId: string, request: FastifyRequest) {
  const { userId, companyId } = await getAuthContext(request)

  const product = await prisma.producto.findFirst({
    where: {
      id: productId,
      deletedAt: null,
      empresaId: companyId,
    },
    select: {
      id: true,
      estado: true,
      _count: {
        select: {
          MovimientoInventario: {
            where: {
              deletedAt: null,
            },
          },
          lotes: {
            where: {
              deletedAt: null,
            },
          },
          detalleCompras: {
            where: {
              deletedAt: null,
            },
          },
          detalleVentas: {
            where: {
              deletedAt: null,
            },
          },
        },
      },
    },
  })

  if (!product) {
    throw createHttpError(404, 'El producto no existe.')
  }

  if (product.estado !== EstadoProducto.INACTIVO) {
    throw createHttpError(409, 'Solo se puede eliminar un producto inactivo.')
  }

  if (
    (product._count.MovimientoInventario ?? 0) > 0 ||
    (product._count.lotes ?? 0) > 0 ||
    (product._count.detalleCompras ?? 0) > 0 ||
    (product._count.detalleVentas ?? 0) > 0
  ) {
    throw createHttpError(
      409,
      'No se puede eliminar el producto porque ya tiene compras, ventas, movimientos o lotes registrados.',
    )
  }

  await prisma.producto.update({
    where: {
      id: productId,
      deletedAt: null,
      empresaId: companyId,
    },
    data: {
      deletedAt: new Date(),
      estado: EstadoProducto.INACTIVO,
      updatedById: userId,
    },
  })

  return { success: true }
}
