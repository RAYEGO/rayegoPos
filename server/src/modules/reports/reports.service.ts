import { EstadoCompra, EstadoVenta, OperacionCaja, Prisma } from '@prisma/client'
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

async function getReportContext(filters: ReportsFilters) {
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

  return { branchId, from, to, branches }
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
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

  const { branchId, from, to, branches } = await getReportContext(filters)

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

export async function getSalesReport(filters: ReportsFilters, request: FastifyRequest) {
  await getAuthenticatedUserId(request)
  const { branchId, from, to, branches } = await getReportContext(filters)

  const salesWhere: Prisma.VentaWhereInput = {
    deletedAt: null,
    fechaEmision: { gte: from, lte: to },
    estado: { not: EstadoVenta.ANULADA },
    ...(branchId ? { sucursalId: branchId } : {}),
  }

  const [salesAggregate, salesCount, salesRows, recentSales, payments] = await Promise.all([
    prisma.venta.aggregate({ where: salesWhere, _sum: { total: true } }),
    prisma.venta.count({ where: salesWhere }),
    prisma.venta.findMany({
      where: salesWhere,
      select: { fechaEmision: true, total: true },
      orderBy: { fechaEmision: 'asc' },
      take: 5000,
    }),
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
      take: 30,
    }),
    prisma.ventaPago.findMany({
      where: { deletedAt: null, venta: salesWhere },
      select: { monto: true, formaPago: { select: { codigo: true } } },
    }),
  ])

  const salesTotal = decimalToNumber(salesAggregate._sum.total)
  const averageTicket = salesCount > 0 ? salesTotal / salesCount : 0

  const byDayMap = new Map<string, { date: string; total: number; operations: number }>()
  for (const row of salesRows) {
    const day = formatDate(row.fechaEmision)
    const current = byDayMap.get(day) ?? { date: day, total: 0, operations: 0 }
    current.total += decimalToNumber(row.total)
    current.operations += 1
    byDayMap.set(day, current)
  }
  const byDay = Array.from(byDayMap.values()).sort((a, b) => a.date.localeCompare(b.date))

  const byPaymentMap = new Map<string, { method: string; amount: number; operations: number }>()
  for (const row of payments) {
    const key = row.formaPago.codigo
    const current = byPaymentMap.get(key) ?? { method: key, amount: 0, operations: 0 }
    current.amount += decimalToNumber(row.monto)
    current.operations += 1
    byPaymentMap.set(key, current)
  }
  const byPaymentMethod = Array.from(byPaymentMap.values()).sort((a, b) => b.amount - a.amount)

  return {
    period: { from: formatDate(from), to: formatDate(to) },
    summary: {
      salesTotal,
      salesCount,
      averageTicket,
    },
    charts: {
      byDay,
      byPaymentMethod,
    },
    recent: recentSales.map((sale) => ({
      id: sale.id,
      document: sale.serie && sale.numero ? `${sale.serie}-${sale.numero}` : null,
      receiptType: sale.tipoComprobante,
      issuedAt: sale.fechaEmision.toISOString(),
      customerName: sale.cliente?.nombreCompleto ?? sale.cliente?.razonSocial ?? null,
      itemCount: sale.detalles.length,
      total: decimalToNumber(sale.total),
    })),
    options: { branches },
  }
}

export async function getPurchasesReport(filters: ReportsFilters, request: FastifyRequest) {
  await getAuthenticatedUserId(request)
  const { branchId, from, to, branches } = await getReportContext(filters)

  const purchaseWhere: Prisma.CompraWhereInput = {
    deletedAt: null,
    fechaEmision: { gte: from, lte: to },
    estado: { not: EstadoCompra.ANULADA },
    ...(branchId ? { sucursalId: branchId } : {}),
  }

  const [purchaseAggregate, purchaseCount, purchases] = await Promise.all([
    prisma.compra.aggregate({ where: purchaseWhere, _sum: { total: true, saldoPendiente: true } }),
    prisma.compra.count({ where: purchaseWhere }),
    prisma.compra.findMany({
      where: purchaseWhere,
      select: {
        id: true,
        fechaEmision: true,
        estado: true,
        total: true,
        saldoPendiente: true,
        proveedor: { select: { razonSocial: true, numeroDocumento: true } },
      },
      orderBy: { fechaEmision: 'desc' },
      take: 50,
    }),
  ])

  const total = decimalToNumber(purchaseAggregate._sum.total)
  const outstanding = decimalToNumber(purchaseAggregate._sum.saldoPendiente)

  return {
    period: { from: formatDate(from), to: formatDate(to) },
    summary: {
      purchasesTotal: total,
      purchasesCount: purchaseCount,
      purchasesOutstanding: outstanding,
    },
    rows: purchases.map((purchase) => ({
      id: purchase.id,
      issuedAt: purchase.fechaEmision.toISOString(),
      supplierName: purchase.proveedor.razonSocial,
      supplierDocument: purchase.proveedor.numeroDocumento,
      total: decimalToNumber(purchase.total),
      pending: decimalToNumber(purchase.saldoPendiente),
      status: purchase.estado,
    })),
    options: { branches },
  }
}

