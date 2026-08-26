import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  createBranch,
  getBranchDetail,
  listBranchesForCompany,
  toggleBranchStatus,
  updateBranch,
} from '../modules/settings/branches.service.js'
import {
  deleteCompanyLogo,
  getCompanyProfile,
  updateCompanyOperationMode,
  updateCompanyProfile,
  uploadCompanyLogo,
} from '../modules/settings/company.service.js'

const updateCompanyProfileSchema = z.object({
  logoUrl: z.string().max(500).nullable().optional(),
  razonSocial: z.string().min(3).max(200),
  nombreComercial: z.string().max(200).nullable().optional(),
  ruc: z.string().regex(/^\d{11}$/, 'El RUC debe tener 11 dígitos.'),
  direccionFiscal: z.string().max(255).nullable().optional(),
  telefono: z.string().max(30).nullable().optional(),
  email: z.string().email().max(150).nullable().optional(),
  moneda: z.string().min(3).max(3),
  igvPorDefecto: z.number().min(0).max(100),
  activo: z.boolean(),
})

const uploadCompanyLogoSchema = z.object({
  fileName: z.string().min(1).max(120),
  mimeType: z.string().min(3).max(100),
  base64: z.string().min(1),
})

const updateCompanyOperationModeSchema = z.object({
  operationMode: z.enum(['PRODUCCION']),
})

const createBranchSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres.')
    .max(120, 'El nombre debe tener como máximo 120 caracteres.'),
  codigo: z
    .string()
    .trim()
    .min(2, 'El código debe tener al menos 2 caracteres.')
    .max(20, 'El código debe tener como máximo 20 caracteres.'),
  direccion: z.string().max(255).nullable().optional(),
  telefono: z.string().max(30).nullable().optional(),
  email: z
    .string()
    .email('Ingresa un correo válido.')
    .max(150)
    .nullable()
    .optional()
    .or(z.literal('')),
  activo: z.boolean().optional(),
})

const updateBranchSchema = createBranchSchema
  .partial()
  .omit({ codigo: true })
  .extend({
    nombre: createBranchSchema.shape.nombre.optional(),
  })

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/company', async (request) => getCompanyProfile(request))

  app.put('/company', async (request) => {
    const body = updateCompanyProfileSchema.parse(request.body)
    return updateCompanyProfile(body, request)
  })

  app.patch('/company/operation-mode', async (request) => {
    const body = updateCompanyOperationModeSchema.parse(request.body)
    return updateCompanyOperationMode(body, request)
  })

  app.post('/company/logo', async (request) => {
    const body = uploadCompanyLogoSchema.parse(request.body)
    return uploadCompanyLogo(body, request)
  })

  app.delete('/company/logo', async (request) => deleteCompanyLogo(request))

  app.get('/branches', async (request) => listBranchesForCompany(request))

  app.post('/branches', async (request) => {
    const body = createBranchSchema.parse(request.body)
    return createBranch(
      {
        ...body,
        email: body.email === '' ? null : body.email,
      },
      request,
    )
  })

  app.get('/branches/:id', async (request) => {
    const params = request.params as { id: string }
    return getBranchDetail(params.id, request)
  })

  app.put('/branches/:id', async (request) => {
    const params = request.params as { id: string }
    const body = updateBranchSchema.parse(request.body)
    return updateBranch(
      params.id,
      {
        ...body,
        email: body.email === '' ? null : body.email,
      },
      request,
    )
  })

  app.patch('/branches/:id/toggle-status', async (request) => {
    const params = request.params as { id: string }
    return toggleBranchStatus(params.id, request)
  })
}
