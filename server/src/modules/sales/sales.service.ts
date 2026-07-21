import {
  CodigoFormaPago,
  EmpaqueProducto,
  EstadoLote,
  EstadoVenta,
  EstadoAperturaCaja,
  ModoEmpaqueProducto,
  TipoMovimientoCaja,
  OperacionCaja,
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
    empaque?: EmpaqueProducto
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
  stockDisponible: number
  stockReservado: number
  stockBloqueado: number
  estado: EstadoLote
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

function resolveDefaultDocumentSerie(tipoComprobante: TipoComprobante) {
  if (tipoComprobante === TipoComprobante.FACTURA) return 'F001'
  if (tipoComprobante === TipoComprobante.BOLETA) return 'B001'
  return 'T001'
}

function formatDocumentNumber({
  serie,
  numero,
}: {
  serie: string | null | undefined
  numero: string | null | undefined
}) {
  if (serie && numero) return `${serie}-${numero}`
  return null
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
  const persistedDocumentNumber = formatDocumentNumber({ serie: sale.serie, numero: sale.numero })
  const code =
    persistedDocumentNumber ?? codeMap.get(sale.id) ?? `VNT-${sale.id.slice(0, 6).toUpperCase()}`

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
        saleCode:
          formatDocumentNumber({ serie: sale.serie, numero: sale.numero }) ??
          codeMap.get(sale.id) ??
          `VNT-${sale.id.slice(0, 6).toUpperCase()}`,
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
        packagingMode: product.modoEmpaque,
        unitsPerBlister: product.unidadesPorBlister,
        blistersPerBox: product.blistersPorCaja,
        blisterPrice: decimalToNumber(product.precioVentaBlister) || null,
        availableUnits: Number(availableUnits.toFixed(2)),
        availableBlisters:
          product.modoEmpaque === 'BLISTER' && product.unidadesPorBlister
            ? Math.floor(availableUnits / product.unidadesPorBlister)
            : null,
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

    const [branch, responsibleUser, customer, products, paymentMethods, openCashDrawer] = await Promise.all([
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
          modoEmpaque: true,
          unidadesPorBlister: true,
          blistersPorCaja: true,
          precioVenta: true,
          precioVentaBlister: true,
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
      tx.aperturaCaja.findFirst({
        where: {
          caja: {
            sucursalId: payload.sucursalId,
          },
          estado: EstadoAperturaCaja.ABIERTA,
          deletedAt: null,
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

    if (!openCashDrawer) {
      throw createHttpError(400, 'No hay una caja abierta para esta sucursal. Por favor, abre la caja antes de realizar ventas.')
    }

    const tipoComprobante = payload.tipoComprobante ?? TipoComprobante.TICKET

    const activeSerie = await (async () => {
      const existing = await tx.serieDocumento.findFirst({
        where: {
          deletedAt: null,
          activo: true,
          empresaId: branch.empresaId,
          sucursalId: branch.id,
          tipoComprobante,
        },
        orderBy: [{ createdAt: 'asc' }],
        select: {
          id: true,
        },
      })

      if (existing) {
        return existing
      }

      const defaultSerie = resolveDefaultDocumentSerie(tipoComprobante)

      return tx.serieDocumento.upsert({
        where: {
          empresaId_sucursalId_tipoComprobante_serie: {
            empresaId: branch.empresaId,
            sucursalId: branch.id,
            tipoComprobante,
            serie: defaultSerie,
          },
        },
        update: {
          activo: true,
          deletedAt: null,
          updatedById: userId,
        },
        create: {
          empresaId: branch.empresaId,
          sucursalId: branch.id,
          tipoComprobante,
          serie: defaultSerie,
          activo: true,
          createdById: userId,
          updatedById: userId,
        },
        select: {
          id: true,
        },
      })
    })()

    const serieUpdate = await tx.serieDocumento.update({
      where: {
        id: activeSerie.id,
      },
      data: {
        siguienteNumero: {
          increment: 1,
        },
        updatedById: userId,
      },
      select: {
        id: true,
        serie: true,
        longitudNumero: true,
        siguienteNumero: true,
      },
    })

    const numeroDocumento = String(serieUpdate.siguienteNumero - 1).padStart(
      serieUpdate.longitudNumero,
      '0',
    )
    const correlativo = `${serieUpdate.serie}-${numeroDocumento}`

    const productMap = new Map(products.map((product) => [product.id, product]))
    const paymentMethodMap = new Map(paymentMethods.map((method) => [method.id, method]))

    const lineItems = payload.items.map((item) => {
      const requestedQuantity = Number(item.cantidad)
      const discountTotal = Number(item.descuentoTotal ?? 0)
      const product = productMap.get(item.productoId)!
      const baseUnitPrice = decimalToNumber(product.precioVenta)
      const packType =
        product.modoEmpaque === ModoEmpaqueProducto.BLISTER
          ? (item.empaque ?? EmpaqueProducto.UNIDAD)
          : null
      const packFactor =
        product.modoEmpaque === ModoEmpaqueProducto.BLISTER
          ? packType === EmpaqueProducto.UNIDAD
            ? 1
            : packType === EmpaqueProducto.BLISTER
              ? product.unidadesPorBlister ?? null
              : null
          : null
      const packQuantity =
        product.modoEmpaque === ModoEmpaqueProducto.BLISTER ? requestedQuantity : null
      const quantity =
        product.modoEmpaque === ModoEmpaqueProducto.BLISTER
          ? Number(packQuantity) * Number(packFactor)
          : requestedQuantity

      if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
        throw createHttpError(400, 'La cantidad de cada línea debe ser mayor a 0.')
      }

      if (product.modoEmpaque === ModoEmpaqueProducto.BLISTER) {
        if (!Number.isInteger(requestedQuantity)) {
          throw createHttpError(
            400,
            'La cantidad debe ser un entero al vender por unidad o blíster.',
          )
        }

        if (packType === EmpaqueProducto.CAJA) {
          throw createHttpError(400, 'La venta por caja no está disponible.')
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
      }

      const blisterPrice =
        product.modoEmpaque === ModoEmpaqueProducto.BLISTER &&
        packType === EmpaqueProducto.BLISTER
          ? decimalToNumber(product.precioVentaBlister) ||
            baseUnitPrice * Number(packFactor)
          : null
      const unitPrice =
        blisterPrice !== null && packFactor ? blisterPrice / Number(packFactor) : baseUnitPrice
      const grossAmount = quantity * unitPrice

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
        pack: {
          type: packType,
          quantity: packQuantity,
          factor: packFactor,
        },
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
        serieDocumentoId: serieUpdate.id,
        tipoComprobante,
        serie: serieUpdate.serie,
        numero: numeroDocumento,
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
            cantidad: item.quantity,
            empaque: item.pack.type ?? undefined,
            cantidadEmpaque:
              item.pack.quantity === null || item.pack.quantity === undefined
                ? undefined
                : Math.trunc(item.pack.quantity),
            factorEmpaque:
              item.pack.factor === null || item.pack.factor === undefined
                ? undefined
                : Math.trunc(item.pack.factor),
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
        if (remaining <= 0) {
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
            stockDisponible: nextAvailable,
            estado: nextStatus,
            updatedById: userId,
          },
        })

        const detailSaleLot = await tx.detalleVentaLote.create({
          data: {
            detalleVentaId: detail.id,
            loteId: candidate.id,
            cantidad: allocated,
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
            cantidad: -allocated,
            costoUnitario: availability.unitCost,
            stockResultante: nextAvailable,
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

    // Create cash movements for each payment
    for (const [index, payment] of payments.entries()) {
      const ventaPago = sale.pagos[index] // get the created VentaPago
      await tx.movimientoCaja.create({
        data: {
          aperturaCajaId: openCashDrawer.id,
          tipo: TipoMovimientoCaja.VENTA,
          operacion: OperacionCaja.INGRESO,
          monto: toDecimal(payment.amount, 2),
          referencia: `Venta ${sale.id.slice(0, 8).toUpperCase()}`,
          formaPagoId: payment.formaPagoId,
          ventaPagoId: ventaPago.id,
          observaciones: toOptionalString(payment.observaciones),
          createdById: userId,
          updatedById: userId,
        },
      })
    }

    // If there's change, create an egreso movement
    if (changeAmount > 0) {
      await tx.movimientoCaja.create({
        data: {
          aperturaCajaId: openCashDrawer.id,
          tipo: TipoMovimientoCaja.VENTA, // or maybe AJUSTE? But VENTA makes sense
          operacion: OperacionCaja.EGRESO,
          monto: toDecimal(changeAmount, 2),
          referencia: `Vuelto venta ${sale.id.slice(0, 8).toUpperCase()}`,
          formaPagoId: payments[0].formaPagoId, // only efectivo allows change
          observaciones: 'Vuelto a cliente',
          createdById: userId,
          updatedById: userId,
        },
      })
    }

    return {
      item: {
        id: sale.id,
        code: correlativo,
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

export async function getSaleReceipt(saleId: string, request: FastifyRequest) {
  await getAuthenticatedUserId(request)

  const sale = await prisma.venta.findFirst({
    where: {
      id: saleId,
      deletedAt: null,
    },
    select: {
      id: true,
      tipoComprobante: true,
      serie: true,
      numero: true,
      fechaEmision: true,
      subtotal: true,
      descuentoTotal: true,
      impuestoTotal: true,
      total: true,
      vuelto: true,
      saldoPendiente: true,
      observaciones: true,
      sucursal: {
        select: {
          id: true,
          nombre: true,
          direccion: true,
          telefono: true,
          empresa: {
            select: {
              razonSocial: true,
              nombreComercial: true,
              numeroDocumento: true,
              direccion: true,
              telefono: true,
            },
          },
        },
      },
      cliente: {
        select: {
          id: true,
          tipoDocumento: true,
          numeroDocumento: true,
          nombreCompleto: true,
          razonSocial: true,
          nombres: true,
          apellidos: true,
          direccion: true,
          telefono: true,
        },
      },
      usuarioResponsable: {
        select: {
          nombres: true,
          apellidos: true,
        },
      },
      detalles: {
        where: { deletedAt: null },
        orderBy: [{ createdAt: 'asc' }],
        select: {
          id: true,
          cantidad: true,
          empaque: true,
          cantidadEmpaque: true,
          factorEmpaque: true,
          precioUnitario: true,
          descuentoTotal: true,
          subtotal: true,
          total: true,
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
        },
      },
      pagos: {
        where: { deletedAt: null },
        orderBy: [{ fechaPago: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          monto: true,
          referenciaExterna: true,
          observaciones: true,
          formaPago: {
            select: {
              codigo: true,
              nombre: true,
            },
          },
        },
      },
    },
  })

  if (!sale) {
    throw createHttpError(404, 'La venta no fue encontrada.')
  }

  const documentNumber =
    formatDocumentNumber({ serie: sale.serie, numero: sale.numero }) ??
    `VNT-${sale.id.slice(0, 8).toUpperCase()}`

  return {
    document: {
      tipoComprobante: sale.tipoComprobante,
      correlativo: documentNumber,
    },
    issuedAt: formatDateTime(sale.fechaEmision),
    company: {
      razonSocial: sale.sucursal.empresa.razonSocial,
      nombreComercial: sale.sucursal.empresa.nombreComercial,
      ruc: sale.sucursal.empresa.numeroDocumento,
      direccion: sale.sucursal.empresa.direccion,
      telefono: sale.sucursal.empresa.telefono,
    },
    branch: {
      id: sale.sucursal.id,
      nombre: sale.sucursal.nombre,
      direccion: sale.sucursal.direccion,
      telefono: sale.sucursal.telefono,
    },
    customer: sale.cliente
      ? {
          id: sale.cliente.id,
          nombre:
            sale.cliente.nombreCompleto ??
            sale.cliente.razonSocial ??
            `${sale.cliente.nombres ?? ''} ${sale.cliente.apellidos ?? ''}`.trim(),
          tipoDocumento: sale.cliente.tipoDocumento,
          numeroDocumento: sale.cliente.numeroDocumento,
          direccion: sale.cliente.direccion,
          telefono: sale.cliente.telefono,
        }
      : null,
    cashierName: formatFullName(sale.usuarioResponsable),
    items: sale.detalles.map((detail) => {
      const baseQuantity = decimalToNumber(detail.cantidad)
      const baseUnitPrice = decimalToNumber(detail.precioUnitario)
      const factor = detail.factorEmpaque ?? 1
      const packQuantity = detail.cantidadEmpaque ?? baseQuantity
      const unitSymbol =
        detail.empaque === 'BLISTER' ? 'BLÍS' : detail.producto.unidadMedida.simbolo
      const unitPrice = baseUnitPrice * factor

      return {
        id: detail.id,
        sku: detail.producto.sku,
        name: detail.producto.nombre,
        unitSymbol,
        quantity: packQuantity,
        unitPrice,
        discountAmount: decimalToNumber(detail.descuentoTotal),
        subtotal: decimalToNumber(detail.subtotal),
        total: decimalToNumber(detail.total),
      }
    }),
    totals: {
      subtotal: decimalToNumber(sale.subtotal),
      discountTotal: decimalToNumber(sale.descuentoTotal),
      taxTotal: decimalToNumber(sale.impuestoTotal),
      total: decimalToNumber(sale.total),
      changeAmount: decimalToNumber(sale.vuelto),
      outstandingAmount: decimalToNumber(sale.saldoPendiente),
    },
    payments: sale.pagos.map((payment) => ({
      id: payment.id,
      methodCode: payment.formaPago.codigo,
      methodName: payment.formaPago.nombre,
      amount: decimalToNumber(payment.monto),
      reference: payment.referenciaExterna,
      observations: payment.observaciones,
    })),
    observations: sale.observaciones,
  }
}

export async function cancelSale(saleId: string, request: FastifyRequest, observaciones?: string) {
  const userId = await getAuthenticatedUserId(request)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const result = await prisma.$transaction(async (tx) => {
    const sale = await tx.venta.findFirst({
      where: {
        id: saleId,
        deletedAt: null,
      },
      include: {
        detalles: {
          where: { deletedAt: null },
          include: {
            lotesAsignados: {
              where: { deletedAt: null },
            },
          },
        },
        pagos: { 
          where: { deletedAt: null },
          include: {
            movimientosCaja: true, // get the linked MovimientoCaja
          },
        },
      },
    })

    if (!sale) {
      throw createHttpError(404, 'La venta no fue encontrada.')
    }

    if (sale.estado === EstadoVenta.ANULADA) {
      throw createHttpError(400, 'La venta ya está anulada.')
    }

    const returnReason = await ensureMovementReason(tx, userId, {
      code: 'DEVOLUCION_VENTA',
      name: 'Devolución por anulación de venta',
      description: 'Ingreso de inventario registrado desde la anulación de una venta.',
      type: TipoMovimientoInventario.ENTRADA,
    })

    for (const detail of sale.detalles) {
      for (const lotAssignment of detail.lotesAsignados) {
        const lot = await tx.lote.findFirst({
          where: { id: lotAssignment.loteId, deletedAt: null },
        })
        if (!lot) continue

        const allocatedAmount = decimalToNumber(lotAssignment.cantidad)
        const nextAvailable = decimalToNumber(lot.stockDisponible) + allocatedAmount
        const nextStatus = resolveLotStatus({
          expiryDate: lot.fechaVencimiento,
          availableUnits: nextAvailable,
          reservedUnits: decimalToNumber(lot.stockReservado),
          blockedUnits: decimalToNumber(lot.stockBloqueado),
        })

        await tx.lote.update({
          where: { id: lot.id },
          data: {
            stockDisponible: nextAvailable,
            estado: nextStatus,
            updatedById: userId,
          },
        })

        await tx.movimientoInventario.create({
          data: {
            sucursalId: sale.sucursalId,
            productoId: detail.productoId,
            loteId: lot.id,
            motivoId: returnReason.id,
            detalleVentaId: detail.id,
            detalleVentaLoteId: lotAssignment.id,
            tipo: TipoMovimientoInventario.ENTRADA,
            origen: OrigenMovimientoInventario.DEVOLUCION_VENTA,
            cantidad: allocatedAmount,
            costoUnitario: lotAssignment.costoUnitario,
            stockResultante: nextAvailable,
            referencia: `Anulación venta ${saleId.slice(0, 8).toUpperCase()} lote ${lot.numeroLote}`,
            observaciones: toOptionalString(observaciones),
            createdById: userId,
            updatedById: userId,
          },
        })
      }
    }

    // Reverse all cash movements from this sale
    for (const pago of sale.pagos) {
      for (const movimiento of pago.movimientosCaja) {
        const reverseOperacion = movimiento.operacion === OperacionCaja.INGRESO 
          ? OperacionCaja.EGRESO 
          : OperacionCaja.INGRESO

        await tx.movimientoCaja.create({
          data: {
            aperturaCajaId: movimiento.aperturaCajaId,
            tipo: TipoMovimientoCaja.AJUSTE,
            operacion: reverseOperacion,
            monto: movimiento.monto,
            referencia: `Reversión anulación venta ${saleId.slice(0, 8).toUpperCase()}`,
            formaPagoId: movimiento.formaPagoId,
            observaciones: toOptionalString(observaciones),
            createdById: userId,
            updatedById: userId,
          },
        })
      }
    }

    const updatedSale = await tx.venta.update({
      where: { id: saleId },
      data: {
        estado: EstadoVenta.ANULADA,
        observaciones: toOptionalString(observaciones),
        updatedById: userId,
      },
      include: saleInclude,
    })

    const codeMap = await buildSaleCodeMap()

    return {
      item: mapRecentSale(updatedSale, codeMap),
    }
  }, {
    maxWait: 10_000,
    timeout: 20_000,
  })

  return result
}
