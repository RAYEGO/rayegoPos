// ==============================================================
// Router RayegoTech (RT) Servicio Técnico Routes — Fastify
// Thin router registered in app.ts con prefix /api/rt
// Todos endpoints validación + permisos + auth vía requireBranchAuthContext / requirePermission.
// ==============================================================
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  listOrdenesServicio, getOrdenServicio, createOrdenServicio, cambiarEstadoOrden,
  asignarTecnicoOrden, crearVersionPresupuesto, aprobarPresupuestoCliente,
  addOrdenItem, deleteOrdenItem, addDiagnostico, registrarPagoOrden,
  listTecnicos, getTecnico, createTecnico, updateTecnico, deleteTecnico,
  listTiposEquipo, createTipoEquipo, listTiposServicio, createTipoServicio,
  listEquiposCliente, createEquipo, getEquipo, updateEquipo,
} from '../modules/rt/rt.service.js'

const uuidP = z.string().uuid()
const FiltersOSList = z.object({
  estado: z.enum(['RECIBIDO','DIAGNOSTICO','PRESUPUESTO','ESPERANDO_APROBACION','APROBADO','EN_REPARACION','EN_PRUEBAS','LISTO_PARA_ENTREGA','PENDIENTE_RETIRO','ENTREGADO','RECHAZADO','CANCELADO','EN_GARANTIA']).or(z.array(z.any())).optional(),
  desde: z.string().optional(), hasta: z.string().optional(),
  search: z.string().optional(), sucursalId: uuidP.optional(), clienteId: uuidP.optional(),
  tecnicoAsignadoId: uuidP.optional(),
}).strict().partial()

