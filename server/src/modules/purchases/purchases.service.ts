import {
  CodigoFormaPago,
  EmpaqueProducto,
  EstadoCompra,
  EstadoLote,
  ModoEmpaqueProducto,
  OrigenMovimientoInventario,
  Prisma,
  TipoComprobante,
  TipoMovimientoInventario,
} from '@prisma/client'
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
              stockDisponible: true,
              stockReservado: true,
              stockBloqueado: true,
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
    empaque?: EmpaqueProducto
    costoUnitario: number
    porcentajeImpuesto?: number
  }>
}

type ReceivePurchaseItemPayload = {
  detalleCompraId: string
  numeroLote: string
  fechaFabricacion?: string
  fechaVencimiento: string
  cantidadRecibida: number
  stockReservado?: number
  stockBloqueado?: number
  almacen?: string
  observaciones?: string
}

type ReturnPurchaseItemPayload = {
  lotId: string
  target: 'DISPONIBLE' | 'RESERVADO' | 'BLOQUEADO'
  quantity: number
  observaciones?: string
}

type RegisterPurchasePaymentPayload = {
  compraId: string
  formaPagoId: string
  monto: number
  fechaPago?: string
  referenciaExterna?: string
  observaciones?: string
}

type AuthTokenPayload = {
  sub: string
  typ: 'access' | 'refresh' | 'reset-password'
}

type PurchaseReturnMetrics = {
  orderReturnedAmountMap: Map<string, number>
  detailReturnedUnitsMap: Map<string, number>
  detailReturnedAmountMap: Map<string, number>
}

type PurchasePaymentMetrics = {
  orderPaidAmountMap: Map<string, number>
  orderPaymentCountMap: Map<string, number>
  payments: Array<{
    id: string
    purchaseId: string
    formPaymentId: string
    formPaymentCode: string
    formPaymentName: string
    amount: number
    paidAt: string | null
    reference: string | null
    observations: string | null
  }>
}

function createHttpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number }
  error.statusCode = statusCode
  return error
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

function resolveLotStatus({
  expiryDate,
  availableUnits,
  reservedUnits,
  blockedUnits,
}: {
  expiryDate: Date
  availableUnits: number
  reservedUnits: number
  blockedUnits: number
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (expiryDate < today) {
    return EstadoLote.VENCIDO
  }

  if (availableUnits <= 0 && blockedUnits > 0) {
    return EstadoLote.BLOQUEADO
  }

  if (availableUnits <= 0 && reservedUnits <= 0 && blockedUnits <= 0) {
    return EstadoLote.AGOTADO
  }

  return EstadoLote.ACTIVO
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

async function buildPurchaseReturnMetrics(
  purchaseIds: string[],
): Promise<PurchaseReturnMetrics> {
  if (!purchaseIds.length) {
    return {
      orderReturnedAmountMap: new Map(),
      detailReturnedUnitsMap: new Map(),
      detailReturnedAmountMap: new Map(),
    }
  }

  const movements = await prisma.movimientoInventario.findMany({
    where: {
      deletedAt: null,
      origen: OrigenMovimientoInventario.DEVOLUCION_COMPRA,
      detalleCompraId: {
        not: null,
      },
      detalleCompra: {
        compraId: {
          in: purchaseIds,
        },
      },
    },
    select: {
      detalleCompraId: true,
      cantidad: true,
      costoUnitario: true,
      detalleCompra: {
        select: {
          compraId: true,
        },
      },
    },
  })

  return movements.reduce<PurchaseReturnMetrics>(
    (metrics, movement) => {
      if (!movement.detalleCompraId || !movement.detalleCompra) {
        return metrics
      }

      const returnedUnits = Math.abs(decimalToNumber(movement.cantidad))
      const returnedAmount = Number(
        (returnedUnits * decimalToNumber(movement.costoUnitario)).toFixed(2),
      )

      metrics.detailReturnedUnitsMap.set(
        movement.detalleCompraId,
        Number(
          (
            (metrics.detailReturnedUnitsMap.get(movement.detalleCompraId) ?? 0) +
            returnedUnits
          ).toFixed(4),
        ),
      )

      metrics.detailReturnedAmountMap.set(
        movement.detalleCompraId,
        Number(
          (
            (metrics.detailReturnedAmountMap.get(movement.detalleCompraId) ?? 0) +
            returnedAmount
          ).toFixed(2),
        ),
      )

      metrics.orderReturnedAmountMap.set(
        movement.detalleCompra.compraId,
        Number(
          (
            (metrics.orderReturnedAmountMap.get(movement.detalleCompra.compraId) ?? 0) +
            returnedAmount
          ).toFixed(2),
        ),
      )

      return metrics
    },
    {
      orderReturnedAmountMap: new Map(),
      detailReturnedUnitsMap: new Map(),
      detailReturnedAmountMap: new Map(),
    },
  )
}

async function buildPurchasePaymentMetrics(
  purchaseIds: string[],
): Promise<PurchasePaymentMetrics> {
  if (!purchaseIds.length) {
    return {
      orderPaidAmountMap: new Map(),
      orderPaymentCountMap: new Map(),
      payments: [],
    }
  }

  const payments = await prisma.compraPago.findMany({
    where: {
      deletedAt: null,
      compraId: {
        in: purchaseIds,
      },
    },
    include: {
      formaPago: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
        },
      },
    },
    orderBy: [{ fechaPago: 'desc' }, { createdAt: 'desc' }],
  })

  return {
    payments: payments.map((payment) => ({
      id: payment.id,
      purchaseId: payment.compraId,
      formPaymentId: payment.formaPagoId,
      formPaymentCode: payment.formaPago.codigo,
      formPaymentName: payment.formaPago.nombre,
      amount: decimalToNumber(payment.monto),
      paidAt: formatDateTime(payment.fechaPago),
      reference: payment.referenciaExterna,
      observations: payment.observaciones,
    })),
    orderPaidAmountMap: payments.reduce((map, payment) => {
      map.set(
        payment.compraId,
        Number(((map.get(payment.compraId) ?? 0) + decimalToNumber(payment.monto)).toFixed(2)),
      )
      return map
    }, new Map<string, number>()),
    orderPaymentCountMap: payments.reduce((map, payment) => {
      map.set(payment.compraId, (map.get(payment.compraId) ?? 0) + 1)
      return map
    }, new Map<string, number>()),
  }
}

