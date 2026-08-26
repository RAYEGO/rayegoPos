import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { EstadoProducto } from '@prisma/client'
import {
  createProduct,
  deleteProduct,
  getProductOptions,
  listProductCatalog,
  previewProductPackaging,
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
  listMasterCommercialTypes,
  createMasterCommercialType,
  updateMasterCommercialType,
  deleteMasterCommercialType,
  listMasterActivePrinciples,
  createMasterActivePrinciple,
  updateMasterActivePrinciple,
  deleteMasterActivePrinciple,
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
  commercialTypeId: z.string().uuid().optional(),
  activePrincipleId: z.string().uuid().optional(),
  laboratoryId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  sortBy: z.enum(['name', 'stockUnits', 'createdAt']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
})

const packagingChainStepSchema = z.object({
  presentacionId: z.string().uuid({ message: 'Cada nivel de empaque debe tener una presentación válida.' }),
  permiteCompra: z.boolean().default(false),
  permiteVenta: z.boolean().default(false),
  precioVenta: z.number().nonnegative('El precio de venta debe ser mayor o igual a 0.').optional(),
  cantidad: z.number().int('La cantidad debe ser un entero.').positive('La cantidad debe ser mayor que 0.').optional(),
})

const createProductSchema = z.object({
  categoriaId: z.string().uuid({ message: 'Selecciona una categoría.' }),
  tipoComercialId: z.string().uuid({ message: 'Selecciona un tipo comercial.' }),
  principioActivoId: z.string().uuid({ message: 'Selecciona un principio activo.' }),
  principioActivoIds: z.array(z.string().uuid({ message: 'Cada principio activo debe ser válido.' })).min(1).optional(),
  laboratorioId: z.string().uuid({ message: 'Selecciona un laboratorio válido.' }).optional(),
  presentacionId: z.string().uuid({ message: 'Selecciona una presentación válida.' }).optional(),
  unidadMedidaId: z.string().uuid({ message: 'Selecciona una unidad de medida.' }),
  compraPresentacionId: z.string().uuid({ message: 'Selecciona una presentación de compra válida.' }).optional(),
  basePresentacionId: z.string().uuid({ message: 'Selecciona una unidad base válida.' }).optional(),
  presentacionesEmpaque: z
    .array(
      z.object({
        presentacionId: z.string().uuid({ message: 'Cada presentación de empaque debe ser válida.' }),
        permiteCompra: z.boolean().default(false),
        permiteVenta: z.boolean().default(false),
        precioVenta: z.number().nonnegative('El precio de venta debe ser mayor o igual a 0.').optional(),
      }),
    )
    .min(1, 'Agrega al menos una presentación de empaque.')
    .optional(),
  conversionesEmpaque: z
    .array(
      z.object({
        desdePresentacionId: z.string().uuid({ message: 'La presentación origen debe ser válida.' }),
        haciaPresentacionId: z.string().uuid({ message: 'La presentación destino debe ser válida.' }),
        cantidad: z.number().int('La cantidad debe ser un entero.').positive('La cantidad debe ser mayor que 0.'),
      }),
    )
    .default([])
    .optional(),
  cadenaEmpaque: z.array(packagingChainStepSchema).min(1, 'Agrega al menos un nivel de empaque.').optional(),
  sku: z.string().min(1).max(50),
  codigoBarras: z.string().max(50).optional(),
  nombre: z.string().min(3).max(180),
  descripcion: z.string().max(500).optional(),
  concentracion: z.string().max(120).optional(),
  registroSanitario: z.string().max(100).optional(),
  requiereReceta: z.boolean().default(false),
  esControlado: z.boolean().default(false),
  costoReferencia: z.number().nonnegative().optional(),
  observaciones: z.string().max(500).optional(),
}).superRefine((values, ctx) => {
  const hasLegacyPackaging =
    Boolean(values.compraPresentacionId) &&
    Boolean(values.basePresentacionId) &&
    Boolean(values.presentacionesEmpaque?.length)
  const hasChainPackaging = Boolean(values.cadenaEmpaque?.length)

  if (!hasLegacyPackaging && !hasChainPackaging) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'La configuración de empaque del producto es obligatoria.',
      path: ['cadenaEmpaque'],
    })
  }
})

const previewPackagingSchema = z.object({
  compraPresentacionId: z.string().uuid({ message: 'Selecciona una presentación de compra válida.' }).optional(),
  basePresentacionId: z.string().uuid({ message: 'Selecciona una unidad base válida.' }).optional(),
  presentacionesEmpaque: z
    .array(
      z.object({
        presentacionId: z.string().uuid({ message: 'Cada presentación de empaque debe ser válida.' }),
        permiteCompra: z.boolean().default(false),
        permiteVenta: z.boolean().default(false),
        precioVenta: z.number().nonnegative('El precio de venta debe ser mayor o igual a 0.').optional(),
      }),
    )
    .min(1, 'Agrega al menos una presentación de empaque.')
    .optional(),
  conversionesEmpaque: z
    .array(
      z.object({
        desdePresentacionId: z.string().uuid({ message: 'La presentación origen debe ser válida.' }),
        haciaPresentacionId: z.string().uuid({ message: 'La presentación destino debe ser válida.' }),
        cantidad: z.number().int('La cantidad debe ser un entero.').positive('La cantidad debe ser mayor que 0.'),
      }),
    )
    .default([])
    .optional(),
  cadenaEmpaque: z.array(packagingChainStepSchema).min(1, 'Agrega al menos un nivel de empaque.').optional(),
}).superRefine((values, ctx) => {
  const hasLegacyPackaging =
    Boolean(values.compraPresentacionId) &&
    Boolean(values.basePresentacionId) &&
    Boolean(values.presentacionesEmpaque?.length)
  const hasChainPackaging = Boolean(values.cadenaEmpaque?.length)

  if (!hasLegacyPackaging && !hasChainPackaging) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'La configuración de empaque es obligatoria.',
      path: ['cadenaEmpaque'],
    })
  }
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

const masterCommercialTypeSchema = z.object({
  nombre: z.string().min(2).max(120),
  descripcion: z.string().max(255).optional(),
  activo: z.boolean().optional(),
})

const masterActivePrincipleSchema = z.object({
  nombre: z.string().min(2).max(150),
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

  app.get('/masters/commercial-types', async (request) =>
    listMasterCommercialTypes(request),
  )

  app.post('/masters/commercial-types', async (request) => {
    const body = masterCommercialTypeSchema.parse(request.body)
    return createMasterCommercialType(body, request)
  })

  app.patch('/masters/commercial-types/:id', async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = masterCommercialTypeSchema.parse(request.body)
    return updateMasterCommercialType(params.id, body, request)
  })

  app.delete('/masters/commercial-types/:id', async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params)
    return deleteMasterCommercialType(params.id, request)
  })

  app.get('/masters/active-principles', async (request) =>
    listMasterActivePrinciples(request),
  )

  app.post('/masters/active-principles', async (request) => {
    const body = masterActivePrincipleSchema.parse(request.body)
    return createMasterActivePrinciple(body, request)
  })

  app.patch('/masters/active-principles/:id', async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = masterActivePrincipleSchema.parse(request.body)
    return updateMasterActivePrinciple(params.id, body, request)
  })

  app.delete('/masters/active-principles/:id', async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params)
    return deleteMasterActivePrinciple(params.id, request)
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

  app.post('/packaging/preview', async (request) => {
    const body = previewPackagingSchema.parse(request.body)
    return previewProductPackaging(body, request)
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
