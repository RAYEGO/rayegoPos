import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getDashboardOverview } from '../modules/dashboard/dashboard.service.js'

const dashboardOverviewQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
})

export default async function dashboardRoutes(app: FastifyInstance) {
  app.get('/overview', async (request) => {
    const query = dashboardOverviewQuerySchema.parse(request.query)
    return getDashboardOverview({ branchId: query.branchId }, request)
  })
}

