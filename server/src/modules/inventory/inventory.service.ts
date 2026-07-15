import {
  EstadoLote,
  OrigenMovimientoInventario,
  Prisma,
  TipoMovimientoInventario,
} from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { prisma } from '../../lib/prisma.js'

type AuthTokenPayload = {
  sub: string
  typ: 'access' | 'refresh' | 'reset-password'
}

type InventoryDashboardFilters = {
  search?: string
  status?: EstadoLote
  branchId?: string
  productId?: string
}

type CreateInventoryLotPayload = {
  sucursalId: string
  productoId: string
  proveedorId?: string
  numeroLote: string
  fechaFabricacion?: string
  fechaVencimiento: string
  costoUnitario: number
  stockInicial: number
  stockReservado?: number
  stockBloqueado?: number
  almacen?: string
  observaciones?: string
}

type AdjustInventoryLotPayload = {
  lotId: string
  target: 'DISPONIBLE' | 'RESERVADO' | 'BLOQUEADO'
  operation: 'SUMAR' | 'RESTAR'
  quantity: number
  observaciones?: string
}

type TransferInventoryLotPayload = {
  lotId: string
  destinationBranchId: string
  quantity: number
  destinationWarehouse?: string
  observaciones?: string
}

type InventoryTransaction = Prisma.TransactionClient

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

function formatDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null
}

