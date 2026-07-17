import {
  CodigoFormaPago,
  EstadoLote,
  EstadoVenta,
  OrigenMovimientoInventario,
  Prisma,
  TipoComprobante,
  TipoMovimientoInventario,
} from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { prisma } from '../../lib/prisma.js'

const saleInclude = {
  sucursal: {
    select: {
      id: true,
      nombre: true,
    },
  },
  cliente: {
    select: {
      id: true,
      nombres: true,
      apellidos: true,
      razonSocial: true,
      nombreCompleto: true,
      numeroDocumento: true,
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
          esControlado: true,
          unidadMedida: {
            select: {
              simbolo: true,
            },
          },
        },
      },
      lotesAsignados: {
        where: {
          deletedAt: null,
        },
        include: {
          lote: {
            select: {
              id: true,
              numeroLote: true,
              fechaVencimiento: true,
            },
          },
        },
      },
    },
  },
  pagos: {
    where: {
      deletedAt: null,
    },
    include: {
      formaPago: {
        select: {
          codigo: true,
          nombre: true,
          permiteVuelto: true,
        },
      },
    },
  },
} satisfies Prisma.VentaInclude

type SaleWithRelations = Prisma.VentaGetPayload<{
  include: typeof saleInclude
}>

type AuthTokenPayload = {
  sub: string
  typ: 'access' | 'refresh' | 'reset-password'
}

type SalesDashboardFilters = {
  search?: string
  branchId?: string
}

type CreateSalePayload = {
  sucursalId: string
  clienteId?: string
  tipoComprobante?: TipoComprobante
  observaciones?: string
  items: Array<{
    productoId: string
    cantidad: number
    descuentoTotal?: number
  }>
  payments: Array<{
    formaPagoId: string
    monto: number
    referenciaExterna?: string
    observaciones?: string
  }>
}