function calculatePurchaseOutstandingAmount({
  totalAmount,
  returnedAmount,
  paidAmount,
}: {
  totalAmount: number
  returnedAmount: number
  paidAmount: number
}) {
  return Number(Math.max(0, totalAmount - returnedAmount - paidAmount).toFixed(2))
}

async function ensureDefaultPaymentMethods(
  db: Prisma.TransactionClient | typeof prisma,
  userId?: string,
) {
  const defaults = [
    {
      codigo: CodigoFormaPago.EFECTIVO,
      nombre: 'Efectivo',
      requiereReferencia: false,
      permiteVuelto: true,
      orden: 1,
    },
    {
      codigo: CodigoFormaPago.TARJETA,
      nombre: 'Tarjeta',
      requiereReferencia: true,
      permiteVuelto: false,
      orden: 2,
    },
    {
      codigo: CodigoFormaPago.YAPE,
      nombre: 'Yape',
      requiereReferencia: true,
      permiteVuelto: false,
      orden: 3,
    },
    {
      codigo: CodigoFormaPago.PLIN,
      nombre: 'Plin',
      requiereReferencia: true,
      permiteVuelto: false,
      orden: 4,
    },
    {
      codigo: CodigoFormaPago.TRANSFERENCIA,
      nombre: 'Transferencia bancaria',
      requiereReferencia: true,
      permiteVuelto: false,
      orden: 5,
    },
    {
      codigo: CodigoFormaPago.OTRO,
      nombre: 'Otro',
      requiereReferencia: false,
      permiteVuelto: false,
      orden: 6,
    },
  ] as const

  await Promise.all(
    defaults.map((method) =>
      db.formaPago.upsert({
        where: {
          codigo: method.codigo,
        },
        update: {
          nombre: method.nombre,
          requiereReferencia: method.requiereReferencia,
          permiteVuelto: method.permiteVuelto,
          orden: method.orden,
          activo: true,
          updatedById: userId,
        },
        create: {
          codigo: method.codigo,
          nombre: method.nombre,
          requiereReferencia: method.requiereReferencia,
          permiteVuelto: method.permiteVuelto,
          orden: method.orden,
          activo: true,
          createdById: userId,
          updatedById: userId,
        },
      }),
    ),
  )
}

async function ensureMovementReason(
  tx: Prisma.TransactionClient,
  userId: string,
  {
    code,
    name,
    description,
    type,
  }: {
    code: string
    name: string
    description: string
    type: TipoMovimientoInventario
  },
) {
  return tx.motivoMovimientoInventario.upsert({
    where: {
      codigo: code,
    },
    update: {
      nombre: name,
      descripcion: description,
      tipo: type,
      activo: true,
      updatedById: userId,
    },
    create: {
      codigo: code,
      nombre: name,
      descripcion: description,
      tipo: type,
      activo: true,
      createdById: userId,
      updatedById: userId,
    },
  })
}

async function updatePurchaseReceiptStatus(
  tx: Prisma.TransactionClient,
  purchaseId: string,
  userId: string,
) {
  const details = await tx.detalleCompra.findMany({
    where: {
      compraId: purchaseId,
      deletedAt: null,
    },
    select: {
      id: true,
      cantidad: true,
      lotes: {
        where: {
          deletedAt: null,
        },
        select: {
          stockInicial: true,
        },
      },
    },
  })

  const receiptProgress = details.map((detail) => {
    const orderedUnits = decimalToNumber(detail.cantidad)
    const receivedUnits = detail.lotes.reduce(
      (sum, lot) => sum + decimalToNumber(lot.stockInicial),
      0,
    )

    return {
      orderedUnits,
      receivedUnits,
    }
  })

  const hasAnyReceipt = receiptProgress.some((item) => item.receivedUnits > 0)
  const isFullyReceived =
    receiptProgress.length > 0 &&
    receiptProgress.every(
      (item) => item.receivedUnits + 0.0001 >= item.orderedUnits,
    )

  const nextStatus = isFullyReceived
    ? EstadoCompra.PAGADA
    : hasAnyReceipt
      ? EstadoCompra.PARCIAL
      : EstadoCompra.REGISTRADA

  await tx.compra.update({
    where: {
      id: purchaseId,
    },
    data: {
      estado: nextStatus,
      updatedById: userId,
    },
  })
}

