import { EstadoCompra, TipoComprobante } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  createPurchaseOrder,
  getPurchaseDashboard,
} from '../modules/purchases/purchases.service.js'

const purchaseDashboardQuerySchema = z.object({
  search: z.string().optional(),
  status: z.nativeEnum(EstadoCompra).optional(),
  branchId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
})

const createPurchaseOrderSchema = z.object({
  sucursalId: z.string().uuid(),
  proveedorId: z.string().uuid(),
  fechaEmision: z.string().optional(),
  fechaRecepcion: z.string().optional(),
  tipoComprobante: z.nativeEnum(TipoComprobante).optional(),
  serieComprobante: z.string().max(20).optional(),
  numeroComprobante: z.string().max(30).optional(),
  estado: z.enum([EstadoCompra.BORRADOR, EstadoCompra.REGISTRADA]),
  observaciones: z.string().max(255).optional(),
  items: z
    .array(
      z.object({
        productoId: z.string().uuid(),
        cantidad: z.number().positive(),
        costoUnitario: z.number().nonnegative(),
        porcentajeImpuesto: z.number().min(0).max(100).optional(),
      }),
    )
    .min(1),
})

export async function purchaseRoutes(app: FastifyInstance) {
  app.get('/dashboard', async (request) => {
    const query = purchaseDashboardQuerySchema.parse(request.query)
    return getPurchaseDashboard(query)
  })

  app.post('/orders', async (request) => {
    const body = createPurchaseOrderSchema.parse(request.body)
    return createPurchaseOrder(body, request)
  })
}
