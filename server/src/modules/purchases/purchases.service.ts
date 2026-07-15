import { EstadoCompra, Prisma, TipoComprobante } from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { prisma } from '../../lib/prisma.js'

const purchaseInclude = {
  sucursal: {
    select: {
      id: true,
      nombre: true,
    },
  },
  proveedor: {
    select: {
      id: true,
      razonSocial: true,
      numeroDocumento: true,
      contactoTelefono: true,
    },
  },
  usuarioResponsable: {
    select: {
      id: true,
      nombres: true,
      apellidos: true,
    },
  },
  detalles: {
    where: {
      deletedAt: null,
    },
    include: {
      producto: {
        select: {
          id: true,
          nombre: true,
          sku: true,
          requiereReceta: true,
          unidadMedida: {
            select: {
              simbolo: true,
            },
          },
          lotes: {
            where: {
              deletedAt: null,
            },
            select: {
              stockDisponible: true,
            },
          },
        },
      },
      lotes: {
        where: {
          deletedAt: null,
        },
        select: {
          id: true,
          numeroLote: true,
          fechaVencimiento: true,
          stockInicial: true,
          createdAt: true,
        },
      },
    },
  },
} satisfies Prisma.CompraInclude

type PurchaseWithRelations = Prisma.CompraGetPayload<{
  include: typeof purchaseInclude
}>

type PurchaseDashboardFilters = {
  search?: string
  status?: EstadoCompra
  branchId?: string
  supplierId?: string
}