function mapPurchaseOrder(
  purchase: PurchaseWithRelations,
  codeMap: Map<string, string>,
  returnMetrics: PurchaseReturnMetrics,
  paymentMetrics: PurchasePaymentMetrics,
) {
  const code = codeMap.get(purchase.id) ?? `CMP-${purchase.id.slice(0, 6).toUpperCase()}`
  const totalAmount = decimalToNumber(purchase.total)
  const pendingAmount = decimalToNumber(purchase.saldoPendiente)
  const returnedAmount = returnMetrics.orderReturnedAmountMap.get(purchase.id) ?? 0
  const netAmount = Number(Math.max(0, totalAmount - returnedAmount).toFixed(2))
  const paidAmount = paymentMetrics.orderPaidAmountMap.get(purchase.id) ?? 0
  const paymentCount = paymentMetrics.orderPaymentCountMap.get(purchase.id) ?? 0
  const adjustedPendingAmount = calculatePurchaseOutstandingAmount({
    totalAmount,
    returnedAmount,
    paidAmount,
  })

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
    totalAmount,
    subtotalAmount: decimalToNumber(purchase.subtotal),
    taxAmount: decimalToNumber(purchase.impuestoTotal),
    pendingAmount,
    adjustedPendingAmount,
    returnedAmount,
    netAmount,
    paidAmount,
    paymentCount,
    status: purchase.estado,
    observations: purchase.observaciones,
    itemNames: purchase.detalles.map((detail) => detail.producto.nombre),
  }
}

