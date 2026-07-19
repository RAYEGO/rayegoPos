import { EstadoVenta, TipoComprobante } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { cancelSale, createSale, getSaleReceipt, getSalesDashboard } from '../modules/sales/sales.service.js'

const salesDashboardQuerySchema = z.object({
  search: z.string().optional(),
  branchId: z.string().uuid().optional(),
  status: z.nativeEnum(EstadoVenta).optional(),
})

const createSaleSchema = z.object({
  sucursalId: z.string().uuid(),
  clienteId: z.string().uuid().optional(),
  tipoComprobante: z.nativeEnum(TipoComprobante).optional(),
  observaciones: z.string().max(255).optional(),
  items: z
    .array(
      z.object({
        productoId: z.string().uuid(),
        cantidad: z.number().positive(),
        descuentoTotal: z.number().min(0).optional(),
      }),
    )
    .min(1),
  payments: z
    .array(
      z.object({
        formaPagoId: z.string().uuid(),
        monto: z.number().positive(),
        referenciaExterna: z.string().max(120).optional(),
        observaciones: z.string().max(255).optional(),
      }),
    )
    .min(1),
})

const cancelSaleSchema = z.object({
  observaciones: z.string().max(255).optional(),
})

export async function salesRoutes(app: FastifyInstance) {
  app.get('/dashboard', async (request) => {
    const query = salesDashboardQuerySchema.parse(request.query)

    return getSalesDashboard({
      search: query.search,
      branchId: query.branchId,
    })
  })

  app.post('/', async (request) => {
    const body = createSaleSchema.parse(request.body)
    return createSale(body, request)
  })

  app.get('/:id/receipt', async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params)
    return getSaleReceipt(params.id, request)
  })

  app.patch('/:id/cancel', async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = cancelSaleSchema.parse(request.body)
    return cancelSale(params.id, request, body.observaciones)
  })
}
