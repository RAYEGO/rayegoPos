import {
  EstadoAperturaCaja,
  EstadoVenta,
  OperacionCaja,
  Prisma,
  TipoMovimientoCaja,
} from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { prisma } from '../../lib/prisma.js'

type AuthTokenPayload = {
  sub: string
  typ: 'access' | 'refresh' | 'reset-password'
}

type DashboardFilters = {
  branchId?: string
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

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

function formatFullName(user: { nombres: string; apellidos: string | null }) {
  return `${user.nombres} ${user.apellidos ?? ''}`.trim()
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

export async function getDashboardOverview(filters: DashboardFilters, request: FastifyRequest) {
  await getAuthenticatedUserId(request)

  const branchId = filters.branchId
  const today = startOfDay(new Date())
  const expiringUntil = addDays(today, 30)

  const branches = await prisma.sucursal.findMany({
    where: { deletedAt: null, activo: true },
    select: { id: true, nombre: true, codigo: true },
    orderBy: { nombre: 'asc' },
  })

  const salesWhere: Prisma.VentaWhereInput = {
    deletedAt: null,
    ...(branchId ? { sucursalId: branchId } : {}),
  }

  const lotWhere: Prisma.LoteWhereInput = {
    deletedAt: null,
    estado: 'ACTIVO',
    ...(branchId ? { sucursalId: branchId } : {}),
  }

  const [
    salesTodayAggregate,
    salesTodayCount,
    expiringLots,
    activeCashDrawer,
    recentSales,
    productStockByProduct,
    inventoryThresholds,
    productsInfo,
    recentCashMovements,
  ] = await Promise.all([
    prisma.venta.aggregate({
      where: {
        ...salesWhere,
        fechaEmision: { gte: today },
        estado: { not: EstadoVenta.ANULADA },
      },
      _sum: { total: true },
    }),
    prisma.venta.count({
      where: {
        ...salesWhere,
        fechaEmision: { gte: today },
        estado: { not: EstadoVenta.ANULADA },
      },
    }),
    prisma.lote.findMany({
      where: {
        ...lotWhere,
        fechaVencimiento: { lte: expiringUntil },
        stockDisponible: { gt: 0 },
      },
      select: {
        id: true,
        numeroLote: true,
        fechaVencimiento: true,
        stockDisponible: true,
        sucursal: { select: { id: true, nombre: true } },
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
      take: 10,
    }),
    prisma.aperturaCaja.findFirst({
      where: {
        deletedAt: null,
        estado: EstadoAperturaCaja.ABIERTA,
        ...(branchId ? { caja: { sucursalId: branchId } } : {}),
      },
      select: {
        id: true,
        fechaApertura: true,
        montoAperturaEfectivo: true,
        caja: {
          select: {
            id: true,
            codigo: true,
            nombre: true,
            sucursal: { select: { id: true, nombre: true } },
          },
        },
        usuario: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
          },
        },
        movimientos: {
          where: { deletedAt: null },
          select: {
            tipo: true,
            operacion: true,
            monto: true,
          },
        },
        cierre: {
          select: {
            montoDeclaradoEfectivo: true,
            diferenciaEfectivo: true,
          },
        },
      },
      orderBy: { fechaApertura: 'desc' },
    }),
    prisma.venta.findMany({
      where: salesWhere,
      select: {
        id: true,
        fechaEmision: true,
        estado: true,
        serie: true,
        numero: true,
        tipoComprobante: true,
        total: true,
        cliente: {
          select: {
            id: true,
            nombreCompleto: true,
            razonSocial: true,
          },
        },
      },
      orderBy: { fechaEmision: 'desc' },
      take: 10,
    }),
    prisma.lote.groupBy({
      by: ['productoId'],
      where: lotWhere,
      _sum: {
        stockDisponible: true,
      },
    }),
    prisma.inventario.findMany({
      where: {
        deletedAt: null,
        ...(branchId ? { sucursalId: branchId } : {}),
      },
      select: {
        productoId: true,
        stockMinimo: true,
      },
    }),
    prisma.producto.findMany({
      where: {
        deletedAt: null,
        estado: 'ACTIVO',
      },
      select: {
        id: true,
        nombre: true,
        sku: true,
        unidadMedida: { select: { simbolo: true } },
      },
    }),
    prisma.movimientoCaja.findMany({
      where: {
        deletedAt: null,
        ...(branchId ? { aperturaCaja: { caja: { sucursalId: branchId } } } : {}),
      },
      select: {
        id: true,
        fechaMovimiento: true,
        tipo: true,
        operacion: true,
        monto: true,
        referencia: true,
        formaPago: { select: { codigo: true } },
        createdBy: { select: { nombres: true, apellidos: true } },
      },
      orderBy: { fechaMovimiento: 'desc' },
      take: 15,
    }),
  ])

  const salesTodayTotal = decimalToNumber(salesTodayAggregate._sum.total)
  const averageTicket = salesTodayCount > 0 ? salesTodayTotal / salesTodayCount : 0

  const inventoryMinMap = new Map<string, number>()
  for (const item of inventoryThresholds) {
    if (item.stockMinimo !== null && item.stockMinimo !== undefined) {
      inventoryMinMap.set(item.productoId, decimalToNumber(item.stockMinimo))
    }
  }

  const productInfoMap = new Map(productsInfo.map((product) => [product.id, product]))

  const lowStockRows = productStockByProduct
    .map((row) => {
      const product = productInfoMap.get(row.productoId)
      if (!product) return null
      const stockUnits = decimalToNumber(row._sum.stockDisponible)
      const threshold = inventoryMinMap.get(row.productoId) ?? 20

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
    .filter((row) => row.stockUnits <= row.threshold)
    .sort((a, b) => a.stockUnits - b.stockUnits)

  const cashDrawer = activeCashDrawer
    ? (() => {
        const openingAmount = decimalToNumber(activeCashDrawer.montoAperturaEfectivo)
        let expectedAmount = openingAmount
        for (const movement of activeCashDrawer.movimientos) {
          if (movement.tipo === TipoMovimientoCaja.APERTURA) continue
          if (movement.tipo === TipoMovimientoCaja.CIERRE) continue
          if (movement.operacion === OperacionCaja.INGRESO) {
            expectedAmount += decimalToNumber(movement.monto)
          } else {
            expectedAmount -= decimalToNumber(movement.monto)
          }
        }

        const countedAmount = activeCashDrawer.cierre
          ? decimalToNumber(activeCashDrawer.cierre.montoDeclaradoEfectivo)
          : expectedAmount
        const differenceAmount = activeCashDrawer.cierre
          ? decimalToNumber(activeCashDrawer.cierre.diferenciaEfectivo)
          : 0

        return {
          id: activeCashDrawer.id,
          openedAt: activeCashDrawer.fechaApertura.toISOString(),
          cashierName: `${activeCashDrawer.usuario.nombres} ${activeCashDrawer.usuario.apellidos ?? ''}`.trim(),
          branchName: activeCashDrawer.caja.sucursal.nombre,
          openingAmount,
          expectedAmount,
          countedAmount,
          differenceAmount,
        }
      })()
    : null

  const lastCashCount = activeCashDrawer
    ? await prisma.arqueoCaja.findFirst({
        where: {
          deletedAt: null,
          aperturaCajaId: activeCashDrawer.id,
        },
        select: {
          fechaArqueo: true,
          montoSistemaEfectivo: true,
          montoDeclaradoEfectivo: true,
          diferenciaEfectivo: true,
        },
        orderBy: { fechaArqueo: 'desc' },
      })
    : null

  return {
    sales: {
      todayTotal: salesTodayTotal,
      todayCount: salesTodayCount,
      averageTicket,
    },
    cash: {
      activeDrawer: cashDrawer
        ? {
            ...cashDrawer,
            lastCashCount: lastCashCount
              ? {
                  createdAt: lastCashCount.fechaArqueo.toISOString(),
                  expectedCashAmount: decimalToNumber(lastCashCount.montoSistemaEfectivo),
                  countedCashAmount: decimalToNumber(lastCashCount.montoDeclaradoEfectivo),
                  differenceCashAmount: decimalToNumber(lastCashCount.diferenciaEfectivo),
                }
              : null,
          }
        : null,
    },
    alerts: {
      expiringLotsCount: expiringLots.length,
      lowStockProductsCount: lowStockRows.length,
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
      lowStockProducts: lowStockRows.slice(0, 10),
    },
    activity: {
      recentSales: recentSales.map((sale) => ({
        id: sale.id,
        issuedAt: sale.fechaEmision.toISOString(),
        status: sale.estado,
        document: sale.serie && sale.numero ? `${sale.serie}-${sale.numero}` : null,
        receiptType: sale.tipoComprobante,
        customerName: sale.cliente?.nombreCompleto ?? sale.cliente?.razonSocial ?? null,
        total: decimalToNumber(sale.total),
      })),
      recentCashMovements: recentCashMovements.map((movement) => ({
        id: movement.id,
        createdAt: movement.fechaMovimiento.toISOString(),
        type: movement.tipo,
        operation: movement.operacion,
        amount: decimalToNumber(movement.monto),
        reference: movement.referencia ?? null,
        paymentMethod: movement.formaPago?.codigo ?? null,
        actorName: movement.createdBy ? formatFullName(movement.createdBy) : 'Sistema',
      })),
    },
    options: {
      branches,
    },
  }
}
