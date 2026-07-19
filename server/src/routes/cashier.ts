import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  closeCashDrawer,
  createCashCount,
  createCashMovement,
  getCashierDashboard,
  getCashCounts,
  getCashReconciliationPreview,
  saveCashReconciliation,
  openCashDrawer,
} from '../modules/cashier/cashier.service.js'

const cashierDashboardQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
})

const openCashDrawerSchema = z.object({
  branchId: z.string().uuid(),
  openingAmount: z.number().nonnegative(),
  observations: z.string().max(255).optional(),
})

const closeCashDrawerSchema = z.object({
  openingId: z.string().uuid(),
  countedAmount: z.number().nonnegative(),
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

const cashReconciliationPreviewQuerySchema = z.object({
  openingId: z.string().uuid(),
})

const cashReconciliationSchema = z.object({
  openingId: z.string().uuid(),
  counted: z.record(z.string().uuid(), z.number().nonnegative()),
  observations: z.string().max(255).optional(),
})

const cashCountSchema = z.object({
  openingId: z.string().uuid(),
  countedCashAmount: z.number().nonnegative(),
  observations: z.string().max(255).optional(),
})

const cashCountsQuerySchema = z.object({
  openingId: z.string().uuid(),
})

export async function cashierRoutes(app: FastifyInstance) {
  app.get('/dashboard', async (request) => {
    const query = cashierDashboardQuerySchema.parse(request.query)
    return getCashierDashboard(
      {
        branchId: query.branchId,
      },
      request,
    )
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

  app.get('/reconciliation/preview', async (request) => {
    const query = cashReconciliationPreviewQuerySchema.parse(request.query)
    return getCashReconciliationPreview(request, query)
  })

  app.post('/reconciliation', async (request) => {
    const body = cashReconciliationSchema.parse(request.body)
    return saveCashReconciliation(request, body)
  })

  app.post('/cash-count', async (request) => {
    const body = cashCountSchema.parse(request.body)
    return createCashCount(request, body)
  })

  app.get('/cash-counts', async (request) => {
    const query = cashCountsQuerySchema.parse(request.query)
    return getCashCounts(request, query)
  })
}
