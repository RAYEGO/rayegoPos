import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  createProduct,
  getProductOptions,
  listProductCatalog,
} from '../modules/products/products.service.js'

const listProductsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ACTIVO', 'INACTIVO', 'DESCONTINUADO']).optional(),
  categoryId: z.string().uuid().optional(),
})

const createProductSchema = z.object({
  categoriaId: z.string().uuid(),
  laboratorioId: z.string().uuid().optional(),
  presentacionId: z.string().uuid().optional(),
  unidadMedidaId: z.string().uuid(),
  principioActivoId: z.string().uuid().optional(),
  sku: z.string().min(1).max(50),
  codigoInterno: z.string().max(50).optional(),
  codigoBarras: z.string().max(50).optional(),
  nombre: z.string().min(3).max(180),
  descripcion: z.string().max(500).optional(),
  concentracion: z.string().max(120).optional(),
  registroSanitario: z.string().max(100).optional(),
  requiereReceta: z.boolean().default(false),
  esControlado: z.boolean().default(false),
  precioVenta: z.number().nonnegative(),
  costoReferencia: z.number().nonnegative(),
  observaciones: z.string().max(500).optional(),
})

export async function productRoutes(app: FastifyInstance) {
  app.get('/', async (request) => {
    const query = listProductsQuerySchema.parse(request.query)
    return listProductCatalog(query)
  })

  app.get('/options', async () => getProductOptions())

  app.post('/', async (request) => {
    const body = createProductSchema.parse(request.body)
    return createProduct(body, request)
  })
}