function mapPurchaseReceipts(
  purchases: PurchaseWithRelations[],
  codeMap: Map<string, string>,
  returnMetrics: PurchaseReturnMetrics,
) {
  return purchases.flatMap((purchase) =>
    purchase.detalles.map((detail) => {
      const orderedUnits = decimalToNumber(detail.cantidad)
      const receivedUnits = detail.lotes.reduce(
        (sum, lot) => sum + decimalToNumber(lot.stockInicial),
        0,
      )
      const packFactor = detail.factorEmpaque ?? null
      const orderedPacks = detail.cantidadEmpaque ?? null
      const receivedPacks = packFactor ? Number((receivedUnits / packFactor).toFixed(4)) : null
      const pendingPacks = packFactor
        ? Number(((orderedUnits - receivedUnits) / packFactor).toFixed(4))
        : null
      const latestLot = [...detail.lotes].sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )[0]
      const returnedUnits = returnMetrics.detailReturnedUnitsMap.get(detail.id) ?? 0
      const returnedAmount = returnMetrics.detailReturnedAmountMap.get(detail.id) ?? 0

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
        lotId: latestLot?.id ?? null,
        lotCode: latestLot?.numeroLote ?? 'Pendiente de recepción',
        receivedUnits,
        orderedUnits,
        pendingUnits: Math.max(0, Number((orderedUnits - receivedUnits).toFixed(4))),
        packaging: detail.empaque ?? null,
        packFactor,
        orderedPacks,
        receivedPacks,
        pendingPacks: pendingPacks === null ? null : Math.max(0, pendingPacks),
        returnedUnits,
        returnedAmount,
        availableUnits: decimalToNumber(latestLot?.stockDisponible),
        reservedUnits: decimalToNumber(latestLot?.stockReservado),
        blockedUnits: decimalToNumber(latestLot?.stockBloqueado),
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
  await ensureDefaultPaymentMethods(prisma)

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
        modoEmpaque: true,
        unidadesPorBlister: true,
        blistersPorCaja: true,
        costoReferencia: true,
        unidadMedida: {
          select: {
            simbolo: true,
          },
        },
      },
    }),
  ])

  const returnMetrics = await buildPurchaseReturnMetrics(purchases.map((purchase) => purchase.id))
  const paymentMetrics = await buildPurchasePaymentMetrics(
    purchases.map((purchase) => purchase.id),
  )
  const mappedOrders = purchases.map((purchase) =>
    mapPurchaseOrder(purchase, codeMap, returnMetrics, paymentMetrics),
  )
  const mappedReceipts = mapPurchaseReceipts(purchases, codeMap, returnMetrics)
  const purchaseLookup = new Map(
    mappedOrders.map((order) => [order.id, order]),
  )

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
  const filteredPayments = paymentMetrics.payments
    .filter((payment) => filteredOrderIds.has(payment.purchaseId))
    .map((payment) => {
      const order = purchaseLookup.get(payment.purchaseId)

      return {
        id: payment.id,
        purchaseId: payment.purchaseId,
        purchaseCode: order?.code ?? `CMP-${payment.purchaseId.slice(0, 6).toUpperCase()}`,
        supplierName: order?.supplierName ?? 'Proveedor',
        formPaymentId: payment.formPaymentId,
        formPaymentCode: payment.formPaymentCode,
        formPaymentName: payment.formPaymentName,
        amount: payment.amount,
        paidAt: payment.paidAt,
        reference: payment.reference,
        observations: payment.observations,
      }
    })

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
      returnedAmount: Number(
        filteredOrders
          .filter((order) => order.status !== EstadoCompra.ANULADA)
          .reduce((sum, order) => sum + order.returnedAmount, 0)
          .toFixed(2),
      ),
      netSpend: Number(
        filteredOrders
          .filter((order) => order.status !== EstadoCompra.ANULADA)
          .reduce((sum, order) => sum + order.netAmount, 0)
          .toFixed(2),
      ),
      totalPaid: Number(
        filteredOrders
          .filter((order) => order.status !== EstadoCompra.ANULADA)
          .reduce((sum, order) => sum + order.paidAmount, 0)
          .toFixed(2),
      ),
      pendingPayables: Number(
        filteredOrders
          .filter((order) => order.status !== EstadoCompra.ANULADA)
          .reduce((sum, order) => sum + order.adjustedPendingAmount, 0)
          .toFixed(2),
      ),
      supplierCount: new Set(filteredOrders.map((order) => order.supplierId)).size,
    },
    orders: filteredOrders.map(({ itemNames, ...order }) => order),
    receipts: filteredReceipts,
    payments: filteredPayments,
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
      paymentMethods: await prisma.formaPago.findMany({
        where: {
          deletedAt: null,
          activo: true,
        },
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
        select: {
          id: true,
          codigo: true,
          nombre: true,
          requiereReferencia: true,
        },
      }).then((methods) =>
        methods.map((method) => ({
          id: method.id,
          code: method.codigo,
          name: method.nombre,
          requiresReference: method.requiereReferencia,
        })),
      ),
      products: products.map((product) => ({
        id: product.id,
        name: product.nombre,
        sku: product.sku,
        unitSymbol: product.unidadMedida.simbolo,
        referenceCost: decimalToNumber(product.costoReferencia),
        packagingMode: product.modoEmpaque,
        unitsPerBlister: product.unidadesPorBlister,
        blistersPerBox: product.blistersPorCaja,
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
          modoEmpaque: true,
          unidadesPorBlister: true,
          blistersPorCaja: true,
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
      const requestedQuantity = Number(item.cantidad)
      const requestedUnitCost = Number(item.costoUnitario)
      const taxRate = Number(item.porcentajeImpuesto ?? 18)
      const product = productMap.get(item.productoId)!
      const packType =
        product.modoEmpaque === ModoEmpaqueProducto.BLISTER
          ? (item.empaque ?? EmpaqueProducto.CAJA)
          : null
      const packFactor =
        product.modoEmpaque === ModoEmpaqueProducto.BLISTER
          ? packType === EmpaqueProducto.UNIDAD
            ? 1
            : packType === EmpaqueProducto.BLISTER
              ? product.unidadesPorBlister ?? null
              : packType === EmpaqueProducto.CAJA
                ? product.unidadesPorBlister && product.blistersPorCaja
                  ? product.unidadesPorBlister * product.blistersPorCaja
                  : null
                : null
          : null
      const quantity =
        product.modoEmpaque === ModoEmpaqueProducto.BLISTER
          ? requestedQuantity * Number(packFactor)
          : requestedQuantity
      const unitCost =
        product.modoEmpaque === ModoEmpaqueProducto.BLISTER
          ? requestedUnitCost / Number(packFactor)
          : requestedUnitCost

      if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
        throw createHttpError(400, 'La cantidad de cada línea debe ser mayor a 0.')
      }

      if (!Number.isFinite(requestedUnitCost) || requestedUnitCost < 0) {
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

      if (product.modoEmpaque === ModoEmpaqueProducto.BLISTER) {
        if (!Number.isInteger(requestedQuantity)) {
          throw createHttpError(
            400,
            'La cantidad debe ser un entero al comprar por caja o blíster.',
          )
        }

        if (!packFactor || !Number.isFinite(Number(packFactor)) || Number(packFactor) <= 0) {
          throw createHttpError(400, 'La configuración de empaque del producto no es válida.')
        }

        if (!Number.isInteger(Number(packFactor))) {
          throw createHttpError(400, 'El factor de empaque debe ser un entero.')
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw createHttpError(400, 'No fue posible calcular la cantidad en unidad base.')
        }

        if (!Number.isFinite(unitCost) || unitCost < 0) {
          throw createHttpError(400, 'No fue posible calcular el costo unitario en unidad base.')
        }
      }

      const baseAmount = quantity * unitCost
      const taxAmount = baseAmount * (taxRate / 100)
      const totalAmount = baseAmount + taxAmount

      return {
        productoId: item.productoId,
        cantidad: quantity,
        costoUnitario: unitCost,
        requestedUnitCost,
        porcentajeImpuesto: taxRate,
        subtotal: baseAmount,
        impuestoTotal: taxAmount,
        total: totalAmount,
        product,
        pack: {
          type: packType,
          quantity: product.modoEmpaque === ModoEmpaqueProducto.BLISTER ? requestedQuantity : null,
          factor: packFactor,
        },
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
            cantidad: item.cantidad,
            empaque: item.pack.type ?? undefined,
            cantidadEmpaque:
              item.pack.quantity === null || item.pack.quantity === undefined
                ? undefined
                : Math.trunc(item.pack.quantity),
            factorEmpaque:
              item.pack.factor === null || item.pack.factor === undefined
                ? undefined
                : Math.trunc(item.pack.factor),
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
      {
        orderReturnedAmountMap: new Map(),
        detailReturnedUnitsMap: new Map(),
        detailReturnedAmountMap: new Map(),
      },
      {
        orderPaidAmountMap: new Map(),
        orderPaymentCountMap: new Map(),
        payments: [],
      },
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
        quantity: item.pack.quantity ?? item.cantidad,
        unitCost:
          item.pack.quantity === null || item.pack.quantity === undefined
            ? item.costoUnitario
            : item.requestedUnitCost,
        taxRate: item.porcentajeImpuesto,
        total: Number(item.total.toFixed(2)),
      })),
    }
  })

  return result
}