type LotCandidate = {
  id: string
  productoId: string
  numeroLote: string
  fechaVencimiento: Date
  costoUnitario: Prisma.Decimal
  stockDisponible: Prisma.Decimal
  stockReservado: Prisma.Decimal
  stockBloqueado: Prisma.Decimal
  estado: EstadoLote
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

function getCustomerDisplayName(
  customer:
    | {
        nombreCompleto: string | null
        razonSocial: string | null
        nombres: string | null
        apellidos: string | null
      }
    | null
    | undefined,
) {
  if (!customer) {
    return 'Venta mostrador'
  }

  return (
    customer.nombreCompleto ??
    customer.razonSocial ??
    `${customer.nombres ?? ''} ${customer.apellidos ?? ''}`.trim() ??
    'Cliente'
  )
}

function buildSaleCode(index: number) {
  return `VNT-${String(index).padStart(6, '0')}`
}

function isColdChainProduct(productName: string) {
  return /insulina|vacuna|refriger|cadena de frio/i.test(productName)
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

async function buildSaleCodeMap() {
  const orderedSales = await prisma.venta.findMany({
    where: {
      deletedAt: null,
    },
    select: {
      id: true,
    },
    orderBy: [{ fechaEmision: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  })

  return new Map(orderedSales.map((sale, index) => [sale.id, buildSaleCode(index + 1)]))
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

function mapRecentSale(sale: SaleWithRelations, codeMap: Map<string, string>) {
  const code = codeMap.get(sale.id) ?? `VNT-${sale.id.slice(0, 6).toUpperCase()}`

  return {
    id: sale.id,
    code,
    customerName: getCustomerDisplayName(sale.cliente),
    cashierName: formatFullName(sale.usuarioResponsable),
    branchId: sale.sucursalId,
    branchName: sale.sucursal.nombre,
    createdAt: formatDateTime(sale.fechaEmision),
    totalAmount: decimalToNumber(sale.total),
    outstandingAmount: decimalToNumber(sale.saldoPendiente),
    paymentMethods: sale.pagos.map((payment) => payment.formaPago.codigo),
    itemCount: sale.detalles.length,
    status: sale.estado,
  }
}

function mapDispensations(sales: SaleWithRelations[], codeMap: Map<string, string>) {
  return sales.flatMap((sale) =>
    sale.detalles
      .filter((detail) => detail.producto.requiereReceta || detail.producto.esControlado)
      .map((detail) => ({
        id: detail.id,
        saleId: sale.id,
        saleCode: codeMap.get(sale.id) ?? `VNT-${sale.id.slice(0, 6).toUpperCase()}`,
        productName: detail.producto.nombre,
        customerName: getCustomerDisplayName(sale.cliente),
        cashierName: formatFullName(sale.usuarioResponsable),
        dispensedAt: formatDateTime(sale.fechaEmision),
        lotCodes: detail.lotesAsignados.map((item) => item.lote.numeroLote),
        requiresPrescription: detail.producto.requiereReceta,
        isControlled: detail.producto.esControlado,
        status: 'VALIDADA' as const,
      })),
  )
}

export async function getSalesDashboard(filters: SalesDashboardFilters) {
  await ensureDefaultPaymentMethods(prisma)

  const search = filters.search?.trim().toLowerCase()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const productWhere: Prisma.ProductoWhereInput = {
    deletedAt: null,
    estado: 'ACTIVO',
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
          ],
        }
      : {}),
  }

  const saleWhere: Prisma.VentaWhereInput = {
    deletedAt: null,
    ...(filters.branchId ? { sucursalId: filters.branchId } : {}),
    ...(search
      ? {
          OR: [
            {
              numero: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              cliente: {
                nombreCompleto: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            },
            {
              cliente: {
                razonSocial: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            },
            {
              detalles: {
                some: {
                  producto: {
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

  const [codeMap, branches, customers, paymentMethods, products, sales] = await Promise.all([
    buildSaleCodeMap(),
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
    prisma.cliente.findMany({
      where: {
        deletedAt: null,
        activo: true,
      },
      orderBy: [{ nombreCompleto: 'asc' }, { razonSocial: 'asc' }],
      select: {
        id: true,
        nombreCompleto: true,
        razonSocial: true,
        numeroDocumento: true,
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
        permiteVuelto: true,
      },
    }),
    prisma.producto.findMany({
      where: productWhere,
      include: {
        categoria: {
          select: {
            nombre: true,
          },
        },
        presentacion: {
          select: {
            nombre: true,
          },
        },
        lotes: {
          where: {
            deletedAt: null,
            stockDisponible: {
              gt: 0,
            },
            ...(filters.branchId ? { sucursalId: filters.branchId } : {}),
          },
          select: {
            id: true,
            sucursalId: true,
            numeroLote: true,
            fechaVencimiento: true,
            stockDisponible: true,
            stockReservado: true,
            stockBloqueado: true,
            estado: true,
            createdAt: true,
          },
          orderBy: [{ fechaVencimiento: 'asc' }, { createdAt: 'asc' }],
        },
        unidadMedida: {
          select: {
            simbolo: true,
          },
        },
      },
      orderBy: {
        nombre: 'asc',
      },
    }),
    prisma.venta.findMany({
      where: saleWhere,
      include: saleInclude,
      orderBy: [{ fechaEmision: 'desc' }, { createdAt: 'desc' }],
      take: 30,
    }),
  ])

  const mappedProducts = products
    .map((product) => {
      const sellableLots = product.lotes.filter(
        (lot) =>
          lot.estado !== EstadoLote.BLOQUEADO &&
          lot.estado !== EstadoLote.VENCIDO &&
          lot.fechaVencimiento >= today,
      )
      const suggestedLot = sellableLots[0] ?? null
      const availableUnits = sellableLots.reduce(
        (sum, lot) => sum + decimalToNumber(lot.stockDisponible),
        0,
      )

      return {
        id: product.id,
        name: product.nombre,
        sku: product.sku,
        categoryName: product.categoria.nombre,
        presentationName: product.presentacion?.nombre ?? 'Presentación general',
        unitSymbol: product.unidadMedida.simbolo,
        salePrice: decimalToNumber(product.precioVenta),
        availableUnits: Number(availableUnits.toFixed(2)),
        requiresPrescription: product.requiereReceta,
        isControlled: product.esControlado,
        coldChain: isColdChainProduct(product.nombre),
        suggestedLot: suggestedLot
          ? {
              id: suggestedLot.id,
              branchId: suggestedLot.sucursalId,
              lotCode: suggestedLot.numeroLote,
              expiryDate: formatDate(suggestedLot.fechaVencimiento),
              availableUnits: decimalToNumber(suggestedLot.stockDisponible),
              reservedUnits: decimalToNumber(suggestedLot.stockReservado),
              blockedUnits: decimalToNumber(suggestedLot.stockBloqueado),
            }
          : null,
      }
    })
    .filter((product) => product.suggestedLot !== null)

  const mappedSales = sales.map((sale) => mapRecentSale(sale, codeMap))
  const dispensations = mapDispensations(sales, codeMap).slice(0, 20)

  return {
    summary: {
      recentSalesCount: mappedSales.length,
      issuedSalesCount: mappedSales.filter((sale) => sale.status !== EstadoVenta.ANULADA).length,
      paidSalesCount: mappedSales.filter((sale) => sale.status === EstadoVenta.COBRADA).length,
      pendingSalesCount: mappedSales.filter((sale) => sale.outstandingAmount > 0).length,
      totalBilledAmount: Number(
        mappedSales
          .filter((sale) => sale.status !== EstadoVenta.ANULADA)
          .reduce((sum, sale) => sum + sale.totalAmount, 0)
          .toFixed(2),
      ),
      totalOutstandingAmount: Number(
        mappedSales
          .filter((sale) => sale.status !== EstadoVenta.ANULADA)
          .reduce((sum, sale) => sum + sale.outstandingAmount, 0)
          .toFixed(2),
      ),
      prescriptionItemsCount: dispensations.filter((item) => item.requiresPrescription)
        .length,
      controlledItemsCount: dispensations.filter((item) => item.isControlled).length,
    },
    products: mappedProducts,
    recentSales: mappedSales,
    dispensations,
    options: {
      branches: branches.map((branch) => ({
        id: branch.id,
        name: branch.nombre,
      })),
      customers: customers.map((customer) => ({
        id: customer.id,
        name: customer.nombreCompleto ?? customer.razonSocial ?? 'Cliente',
        documentNumber: customer.numeroDocumento,
      })),
      paymentMethods: paymentMethods.map((method) => ({
        id: method.id,
        code: method.codigo,
        name: method.nombre,
        requiresReference: method.requiereReferencia,
        allowsChange: method.permiteVuelto,
      })),
    },
  }
}

export async function createSale(payload: CreateSalePayload, request: FastifyRequest) {
  const userId = await getAuthenticatedUserId(request)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (!payload.items.length) {
    throw createHttpError(400, 'La venta debe contener al menos un producto.')
  }

  const duplicatedProducts = payload.items.reduce((map, item) => {
    map.set(item.productoId, (map.get(item.productoId) ?? 0) + 1)
    return map
  }, new Map<string, number>())

  if ([...duplicatedProducts.values()].some((count) => count > 1)) {
    throw createHttpError(400, 'No repitas el mismo producto dentro de la misma venta.')
  }

  const result = await prisma.$transaction(async (tx) => {
    await ensureDefaultPaymentMethods(tx, userId)

    const [branch, responsibleUser, customer, products, paymentMethods] = await Promise.all([
      tx.sucursal.findFirst({
        where: {
          id: payload.sucursalId,
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
      payload.clienteId
        ? tx.cliente.findFirst({
            where: {
              id: payload.clienteId,
              deletedAt: null,
              activo: true,
            },
          })
        : Promise.resolve(null),
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
          precioVenta: true,
          costoReferencia: true,
          requiereReceta: true,
          esControlado: true,
          unidadMedida: {
            select: {
              simbolo: true,
            },
          },
        },
      }),
      tx.formaPago.findMany({
        where: {
          id: {
            in: payload.payments.map((payment) => payment.formaPagoId),
          },
          deletedAt: null,
          activo: true,
        },
      }),
    ])

    if (!branch) {
      throw createHttpError(404, 'La sucursal seleccionada no está disponible.')
    }

    if (!responsibleUser) {
      throw createHttpError(404, 'El usuario responsable no está disponible.')
    }

    if (payload.clienteId && !customer) {
      throw createHttpError(404, 'El cliente seleccionado no está disponible.')
    }

    if (products.length !== payload.items.length) {
      throw createHttpError(
        404,
        'Uno o más productos seleccionados ya no están disponibles para la venta.',
      )
    }

    if (paymentMethods.length !== payload.payments.length) {
      throw createHttpError(404, 'Una o más formas de pago seleccionadas no están disponibles.')
    }

    const productMap = new Map(products.map((product) => [product.id, product]))
    const paymentMethodMap = new Map(paymentMethods.map((method) => [method.id, method]))

    const lineItems = payload.items.map((item) => {
      const quantity = Number(item.cantidad)
      const discountTotal = Number(item.descuentoTotal ?? 0)
      const product = productMap.get(item.productoId)!
      const unitPrice = decimalToNumber(product.precioVenta)
      const grossAmount = quantity * unitPrice

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw createHttpError(400, 'La cantidad de cada línea debe ser mayor a 0.')
      }

      if (!Number.isFinite(discountTotal) || discountTotal < 0 || discountTotal > grossAmount) {
        throw createHttpError(
          400,
          'El descuento de una línea no puede ser negativo ni superar el total bruto.',
        )
      }

      return {
        productoId: item.productoId,
        quantity,
        discountTotal,
        unitPrice,
        subtotal: grossAmount - discountTotal,
        total: grossAmount - discountTotal,
        product,
      }
    })

    const totalAmount = Number(lineItems.reduce((sum, item) => sum + item.total, 0).toFixed(2))
    const discountAmount = Number(
      lineItems.reduce((sum, item) => sum + item.discountTotal, 0).toFixed(2),
    )
    const subtotalAmount = Number(
      lineItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2),
    )

    const payments = payload.payments.map((payment) => {
      const amount = Number(payment.monto)
      const paymentMethod = paymentMethodMap.get(payment.formaPagoId)!

      if (!Number.isFinite(amount) || amount <= 0) {
        throw createHttpError(400, 'Cada pago debe tener un monto mayor a 0.')
      }

      if (paymentMethod.requiereReferencia && !toOptionalString(payment.referenciaExterna)) {
        throw createHttpError(
          400,
          `La forma de pago ${paymentMethod.nombre} requiere una referencia externa.`,
        )
      }

      return {
        ...payment,
        amount,
        paymentMethod,
      }
    })

    const paidAmount = Number(payments.reduce((sum, payment) => sum + payment.amount, 0).toFixed(2))
    const balanceAmount = Number(Math.max(0, totalAmount - paidAmount).toFixed(2))
    const changeAmount = Number(Math.max(0, paidAmount - totalAmount).toFixed(2))

    if (changeAmount > 0) {
      if (payments.length !== 1 || !payments[0].paymentMethod.permiteVuelto) {
        throw createHttpError(
          400,
          'Solo un pago único con efectivo puede generar vuelto en esta versión.',
        )
      }
    }

    const lots = await tx.lote.findMany({
      where: {
        deletedAt: null,
        sucursalId: payload.sucursalId,
        productoId: {
          in: lineItems.map((item) => item.productoId),
        },
        stockDisponible: {
          gt: 0,
        },
      },
      select: {
        id: true,
        productoId: true,
        numeroLote: true,
        fechaVencimiento: true,
        costoUnitario: true,
        stockDisponible: true,
        stockReservado: true,
        stockBloqueado: true,
        estado: true,
      },
      orderBy: [{ fechaVencimiento: 'asc' }, { createdAt: 'asc' }],
    })

    const availableLotsByProduct = lots.reduce((map, lot) => {
      const current = map.get(lot.productoId) ?? []
      current.push(lot)
      map.set(lot.productoId, current)
      return map
    }, new Map<string, LotCandidate[]>())

    const saleReason = await ensureMovementReason(tx, userId, {
      code: 'VENTA_LOTE',
      name: 'Venta por lote',
      description: 'Salida de inventario registrada desde el módulo de ventas.',
      type: TipoMovimientoInventario.SALIDA,
    })

    const sale = await tx.venta.create({
      data: {
        sucursalId: payload.sucursalId,
        clienteId: payload.clienteId,
        usuarioResponsableId: userId,
        tipoComprobante: payload.tipoComprobante ?? TipoComprobante.TICKET,
        fechaEmision: new Date(),
        estado: balanceAmount <= 0 ? EstadoVenta.COBRADA : EstadoVenta.EMITIDA,
        subtotal: toDecimal(subtotalAmount, 2),
        descuentoTotal: toDecimal(discountAmount, 2),
        impuestoTotal: toDecimal(0, 2),
        total: toDecimal(totalAmount, 2),
        vuelto: toDecimal(changeAmount, 2),
        saldoPendiente: toDecimal(balanceAmount, 2),
        observaciones: toOptionalString(payload.observaciones),
        createdById: userId,
        updatedById: userId,
        detalles: {
          create: lineItems.map((item) => ({
            productoId: item.productoId,
            cantidad: toDecimal(item.quantity, 4),
            precioUnitario: toDecimal(item.unitPrice, 6),
            descuentoTotal: toDecimal(item.discountTotal, 2),
            impuestoTotal: toDecimal(0, 2),
            subtotal: toDecimal(item.subtotal, 2),
            total: toDecimal(item.total, 2),
            costoReferencia: item.product.costoReferencia,
            createdById: userId,
            updatedById: userId,
          })),
        },
        pagos: {
          create: payments.map((payment) => ({
            formaPagoId: payment.formaPagoId,
            monto: toDecimal(payment.amount, 2),
            referenciaExterna: toOptionalString(payment.referenciaExterna),
            observaciones: toOptionalString(payment.observaciones),
            createdById: userId,
            updatedById: userId,
          })),
        },
      },
      include: saleInclude,
    })

    const detailMap = new Map(sale.detalles.map((detail) => [detail.productoId, detail]))
    const lotAvailabilityMap = new Map(
      lots.map((lot) => [
        lot.id,
        {
          availableUnits: decimalToNumber(lot.stockDisponible),
          reservedUnits: decimalToNumber(lot.stockReservado),
          blockedUnits: decimalToNumber(lot.stockBloqueado),
          expiryDate: lot.fechaVencimiento,
          unitCost: lot.costoUnitario,
          productId: lot.productoId,
          lotCode: lot.numeroLote,
        },
      ]),
    )

    for (const item of lineItems) {
      const detail = detailMap.get(item.productoId)

      if (!detail) {
        throw createHttpError(500, 'No fue posible enlazar los detalles de la venta creada.')
      }

      const candidates = (availableLotsByProduct.get(item.productoId) ?? []).filter((lot) => {
        const availability = lotAvailabilityMap.get(lot.id)

        return (
          !!availability &&
          availability.availableUnits > 0 &&
          lot.estado !== EstadoLote.BLOQUEADO &&
          lot.estado !== EstadoLote.VENCIDO &&
          availability.expiryDate >= today
        )
      })

      const totalAvailable = candidates.reduce((sum, lot) => {
        const availability = lotAvailabilityMap.get(lot.id)
        return sum + (availability?.availableUnits ?? 0)
      }, 0)

      if (totalAvailable + 0.0001 < item.quantity) {
        throw createHttpError(
          400,
          `No hay stock suficiente por lotes para ${item.product.nombre}. Disponible: ${totalAvailable.toFixed(2)}.`,
        )
      }

      let remaining = item.quantity

      for (const candidate of candidates) {
        if (remaining <= 0.0001) {
          break
        }

        const availability = lotAvailabilityMap.get(candidate.id)

        if (!availability || availability.availableUnits <= 0) {
          continue
        }

        const allocated = Math.min(availability.availableUnits, remaining)
        const nextAvailable = availability.availableUnits - allocated
        const nextStatus = resolveLotStatus({
          expiryDate: availability.expiryDate,
          availableUnits: nextAvailable,
          reservedUnits: availability.reservedUnits,
          blockedUnits: availability.blockedUnits,
        })

        await tx.lote.update({
          where: {
            id: candidate.id,
          },
          data: {
            stockDisponible: toDecimal(nextAvailable, 4),
            estado: nextStatus,
            updatedById: userId,
          },
        })

        const detailSaleLot = await tx.detalleVentaLote.create({
          data: {
            detalleVentaId: detail.id,
            loteId: candidate.id,
            cantidad: toDecimal(allocated, 4),
            costoUnitario: availability.unitCost,
            createdById: userId,
            updatedById: userId,
          },
        })

        await tx.movimientoInventario.create({
          data: {
            sucursalId: payload.sucursalId,
            productoId: item.productoId,
            loteId: candidate.id,
            motivoId: saleReason.id,
            detalleVentaId: detail.id,
            detalleVentaLoteId: detailSaleLot.id,
            tipo: TipoMovimientoInventario.SALIDA,
            origen: OrigenMovimientoInventario.VENTA,
            cantidad: toDecimal(-allocated, 4),
            costoUnitario: availability.unitCost,
            stockResultante: toDecimal(nextAvailable, 4),
            referencia: `Venta ${sale.id.slice(0, 8).toUpperCase()} lote ${availability.lotCode}`,
            observaciones: toOptionalString(payload.observaciones),
            createdById: userId,
            updatedById: userId,
          },
        })

        availability.availableUnits = nextAvailable
        remaining -= allocated
      }
    }

    const saleSequence = await tx.venta.count({
      where: {
        deletedAt: null,
      },
    })

    return {
      item: {
        id: sale.id,
        code: buildSaleCode(saleSequence),
        customerName: getCustomerDisplayName(sale.cliente),
        cashierName: formatFullName(sale.usuarioResponsable),
        totalAmount,
        paidAmount,
        changeAmount,
        outstandingAmount: balanceAmount,
        status: balanceAmount <= 0 ? EstadoVenta.COBRADA : EstadoVenta.EMITIDA,
      },
    }
  }, {
    maxWait: 10_000,
    timeout: 20_000,
  })

  return result
}
