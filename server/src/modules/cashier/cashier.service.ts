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
import { requireBranchAuthContext } from '../../lib/auth.js'
import { formatDateInTimeZone, isSameDateInTimeZone } from '../../lib/timeZoneDate.js'
import { classifyPaymentMethod } from '../../shared/payment-catalog.js'

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

async function ensureOpeningClosePendingState(params: {
  opening: { id: string; fechaApertura: Date; cierrePendiente: boolean }
  userId: string
}) {
  const now = new Date()
  if (params.opening.cierrePendiente || !isSameDateInTimeZone(params.opening.fechaApertura, now)) {
    if (!params.opening.cierrePendiente) {
      await prisma.aperturaCaja.update({
        where: { id: params.opening.id },
        data: { cierrePendiente: true, updatedById: params.userId },
      })
    }

    const openingDateLabel = formatDateInTimeZone(params.opening.fechaApertura)
    throw createHttpError(
      409,
      [
        `Caja pendiente de cierre desde el ${openingDateLabel}.`,
        'Cierra la caja del día anterior para continuar operando.',
      ].join('\n\n'),
    )
  }
}

async function getAuthenticatedUserId(request: FastifyRequest) {
  const { userId } = await requireBranchAuthContext(request)
  return userId
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

export async function getActiveCashDrawer(
  request: FastifyRequest,
  params?: {
    paymentMethodId?: string
  },
) {
  const { branchId, userId } = await requireBranchAuthContext(request)

  const opening = await prisma.aperturaCaja.findFirst({
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
      montoAperturaEfectivo: true,
    },
  })

  if (!opening) {
    throw createHttpError(
      404,
      [
        'No existe una caja activa para la sesión.',
        'Abra la Caja para registrar ingresos, egresos o pagos.',
      ].join('\n\n'),
    )
  }

  await ensureOpeningClosePendingState({ opening, userId })

  const selectedPaymentMethodId = params?.paymentMethodId
  const selectedPaymentMethod = selectedPaymentMethodId
    ? await prisma.formaPago.findFirst({
        where: {
          id: selectedPaymentMethodId,
          deletedAt: null,
          activo: true,
        },
        select: {
          id: true,
          codigo: true,
        },
      })
    : null

  if (selectedPaymentMethodId && !selectedPaymentMethod) {
    throw createHttpError(404, 'La forma de pago seleccionada no está disponible.')
  }

  const isCashScope =
    !selectedPaymentMethod ||
    selectedPaymentMethod.codigo === CodigoFormaPago.EFECTIVO

  const cashScopeOr = [{ formaPagoId: null }, { formaPago: { codigo: CodigoFormaPago.EFECTIVO } }]
  const movementScope = selectedPaymentMethod
    ? selectedPaymentMethod.codigo === CodigoFormaPago.EFECTIVO
      ? { OR: cashScopeOr }
      : { formaPagoId: selectedPaymentMethod.id }
    : { OR: cashScopeOr }

  const [incomeAggregate, expenseAggregate] = await Promise.all([
    prisma.movimientoCaja.aggregate({
      where: {
        deletedAt: null,
        aperturaCajaId: opening.id,
        ...movementScope,
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
        aperturaCajaId: opening.id,
        ...movementScope,
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

  const openingAmount = isCashScope ? decimalToNumber(opening.montoAperturaEfectivo) : 0
  const expectedAmount = Number(
    (
      openingAmount +
      decimalToNumber(incomeAggregate._sum?.monto) -
      decimalToNumber(expenseAggregate._sum?.monto)
    ).toFixed(2),
  )

  return {
    openingId: opening.id,
    openedAt: formatDateTime(opening.fechaApertura),
    openingAmount,
    expectedAmount,
  }
}

export async function getCashierDashboard(
  filters: CashierDashboardFilters,
  request: FastifyRequest,
) {
  const { branchId } = await requireBranchAuthContext(request)

  if (filters.branchId && filters.branchId !== branchId) {
    throw createHttpError(403, 'No tienes permisos para acceder a otra sucursal.')
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get options (branches, payment methods, etc.)
  const branches = await prisma.sucursal.findMany({
    where: { deletedAt: null, activo: true },
    select: { id: true, nombre: true, codigo: true },
    orderBy: { nombre: 'asc' },
  })

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

  // Get all cash drawers (aperturas)
  const cashDrawers = await prisma.aperturaCaja.findMany({
    where: {
      deletedAt: null,
      caja: { sucursalId: branchId },
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
      aperturaCaja: { caja: { sucursalId: branchId } },
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
      sucursalId: branchId,
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
  const now = new Date()
  const mappedCashDrawers = cashDrawers.map((drawer) => {
    const status =
      drawer.estado === 'ABIERTA'
        ? ('ABIERTA' as const)
        : drawer.estado === 'CERRADA'
          ? ('CERRADA' as const)
          : ('EN_CIERRE' as const)

    const openingAmount = decimalToNumber(drawer.montoAperturaEfectivo)
    const movementsForDrawer = cashMovements.filter(
      (m) => m.aperturaCajaId === drawer.id,
    )
    let expectedAmount = openingAmount
    for (const movement of movementsForDrawer) {
      if (movement.tipo === TipoMovimientoCaja.APERTURA) continue
      if (movement.tipo === TipoMovimientoCaja.CIERRE) continue
      if (
        movement.formaPagoId !== null &&
        movement.formaPago?.codigo !== CodigoFormaPago.EFECTIVO
      ) {
        continue
      }
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

    const balancesMap = new Map<
      string,
      {
        methodId: string
        code: string
        name: string
        openingBase: number
        income: number
        expense: number
      }
    >()
    for (const method of allPaymentMethods) {
      balancesMap.set(method.id, {
        methodId: method.id,
        code: method.codigo,
        name: method.nombre,
        openingBase: method.codigo === CodigoFormaPago.EFECTIVO ? openingAmount : 0,
        income: 0,
        expense: 0,
      })
    }
    const cashMethod = allPaymentMethods.find(
      (m) => m.codigo === CodigoFormaPago.EFECTIVO,
    )
    for (const movement of movementsForDrawer) {
      if (movement.tipo === TipoMovimientoCaja.APERTURA) continue
      if (movement.tipo === TipoMovimientoCaja.CIERRE) continue
      const methodId = movement.formaPagoId ?? cashMethod?.id ?? ''
      if (!methodId) continue
      const bucket = balancesMap.get(methodId)
      if (!bucket) continue
      const amount = decimalToNumber(movement.monto)
      if (movement.operacion === OperacionCaja.INGRESO) {
        bucket.income += amount
      } else {
        bucket.expense += amount
      }
    }

    const balances = Array.from(balancesMap.values()).map((row) => ({
      paymentMethodId: row.methodId,
      code: row.code,
      name: row.name,
      openingBase: Number(row.openingBase.toFixed(2)),
      income: Number(row.income.toFixed(2)),
      expense: Number(row.expense.toFixed(2)),
      expectedAmount: Number((row.openingBase + row.income - row.expense).toFixed(2)),
    }))

    return {
      id: drawer.id,
      name: drawer.caja.nombre,
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
      closePending:
        drawer.estado === 'ABIERTA' &&
        (drawer.cierrePendiente || !isSameDateInTimeZone(drawer.fechaApertura, now)),
      balances,
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
      paymentMethods: paymentMethods.map((method) => {
        const classification = classifyPaymentMethod(method.codigo)
        return {
          id: method.id,
          code: method.codigo,
          name: method.nombre,
          category: classification.category,
          digitalSubmethod: classification.digitalSubmethod,
        }
      }),
    },
  }
}

export async function openCashDrawer(
  request: FastifyRequest,
  data: {
    branchId?: string
    openingAmount: number
    observations?: string
  },
) {
  const { userId, branchId } = await requireBranchAuthContext(request)
  const targetBranchId = data.branchId ?? branchId

  if (data.branchId && data.branchId !== branchId) {
    throw createHttpError(403, 'No tienes permisos para abrir caja en otra sucursal.')
  }

  const existingOpenDrawerForUser = await prisma.aperturaCaja.findFirst({
    where: {
      usuarioId: userId,
      estado: EstadoAperturaCaja.ABIERTA,
      deletedAt: null,
    },
    include: cashDrawerInclude,
  })

  if (existingOpenDrawerForUser) {
    await ensureOpeningClosePendingState({
      opening: {
        id: existingOpenDrawerForUser.id,
        fechaApertura: existingOpenDrawerForUser.fechaApertura,
        cierrePendiente: existingOpenDrawerForUser.cierrePendiente,
      },
      userId,
    })

    throw createHttpError(
      400,
      `Ya tienes una caja abierta en ${existingOpenDrawerForUser.caja.sucursal.nombre}. Cierra el turno antes de abrir una nueva caja.`,
    )
  }

  // Get or create a cash drawer for the branch
  let cashDrawer = await getDefaultCashDrawerForBranch(targetBranchId)

  if (!cashDrawer) {
    // Create a default cash drawer if none exists
    cashDrawer = await prisma.caja.create({
      data: {
        sucursalId: targetBranchId,
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
        sucursalId: targetBranchId,
      },
      estado: EstadoAperturaCaja.ABIERTA,
      deletedAt: null,
    },
    include: cashDrawerInclude,
  })

  if (existingOpenDrawerForBranch) {
    await ensureOpeningClosePendingState({
      opening: {
        id: existingOpenDrawerForBranch.id,
        fechaApertura: existingOpenDrawerForBranch.fechaApertura,
        cierrePendiente: existingOpenDrawerForBranch.cierrePendiente,
      },
      userId,
    })

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

  // Calculate expected by payment method (universal)
  const { expectedMap, cashMethodId } = await buildExpectedByPaymentMethod(opening.id)

  let autoReconciliationId: string | null = null

  // If user did NOT save an explicit reconciliation before closing → auto-generate one now using counted cash only (for EFECTIVO) and system=declared for digital methods
  if (!latestReconciliation) {
    const paymentMethods = await prisma.formaPago.findMany({
      where: {
        deletedAt: null,
        activo: true,
      },
      select: { id: true, codigo: true },
    })

    let totalExpected = 0
    let totalCounted = 0

    const detailsData: Array<{
      formaPagoId: string
      montoSistema: number
      montoDeclarado: number
      diferencia: number
    }> = []

    for (const method of paymentMethods) {
      const expectedAmount = roundMoney(expectedMap.get(method.id) ?? 0)
      const countedAmount =
        method.id === cashMethodId
          ? roundMoney(data.countedAmount)
          : expectedAmount // digitales: no hay contado manual, usamos sistema
      totalExpected += expectedAmount
      totalCounted += countedAmount
      detailsData.push({
        formaPagoId: method.id,
        montoSistema: expectedAmount,
        montoDeclarado: countedAmount,
        diferencia: roundMoney(countedAmount - expectedAmount),
      })
    }

    const totalDifference = roundMoney(totalCounted - totalExpected)
    const observationsForReconciliation = toOptionalString(data.observations)
    if (totalDifference !== 0 && !observationsForReconciliation) {
      throw createHttpError(
        400,
        'Debes registrar observaciones en el cierre cuando exista diferencia en la conciliación.',
      )
    }

    const auto = await prisma.conciliacionCaja.create({
      data: {
        aperturaCajaId: opening.id,
        usuarioId: userId,
        montoSistemaTotal: toDecimal(totalExpected, 2),
        montoDeclaradoTotal: toDecimal(totalCounted, 2),
        diferenciaTotal: toDecimal(totalDifference, 2),
        observaciones: observationsForReconciliation,
        createdById: userId,
        updatedById: userId,
        detalles: {
          createMany: {
            data: detailsData.map((d) => ({
              formaPagoId: d.formaPagoId,
              montoSistema: toDecimal(d.montoSistema, 2),
              montoDeclarado: toDecimal(d.montoDeclarado, 2),
              diferencia: toDecimal(d.diferencia, 2),
              createdById: userId,
              updatedById: userId,
            })),
          },
        },
      },
    })
    autoReconciliationId = auto.id
  }

  const reconciliationToUse = latestReconciliation ?? autoReconciliationId
    ? await prisma.conciliacionCaja.findFirst({
        where: {
          id: latestReconciliation?.id ?? autoReconciliationId ?? '',
          deletedAt: null,
        },
        select: {
          id: true,
          diferenciaTotal: true,
          observaciones: true,
        },
      })
    : null

  const reconciliationDifference = reconciliationToUse
    ? decimalToNumber(reconciliationToUse.diferenciaTotal)
    : 0
  const reconciliationObservations = reconciliationToUse?.observaciones?.trim() ?? ''

  if (reconciliationDifference !== 0 && reconciliationObservations.length === 0) {
    throw createHttpError(
      400,
      'Debes registrar observaciones en la conciliación cuando exista diferencia.',
    )
  }

  const expectedCashAmount = roundMoney(expectedMap.get(cashMethodId) ?? 0)
  const differenceAmount = roundMoney(data.countedAmount - expectedCashAmount)

  // Create the closing
  const closing = await prisma.cierreCaja.create({
    data: {
      aperturaCajaId: opening.id,
      usuarioId: userId,
      montoSistemaEfectivo: toDecimal(expectedCashAmount, 2),
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
      cierrePendiente: false,
      updatedById: userId,
    },
  })

  const isLateClose = !isSameDateInTimeZone(opening.fechaApertura, closing.fechaCierre)
  const closingObservation = isLateClose ? 'Cierre tardío' : 'Cierre de caja'

  // Create the closing movement
  await prisma.movimientoCaja.create({
    data: {
      aperturaCajaId: opening.id,
      tipo: TipoMovimientoCaja.CIERRE,
      operacion: OperacionCaja.EGRESO,
      monto: toDecimal(data.countedAmount, 2),
      observaciones: closingObservation,
      createdById: userId,
      updatedById: userId,
    },
  })

  return {
    success: true,
    closingId: closing.id,
  }
}

type CreateCashMovementData = {
  openingId: string
  type: 'INGRESO' | 'EGRESO'
  amount: number
  paymentMethodId?: string
  concept: string
  reference?: string
  observations?: string
}

export async function createCashMovement(
  request: FastifyRequest,
  data: CreateCashMovementData,
) {
  const userId = await getAuthenticatedUserId(request)

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

  await ensureOpeningClosePendingState({
    opening: {
      id: opening.id,
      fechaApertura: opening.fechaApertura,
      cierrePendiente: opening.cierrePendiente,
    },
    userId,
  })

  if (opening.estado !== EstadoAperturaCaja.ABIERTA) {
    throw createHttpError(400, 'La caja no está abierta.')
  }

  let paymentMethodId: string | null = null
  if (data.paymentMethodId) {
    const method = await prisma.formaPago.findFirst({
      where: {
        id: data.paymentMethodId,
        deletedAt: null,
        activo: true,
      },
      select: { id: true },
    })
    if (!method) {
      throw createHttpError(400, 'La forma de pago seleccionada no está disponible.')
    }
    paymentMethodId = method.id
  } else {
    const defaultCash = await prisma.formaPago.findFirst({
      where: {
        codigo: CodigoFormaPago.EFECTIVO,
        deletedAt: null,
        activo: true,
      },
      select: { id: true },
    })
    paymentMethodId = defaultCash?.id ?? null
  }

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
      formaPagoId: paymentMethodId,
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
