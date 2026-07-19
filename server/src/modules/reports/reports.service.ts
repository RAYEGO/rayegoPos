import { EstadoCompra, EstadoVenta, Prisma } from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { prisma } from '../../lib/prisma.js'

type AuthTokenPayload = {
  sub: string
  typ: 'access' | 'refresh' | 'reset-password'
}

type ReportsFilters = {
  branchId?: string
  from?: string
  to?: string
}

function createHttpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number }
  error.statusCode = statusCode
  return error
}

function decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
  return Number(value ?? 0)
}

function startOfDay(date: Date) {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return normalized
}

function endOfDay(date: Date) {
  const normalized = new Date(date)
  normalized.setHours(23, 59, 59, 999)
  return normalized
}

function parseDateInput(value: string, label: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw createHttpError(400, `La fecha ${label} no es válida.`)
  }
  return parsed
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10)
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

export async function getReportsOverview(filters: ReportsFilters, request: FastifyRequest) {
  await getAuthenticatedUserId(request)

  const branchId = filters.branchId
  const today = startOfDay(new Date())
  const defaultFrom = new Date(today)
  defaultFrom.setDate(defaultFrom.getDate() - 30)

  const from = filters.from ? startOfDay(parseDateInput(filters.from, 'desde')) : defaultFrom
  const to = filters.to ? endOfDay(parseDateInput(filters.to, 'hasta')) : endOfDay(today)

  if (from > to) {
    throw createHttpError(400, 'El rango de fechas es inválido.')
  }

  const branches = await prisma.sucursal.findMany({
    where: { deletedAt: null, activo: true },
    select: { id: true, nombre: true, codigo: true },
    orderBy: { nombre: 'asc' },
  })

  const salesWhere: Prisma.VentaWhereInput = {
    deletedAt: null,
    fechaEmision: { gte: from, lte: to },
    estado: { not: EstadoVenta.ANULADA },
    ...(branchId ? { sucursalId: branchId } : {}),
  }

  const purchaseWhere: Prisma.CompraWhereInput = {
    deletedAt: null,
    fechaEmision: { gte: from, lte: to },
    estado: { not: EstadoCompra.ANULADA },
    ...(branchId ? { sucursalId: branchId } : {}),
  }

  const [salesAggregate, salesCount, recentSales, payments, purchases, expiringLots] =
    await Promise.all([
      prisma.venta.aggregate({
        where: salesWhere,
        _sum: { total: true },
      }),
      prisma.venta.count({ where: salesWhere }),
      prisma.venta.findMany({
        where: salesWhere,
        select: {
          id: true,
          serie: true,
          numero: true,
          tipoComprobante: true,
          fechaEmision: true,
          total: true,
          detalles: { where: { deletedAt: null }, select: { id: true } },
          cliente: { select: { nombreCompleto: true, razonSocial: true } },
        },
        orderBy: { fechaEmision: 'desc' },
        take: 25,
      }),
      prisma.ventaPago.findMany({
        where: {
          deletedAt: null,
          venta: salesWhere,
        },
        select: {
          monto: true,
          formaPago: { select: { codigo: true } },
        },
      }),
      prisma.compra.findMany({
        where: purchaseWhere,
        select: {
          id: true,
          fechaEmision: true,
          total: true,
          saldoPendiente: true,
          estado: true,
          proveedor: { select: { razonSocial: true, numeroDocumento: true } },
        },
        orderBy: { fechaEmision: 'desc' },
        take: 25,
      }),
      prisma.lote.findMany({
        where: {
          deletedAt: null,
          estado: 'ACTIVO',
          ...(branchId ? { sucursalId: branchId } : {}),
          fechaVencimiento: { lte: new Date(to.getTime() + 1000 * 60 * 60 * 24 * 30) },
          stockDisponible: { gt: new Prisma.Decimal(0) },
        },
        select: {
          id: true,
          numeroLote: true,
          fechaVencimiento: true,
          stockDisponible: true,
          sucursal: { select: { nombre: true } },
          producto: {
            select: {
              nombre: true,
              sku: true,
              unidadMedida: { select: { simbolo: true } },
            },
          },
        },
        orderBy: [{ fechaVencimiento: 'asc' }],
        take: 25,
      }),
    ])

  const salesTotal = decimalToNumber(salesAggregate._sum.total)
  const averageTicket = salesCount > 0 ? salesTotal / salesCount : 0

  const salesByDayMap = new Map<string, { date: string; total: number; operations: number }>()
  for (const sale of recentSales) {
    const day = formatDate(sale.fechaEmision)
    const current = salesByDayMap.get(day) ?? { date: day, total: 0, operations: 0 }
    current.total += decimalToNumber(sale.total)
    current.operations += 1
    salesByDayMap.set(day, current)
  }

  const salesByDay = Array.from(salesByDayMap.values()).sort((a, b) => a.date.localeCompare(b.date))

  const salesByPaymentMap = new Map<string, { method: string; amount: number; operations: number }>()
  for (const row of payments) {
    const key = row.formaPago.codigo
    const current = salesByPaymentMap.get(key) ?? { method: key, amount: 0, operations: 0 }
    current.amount += decimalToNumber(row.monto)
    current.operations += 1
    salesByPaymentMap.set(key, current)
  }

  const salesByPaymentMethod = Array.from(salesByPaymentMap.values()).sort((a, b) => b.amount - a.amount)

  const purchasesOutstanding = purchases.reduce(
    (sum, purchase) => sum + decimalToNumber(purchase.saldoPendiente),
    0,
  )

  return {
    period: {
      from: formatDate(from),
      to: formatDate(to),
    },
    summary: {
      salesTotal,
      salesCount,
      averageTicket,
      purchasesCount: purchases.length,
      purchasesOutstanding,
      expiringLotsCount: expiringLots.length,
    },
    sales: {
      recent: recentSales.map((sale) => ({
        id: sale.id,
        document:
          sale.serie && sale.numero ? `${sale.serie}-${sale.numero}` : null,
        receiptType: sale.tipoComprobante,
        issuedAt: sale.fechaEmision.toISOString(),
        customerName: sale.cliente?.nombreCompleto ?? sale.cliente?.razonSocial ?? null,
        itemCount: sale.detalles.length,
        total: decimalToNumber(sale.total),
      })),
      byDay: salesByDay,
      byPaymentMethod: salesByPaymentMethod,
    },
    purchases: purchases.map((purchase) => ({
      id: purchase.id,
      issuedAt: purchase.fechaEmision.toISOString(),
      supplierName: purchase.proveedor.razonSocial,
      supplierDocument: purchase.proveedor.numeroDocumento,
      total: decimalToNumber(purchase.total),
      pending: decimalToNumber(purchase.saldoPendiente),
      status: purchase.estado,
    })),
    inventory: {
      expiringLots: expiringLots.map((lot) => ({
        id: lot.id,
        branchName: lot.sucursal.nombre,
        productName: lot.producto.nombre,
        sku: lot.producto.sku,
        lotCode: lot.numeroLote,
        availableUnits: decimalToNumber(lot.stockDisponible),
        unitSymbol: lot.producto.unidadMedida.simbolo,
        expiryDate: formatDate(lot.fechaVencimiento),
      })),
    },
    options: {
      branches,
    },
  }
}