export async function registerPurchasePayment(
  payload: RegisterPurchasePaymentPayload,
  request: FastifyRequest,
) {
  const userId = await getAuthenticatedUserId(request)
  const amount = Number(payload.monto)
  const paymentDate = payload.fechaPago
    ? new Date(`${payload.fechaPago}T00:00:00`)
    : new Date()

  if (!Number.isFinite(amount) || amount <= 0) {
    throw createHttpError(400, 'El monto del pago debe ser mayor a 0.')
  }

  if (Number.isNaN(paymentDate.getTime())) {
    throw createHttpError(400, 'La fecha del pago no es válida.')
  }

  const result = await prisma.$transaction(async (tx) => {
    await ensureDefaultPaymentMethods(tx, userId)

    const [purchase, paymentMethod] = await Promise.all([
      tx.compra.findFirst({
        where: {
          id: payload.compraId,
          deletedAt: null,
        },
        include: {
          proveedor: {
            select: {
              razonSocial: true,
            },
          },
        },
      }),
      tx.formaPago.findFirst({
        where: {
          id: payload.formaPagoId,
          deletedAt: null,
          activo: true,
        },
      }),
    ])

    if (!purchase) {
      throw createHttpError(404, 'La compra seleccionada no está disponible.')
    }

    if (
      purchase.estado === EstadoCompra.BORRADOR ||
      purchase.estado === EstadoCompra.ANULADA
    ) {
      throw createHttpError(
        400,
        'Solo puedes registrar pagos en compras activas o ya recibidas.',
      )
    }

    if (!paymentMethod) {
      throw createHttpError(404, 'La forma de pago seleccionada no está disponible.')
    }

    if (paymentMethod.requiereReferencia && !toOptionalString(payload.referenciaExterna)) {
      throw createHttpError(
        400,
        'La forma de pago seleccionada requiere una referencia externa.',
      )
    }

    const [paidAggregate, returnMovements] = await Promise.all([
      tx.compraPago.aggregate({
        where: {
          compraId: purchase.id,
          deletedAt: null,
        },
        _sum: {
          monto: true,
        },
      }),
      tx.movimientoInventario.findMany({
        where: {
          deletedAt: null,
          origen: OrigenMovimientoInventario.DEVOLUCION_COMPRA,
          detalleCompra: {
            compraId: purchase.id,
          },
        },
        select: {
          cantidad: true,
          costoUnitario: true,
        },
      }),
    ])

    const totalAmount = decimalToNumber(purchase.total)
    const returnedAmount = Number(
      returnMovements
        .reduce(
          (sum, movement) =>
            sum +
            Math.abs(decimalToNumber(movement.cantidad)) *
              decimalToNumber(movement.costoUnitario),
          0,
        )
        .toFixed(2),
    )
    const paidAmount = decimalToNumber(paidAggregate._sum.monto)
    const outstandingAmount = calculatePurchaseOutstandingAmount({
      totalAmount,
      returnedAmount,
      paidAmount,
    })

    if (amount - outstandingAmount > 0.0001) {
      throw createHttpError(
        400,
        'El pago supera el saldo pendiente de la compra después de devoluciones.',
      )
    }

    const payment = await tx.compraPago.create({
      data: {
        compraId: purchase.id,
        formaPagoId: paymentMethod.id,
        monto: toDecimal(amount, 2),
        fechaPago: paymentDate,
        referenciaExterna: toOptionalString(payload.referenciaExterna),
        observaciones: toOptionalString(payload.observaciones),
        createdById: userId,
        updatedById: userId,
      },
    })

    const nextOutstandingAmount = Number(Math.max(0, outstandingAmount - amount).toFixed(2))

    await tx.compra.update({
      where: {
        id: purchase.id,
      },
      data: {
        saldoPendiente: toDecimal(nextOutstandingAmount, 2),
        updatedById: userId,
      },
    })

    return {
      id: payment.id,
      purchaseId: purchase.id,
      supplierName: purchase.proveedor.razonSocial,
      formPaymentId: paymentMethod.id,
      formPaymentCode: paymentMethod.codigo,
      formPaymentName: paymentMethod.nombre,
      amount,
      paidAt: formatDateTime(payment.fechaPago),
      reference: payment.referenciaExterna,
      observations: payment.observaciones,
      outstandingAmount: nextOutstandingAmount,
    }
  })

  return {
    item: result,
  }
}

