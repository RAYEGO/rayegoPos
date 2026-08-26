import {
  AccionAuditoria,
  CodigoFormaPago,
  EstadoCompra,
  EstadoCompraFinanciero,
  EstadoCompraLogistico,
  EstadoAperturaCaja,
  EstadoLote,
  OrigenMovimientoInventario,
  OperacionCaja,
  Prisma,
  TipoComprobante,
  TipoMovimientoCaja,
  TipoMovimientoInventario,
} from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { getAuthContext } from '../../lib/auth.js'
import { formatDateInTimeZone, isSameDateInTimeZone } from '../../lib/timeZoneDate.js'
import {
  buildPackagingSnapshot,
  convertAmountToBaseUnit,
  convertQuantityToBaseUnits,
  resolvePackagingOperationContext,
} from '../../lib/productPackaging.js'
import { buildEnsureDefaultPaymentMethodsUpsert, classifyPaymentMethod } from '../../shared/payment-catalog.js'

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
      presentacion: {
        select: {
          id: true,
          nombre: true,
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
  logisticsStatus?: EstadoCompraLogistico
  financialStatus?: EstadoCompraFinanciero
  branchId?: string
  supplierId?: string
}

type CreatePurchaseOrderPayload = {
  sucursalId?: string
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

type UpdatePurchaseOrderPayload = Partial<
  Omit<CreatePurchaseOrderPayload, 'items'>
> & {
  items: CreatePurchaseOrderPayload['items']
}

type ReceivePurchaseItemPayload = {
  detalleCompraId: string
  numeroLote: string
  fechaFabricacion?: string
  fechaVencimiento: string
  cantidadRecibida: number
  costoUnitarioRecepcion?: number
  stockReservado?: number
  stockBloqueado?: number
  almacen?: string
  observaciones?: string
}

type CreatePurchaseReceptionPayload = {
  compraId: string
  observaciones?: string
  items: ReceivePurchaseItemPayload[]
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

type PurchaseDashboardStaticOptions = {
  branches: Array<{
    id: string
    name: string
  }>
  suppliers: Array<{
    id: string
    name: string
    documentNumber: string
  }>
  paymentMethods: Array<{
    id: string
    code: string
    name: string
    category: string
    digitalSubmethod: string | null
    requiresReference: boolean
  }>
  products: Array<{
    id: string
    name: string
    sku: string
    unitSymbol: string
    lastPurchaseCost: number
    packaging: {
      basePresentationId: string | null
      purchasePresentationId: string | null
      presentations: Array<{
        id: string
        name: string
        isBase: boolean
        allowsPurchase: boolean
        allowsSale: boolean
        salePrice: number | null
        factorToBase: number | null
      }>
    } | null
  }>
}

const PAYMENT_METHODS_CACHE_TTL_MS = 5 * 60_000
const PURCHASE_CODE_CACHE_TTL_MS = 60_000
const PURCHASE_DASHBOARD_OPTIONS_CACHE_TTL_MS = 30_000

let paymentMethodsEnsuredUntil = 0
let purchaseCodeCache:
  | {
      expiresAt: number
      value: Map<string, string>
    }
  | null = null
const purchaseDashboardOptionsCache = new Map<
  string,
  {
    expiresAt: number
    value: PurchaseDashboardStaticOptions
  }
>()

function createHttpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number }
  error.statusCode = statusCode
  return error
}

// #region debug-point purchase-payment-advance-500.reporter
function getDebugServerUrl() {
  const value = process.env.DEBUG_SERVER_URL?.trim()
  return value ? value.replace(/\/+$/, '') : null
}

function getDebugSessionId() {
  const value = process.env.DEBUG_SESSION_ID?.trim()
  return value ? value : 'session'
}

function extractErrorInfo(err: unknown) {
  const error = err as {
    name?: unknown
    message?: unknown
    stack?: unknown
    code?: unknown
    meta?: unknown
    statusCode?: unknown
  }

  return {
    name: typeof error?.name === 'string' ? error.name : null,
    message: typeof error?.message === 'string' ? error.message : null,
    stack: typeof error?.stack === 'string' ? error.stack : null,
    statusCode: typeof error?.statusCode === 'number' ? error.statusCode : null,
    prismaCode: typeof error?.code === 'string' ? error.code : null,
    prismaMeta: error?.meta ?? null,
  }
}

function isClosedTransactionError(err: unknown) {
  const message = extractErrorInfo(err).message ?? ''
  return /Transaction API error|Transaction not found|Transaction already closed|Transaction ID is invalid/i.test(
    message,
  )
}

function reportDebugEvent(event: string, payload: Record<string, unknown>) {
  const debugServerUrl = getDebugServerUrl()
  if (!debugServerUrl) return

  void fetch(`${debugServerUrl}/log`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sessionId: getDebugSessionId(),
      event,
      ...payload,
    }),
  }).catch(() => null)
}
// #endregion debug-point purchase-payment-advance-500.reporter

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
  if (!value) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const y = parts.find((p) => p.type === 'year')?.value ?? '0000'
  const m = parts.find((p) => p.type === 'month')?.value ?? '00'
  const d = parts.find((p) => p.type === 'day')?.value ?? '00'
  return `${y}-${m}-${d}`
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
  const { userId } = await getAuthContext(request)
  return userId
}