type CreatePurchaseOrderPayload = {
  sucursalId: string
  proveedorId: string
  fechaEmision?: string
  fechaRecepcion?: string
  tipoComprobante?: TipoComprobante
  serieComprobante?: string
  numeroComprobante?: string
  estado: 'BORRADOR' | 'REGISTRADA'
  observaciones?: string
  items: Array<{
    productoId: string
    cantidad: number
    costoUnitario: number
    porcentajeImpuesto?: number
  }>
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

function decimalToNumber(value: Prisma.Decimal | null | undefined) {
  return Number(value ?? 0)
}

function toDecimal(value: number, fractionDigits: number) {
  return new Prisma.Decimal(value.toFixed(fractionDigits))
}

function toOptionalString(value?: string | null) {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

function formatDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null
}

function formatDateTime(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function formatFullName(user: { nombres: string; apellidos: string | null }) {
  return `${user.nombres} ${user.apellidos ?? ''}`.trim()
}

function buildPurchaseCode(index: number) {
  return `CMP-${String(index).padStart(6, '0')}`
}

function isColdChainProduct(productName: string) {
  return /insulina|vacuna|refriger|cadena de frio/i.test(productName)
}

function calculateLeadTimeDays(emissionDate: Date, receptionDate: Date | null) {
  if (!receptionDate) {
    return null
  }

  const diffInMs = receptionDate.getTime() - emissionDate.getTime()
  return Math.max(0, Math.round(diffInMs / (1000 * 60 * 60 * 24)))
}

function getReceiptStatus(orderedUnits: number, receivedUnits: number) {
  if (receivedUnits <= 0) {
    return 'PROGRAMADA' as const
  }

  if (receivedUnits + 0.0001 >= orderedUnits) {
    return 'RECIBIDA' as const
  }

  return 'OBSERVADA' as const
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

async function buildPurchaseCodeMap() {
  const orderedPurchases = await prisma.compra.findMany({
    where: {
      deletedAt: null,
    },
    select: {
      id: true,
    },
    orderBy: [{ fechaEmision: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  })

  return new Map(
    orderedPurchases.map((purchase, index) => [purchase.id, buildPurchaseCode(index + 1)]),
  )
}

function mapPurchaseOrder(purchase: PurchaseWithRelations, codeMap: Map<string, string>) {
  const code = codeMap.get(purchase.id) ?? `CMP-${purchase.id.slice(0, 6).toUpperCase()}`

  return {
    id: purchase.id,
    code,
    supplierId: purchase.proveedorId,
    supplierName: purchase.proveedor.razonSocial,
    supplierDocument: purchase.proveedor.numeroDocumento,
    branchId: purchase.sucursalId,
    branchName: purchase.sucursal.nombre,
    buyerId: purchase.usuarioResponsableId,
    buyerName: formatFullName(purchase.usuarioResponsable),
    createdAt: formatDate(purchase.fechaEmision),
    expectedAt: formatDate(purchase.fechaRecepcion),
    itemCount: purchase.detalles.length,
    totalAmount: decimalToNumber(purchase.total),
    subtotalAmount: decimalToNumber(purchase.subtotal),
    taxAmount: decimalToNumber(purchase.impuestoTotal),
    pendingAmount: decimalToNumber(purchase.saldoPendiente),
    status: purchase.estado,
    observations: purchase.observaciones,
    itemNames: purchase.detalles.map((detail) => detail.producto.nombre),
  }
}

function mapPurchaseReceipts(
  purchases: PurchaseWithRelations[],
  codeMap: Map<string, string>,
) {
  return purchases.flatMap((purchase) =>
    purchase.detalles.map((detail) => {
      const orderedUnits = decimalToNumber(detail.cantidad)
      const receivedUnits = detail.lotes.reduce(
        (sum, lot) => sum + decimalToNumber(lot.stockInicial),
        0,
      )
      const latestLot = [...detail.lotes].sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )[0]

      return {
        id: detail.id,
        purchaseId: purchase.id,
        purchaseCode:
          codeMap.get(purchase.id) ?? `CMP-${purchase.id.slice(0, 6).toUpperCase()}`,
        productId: detail.productoId,
        productName: detail.producto.nombre,
        supplierName: purchase.proveedor.razonSocial,
        receivedAt:
          formatDateTime(latestLot?.createdAt) ??
          formatDateTime(purchase.fechaRecepcion) ??
          formatDateTime(purchase.fechaEmision),
        lotCode: latestLot?.numeroLote ?? 'Pendiente de recepción',
        receivedUnits,
        orderedUnits,
        expiryDate: formatDate(latestLot?.fechaVencimiento),
        branchId: purchase.sucursalId,
        branchName: purchase.sucursal.nombre,
        coldChain: isColdChainProduct(detail.producto.nombre),
        status: getReceiptStatus(orderedUnits, receivedUnits),
      }
    }),
  )
}

export async function getPurchaseDashboard(filters: PurchaseDashboardFilters) {
  const search = filters.search?.trim().toLowerCase()

  const purchaseWhere: Prisma.CompraWhereInput = {
    deletedAt: null,
    ...(filters.status ? { estado: filters.status } : {}),
    ...(filters.branchId ? { sucursalId: filters.branchId } : {}),
    ...(filters.supplierId ? { proveedorId: filters.supplierId } : {}),
  }

  const [codeMap, purchases, branches, suppliers, products] = await Promise.all([
    buildPurchaseCodeMap(),
    prisma.compra.findMany({
      where: purchaseWhere,
      include: purchaseInclude,
      orderBy: [{ fechaEmision: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.sucursal.findMany({
      where: {
        deletedAt: null,
        activo: true,
      },
      orderBy: {
        nombre: 'asc',
      },
      select: {
        id: true,
        nombre: true,
      },
    }),
    prisma.proveedor.findMany({
      where: {
        deletedAt: null,
        activo: true,
      },
      orderBy: {
        razonSocial: 'asc',
      },
      select: {
        id: true,
        razonSocial: true,
        numeroDocumento: true,
        contactoTelefono: true,
      },
    }),
    prisma.producto.findMany({
      where: {
        deletedAt: null,
        estado: 'ACTIVO',
      },
      orderBy: {
        nombre: 'asc',
      },
      select: {
        id: true,
        nombre: true,
        sku: true,
        costoReferencia: true,
        unidadMedida: {
          select: {
            simbolo: true,
          },
        },
      },
    }),
  ])

  const mappedOrders = purchases.map((purchase) => mapPurchaseOrder(purchase, codeMap))
  const mappedReceipts = mapPurchaseReceipts(purchases, codeMap)

  const filteredOrders = search
    ? mappedOrders.filter((order) =>
        [
          order.code,
          order.supplierName,
          order.buyerName,
          order.branchName,
          ...order.itemNames,
        ]
          .join(' ')
          .toLowerCase()
          .includes(search),
      )
    : mappedOrders

  const filteredOrderIds = new Set(filteredOrders.map((order) => order.id))
  const filteredReceipts = mappedReceipts.filter((receipt) => filteredOrderIds.has(receipt.purchaseId))

  const supplierSummary = suppliers
    .map((supplier) => {
      const supplierPurchases = filteredOrders.filter((order) => order.supplierId === supplier.id)
      const supplierSource = purchases.filter((purchase) => purchase.proveedorId === supplier.id)
      const completedPurchases = supplierPurchases.filter(
        (order) => order.status === EstadoCompra.PAGADA,
      )
      const activeOrders = supplierPurchases.filter(
        (order) =>
          order.status === EstadoCompra.BORRADOR ||
          order.status === EstadoCompra.REGISTRADA ||
          order.status === EstadoCompra.PARCIAL,
      ).length

      const leadTimeValues = supplierSource
        .map((purchase) => calculateLeadTimeDays(purchase.fechaEmision, purchase.fechaRecepcion))
        .filter((value): value is number => value !== null)

      const criticalProducts = new Set(
        supplierSource.flatMap((purchase) =>
          purchase.detalles
            .filter((detail) => {
              const availableUnits = detail.producto.lotes.reduce(
                (sum, lot) => sum + decimalToNumber(lot.stockDisponible),
                0,
              )

              return availableUnits <= 20
            })
            .map((detail) => detail.productoId),
        ),
      ).size

      const nonCancelled = supplierPurchases.filter(
        (order) => order.status !== EstadoCompra.ANULADA,
      ).length

      return {
        supplierId: supplier.id,
        supplierName: supplier.razonSocial,
        documentNumber: supplier.numeroDocumento,
        contactPhone: supplier.contactoTelefono,
        activeOrders,
        avgLeadTimeDays:
          leadTimeValues.length > 0
            ? Math.round(
                leadTimeValues.reduce((sum, value) => sum + value, 0) /
                  leadTimeValues.length,
              )
            : 0,
        serviceLevel:
          nonCancelled > 0
            ? Math.round((completedPurchases.length / nonCancelled) * 100)
            : 0,
        criticalProducts,
      }
    })
    .filter(
      (supplier) =>
        supplier.activeOrders > 0 ||
        supplier.criticalProducts > 0 ||
        filteredOrders.some((order) => order.supplierId === supplier.supplierId),
    )

  return {
    summary: {
      totalOrders: filteredOrders.length,
      activeOrders: filteredOrders.filter(
        (order) =>
          order.status === EstadoCompra.BORRADOR ||
          order.status === EstadoCompra.REGISTRADA ||
          order.status === EstadoCompra.PARCIAL,
      ).length,
      scheduledReceipts: filteredReceipts.filter((receipt) => receipt.status === 'PROGRAMADA')
        .length,
      observedReceipts: filteredReceipts.filter((receipt) => receipt.status === 'OBSERVADA')
        .length,
      activeSpend: Number(
        filteredOrders
          .filter((order) => order.status !== EstadoCompra.ANULADA)
          .reduce((sum, order) => sum + order.totalAmount, 0)
          .toFixed(2),
      ),
      supplierCount: new Set(filteredOrders.map((order) => order.supplierId)).size,
    },
    orders: filteredOrders.map(({ itemNames, ...order }) => order),
    receipts: filteredReceipts,
    supplierSummary,
    options: {
      branches: branches.map((branch) => ({
        id: branch.id,
        name: branch.nombre,
      })),
      suppliers: suppliers.map((supplier) => ({
        id: supplier.id,
        name: supplier.razonSocial,
        documentNumber: supplier.numeroDocumento,
      })),
      products: products.map((product) => ({
        id: product.id,
        name: product.nombre,
        sku: product.sku,
        unitSymbol: product.unidadMedida.simbolo,
        referenceCost: decimalToNumber(product.costoReferencia),
      })),
    },
  }
}

export async function createPurchaseOrder(
  payload: CreatePurchaseOrderPayload,
  request: FastifyRequest,
) {
  const userId = await getAuthenticatedUserId(request)
  const emissionDate = payload.fechaEmision
    ? new Date(`${payload.fechaEmision}T00:00:00`)
    : new Date()
  const expectedReceptionDate = payload.fechaRecepcion
    ? new Date(`${payload.fechaRecepcion}T00:00:00`)
    : null

  if (Number.isNaN(emissionDate.getTime())) {
    throw createHttpError(400, 'La fecha de emisión no es válida.')
  }

  if (expectedReceptionDate && Number.isNaN(expectedReceptionDate.getTime())) {
    throw createHttpError(400, 'La fecha esperada de recepción no es válida.')
  }

  if (expectedReceptionDate && expectedReceptionDate < emissionDate) {
    throw createHttpError(
      400,
      'La fecha esperada de recepción no puede ser anterior a la emisión.',
    )
  }

  if (!payload.items.length) {
    throw createHttpError(400, 'La orden debe tener al menos un producto.')
  }

  const duplicatedProducts = payload.items.reduce((duplicates, item) => {
    duplicates.set(item.productoId, (duplicates.get(item.productoId) ?? 0) + 1)
    return duplicates
  }, new Map<string, number>())

  if ([...duplicatedProducts.values()].some((count) => count > 1)) {
    throw createHttpError(400, 'No repitas el mismo producto dentro de la misma orden.')
  }

  const result = await prisma.$transaction(async (tx) => {
    const [branch, supplier, responsibleUser, products] = await Promise.all([
      tx.sucursal.findFirst({
        where: {
          id: payload.sucursalId,
          deletedAt: null,
          activo: true,
        },
      }),
      tx.proveedor.findFirst({
        where: {
          id: payload.proveedorId,
          deletedAt: null,
          activo: true,
        },
      }),
      tx.usuario.findFirst({
        where: {
          id: userId,
          deletedAt: null,
          activo: true,
        },
      }),
      tx.producto.findMany({
        where: {
          id: {
            in: payload.items.map((item) => item.productoId),
          },
          deletedAt: null,
          estado: 'ACTIVO',
        },
        select: {
          id: true,
          nombre: true,
          sku: true,
          unidadMedida: {
            select: {
              simbolo: true,
            },
          },
        },
      }),
    ])

    if (!branch) {
      throw createHttpError(404, 'La sucursal seleccionada no está disponible.')
    }

    if (!supplier) {
      throw createHttpError(404, 'El proveedor seleccionado no está disponible.')
    }

    if (!responsibleUser) {
      throw createHttpError(404, 'El usuario responsable no está disponible.')
    }

    if (products.length !== payload.items.length) {
      throw createHttpError(
        404,
        'Uno o más productos seleccionados ya no están disponibles.',
      )
    }

    const productMap = new Map(products.map((product) => [product.id, product]))

    const lineItems = payload.items.map((item) => {
      const quantity = Number(item.cantidad)
      const unitCost = Number(item.costoUnitario)
      const taxRate = Number(item.porcentajeImpuesto ?? 18)

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw createHttpError(400, 'La cantidad de cada línea debe ser mayor a 0.')
      }

      if (!Number.isFinite(unitCost) || unitCost < 0) {
        throw createHttpError(
          400,
          'El costo unitario de cada línea debe ser mayor o igual a 0.',
        )
      }

      if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
        throw createHttpError(
          400,
          'El porcentaje de impuesto debe estar entre 0 y 100.',
        )
      }

      const baseAmount = quantity * unitCost
      const taxAmount = baseAmount * (taxRate / 100)
      const totalAmount = baseAmount + taxAmount

      return {
        productoId: item.productoId,
        cantidad: quantity,
        costoUnitario: unitCost,
        porcentajeImpuesto: taxRate,
        subtotal: baseAmount,
        impuestoTotal: taxAmount,
        total: totalAmount,
        product: productMap.get(item.productoId)!,
      }
    })

    const subtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0)
    const impuestoTotal = lineItems.reduce((sum, item) => sum + item.impuestoTotal, 0)
    const total = lineItems.reduce((sum, item) => sum + item.total, 0)

    const purchase = await tx.compra.create({
      data: {
        sucursalId: payload.sucursalId,
        proveedorId: payload.proveedorId,
        usuarioResponsableId: userId,
        fechaEmision: emissionDate,
        fechaRecepcion: expectedReceptionDate ?? undefined,
        tipoComprobante: payload.tipoComprobante,
        serieComprobante: toOptionalString(payload.serieComprobante),
        numeroComprobante: toOptionalString(payload.numeroComprobante),
        estado: payload.estado,
        subtotal: toDecimal(subtotal, 2),
        descuentoTotal: toDecimal(0, 2),
        impuestoTotal: toDecimal(impuestoTotal, 2),
        total: toDecimal(total, 2),
        saldoPendiente: toDecimal(total, 2),
        observaciones: toOptionalString(payload.observaciones),
        createdById: userId,
        updatedById: userId,
        detalles: {
          create: lineItems.map((item) => ({
            productoId: item.productoId,
            cantidad: toDecimal(item.cantidad, 4),
            costoUnitario: toDecimal(item.costoUnitario, 6),
            descuentoTotal: toDecimal(0, 2),
            porcentajeImpuesto: toDecimal(item.porcentajeImpuesto, 4),
            impuestoTotal: toDecimal(item.impuestoTotal, 2),
            subtotal: toDecimal(item.subtotal, 2),
            total: toDecimal(item.total, 2),
            createdById: userId,
            updatedById: userId,
          })),
        },
      },
      include: purchaseInclude,
    })

    const purchaseSequence = await tx.compra.count({
      where: {
        deletedAt: null,
      },
    })
    const mappedOrder = mapPurchaseOrder(
      purchase,
      new Map([[purchase.id, buildPurchaseCode(purchaseSequence)]]),
    )

    return {
      item: {
        id: mappedOrder.id,
        code: mappedOrder.code,
        supplierName: mappedOrder.supplierName,
        branchName: mappedOrder.branchName,
        buyerName: mappedOrder.buyerName,
        createdAt: mappedOrder.createdAt,
        expectedAt: mappedOrder.expectedAt,
        itemCount: mappedOrder.itemCount,
        totalAmount: mappedOrder.totalAmount,
        status: mappedOrder.status,
      },
      details: lineItems.map((item) => ({
        productId: item.productoId,
        productName: item.product.nombre,
        sku: item.product.sku,
        unitSymbol: item.product.unidadMedida.simbolo,
        quantity: item.cantidad,
        unitCost: item.costoUnitario,
        taxRate: item.porcentajeImpuesto,
        total: Number(item.total.toFixed(2)),
      })),
    }
  })

  return result
}