export async function receivePurchaseItem(
  payload: ReceivePurchaseItemPayload,
  request: FastifyRequest,
) {
  const userId = await getAuthenticatedUserId(request)
  const receivedInput = Number(payload.cantidadRecibida)
  const reservedInput = Number(payload.stockReservado ?? 0)
  const blockedInput = Number(payload.stockBloqueado ?? 0)
  const expiryDate = new Date(`${payload.fechaVencimiento}T00:00:00`)
  const manufacturedAt = payload.fechaFabricacion
    ? new Date(`${payload.fechaFabricacion}T00:00:00`)
    : null

  if (!Number.isFinite(receivedInput) || receivedInput <= 0) {
    throw createHttpError(400, 'La cantidad recibida debe ser mayor a 0.')
  }

  if (reservedInput < 0 || blockedInput < 0) {
    throw createHttpError(400, 'El stock reservado y bloqueado no puede ser negativo.')
  }

  if (Number.isNaN(expiryDate.getTime())) {
    throw createHttpError(400, 'La fecha de vencimiento no es válida.')
  }

  if (manufacturedAt && Number.isNaN(manufacturedAt.getTime())) {
    throw createHttpError(400, 'La fecha de fabricación no es válida.')
  }

  if (manufacturedAt && manufacturedAt > expiryDate) {
    throw createHttpError(
      400,
      'La fecha de fabricación no puede ser posterior al vencimiento.',
    )
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const detail = await tx.detalleCompra.findFirst({
        where: {
          id: payload.detalleCompraId,
          deletedAt: null,
        },
        include: {
          compra: {
            select: {
              id: true,
              estado: true,
              proveedorId: true,
              sucursalId: true,
            },
          },
          producto: {
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
          },
          lotes: {
            where: {
              deletedAt: null,
            },
            select: {
              stockInicial: true,
            },
          },
        },
      })

      if (!detail) {
        throw createHttpError(404, 'La línea de compra seleccionada no está disponible.')
      }

      if (
        detail.compra.estado === EstadoCompra.BORRADOR ||
        detail.compra.estado === EstadoCompra.ANULADA
      ) {
        throw createHttpError(
          400,
          'Solo puedes recepcionar órdenes registradas o parcialmente recibidas.',
        )
      }

      const orderedUnits = decimalToNumber(detail.cantidad)
      const currentReceivedUnits = detail.lotes.reduce(
        (sum, lot) => sum + decimalToNumber(lot.stockInicial),
        0,
      )
      const pendingUnits = orderedUnits - currentReceivedUnits

      if (pendingUnits <= 0.0001) {
        throw createHttpError(
          400,
          'La línea de compra seleccionada ya fue recibida completamente.',
        )
      }

      const packFactor = detail.factorEmpaque ? Number(detail.factorEmpaque) : 1
      const receivedUnits = detail.factorEmpaque ? receivedInput * packFactor : receivedInput
      const reservedUnits = detail.factorEmpaque ? reservedInput * packFactor : reservedInput
      const blockedUnits = detail.factorEmpaque ? blockedInput * packFactor : blockedInput
      const availableUnits = receivedUnits - reservedUnits - blockedUnits

      if (detail.factorEmpaque) {
        if (!Number.isInteger(receivedInput)) {
          throw createHttpError(400, 'La cantidad recibida debe ser un entero.')
        }
        if (!Number.isInteger(reservedInput) || !Number.isInteger(blockedInput)) {
          throw createHttpError(400, 'El stock reservado y bloqueado debe ser un entero.')
        }
        if (!Number.isFinite(packFactor) || !Number.isInteger(packFactor) || packFactor <= 0) {
          throw createHttpError(400, 'El factor de empaque configurado no es válido.')
        }
      }

      if (availableUnits < 0) {
        throw createHttpError(
          400,
          'La suma de stock reservado y bloqueado no puede superar lo recibido.',
        )
      }

      if (receivedUnits - pendingUnits > 0.0001) {
        throw createHttpError(
          400,
          'La cantidad recibida no puede superar el saldo pendiente de la línea.',
        )
      }

      const [openingReason, reserveReason, blockReason] = await Promise.all([
        ensureMovementReason(tx, userId, {
          code: 'RECEPCION_COMPRA',
          name: 'Recepción de compra',
          description:
            'Ingreso de stock originado por la recepción física de una compra.',
          type: TipoMovimientoInventario.ENTRADA,
        }),
        ensureMovementReason(tx, userId, {
          code: 'RECEPCION_COMPRA_RESERVA',
          name: 'Reserva en recepción',
          description:
            'Reserva operativa aplicada durante la recepción de una compra.',
          type: TipoMovimientoInventario.RESERVA,
        }),
        ensureMovementReason(tx, userId, {
          code: 'RECEPCION_COMPRA_BLOQUEO',
          name: 'Bloqueo en recepción',
          description:
            'Bloqueo sanitario u operativo aplicado durante la recepción de una compra.',
          type: TipoMovimientoInventario.AJUSTE,
        }),
      ])

      await tx.inventario.upsert({
        where: {
          sucursalId_productoId: {
            sucursalId: detail.compra.sucursalId,
            productoId: detail.productoId,
          },
        },
        update: {
          ubicacion: toOptionalString(payload.almacen),
          updatedById: userId,
        },
        create: {
          sucursalId: detail.compra.sucursalId,
          productoId: detail.productoId,
          ubicacion: toOptionalString(payload.almacen),
          createdById: userId,
          updatedById: userId,
        },
      })

      const lot = await tx.lote.create({
        data: {
          sucursalId: detail.compra.sucursalId,
          productoId: detail.productoId,
          detalleCompraId: detail.id,
          proveedorId: detail.compra.proveedorId,
          numeroLote: payload.numeroLote.trim().toUpperCase(),
          fechaFabricacion: manufacturedAt ?? undefined,
          fechaVencimiento: expiryDate,
          costoUnitario: detail.costoUnitario,
          stockInicial: receivedUnits,
          stockDisponible: availableUnits,
          stockReservado: reservedUnits,
          stockBloqueado: blockedUnits,
          estado: resolveLotStatus({
            expiryDate,
            availableUnits,
            reservedUnits,
            blockedUnits,
          }),
          observaciones: toOptionalString(payload.observaciones),
          createdById: userId,
          updatedById: userId,
        },
      })

      const baseReference = `Recepción compra ${detail.compra.id.slice(0, 8).toUpperCase()} lote ${lot.numeroLote}`

      await tx.movimientoInventario.create({
        data: {
          sucursalId: detail.compra.sucursalId,
          productoId: detail.productoId,
          loteId: lot.id,
          motivoId: openingReason.id,
          detalleCompraId: detail.id,
          tipo: TipoMovimientoInventario.ENTRADA,
          origen: OrigenMovimientoInventario.COMPRA,
          cantidad: receivedUnits,
          costoUnitario: detail.costoUnitario,
          stockResultante: receivedUnits,
          referencia: baseReference,
          observaciones: toOptionalString(payload.observaciones),
          createdById: userId,
          updatedById: userId,
        },
      })

      if (reservedUnits > 0) {
        await tx.movimientoInventario.create({
          data: {
            sucursalId: detail.compra.sucursalId,
            productoId: detail.productoId,
            loteId: lot.id,
            motivoId: reserveReason.id,
            detalleCompraId: detail.id,
            tipo: TipoMovimientoInventario.RESERVA,
            origen: OrigenMovimientoInventario.COMPRA,
            cantidad: -reservedUnits,
            costoUnitario: detail.costoUnitario,
            stockResultante: receivedUnits - reservedUnits,
            referencia: `Reserva en recepción lote ${lot.numeroLote}`,
            observaciones: toOptionalString(payload.observaciones),
            createdById: userId,
            updatedById: userId,
          },
        })
      }

      if (blockedUnits > 0) {
        await tx.movimientoInventario.create({
          data: {
            sucursalId: detail.compra.sucursalId,
            productoId: detail.productoId,
            loteId: lot.id,
            motivoId: blockReason.id,
            detalleCompraId: detail.id,
            tipo: TipoMovimientoInventario.AJUSTE,
            origen: OrigenMovimientoInventario.COMPRA,
            cantidad: -blockedUnits,
            costoUnitario: detail.costoUnitario,
            stockResultante: availableUnits,
            referencia: `Bloqueo en recepción lote ${lot.numeroLote}`,
            observaciones: toOptionalString(payload.observaciones),
            createdById: userId,
            updatedById: userId,
          },
        })
      }

      await updatePurchaseReceiptStatus(tx, detail.compra.id, userId)

      return {
        id: lot.id,
        detailId: detail.id,
        purchaseId: detail.compra.id,
        productName: detail.producto.nombre,
        sku: detail.producto.sku,
        unitSymbol: detail.producto.unidadMedida.simbolo,
        lotCode: lot.numeroLote,
        receivedUnits,
        availableUnits,
        reservedUnits,
        blockedUnits,
        expiryDate: formatDate(lot.fechaVencimiento),
      }
    })

    return {
      item: result,
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw createHttpError(
        409,
        'Ya existe un lote con ese número para el producto y sucursal seleccionados.',
      )
    }

    throw error
  }
}

