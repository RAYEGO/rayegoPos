import {
  EstadoLote,
  EmpaqueProducto,
  EstadoProducto,
  ModoEmpaqueProducto,
  Prisma,
  TipoMovimientoInventario,
  OrigenMovimientoInventario,
} from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { getAuthContext } from '../../lib/auth.js'
import { IMPLEMENTATION_MESSAGES } from '../../shared/implementation/messages.js'

function createHttpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number }
  error.statusCode = statusCode
  return error
}

function toDecimal(value: number, fractionDigits: number) {
  return new Prisma.Decimal(value.toFixed(fractionDigits))
}

function formatFullName(user: { nombres: string; apellidos: string | null }) {
  return `${user.nombres} ${user.apellidos ?? ''}`.trim()
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

function assertAdmin(request: FastifyRequest) {
  const roles = request.auth?.roles ?? []
  if (!roles.includes('ADMIN')) {
    throw createHttpError(403, 'No tienes permisos para acceder a esta sección.')
  }
}

type ImplementationInventoryLoadItemInput = {
  productoId: string
  numeroLote: string
  fechaVencimiento: string
  costoUnitario: number
  empaque: EmpaqueProducto
  cantidad: number
}

type InventoryInitialLoadPayload = {
  items: ImplementationInventoryLoadItemInput[]
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

function parseExpiryDate(value: string) {
  const normalized = value.trim()
  if (!normalized) {
    throw createHttpError(400, 'La fecha de vencimiento es obligatoria.')
  }

  const parsed = new Date(`${normalized}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    throw createHttpError(400, 'La fecha de vencimiento no es válida.')
  }

  return parsed
}

function normalizeLotCode(value: string) {
  const normalized = value.trim()
  if (normalized.length < 2) {
    throw createHttpError(400, 'El número de lote debe tener al menos 2 caracteres.')
  }
  if (normalized.length > 80) {
    throw createHttpError(400, 'El número de lote no puede superar 80 caracteres.')
  }
  return normalized
}

function lotAlreadyExistsMessage() {
  return IMPLEMENTATION_MESSAGES.LOT_ALREADY_EXISTS
}

export async function getInitialInventoryLoads(request: FastifyRequest) {
  const { branchId } = await getAuthContext(request)
  assertAdmin(request)

  const loads = await prisma.cargaInventarioInicial.findMany({
    where: {
      deletedAt: null,
      sucursalId: branchId,
    },
    include: {
      sucursal: {
        select: {
          nombre: true,
        },
      },
      createdBy: {
        select: {
          nombres: true,
          apellidos: true,
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }],
  })

  return {
    rows: loads.map((load) => ({
      id: load.id,
      createdAt: load.createdAt.toISOString(),
      branchName: load.sucursal.nombre,
      productsLoaded: load.productosCargados,
      lotsCreated: load.lotesCreados,
      responsibleName: load.createdBy ? formatFullName(load.createdBy) : 'Sistema',
      status: load.estado,
    })),
  }
}

export async function createInitialInventoryLoad(
  payload: InventoryInitialLoadPayload,
  request: FastifyRequest,
) {
  const { userId, branchId, companyId } = await getAuthContext(request)
  assertAdmin(request)

  if (!payload.items.length) {
    throw createHttpError(400, 'Registra al menos un lote para cargar inventario.')
  }

  const uniqueProducts = new Set(payload.items.map((item) => item.productoId))

  type LoadWithRelations = Prisma.CargaInventarioInicialGetPayload<{
    include: {
      sucursal: { select: { nombre: true } }
      createdBy: { select: { nombres: true; apellidos: true } }
    }
  }>

  let result: LoadWithRelations

  try {
    result = await prisma.$transaction(async (tx) => {
      const productIds = [...uniqueProducts]
      const products = await tx.producto.findMany({
        where: {
          id: { in: productIds },
          empresaId: companyId,
          deletedAt: null,
        },
        select: {
          id: true,
          estado: true,
          modoEmpaque: true,
          unidadesPorBlister: true,
          blistersPorCaja: true,
        },
      })
      const productById = new Map(products.map((product) => [product.id, product]))

      if (products.length !== productIds.length) {
        throw createHttpError(404, IMPLEMENTATION_MESSAGES.PRODUCT_NOT_FOUND)
      }

      const payloadLots = new Set<string>()
      for (const item of payload.items) {
        const lotCode = normalizeLotCode(item.numeroLote)
        const key = `${item.productoId}:${lotCode}`
        if (payloadLots.has(key)) {
          throw createHttpError(409, lotAlreadyExistsMessage())
        }
        payloadLots.add(key)

        const existingLot = await tx.lote.findFirst({
          where: {
            deletedAt: null,
            sucursalId: branchId,
            productoId: item.productoId,
            numeroLote: lotCode,
          },
          select: { id: true },
        })

        if (existingLot) {
          throw createHttpError(409, lotAlreadyExistsMessage())
        }
      }

      const reason = await ensureMovementReason(tx, userId, {
        code: 'INVENTARIO_INICIAL',
        name: 'Inventario inicial',
        description: 'Carga inicial de inventario durante la implementación del sistema.',
        type: TipoMovimientoInventario.ENTRADA,
      })

      const load = await tx.cargaInventarioInicial.create({
        data: {
          sucursalId: branchId,
          estado: 'COMPLETADA',
          productosCargados: uniqueProducts.size,
          lotesCreados: payload.items.length,
          createdById: userId,
          updatedById: userId,
        },
        include: {
          sucursal: {
            select: {
              nombre: true,
            },
          },
          createdBy: {
            select: {
              nombres: true,
              apellidos: true,
            },
          },
        },
      })

      for (const item of payload.items) {
        const requestedQuantity = Math.floor(item.cantidad)
        if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
          throw createHttpError(400, 'La cantidad debe ser un entero mayor a 0.')
        }

        const product = productById.get(item.productoId) ?? null
        if (!product) {
          throw createHttpError(404, IMPLEMENTATION_MESSAGES.PRODUCT_NOT_FOUND)
        }

        if (product.estado !== EstadoProducto.ACTIVO) {
          throw createHttpError(400, IMPLEMENTATION_MESSAGES.PRODUCT_INACTIVE)
        }

        const packType = item.empaque
        const unitsPerBlister = product.unidadesPorBlister ?? null
        const blistersPerBox = product.blistersPorCaja ?? null

        if (product.modoEmpaque === ModoEmpaqueProducto.SIMPLE) {
          if (packType !== EmpaqueProducto.UNIDAD) {
            throw createHttpError(400, IMPLEMENTATION_MESSAGES.INVALID_PRESENTATION)
          }
        } else if (product.modoEmpaque === ModoEmpaqueProducto.BLISTER) {
          if (
            packType === EmpaqueProducto.BLISTER &&
            (!unitsPerBlister || unitsPerBlister <= 0)
          ) {
            throw createHttpError(400, IMPLEMENTATION_MESSAGES.INVALID_PRESENTATION)
          }

          if (
            packType === EmpaqueProducto.CAJA &&
            (!unitsPerBlister || unitsPerBlister <= 0 || !blistersPerBox || blistersPerBox <= 0)
          ) {
            throw createHttpError(400, IMPLEMENTATION_MESSAGES.INVALID_PRESENTATION)
          }
        }

        const factor =
          product.modoEmpaque === ModoEmpaqueProducto.BLISTER
            ? packType === EmpaqueProducto.UNIDAD
              ? 1
              : packType === EmpaqueProducto.BLISTER
                ? Number(unitsPerBlister)
                : packType === EmpaqueProducto.CAJA
                  ? Number(unitsPerBlister) * Number(blistersPerBox)
                  : 1
            : 1

        const quantity = requestedQuantity * Number(factor)
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw createHttpError(400, 'La cantidad convertida no es válida.')
        }

        const costoUnitario = Number(item.costoUnitario)
        if (!Number.isFinite(costoUnitario) || costoUnitario < 0) {
          throw createHttpError(400, 'El costo unitario debe ser mayor o igual a 0.')
        }

        const expiryDate = parseExpiryDate(item.fechaVencimiento)
        const lotCode = normalizeLotCode(item.numeroLote)

        await tx.inventario.upsert({
          where: {
            sucursalId_productoId: {
              sucursalId: branchId,
              productoId: item.productoId,
            },
          },
          update: {},
          create: {
            sucursalId: branchId,
            productoId: item.productoId,
            ubicacion: null,
            createdById: userId,
            updatedById: userId,
          },
        })

        const lot = await tx.lote.create({
          data: {
            sucursalId: branchId,
            productoId: item.productoId,
            proveedorId: null,
            detalleCompraId: null,
            numeroLote: lotCode,
            fechaFabricacion: null,
            fechaVencimiento: expiryDate,
            costoUnitario: toDecimal(costoUnitario, 6),
            stockInicial: quantity,
            stockDisponible: quantity,
            stockReservado: 0,
            stockBloqueado: 0,
            estado: resolveLotStatus({
              expiryDate,
              availableUnits: quantity,
              reservedUnits: 0,
              blockedUnits: 0,
            }),
            observaciones: 'Carga inicial de inventario',
            createdById: userId,
            updatedById: userId,
          },
        })

        await tx.movimientoInventario.create({
          data: {
            sucursalId: branchId,
            productoId: item.productoId,
            loteId: lot.id,
            motivoId: reason.id,
            tipo: TipoMovimientoInventario.ENTRADA,
            origen: OrigenMovimientoInventario.INVENTARIO_INICIAL,
            fechaMovimiento: new Date(),
            cantidad: quantity,
            costoUnitario: toDecimal(costoUnitario, 6),
            stockResultante: quantity,
            referencia: `Carga inicial ${load.id}`,
            observaciones: 'Carga inicial de inventario',
            createdById: userId,
            updatedById: userId,
          },
        })

        await tx.cargaInventarioInicialDetalle.create({
          data: {
            cargaId: load.id,
            sucursalId: branchId,
            productoId: item.productoId,
            loteId: lot.id,
            numeroLote: lotCode,
            fechaVencimiento: expiryDate,
            costoUnitario: toDecimal(costoUnitario, 6),
            cantidad: quantity,
            createdById: userId,
            updatedById: userId,
          },
        })
      }

      return load
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw createHttpError(409, lotAlreadyExistsMessage())
    }

    throw err
  }

  return {
    item: {
      id: result.id,
      createdAt: result.createdAt.toISOString(),
      branchName: result.sucursal.nombre,
      productsLoaded: result.productosCargados,
      lotsCreated: result.lotesCreados,
      responsibleName: result.createdBy ? formatFullName(result.createdBy) : 'Sistema',
      status: result.estado,
    },
  }
}
