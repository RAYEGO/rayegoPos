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

export async function getCashierDashboard(
  filters: CashierDashboardFilters,
  request: FastifyRequest,
) {
  await getAuthenticatedUserId(request)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get options (branches, payment methods, etc.)
  const branches = await prisma.sucursal.findMany({
    where: { deletedAt: null, activo: true },
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
      if (movement.tipo === TipoMovimientoCaja.APERTURA) continue
      if (movement.tipo === TipoMovimientoCaja.CIERRE) continue
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
      case TipoMovimientoCaja.APERTURA:
        type = 'INGRESO_MANUAL'
        break
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
    if (movement.tipo === TipoMovimientoCaja.APERTURA) {
      description = 'Apertura de caja'
    }
    if (movement.ventaPago) {
      description = 'Cobro de venta mostrador'
    }

    return {
      id: movement.id,
      openingId: movement.aperturaCajaId,
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
    .filter(
      (m) =>
        !m.formaPago &&
        m.tipo !== TipoMovimientoCaja.VENTA &&
        m.tipo !== TipoMovimientoCaja.APERTURA &&
        m.tipo !== TipoMovimientoCaja.CIERRE,
    )
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

  const existingOpenDrawerForUser = await prisma.aperturaCaja.findFirst({
    where: {
      usuarioId: userId,
      estado: EstadoAperturaCaja.ABIERTA,
      deletedAt: null,
    },
    include: cashDrawerInclude,
  })

  if (existingOpenDrawerForUser) {
    throw createHttpError(
      400,
      `Ya tienes una caja abierta en ${existingOpenDrawerForUser.caja.sucursal.nombre}. Cierra el turno antes de abrir una nueva caja.`,
    )
  }

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

  const existingOpenDrawerForBranch = await prisma.aperturaCaja.findFirst({
    where: {
      caja: {
        sucursalId: data.branchId,
      },
      estado: EstadoAperturaCaja.ABIERTA,
      deletedAt: null,
    },
    include: cashDrawerInclude,
  })

  if (existingOpenDrawerForBranch) {
    throw createHttpError(
      400,
      `Ya existe una caja abierta para esta sucursal (responsable: ${formatFullName(existingOpenDrawerForBranch.usuario)}).`,
    )
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
      conciliaciones: {
        where: { deletedAt: null },
        orderBy: { fechaConciliacion: 'desc' },
        take: 1,
        include: {
          detalles: {
            where: { deletedAt: null },
          },
        },
      },
      movimientos: true,
    },
  })

  if (!opening) {
    throw createHttpError(404, 'Apertura de caja no encontrada.')
  }

  if (opening.usuarioId !== userId) {
    throw createHttpError(403, 'No tienes permisos para cerrar esta caja.')
  }

  if (opening.estado !== EstadoAperturaCaja.ABIERTA) {
    throw createHttpError(400, 'La caja ya está cerrada.')
  }

  const latestReconciliation = opening.conciliaciones[0] ?? null

  if (!latestReconciliation) {
    throw createHttpError(
      400,
      'Debes realizar la conciliación antes de cerrar el turno.',
    )
  }

  const reconciliationDifference = decimalToNumber(latestReconciliation.diferenciaTotal)
  const reconciliationObservations = latestReconciliation.observaciones?.trim() ?? ''

  if (reconciliationDifference !== 0 && reconciliationObservations.length === 0) {
    throw createHttpError(
      400,
      'Debes registrar observaciones en la conciliación cuando exista diferencia.',
    )
  }

  // Calculate expected amount
  const openingAmount = decimalToNumber(opening.montoAperturaEfectivo)
  let expectedAmount = openingAmount
  for (const movement of opening.movimientos) {
    if (movement.deletedAt) continue
    if (movement.tipo === TipoMovimientoCaja.APERTURA) continue
    if (movement.tipo === TipoMovimientoCaja.CIERRE) continue
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

  if (opening.usuarioId !== userId) {
    throw createHttpError(403, 'No tienes permisos para registrar movimientos en esta caja.')
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

type CashReconciliationPreviewQuery = {
  openingId: string
}

type CashReconciliationPayload = {
  openingId: string
  counted: Record<string, number>
  observations?: string
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

async function buildExpectedByPaymentMethod(openingId: string) {
  const paymentMethods = await prisma.formaPago.findMany({
    where: {
      deletedAt: null,
      activo: true,
    },
    select: {
      id: true,
      codigo: true,
      nombre: true,
      orden: true,
    },
    orderBy: [{ orden: 'asc' }, { codigo: 'asc' }],
  })

  const cashMethod = paymentMethods.find((method) => method.codigo === CodigoFormaPago.EFECTIVO)
  if (!cashMethod) {
    throw createHttpError(500, 'No existe la forma de pago EFECTIVO.')
  }

  const opening = await prisma.aperturaCaja.findFirst({
    where: {
      id: openingId,
      deletedAt: null,
    },
    select: {
      montoAperturaEfectivo: true,
      movimientos: {
        where: { deletedAt: null },
        select: {
          tipo: true,
          operacion: true,
          monto: true,
          formaPagoId: true,
        },
      },
    },
  })

  if (!opening) {
    throw createHttpError(404, 'Apertura de caja no encontrada.')
  }

  const expectedMap = new Map<string, number>()
  for (const method of paymentMethods) {
    expectedMap.set(method.id, 0)
  }

  expectedMap.set(
    cashMethod.id,
    roundMoney(decimalToNumber(opening.montoAperturaEfectivo)),
  )

  for (const movement of opening.movimientos) {
    if (movement.tipo === TipoMovimientoCaja.APERTURA) continue
    if (movement.tipo === TipoMovimientoCaja.CIERRE) continue

    const methodId = movement.formaPagoId ?? cashMethod.id
    const amount = decimalToNumber(movement.monto)
    const signed = movement.operacion === OperacionCaja.INGRESO ? amount : -amount
    expectedMap.set(methodId, roundMoney((expectedMap.get(methodId) ?? 0) + signed))
  }

  return { paymentMethods, expectedMap, cashMethodId: cashMethod.id }
}

export async function getCashReconciliationPreview(
  request: FastifyRequest,
  query: CashReconciliationPreviewQuery,
) {
  const userId = await getAuthenticatedUserId(request)

  const opening = await prisma.aperturaCaja.findFirst({
    where: {
      id: query.openingId,
      deletedAt: null,
    },
    include: {
      caja: {
        include: {
          sucursal: true,
        },
      },
      conciliaciones: {
        where: { deletedAt: null },
        orderBy: { fechaConciliacion: 'desc' },
        take: 1,
        include: {
          detalles: {
            where: { deletedAt: null },
          },
        },
      },
    },
  })

  if (!opening) {
    throw createHttpError(404, 'Apertura de caja no encontrada.')
  }

  if (opening.usuarioId !== userId) {
    throw createHttpError(403, 'No tienes permisos para conciliar esta caja.')
  }

  if (opening.estado !== EstadoAperturaCaja.ABIERTA) {
    throw createHttpError(400, 'La caja no está abierta.')
  }

  const { paymentMethods, expectedMap } = await buildExpectedByPaymentMethod(opening.id)

  const existingReconciliation = opening.conciliaciones[0] ?? null

  const history = await prisma.conciliacionCaja.findMany({
    where: {
      deletedAt: null,
      aperturaCajaId: opening.id,
    },
    orderBy: { fechaConciliacion: 'desc' },
    take: 10,
    select: {
      id: true,
      fechaConciliacion: true,
      montoSistemaTotal: true,
      montoDeclaradoTotal: true,
      diferenciaTotal: true,
      observaciones: true,
      createdBy: { select: { nombres: true, apellidos: true } },
    },
  })

  const rows = paymentMethods.map((method) => {
    const expectedAmount = roundMoney(expectedMap.get(method.id) ?? 0)
    const existingDetail = existingReconciliation?.detalles.find(
      (detail) => detail.formaPagoId === method.id,
    )
    const countedAmount = existingDetail
      ? roundMoney(decimalToNumber(existingDetail.montoDeclarado))
      : expectedAmount
    const differenceAmount = roundMoney(countedAmount - expectedAmount)

    return {
      paymentMethodId: method.id,
      code: method.codigo,
      name: method.nombre,
      expectedAmount,
      countedAmount,
      differenceAmount,
    }
  })

  const totalExpected = roundMoney(rows.reduce((sum, row) => sum + row.expectedAmount, 0))
  const totalCounted = roundMoney(rows.reduce((sum, row) => sum + row.countedAmount, 0))
  const totalDifference = roundMoney(totalCounted - totalExpected)

  return {
    opening: {
      id: opening.id,
      branchName: opening.caja.sucursal.nombre,
      cashDrawerCode: opening.caja.codigo,
      openedAt: formatDateTime(opening.fechaApertura),
    },
    rows,
    totals: {
      expectedAmount: totalExpected,
      countedAmount: totalCounted,
      differenceAmount: totalDifference,
    },
    lastSaved: existingReconciliation
      ? {
          id: existingReconciliation.id,
          createdAt: formatDateTime(existingReconciliation.fechaConciliacion),
          observations: existingReconciliation.observaciones ?? null,
        }
      : null,
    history: history.map((entry) => ({
      id: entry.id,
      createdAt: formatDateTime(entry.fechaConciliacion),
      expectedAmount: decimalToNumber(entry.montoSistemaTotal),
      countedAmount: decimalToNumber(entry.montoDeclaradoTotal),
      differenceAmount: decimalToNumber(entry.diferenciaTotal),
      observations: entry.observaciones ?? null,
      actorName: entry.createdBy ? formatFullName(entry.createdBy) : 'Sistema',
    })),
  }
}

export async function saveCashReconciliation(
  request: FastifyRequest,
  payload: CashReconciliationPayload,
) {
  const userId = await getAuthenticatedUserId(request)

  const opening = await prisma.aperturaCaja.findFirst({
    where: {
      id: payload.openingId,
      deletedAt: null,
    },
    select: {
      id: true,
      usuarioId: true,
      estado: true,
    },
  })

  if (!opening) {
    throw createHttpError(404, 'Apertura de caja no encontrada.')
  }

  if (opening.usuarioId !== userId) {
    throw createHttpError(403, 'No tienes permisos para conciliar esta caja.')
  }

  if (opening.estado !== EstadoAperturaCaja.ABIERTA) {
    throw createHttpError(400, 'La caja no está abierta.')
  }

  const { paymentMethods, expectedMap } = await buildExpectedByPaymentMethod(opening.id)

  const rows = paymentMethods.map((method) => {
    const expectedAmount = roundMoney(expectedMap.get(method.id) ?? 0)
    const countedAmount = roundMoney(payload.counted[method.id] ?? expectedAmount)
    return {
      paymentMethodId: method.id,
      expectedAmount,
      countedAmount,
      differenceAmount: roundMoney(countedAmount - expectedAmount),
    }
  })

  const totalExpected = roundMoney(rows.reduce((sum, row) => sum + row.expectedAmount, 0))
  const totalCounted = roundMoney(rows.reduce((sum, row) => sum + row.countedAmount, 0))
  const totalDifference = roundMoney(totalCounted - totalExpected)

  const observations = toOptionalString(payload.observations)
  if (totalDifference !== 0 && !observations) {
    throw createHttpError(
      400,
      'Debes registrar observaciones cuando exista diferencia en la conciliación.',
    )
  }

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.conciliacionCaja.create({
      data: {
        aperturaCajaId: opening.id,
        usuarioId: userId,
        montoSistemaTotal: toDecimal(totalExpected, 2),
        montoDeclaradoTotal: toDecimal(totalCounted, 2),
        diferenciaTotal: toDecimal(totalDifference, 2),
        observaciones: observations,
        createdById: userId,
        updatedById: userId,
      },
    })

    for (const row of rows) {
      await tx.conciliacionCajaDetalle.create({
        data: {
          conciliacionCajaId: created.id,
          formaPagoId: row.paymentMethodId,
          montoSistema: toDecimal(row.expectedAmount, 2),
          montoDeclarado: toDecimal(row.countedAmount, 2),
          diferencia: toDecimal(row.differenceAmount, 2),
          createdById: userId,
          updatedById: userId,
        },
      })
    }

    return created.id
  })

  return {
    success: true,
    reconciliationId: result,
    totals: {
      expectedAmount: totalExpected,
      countedAmount: totalCounted,
      differenceAmount: totalDifference,
    },
  }
}

type CashCountPayload = {
  openingId: string
  countedCashAmount: number
  observations?: string
}

type CashCountsQuery = {
  openingId: string
}

export async function createCashCount(request: FastifyRequest, payload: CashCountPayload) {
  const userId = await getAuthenticatedUserId(request)

  const opening = await prisma.aperturaCaja.findFirst({
    where: {
      id: payload.openingId,
      deletedAt: null,
    },
    select: {
      id: true,
      usuarioId: true,
      estado: true,
    },
  })

  if (!opening) {
    throw createHttpError(404, 'Apertura de caja no encontrada.')
  }

  if (opening.usuarioId !== userId) {
    throw createHttpError(403, 'No tienes permisos para registrar arqueo en esta caja.')
  }

  if (opening.estado !== EstadoAperturaCaja.ABIERTA) {
    throw createHttpError(400, 'La caja no está abierta.')
  }

  const { expectedMap, cashMethodId } = await buildExpectedByPaymentMethod(opening.id)
  const expectedCashAmount = roundMoney(expectedMap.get(cashMethodId) ?? 0)
  const countedCashAmount = roundMoney(payload.countedCashAmount)
  const differenceCashAmount = roundMoney(countedCashAmount - expectedCashAmount)

  const observations = toOptionalString(payload.observations)
  if (differenceCashAmount !== 0 && !observations) {
    throw createHttpError(
      400,
      'Debes registrar observaciones cuando exista diferencia en el arqueo.',
    )
  }

  const cashCount = await prisma.arqueoCaja.create({
    data: {
      aperturaCajaId: opening.id,
      usuarioId: userId,
      montoSistemaEfectivo: toDecimal(expectedCashAmount, 2),
      montoDeclaradoEfectivo: toDecimal(countedCashAmount, 2),
      diferenciaEfectivo: toDecimal(differenceCashAmount, 2),
      observaciones: observations,
      createdById: userId,
      updatedById: userId,
    },
  })

  return {
    success: true,
    cashCountId: cashCount.id,
    createdAt: formatDateTime(cashCount.fechaArqueo),
    expectedCashAmount,
    countedCashAmount,
    differenceCashAmount,
  }
}

export async function getCashCounts(request: FastifyRequest, query: CashCountsQuery) {
  const userId = await getAuthenticatedUserId(request)

  const opening = await prisma.aperturaCaja.findFirst({
    where: {
      id: query.openingId,
      deletedAt: null,
    },
    select: {
      id: true,
      usuarioId: true,
    },
  })

  if (!opening) {
    throw createHttpError(404, 'Apertura de caja no encontrada.')
  }

  if (opening.usuarioId !== userId) {
    throw createHttpError(403, 'No tienes permisos para ver arqueos de esta caja.')
  }

  const rows = await prisma.arqueoCaja.findMany({
    where: {
      deletedAt: null,
      aperturaCajaId: opening.id,
    },
    orderBy: { fechaArqueo: 'desc' },
    take: 20,
    select: {
      id: true,
      fechaArqueo: true,
      montoSistemaEfectivo: true,
      montoDeclaradoEfectivo: true,
      diferenciaEfectivo: true,
      observaciones: true,
      createdBy: { select: { nombres: true, apellidos: true } },
    },
  })

  return {
    openingId: opening.id,
    rows: rows.map((row) => ({
      id: row.id,
      createdAt: formatDateTime(row.fechaArqueo),
      expectedCashAmount: decimalToNumber(row.montoSistemaEfectivo),
      countedCashAmount: decimalToNumber(row.montoDeclaradoEfectivo),
      differenceCashAmount: decimalToNumber(row.diferenciaEfectivo),
      observations: row.observaciones ?? null,
      actorName: row.createdBy ? formatFullName(row.createdBy) : 'Sistema',
    })),
  }
}
