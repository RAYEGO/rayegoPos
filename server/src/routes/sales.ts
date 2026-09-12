import { EstadoVenta, TipoComprobante, TipoLineaVenta } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { cancelSale, createSale, getSaleReceipt, getSalesDashboard } from '../modules/sales/sales.service.js'

const salesDashboardQuerySchema = z.object({
  search: z.string().optional(),
  branchId: z.string().uuid().optional(),
  commercialTypeId: z.string().uuid().optional(),
  activePrincipleId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  availability: z.enum(['TODOS', 'CON_STOCK', 'SIN_STOCK']).optional(),
  status: z.nativeEnum(EstadoVenta).optional(),
})

const saleItemBaseSchema = z.object({
  cantidad: z.number().int().positive(),
  descuentoTotal: z.number().min(0).optional(),
})

const saleProductoRegistradoSchema = saleItemBaseSchema.extend({
  tipoLinea: z.literal(TipoLineaVenta.PRODUCTO_REGISTRADO),
  productoId: z.string().uuid(),
  presentacionId: z.string().uuid(),
})

const saleVentaRapidaSchema = saleItemBaseSchema.extend({
  tipoLinea: z.literal(TipoLineaVenta.VENTA_RAPIDA),
  descripcion: z.string().min(1).max(255),
  simboloUnidad: z.string().min(1).max(20),
  precioUnitario: z.number().positive(),
})

const saleBackwardsCompatibleSchema = saleItemBaseSchema.extend({
  tipoLinea: z.undefined().optional(),
  productoId: z.string().uuid(),
  presentacionId: z.string().uuid(),
}).transform((item) => ({
  ...item,
  tipoLinea: TipoLineaVenta.PRODUCTO_REGISTRADO,
}))

const createSaleItemSchema = z.union([
  saleVentaRapidaSchema,
  saleProductoRegistradoSchema,
  saleBackwardsCompatibleSchema,
]).pipe(z.discriminatedUnion('tipoLinea', [
  saleProductoRegistradoSchema,
  saleVentaRapidaSchema,
]))

const createSaleSchema = z.object({
  sucursalId: z.string().uuid().optional(),
  clienteId: z.string().uuid().optional(),
  tipoComprobante: z.nativeEnum(TipoComprobante).optional(),
  observaciones: z.string().max(255).optional(),
  items: z.array(createSaleItemSchema).min(1),
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
      commercialTypeId: query.commercialTypeId,
      activePrincipleId: query.activePrincipleId,
      categoryId: query.categoryId,
      availability: query.availability,
    }, request)
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