export async function rtRoutes(app: FastifyInstance) {
  // ================ ORDENES SERVICIO ================
  app.get('/ordenes-servicio', async (req, _reply) => {
    const filters = FiltersOSList.parse(req.query || {}) as any
    return listOrdenesServicio(req, filters)
  })

  app.get('/ordenes-servicio/:id', async (req, _reply) => {
    const p = z.object({ id: uuidP }).parse(req.params)
    return getOrdenServicio(req, p.id)
  })

  const createOSSchema = z.object({
    clienteId: uuidP,
    clienteEquipoId: uuidP.optional(),
    tipoServicioId: uuidP.optional().nullable(),
    tecnicoAsignadoId: uuidP.optional().nullable(),
    fechaRecepcion: z.string().optional(),
    fechaPrometida: z.string().optional(),
    clienteReporto: z.string().max(500).optional().nullable(),
    diagnosticoRecepcion: z.string().max(2000).optional().nullable(),
    observaciones: z.string().optional().nullable(),
    garantiaDias: z.number().int().min(0).optional(),
    igvPorcentaje: z.number().min(0).optional(),
    items: z.array(z.any()).optional().default([]),
    descripcionPresupuesto: z.string().optional().nullable(),
  }).strict()
  app.post('/ordenes-servicio', async (req, _reply) => {
    const body = createOSSchema.parse(req.body)
    return createOrdenServicio(req, body)
  })

  app.put('/ordenes-servicio/:id/estado', async (req, _reply) => {
    const p = z.object({ id: uuidP }).parse(req.params)
    const body = z.object({ estado: z.enum(['RECIBIDO','DIAGNOSTICO','PRESUPUESTO','ESPERANDO_APROBACION','APROBADO','EN_REPARACION','EN_PRUEBAS','LISTO_PARA_ENTREGA','PENDIENTE_RETIRO','ENTREGADO','RECHAZADO','CANCELADO','EN_GARANTIA']), observaciones: z.string().optional().nullable(), terminosGarantia: z.string().optional().nullable() }).strict().parse(req.body)
    return cambiarEstadoOrden(req, p.id, body)
  })

  app.put('/ordenes-servicio/:id/asignar-tecnico', async (req, _reply) => {
    const p = z.object({ id: uuidP }).parse(req.params)
    const body = z.object({ tecnicoId: uuidP, observaciones: z.string().optional().nullable() }).strict().parse(req.body)
    return asignarTecnicoOrden(req, p.id, body)
  })

  // PRESUPUESTOS
  app.post('/ordenes-servicio/:id/presupuestos', async (req, _reply) => {
    const p = z.object({ id: uuidP }).parse(req.params)
    const body = z.object({ descripcion: z.string().optional().nullable(), montoManoObra: z.number().min(0).optional(), montoRepuestos: z.number().min(0).optional(), montoServicios: z.number().min(0).optional(), subTotal: z.number().min(0).optional(), igvPorcentaje: z.number().min(0).optional() }).strict().parse(req.body)
    return crearVersionPresupuesto(req, p.id, body)
  })
  app.put('/ordenes-servicio/:id/presupuestos/aprobar', async (req, _reply) => {
    const p = z.object({ id: uuidP }).parse(req.params)
    const body = z.object({ version: z.number().int().min(1), accion: z.enum(['APROBAR','RECHAZAR']).default('APROBAR'), comentarios: z.string().optional().nullable() }).strict().parse(req.body)
    return aprobarPresupuestoCliente(req, p.id, body)
  })

  // DIAGNOSTICOS
  app.post('/ordenes-servicio/:id/diagnosticos', async (req, _reply) => {
    const p = z.object({ id: uuidP }).parse(req.params)
    const body = z.object({ diagnostico: z.string().min(1), recomendaciones: z.string().optional().nullable(), requiereRepuestos: z.boolean().optional(), tecnicoId: uuidP.optional().nullable() }).strict().parse(req.body)
    return addDiagnostico(req, p.id, body)
  })

  // ITEMS SERVICIO
  const itemSchema = z.object({
    tipo: z.enum(['REPUESTO','MANO_OBRA','ACCESORIO_ENTREGADO','SERVICIO_ADICIONAL']).default('MANO_OBRA'),
    productoId: uuidP.optional().nullable(),
    loteId: uuidP.optional().nullable(),
    descripcion: z.string().optional().nullable(),
    cantidad: z.number().min(0).optional().default(1),
    precioUnitario: z.number().min(0).optional().default(0),
    tecnicoAsignadoId: uuidP.optional().nullable(),
    observaciones: z.string().optional().nullable(),
    garantiaDias: z.number().int().min(0).optional(),
    observacionesKardex: z.string().optional().nullable(),
  }).strict()
  app.post('/ordenes-servicio/:id/items', async (req, _reply) => {
    const p = z.object({ id: uuidP }).parse(req.params)
    const body = itemSchema.parse(req.body)
    return addOrdenItem(req, p.id, body)
  })
  app.delete('/ordenes-servicio/items/:itemId', async (req, _reply) => {
    const p = z.object({ itemId: uuidP }).parse(req.params)
    return deleteOrdenItem(req, p.itemId)
  })

  // PAGOS ORDEN
  app.post('/ordenes-servicio/:id/pagos', async (req, _reply) => {
    const p = z.object({ id: uuidP }).parse(req.params)
    const body = z.object({ monto: z.number().positive(), formaPagoId: uuidP, fechaPago: z.string().optional(), observaciones: z.string().optional().nullable() }).strict().parse(req.body)
    return registrarPagoOrden(req, p.id, body)
  })

  // ================ TECNICOS ================
  app.get('/tecnicos', async (req) => listTecnicos(req))
  app.get('/tecnicos/:id', async (req) => {
    const p = z.object({ id: uuidP }).parse(req.params); return getTecnico(req, p.id) })
  app.post('/tecnicos', async (req) => {
    const body = z.object({ usuarioId: uuidP, codigo: z.string().max(40).optional(), especialidades: z.array(z.string()).optional(), activo: z.boolean().optional(), observaciones: z.string().optional().nullable(), fechaContratacion: z.string().optional() }).strict().parse(req.body)
    return createTecnico(req, body)
  })
  app.put('/tecnicos/:id', async (req) => {
    const p = z.object({ id: uuidP }).parse(req.params)
    const body = z.object({ codigo: z.string().optional(), especialidades: z.array(z.string()).optional(), activo: z.boolean().optional(), observaciones: z.string().optional().nullable(), fechaContratacion: z.string().optional().nullable(), fechaBaja: z.string().optional().nullable() }).strict().parse(req.body)
    return updateTecnico(req, p.id, body)
  })
  app.delete('/tecnicos/:id', async (req) => {
    const p = z.object({ id: uuidP }).parse(req.params); return deleteTecnico(req, p.id) })

  // ================ CATÁLOGOS ================
  app.get('/catalogos/tipos-equipo', async (req) => listTiposEquipo(req))
  app.post('/catalogos/tipos-equipo', async (req) => {
    const body = z.object({ codigo: z.string().max(40), nombre: z.string().min(1).max(200), descripcion: z.string().max(500).optional().nullable(), orden: z.number().int().min(0).optional(), activo: z.boolean().optional() }).strict().parse(req.body)
    return createTipoEquipo(req, body)
  })
  app.get('/catalogos/tipos-servicio', async (req) => listTiposServicio(req))
  app.post('/catalogos/tipos-servicio', async (req) => {
    const body = z.object({ codigo: z.string().max(40), nombre: z.string().min(1).max(200), descripcion: z.string().max(500).optional().nullable(), tarifaBase: z.number().min(0).optional(), orden: z.number().int().min(0).optional() }).strict().parse(req.body)
    return createTipoServicio(req, body)
  })

  // ================ CLIENTE EQUIPOS ================
  app.get('/equipos', async (req) => {
    const q = z.object({ clienteId: uuidP.optional() }).parse(req.query || {})
    return listEquiposCliente(req, q.clienteId)
  })
  app.get('/equipos/:id', async (req) => {
    const p = z.object({ id: uuidP }).parse(req.params); return getEquipo(req, p.id) })
  app.post('/equipos', async (req) => {
    const body = z.object({ clienteId: uuidP, tipoEquipoId: uuidP, marca: z.string().min(1).max(200), modelo: z.string().min(1).max(200), numeroSerie: z.string().optional().nullable(), numeroImei: z.string().optional().nullable(), capacidadAlmacenamiento: z.string().optional().nullable(), memoriaRam: z.string().optional().nullable(), color: z.string().optional().nullable(), observaciones: z.string().optional().nullable(), estadoFisico: z.enum(['NUEVO','USADO','REPARADO','DE','ROTO','DE_PRESTAMO']).default('USADO'), garantiaDias: z.number().int().min(0).optional(), activo: z.boolean().optional() }).strict().parse(req.body)
    return createEquipo(req, body)
  })
  app.put('/equipos/:id', async (req) => {
    const p = z.object({ id: uuidP }).parse(req.params)
    const body = z.object({ tipoEquipoId: uuidP.optional(), marca: z.string().optional(), modelo: z.string().optional(), numeroSerie: z.string().optional().nullable(), numeroImei: z.string().optional().nullable(), capacidadAlmacenamiento: z.string().optional().nullable(), memoriaRam: z.string().optional().nullable(), color: z.string().optional().nullable(), observaciones: z.string().optional().nullable(), estadoFisico: z.string().optional(), garantiaDias: z.number().int().min(0).optional(), activo: z.boolean().optional() }).strict().parse(req.body)
    return updateEquipo(req, p.id, body)
  })
}
