import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  createInitialInventoryLoad,
  getInitialInventoryLoads,
  purgeTestData,
} from '../modules/implementation/implementation.service.js'

const createInitialInventoryLoadSchema = z.object({
  items: z
    .array(
      z.object({
        productoId: z.string().uuid(),
        numeroLote: z.string().min(2).max(80),
        fechaVencimiento: z.string().min(1),
        costoUnitario: z.number().nonnegative(),
        cantidad: z.number().int().positive(),
      }),
    )
    .min(1),
})

const purgeTestDataSchema = z.object({
  confirmText: z.string().min(1).max(20),
})

export async function implementationRoutes(app: FastifyInstance) {
  app.get('/initial-inventory-loads', async (request) => {
    return getInitialInventoryLoads(request)
  })

  app.post('/initial-inventory-loads', async (request) => {
    const body = createInitialInventoryLoadSchema.parse(request.body)
    return createInitialInventoryLoad(body, request)
  })

  app.post('/purge-test-data', async (request) => {
    const body = purgeTestDataSchema.parse(request.body)
    return purgeTestData(body, request)
  })
}
