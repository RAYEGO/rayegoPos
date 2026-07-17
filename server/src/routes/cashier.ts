import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  closeCashDrawer,
  createCashMovement,
  getCashierDashboard,
  openCashDrawer,
} from '../modules/cashier/cashier.service.js'

const cashierDashboardQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
})

const openCashDrawerSchema = z.object({
  branchId: z.string().uuid(),
  openingAmount: z.number().positive(),
  observations: z.string().max(255).optional(),
})

const closeCashDrawerSchema = z.object({
  openingId: z.string().uuid(),
  countedAmount: z.number().positive(),
  observations: z.string().max(255).optional(),
})

const createCashMovementSchema = z.object({
  openingId: z.string().uuid(),
  type: z.enum(['INGRESO', 'EGRESO']),
  amount: z.number().positive(),
  concept: z.string().max(120),
  reference: z.string().max(120).optional(),
  observations: z.string().max(255).optional(),
})

export async function cashierRoutes(app: FastifyInstance) {
  app.get('/dashboard', async (request) => {
    const query = cashierDashboardQuerySchema.parse(request.query)
    return getCashierDashboard({
      branchId: query.branchId,
    })
  })

  app.post('/open', async (request) => {
    const body = openCashDrawerSchema.parse(request.body)
    return openCashDrawer(request, body)
  })

  app.post('/close', async (request) => {
    const body = closeCashDrawerSchema.parse(request.body)
    return closeCashDrawer(request, body)
  })

  app.post('/movement', async (request) => {
    const body = createCashMovementSchema.parse(request.body)
    return createCashMovement(request, body)
  })
}
