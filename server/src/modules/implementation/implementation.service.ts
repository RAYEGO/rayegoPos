import {
  EstadoLote,
  EstadoProducto,
  Prisma,
  TipoMovimientoInventario,
  OrigenMovimientoInventario,
} from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { getAuthContext } from '../../lib/auth.js'
import { IMPLEMENTATION_MESSAGES } from '../../shared/implementation/messages.js'
import {
  convertAmountToBaseUnit,
  convertQuantityToBaseUnits,
  resolvePackagingOperationContext,
} from '../../lib/productPackaging.js'

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

async function assertCompanyInImplementationMode(companyId: string) {
  const company = await prisma.empresa.findFirst({
    where: {
      id: companyId,
      deletedAt: null,
    },
    select: {
      modoOperacion: true,
    },
  })

  if (!company) {
    throw createHttpError(404, 'La empresa no está disponible.')
  }

  if (company.modoOperacion !== 'IMPLEMENTACION') {
    throw createHttpError(
      409,
      [
        'Esta herramienta solo está disponible mientras la empresa se encuentre en modo IMPLEMENTACIÓN.',
        'La empresa ya se encuentra en modo PRODUCCIÓN.',
      ].join('\n\n'),
    )
  }
}

type ImplementationInventoryLoadItemInput = {
  productoId: string
  numeroLote: string
  fechaVencimiento: string
  costoUnitario: number
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
  await assertCompanyInImplementationMode(companyId)

  if (!payload.items.length) {
    throw createHttpError(400, 'Registra al menos un lote para cargar inventario.')
  }

  const normalizedItems = payload.items.map((item) => {
    const requestedQuantity = Math.floor(item.cantidad)
    if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
      throw createHttpError(400, 'La cantidad debe ser un entero mayor a 0.')
    }

    const requestedUnitCost = Number(item.costoUnitario)
    if (!Number.isFinite(requestedUnitCost) || requestedUnitCost < 0) {
      throw createHttpError(400, 'El costo unitario debe ser mayor o igual a 0.')
    }

    return {
      ...item,
      requestedQuantity,
      requestedUnitCost,
      lotCode: normalizeLotCode(item.numeroLote),
      expiryDate: parseExpiryDate(item.fechaVencimiento),
    }
  })

  const uniqueProducts = new Set(normalizedItems.map((item) => item.productoId))

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
          compraPresentacionId: true,
          presentacionesEmpaque: {
            where: { deletedAt: null },
            select: {
              esBase: true,
              permiteCompra: true,
              permiteVenta: true,
              precioVenta: true,
              presentacion: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
          conversionesEmpaque: {
            where: { deletedAt: null },
            select: {
              desdePresentacionId: true,
              haciaPresentacionId: true,
              cantidad: true,
            },
          },
        },
      })
      const productById = new Map(products.map((product) => [product.id, product]))

      if (products.length !== productIds.length) {
        throw createHttpError(404, IMPLEMENTATION_MESSAGES.PRODUCT_NOT_FOUND)
      }

      const payloadLots = new Set<string>()
      for (const item of normalizedItems) {
        const key = `${item.productoId}:${item.lotCode}`
        if (payloadLots.has(key)) {
          throw createHttpError(409, lotAlreadyExistsMessage())
        }
        payloadLots.add(key)
      }

      const existingLots = await tx.lote.findMany({
        where: {
          deletedAt: null,
          sucursalId: branchId,
          productoId: { in: productIds },
        },
        select: {
          productoId: true,
          numeroLote: true,
        },
      })

      const existingLotKeys = new Set(
        existingLots.map((lot) => `${lot.productoId}:${normalizeLotCode(lot.numeroLote)}`),
      )

      for (const item of normalizedItems) {
        const key = `${item.productoId}:${item.lotCode}`
        if (existingLotKeys.has(key)) {
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
          lotesCreados: normalizedItems.length,
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

      for (const item of normalizedItems) {
        const product = productById.get(item.productoId) ?? null
        if (!product) {
          throw createHttpError(404, IMPLEMENTATION_MESSAGES.PRODUCT_NOT_FOUND)
        }

        if (product.estado !== EstadoProducto.ACTIVO) {
          throw createHttpError(400, IMPLEMENTATION_MESSAGES.PRODUCT_INACTIVE)
        }

        const purchasePresentationId =
          product.compraPresentacionId ??
          product.presentacionesEmpaque.find((entry) => entry.esBase)?.presentacion.id ??
          ''

        const packagingContext = resolvePackagingOperationContext({
          operation: 'INVENTORY_IN',
          presentationId: purchasePresentationId,
          presentations: product.presentacionesEmpaque ?? [],
          conversions: product.conversionesEmpaque ?? [],
          unresolvedFactorMessage:
            'No fue posible resolver la equivalencia para la presentación principal de compra.',
        })

        if (!packagingContext.ok) {
          throw createHttpError(400, packagingContext.error)
        }

        const quantity = convertQuantityToBaseUnits({
          quantity: item.requestedQuantity,
          factorToBase: packagingContext.factorToBase,
        })
        if (quantity === null) {
          throw createHttpError(400, 'La cantidad convertida no es válida.')
        }

        const costoUnitario = convertAmountToBaseUnit({
          amount: item.requestedUnitCost,
          factorToBase: packagingContext.factorToBase,
        })
        if (costoUnitario === null) {
          throw createHttpError(400, 'No fue posible calcular el costo unitario en unidad base.')
        }

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
            numeroLote: item.lotCode,
            fechaFabricacion: null,
            fechaVencimiento: item.expiryDate,
            costoUnitario: toDecimal(costoUnitario, 6),
            stockInicial: quantity,
            stockDisponible: quantity,
            stockReservado: 0,
            stockBloqueado: 0,
            estado: resolveLotStatus({
              expiryDate: item.expiryDate,
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
            numeroLote: item.lotCode,
            fechaVencimiento: item.expiryDate,
            costoUnitario: toDecimal(costoUnitario, 6),
            cantidad: quantity,
            createdById: userId,
            updatedById: userId,
          },
        })
      }

      return load
    }, { maxWait: 10_000, timeout: 60_000 })
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

