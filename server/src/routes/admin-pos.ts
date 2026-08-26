import type { FastifyInstance } from 'fastify'
import { TipoDocumentoIdentidad } from '@prisma/client'
import { z } from 'zod'
import {
  createEmpresa,
  createTipoEmpresa,
  getEmpresaDetail,
  getTipoEmpresaDetail,
  getTipoEmpresaModulos,
  listEmpresas,
  listModulosCatalogo,
  listTiposEmpresa,
  toggleEmpresaStatus,
  toggleTipoEmpresaStatus,
  updateEmpresa,
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

const tipoDocumentoSchema = z.nativeEnum(TipoDocumentoIdentidad)

const createEmpresaSchema = z.object({
  tipoEmpresaId: z.string().min(1),
  razonSocial: z.string().trim().min(3).max(200),
  nombreComercial: z.string().trim().max(200).nullable().optional().or(z.literal('')),
  tipoDocumento: tipoDocumentoSchema.optional(),
  numeroDocumento: z.string().trim().min(8).max(20),
  email: z.string().trim().max(150).nullable().optional().or(z.literal('')),
  telefono: z.string().trim().max(30).nullable().optional().or(z.literal('')),
  direccion: z.string().trim().max(255).nullable().optional().or(z.literal('')),
  ubigeo: z.string().trim().max(6).nullable().optional().or(z.literal('')),
  monedaBase: z.string().trim().max(3).optional(),
  zonaHoraria: z.string().trim().max(60).optional(),
  activo: z.boolean().optional(),
})

const updateEmpresaSchema = createEmpresaSchema.partial()

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

  app.get('/empresas', async (request) => listEmpresas(request))

  app.post('/empresas', async (request) => {
    const body = createEmpresaSchema.parse(request.body)
    return createEmpresa(
      {
        ...body,
        nombreComercial: body.nombreComercial === '' ? null : body.nombreComercial,
        email: body.email === '' ? null : body.email,
        telefono: body.telefono === '' ? null : body.telefono,
        direccion: body.direccion === '' ? null : body.direccion,
        ubigeo: body.ubigeo === '' ? null : body.ubigeo,
      },
      request,
    )
  })

  app.get('/empresas/:id', async (request) => {
    const params = request.params as { id: string }
    return getEmpresaDetail(params.id, request)
  })

  app.put('/empresas/:id', async (request) => {
    const params = request.params as { id: string }
    const body = updateEmpresaSchema.parse(request.body)
    return updateEmpresa(
      params.id,
      {
        ...body,
        nombreComercial: body.nombreComercial === '' ? null : body.nombreComercial,
        email: body.email === '' ? null : body.email,
        telefono: body.telefono === '' ? null : body.telefono,
        direccion: body.direccion === '' ? null : body.direccion,
        ubigeo: body.ubigeo === '' ? null : body.ubigeo,
      },
      request,
    )
  })

  app.patch('/empresas/:id/toggle-status', async (request) => {
    const params = request.params as { id: string }
    return toggleEmpresaStatus(params.id, request)
  })
}
