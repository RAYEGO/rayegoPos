import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { TipoDocumentoIdentidad, TipoPersona } from '@prisma/client'
import {
  createCustomer,
  deleteCustomer,
  getCustomersDashboard,
  updateCustomer,
} from '../modules/customers/customers.service.js'

const getCustomersQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['activo', 'inactivo']).optional(),
})

const createCustomerSchema = z.object({
  tipoPersona: z.nativeEnum(TipoPersona).optional(),
  tipoDocumento: z.nativeEnum(TipoDocumentoIdentidad).optional(),
  numeroDocumento: z.string().max(20).optional(),
  nombres: z.string().max(120).optional(),
  apellidos: z.string().max(120).optional(),
  razonSocial: z.string().max(200).optional(),
  email: z.string().max(150).email().optional(),
  telefono: z.string().max(30).optional(),
  direccion: z.string().max(255).optional(),
  ubigeo: z.string().max(6).optional(),
  fechaNacimiento: z.string().max(30).optional(),
  observaciones: z.string().max(255).optional(),
})

const updateCustomerSchema = createCustomerSchema.partial().extend({
  activo: z.boolean().optional(),
})

export default async function customersRoutes(app: FastifyInstance) {
  app.get('/', async (request) => {
    const query = getCustomersQuerySchema.parse(request.query)
    return getCustomersDashboard(query, request)
  })

  app.post('/', async (request) => {
    const body = createCustomerSchema.parse(request.body)
    return createCustomer(body, request)
  })

  app.put('/:id', async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = updateCustomerSchema.parse(request.body)
    return updateCustomer(params.id, body, request)
  })

  app.delete('/:id', async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params)
    return deleteCustomer(params.id, request)
  })
}

