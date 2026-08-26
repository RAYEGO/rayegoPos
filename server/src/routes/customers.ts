import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { TipoDocumentoIdentidad, TipoPersona } from '@prisma/client'
import {
  createCustomer,
  deleteCustomer,
  getCustomerAccountStatement,
  getCustomerSales,
  getCustomersDashboard,
  registerCustomerPayment,
  updateCustomer,
} from '../modules/customers/customers.service.js'

const getCustomersQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['activo', 'inactivo']).optional(),
})

const createCustomerSchema = z.object({
  tipoPersona: z.nativeEnum(TipoPersona, {
    message: 'Selecciona el tipo de persona.',
  }),
  tipoDocumento: z.nativeEnum(TipoDocumentoIdentidad, {
    message: 'Selecciona el tipo de documento.',
  }),
  numeroDocumento: z
    .string()
    .trim()
    .min(1, 'Ingresa el número de documento.')
    .max(20),
  nombres: z.string().max(120).optional(),
  apellidos: z.string().max(120).optional(),
  razonSocial: z.string().max(200).optional(),
  email: z.string().max(150).email().optional(),
  telefono: z.string().max(30).optional(),
  direccion: z.string().max(255).optional(),
  permitirCredito: z.boolean().optional(),
  limiteCredito: z.number().min(0).optional(),
  ubigeo: z.string().max(6).optional(),
  fechaNacimiento: z.string().max(30).optional(),
  observaciones: z.string().max(255).optional(),
})

const updateCustomerSchema = createCustomerSchema.partial().extend({
  activo: z.boolean().optional(),
})

const registerCustomerPaymentSchema = z.object({
  monto: z
    .number()
    .min(0.01, 'El monto debe ser mayor a 0.'),
  formaPagoId: z.string().uuid('Selecciona un medio de pago.'),
  referenciaExterna: z.string().max(120).trim().optional().nullable(),
  observaciones: z.string().max(255).trim().optional().nullable(),
})

export default async function customersRoutes(app: FastifyInstance) {
  app.get('/', async (request) => {
    const query = getCustomersQuerySchema.parse(request.query)
    return getCustomersDashboard(query, request)
  })

  app.get('/:id/sales', async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params)
    return getCustomerSales(params.id, request)
  })

  app.get('/:id/account-statement', async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params)
    return getCustomerAccountStatement(params.id, request)
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

  app.post('/:id/payments', async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = registerCustomerPaymentSchema.parse(request.body)
    return registerCustomerPayment(params.id, body, request)
  })
}
