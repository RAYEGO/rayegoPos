import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getReportsOverview } from '../modules/reports/reports.service.js'

const reportsOverviewQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

export default async function reportsRoutes(app: FastifyInstance) {
  app.get('/overview', async (request) => {
    const query = reportsOverviewQuerySchema.parse(request.query)
    return getReportsOverview(
      {
        branchId: query.branchId,
        from: query.from,
        to: query.to,
      },
      request,
    )
  })
}

