import {
  CodigoFormaPago,
  EstadoAperturaCaja,
  EstadoVenta,
  OperacionCaja,
  Prisma,
  TipoMovimientoCaja,
} from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { prisma } from '../../lib/prisma.js'

const cashDrawerInclude = {
  caja: {
    select: {
      id: true,
      codigo: true,
      nombre: true,
      sucursal: {
        select: {
          id: true,
          nombre: true,
        },
      },
    },
  },
  usuario: {
    select: {
      id: true,
      nombres: true,
      apellidos: true,
    },
  },
  cierre: true,
} satisfies Prisma.AperturaCajaInclude

type AuthTokenPayload = {
  sub: string
  typ: 'access' | 'refresh' | 'reset-password'
}

type CashierDashboardFilters = {
  branchId?: string
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

function formatDateTime(value: Date | null | undefined) {
  return value ? value.toISOString() : null
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

async function getDefaultCashDrawerForBranch(branchId: string) {
  return prisma.caja.findFirst({
    where: {
      sucursalId: branchId,
      deletedAt: null,
      estado: 'ACTIVA',
    },
    orderBy: {
      codigo: 'asc',
    },
  })
}

export async function getCashierDashboard(filters: CashierDashboardFilters) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get options (branches, payment methods, etc.)
  const branches = await prisma.sucursal.findMany({
    where: { deletedAt: null, estado: 'ACTIVA' },
    select: { id: true, nombre: true, codigo: true },
    orderBy: { nombre: 'asc' },
  })

  // Get all cash drawers (aperturas)
  const cashDrawers = await prisma.aperturaCaja.findMany({
    where: {
      deletedAt: null,
      ...(filters.branchId ? { caja: { sucursalId: filters.branchId } } : {}),
    },
    include: cashDrawerInclude,
    orderBy: {
      fechaApertura: 'desc',
    },
  })

  // Get cash movements
  const cashMovements = await prisma.movimientoCaja.findMany({
    where: {
      deletedAt: null,
      ...(filters.branchId
        ? { aperturaCaja: { caja: { sucursalId: filters.branchId } } }
        : {}),
    },
    include: {
      aperturaCaja: {
        include: {
          usuario: true,
        },
      },
      formaPago: true,
      ventaPago: {
        include: {
          venta: true,
        },
      },
      createdBy: {
        select: {
          nombres: true,
          apellidos: true,
        },
      },
    },
    orderBy: {
      fechaMovimiento: 'desc',
    },
  })

  // Get recent sales for cash calculation
  const recentSales = await prisma.venta.findMany({
    where: {
      deletedAt: null,
      fechaEmision: {
        gte: today,
      },
      ...(filters.branchId ? { sucursalId: filters.branchId } : {}),
    },
    include: {
      pagos: {
        where: {
          deletedAt: null,
        },
        include: {
          formaPago: true,
        },
      },
    },
    orderBy: {
      fechaEmision: 'desc',
    },
    take: 50,
  })

  // Calculate payment summary
  const paymentSummaryMap = new Map<
    string,
    {
      method: CodigoFormaPago
      salesAmount: number
      collectedAmount: number
      operations: number
    }
  >()

  // Initialize with all payment methods
  const allPaymentMethods = await prisma.formaPago.findMany({
    where: {
      deletedAt: null,
      activo: true,
    },
  })

  for (const method of allPaymentMethods) {
    paymentSummaryMap.set(method.codigo, {
      method: method.codigo,
      salesAmount: 0,
      collectedAmount: 0,
      operations: 0,
    })
  }

  // Calculate from sales
  for (const sale of recentSales) {
    for (const payment of sale.pagos) {
      const summary = paymentSummaryMap.get(payment.formaPago.codigo)
      if (summary) {
        summary.salesAmount += decimalToNumber(payment.monto)
        summary.collectedAmount += decimalToNumber(payment.monto)
        summary.operations += 1
      }
    }
  }

  const cashPaymentSummary = Array.from(paymentSummaryMap.values())

  // Map cash drawers to frontend format
  const mappedCashDrawers = cashDrawers.map((drawer) => {
    const status =
      drawer.estado === 'ABIERTA'
        ? ('ABIERTA' as const)
        : drawer.estado === 'CERRADA'
          ? ('CERRADA' as const)
          : ('EN_CIERRE' as const)

    // Calculate expected amount
    const openingAmount = decimalToNumber(drawer.montoAperturaEfectivo)
    const movementsForDrawer = cashMovements.filter(
      (m) => m.aperturaCajaId === drawer.id,
    )
    let expectedAmount = openingAmount
    for (const movement of movementsForDrawer) {
      if (movement.operacion === 'INGRESO') {
        expectedAmount += decimalToNumber(movement.monto)
      } else {
        expectedAmount -= decimalToNumber(movement.monto)
      }
    }

    const countedAmount = drawer.cierre
      ? decimalToNumber(drawer.cierre.montoDeclaradoEfectivo)
      : expectedAmount
    const differenceAmount = drawer.cierre
      ? decimalToNumber(drawer.cierre.diferenciaEfectivo)
      : 0

    return {
      id: drawer.id,
      code: `${drawer.caja.codigo}-${drawer.fechaApertura
        .toISOString()
        .slice(0, 10)}-A`,
      branchName: drawer.caja.sucursal.nombre,
      cashierName: formatFullName(drawer.usuario),
      openedAt: formatDateTime(drawer.fechaApertura),
      openingAmount,
      expectedAmount,
      countedAmount,
      differenceAmount,
      status,
    }
  })

  // Map cash movements to frontend format
  const mappedCashMovements = cashMovements.map((movement) => {
    let type: 'VENTA' | 'INGRESO_MANUAL' | 'EGRESO' | 'RETIRO' | 'CUADRE'
    switch (movement.tipo) {
      case TipoMovimientoCaja.VENTA:
        type = 'VENTA'
        break
      case TipoMovimientoCaja.INGRESO:
        type = 'INGRESO_MANUAL'
        break
      case TipoMovimientoCaja.EGRESO:
        type = 'EGRESO'
        break
      case TipoMovimientoCaja.CIERRE:
      case TipoMovimientoCaja.AJUSTE:
        type = 'CUADRE'
        break
      default:
        type = 'EGRESO'
    }

    let description = movement.observaciones || 'Movimiento de caja'
    if (movement.ventaPago) {
      description = 'Cobro de venta mostrador'
    }

    return {
      id: movement.id,
      createdAt: formatDateTime(movement.fechaMovimiento),
      type,
      description,
      reference: movement.referencia || '',
      paymentMethod: movement.formaPago
        ? (movement.formaPago.codigo as any)
        : 'INTERNO',
      amount:
        movement.operacion === OperacionCaja.INGRESO
          ? decimalToNumber(movement.monto)
          : -decimalToNumber(movement.monto),
      actorName: movement.createdBy
        ? formatFullName(movement.createdBy)
        : 'Sistema',
    }
  })

  // Calculate totals for dashboard
  const totalSales = recentSales
    .filter((sale) => sale.estado !== EstadoVenta.ANULADA)
    .reduce((sum, sale) => sum + decimalToNumber(sale.total), 0)

  const totalInternalMovements = cashMovements
    .filter((m) => !m.formaPago && m.tipo !== TipoMovimientoCaja.VENTA)
    .reduce(
      (sum, m) =>
        sum +
        (m.operacion === OperacionCaja.INGRESO
          ? decimalToNumber(m.monto)
          : -decimalToNumber(m.monto)),
      0,
    )

  const pendingCollections = recentSales
    .filter((sale) => sale.estado === EstadoVenta.EMITIDA)
    .reduce((sum, sale) => sum + decimalToNumber(sale.saldoPendiente), 0)

  return {
    cashDrawers: mappedCashDrawers,
    cashMovements: mappedCashMovements,
    cashPaymentSummary,
    dashboardTotals: {
      totalSales,
      totalInternalMovements,
      pendingCollections,
    },
    options: {
      branches,
    },
  }
}

export async function openCashDrawer(
  request: FastifyRequest,
  data: {
    branchId: string
    openingAmount: number
    observations?: string
  },
) {
  const userId = await getAuthenticatedUserId(request)

  // Get or create a cash drawer for the branch
  let cashDrawer = await getDefaultCashDrawerForBranch(data.branchId)

  if (!cashDrawer) {
    // Create a default cash drawer if none exists
    cashDrawer = await prisma.caja.create({
      data: {
        sucursalId: data.branchId,
        codigo: 'CAJA-001',
        nombre: 'Caja Principal',
        createdById: userId,
        updatedById: userId,
      },
    })
  }

  // Check if there's already an open drawer
  const existingOpenDrawer = await prisma.aperturaCaja.findFirst({
    where: {
      cajaId: cashDrawer.id,
      estado: EstadoAperturaCaja.ABIERTA,
      deletedAt: null,
    },
  })

  if (existingOpenDrawer) {
    throw createHttpError(400, 'Ya existe una caja abierta para esta sucursal.')
  }

  // Create the opening
  const opening = await prisma.aperturaCaja.create({
    data: {
      cajaId: cashDrawer.id,
      usuarioId: userId,
      montoAperturaEfectivo: toDecimal(data.openingAmount, 2),
      observaciones: toOptionalString(data.observations),
      createdById: userId,
      updatedById: userId,
    },
    include: cashDrawerInclude,
  })

  // Create the opening movement
  await prisma.movimientoCaja.create({
    data: {
      aperturaCajaId: opening.id,
      tipo: TipoMovimientoCaja.APERTURA,
      operacion: OperacionCaja.INGRESO,
      monto: toDecimal(data.openingAmount, 2),
      observaciones: 'Apertura de caja',
      createdById: userId,
      updatedById: userId,
    },
  })

  return {
    success: true,
    openingId: opening.id,
  }
}

export async function closeCashDrawer(
  request: FastifyRequest,
  data: {
    openingId: string
    countedAmount: number
    observations?: string
  },
) {
  const userId = await getAuthenticatedUserId(request)

  // Get the opening
  const opening = await prisma.aperturaCaja.findFirst({
    where: {
      id: data.openingId,
      deletedAt: null,
    },
    include: {
      movimientos: true,
    },
  })

  if (!opening) {
    throw createHttpError(404, 'Apertura de caja no encontrada.')
  }

  if (opening.estado !== EstadoAperturaCaja.ABIERTA) {
    throw createHttpError(400, 'La caja ya está cerrada.')
  }

  // Calculate expected amount
  const openingAmount = decimalToNumber(opening.montoAperturaEfectivo)
  let expectedAmount = openingAmount
  for (const movement of opening.movimientos) {
    if (movement.deletedAt) continue
    if (movement.operacion === OperacionCaja.INGRESO) {
      expectedAmount += decimalToNumber(movement.monto)
    } else {
      expectedAmount -= decimalToNumber(movement.monto)
    }
  }

  const differenceAmount = data.countedAmount - expectedAmount

  // Create the closing
  const closing = await prisma.cierreCaja.create({
    data: {
      aperturaCajaId: opening.id,
      usuarioId: userId,
      montoSistemaEfectivo: toDecimal(expectedAmount, 2),
      montoDeclaradoEfectivo: toDecimal(data.countedAmount, 2),
      diferenciaEfectivo: toDecimal(differenceAmount, 2),
      observaciones: toOptionalString(data.observations),
      createdById: userId,
      updatedById: userId,
    },
  })

  // Update the opening status
  await prisma.aperturaCaja.update({
    where: { id: opening.id },
    data: {
      estado: EstadoAperturaCaja.CERRADA,
      updatedById: userId,
    },
  })

  // Create the closing movement
  await prisma.movimientoCaja.create({
    data: {
      aperturaCajaId: opening.id,
      tipo: TipoMovimientoCaja.CIERRE,
      operacion: OperacionCaja.EGRESO,
      monto: toDecimal(data.countedAmount, 2),
      observaciones: 'Cierre de caja',
      createdById: userId,
      updatedById: userId,
    },
  })

  return {
    success: true,
    closingId: closing.id,
  }
}

export async function createCashMovement(
  request: FastifyRequest,
  data: {
    openingId: string
    type: 'INGRESO' | 'EGRESO'
    amount: number
    concept: string
    reference?: string
    observations?: string
  },
) {
  const userId = await getAuthenticatedUserId(request)

  // Get the opening
  const opening = await prisma.aperturaCaja.findFirst({
    where: {
      id: data.openingId,
      deletedAt: null,
    },
  })

  if (!opening) {
    throw createHttpError(404, 'Apertura de caja no encontrada.')
  }

  if (opening.estado !== EstadoAperturaCaja.ABIERTA) {
    throw createHttpError(400, 'La caja no está abierta.')
  }

  // Create the movement
  const movement = await prisma.movimientoCaja.create({
    data: {
      aperturaCajaId: opening.id,
      tipo:
        data.type === 'INGRESO'
          ? TipoMovimientoCaja.INGRESO
          : TipoMovimientoCaja.EGRESO,
      operacion:
        data.type === 'INGRESO' ? OperacionCaja.INGRESO : OperacionCaja.EGRESO,
      monto: toDecimal(data.amount, 2),
      referencia: toOptionalString(data.reference),
      observaciones: toOptionalString(
        data.observations || data.concept || 'Movimiento manual',
      ),
      createdById: userId,
      updatedById: userId,
    },
  })

  // Create Ingreso or Egreso record if needed
  if (data.type === 'INGRESO') {
    await prisma.ingreso.create({
      data: {
        movimientoCajaId: movement.id,
        concepto: data.concept,
        referencia: toOptionalString(data.reference),
        observaciones: toOptionalString(data.observations),
        createdById: userId,
        updatedById: userId,
      },
    })
  } else {
    await prisma.egreso.create({
      data: {
        movimientoCajaId: movement.id,
        concepto: data.concept,
        referencia: toOptionalString(data.reference),
        observaciones: toOptionalString(data.observations),
        createdById: userId,
        updatedById: userId,
      },
    })
  }

  return {
    success: true,
    movementId: movement.id,
  }
}
