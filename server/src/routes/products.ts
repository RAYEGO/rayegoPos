import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { EstadoProducto, ModoEmpaqueProducto } from '@prisma/client'
import {
  createProduct,
  deleteProduct,
  getProductOptions,
  listProductCatalog,
  updateProduct,
  updateProductStatus,
  listMasterCategories,
  createMasterCategory,
  updateMasterCategory,
  deleteMasterCategory,
  listMasterLaboratories,
  createMasterLaboratory,
  updateMasterLaboratory,
  deleteMasterLaboratory,
  listMasterPresentations,
  createMasterPresentation,
  updateMasterPresentation,
  deleteMasterPresentation,
  listMasterUnits,
  createMasterUnit,
  updateMasterUnit,
  deleteMasterUnit,
} from '../modules/products/products.service.js'

const listProductsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ACTIVO', 'INACTIVO', 'DESCONTINUADO']).optional(),
  categoryId: z.string().uuid().optional(),
  laboratoryId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  sortBy: z.enum(['name', 'stockUnits', 'createdAt']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
})

const createProductSchema = z.object({
  categoriaId: z.string().uuid(),
  laboratorioId: z.string().uuid().optional(),
  presentacionId: z.string().uuid().optional(),
  unidadMedidaId: z.string().uuid(),
  modoEmpaque: z.nativeEnum(ModoEmpaqueProducto).optional(),
  unidadesPorBlister: z.number().int().positive().optional(),
  blistersPorCaja: z.number().int().positive().optional(),
  precioVentaBlister: z.number().nonnegative().optional(),
  principioActivoId: z.string().uuid().optional(),
  sku: z.string().min(1).max(50),
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

const updateProductStatusSchema = z.object({
  status: z.nativeEnum(EstadoProducto),
})

const masterCategorySchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  codigo: z.string().min(1).max(30).optional(),
  nombre: z.string().min(2).max(120),
  descripcion: z.string().max(255).optional(),
  color: z.string().max(20).optional(),
  orden: z.number().int().nonnegative().optional(),
  activo: z.boolean().optional(),
})

const masterLaboratorySchema = z.object({
  nombre: z.string().min(2).max(150),
  pais: z.string().max(80).optional(),
  descripcion: z.string().max(255).optional(),
  activo: z.boolean().optional(),
})

const masterPresentationSchema = z.object({
  nombre: z.string().min(2).max(120),
  descripcion: z.string().max(255).optional(),
  activo: z.boolean().optional(),
})

const masterUnitSchema = z.object({
  codigo: z.string().min(1).max(20).optional(),
  nombre: z.string().min(2).max(80),
  simbolo: z.string().min(1).max(20),
  descripcion: z.string().max(255).optional(),
  activo: z.boolean().optional(),
})

export async function productRoutes(app: FastifyInstance) {
  app.get('/', async (request) => {
    const query = listProductsQuerySchema.parse(request.query)
    try {
      return await listProductCatalog(query, request)
    } catch (error) {
      request.log.error({ error, query }, 'products:list failed')
      throw error
    }
  })

  app.get('/options', async (request) => getProductOptions(request))

  app.get('/masters/categories', async (request) => listMasterCategories(request))

  app.post('/masters/categories', async (request) => {
    const body = masterCategorySchema.parse(request.body)
    return createMasterCategory(body, request)
  })

  app.patch('/masters/categories/:id', async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = masterCategorySchema.parse(request.body)
    return updateMasterCategory(params.id, body, request)
  })

  app.delete('/masters/categories/:id', async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params)
    return deleteMasterCategory(params.id, request)
  })

  app.get('/masters/laboratories', async (request) => listMasterLaboratories(request))

  app.post('/masters/laboratories', async (request) => {
    const body = masterLaboratorySchema.parse(request.body)
    return createMasterLaboratory(body, request)
  })

  app.patch('/masters/laboratories/:id', async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = masterLaboratorySchema.parse(request.body)
    return updateMasterLaboratory(params.id, body, request)
  })

  app.delete('/masters/laboratories/:id', async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params)
    return deleteMasterLaboratory(params.id, request)
  })

  app.get('/masters/presentations', async (request) => listMasterPresentations(request))

  app.post('/masters/presentations', async (request) => {
    const body = masterPresentationSchema.parse(request.body)
    return createMasterPresentation(body, request)
  })

  app.patch('/masters/presentations/:id', async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = masterPresentationSchema.parse(request.body)
    return updateMasterPresentation(params.id, body, request)
  })

  app.delete('/masters/presentations/:id', async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params)
    return deleteMasterPresentation(params.id, request)
  })

  app.get('/masters/units', async (request) => listMasterUnits(request))

  app.post('/masters/units', async (request) => {
    const body = masterUnitSchema.parse(request.body)
    return createMasterUnit(body, request)
  })

  app.patch('/masters/units/:id', async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = masterUnitSchema.parse(request.body)
    return updateMasterUnit(params.id, body, request)
  })

  app.delete('/masters/units/:id', async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params)
    return deleteMasterUnit(params.id, request)
  })

  app.post('/', async (request) => {
    const body = createProductSchema.parse(request.body)
    return createProduct(body, request)
  })

  app.patch('/:id', async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = createProductSchema.parse(request.body)
    return updateProduct(params.id, body, request)
  })

  app.patch('/:id/status', async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = updateProductStatusSchema.parse(request.body)
    return updateProductStatus(params.id, body.status, request)
  })

  app.delete('/:id', async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params)
    return deleteProduct(params.id, request)
  })
}
