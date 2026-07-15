import { EstadoLote } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  adjustInventoryLot,
  createInventoryLot,
  getInventoryDashboard,
  transferInventoryLot,
} from '../modules/inventory/inventory.service.js'

const inventoryDashboardQuerySchema = z.object({
  search: z.string().optional(),
  status: z.nativeEnum(EstadoLote).optional(),
  branchId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
})

const createInventoryLotSchema = z.object({
  sucursalId: z.string().uuid(),
  productoId: z.string().uuid(),
  proveedorId: z.string().uuid().optional(),
  numeroLote: z.string().min(2).max(80),
  fechaFabricacion: z.string().optional(),
  fechaVencimiento: z.string(),
  costoUnitario: z.number().nonnegative(),
  stockInicial: z.number().positive(),
  stockReservado: z.number().nonnegative().optional(),
  stockBloqueado: z.number().nonnegative().optional(),
  almacen: z.string().max(120).optional(),
  observaciones: z.string().max(255).optional(),
})

const adjustInventoryLotSchema = z.object({
  lotId: z.string().uuid(),
  target: z.enum(['DISPONIBLE', 'RESERVADO', 'BLOQUEADO']),
  operation: z.enum(['SUMAR', 'RESTAR']),
  quantity: z.number().positive(),
  observaciones: z.string().max(255).optional(),
})

const transferInventoryLotSchema = z.object({
  lotId: z.string().uuid(),
  destinationBranchId: z.string().uuid(),
  quantity: z.number().positive(),
  destinationWarehouse: z.string().max(120).optional(),
  observaciones: z.string().max(255).optional(),
})

export async function inventoryRoutes(app: FastifyInstance) {
  app.get('/dashboard', async (request) => {
    const query = inventoryDashboardQuerySchema.parse(request.query)
    return getInventoryDashboard(query)
  })

  app.post('/lots', async (request) => {
    const body = createInventoryLotSchema.parse(request.body)
    return createInventoryLot(body, request)
  })

  app.post('/lots/adjust', async (request) => {
    const body = adjustInventoryLotSchema.parse(request.body)
    return adjustInventoryLot(body, request)
  })

  app.post('/lots/transfer', async (request) => {
    const body = transferInventoryLotSchema.parse(request.body)
    return transferInventoryLot(body, request)
  })
}
