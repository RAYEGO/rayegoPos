import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { EmpaqueProducto } from '@prisma/client'
import {
  createInitialInventoryLoad,
  getInitialInventoryLoads,
} from '../modules/implementation/implementation.service.js'

const createInitialInventoryLoadSchema = z.object({
  items: z
    .array(
      z.object({
        productoId: z.string().uuid(),
        numeroLote: z.string().min(2).max(80),
        fechaVencimiento: z.string().min(1),
        costoUnitario: z.number().nonnegative(),
        empaque: z.nativeEnum(EmpaqueProducto),
        cantidad: z.number().int().positive(),
      }),
    )
    .min(1),
})

export async function implementationRoutes(app: FastifyInstance) {
  app.get('/initial-inventory-loads', async (request) => {
    return getInitialInventoryLoads(request)
  })

  app.post('/initial-inventory-loads', async (request) => {
    const body = createInitialInventoryLoadSchema.parse(request.body)
    return createInitialInventoryLoad(body, request)
  })
}