function formatDateTime(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function toOptionalString(value?: string | null) {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

function isExpiringSoon(value: Date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const limit = new Date(today)
  limit.setDate(limit.getDate() + 45)

  return value >= today && value <= limit
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

function buildInventoryWarehouseMap(
  inventories: Array<{
    sucursalId: string
    productoId: string
    ubicacion: string | null
  }>,
) {
  return new Map(
    inventories.map((inventory) => [
      `${inventory.sucursalId}:${inventory.productoId}`,
      inventory.ubicacion,
    ]),
  )
}

async function ensureMovementReason(
  tx: InventoryTransaction,
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

async function getLotForOperation(tx: InventoryTransaction, lotId: string) {
  const lot = await tx.lote.findFirst({
    where: {
      id: lotId,
      deletedAt: null,
    },
    include: {
      sucursal: {
        select: {
          id: true,
          nombre: true,
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
      proveedor: {
        select: {
          razonSocial: true,
        },
      },
    },
  })

  if (!lot) {
    throw createHttpError(404, 'El lote seleccionado no está disponible.')
  }

  return lot
}

async function upsertInventoryWarehouse(
  tx: InventoryTransaction,
  {
    branchId,
    productId,
    userId,
    warehouseName,
  }: {
    branchId: string
    productId: string
    userId: string
    warehouseName?: string
  },
) {
  return tx.inventario.upsert({
    where: {
      sucursalId_productoId: {
        sucursalId: branchId,
        productoId: productId,
      },
    },
    update: {
      ubicacion: toOptionalString(warehouseName),
      updatedById: userId,
    },
    create: {
      sucursalId: branchId,
      productoId: productId,
      ubicacion: toOptionalString(warehouseName),
      createdById: userId,
      updatedById: userId,
    },
  })
}

async function buildLotResponse(tx: InventoryTransaction, lotId: string) {
  const lot = await tx.lote.findFirst({
    where: {
      id: lotId,
      deletedAt: null,
    },
    include: {
      sucursal: {
        select: {
          id: true,
          nombre: true,
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
      proveedor: {
        select: {
          razonSocial: true,
        },
      },
    },
  })

  if (!lot) {
    throw createHttpError(404, 'No fue posible reconstruir el lote actualizado.')
  }

  const inventory = await tx.inventario.findUnique({
    where: {
      sucursalId_productoId: {
        sucursalId: lot.sucursalId,
        productoId: lot.productoId,
      },
    },
    select: {
      ubicacion: true,
    },
  })

  return {
    id: lot.id,
    productId: lot.productoId,
    productName: lot.producto.nombre,
    sku: lot.producto.sku,
    unitSymbol: lot.producto.unidadMedida.simbolo,
    branchId: lot.sucursalId,
    branchName: lot.sucursal.nombre,
    warehouseName: inventory?.ubicacion ?? 'Mostrador principal',
    supplierName: lot.proveedor?.razonSocial ?? 'Sin proveedor',
    lotCode: lot.numeroLote,
    manufacturedAt: formatDate(lot.fechaFabricacion),
    expiryDate: formatDate(lot.fechaVencimiento),
    receivedAt: formatDate(lot.createdAt),
    unitCost: decimalToNumber(lot.costoUnitario),
    initialUnits: decimalToNumber(lot.stockInicial),
    availableUnits: decimalToNumber(lot.stockDisponible),
    reservedUnits: decimalToNumber(lot.stockReservado),
    blockedUnits: decimalToNumber(lot.stockBloqueado),
    status: lot.estado,
    observations: lot.observaciones,
    expiresSoon: isExpiringSoon(lot.fechaVencimiento),
  }
}

export async function getInventoryDashboard(filters: InventoryDashboardFilters) {
  const search = filters.search?.trim()

  const lotWhere: Prisma.LoteWhereInput = {
    deletedAt: null,
    ...(filters.status ? { estado: filters.status } : {}),
    ...(filters.branchId ? { sucursalId: filters.branchId } : {}),
    ...(filters.productId ? { productoId: filters.productId } : {}),
    ...(search
      ? {
          OR: [
            {
              numeroLote: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              producto: {
                nombre: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            },
            {
              producto: {
                sku: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            },
            {
              proveedor: {
                razonSocial: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            },
          ],
        }
      : {}),
  }

  const movementWhere: Prisma.MovimientoInventarioWhereInput = {
    deletedAt: null,
    ...(filters.branchId ? { sucursalId: filters.branchId } : {}),
    ...(filters.productId ? { productoId: filters.productId } : {}),
    ...(search
      ? {
          OR: [
            {
              referencia: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              producto: {
                nombre: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            },
            {
              lote: {
                numeroLote: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            },
          ],
        }
      : {}),
  }

  const [branches, products, suppliers, inventories, lots, movements] =
    await Promise.all([
      prisma.sucursal.findMany({
        where: {
          deletedAt: null,
          activo: true,
        },
        orderBy: {
          nombre: 'asc',
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
        },
      }),
      prisma.inventario.findMany({
        where: {
          deletedAt: null,
        },
        select: {
          sucursalId: true,
          productoId: true,
          ubicacion: true,
        },
      }),
      prisma.lote.findMany({
        where: lotWhere,
        include: {
          sucursal: {
            select: {
              id: true,
              nombre: true,
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
          proveedor: {
            select: {
              razonSocial: true,
            },
          },
        },
        orderBy: [{ fechaVencimiento: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.movimientoInventario.findMany({
        where: movementWhere,
        include: {
          sucursal: {
            select: {
              nombre: true,
            },
          },
          producto: {
            select: {
              nombre: true,
              sku: true,
            },
          },
          lote: {
            select: {
              numeroLote: true,
              productoId: true,
              sucursalId: true,
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
        take: 20,
      }),
    ])

  const warehouseMap = buildInventoryWarehouseMap(inventories)

  const mappedLots = lots.map((lot) => {
    const warehouseName =
      warehouseMap.get(`${lot.sucursalId}:${lot.productoId}`) ?? 'Mostrador principal'

    return {
      id: lot.id,
      productId: lot.productoId,
      productName: lot.producto.nombre,
      sku: lot.producto.sku,
      unitSymbol: lot.producto.unidadMedida.simbolo,
      branchId: lot.sucursalId,
      branchName: lot.sucursal.nombre,
      warehouseName,
      supplierName: lot.proveedor?.razonSocial ?? 'Sin proveedor',
      lotCode: lot.numeroLote,
      manufacturedAt: formatDate(lot.fechaFabricacion),
      expiryDate: formatDate(lot.fechaVencimiento),
      receivedAt: formatDate(lot.createdAt),
      unitCost: decimalToNumber(lot.costoUnitario),
      initialUnits: decimalToNumber(lot.stockInicial),
      availableUnits: decimalToNumber(lot.stockDisponible),
      reservedUnits: decimalToNumber(lot.stockReservado),
      blockedUnits: decimalToNumber(lot.stockBloqueado),
      status: lot.estado,
      observations: lot.observaciones,
      expiresSoon: isExpiringSoon(lot.fechaVencimiento),
    }
  })

  const branchSummary = Array.from(
    mappedLots.reduce((summaryMap, lot) => {
      const current = summaryMap.get(lot.branchId) ?? {
        id: lot.branchId,
        name: lot.branchName,
        warehouses: new Set<string>(),
        productIds: new Set<string>(),
        lotCount: 0,
        availableUnits: 0,
        reservedUnits: 0,
        blockedUnits: 0,
        expiringSoonCount: 0,
      }

      current.warehouses.add(lot.warehouseName)
      current.productIds.add(lot.productId)
      current.lotCount += 1
      current.availableUnits += lot.availableUnits
      current.reservedUnits += lot.reservedUnits
      current.blockedUnits += lot.blockedUnits
      current.expiringSoonCount += lot.expiresSoon ? 1 : 0

      summaryMap.set(lot.branchId, current)
      return summaryMap
    }, new Map<string, {
      id: string
      name: string
      warehouses: Set<string>
      productIds: Set<string>
      lotCount: number
      availableUnits: number
      reservedUnits: number
      blockedUnits: number
      expiringSoonCount: number
    }>()),
  ).map(([, branch]) => ({
    id: branch.id,
    name: branch.name,
    warehouseNames: Array.from(branch.warehouses),
    skuCount: branch.productIds.size,
    lotCount: branch.lotCount,
    availableUnits: Number(branch.availableUnits.toFixed(2)),
    reservedUnits: Number(branch.reservedUnits.toFixed(2)),
    blockedUnits: Number(branch.blockedUnits.toFixed(2)),
    expiringSoonCount: branch.expiringSoonCount,
  }))

  const fifoCandidates = [...mappedLots]
    .filter(
      (lot) =>
        lot.availableUnits > 0 &&
        lot.status !== EstadoLote.VENCIDO &&
        lot.status !== EstadoLote.BLOQUEADO,
    )
    .sort((left, right) => {
      if (left.expiryDate && right.expiryDate) {
        return left.expiryDate.localeCompare(right.expiryDate)
      }

      return left.receivedAt?.localeCompare(right.receivedAt ?? '') ?? 0
    })
    .slice(0, 5)

  const alerts = mappedLots
    .filter(
      (lot) =>
        lot.status === EstadoLote.BLOQUEADO ||
        lot.status === EstadoLote.VENCIDO ||
        lot.expiresSoon ||
        lot.availableUnits <= 0,
    )
    .slice(0, 8)
    .map((lot) => ({
      ...lot,
      alertType:
        lot.status === EstadoLote.BLOQUEADO
          ? 'BLOQUEADO'
          : lot.status === EstadoLote.VENCIDO
            ? 'VENCIDO'
            : lot.availableUnits <= 0
              ? 'SIN_STOCK'
              : 'POR_VENCER',
    }))

  const mappedMovements = movements.map((movement) => {
    const warehouseName = movement.lote
      ? warehouseMap.get(`${movement.lote.sucursalId}:${movement.lote.productoId}`)
      : null

    return {
      id: movement.id,
      createdAt: formatDateTime(movement.fechaMovimiento),
      type: movement.tipo,
      origin: movement.origen,
      productName: movement.producto.nombre,
      sku: movement.producto.sku,
      branchName: movement.sucursal.nombre,
      warehouseName: warehouseName ?? 'Mostrador principal',
      lotCode: movement.lote?.numeroLote ?? 'Sin lote',
      quantity: decimalToNumber(movement.cantidad),
      stockAfter: decimalToNumber(movement.stockResultante),
      unitCost: decimalToNumber(movement.costoUnitario),
      reference: movement.referencia,
      actorName: movement.createdBy
        ? `${movement.createdBy.nombres} ${movement.createdBy.apellidos}`.trim()
        : 'Sistema',
    }
  })

  return {
    summary: {
      totalAvailableUnits: Number(
        mappedLots.reduce((sum, lot) => sum + lot.availableUnits, 0).toFixed(2),
      ),
      totalReservedUnits: Number(
        mappedLots.reduce((sum, lot) => sum + lot.reservedUnits, 0).toFixed(2),
      ),
      totalBlockedUnits: Number(
        mappedLots.reduce((sum, lot) => sum + lot.blockedUnits, 0).toFixed(2),
      ),
      expiringSoonCount: mappedLots.filter((lot) => lot.expiresSoon).length,
      branchCount: new Set(mappedLots.map((lot) => lot.branchId)).size,
      lotCount: mappedLots.length,
    },
    branchSummary,
    lots: mappedLots,
    movements: mappedMovements,
    alerts,
    fifoCandidates,
    options: {
      branches: branches.map((branch) => ({
        id: branch.id,
        name: branch.nombre,
      })),
      products: products.map((product) => ({
        id: product.id,
        name: product.nombre,
        sku: product.sku,
      })),
      suppliers: suppliers.map((supplier) => ({
        id: supplier.id,
        name: supplier.razonSocial,
      })),
      warehouses: Array.from(
        inventories.reduce((warehouseMap, inventory) => {
          const warehouseName = toOptionalString(inventory.ubicacion)

          if (!warehouseName) {
            return warehouseMap
          }

          const key = `${inventory.sucursalId}:${warehouseName}`

          if (!warehouseMap.has(key)) {
            warehouseMap.set(key, {
              branchId: inventory.sucursalId,
              name: warehouseName,
            })
          }

          return warehouseMap
        }, new Map<string, { branchId: string; name: string }>()),
      ).map(([, warehouse]) => warehouse),
    },
  }
}

export async function createInventoryLot(
  payload: CreateInventoryLotPayload,
  request: FastifyRequest,
) {
  const userId = await getAuthenticatedUserId(request)
  const stockInitial = Number(payload.stockInicial)
  const reservedUnits = Number(payload.stockReservado ?? 0)
  const blockedUnits = Number(payload.stockBloqueado ?? 0)
  const availableUnits = stockInitial - reservedUnits - blockedUnits
  const expiryDate = new Date(`${payload.fechaVencimiento}T00:00:00`)
  const manufacturedAt = payload.fechaFabricacion
    ? new Date(`${payload.fechaFabricacion}T00:00:00`)
    : null

  if (!Number.isFinite(stockInitial) || stockInitial <= 0) {
    throw createHttpError(400, 'El stock inicial debe ser mayor a 0.')
  }

  if (reservedUnits < 0 || blockedUnits < 0) {
    throw createHttpError(400, 'El stock reservado y bloqueado no puede ser negativo.')
  }

  if (availableUnits < 0) {
    throw createHttpError(
      400,
      'La suma de stock reservado y bloqueado no puede superar el stock inicial.',
    )
  }

  if (Number(payload.costoUnitario) < 0) {
    throw createHttpError(400, 'El costo unitario no puede ser negativo.')
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
      const [branch, product] = await Promise.all([
        tx.sucursal.findFirst({
          where: {
            id: payload.sucursalId,
            deletedAt: null,
            activo: true,
          },
        }),
        tx.producto.findFirst({
          where: {
            id: payload.productoId,
            deletedAt: null,
            estado: 'ACTIVO',
          },
          select: {
            id: true,
            nombre: true,
            sku: true,
          },
        }),
      ])

      if (!branch) {
        throw createHttpError(404, 'La sucursal seleccionada no está disponible.')
      }

      if (!product) {
        throw createHttpError(404, 'El producto seleccionado no está disponible.')
      }

      if (payload.proveedorId) {
        const supplier = await tx.proveedor.findFirst({
          where: {
            id: payload.proveedorId,
            deletedAt: null,
            activo: true,
          },
        })

        if (!supplier) {
          throw createHttpError(404, 'El proveedor seleccionado no está disponible.')
        }
      }

      const openingReason = await tx.motivoMovimientoInventario.upsert({
        where: {
          codigo: 'APERTURA_LOTE',
        },
        update: {
          nombre: 'Apertura de lote',
          tipo: TipoMovimientoInventario.ENTRADA,
          activo: true,
          updatedById: userId,
        },
        create: {
          codigo: 'APERTURA_LOTE',
          nombre: 'Apertura de lote',
          descripcion: 'Ingreso inicial de un lote al inventario.',
          tipo: TipoMovimientoInventario.ENTRADA,
          activo: true,
          createdById: userId,
          updatedById: userId,
        },
      })

      const reserveReason = await tx.motivoMovimientoInventario.upsert({
        where: {
          codigo: 'RESERVA_INICIAL',
        },
        update: {
          nombre: 'Reserva inicial',
          tipo: TipoMovimientoInventario.RESERVA,
          activo: true,
          updatedById: userId,
        },
        create: {
          codigo: 'RESERVA_INICIAL',
          nombre: 'Reserva inicial',
          descripcion: 'Reserva registrada durante la apertura del lote.',
          tipo: TipoMovimientoInventario.RESERVA,
          activo: true,
          createdById: userId,
          updatedById: userId,
        },
      })

      const blockReason = await tx.motivoMovimientoInventario.upsert({
        where: {
          codigo: 'BLOQUEO_INICIAL',
        },
        update: {
          nombre: 'Bloqueo inicial',
          tipo: TipoMovimientoInventario.AJUSTE,
          activo: true,
          updatedById: userId,
        },
        create: {
          codigo: 'BLOQUEO_INICIAL',
          nombre: 'Bloqueo inicial',
          descripcion: 'Bloqueo registrado durante la apertura del lote.',
          tipo: TipoMovimientoInventario.AJUSTE,
          activo: true,
          createdById: userId,
          updatedById: userId,
        },
      })

      await tx.inventario.upsert({
        where: {
          sucursalId_productoId: {
            sucursalId: payload.sucursalId,
            productoId: payload.productoId,
          },
        },
        update: {
          ubicacion: toOptionalString(payload.almacen),
          updatedById: userId,
        },
        create: {
          sucursalId: payload.sucursalId,
          productoId: payload.productoId,
          ubicacion: toOptionalString(payload.almacen),
          createdById: userId,
          updatedById: userId,
        },
      })

      const lot = await tx.lote.create({
        data: {
          sucursalId: payload.sucursalId,
          productoId: payload.productoId,
          proveedorId: toOptionalString(payload.proveedorId),
          numeroLote: payload.numeroLote.trim().toUpperCase(),
          fechaFabricacion: manufacturedAt ?? undefined,
          fechaVencimiento: expiryDate,
          costoUnitario: toDecimal(Number(payload.costoUnitario), 6),
          stockInicial: toDecimal(stockInitial, 4),
          stockDisponible: toDecimal(availableUnits, 4),
          stockReservado: toDecimal(reservedUnits, 4),
          stockBloqueado: toDecimal(blockedUnits, 4),
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
        include: {
          sucursal: {
            select: {
              nombre: true,
            },
          },
          producto: {
            select: {
              nombre: true,
              sku: true,
            },
          },
          proveedor: {
            select: {
              razonSocial: true,
            },
          },
        },
      })

      await tx.movimientoInventario.create({
        data: {
          sucursalId: payload.sucursalId,
          productoId: payload.productoId,
          loteId: lot.id,
          motivoId: openingReason.id,
          tipo: TipoMovimientoInventario.ENTRADA,
          origen: OrigenMovimientoInventario.APERTURA,
          cantidad: toDecimal(stockInitial, 4),
          costoUnitario: toDecimal(Number(payload.costoUnitario), 6),
          stockResultante: toDecimal(stockInitial, 4),
          referencia: `Alta inicial lote ${lot.numeroLote}`,
          observaciones: toOptionalString(payload.observaciones),
          createdById: userId,
          updatedById: userId,
        },
      })

      if (reservedUnits > 0) {
        await tx.movimientoInventario.create({
          data: {
            sucursalId: payload.sucursalId,
            productoId: payload.productoId,
            loteId: lot.id,
            motivoId: reserveReason.id,
            tipo: TipoMovimientoInventario.RESERVA,
            origen: OrigenMovimientoInventario.APERTURA,
            cantidad: toDecimal(-reservedUnits, 4),
            costoUnitario: toDecimal(Number(payload.costoUnitario), 6),
            stockResultante: toDecimal(stockInitial - reservedUnits, 4),
            referencia: `Reserva inicial lote ${lot.numeroLote}`,
            createdById: userId,
            updatedById: userId,
          },
        })
      }

      if (blockedUnits > 0) {
        await tx.movimientoInventario.create({
          data: {
            sucursalId: payload.sucursalId,
            productoId: payload.productoId,
            loteId: lot.id,
            motivoId: blockReason.id,
            tipo: TipoMovimientoInventario.AJUSTE,
            origen: OrigenMovimientoInventario.APERTURA,
            cantidad: toDecimal(-blockedUnits, 4),
            costoUnitario: toDecimal(Number(payload.costoUnitario), 6),
            stockResultante: toDecimal(availableUnits, 4),
            referencia: `Bloqueo inicial lote ${lot.numeroLote}`,
            createdById: userId,
            updatedById: userId,
          },
        })
      }

      return {
        id: lot.id,
        productName: lot.producto.nombre,
        sku: lot.producto.sku,
        branchName: lot.sucursal.nombre,
        supplierName: lot.proveedor?.razonSocial ?? 'Sin proveedor',
        lotCode: lot.numeroLote,
        expiryDate: formatDate(lot.fechaVencimiento),
        availableUnits,
        reservedUnits,
        blockedUnits,
        unitCost: Number(payload.costoUnitario),
        status: lot.estado,
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

export async function adjustInventoryLot(
  payload: AdjustInventoryLotPayload,
  request: FastifyRequest,
) {
  const userId = await getAuthenticatedUserId(request)
  const quantity = Number(payload.quantity)

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw createHttpError(400, 'La cantidad del ajuste debe ser mayor a 0.')
  }

  const result = await prisma.$transaction(async (tx) => {
    const lot = await getLotForOperation(tx, payload.lotId)
    const currentAvailable = decimalToNumber(lot.stockDisponible)
    const currentReserved = decimalToNumber(lot.stockReservado)
    const currentBlocked = decimalToNumber(lot.stockBloqueado)
    let nextAvailable = currentAvailable
    let nextReserved = currentReserved
    let nextBlocked = currentBlocked
    let movementType: TipoMovimientoInventario = TipoMovimientoInventario.AJUSTE
    let signedQuantity: number = payload.operation === 'SUMAR' ? quantity : -quantity
    let reference: string = 'Ajuste manual de inventario'

    if (payload.target === 'DISPONIBLE') {
      nextAvailable =
        payload.operation === 'SUMAR'
          ? currentAvailable + quantity
          : currentAvailable - quantity

      if (nextAvailable < 0) {
        throw createHttpError(
          400,
          'El ajuste excede el stock disponible actual del lote.',
        )
      }

      movementType =
        payload.operation === 'SUMAR'
          ? TipoMovimientoInventario.ENTRADA
          : TipoMovimientoInventario.AJUSTE
      reference =
        payload.operation === 'SUMAR'
          ? `Ingreso manual lote ${lot.numeroLote}`
          : `Salida por ajuste lote ${lot.numeroLote}`
    }

    if (payload.target === 'RESERVADO') {
      if (payload.operation === 'SUMAR') {
        if (currentAvailable < quantity) {
          throw createHttpError(
            400,
            'No hay stock disponible suficiente para reservar esa cantidad.',
          )
        }

        nextAvailable = currentAvailable - quantity
        nextReserved = currentReserved + quantity
        movementType = TipoMovimientoInventario.RESERVA
        signedQuantity = -quantity
        reference = `Reserva operativa lote ${lot.numeroLote}`
      } else {
        if (currentReserved < quantity) {
          throw createHttpError(
            400,
            'No hay stock reservado suficiente para liberar esa cantidad.',
          )
        }

        nextReserved = currentReserved - quantity
        nextAvailable = currentAvailable + quantity
        movementType = TipoMovimientoInventario.LIBERACION
        signedQuantity = quantity
        reference = `Liberación de reserva lote ${lot.numeroLote}`
      }
    }

    if (payload.target === 'BLOQUEADO') {
      if (payload.operation === 'SUMAR') {
        if (currentAvailable < quantity) {
          throw createHttpError(
            400,
            'No hay stock disponible suficiente para bloquear esa cantidad.',
          )
        }

        nextAvailable = currentAvailable - quantity
        nextBlocked = currentBlocked + quantity
        movementType = TipoMovimientoInventario.AJUSTE
        signedQuantity = -quantity
        reference = `Bloqueo operativo lote ${lot.numeroLote}`
      } else {
        if (currentBlocked < quantity) {
          throw createHttpError(
            400,
            'No hay stock bloqueado suficiente para liberar esa cantidad.',
          )
        }

        nextBlocked = currentBlocked - quantity
        nextAvailable = currentAvailable + quantity
        movementType = TipoMovimientoInventario.LIBERACION
        signedQuantity = quantity
        reference = `Liberación de bloqueo lote ${lot.numeroLote}`
      }
    }

    const reason = await ensureMovementReason(tx, userId, {
      code: `AJUSTE_${payload.target}_${payload.operation}`,
      name: `Ajuste ${payload.target.toLowerCase()} ${payload.operation.toLowerCase()}`,
      description: 'Movimiento operativo manual registrado desde el módulo de inventario.',
      type: movementType,
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
        stockDisponible: toDecimal(nextAvailable, 4),
        stockReservado: toDecimal(nextReserved, 4),
        stockBloqueado: toDecimal(nextBlocked, 4),
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
        tipo: movementType,
        origen: OrigenMovimientoInventario.AJUSTE,
        cantidad: toDecimal(signedQuantity, 4),
        costoUnitario: lot.costoUnitario,
        stockResultante: toDecimal(nextAvailable, 4),
        referencia: reference,
        observaciones: toOptionalString(payload.observaciones),
        createdById: userId,
        updatedById: userId,
      },
    })

    return buildLotResponse(tx, lot.id)
  })

  return {
    item: result,
  }
}

export async function transferInventoryLot(
  payload: TransferInventoryLotPayload,
  request: FastifyRequest,
) {
  const userId = await getAuthenticatedUserId(request)
  const quantity = Number(payload.quantity)

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw createHttpError(400, 'La cantidad a transferir debe ser mayor a 0.')
  }

  const result = await prisma.$transaction(async (tx) => {
    const sourceLot = await getLotForOperation(tx, payload.lotId)
    const sourceAvailable = decimalToNumber(sourceLot.stockDisponible)

    if (payload.destinationBranchId === sourceLot.sucursalId) {
      throw createHttpError(
        400,
        'La sucursal destino debe ser distinta de la sucursal origen.',
      )
    }

    if (sourceAvailable < quantity) {
      throw createHttpError(
        400,
        'No hay stock disponible suficiente en el lote para transferir esa cantidad.',
      )
    }

    const destinationBranch = await tx.sucursal.findFirst({
      where: {
        id: payload.destinationBranchId,
        deletedAt: null,
        activo: true,
      },
      select: {
        id: true,
        nombre: true,
      },
    })

    if (!destinationBranch) {
      throw createHttpError(404, 'La sucursal destino no está disponible.')
    }

    const transferReason = await ensureMovementReason(tx, userId, {
      code: 'TRANSFERENCIA_LOTE',
      name: 'Transferencia de lote',
      description: 'Movimiento entre sucursales registrado desde el módulo de inventario.',
      type: TipoMovimientoInventario.TRANSFERENCIA,
    })

    const nextSourceAvailable = sourceAvailable - quantity
    const sourceStatus = resolveLotStatus({
      expiryDate: sourceLot.fechaVencimiento,
      availableUnits: nextSourceAvailable,
      reservedUnits: decimalToNumber(sourceLot.stockReservado),
      blockedUnits: decimalToNumber(sourceLot.stockBloqueado),
    })

    await tx.lote.update({
      where: {
        id: sourceLot.id,
      },
      data: {
        stockDisponible: toDecimal(nextSourceAvailable, 4),
        estado: sourceStatus,
        updatedById: userId,
      },
    })

    await upsertInventoryWarehouse(tx, {
      branchId: payload.destinationBranchId,
      productId: sourceLot.productoId,
      userId,
      warehouseName: payload.destinationWarehouse,
    })

    const destinationLot = await tx.lote.upsert({
      where: {
        sucursalId_productoId_numeroLote: {
          sucursalId: payload.destinationBranchId,
          productoId: sourceLot.productoId,
          numeroLote: sourceLot.numeroLote,
        },
      },
      update: {
        proveedorId: sourceLot.proveedorId ?? undefined,
        fechaFabricacion: sourceLot.fechaFabricacion ?? undefined,
        fechaVencimiento: sourceLot.fechaVencimiento,
        costoUnitario: sourceLot.costoUnitario,
        stockInicial: {
          increment: toDecimal(quantity, 4),
        },
        stockDisponible: {
          increment: toDecimal(quantity, 4),
        },
        estado: resolveLotStatus({
          expiryDate: sourceLot.fechaVencimiento,
          availableUnits: quantity,
          reservedUnits: 0,
          blockedUnits: 0,
        }),
        observaciones:
          toOptionalString(payload.observaciones) ?? sourceLot.observaciones ?? undefined,
        updatedById: userId,
      },
      create: {
        sucursalId: payload.destinationBranchId,
        productoId: sourceLot.productoId,
        proveedorId: sourceLot.proveedorId ?? undefined,
        numeroLote: sourceLot.numeroLote,
        fechaFabricacion: sourceLot.fechaFabricacion ?? undefined,
        fechaVencimiento: sourceLot.fechaVencimiento,
        costoUnitario: sourceLot.costoUnitario,
        stockInicial: toDecimal(quantity, 4),
        stockDisponible: toDecimal(quantity, 4),
        stockReservado: toDecimal(0, 4),
        stockBloqueado: toDecimal(0, 4),
        estado: resolveLotStatus({
          expiryDate: sourceLot.fechaVencimiento,
          availableUnits: quantity,
          reservedUnits: 0,
          blockedUnits: 0,
        }),
        observaciones:
          toOptionalString(payload.observaciones) ?? sourceLot.observaciones ?? undefined,
        createdById: userId,
        updatedById: userId,
      },
      select: {
        id: true,
      },
    })

    const updatedDestinationLot = await tx.lote.findUniqueOrThrow({
      where: {
        id: destinationLot.id,
      },
      select: {
        stockDisponible: true,
        stockReservado: true,
        stockBloqueado: true,
        fechaVencimiento: true,
      },
    })

    const destinationStatus = resolveLotStatus({
      expiryDate: updatedDestinationLot.fechaVencimiento,
      availableUnits: decimalToNumber(updatedDestinationLot.stockDisponible),
      reservedUnits: decimalToNumber(updatedDestinationLot.stockReservado),
      blockedUnits: decimalToNumber(updatedDestinationLot.stockBloqueado),
    })

    await tx.lote.update({
      where: {
        id: destinationLot.id,
      },
      data: {
        estado: destinationStatus,
        updatedById: userId,
      },
    })

    const transferReference = `Transferencia ${sourceLot.numeroLote} a ${destinationBranch.nombre}`

    await tx.movimientoInventario.createMany({
      data: [
        {
          sucursalId: sourceLot.sucursalId,
          productoId: sourceLot.productoId,
          loteId: sourceLot.id,
          motivoId: transferReason.id,
          tipo: TipoMovimientoInventario.TRANSFERENCIA,
          origen: OrigenMovimientoInventario.TRANSFERENCIA,
          cantidad: toDecimal(-quantity, 4),
          costoUnitario: sourceLot.costoUnitario,
          stockResultante: toDecimal(nextSourceAvailable, 4),
          referencia: transferReference,
          observaciones: toOptionalString(payload.observaciones),
          createdById: userId,
          updatedById: userId,
        },
        {
          sucursalId: payload.destinationBranchId,
          productoId: sourceLot.productoId,
          loteId: destinationLot.id,
          motivoId: transferReason.id,
          tipo: TipoMovimientoInventario.TRANSFERENCIA,
          origen: OrigenMovimientoInventario.TRANSFERENCIA,
          cantidad: toDecimal(quantity, 4),
          costoUnitario: sourceLot.costoUnitario,
          stockResultante: updatedDestinationLot.stockDisponible,
          referencia: `Transferencia ${sourceLot.numeroLote} desde ${sourceLot.sucursal.nombre}`,
          observaciones: toOptionalString(payload.observaciones),
          createdById: userId,
          updatedById: userId,
        },
      ],
    })

    return buildLotResponse(tx, sourceLot.id)
  })

  return {
    item: result,
  }
}