export async function getInventoryReport(filters: ReportsFilters, request: FastifyRequest) {
  await getAuthenticatedUserId(request)
  const { branchId, to, branches } = await getReportContext(filters)
  const expiringUntil = new Date(to.getTime() + 1000 * 60 * 60 * 24 * 30)

  const lotWhere: Prisma.LoteWhereInput = {
    deletedAt: null,
    estado: 'ACTIVO',
    ...(branchId ? { sucursalId: branchId } : {}),
  }

  const [expiringLots, productStockByProduct, inventoryThresholds, productsInfo] =
    await Promise.all([
      prisma.lote.findMany({
        where: {
          ...lotWhere,
          fechaVencimiento: { lte: expiringUntil },
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
              id: true,
              nombre: true,
              sku: true,
              unidadMedida: { select: { simbolo: true } },
            },
          },
        },
        orderBy: [{ fechaVencimiento: 'asc' }],
        take: 30,
      }),
      prisma.lote.groupBy({
        by: ['productoId'],
        where: lotWhere,
        _sum: { stockDisponible: true },
      }),
      prisma.inventario.findMany({
        where: {
          deletedAt: null,
          ...(branchId ? { sucursalId: branchId } : {}),
        },
        select: { productoId: true, stockMinimo: true },
      }),
      prisma.producto.findMany({
        where: { deletedAt: null, estado: 'ACTIVO' },
        select: {
          id: true,
          nombre: true,
          sku: true,
          unidadMedida: { select: { simbolo: true } },
        },
      }),
    ])

  const inventoryMinMap = new Map<string, number>()
  for (const item of inventoryThresholds) {
    if (item.stockMinimo !== null && item.stockMinimo !== undefined) {
      inventoryMinMap.set(item.productoId, decimalToNumber(item.stockMinimo))
    }
  }
  const productInfoMap = new Map(productsInfo.map((product) => [product.id, product]))

  const lowStockProducts = productStockByProduct
    .map((row) => {
      const product = productInfoMap.get(row.productoId)
      if (!product) return null
      const stockUnits = decimalToNumber(row._sum.stockDisponible)
      const threshold = inventoryMinMap.get(row.productoId) ?? 20
      if (stockUnits > threshold) return null

      return {
        productId: product.id,
        sku: product.sku,
        name: product.nombre,
        unitSymbol: product.unidadMedida.simbolo,
        stockUnits,
        threshold,
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => a.stockUnits - b.stockUnits)
    .slice(0, 30)

  return {
    horizon: {
      until: formatDate(expiringUntil),
      days: 30,
    },
    summary: {
      expiringLotsCount: expiringLots.length,
      lowStockProductsCount: lowStockProducts.length,
    },
    rows: {
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
      lowStockProducts,
    },
    options: { branches },
  }
}

export async function getCashierReport(filters: ReportsFilters, request: FastifyRequest) {
  await getAuthenticatedUserId(request)
  const { branchId, from, to, branches } = await getReportContext(filters)

  const movements = await prisma.movimientoCaja.findMany({
    where: {
      deletedAt: null,
      fechaMovimiento: { gte: from, lte: to },
      ...(branchId ? { aperturaCaja: { caja: { sucursalId: branchId } } } : {}),
    },
    select: {
      operacion: true,
      monto: true,
      formaPago: { select: { codigo: true } },
    },
  })

  let inflows = 0
  let outflows = 0
  const byMethodMap = new Map<string, { method: string; inflows: number; outflows: number }>()

  for (const movement of movements) {
    const method = movement.formaPago?.codigo ?? 'EFECTIVO'
    const amount = decimalToNumber(movement.monto)
    const current = byMethodMap.get(method) ?? { method, inflows: 0, outflows: 0 }
    if (movement.operacion === OperacionCaja.INGRESO) {
      inflows += amount
      current.inflows += amount
    } else {
      outflows += amount
      current.outflows += amount
    }
    byMethodMap.set(method, current)
  }

  const byPaymentMethod = Array.from(byMethodMap.values())
    .map((row) => ({
      method: row.method,
      inflows: roundMoney(row.inflows),
      outflows: roundMoney(row.outflows),
      net: roundMoney(row.inflows - row.outflows),
    }))
    .sort((a, b) => b.net - a.net)

  const openings = await prisma.aperturaCaja.findMany({
    where: {
      deletedAt: null,
      fechaApertura: { gte: from, lte: to },
      ...(branchId ? { caja: { sucursalId: branchId } } : {}),
    },
    select: {
      id: true,
      fechaApertura: true,
      estado: true,
      montoAperturaEfectivo: true,
      caja: { select: { codigo: true, sucursal: { select: { nombre: true } } } },
      usuario: { select: { nombres: true, apellidos: true } },
      cierre: { select: { montoDeclaradoEfectivo: true, diferenciaEfectivo: true } },
    },
    orderBy: { fechaApertura: 'desc' },
    take: 30,
  })

  const cashCounts = await prisma.arqueoCaja.findMany({
    where: {
      deletedAt: null,
      fechaArqueo: { gte: from, lte: to },
      ...(branchId ? { aperturaCaja: { caja: { sucursalId: branchId } } } : {}),
    },
    select: {
      id: true,
      fechaArqueo: true,
      montoSistemaEfectivo: true,
      montoDeclaradoEfectivo: true,
      diferenciaEfectivo: true,
      observaciones: true,
      aperturaCaja: {
        select: {
          id: true,
          caja: {
            select: {
              codigo: true,
              sucursal: { select: { nombre: true } },
            },
          },
          usuario: { select: { nombres: true, apellidos: true } },
        },
      },
      createdBy: { select: { nombres: true, apellidos: true } },
    },
    orderBy: { fechaArqueo: 'desc' },
    take: 30,
  })

  return {
    period: { from: formatDate(from), to: formatDate(to) },
    summary: {
      inflows: roundMoney(inflows),
      outflows: roundMoney(outflows),
      net: roundMoney(inflows - outflows),
      openingsCount: openings.length,
      cashCountsCount: cashCounts.length,
    },
    rows: {
      byPaymentMethod,
      openings: openings.map((opening) => ({
        id: opening.id,
        openedAt: opening.fechaApertura.toISOString(),
        status: opening.estado,
        cashDrawerCode: opening.caja.codigo,
        branchName: opening.caja.sucursal.nombre,
        cashierName: `${opening.usuario.nombres} ${opening.usuario.apellidos ?? ''}`.trim(),
        openingCash: decimalToNumber(opening.montoAperturaEfectivo),
        countedCash: opening.cierre ? decimalToNumber(opening.cierre.montoDeclaradoEfectivo) : null,
        differenceCash: opening.cierre ? decimalToNumber(opening.cierre.diferenciaEfectivo) : null,
      })),
      cashCounts: cashCounts.map((row) => ({
        id: row.id,
        openingId: row.aperturaCaja.id,
        createdAt: row.fechaArqueo.toISOString(),
        branchName: row.aperturaCaja.caja.sucursal.nombre,
        cashDrawerCode: row.aperturaCaja.caja.codigo,
        cashierName: `${row.aperturaCaja.usuario.nombres} ${row.aperturaCaja.usuario.apellidos ?? ''}`.trim(),
        actorName: row.createdBy ? `${row.createdBy.nombres} ${row.createdBy.apellidos ?? ''}`.trim() : 'Sistema',
        expectedCashAmount: decimalToNumber(row.montoSistemaEfectivo),
        countedCashAmount: decimalToNumber(row.montoDeclaradoEfectivo),
        differenceCashAmount: decimalToNumber(row.diferenciaEfectivo),
        observations: row.observaciones ?? null,
      })),
    },
    options: { branches },
  }
}

export async function getCustomersReport(filters: ReportsFilters, request: FastifyRequest) {
  await getAuthenticatedUserId(request)
  const { branches } = await getReportContext(filters)

  return {
    summary: {
      enabled: false,
    },
    rows: [],
    options: { branches },
  }
}

export async function getProductsReport(filters: ReportsFilters, request: FastifyRequest) {
  await getAuthenticatedUserId(request)
  const { branches } = await getReportContext(filters)

  return {
    summary: {
      enabled: false,
    },
    rows: [],
    options: { branches },
  }
}

export async function getUtilitiesReport(filters: ReportsFilters, request: FastifyRequest) {
  await getAuthenticatedUserId(request)
  const { branches } = await getReportContext(filters)

  return {
    summary: {
      enabled: false,
    },
    rows: [],
    options: { branches },
  }
}