export async function returnPurchaseItem(
  payload: ReturnPurchaseItemPayload,
  request: FastifyRequest,
) {
  const userId = await getAuthenticatedUserId(request)
  const quantity = Number(payload.quantity)

  if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
    throw createHttpError(400, 'La cantidad a devolver debe ser mayor a 0.')
  }

  const result = await prisma.$transaction(async (tx) => {
    const lot = await tx.lote.findFirst({
      where: {
        id: payload.lotId,
        deletedAt: null,
        detalleCompraId: {
          not: null,
        },
      },
      include: {
        producto: {
          select: {
            nombre: true,
            sku: true,
            unidadMedida: {
              select: {
                simbolo: true,
              },
            },
          },
        },
        detalleCompra: {
          select: {
            id: true,
            compraId: true,
          },
        },
      },
    })

    if (!lot || !lot.detalleCompra) {
      throw createHttpError(404, 'El lote seleccionado no pertenece a una compra válida.')
    }

    const currentAvailable = decimalToNumber(lot.stockDisponible)
    const currentReserved = decimalToNumber(lot.stockReservado)
    const currentBlocked = decimalToNumber(lot.stockBloqueado)
    let nextAvailable = currentAvailable
    let nextReserved = currentReserved
    let nextBlocked = currentBlocked
    let currentTargetUnits = currentAvailable
    let reference = `Devolución a proveedor lote ${lot.numeroLote}`

    if (payload.target === 'DISPONIBLE') {
      currentTargetUnits = currentAvailable
      nextAvailable = currentAvailable - quantity
      reference = `Devolución desde stock disponible lote ${lot.numeroLote}`
    }

    if (payload.target === 'RESERVADO') {
      currentTargetUnits = currentReserved
      nextReserved = currentReserved - quantity
      reference = `Devolución desde stock reservado lote ${lot.numeroLote}`
    }

    if (payload.target === 'BLOQUEADO') {
      currentTargetUnits = currentBlocked
      nextBlocked = currentBlocked - quantity
      reference = `Devolución desde stock bloqueado lote ${lot.numeroLote}`
    }

    if (currentTargetUnits < quantity) {
      throw createHttpError(
        400,
        'La devolución supera el stock disponible en el estado seleccionado.',
      )
    }

    const reason = await ensureMovementReason(tx, userId, {
      code: `DEVOLUCION_COMPRA_${payload.target}`,
      name: `Devolución compra ${payload.target.toLowerCase()}`,
      description: 'Salida de stock por devolución al proveedor desde el módulo de compras.',
      type: TipoMovimientoInventario.SALIDA,
    })

    const status = resolveLotStatus({
      expiryDate: lot.fechaVencimiento,
      availableUnits: nextAvailable,
      reservedUnits: nextReserved,
      blockedUnits: nextBlocked,
    })

    await tx.lote.update({
      where: {
        id: lot.id,
      },
      data: {
        stockDisponible: nextAvailable,
        stockReservado: nextReserved,
        stockBloqueado: nextBlocked,
        estado: status,
        observaciones: toOptionalString(payload.observaciones) ?? lot.observaciones ?? undefined,
        updatedById: userId,
      },
    })

    await tx.movimientoInventario.create({
      data: {
        sucursalId: lot.sucursalId,
        productoId: lot.productoId,
        loteId: lot.id,
        motivoId: reason.id,
        detalleCompraId: lot.detalleCompra.id,
        tipo: TipoMovimientoInventario.SALIDA,
        origen: OrigenMovimientoInventario.DEVOLUCION_COMPRA,
        cantidad: -quantity,
        costoUnitario: lot.costoUnitario,
        stockResultante: nextAvailable,
        referencia: reference,
        observaciones: toOptionalString(payload.observaciones),
        createdById: userId,
        updatedById: userId,
      },
    })

    const [purchase, paidAggregate, returnMovements] = await Promise.all([
      tx.compra.findUnique({
        where: {
          id: lot.detalleCompra.compraId,
        },
        select: {
          total: true,
        },
      }),
      tx.compraPago.aggregate({
        where: {
          compraId: lot.detalleCompra.compraId,
          deletedAt: null,
        },
        _sum: {
          monto: true,
        },
      }),
      tx.movimientoInventario.findMany({
        where: {
          deletedAt: null,
          origen: OrigenMovimientoInventario.DEVOLUCION_COMPRA,
          detalleCompra: {
            compraId: lot.detalleCompra.compraId,
          },
        },
        select: {
          cantidad: true,
          costoUnitario: true,
        },
      }),
    ])

    if (purchase) {
      const returnedAmount = Number(
        returnMovements
          .reduce(
            (sum, movement) =>
              sum +
              Math.abs(decimalToNumber(movement.cantidad)) *
                decimalToNumber(movement.costoUnitario),
            0,
          )
          .toFixed(2),
      )
      const paidAmount = decimalToNumber(paidAggregate._sum.monto)
      const nextOutstandingAmount = calculatePurchaseOutstandingAmount({
        totalAmount: decimalToNumber(purchase.total),
        returnedAmount,
        paidAmount,
      })

      await tx.compra.update({
        where: {
          id: lot.detalleCompra.compraId,
        },
        data: {
          saldoPendiente: toDecimal(nextOutstandingAmount, 2),
          updatedById: userId,
        },
      })
    }

    return {
      id: lot.id,
      detailId: lot.detalleCompra.id,
      purchaseId: lot.detalleCompra.compraId,
      productName: lot.producto.nombre,
      sku: lot.producto.sku,
      unitSymbol: lot.producto.unidadMedida.simbolo,
      lotCode: lot.numeroLote,
      target: payload.target,
      returnedUnits: quantity,
      availableUnits: nextAvailable,
      reservedUnits: nextReserved,
      blockedUnits: nextBlocked,
      status,
    }
  })

  return {
    item: result,
  }
}
