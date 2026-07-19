import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  getCashierReport,
  getCustomersReport,
  getInventoryReport,
  getProductsReport,
  getPurchasesReport,
  getReportsOverview,
  getSalesReport,
  getUtilitiesReport,
} from '../modules/reports/reports.service.js'

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

  app.get('/sales', async (request) => {
    const query = reportsOverviewQuerySchema.parse(request.query)
    return getSalesReport(query, request)
  })

  app.get('/purchases', async (request) => {
    const query = reportsOverviewQuerySchema.parse(request.query)
    return getPurchasesReport(query, request)
  })

  app.get('/inventory', async (request) => {
    const query = reportsOverviewQuerySchema.parse(request.query)
    return getInventoryReport(query, request)
  })

  app.get('/cashier', async (request) => {
    const query = reportsOverviewQuerySchema.parse(request.query)
    return getCashierReport(query, request)
  })

  app.get('/customers', async (request) => {
    const query = reportsOverviewQuerySchema.parse(request.query)
    return getCustomersReport(query, request)
  })

  app.get('/products', async (request) => {
    const query = reportsOverviewQuerySchema.parse(request.query)
    return getProductsReport(query, request)
  })

  app.get('/utilities', async (request) => {
    const query = reportsOverviewQuerySchema.parse(request.query)
    return getUtilitiesReport(query, request)
  })
}
