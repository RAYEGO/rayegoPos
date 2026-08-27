import type { FastifyInstance } from 'fastify'
import { TipoDocumentoIdentidad } from '@prisma/client'
import { z } from 'zod'
import {
  createEmpresa,
  createEmpresaAdministrador,
  createEmpresaOnboarding,
  createTipoEmpresa,
  getEmpresaDetail,
  getTipoEmpresaDetail,
  getTipoEmpresaModulos,
  listEmpresaAdministradores,
  listEmpresaSucursales,
  listEmpresas,
  listModulosCatalogo,
  listTiposEmpresa,
  toggleEmpresaStatus,
  toggleEmpresaAdministradorStatus,
  toggleTipoEmpresaStatus,
  updateEmpresa,
  updateEmpresaAdministrador,
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

const createEmpresaOnboardingSchema = z.object({
  empresa: createEmpresaSchema,
  sucursal: z.object({
    codigo: z.string().trim().min(1).max(20),
    nombre: z.string().trim().min(2).max(150),
    direccion: z.string().trim().max(255).nullable().optional().or(z.literal('')),
    telefono: z.string().trim().max(30).nullable().optional().or(z.literal('')),
    email: z.string().trim().max(150).nullable().optional().or(z.literal('')),
    ubigeo: z.string().trim().max(6).nullable().optional().or(z.literal('')),
  }),
  admin: z.object({
    username: z.string().trim().min(3).max(50),
    email: z.string().trim().max(150).nullable().optional().or(z.literal('')),
    password: z.string().trim().min(8).max(100),
    nombres: z.string().trim().min(2).max(120),
    apellidos: z.string().trim().min(2).max(120),
    tipoDocumento: tipoDocumentoSchema.optional(),
    numeroDocumento: z.string().trim().max(20).nullable().optional().or(z.literal('')),
    telefono: z.string().trim().max(30).nullable().optional().or(z.literal('')),
    activo: z.boolean().optional(),
  }),
})

const createEmpresaAdminSchema = z.object({
  username: z.string().trim().min(3).max(50),
  email: z.string().trim().max(150).nullable().optional().or(z.literal('')),
  password: z.string().trim().min(8).max(100),
  nombres: z.string().trim().min(2).max(120),
  apellidos: z.string().trim().min(2).max(120),
  tipoDocumento: tipoDocumentoSchema.optional(),
  numeroDocumento: z.string().trim().max(20).nullable().optional().or(z.literal('')),
  telefono: z.string().trim().max(30).nullable().optional().or(z.literal('')),
  activo: z.boolean().optional(),
  sucursalId: z.string().uuid().nullable().optional().or(z.literal('')),
  sucursal: z
    .object({
      codigo: z.string().trim().min(1).max(20),
      nombre: z.string().trim().min(2).max(150),
      direccion: z.string().trim().max(255).nullable().optional().or(z.literal('')),
      telefono: z.string().trim().max(30).nullable().optional().or(z.literal('')),
      email: z.string().trim().max(150).nullable().optional().or(z.literal('')),
      ubigeo: z.string().trim().max(6).nullable().optional().or(z.literal('')),
    })
    .nullable()
    .optional(),
})

const updateEmpresaAdminSchema = createEmpresaAdminSchema
  .partial()
  .omit({ username: true })
  .extend({
    password: z.string().trim().min(8).max(100).nullable().optional().or(z.literal('')),
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

  app.post('/empresas/onboarding', async (request) => {
    const body = createEmpresaOnboardingSchema.parse(request.body)
    return createEmpresaOnboarding(
      {
        empresa: {
          ...body.empresa,
          nombreComercial: body.empresa.nombreComercial === '' ? null : body.empresa.nombreComercial,
          email: body.empresa.email === '' ? null : body.empresa.email,
          telefono: body.empresa.telefono === '' ? null : body.empresa.telefono,
          direccion: body.empresa.direccion === '' ? null : body.empresa.direccion,
          ubigeo: body.empresa.ubigeo === '' ? null : body.empresa.ubigeo,
        },
        sucursal: {
          ...body.sucursal,
          direccion: body.sucursal.direccion === '' ? null : body.sucursal.direccion,
          email: body.sucursal.email === '' ? null : body.sucursal.email,
          telefono: body.sucursal.telefono === '' ? null : body.sucursal.telefono,
          ubigeo: body.sucursal.ubigeo === '' ? null : body.sucursal.ubigeo,
        },
        admin: {
          ...body.admin,
          email: body.admin.email === '' ? null : body.admin.email,
          numeroDocumento: body.admin.numeroDocumento === '' ? null : body.admin.numeroDocumento,
          telefono: body.admin.telefono === '' ? null : body.admin.telefono,
        },
      },
      request,
    )
  })

  app.get('/empresas/:id', async (request) => {
    const params = request.params as { id: string }
    return getEmpresaDetail(params.id, request)
  })

  app.get('/empresas/:id/sucursales', async (request) => {
    const params = request.params as { id: string }
    return listEmpresaSucursales(params.id, request)
  })

  app.get('/empresas/:id/administradores', async (request) => {
    const params = request.params as { id: string }
    return listEmpresaAdministradores(params.id, request)
  })

  app.post('/empresas/:id/administradores', async (request) => {
    const params = request.params as { id: string }
    const body = createEmpresaAdminSchema.parse(request.body)
    return createEmpresaAdministrador(
      params.id,
      {
        ...body,
        email: body.email === '' ? null : body.email,
        numeroDocumento: body.numeroDocumento === '' ? null : body.numeroDocumento,
        telefono: body.telefono === '' ? null : body.telefono,
        sucursalId: body.sucursalId === '' ? null : body.sucursalId,
        sucursal:
          body.sucursal == null
            ? null
            : {
                ...body.sucursal,
                direccion: body.sucursal.direccion === '' ? null : body.sucursal.direccion,
                email: body.sucursal.email === '' ? null : body.sucursal.email,
                telefono: body.sucursal.telefono === '' ? null : body.sucursal.telefono,
                ubigeo: body.sucursal.ubigeo === '' ? null : body.sucursal.ubigeo,
              },
      },
      request,
    )
  })

  app.put('/empresas/:id/administradores/:adminId', async (request) => {
    const params = request.params as { id: string; adminId: string }
    const body = updateEmpresaAdminSchema.parse(request.body)
    return updateEmpresaAdministrador(
      params.id,
      params.adminId,
      {
        ...body,
        email: body.email === '' ? null : body.email,
        password: body.password === '' ? null : body.password,
        numeroDocumento: body.numeroDocumento === '' ? null : body.numeroDocumento,
        telefono: body.telefono === '' ? null : body.telefono,
        sucursalId: body.sucursalId === '' ? null : body.sucursalId,
      },
      request,
    )
  })

  app.patch('/empresas/:id/administradores/:adminId/toggle-status', async (request) => {
    const params = request.params as { id: string; adminId: string }
    return toggleEmpresaAdministradorStatus(params.id, params.adminId, request)
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
