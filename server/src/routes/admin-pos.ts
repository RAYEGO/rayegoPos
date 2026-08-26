import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  createTipoEmpresa,
  getTipoEmpresaDetail,
  getTipoEmpresaModulos,
  listModulosCatalogo,
  listTiposEmpresa,
  toggleTipoEmpresaStatus,
  updateTipoEmpresa,
  updateTipoEmpresaModulos,
} from '../modules/admin-pos/admin-pos.service.js'

const createTipoEmpresaSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(2, 'El código debe tener al menos 2 caracteres.')
    .max(50, 'El código debe tener como máximo 50 caracteres.')
    .regex(/^[A-Z0-9_]+$/, 'El código solo admite mayúsculas, números y guion bajo.'),
  nombre: z
    .string()
    .trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres.')
    .max(120, 'El nombre debe tener como máximo 120 caracteres.'),
  descripcion: z.string().max(255).nullable().optional().or(z.literal('')),
  icono: z.string().max(50).nullable().optional().or(z.literal('')),
  color: z.string().max(20).nullable().optional().or(z.literal('')),
  orden: z.number().int().min(0).max(9999).optional(),
  activo: z.boolean().optional(),
  modulosHabilitados: z.array(z.string().max(50)).optional(),
})

const updateTipoEmpresaSchema = createTipoEmpresaSchema
  .partial()
  .omit({ codigo: true })
  .extend({
    nombre: createTipoEmpresaSchema.shape.nombre.optional(),
  })

const updateModulosSchema = z.object({
  modulosHabilitados: z.array(z.string().max(50)),
})

export async function adminPosRoutes(app: FastifyInstance) {
  app.get('/tipos-empresa', async (request) => listTiposEmpresa(request))

  app.post('/tipos-empresa', async (request) => {
    const body = createTipoEmpresaSchema.parse(request.body)
    return createTipoEmpresa(
      {
        ...body,
        descripcion: body.descripcion === '' ? null : body.descripcion,
        icono: body.icono === '' ? null : body.icono,
        color: body.color === '' ? null : body.color,
      },
      request,
    )
  })

  app.get('/tipos-empresa/:id', async (request) => {
    const params = request.params as { id: string }
    return getTipoEmpresaDetail(params.id, request)
  })

  app.put('/tipos-empresa/:id', async (request) => {
    const params = request.params as { id: string }
    const body = updateTipoEmpresaSchema.parse(request.body)
    return updateTipoEmpresa(
      params.id,
      {
        ...body,
        descripcion: body.descripcion === '' ? null : body.descripcion,
        icono: body.icono === '' ? null : body.icono,
        color: body.color === '' ? null : body.color,
      },
      request,
    )
  })

  app.patch('/tipos-empresa/:id/toggle-status', async (request) => {
    const params = request.params as { id: string }
    return toggleTipoEmpresaStatus(params.id, false, request)
  })

  app.get('/modulos', async (request) => listModulosCatalogo(request))

  app.get('/tipos-empresa/:id/modulos', async (request) => {
    const params = request.params as { id: string }
    return getTipoEmpresaModulos(params.id, request)
  })

  app.put('/tipos-empresa/:id/modulos', async (request) => {
    const params = request.params as { id: string }
    const body = updateModulosSchema.parse(request.body)
    return updateTipoEmpresaModulos(params.id, body, request)
  })
}
