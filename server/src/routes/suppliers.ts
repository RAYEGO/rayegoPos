import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { TipoDocumentoIdentidad, TipoPersona } from '@prisma/client'
import {
  getSuppliersDashboard,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../modules/suppliers/suppliers.service.js'

const getSuppliersQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['activo', 'inactivo']).optional(),
})

const createSupplierSchema = z.object({
  tipoPersona: z.nativeEnum(TipoPersona).optional(),
  tipoDocumento: z.nativeEnum(TipoDocumentoIdentidad).optional(),
  numeroDocumento: z.string().min(1).max(20),
  razonSocial: z.string().min(1).max(200),
  nombreComercial: z.string().max(200).optional(),
  contactoNombre: z.string().max(150).optional(),
  contactoTelefono: z.string().max(30).optional(),
  email: z.string().max(150).email().optional(),
  direccion: z.string().max(255).optional(),
  ubigeo: z.string().max(6).optional(),
  observaciones: z.string().max(255).optional(),
})

const updateSupplierSchema = createSupplierSchema.partial().extend({
  activo: z.boolean().optional(),
})

export default async function suppliersRoutes(app: FastifyInstance) {
  app.get('/', async (request) => {
    const query = getSuppliersQuerySchema.parse(request.query)
    return getSuppliersDashboard(query, request)
  })

  app.post('/', async (request) => {
    const body = createSupplierSchema.parse(request.body)
    return createSupplier(body, request)
  })

  app.put('/:id', async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = updateSupplierSchema.parse(request.body)
    return updateSupplier(params.id, body, request)
  })

  app.delete('/:id', async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params)
    return deleteSupplier(params.id, request)
  })
}