type PurgeTestDataPayload = {
  confirmText: string
}

export async function purgeTestData(payload: PurgeTestDataPayload, request: FastifyRequest) {
  const { companyId } = await getAuthContext(request)
  assertAdmin(request)
  await assertCompanyInImplementationMode(companyId)

  const normalizedConfirm = payload.confirmText.trim().toUpperCase()
  if (normalizedConfirm !== 'ELIMINAR') {
    throw createHttpError(400, 'La confirmación no es válida. Escribe ELIMINAR para continuar.')
  }

  const branches = await prisma.sucursal.findMany({
    where: {
      empresaId: companyId,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  })

  const branchIds = branches.map((branch) => branch.id)

  const deleted = await prisma.$transaction(async (tx) => {
    const salesDetailsLots = await tx.detalleVentaLote.deleteMany({
      where: {
        detalleVenta: {
          venta: {
            sucursalId: { in: branchIds },
          },
        },
      },
    })
    const salesDetails = await tx.detalleVenta.deleteMany({
      where: {
        venta: {
          sucursalId: { in: branchIds },
        },
      },
    })
    const salesPayments = await tx.ventaPago.deleteMany({
      where: {
        venta: {
          sucursalId: { in: branchIds },
        },
      },
    })
    const sales = await tx.venta.deleteMany({
      where: {
        sucursalId: { in: branchIds },
      },
    })

    const purchasePayments = await tx.compraPago.deleteMany({
      where: {
        compra: {
          sucursalId: { in: branchIds },
        },
      },
    })
    const purchaseReceipts = await tx.compraRecepcion.deleteMany({
      where: {
        compra: {
          sucursalId: { in: branchIds },
        },
      },
    })
    const purchaseDetails = await tx.detalleCompra.deleteMany({
      where: {
        compra: {
          sucursalId: { in: branchIds },
        },
      },
    })
    const purchases = await tx.compra.deleteMany({
      where: {
        sucursalId: { in: branchIds },
      },
    })

    const cashReconciliationDetails = await tx.conciliacionCajaDetalle.deleteMany({
      where: {
        conciliacionCaja: {
          aperturaCaja: {
            caja: {
              sucursalId: { in: branchIds },
            },
          },
        },
      },
    })
    const cashReconciliations = await tx.conciliacionCaja.deleteMany({
      where: {
        aperturaCaja: {
          caja: {
            sucursalId: { in: branchIds },
          },
        },
      },
    })
    const cashCounts = await tx.arqueoCaja.deleteMany({
      where: {
        aperturaCaja: {
          caja: {
            sucursalId: { in: branchIds },
          },
        },
      },
    })
    const cashClosings = await tx.cierreCaja.deleteMany({
      where: {
        aperturaCaja: {
          caja: {
            sucursalId: { in: branchIds },
          },
        },
      },
    })
    const cashIncomes = await tx.ingreso.deleteMany({
      where: {
        movimientoCaja: {
          aperturaCaja: {
            caja: {
              sucursalId: { in: branchIds },
            },
          },
        },
      },
    })
    const cashExpenses = await tx.egreso.deleteMany({
      where: {
        movimientoCaja: {
          aperturaCaja: {
            caja: {
              sucursalId: { in: branchIds },
            },
          },
        },
      },
    })
    const cashMovements = await tx.movimientoCaja.deleteMany({
      where: {
        aperturaCaja: {
          caja: {
            sucursalId: { in: branchIds },
          },
        },
      },
    })
    const cashOpenings = await tx.aperturaCaja.deleteMany({
      where: {
        caja: {
          sucursalId: { in: branchIds },
        },
      },
    })

    const inventoryMovements = await tx.movimientoInventario.deleteMany({
      where: {
        sucursalId: { in: branchIds },
      },
    })

    const initialLoadDetails = await tx.cargaInventarioInicialDetalle.deleteMany({
      where: {
        sucursalId: { in: branchIds },
      },
    })
    const initialLoads = await tx.cargaInventarioInicial.deleteMany({
      where: {
        sucursalId: { in: branchIds },
      },
    })

    const inventories = await tx.inventario.deleteMany({
      where: {
        sucursalId: { in: branchIds },
      },
    })

    const lots = await tx.lote.deleteMany({
      where: {
        sucursalId: { in: branchIds },
      },
    })

    const productActivePrinciples = await tx.productoPrincipioActivo.deleteMany({
      where: {
        producto: {
          empresaId: companyId,
        },
      },
    })
    const productTaxes = await tx.productoImpuesto.deleteMany({
      where: {
        producto: {
          empresaId: companyId,
        },
      },
    })
    const products = await tx.producto.deleteMany({
      where: {
        empresaId: companyId,
      },
    })

    const categories = await tx.categoria.deleteMany({
      where: {
        empresaId: companyId,
      },
    })
    const laboratories = await tx.laboratorio.deleteMany({
      where: {
        empresaId: companyId,
      },
    })
    const presentations = await tx.presentacion.deleteMany({
      where: {
        empresaId: companyId,
      },
    })
    const units = await tx.unidadMedida.deleteMany({
      where: {
        empresaId: companyId,
      },
    })

    const customers = await tx.cliente.deleteMany({
      where: {
        empresaId: companyId,
      },
    })
    const suppliers = await tx.proveedor.deleteMany({
      where: {
        empresaId: companyId,
      },
    })

    return {
      ventas: sales.count,
      ventasDetalles: salesDetails.count,
      ventasDetallesLotes: salesDetailsLots.count,
      ventasPagos: salesPayments.count,
      compras: purchases.count,
      comprasDetalles: purchaseDetails.count,
      comprasRecepciones: purchaseReceipts.count,
      comprasPagos: purchasePayments.count,
      cajaMovimientos: cashMovements.count,
      cajaIngresos: cashIncomes.count,
      cajaEgresos: cashExpenses.count,
      cajaAperturas: cashOpenings.count,
      cajaCierres: cashClosings.count,
      cajaConciliaciones: cashReconciliations.count,
      cajaConciliacionesDetalle: cashReconciliationDetails.count,
      cajaArqueos: cashCounts.count,
      inventarioMovimientos: inventoryMovements.count,
      inventarioInicialCargas: initialLoads.count,
      inventarioInicialDetalle: initialLoadDetails.count,
      inventarios: inventories.count,
      lotes: lots.count,
      productos: products.count,
      productosPrincipiosActivos: productActivePrinciples.count,
      productosImpuestos: productTaxes.count,
      categorias: categories.count,
      laboratorios: laboratories.count,
      presentaciones: presentations.count,
      unidadesMedida: units.count,
      clientes: customers.count,
      proveedores: suppliers.count,
    }
  })

  return { success: true, deleted }
}
