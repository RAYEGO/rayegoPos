import { EstadoCompra, TipoComprobante } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  createPurchaseOrder,
  getPurchaseDashboard,
  registerPurchasePayment,
  receivePurchaseItem,
  returnPurchaseItem,
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

const receivePurchaseItemSchema = z.object({
  detalleCompraId: z.string().uuid(),
  numeroLote: z.string().min(1).max(80),
  fechaFabricacion: z.string().optional(),
  fechaVencimiento: z.string(),
  cantidadRecibida: z.number().positive(),
  stockReservado: z.number().min(0).optional(),
  stockBloqueado: z.number().min(0).optional(),
  almacen: z.string().max(120).optional(),
  observaciones: z.string().max(255).optional(),
})

const returnPurchaseItemSchema = z.object({
  lotId: z.string().uuid(),
  target: z.enum(['DISPONIBLE', 'RESERVADO', 'BLOQUEADO']),
  quantity: z.number().positive(),
  observaciones: z.string().max(255).optional(),
})

const registerPurchasePaymentSchema = z.object({
  compraId: z.string().uuid(),
  formaPagoId: z.string().uuid(),
  monto: z.number().positive(),
  fechaPago: z.string().optional(),
  referenciaExterna: z.string().max(120).optional(),
  observaciones: z.string().max(255).optional(),
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

  app.post('/receipts', async (request) => {
    const body = receivePurchaseItemSchema.parse(request.body)
    return receivePurchaseItem(body, request)
  })

  app.post('/returns', async (request) => {
    const body = returnPurchaseItemSchema.parse(request.body)
    return returnPurchaseItem(body, request)
  })

  app.post('/payments', async (request) => {
    const body = registerPurchasePaymentSchema.parse(request.body)
    return registerPurchasePayment(body, request)
  })
}