async function buildPurchaseCodeMap() {
  const now = Date.now()
  if (purchaseCodeCache && purchaseCodeCache.expiresAt > now) {
    return new Map(purchaseCodeCache.value)
  }

  const orderedPurchases = await prisma.compra.findMany({
    where: {
      deletedAt: null,
    },
    select: {
      id: true,
    },
    orderBy: [{ fechaEmision: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  })

  const value = new Map(
    orderedPurchases.map((purchase, index) => [purchase.id, buildPurchaseCode(index + 1)]),
  )
  purchaseCodeCache = {
    expiresAt: now + PURCHASE_CODE_CACHE_TTL_MS,
    value,
  }
  return new Map(value)
}

function invalidatePurchaseCodeCache() {
  purchaseCodeCache = null
}

function invalidatePurchaseDashboardOptionsCache(companyId?: string) {
  if (companyId) {
    purchaseDashboardOptionsCache.delete(companyId)
    return
  }

  purchaseDashboardOptionsCache.clear()
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

async function createPurchaseReceptionRecord(
  tx: Prisma.TransactionClient,
  purchaseId: string,
  userId: string,
  observaciones?: string,
) {
  const { _max } = await tx.compraRecepcion.aggregate({
    where: {
      compraId: purchaseId,
      deletedAt: null,
    },
    _max: {
      numero: true,
    },
  })

  const numero = (_max.numero ?? 0) + 1

  return tx.compraRecepcion.create({
    data: {
      compraId: purchaseId,
      numero,
      observaciones: toOptionalString(observaciones),
      createdById: userId,
      updatedById: userId,
    },
  })
}

async function ensureDefaultPaymentMethods(
  db: Prisma.TransactionClient | typeof prisma,
  userId?: string,
) {
  if (paymentMethodsEnsuredUntil > Date.now()) {
    return
  }

  const upserts = buildEnsureDefaultPaymentMethodsUpsert(userId)

  await Promise.all(
    upserts.map((upsert) =>
      db.formaPago.upsert({
        where: upsert.where,
        update: upsert.update,
        create: upsert.create,
      }),
    ),
  )

  paymentMethodsEnsuredUntil = Date.now() + PAYMENT_METHODS_CACHE_TTL_MS
}

async function getPurchaseDashboardStaticOptions(
  companyId: string,
): Promise<PurchaseDashboardStaticOptions> {
  const cached = purchaseDashboardOptionsCache.get(companyId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  await ensureDefaultPaymentMethods(prisma)

  const [branches, suppliers, paymentMethods, products] = await Promise.all([
    prisma.sucursal.findMany({
      where: {
        deletedAt: null,
        activo: true,
        empresaId: companyId,
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
        empresaId: companyId,
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
    prisma.formaPago.findMany({
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
    }),
    prisma.producto.findMany({
      where: {
        deletedAt: null,
        estado: 'ACTIVO',
        empresaId: companyId,
      },
      orderBy: {
        nombre: 'asc',
      },
      select: {
        id: true,
        nombre: true,
        sku: true,
        compraPresentacionId: true,
        presentacionesEmpaque: {
          where: { deletedAt: null },
          select: {
            esBase: true,
            permiteCompra: true,
            permiteVenta: true,
            precioVenta: true,
            presentacion: {
              select: {
                id: true,
                nombre: true,
              },
            },
          },
        },
        conversionesEmpaque: {
          where: { deletedAt: null },
          select: {
            desdePresentacionId: true,
            haciaPresentacionId: true,
            cantidad: true,
          },
        },
        unidadMedida: {
          select: {
            simbolo: true,
          },
        },
        detalleCompras: {
          where: {
            deletedAt: null,
            compra: {
              deletedAt: null,
            },
          },
          orderBy: [{ createdAt: 'desc' }],
          take: 1,
          select: {
            costoUnitario: true,
            factorPresentacion: true,
            factorEmpaque: true,
          },
        },
      },
    }),
  ])

  const value: PurchaseDashboardStaticOptions = {
    branches: branches.map((branch) => ({
      id: branch.id,
      name: branch.nombre,
    })),
    suppliers: suppliers.map((supplier) => ({
      id: supplier.id,
      name: supplier.razonSocial,
      documentNumber: supplier.numeroDocumento,
    })),
    paymentMethods: paymentMethods.map((method) => {
      const classification = classifyPaymentMethod(method.codigo)
      return {
        id: method.id,
        code: method.codigo,
        name: method.nombre,
        category: classification.category,
        digitalSubmethod: classification.digitalSubmethod,
        requiresReference: method.requiereReferencia,
      }
    }),
    products: products.map((product) => ({
      packaging: buildPackagingSnapshot({
        presentations: product.presentacionesEmpaque ?? [],
        conversions: product.conversionesEmpaque ?? [],
        purchasePresentationId: product.compraPresentacionId,
      }),
      id: product.id,
      name: product.nombre,
      sku: product.sku,
      unitSymbol: product.unidadMedida.simbolo,
      lastPurchaseCost: (() => {
        const latestPurchaseDetail = product.detalleCompras[0]
        if (!latestPurchaseDetail) {
          return 0
        }

        const factor =
          latestPurchaseDetail.factorPresentacion ??
          latestPurchaseDetail.factorEmpaque ??
          1

        return Number(
          (
            decimalToNumber(latestPurchaseDetail.costoUnitario) * Math.max(1, factor)
          ).toFixed(6),
        )
      })(),
    })),
  }

  purchaseDashboardOptionsCache.set(companyId, {
    expiresAt: Date.now() + PURCHASE_DASHBOARD_OPTIONS_CACHE_TTL_MS,
    value,
  })

  return value
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

async function createCashMovementExpense(
  tx: Prisma.TransactionClient,
  payload: {
    openingId: string
    paymentMethodId: string
    amount: number
    paymentId: string
    supplierName: string
    paymentMethodName: string
    userId: string
  },
) {
  return tx.movimientoCaja.create({
    data: {
      aperturaCajaId: payload.openingId,
      formaPagoId: payload.paymentMethodId,
      tipo: TipoMovimientoCaja.EGRESO,
      operacion: OperacionCaja.EGRESO,
      monto: toDecimal(payload.amount, 2),
      referencia: toOptionalString(payload.paymentId),
      observaciones: toOptionalString(
        `Pago a proveedor · ${payload.supplierName} · ${payload.paymentMethodName}`,
      ),
      createdById: payload.userId,
      updatedById: payload.userId,
    },
  })
}

async function createPurchasePaymentAuditEntry(
  tx: Prisma.TransactionClient,
  payload: {
    userId: string
    paymentId: string
    purchaseId: string
    amount: number
    outstandingAmount: number
    request: FastifyRequest
  },
) {
  await tx.auditoria.create({
    data: {
      usuarioId: payload.userId,
      tabla: 'compra_pagos',
      registroId: payload.paymentId,
      accion: AccionAuditoria.INSERT,
      valorNuevo: {
        compraId: payload.purchaseId,
        monto: payload.amount,
        saldoPendiente: payload.outstandingAmount,
      } as Prisma.InputJsonValue,
      direccionIp: payload.request.ip,
      userAgent: payload.request.headers['user-agent'],
      createdById: payload.userId,
      updatedById: payload.userId,
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

  const nextLogisticsStatus = isFullyReceived
    ? EstadoCompraLogistico.RECEPCION_COMPLETA
    : hasAnyReceipt
      ? EstadoCompraLogistico.RECEPCION_PARCIAL
      : EstadoCompraLogistico.REGISTRADA

  await tx.compra.update({
    where: {
      id: purchaseId,
    },
    data: {
      estadoLogistico: nextLogisticsStatus,
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
  const receivedUnits = purchase.detalles.reduce(
    (sum, detail) =>
      sum +
      detail.lotes.reduce((detailSum, lot) => detailSum + decimalToNumber(lot.stockInicial), 0),
    0,
  )
  const receivedAmount = Number(
    purchase.detalles
      .reduce((sum, detail) => {
        const unitCost = decimalToNumber(detail.costoUnitario)
        const lineAmount = detail.lotes.reduce(
          (detailSum, lot) => detailSum + decimalToNumber(lot.stockInicial) * unitCost,
          0,
        )
        return sum + lineAmount
      }, 0)
      .toFixed(2),
  )

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
    logisticsStatus: purchase.estadoLogistico,
    financialStatus: purchase.estadoFinanciero,
    receivedUnits,
    receivedAmount,
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
      const presentationFactor = detail.factorPresentacion ?? detail.factorEmpaque ?? null
      const orderedPresentationQuantity =
        detail.cantidadPresentacion ?? detail.cantidadEmpaque ?? null
      const receivedPresentationQuantity = presentationFactor
        ? Number((receivedUnits / presentationFactor).toFixed(4))
        : null
      const pendingPresentationQuantity = presentationFactor
        ? Number(((orderedUnits - receivedUnits) / presentationFactor).toFixed(4))
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
        presentationName: detail.presentacion?.nombre ?? null,
        presentationFactor,
        orderedPresentationQuantity,
        receivedPresentationQuantity,
        pendingPresentationQuantity:
          pendingPresentationQuantity === null ? null : Math.max(0, pendingPresentationQuantity),
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

export async function getPurchaseDashboard(
  filters: PurchaseDashboardFilters,
  request: FastifyRequest,
) {
  const search = filters.search?.trim().toLowerCase()
  const { branchId, companyId } = await getAuthContext(request)
  const staticOptions = await getPurchaseDashboardStaticOptions(companyId)

  if (filters.branchId && filters.branchId !== branchId) {
    throw createHttpError(403, 'No tienes permisos para acceder a otra sucursal.')
  }

  const purchaseWhere: Prisma.CompraWhereInput = {
    deletedAt: null,
    ...(filters.status ? { estado: filters.status } : {}),
    ...(filters.logisticsStatus ? { estadoLogistico: filters.logisticsStatus } : {}),
    ...(filters.financialStatus ? { estadoFinanciero: filters.financialStatus } : {}),
    sucursalId: branchId,
    ...(filters.supplierId ? { proveedorId: filters.supplierId } : {}),
  }

  const [codeMap, purchases] = await Promise.all([
    buildPurchaseCodeMap(),
    prisma.compra.findMany({
      where: purchaseWhere,
      include: purchaseInclude,
      orderBy: [{ createdAt: 'desc' }],
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

  const isCancelledOrder = (order: typeof filteredOrders[number]) =>
    order.status === EstadoCompra.ANULADA || order.logisticsStatus === EstadoCompraLogistico.CANCELADA

  const isOrderClosed = (order: typeof filteredOrders[number]) =>
    order.logisticsStatus === EstadoCompraLogistico.RECEPCION_COMPLETA &&
    order.financialStatus === EstadoCompraFinanciero.PAGADA

  const supplierSummary = staticOptions.suppliers
    .map((supplier) => {
      const supplierPurchases = filteredOrders.filter((order) => order.supplierId === supplier.id)
      const supplierSource = purchases.filter((purchase) => purchase.proveedorId === supplier.id)
      const completedPurchases = supplierPurchases.filter(
        (order) => order.logisticsStatus === EstadoCompraLogistico.RECEPCION_COMPLETA,
      )
      const activeOrders = supplierPurchases.filter(
        (order) => !isCancelledOrder(order) && !isOrderClosed(order),
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
        (order) => !isCancelledOrder(order),
      ).length

      return {
        supplierId: supplier.id,
        supplierName: supplier.name,
        documentNumber: supplier.documentNumber,
        contactPhone: null,
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
        (order) => !isCancelledOrder(order) && !isOrderClosed(order),
      ).length,
      scheduledReceipts: filteredReceipts.filter((receipt) => receipt.status === 'PROGRAMADA')
        .length,
      observedReceipts: filteredReceipts.filter((receipt) => receipt.status === 'OBSERVADA')
        .length,
      activeSpend: Number(
        filteredOrders
          .filter((order) => !isCancelledOrder(order))
          .reduce((sum, order) => sum + order.totalAmount, 0)
          .toFixed(2),
      ),
      returnedAmount: Number(
        filteredOrders
          .filter((order) => !isCancelledOrder(order))
          .reduce((sum, order) => sum + order.returnedAmount, 0)
          .toFixed(2),
      ),
      netSpend: Number(
        filteredOrders
          .filter((order) => !isCancelledOrder(order))
          .reduce((sum, order) => sum + order.netAmount, 0)
          .toFixed(2),
      ),
      totalPaid: Number(
        filteredOrders
          .filter((order) => !isCancelledOrder(order))
          .reduce((sum, order) => sum + order.paidAmount, 0)
          .toFixed(2),
      ),
      pendingPayables: Number(
        filteredOrders
          .filter((order) => !isCancelledOrder(order))
          .reduce((sum, order) => sum + order.adjustedPendingAmount, 0)
          .toFixed(2),
      ),
      supplierCount: new Set(filteredOrders.map((order) => order.supplierId)).size,
    },
    orders: filteredOrders.map(({ itemNames, ...order }) => order),
    receipts: filteredReceipts,
    payments: filteredPayments,
    supplierSummary,
    options: staticOptions,
  }
}

export async function createPurchaseOrder(
  payload: CreatePurchaseOrderPayload,
  request: FastifyRequest,
) {
  const { userId, branchId, companyId } = await getAuthContext(request)
  const targetBranchId = payload.sucursalId ?? branchId

  if (payload.sucursalId && payload.sucursalId !== branchId) {
    throw createHttpError(403, 'No tienes permisos para crear compras en otra sucursal.')
  }
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

  const [branch, supplier, responsibleUser, products] = await Promise.all([
    prisma.sucursal.findFirst({
      where: {
        id: targetBranchId,
        deletedAt: null,
        activo: true,
        empresaId: companyId,
      },
    }),
    prisma.proveedor.findFirst({
      where: {
        id: payload.proveedorId,
        deletedAt: null,
        activo: true,
        empresaId: companyId,
      },
    }),
    prisma.usuario.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        activo: true,
        empresaId: companyId,
      },
    }),
    prisma.producto.findMany({
      where: {
        id: {
          in: payload.items.map((item) => item.productoId),
        },
        deletedAt: null,
        estado: 'ACTIVO',
        empresaId: companyId,
      },
      select: {
        id: true,
        nombre: true,
        sku: true,
        compraPresentacionId: true,
        presentacionesEmpaque: {
          where: { deletedAt: null },
          select: {
            esBase: true,
            permiteCompra: true,
            permiteVenta: true,
            precioVenta: true,
            presentacion: {
              select: {
                id: true,
                nombre: true,
              },
            },
          },
        },
        conversionesEmpaque: {
          where: { deletedAt: null },
          select: {
            desdePresentacionId: true,
            haciaPresentacionId: true,
            cantidad: true,
          },
        },
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
    const taxRate = Number(item.porcentajeImpuesto ?? 0)
    const product = productMap.get(item.productoId)!

    if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
      throw createHttpError(400, 'La cantidad de cada línea debe ser mayor a 0.')
    }

    if (!Number.isInteger(requestedQuantity)) {
      throw createHttpError(400, 'La cantidad debe ser un entero positivo.')
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

    const purchasePresentationId =
      product.compraPresentacionId ??
      product.presentacionesEmpaque.find((entry) => entry.esBase)?.presentacion.id ??
      ''

    const packagingContext = resolvePackagingOperationContext({
      operation: 'PURCHASE',
      presentationId: purchasePresentationId,
      presentations: product.presentacionesEmpaque ?? [],
      conversions: product.conversionesEmpaque ?? [],
    })

    if (!packagingContext.ok) {
      throw createHttpError(400, packagingContext.error)
    }

    const quantity = convertQuantityToBaseUnits({
      quantity: requestedQuantity,
      factorToBase: packagingContext.factorToBase,
    })
    const unitCost = convertAmountToBaseUnit({
      amount: requestedUnitCost,
      factorToBase: packagingContext.factorToBase,
    })

    if (quantity === null) {
      throw createHttpError(400, 'No fue posible calcular la cantidad en unidad base.')
    }

    if (unitCost === null) {
      throw createHttpError(400, 'No fue posible calcular el costo unitario en unidad base.')
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
      presentation: {
        id: purchasePresentationId,
        name: packagingContext.selectedPresentation.presentacion.nombre,
        quantity: requestedQuantity,
        factor: packagingContext.factorToBase,
      },
    }
  })

  const subtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0)
  const impuestoTotal = lineItems.reduce((sum, item) => sum + item.impuestoTotal, 0)
  const total = lineItems.reduce((sum, item) => sum + item.total, 0)

  const createdPurchase = await prisma.$transaction(async (tx) =>
    tx.compra.create({
      data: {
        sucursalId: targetBranchId,
        proveedorId: payload.proveedorId,
        usuarioResponsableId: userId,
        fechaEmision: emissionDate,
        fechaRecepcion: expectedReceptionDate ?? undefined,
        tipoComprobante: payload.tipoComprobante,
        serieComprobante: toOptionalString(payload.serieComprobante),
        numeroComprobante: toOptionalString(payload.numeroComprobante),
        estado: payload.estado,
        estadoLogistico: EstadoCompraLogistico.REGISTRADA,
        estadoFinanciero:
          total <= 0 ? EstadoCompraFinanciero.PAGADA : EstadoCompraFinanciero.SIN_PAGAR,
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
            presentacionId: item.presentation.id,
            cantidadPresentacion:
              item.presentation.quantity === null || item.presentation.quantity === undefined
                ? undefined
                : Math.trunc(item.presentation.quantity),
            factorPresentacion: Math.trunc(item.presentation.factor),
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
      select: {
        id: true,
        estado: true,
        fechaEmision: true,
        fechaRecepcion: true,
      },
    })
  )

  invalidatePurchaseCodeCache()
  const purchaseCodeMap = await buildPurchaseCodeMap()
  const purchaseCode =
    purchaseCodeMap.get(createdPurchase.id) ??
    `CMP-${createdPurchase.id.slice(0, 6).toUpperCase()}`

  invalidatePurchaseDashboardOptionsCache(companyId)

  return {
    item: {
      id: createdPurchase.id,
      code: purchaseCode,
      supplierName: supplier.razonSocial,
      branchName: branch.nombre,
      buyerName: formatFullName(responsibleUser),
      createdAt: formatDate(createdPurchase.fechaEmision),
      expectedAt: formatDate(createdPurchase.fechaRecepcion),
      itemCount: lineItems.length,
      totalAmount: Number(total.toFixed(2)),
      status: createdPurchase.estado,
    },
    details: lineItems.map((item) => ({
      productId: item.productoId,
      productName: item.product.nombre,
      sku: item.product.sku,
      unitSymbol: item.presentation.name ?? item.product.unidadMedida.simbolo,
      quantity: item.presentation.quantity ?? item.cantidad,
      unitCost:
        item.presentation.quantity === null || item.presentation.quantity === undefined
          ? item.costoUnitario
          : item.requestedUnitCost,
      taxRate: item.porcentajeImpuesto,
      total: Number(item.total.toFixed(2)),
    })),
  }
}

export async function updatePurchaseOrder(
  orderId: string,
  payload: UpdatePurchaseOrderPayload,
  request: FastifyRequest,
) {
  const { userId, branchId, companyId } = await getAuthContext(request)

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

  const currentOrder = await prisma.compra.findFirst({
    where: {
      id: orderId,
      deletedAt: null,
    },
    include: {
      sucursal: { select: { id: true, nombre: true, empresaId: true } },
      proveedor: { select: { id: true, razonSocial: true, numeroDocumento: true } },
      usuarioResponsable: { select: { id: true, nombres: true, apellidos: true } },
      detalles: {
        where: { deletedAt: null },
        include: {
          producto: { select: { id: true, nombre: true, sku: true } },
          presentacion: { select: { id: true, nombre: true } },
        },
      },
      recepciones: { where: { deletedAt: null }, select: { id: true } },
      pagos: { where: { deletedAt: null }, select: { id: true, monto: true } },
    },
  })

  if (!currentOrder) {
    throw createHttpError(404, 'La orden de compra no está disponible.')
  }

  if (currentOrder.sucursal?.empresaId !== companyId) {
    throw createHttpError(404, 'La orden de compra no está disponible.')
  }

  if (currentOrder.sucursalId !== branchId) {
    throw createHttpError(403, 'No tienes permisos para modificar compras de otra sucursal.')
  }

  if (currentOrder.estado === EstadoCompra.ANULADA) {
    throw createHttpError(400, 'La orden se encuentra anulada y no puede modificarse.')
  }

  if (currentOrder.estado === EstadoCompra.PAGADA) {
    throw createHttpError(400, 'La orden ya fue cerrada y no puede modificarse.')
  }

  if (currentOrder.recepciones.length > 0) {
    throw createHttpError(
      400,
      'Esta orden ya tiene una recepción registrada y no puede modificarse.',
    )
  }

  const emissionDate = payload.fechaEmision
    ? new Date(`${payload.fechaEmision}T00:00:00`)
    : currentOrder.fechaEmision
  const expectedReceptionDate = payload.fechaRecepcion
    ? new Date(`${payload.fechaRecepcion}T00:00:00`)
    : currentOrder.fechaRecepcion ?? null

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

  const targetSupplierId = payload.proveedorId ?? currentOrder.proveedorId

  const [supplier, responsibleUser, products] = await Promise.all([
    prisma.proveedor.findFirst({
      where: {
        id: targetSupplierId,
        deletedAt: null,
        activo: true,
        empresaId: companyId,
      },
    }),
    prisma.usuario.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        activo: true,
        empresaId: companyId,
      },
    }),
    prisma.producto.findMany({
      where: {
        id: {
          in: payload.items.map((item) => item.productoId),
        },
        deletedAt: null,
        estado: 'ACTIVO',
        empresaId: companyId,
      },
      select: {
        id: true,
        nombre: true,
        sku: true,
        compraPresentacionId: true,
        presentacionesEmpaque: {
          where: { deletedAt: null },
          select: {
            esBase: true,
            permiteCompra: true,
            permiteVenta: true,
            precioVenta: true,
            presentacion: {
              select: {
                id: true,
                nombre: true,
              },
            },
          },
        },
        conversionesEmpaque: {
          where: { deletedAt: null },
          select: {
            desdePresentacionId: true,
            haciaPresentacionId: true,
            cantidad: true,
          },
        },
        unidadMedida: {
          select: {
            simbolo: true,
          },
        },
      },
    }),
  ])

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
    const taxRate = Number(item.porcentajeImpuesto ?? 0)
    const product = productMap.get(item.productoId)!

    if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
      throw createHttpError(400, 'La cantidad de cada línea debe ser mayor a 0.')
    }

    if (!Number.isInteger(requestedQuantity)) {
      throw createHttpError(400, 'La cantidad debe ser un entero positivo.')
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

    const purchasePresentationId =
      product.compraPresentacionId ??
      product.presentacionesEmpaque.find((entry) => entry.esBase)?.presentacion.id ??
      ''

    const packagingContext = resolvePackagingOperationContext({
      operation: 'PURCHASE',
      presentationId: purchasePresentationId,
      presentations: product.presentacionesEmpaque ?? [],
      conversions: product.conversionesEmpaque ?? [],
    })

    if (!packagingContext.ok) {
      throw createHttpError(400, packagingContext.error)
    }

    const quantity = convertQuantityToBaseUnits({
      quantity: requestedQuantity,
      factorToBase: packagingContext.factorToBase,
    })
    const unitCost = convertAmountToBaseUnit({
      amount: requestedUnitCost,
      factorToBase: packagingContext.factorToBase,
    })

    if (quantity === null) {
      throw createHttpError(400, 'No fue posible calcular la cantidad en unidad base.')
    }

    if (unitCost === null) {
      throw createHttpError(400, 'No fue posible calcular el costo unitario en unidad base.')
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
      presentation: {
        id: purchasePresentationId,
        name: packagingContext.selectedPresentation.presentacion.nombre,
        quantity: requestedQuantity,
        factor: packagingContext.factorToBase,
      },
    }
  })

  const subtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0)
  const impuestoTotal = lineItems.reduce((sum, item) => sum + item.impuestoTotal, 0)
  const total = lineItems.reduce((sum, item) => sum + item.total, 0)

  const paidAmount = currentOrder.pagos.reduce(
    (sum, payment) => sum + Number(payment.monto),
    0,
  )

  if (total < paidAmount) {
    throw createHttpError(
      400,
      'El nuevo total no puede ser menor al monto ya pagado.',
    )
  }

  const saldoPendiente = total - paidAmount
  const nextEstado = payload.estado ?? currentOrder.estado
  const nextFinanciero =
    saldoPendiente <= 0.005
      ? EstadoCompraFinanciero.PAGADA
      : paidAmount > 0.005
        ? EstadoCompraFinanciero.PAGO_PARCIAL
        : EstadoCompraFinanciero.SIN_PAGAR

  const nextLogistico =
    currentOrder.estadoLogistico === EstadoCompraLogistico.CANCELADA
      ? EstadoCompraLogistico.CANCELADA
      : currentOrder.estadoLogistico === EstadoCompraLogistico.RECEPCION_COMPLETA
        ? EstadoCompraLogistico.RECEPCION_COMPLETA
        : EstadoCompraLogistico.REGISTRADA

  const previousSnapshot = {
    proveedorId: currentOrder.proveedorId,
    fechaEmision: currentOrder.fechaEmision.toISOString().slice(0, 10),
    fechaRecepcion: currentOrder.fechaRecepcion
      ? currentOrder.fechaRecepcion.toISOString().slice(0, 10)
      : null,
    estado: currentOrder.estado,
    observaciones: currentOrder.observaciones ?? null,
    subtotal: Number(currentOrder.subtotal),
    impuestoTotal: Number(currentOrder.impuestoTotal),
    total: Number(currentOrder.total),
    saldoPendiente: Number(currentOrder.saldoPendiente),
    items: currentOrder.detalles.map((det) => ({
      productoId: det.productoId,
      productName: det.producto?.nombre ?? null,
      cantidad: det.cantidad,
      cantidadPresentacion: det.cantidadPresentacion ?? null,
      presentacionId: det.presentacionId,
      presentationName: det.presentacion?.nombre ?? null,
      costoUnitario: Number(det.costoUnitario),
      porcentajeImpuesto: Number(det.porcentajeImpuesto ?? 0),
      subtotal: Number(det.subtotal),
      impuestoTotal: Number(det.impuestoTotal),
      total: Number(det.total),
    })),
  }

  const updatedPurchase = await prisma.$transaction(async (tx) => {
    await tx.detalleCompra.updateMany({
      where: { compraId: currentOrder.id, deletedAt: null },
      data: { deletedAt: new Date(), updatedById: userId },
    })

    return tx.compra.update({
      where: { id: currentOrder.id },
      data: {
        proveedorId: targetSupplierId,
        fechaEmision: emissionDate,
        fechaRecepcion: expectedReceptionDate ?? undefined,
        tipoComprobante: payload.tipoComprobante ?? currentOrder.tipoComprobante ?? undefined,
        serieComprobante:
          toOptionalString(payload.serieComprobante) ?? currentOrder.serieComprobante ?? undefined,
        numeroComprobante:
          toOptionalString(payload.numeroComprobante) ??
          currentOrder.numeroComprobante ??
          undefined,
        estado: nextEstado,
        estadoLogistico: nextLogistico,
        estadoFinanciero: nextFinanciero,
        subtotal: toDecimal(subtotal, 2),
        descuentoTotal: toDecimal(0, 2),
        impuestoTotal: toDecimal(impuestoTotal, 2),
        total: toDecimal(total, 2),
        saldoPendiente: toDecimal(saldoPendiente, 2),
        observaciones:
          toOptionalString(payload.observaciones) ?? currentOrder.observaciones ?? undefined,
        updatedById: userId,
        detalles: {
          create: lineItems.map((item) => ({
            productoId: item.productoId,
            cantidad: item.cantidad,
            presentacionId: item.presentation.id,
            cantidadPresentacion:
              item.presentation.quantity === null || item.presentation.quantity === undefined
                ? undefined
                : Math.trunc(item.presentation.quantity),
            factorPresentacion: Math.trunc(item.presentation.factor),
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
      select: {
        id: true,
        estado: true,
        fechaEmision: true,
        fechaRecepcion: true,
      },
    })
  })

  await prisma.$transaction(async (tx) => {
    const clientIp =
      typeof request === 'object' &&
      request !== null &&
      'ip' in request &&
      typeof (request as { ip?: unknown }).ip === 'string'
        ? (request as { ip: string }).ip
        : null
    const userAgent =
      typeof request === 'object' &&
      request !== null &&
      'headers' in request &&
      typeof (request as { headers?: unknown }).headers === 'object' &&
      (request as { headers: Record<string, unknown> }).headers !== null &&
      'user-agent' in (request as { headers: Record<string, unknown> }).headers &&
      typeof (request as { headers: Record<string, unknown> }).headers['user-agent'] === 'string'
        ? (request as { headers: Record<string, string> }).headers['user-agent']
        : null

    await tx.auditoria.create({
      data: {
        usuarioId: userId,
        tabla: 'compra',
        registroId: updatedPurchase.id,
        accion: AccionAuditoria.UPDATE,
        fechaEvento: new Date(),
        valorAnterior: previousSnapshot as unknown as Prisma.InputJsonValue,
        valorNuevo: {
          proveedorId: targetSupplierId,
          fechaEmision: emissionDate.toISOString().slice(0, 10),
          fechaRecepcion: expectedReceptionDate
            ? expectedReceptionDate.toISOString().slice(0, 10)
            : null,
          estado: nextEstado,
          observaciones: payload.observaciones ?? null,
          subtotal: Number(subtotal.toFixed(2)),
          impuestoTotal: Number(impuestoTotal.toFixed(2)),
          total: Number(total.toFixed(2)),
          saldoPendiente: Number(saldoPendiente.toFixed(2)),
          items: lineItems.map((item) => ({
            productoId: item.productoId,
            productName: item.product.nombre,
            cantidad: item.cantidad,
            cantidadPresentacion: item.presentation.quantity,
            presentacionId: item.presentation.id,
            presentationName: item.presentation.name,
            costoUnitario: item.requestedUnitCost,
            porcentajeImpuesto: item.porcentajeImpuesto,
            subtotal: Number(item.subtotal.toFixed(2)),
            impuestoTotal: Number(item.impuestoTotal.toFixed(2)),
            total: Number(item.total.toFixed(2)),
          })),
        } as unknown as Prisma.InputJsonValue,
        direccionIp: clientIp,
        userAgent,
        createdById: userId,
        updatedById: userId,
      },
    })
  })

  invalidatePurchaseCodeCache()
  const purchaseCodeMap = await buildPurchaseCodeMap()
  const purchaseCode =
    purchaseCodeMap.get(updatedPurchase.id) ??
    `CMP-${updatedPurchase.id.slice(0, 6).toUpperCase()}`

  invalidatePurchaseDashboardOptionsCache(companyId)

  return {
    item: {
      id: updatedPurchase.id,
      code: purchaseCode,
      supplierName: supplier.razonSocial,
      branchName: currentOrder.sucursal?.nombre ?? '',
      buyerName: formatFullName(responsibleUser),
      createdAt: formatDate(updatedPurchase.fechaEmision),
      expectedAt: formatDate(updatedPurchase.fechaRecepcion),
      itemCount: lineItems.length,
      totalAmount: Number(total.toFixed(2)),
      status: updatedPurchase.estado,
    },
    details: lineItems.map((item) => ({
      productId: item.productoId,
      productName: item.product.nombre,
      sku: item.product.sku,
      unitSymbol: item.presentation.name ?? item.product.unidadMedida.simbolo,
      quantity: item.presentation.quantity ?? item.cantidad,
      unitCost:
        item.presentation.quantity === null || item.presentation.quantity === undefined
          ? item.costoUnitario
          : item.requestedUnitCost,
      taxRate: item.porcentajeImpuesto,
      total: Number(item.total.toFixed(2)),
    })),
  }
}

export async function registerPurchasePayment(
  payload: RegisterPurchasePaymentPayload,
  request: FastifyRequest,
) {
  const { userId, branchId } = await getAuthContext(request)
  const amount = Number(payload.monto)
  const paymentDate = payload.fechaPago
    ? new Date(`${payload.fechaPago}T00:00:00`)
    : new Date()
  const requestId =
    typeof request === 'object' &&
    request !== null &&
    'id' in request &&
    typeof (request as { id?: unknown }).id === 'string'
      ? (request as { id: string }).id
      : null
  const isDev = (process.env.NODE_ENV ?? 'development') !== 'production'
  const exposeErrors = isDev || process.env.DEBUG_EXPOSE_ERRORS?.trim().toLowerCase() === 'true'

  function rethrowStepError(step: string, err: unknown): never {
    const info = extractErrorInfo(err)
    reportDebugEvent('purchase.payment.step.error', {
      requestId,
      purchaseId: payload.compraId,
      step,
      error: info,
    })

    if (!exposeErrors) {
      throw err
    }

    const wrapped = createHttpError(
      500,
      `Fallo en ${step}: ${info.message ?? 'Ocurrió un error inesperado.'}`,
    ) as Error & { statusCode: number; stack?: string }
    wrapped.stack = info.stack ?? wrapped.stack
    throw wrapped
  }

  // #region debug-point purchase-payment-advance-500.register-payment.start
  reportDebugEvent('purchase.payment.start', {
    purchaseId: payload.compraId,
    formPaymentId: payload.formaPagoId,
    amount,
    userId,
    branchId,
    paymentDate: paymentDate.toISOString(),
    requestId,
  })
  // #endregion debug-point purchase-payment-advance-500.register-payment.start

  if (!Number.isFinite(amount) || amount <= 0) {
    throw createHttpError(400, 'El monto del pago debe ser mayor a 0.')
  }

  if (Number.isNaN(paymentDate.getTime())) {
    throw createHttpError(400, 'La fecha del pago no es válida.')
  }

  try {
    await ensureDefaultPaymentMethods(prisma, userId)
  } catch (err) {
    rethrowStepError('ensureDefaultPaymentMethods', err)
  }

  const pendingOpening = await prisma.aperturaCaja.findFirst({
    where: {
      deletedAt: null,
      estado: EstadoAperturaCaja.ABIERTA,
      usuarioId: userId,
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

      const openingDateLabel = formatDateInTimeZone(pendingOpening.fechaApertura)
      throw createHttpError(
        409,
        [
          `Caja pendiente de cierre desde el ${openingDateLabel}.`,
          'Cierra la caja del día anterior para continuar registrando pagos.',
        ].join('\n\n'),
      )
    }
  }

  const [purchase, paymentMethod, opening] = await Promise.all([
    prisma.compra.findFirst({
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
    prisma.formaPago.findFirst({
      where: {
        id: payload.formaPagoId,
        deletedAt: null,
        activo: true,
      },
    }),
    prisma.aperturaCaja.findFirst({
      where: {
        deletedAt: null,
        estado: EstadoAperturaCaja.ABIERTA,
        usuarioId: userId,
        caja: {
          deletedAt: null,
          sucursalId: branchId,
        },
      },
      select: {
        id: true,
        montoAperturaEfectivo: true,
      },
    }),
  ])

  reportDebugEvent('purchase.payment.loaded', {
    purchaseId: payload.compraId,
    purchaseFound: Boolean(purchase),
    purchaseStatus: purchase?.estado ?? null,
    purchaseBranchId: purchase?.sucursalId ?? null,
    paymentMethodFound: Boolean(paymentMethod),
    paymentMethodId: paymentMethod?.id ?? null,
    paymentMethodCode: paymentMethod?.codigo ?? null,
    openingFound: Boolean(opening),
    openingId: opening?.id ?? null,
  })

  if (!purchase) {
    throw createHttpError(404, 'La compra seleccionada no está disponible.')
  }

  if (purchase.sucursalId !== branchId) {
    throw createHttpError(403, 'No tienes permisos para registrar pagos en compras de otra sucursal.')
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

  const isCashPayment = paymentMethod.codigo === CodigoFormaPago.EFECTIVO

  let effectiveOpening = opening
  if (isCashPayment && !effectiveOpening) {
    throw createHttpError(
      409,
      [
        'No existe una caja activa para registrar este pago en efectivo.',
        'Abra la Caja de la sesión y luego intente nuevamente.',
      ].join('\n\n'),
    )
  }
  if (!isCashPayment && !effectiveOpening) {
    effectiveOpening =
      (await prisma.aperturaCaja.findFirst({
        where: {
          sucursalId: branchId,
          deletedAt: null,
          estado: EstadoAperturaCaja.ABIERTA,
          cierrePendiente: false,
        },
        orderBy: { fechaApertura: 'desc' },
      })) ?? null
  }

  if (!effectiveOpening) {
    throw createHttpError(
      409,
      [
        'No existe una caja abierta para registrar este pago.',
        'Abra la Caja de la sesión y luego intente nuevamente.',
      ].join('\n\n'),
    )
  }

  reportDebugEvent('purchase.payment.opening', {
    purchaseId: purchase.id,
    openingId: effectiveOpening.id,
    openingCashAmount: decimalToNumber(effectiveOpening.montoAperturaEfectivo),
    isCashPayment,
    paymentMethodCode: paymentMethod.codigo,
  })

  const cashScopeOr = [{ formaPagoId: null }, { formaPago: { codigo: CodigoFormaPago.EFECTIVO } }]
  const movementCashScope = isCashPayment ? { OR: cashScopeOr } : { formaPagoId: paymentMethod.id }

  const [incomeAggregate, expenseAggregate] = await Promise.all([
    prisma.movimientoCaja.aggregate({
      where: {
        deletedAt: null,
        aperturaCajaId: effectiveOpening.id,
        ...movementCashScope,
        tipo: {
          notIn: [TipoMovimientoCaja.APERTURA, TipoMovimientoCaja.CIERRE],
        },
        operacion: OperacionCaja.INGRESO,
      },
      _sum: {
        monto: true,
      },
    }),
    prisma.movimientoCaja.aggregate({
      where: {
        deletedAt: null,
        aperturaCajaId: effectiveOpening.id,
        ...movementCashScope,
        tipo: {
          notIn: [TipoMovimientoCaja.APERTURA, TipoMovimientoCaja.CIERRE],
        },
        operacion: OperacionCaja.EGRESO,
      },
      _sum: {
        monto: true,
      },
    }),
  ])

  const availableCash = Number(
    (
      (isCashPayment ? decimalToNumber(effectiveOpening.montoAperturaEfectivo) : 0) +
      decimalToNumber(incomeAggregate._sum?.monto) -
      decimalToNumber(expenseAggregate._sum?.monto)
    ).toFixed(2),
  )
  const outstandingAmount = decimalToNumber(purchase.saldoPendiente)

  reportDebugEvent('purchase.payment.balances', {
    purchaseId: purchase.id,
    isCashPayment,
    availableCash,
    outstandingAmount,
    amount,
  })

  if (amount - outstandingAmount > 0.0001) {
    throw createHttpError(400, 'El pago supera el saldo pendiente de la compra.')
  }

  if (isCashPayment && availableCash + 0.0001 < amount) {
    const missingCash = Number(Math.max(0, amount - availableCash).toFixed(2))
    throw createHttpError(
      409,
      [
        'La caja activa no cuenta con saldo suficiente para registrar este pago en efectivo.',
        `Saldo disponible en efectivo: S/${availableCash.toFixed(2)}`,
        `Monto requerido: S/${amount.toFixed(2)}`,
        `Faltante: S/${missingCash.toFixed(2)}`,
        'Registra un ingreso en efectivo y luego completa el pago al proveedor.',
      ].join('\n\n'),
    )
  }

  let result: {
    id: string
    purchaseId: string
    supplierName: string
    formPaymentId: string
    formPaymentCode: string
    formPaymentName: string
    amount: number
    paidAt: string | null
    reference: string | null
    observations: string | null
    outstandingAmount: number
  }
  try {
    result = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "public"."compras" WHERE id = ${purchase.id}::uuid FOR UPDATE`,
        ).catch((err) => rethrowStepError('lockPurchase', err))

        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "public"."apertura_caja" WHERE id = ${effectiveOpening.id}::uuid FOR UPDATE`,
        ).catch((err) => rethrowStepError('lockCashOpening', err))

        const currentPurchase = await tx.compra
          .findFirst({
            where: {
              id: purchase.id,
              deletedAt: null,
            },
            select: {
              id: true,
              saldoPendiente: true,
            },
          })
          .catch((err) => rethrowStepError('reloadPurchaseForPayment', err))

        if (!currentPurchase) {
          throw createHttpError(404, 'La compra seleccionada ya no está disponible.')
        }

        const currentOutstandingAmount = decimalToNumber(currentPurchase.saldoPendiente)

        if (amount - currentOutstandingAmount > 0.0001) {
          throw createHttpError(
            409,
            'El saldo pendiente de la compra cambió antes de registrar el pago. Recarga la compra e intenta nuevamente.',
          )
        }

        const payment = await tx.compraPago
          .create({
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
          .catch((err) => rethrowStepError('createPurchasePayment', err))

        const nextOutstandingAmount = Number(
          Math.max(0, currentOutstandingAmount - amount).toFixed(2),
        )
        const nextFinancialStatus =
          nextOutstandingAmount <= 0
            ? EstadoCompraFinanciero.PAGADA
            : EstadoCompraFinanciero.PAGO_PARCIAL

        await tx.compra
          .update({
          where: {
            id: purchase.id,
          },
          data: {
            saldoPendiente: toDecimal(nextOutstandingAmount, 2),
            estadoFinanciero: nextFinancialStatus,
            updatedById: userId,
          },
        })
          .catch((err) => rethrowStepError('updatePurchaseFinancialState', err))

        const cashMovement = await createCashMovementExpense(tx, {
          openingId: effectiveOpening.id,
          paymentMethodId: paymentMethod.id,
          amount,
          paymentId: payment.id,
          supplierName: purchase.proveedor.razonSocial,
          paymentMethodName: paymentMethod.nombre,
          userId,
        }).catch((err) => rethrowStepError('createCashMovementExpense', err))

        await tx.egreso
          .create({
          data: {
            movimientoCajaId: cashMovement.id,
            concepto: 'Pago a proveedor',
            referencia: toOptionalString(payment.id),
            observaciones: toOptionalString(payload.observaciones),
            createdById: userId,
            updatedById: userId,
          },
        })
          .catch((err) => rethrowStepError('createCashExpenseRecord', err))

        await createPurchasePaymentAuditEntry(tx, {
          userId,
          paymentId: payment.id,
          purchaseId: purchase.id,
          amount,
          outstandingAmount: nextOutstandingAmount,
          request,
        }).catch((err) => rethrowStepError('createPurchasePaymentAudit', err))

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
      },
      {
        maxWait: 15_000,
        timeout: 45_000,
        isolationLevel: 'Serializable',
      },
    )

    // #region debug-point purchase-payment-advance-500.register-payment.success
    reportDebugEvent('purchase.payment.success', {
      purchaseId: payload.compraId,
      amount,
      result,
    })
    // #endregion debug-point purchase-payment-advance-500.register-payment.success
  } catch (err) {
    // #region debug-point purchase-payment-advance-500.register-payment.error
    reportDebugEvent('purchase.payment.error', {
      purchaseId: payload.compraId,
      amount,
      error: extractErrorInfo(err),
    })
    // #endregion debug-point purchase-payment-advance-500.register-payment.error
    if (isClosedTransactionError(err)) {
      throw createHttpError(
        500,
        'No fue posible registrar el pago al proveedor. La operación se canceló antes de completarse y no se guardó ningún cambio. Intenta nuevamente.',
      )
    }
    throw err
  }

  return { item: result }
}

async function receivePurchaseItemInTransaction(
  tx: Prisma.TransactionClient,
  prepared: {
    detalleCompraId: string
    numeroLote: string
    manufacturedAt: Date | null
    expiryDate: Date
    receivedUnits: number
    reservedUnits: number
    blockedUnits: number
    costoRecepcion?: number
    almacen?: string
    observaciones?: string
  },
  context: {
    userId: string
    compraIdConstraint?: string
    compraRecepcionId?: string
    recepcionObservaciones?: string
  },
) {
  const detail = await tx.detalleCompra.findFirst({
    where: {
      id: prepared.detalleCompraId,
      deletedAt: null,
    },
    include: {
      compra: {
        select: {
          id: true,
          sucursalId: true,
          proveedorId: true,
          estado: true,
          estadoFinanciero: true,
          total: true,
          saldoPendiente: true,
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

  if (!detail || !detail.compra) {
    throw createHttpError(404, 'La línea de compra seleccionada no está disponible.')
  }

  if (context.compraIdConstraint && detail.compra.id !== context.compraIdConstraint) {
    throw createHttpError(400, 'La recepción pertenece a una orden diferente.')
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

  const outstandingAmount = decimalToNumber(detail.compra.saldoPendiente)
  if (outstandingAmount > 0.0001) {
    throw createHttpError(
      400,
      'No se puede registrar la recepción porque la orden de compra tiene un saldo pendiente de pago.',
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

  const receivedInput = Number(prepared.receivedUnits)
  const reservedInput = Number(prepared.reservedUnits)
  const blockedInput = Number(prepared.blockedUnits)
  const presentationFactor = detail.factorPresentacion ?? detail.factorEmpaque ?? 1
  const receivedUnits = receivedInput * presentationFactor
  const reservedUnits = reservedInput * presentationFactor
  const blockedUnits = blockedInput * presentationFactor
  const availableUnits = receivedUnits - reservedUnits - blockedUnits

  if (!Number.isInteger(receivedInput)) {
    throw createHttpError(400, 'La cantidad recibida debe ser un entero.')
  }
  if (!Number.isInteger(reservedInput) || !Number.isInteger(blockedInput)) {
    throw createHttpError(400, 'El stock reservado y bloqueado debe ser un entero.')
  }
  if (
    !Number.isFinite(presentationFactor) ||
    !Number.isInteger(presentationFactor) ||
    presentationFactor <= 0
  ) {
    throw createHttpError(400, 'El factor de presentación configurado no es válido.')
  }

  if (!Number.isFinite(receivedUnits) || receivedUnits <= 0) {
    throw createHttpError(400, 'La cantidad recibida debe ser mayor a 0.')
  }

  if (reservedUnits < 0 || blockedUnits < 0) {
    throw createHttpError(400, 'El stock reservado y bloqueado no puede ser negativo.')
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
    ensureMovementReason(tx, context.userId, {
      code: 'RECEPCION_COMPRA',
      name: 'Recepción de compra',
      description: 'Ingreso de stock originado por la recepción física de una compra.',
      type: TipoMovimientoInventario.ENTRADA,
    }),
    ensureMovementReason(tx, context.userId, {
      code: 'RECEPCION_COMPRA_RESERVA',
      name: 'Reserva en recepción',
      description: 'Reserva operativa aplicada durante la recepción de una compra.',
      type: TipoMovimientoInventario.RESERVA,
    }),
    ensureMovementReason(tx, context.userId, {
      code: 'RECEPCION_COMPRA_BLOQUEO',
      name: 'Bloqueo en recepción',
      description: 'Bloqueo sanitario u operativo aplicado durante la recepción de una compra.',
      type: TipoMovimientoInventario.AJUSTE,
    }),
  ])

  const inventory = await tx.inventario.upsert({
    where: {
      sucursalId_productoId: {
        sucursalId: detail.compra.sucursalId,
        productoId: detail.productoId,
      },
    },
    update: {
      ubicacion: toOptionalString(prepared.almacen),
      updatedById: context.userId,
    },
    create: {
      sucursalId: detail.compra.sucursalId,
      productoId: detail.productoId,
      ubicacion: toOptionalString(prepared.almacen),
      createdById: context.userId,
      updatedById: context.userId,
    },
  })

  const compraRecepcionId =
    context.compraRecepcionId ??
    (
      await createPurchaseReceptionRecord(
        tx,
        detail.compra.id,
        context.userId,
        context.recepcionObservaciones,
      )
    ).id

  const lot = await tx.lote.create({
    data: {
      sucursalId: detail.compra.sucursalId,
      productoId: detail.productoId,
      detalleCompraId: detail.id,
      compraRecepcionId,
      proveedorId: detail.compra.proveedorId,
      numeroLote: prepared.numeroLote.trim().toUpperCase(),
      fechaFabricacion: prepared.manufacturedAt ?? undefined,
      fechaVencimiento: prepared.expiryDate,
      costoUnitario: prepared.costoRecepcion ?? detail.costoUnitario,
      stockInicial: receivedUnits,
      stockDisponible: availableUnits,
      stockReservado: reservedUnits,
      stockBloqueado: blockedUnits,
      estado: resolveLotStatus({
        expiryDate: prepared.expiryDate,
        availableUnits,
        reservedUnits,
        blockedUnits,
      }),
      observaciones: toOptionalString(prepared.observaciones),
      createdById: context.userId,
      updatedById: context.userId,
    },
  })

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
      referencia: `Recepción compra ${detail.compra.id.slice(0, 8).toUpperCase()} lote ${lot.numeroLote}`,
      observaciones: toOptionalString(prepared.observaciones),
      createdById: context.userId,
      updatedById: context.userId,
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
        observaciones: toOptionalString(prepared.observaciones),
        createdById: context.userId,
        updatedById: context.userId,
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
        observaciones: toOptionalString(prepared.observaciones),
        createdById: context.userId,
        updatedById: context.userId,
      },
    })
  }

  await updatePurchaseReceiptStatus(tx, detail.compra.id, context.userId)

  return {
    purchaseId: detail.compra.id,
    detailId: detail.id,
    lotId: lot.id,
    inventoryId: inventory.id,
  }
}

export async function receivePurchaseItem(
  payload: ReceivePurchaseItemPayload,
  request: FastifyRequest,
) {
  const userId = await getAuthenticatedUserId(request)
  const expiryDate = new Date(`${payload.fechaVencimiento}T00:00:00`)
  const manufacturedAt = payload.fechaFabricacion
    ? new Date(`${payload.fechaFabricacion}T00:00:00`)
    : null

  if (Number.isNaN(expiryDate.getTime())) {
    throw createHttpError(400, 'La fecha de vencimiento no es válida.')
  }

  if (manufacturedAt && Number.isNaN(manufacturedAt.getTime())) {
    throw createHttpError(400, 'La fecha de fabricación no es válida.')
  }

  if (manufacturedAt && manufacturedAt > expiryDate) {
    throw createHttpError(400, 'La fecha de fabricación no puede ser posterior al vencimiento.')
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        return receivePurchaseItemInTransaction(
          tx,
          {
            detalleCompraId: payload.detalleCompraId,
            numeroLote: payload.numeroLote,
            manufacturedAt,
            expiryDate,
            receivedUnits: Number(payload.cantidadRecibida),
            reservedUnits: Number(payload.stockReservado ?? 0),
            blockedUnits: Number(payload.stockBloqueado ?? 0),
            almacen: toOptionalString(payload.almacen),
            observaciones: toOptionalString(payload.observaciones),
          },
          {
            userId,
            recepcionObservaciones: undefined,
          },
        )
      },
      {
        maxWait: 15_000,
        timeout: 45_000,
        isolationLevel: 'Serializable',
      },
    )

    return { item: result }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw createHttpError(
        409,
        'Ya existe un lote con ese número para el producto y sucursal seleccionados.',
      )
    }

    throw error
  }
}

export async function createPurchaseReception(
  payload: CreatePurchaseReceptionPayload,
  request: FastifyRequest,
) {
  const userId = await getAuthenticatedUserId(request)

  if (payload.items.length === 0) {
    throw createHttpError(400, 'Agrega al menos una línea para recepcionar.')
  }

  const purchase = await prisma.compra.findFirst({
    where: {
      id: payload.compraId,
      deletedAt: null,
    },
    select: {
      id: true,
      saldoPendiente: true,
      estado: true,
      estadoFinanciero: true,
      total: true,
    },
  })

  if (!purchase) {
    throw createHttpError(404, 'La orden de compra no está disponible.')
  }

  const outstandingAmount = decimalToNumber(purchase.saldoPendiente)
  if (outstandingAmount > 0.0001) {
    throw createHttpError(
      400,
      'No se puede registrar la recepción porque la orden de compra tiene un saldo pendiente de pago.',
    )
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const reception = await createPurchaseReceptionRecord(
          tx,
          payload.compraId,
          userId,
          payload.observaciones,
        )

        const receivedItems = []
        for (const item of payload.items) {
          const expiryDate = new Date(`${item.fechaVencimiento}T00:00:00`)
          const manufacturedAt = item.fechaFabricacion
            ? new Date(`${item.fechaFabricacion}T00:00:00`)
            : null

          if (Number.isNaN(expiryDate.getTime())) {
            throw createHttpError(400, 'La fecha de vencimiento no es válida.')
          }

          if (manufacturedAt && Number.isNaN(manufacturedAt.getTime())) {
            throw createHttpError(400, 'La fecha de fabricación no es válida.')
          }

          if (manufacturedAt && manufacturedAt > expiryDate) {
            throw createHttpError(400, 'La fecha de fabricación no puede ser posterior al vencimiento.')
          }

          const entry = await receivePurchaseItemInTransaction(
            tx,
            {
              detalleCompraId: item.detalleCompraId,
              numeroLote: item.numeroLote,
              manufacturedAt,
              expiryDate,
              receivedUnits: Number(item.cantidadRecibida),
              reservedUnits: Number(item.stockReservado ?? 0),
              blockedUnits: Number(item.stockBloqueado ?? 0),
              costoRecepcion: Number.isFinite(Number(item.costoUnitarioRecepcion))
                ? Number(item.costoUnitarioRecepcion)
                : undefined,
              almacen: toOptionalString(item.almacen),
              observaciones: toOptionalString(item.observaciones),
            },
            {
              userId,
              compraIdConstraint: payload.compraId,
              compraRecepcionId: reception.id,
            },
          )

          receivedItems.push(entry)
        }

        return {
          purchaseId: payload.compraId,
          receptionId: reception.id,
          receivedCount: receivedItems.length,
        }
      },
      {
        maxWait: 15_000,
        timeout: 45_000,
        isolationLevel: 'Serializable',
      },
    )

    return { item: result }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
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
      const nextFinancialStatus =
        nextOutstandingAmount <= 0
          ? EstadoCompraFinanciero.PAGADA
          : paidAmount > 0
            ? EstadoCompraFinanciero.PAGO_PARCIAL
            : EstadoCompraFinanciero.SIN_PAGAR

      await tx.compra.update({
        where: {
          id: lot.detalleCompra.compraId,
        },
        data: {
          saldoPendiente: toDecimal(nextOutstandingAmount, 2),
          estadoFinanciero: nextFinancialStatus,
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

export async function getPurchaseOrderById(orderId: string, request: FastifyRequest) {
  const { userId, branchId, companyId } = await getAuthContext(request)

  const companyPromise = prisma.empresa.findFirst({
    where: {
      id: companyId,
      deletedAt: null,
    },
    select: {
      razonSocial: true,
      nombreComercial: true,
      numeroDocumento: true,
      direccion: true,
      logoUrl: true,
      monedaBase: true,
      igvPorDefecto: true,
    },
  })

  const rawPurchasePromise = prisma.compra.findFirst({
    where: {
      id: orderId,
      deletedAt: null,
      sucursal: {
        empresaId: companyId,
      },
      OR: [
        { sucursalId: branchId },
        {
          sucursal: {
            usuariosSucursales: {
              some: {
                usuarioId: userId,
                deletedAt: null,
              },
            },
          },
        },
      ],
    },
    include: {
      ...purchaseInclude,
      detalles: {
        ...purchaseInclude.detalles,
        include: {
          ...purchaseInclude.detalles.include,
          producto: {
            select: {
              id: true,
              nombre: true,
              sku: true,
              compraPresentacionId: true,
              presentacionesEmpaque: {
                where: { deletedAt: null },
                select: {
                  esBase: true,
                  permiteCompra: true,
                  permiteVenta: true,
                  precioVenta: true,
                  presentacion: {
                    select: {
                      id: true,
                      nombre: true,
                    },
                  },
                },
              },
              conversionesEmpaque: {
                where: { deletedAt: null },
                select: {
                  desdePresentacionId: true,
                  haciaPresentacionId: true,
                  cantidad: true,
                },
              },
              unidadMedida: {
                select: {
                  simbolo: true,
                },
              },
            },
          },
          presentacion: {
            select: {
              id: true,
              nombre: true,
            },
          },
          lotes: {
            where: { deletedAt: null },
            select: {
              id: true,
              numeroLote: true,
              stockInicial: true,
              createdAt: true,
            },
          },
        },
      },
    },
  })

  const [rawPurchase, company] = await Promise.all([rawPurchasePromise, companyPromise])

  if (!rawPurchase) {
    throw createHttpError(404, 'La orden de compra no existe o no tienes acceso.')
  }

  if (!company) {
    throw createHttpError(404, 'La empresa configurada no está disponible.')
  }

  const orderIds = [rawPurchase.id]
  const [codeMap, returnMetrics, paymentMetrics] = await Promise.all([
    buildPurchaseCodeMap(),
    buildPurchaseReturnMetrics(orderIds),
    buildPurchasePaymentMetrics(orderIds),
  ])

  const order = mapPurchaseOrder(rawPurchase, codeMap, returnMetrics, paymentMetrics)

  const items = rawPurchase.detalles.map((detail) => {
    const factor = detail.factorPresentacion ?? detail.factorEmpaque ?? 1
    const presentationQty = detail.cantidadPresentacion ?? detail.cantidadEmpaque ?? null
    const orderedBaseUnits = decimalToNumber(detail.cantidad)
    const unitCostBase = decimalToNumber(detail.costoUnitario)
    const taxRate = Number(detail.porcentajeImpuesto ?? 0)
    const subtotal = decimalToNumber(detail.subtotal)
    const taxAmount = decimalToNumber(detail.impuestoTotal)
    const total = decimalToNumber(detail.total)

    let unitCostPresentation: number
    if (presentationQty !== null && presentationQty !== undefined && presentationQty > 0) {
      const fromSubtotal = Number((subtotal / presentationQty).toFixed(6))
      const fromBase = Number((unitCostBase * factor).toFixed(6))
      unitCostPresentation =
        Math.abs(fromSubtotal - fromBase) <= 0.0001 ? fromSubtotal : fromBase
    } else {
      unitCostPresentation = unitCostBase
    }

    const quantityPresentation =
      presentationQty !== null && presentationQty !== undefined
        ? Number(presentationQty)
        : orderedBaseUnits

    const receivedBaseUnits = detail.lotes.reduce(
      (sum, lot) => sum + decimalToNumber(lot.stockInicial),
      0,
    )
    const packagingSnapshot = buildPackagingSnapshot({
      presentations: detail.producto.presentacionesEmpaque ?? [],
      conversions: detail.producto.conversionesEmpaque ?? [],
    })

    return {
      detailId: detail.id,
      productId: detail.productoId,
      productName: detail.producto.nombre,
      sku: detail.producto.sku,
      unitSymbol: detail.producto.unidadMedida?.simbolo ?? 'u',
      presentationId: detail.presentacionId,
      presentationName: detail.presentacion?.nombre ?? detail.producto.unidadMedida?.simbolo ?? 'Unidad',
      presentationFactor: factor,
      presentationQuantity: quantityPresentation,
      baseQuantity: orderedBaseUnits,
      unitCostPresentation,
      unitCostBase,
      taxRate,
      subtotal,
      taxAmount,
      total,
      receivedBaseUnits,
      receivedPresentationUnits: factor > 1 ? Number((receivedBaseUnits / factor).toFixed(4)) : receivedBaseUnits,
      packaging: packagingSnapshot,
    }
  })

  return {
    order,
    items,
    company: {
      razonSocial: company.razonSocial,
      nombreComercial: company.nombreComercial,
      numeroDocumento: company.numeroDocumento,
      direccion: company.direccion,
      logoUrl: company.logoUrl,
      monedaBase: company.monedaBase,
      igvPorDefecto: Number(company.igvPorDefecto),
    },
    supplier: {
      id: rawPurchase.proveedor.id,
      razonSocial: rawPurchase.proveedor.razonSocial,
      numeroDocumento: rawPurchase.proveedor.numeroDocumento,
      contactoTelefono: rawPurchase.proveedor.contactoTelefono,
    },
    branch: {
      id: rawPurchase.sucursal.id,
      nombre: rawPurchase.sucursal.nombre,
    },
    buyer: {
      id: rawPurchase.usuarioResponsable.id,
      fullName: formatFullName(rawPurchase.usuarioResponsable),
    },
    fechaEmision: formatDate(rawPurchase.fechaEmision),
    fechaRecepcionEsperada: formatDate(rawPurchase.fechaRecepcion),
    observaciones: rawPurchase.observaciones,
  }
}
