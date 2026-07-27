import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getCompanyProfile, updateCompanyProfile } from '../modules/settings/company.service.js'

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

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/company', async (request) => getCompanyProfile(request))

  app.put('/company', async (request) => {
    const body = updateCompanyProfileSchema.parse(request.body)
    return updateCompanyProfile(body, request)
  })
}

