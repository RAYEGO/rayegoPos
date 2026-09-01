// ==============================================================
// RayegoTech (RT) Servicio Técnico — Lógica Backend
// Fastify Plugin-style service functions. Toda la lógica
// business está en este módulo; routes/rt.ts es super thin.
// ==============================================================
import {
  Prisma,
  PrismaClient,
  TipoItemOrdenServicio,
  EstadoOrdenServicio,
  OperacionCaja,
  TipoMovimientoCaja,
  TipoMovimientoInventario,
  OrigenMovimientoInventario,
} from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { createHttpError, requireBranchAuthContext, requirePermission } from '../../lib/auth.js'
import prisma from '../../lib/prisma.js'

export function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  return Number(value.toString())
}
export function toDecimal(value: number | string, fractionDigits: number) {
  return new Prisma.Decimal(Number(value)).toDecimalPlaces(fractionDigits) as unknown as Prisma.Decimal
}
export function toOptionalString(value?: string | null): string | null {
  if (value === undefined || value === null) return null
  const v = value.trim()
  return v.length ? v : null
}
export function roundMoney(n: number): number {
  return Number(n.toFixed(2))
}

const UNAUTH = (s: number, m: string) => createHttpError(s, m)

// ============================================================
// HELPERS: scope por empresa/sucursal (multi-empresa seguro)
// ============================================================
export function scopeEmpresa<T extends { empresaId?: string }>(base: T, empresaId: string): T & { empresaId: string } {
  ;(base as any).empresaId = empresaId
  return base as any
}

// ============================================================
// HELPERS: Numeración OS segura (rowlock UPDATE ... RETURNING)
// ============================================================
export async function getNextNumeroOrden(
  db: PrismaClient | Prisma.TransactionClient,
  empresaId: string,
  sucursalId: string,
  sucursalCodigo: string,
  anio: number,
  userId: string,
): Promise<{ numeroOrden: string; proximoNumero: number }> {
  // SELECT sucursal.codigo para garantizar formato visible. Este helper
  // se usa desde create Orden; caller puede pasar código.
  // Rowlock por Postgres UPDATE: una sola transacción ve el incremento.
  const row = await db.$queryRawUnsafe<Array<{ proximo_numero: number }>>(`
    UPDATE secuencias_ordenes_servicio
    SET proximo_numero = proximo_numero + 1, updated_at = NOW(), updated_by = $5::uuid
    WHERE empresa_id = $1::uuid AND sucursal_id = $2::uuid AND anio = $3::int
    RETURNING proximo_numero;
  `, empresaId, sucursalId, anio, userId, userId)
  let proximo = (row && row[0]) ? row[0].proximo_numero : 0
  if (!proximo) {
    // Insertar la fila si no existe (1er OS de la sucursal x año)
    const ins = await db.$queryRawUnsafe<Array<{ proximo_numero: number }>>(`
      INSERT INTO secuencias_ordenes_servicio
        (id, empresa_id, sucursal_id, anio, proximo_numero, created_at, updated_at, created_by, updated_by)
      VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::int, 1, NOW(), NOW(), $4::uuid, $4::uuid)
      ON CONFLICT (sucursal_id, anio) DO UPDATE SET proximo_numero = secuencias_ordenes_servicio.proximo_numero + 1
      RETURNING proximo_numero;
    `, empresaId, sucursalId, anio, userId)
    proximo = (ins && ins[0]) ? ins[0].proximo_numero : 1
  }
  const codSuc = sucursalCodigo.padStart(3, '0').toUpperCase()
  const sec = String(proximo).padStart(5, '0')
  const numeroOrden = `OS-${codSuc}-${anio}-${sec}`
  return { numeroOrden, proximoNumero: proximo }
}

// ============================================================
// CATALOGOS: tiposEquipos, tiposServicio, tecnicos, motivo RT
// ============================================================

// ------- TIPOS EQUIPO CLIENTE -------
export async function listTiposEquipo(request: FastifyRequest) {
  const { companyId } = await requireBranchAuthContext(request)
  requirePermission(request, 'equiposCliente.read')
  const rows = await prisma.tipoEquipoCliente.findMany({
    where: { empresaId: companyId, deletedAt: null, activo: true },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
  })
  return { items: rows }
}
export async function createTipoEquipo(request: FastifyRequest, payload: any) {
  const { companyId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'equiposCliente.write')
  const codigo = String(payload.codigo || '').toUpperCase().trim()
  if (!codigo || !payload.nombre) throw UNAUTH(400, 'Código y nombre son obligatorios.')
  const exists = await prisma.tipoEquipoCliente.findFirst({
    where: { empresaId: companyId, codigo },
  })
  if (exists) throw UNAUTH(409, `Ya existe el código de equipo "${codigo}".`)
  const row = await prisma.tipoEquipoCliente.create({
    data: {
      empresaId: companyId,
      codigo,
      nombre: String(payload.nombre),
      descripcion: toOptionalString(payload.descripcion),
      orden: Number(payload.orden || 0) || 0,
      activo: Boolean(payload.activo ?? true),
      createdById: userId,
      updatedById: userId,
    },
  })
  return { item: row }
}

// ------- TIPOS SERVICIO TECNICO -------
export async function listTiposServicio(request: FastifyRequest) {
  const { companyId } = await requireBranchAuthContext(request)
  requirePermission(request, 'ordenesServicio.read')
  return {
    items: await prisma.tipoServicioTecnico.findMany({
      where: { empresaId: companyId, deletedAt: null, activo: true },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    }),
  }
}
export async function createTipoServicio(request: FastifyRequest, payload: any) {
  const { companyId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'ordenesServicio.write')
  const codigo = String(payload.codigo || '').toUpperCase().trim()
  if (!codigo || !payload.nombre) throw UNAUTH(400, 'Código y nombre son obligatorios.')
  const row = await prisma.tipoServicioTecnico.create({
    data: {
      empresaId: companyId,
      codigo,
      nombre: String(payload.nombre),
      descripcion: toOptionalString(payload.descripcion),
      tarifaBase: Number(payload.tarifaBase || 0) || 0,
      orden: Number(payload.orden || 0) || 0,
      activo: true,
      createdById: userId,
      updatedById: userId,
    },
  })
  return { item: row }
}

// ============================================================
// TECNICOS (rol TECNICO + perfil 1:1 via tabla tecnicos)
// ============================================================
const tecnicoInclude = Prisma.validator<Prisma.TecnicoInclude>()({
  usuario: {
    select: { id: true, nombres: true, apellidos: true, email: true, numeroDocumento: true, activo: true },
  },
})
export async function listTecnicos(request: FastifyRequest, inactivo = false) {
  const { companyId } = await requireBranchAuthContext(request)
  requirePermission(request, 'tecnicos.read')
  return {
    items: await prisma.tecnico.findMany({
      where: { empresaId: companyId, deletedAt: null, activo: inactivo ? undefined : true },
      include: tecnicoInclude,
      orderBy: [{ activo: 'desc' }],
    }),
  }
}
export async function getTecnico(request: FastifyRequest, id: string) {
  const { companyId } = await requireBranchAuthContext(request)
  requirePermission(request, 'tecnicos.read')
  const row = await prisma.tecnico.findFirst({
    where: { id, empresaId: companyId, deletedAt: null },
    include: tecnicoInclude,
  })
  if (!row) throw UNAUTH(404, 'Técnico no existe.')
  return { item: row }
}
export async function createTecnico(request: FastifyRequest, payload: any) {
  const { companyId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'tecnicos.write')
  const usuarioId = String(payload.usuarioId || '').trim()
  if (!usuarioId) throw UNAUTH(400, 'Se requiere usuarioId (Usuario asociado).')
  // Verificar usuario pertenezca a la empresa
  const user = await prisma.usuario.findFirst({ where: { id: usuarioId, deletedAt: null, empresaId: companyId } })
  if (!user) throw UNAUTH(404, 'Usuario no existe en la empresa.')
  // Garantizar que tenga al menos rol TECNICO (no bloqueante pero warn opcional)
  const exists = await prisma.tecnico.findFirst({ where: { usuarioId } })
  if (exists) throw UNAUTH(409, 'Usuario ya tiene perfil Técnico.')
  const esp = Array.isArray(payload.especialidades) ? payload.especialidades : []
  const row = await prisma.tecnico.create({
    data: {
      empresaId: companyId,
      usuarioId,
      codigo: String(payload.codigo || user.numeroDocumento || user.email || '').slice(0, 40),
      especialidades: esp.length ? esp : ['CELULAR'],
      activo: Boolean(payload.activo ?? true),
      createdById: userId,
      updatedById: userId,
    },
    include: tecnicoInclude,
  })
  return { item: row }
}
export async function updateTecnico(request: FastifyRequest, id: string, payload: any) {
  const { companyId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'tecnicos.write')
  const t = await prisma.tecnico.findFirst({ where: { id, empresaId: companyId, deletedAt: null } })
  if (!t) throw UNAUTH(404, 'Técnico no existe.')
  const patch: Prisma.TecnicoUpdateInput = { updatedById: userId }
  if ('codigo' in payload) patch.codigo = String(payload.codigo)
  if ('especialidades' in payload && Array.isArray(payload.especialidades)) patch.especialidades = payload.especialidades
  if ('activo' in payload) patch.activo = Boolean(payload.activo)
  if ('fechaContratacion' in payload) patch.fechaContratacion = payload.fechaContratacion ? new Date(payload.fechaContratacion) : null
  if ('fechaBaja' in payload) patch.fechaBaja = payload.fechaBaja ? new Date(payload.fechaBaja) : null
  if ('observaciones' in payload) patch.observaciones = toOptionalString(payload.observaciones)
  return { item: await prisma.tecnico.update({ where: { id }, data: patch, include: tecnicoInclude }) }
}
export async function deleteTecnico(request: FastifyRequest, id: string) {
  const { companyId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'tecnicos.write')
  const t = await prisma.tecnico.findFirst({ where: { id, empresaId: companyId, deletedAt: null } })
  if (!t) throw UNAUTH(404, 'Técnico no existe.')
  await prisma.tecnico.update({ where: { id }, data: { deletedAt: new Date(), updatedById: userId, activo: false } })
  return { ok: true }
}

// ============================================================
// CLIENTE EQUIPOS (Equipos asociados a Cliente)
// ============================================================
const clienteEquipoInclude = Prisma.validator<Prisma.ClienteEquipoInclude>()({
  tipoEquipo: true, cliente: { select: { id: true, nombresRazonSocial: true, numeroDocumento: true } },
})
export async function listEquiposCliente(request: FastifyRequest, clienteId?: string) {
  const { companyId } = await requireBranchAuthContext(request)
  requirePermission(request, 'equiposCliente.read')
  const where: Prisma.ClienteEquipoWhereInput = { empresaId: companyId, deletedAt: null }
  if (clienteId) where.clienteId = clienteId
  return { items: await prisma.clienteEquipo.findMany({ where, include: clienteEquipoInclude, orderBy: [{ createdAt: 'desc' }] }) }
}
export async function getEquipo(request: FastifyRequest, id: string) {
  const { companyId } = await requireBranchAuthContext(request)
  requirePermission(request, 'equiposCliente.read')
  const r = await prisma.clienteEquipo.findFirst({ where: { id, empresaId: companyId, deletedAt: null }, include: clienteEquipoInclude })
  if (!r) throw UNAUTH(404, 'Equipo no existe.')
  return { item: r }
}
export async function createEquipo(request: FastifyRequest, payload: any) {
  const { companyId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'equiposCliente.write')
  const clienteId = String(payload.clienteId || '').trim()
  const tipoEquipoId = String(payload.tipoEquipoId || '').trim()
  if (!clienteId || !tipoEquipoId || !payload.marca || !payload.modelo) throw UNAUTH(400, 'Falta data (clienteId/tipoEquipoId/marca/modelo).')
  const cli = await prisma.cliente.findFirst({ where: { id: clienteId, empresaId: companyId, deletedAt: null } })
  if (!cli) throw UNAUTH(404, 'Cliente no existe.')
  const tipo = await prisma.tipoEquipoCliente.findFirst({ where: { id: tipoEquipoId, empresaId: companyId } })
  if (!tipo) throw UNAUTH(404, 'Tipo Equipo no existe.')
  const row = await prisma.clienteEquipo.create({
    data: {
      empresaId: companyId,
      clienteId,
      tipoEquipoId,
      marca: String(payload.marca),
      modelo: String(payload.modelo),
      numeroSerie: toOptionalString(payload.numeroSerie),
      numeroImei: toOptionalString(payload.numeroImei),
      capacidadAlmacenamiento: toOptionalString(payload.capacidadAlmacenamiento),
      memoriaRam: toOptionalString(payload.memoriaRam),
      color: toOptionalString(payload.color),
      observaciones: toOptionalString(payload.observaciones),
      estadoFisico: String(payload.estadoFisico || 'USADO'),
      gar: Number(payload.garantiaDias || 0) || 0,
      createdById: userId,
      updatedById: userId,
    },
    include: clienteEquipoInclude,
  })
  return { item: row }
}
export async function updateEquipo(request: FastifyRequest, id: string, payload: any) {
  const { companyId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'equiposCliente.write')
  const row = await prisma.clienteEquipo.findFirst({ where: { id, empresaId: companyId, deletedAt: null } })
  if (!row) throw UNAUTH(404, 'Equipo no existe.')
  const patch: Prisma.ClienteEquipoUpdateInput = { updatedById: userId }
  for (const k of ['tipoEquipoId', 'marca', 'modelo', 'numeroSerie', 'numeroImei', 'capacidadAlmacenamiento', 'memoriaRam', 'color', 'observaciones', 'estadoFisico'] as const) {
    if (k in payload) (patch as any)[k] = toOptionalString(payload[k])
  }
  if ('garantiaDias' in payload) patch.gar = Number(payload.garantiaDias || 0) || 0
  if ('activo' in payload) patch.activo = Boolean(payload.activo)
  return { item: await prisma.clienteEquipo.update({ where: { id }, data: patch, include: clienteEquipoInclude }) }
}

// ============================================================
// ORDENES SERVICIO (módulo CENTRAL)
// ============================================================
const ordenSelect = {
  id: true, numeroOrden: true, estado: true, tipoServicioId: true,
  fechaRecepcion: true, fechaPrometida: true, fechaEntregado: true,
  clienteEquipoId: true, clienteId: true, tecnicoAsignadoId: true,
  clienteReporto: true, diagnosticoRecepcion: true,
  montoManoObra: true, montoRepuestos: true, montoServicios: true,
  subTotal: true, igvPorcentaje: true, igvMonto: true, total: true,
  saldoPendiente: true, garantiaDiasAplicados: true, garantiaVence: true,
  aprobadoPorClienteAt: true, creadoEnSucursalId: true, empresaId: true, sucursalId: true,
  createdById: true, updatedById: true, createdAt: true,
  cliente: { select: { id: true, nombresRazonSocial: true, numeroDocumento: true, telefono: true, email: true } },
  clienteEquipo: { include: { tipoEquipo: true } },
  tecnicoAsignado: { select: { id: true, usuario: { select: { nombres: true, apellidos: true } } } },
  items: { orderBy: { createdAt: 'asc' }, include: { producto: true, lote: true, tecnicoAsignado: { include: { usuario: { select: { nombres: true, apellidos: true } } } } } },
  pagos: { orderBy: { fechaPago: 'asc' }, include: { formaPago: true, movimientoCaja: true } },
  historialEstados: { orderBy: { fechaCambio: 'asc' }, include: { usuario: { select: { nombres: true, apellidos: true } } } },
  diagnosticos: { orderBy: { fechaDiagnostico: 'asc' }, include: { usuario: { select: { nombres: true, apellidos: true } } } },
  presupuestos: { orderBy: { version: 'desc' } },
  asignacionesTecnico: { orderBy: { fechaAsignacion: 'desc' }, include: { tecnico: { include: { usuario: { select: { nombres: true, apellidos: true } } } }, usuario: { select: { nombres: true, apellidos: true } } } },
  garantia: true,
} as const

type Filters = {
  estado?: EstadoOrdenServicio | EstadoOrdenServicio[]
  desde?: string
  hasta?: string
  search?: string
  sucursalId?: string
  clienteId?: string
  tecnicoAsignadoId?: string
}
export async function listOrdenesServicio(request: FastifyRequest, filters: Filters = {}) {
  const { companyId, branchId } = await requireBranchAuthContext(request)
  requirePermission(request, 'ordenesServicio.read')
  const where: Prisma.OrdenServicioWhereInput = { empresaId: companyId, deletedAt: null }
  if (filters.sucursalId) where.sucursalId = filters.sucursalId
  else where.sucursalId = branchId
  if (filters.estado) where.estado = Array.isArray(filters.estado) ? { in: filters.estado } : filters.estado
  if (filters.clienteId) where.clienteId = filters.clienteId
  if (filters.tecnicoAsignadoId) where.tecnicoAsignadoId = filters.tecnicoAsignadoId
  if (filters.desde || filters.hasta) {
    where.fechaRecepcion = {}
    if (filters.desde) (where.fechaRecepcion as any).gte = new Date(filters.desde + 'T00:00:00')
    if (filters.hasta) (where.fechaRecepcion as any).lte = new Date(filters.hasta + 'T23:59:59')
  }
  if (filters.search) {
    const s = `%${filters.search.trim().toLowerCase()}%`
    where.OR = [
      { numeroOrden: { contains: filters.search.trim() } },
      { cliente: { nombresRazonSocial: { contains: filters.search.trim(), mode: 'insensitive' } } },
      { clienteEquipo: { numeroSerie: { contains: filters.search.trim(), mode: 'insensitive' } } },
    ]
  }
  const [items, total] = await Promise.all([
    prisma.ordenServicio.findMany({
      where,
      select: ordenSelect,
      orderBy: { fechaRecepcion: 'desc' },
      take: 200,
    }),
    prisma.ordenServicio.count({ where }),
  ])
  return { items, total }
}
export async function getOrdenServicio(request: FastifyRequest, id: string) {
  const { companyId } = await requireBranchAuthContext(request)
  requirePermission(request, 'ordenesServicio.read')
  const row = await prisma.ordenServicio.findFirst({
    where: { id, empresaId: companyId, deletedAt: null },
    select: ordenSelect,
  })
  if (!row) throw UNAUTH(404, 'Orden de Servicio no existe.')
  return { item: row }
}

/**
 * Crear OrdenServicio.
 * Payload opcional: items[] + montoManuales. Genera estado inicial RECIBIDO.
 * No inserta pagos ni movimientos de caja.
 */
export async function createOrdenServicio(request: FastifyRequest, payload: any) {
  const { companyId, branchId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'ordenesServicio.write')
  const clienteId = String(payload.clienteId || '').trim()
  const clienteEquipoId = String(payload.clienteEquipoId || '').trim()
  const tipoServicioId = payload.tipoServicioId ? String(payload.tipoServicioId).trim() : null
  if (!clienteId) throw UNAUTH(400, 'clienteId es obligatorio.')
  const cliente = await prisma.cliente.findFirst({ where: { id: clienteId, empresaId: companyId, deletedAt: null } })
  if (!cliente) throw UNAUTH(404, 'Cliente no existe.')
  const sucursal = await prisma.sucursal.findFirst({ where: { id: branchId, empresaId: companyId, activo: true, deletedAt: null } })
  if (!sucursal) throw UNAUTH(409, 'Sucursal no disponible para OS.')
  let equipo: any = null
  if (clienteEquipoId) {
    equipo = await prisma.clienteEquipo.findFirst({ where: { id: clienteEquipoId, empresaId: companyId, deletedAt: null } })
    if (!equipo) throw UNAUTH(404, 'Equipo no existe en la empresa.')
  }
  // Garantía por defecto (configuración)
  let garantiaDef = 30
  try {
    const cfg = await prisma.configuracion.findFirst({
      where: { empresaId: companyId, ambito: 'EMPRESA', sucursalId: null, clave: 'GARANTIA_DEFAULT_DIAS', deletedAt: null },
    })
    if (cfg && cfg.valorNumero != null) garantiaDef = Number(cfg.valorNumero) || 30
  } catch (_) { garantiaDef = 30 }
  const garantiaDias = Number(payload.garantiaDiasAplicados ?? payload.garantiaDias ?? garantiaDef) || 0

  const fechaRecepcion = payload.fechaRecepcion ? new Date(payload.fechaRecepcion) : new Date()
  const anio = fechaRecepcion.getFullYear()

  return await prisma.$transaction(async (tx) => {
    // Numeración segura
    const { numeroOrden } = await getNextNumeroOrden(tx, companyId, branchId, sucursal.codigo, anio, userId)
    const igvPorc = Number(payload.igvPorcentaje ?? clientIgvDefault(companyId))
    // Montos: si vienen vacíos los items, aceptar 0. Endpoint separado itemsAdd agrega costo (rep / MO)
    const { subTotal = 0, totalManoObra = 0, totalRepuestos = 0, totalServicios = 0 } = calcMontosDesdeItems(payload.items || [], igvPorc)
    const igvMonto = roundMoney(subTotal * (igvPorc / 100))
    const total = roundMoney(subTotal + igvMonto)

    const orden = await tx.ordenServicio.create({
      data: {
        empresaId: companyId,
        sucursalId: branchId,
        creadoEnSucursalId: branchId,
        numeroOrden,
        estado: EstadoOrdenServicio.RECIBIDO,
        clienteId,
        clienteEquipoId: equipo?.id || null,
        tipoServicioId,
        fechaRecepcion,
        fechaPrometida: payload.fechaPrometida ? new Date(payload.fechaPrometida) : null,
        clienteReporto: toOptionalString(payload.clienteReporto),
        diagnosticoRecepcion: toOptionalString(payload.diagnosticoRecepcion),
        tecnicoAsignadoId: payload.tecnicoAsignadoId ? String(payload.tecnicoAsignadoId) : null,
        montoManoObra: toDecimal(totalManoObra, 2),
        montoRepuestos: toDecimal(totalRepuestos, 2),
        montoServicios: toDecimal(totalServicios, 2),
        subTotal: toDecimal(subTotal, 2),
        igvPorcentaje: toDecimal(igvPorc, 4),
        igvMonto: toDecimal(igvMonto, 2),
        total: toDecimal(total, 2),
        saldoPendiente: toDecimal(total, 2),
        garantiaDiasAplicados: garantiaDias,
        garantiaVence: garantiaDias > 0 ? addDays(fechaRecepcion, garantiaDias) : null,
        observaciones: toOptionalString(payload.observaciones),
        createdById: userId,
        updatedById: userId,
      },
      select: ordenSelect,
    })

    // Historial primer estado (RECIBIDO)
    await tx.ordenEstadoHistorial.create({
      data: {
        ordenServicioId: orden.id,
        estadoAnterior: null,
        estadoNuevo: EstadoOrdenServicio.RECIBIDO,
        fechaCambio: new Date(),
        usuarioId: userId,
        empresaId: companyId,
        sucursalId: branchId,
        createdById: userId,
        updatedById: userId,
        observaciones: 'Creación de la Orden de Servicio.',
      },
    })

    // Asignación inicial técnico
    if (payload.tecnicoAsignadoId) {
      const tec = await tx.tecnico.findFirst({ where: { id: String(payload.tecnicoAsignadoId), empresaId: companyId, deletedAt: null, activo: true } })
      if (!tec) throw UNAUTH(404, 'Técnico asignado no existe en la empresa.')
      await tx.ordenAsignacionTecnico.create({
        data: {
          ordenServicioId: orden.id,
          tecnicoId: tec.id,
          fechaAsignacion: new Date(),
          esPrincipal: true,
          usuarioId: userId,
          empresaId: companyId,
          sucursalId: branchId,
          observaciones: 'Asignación inicial en la creación de OS.',
          createdById: userId,
          updatedById: userId,
        },
      })
    }

    // Presupuesto v1 inicial (0 si no items)
    await tx.ordenPresupuestoVersion.create({
      data: {
        ordenServicioId: orden.id,
        version: 1,
        montoManoObra: toDecimal(totalManoObra, 2),
        montoRepuestos: toDecimal(totalRepuestos, 2),
        montoServicios: toDecimal(totalServicios, 2),
        subTotal: toDecimal(subTotal, 2),
        igvPorcentaje: toDecimal(igvPorc, 4),
        igvMonto: toDecimal(igvMonto, 2),
        total: toDecimal(total, 2),
        descripcion: toOptionalString(payload.descripcionPresupuesto) || 'Presupuesto inicial al crear OS.',
        empresaId: companyId,
        sucursalId: branchId,
        createdById: userId,
        updatedById: userId,
      },
    })

    // Items (incluir repuestos = Kardex SALIDA)
    if (Array.isArray(payload.items) && payload.items.length) {
      for (const it of payload.items) await addOrdenItemInternal(tx, orden, it, userId, companyId, branchId)
    }

    // Recalcular montos por si hubo items
    const recalc = await recalcularMontosOrden(tx, orden.id, userId, companyId, branchId)
    return { item: recalc }
  })
}

// ============================================================
// ESTADOS ORDEN: avanzar / retroceder con historial + transiciones inválidas 409
// ============================================================
const SIGUIENTE_ESTADO_RAPIDO: Partial<Record<EstadoOrdenServicio, EstadoOrdenServicio>> = {
  [EstadoOrdenServicio.RECIBIDO]: EstadoOrdenServicio.DIAGNOSTICO,
  [EstadoOrdenServicio.DIAGNOSTICO]: EstadoOrdenServicio.PRESUPUESTO,
  [EstadoOrdenServicio.PRESUPUESTO]: EstadoOrdenServicio.ESPERANDO_APROBACION,
  [EstadoOrdenServicio.ESPERANDO_APROBACION]: EstadoOrdenServicio.APROBADO,
  [EstadoOrdenServicio.APROBADO]: EstadoOrdenServicio.EN_REPARACION,
  [EstadoOrdenServicio.EN_REPARACION]: EstadoOrdenServicio.EN_PRUEBAS,
  [EstadoOrdenServicio.EN_PRUEBAS]: EstadoOrdenServicio.LISTO_PARA_ENTREGA,
  [EstadoOrdenServicio.LISTO_PARA_ENTREGA]: EstadoOrdenServicio.PENDIENTE_RETIRO,
  [EstadoOrdenServicio.PENDIENTE_RETIRO]: EstadoOrdenServicio.ENTREGADO,
}

export async function cambiarEstadoOrden(request: FastifyRequest, id: string, payload: any) {
  const { companyId, branchId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'ordenesServicio.cambioEstado')
  const estadoNuevo: EstadoOrdenServicio | undefined = payload?.estado as any
  if (!estadoNuevo) throw UNAUTH(400, 'Parámetro estado es obligatorio.')
  const observaciones = toOptionalString(payload?.observaciones)
  return await prisma.$transaction(async (tx) => {
    const orden = await tx.ordenServicio.findFirst({ where: { id, empresaId: companyId, deletedAt: null } })
    if (!orden) throw UNAUTH(404, 'Orden no existe.')
    const estadoAnterior = orden.estado
    if (estadoAnterior === estadoNuevo) {
      return { item: await tx.ordenServicio.findFirst({ where: { id }, select: ordenSelect }) }
    }
    // Validaciones de transición
    if (estadoAnterior === EstadoOrdenServicio.ENTREGADO && ![EstadoOrdenServicio.EN_GARANTIA].includes(estadoNuevo)) {
      throw UNAUTH(409, 'Orden ENTREGADA solo puede ir a EN_GARANTIA.')
    }
    if (estadoNuevo === EstadoOrdenServicio.ENTREGADO) {
      const saldo = decimalToNumber(orden.saldoPendiente)
      if (saldo > 0.005) throw UNAUTH(409, `No se puede ENTREGAR. Saldo pendiente S/ ${saldo.toFixed(2)}.`)
    }
    if (estadoNuevo === EstadoOrdenServicio.EN_GARANTIA && estadoAnterior !== EstadoOrdenServicio.ENTREGADO) {
      throw UNAUTH(409, 'EN_GARANTIA solo aplica después de ENTREGADO.')
    }
    // Si es ENTREGADO, crear registro Garantía 1:1 (si no existía)
    if (estadoNuevo === EstadoOrdenServicio.ENTREGADO) {
      await tx.ordenGarantia.upsert({
        where: { ordenServicioId: orden.id },
        create: {
          ordenServicioId: orden.id,
          empresaId: companyId,
          sucursalId: branchId,
          diasGarantia: orden.garantiaDiasAplicados,
          fechaInicio: new Date(),
          fechaFin: orden.garantiaVence || null,
          terminos: toOptionalString(payload.terminosGarantia),
          estado: 'VIGENTE',
          createdById: userId,
          updatedById: userId,
        },
        update: {
          diasGarantia: orden.garantiaDiasAplicados,
          fechaInicio: new Date(),
          fechaFin: orden.garantiaVence || null,
          estado: 'VIGENTE',
          updatedById: userId,
        },
      })
    }
    await tx.ordenServicio.update({
      where: { id },
      data: {
        estado: estadoNuevo,
        updatedById: userId,
        fechaEntregado: estadoNuevo === EstadoOrdenServicio.ENTREGADO ? new Date() : orden.fechaEntregado,
      },
    })
    await tx.ordenEstadoHistorial.create({
      data: {
        ordenServicioId: id,
        estadoAnterior,
        estadoNuevo,
        fechaCambio: new Date(),
        usuarioId: userId,
        empresaId: companyId,
        sucursalId: branchId,
        observaciones,
        createdById: userId,
        updatedById: userId,
      },
    })
    return { item: await tx.ordenServicio.findFirst({ where: { id }, select: ordenSelect }) }
  })
}

// ============================================================
// ASIGNACION TECNICO (con historial)
// ============================================================
export async function asignarTecnicoOrden(request: FastifyRequest, id: string, payload: any) {
  const { companyId, branchId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'ordenesServicio.cambioEstado')
  const tecnicoId = String(payload.tecnicoId || '').trim()
  if (!tecnicoId) throw UNAUTH(400, 'tecnicoId es obligatorio.')
  return await prisma.$transaction(async (tx) => {
    const orden = await tx.ordenServicio.findFirst({ where: { id, empresaId: companyId, deletedAt: null } })
    if (!orden) throw UNAUTH(404, 'Orden no existe.')
    const tec = await tx.tecnico.findFirst({ where: { id: tecnicoId, empresaId: companyId, deletedAt: null, activo: true } })
    if (!tec) throw UNAUTH(404, 'Técnico no existe.')
    await tx.ordenServicio.update({ where: { id }, data: { tecnicoAsignadoId: tecnicoId, updatedById: userId } })
    await tx.ordenAsignacionTecnico.create({
      data: {
        ordenServicioId: id,
        tecnicoId,
        fechaAsignacion: new Date(),
        esPrincipal: true,
        usuarioId: userId,
        empresaId: companyId,
        sucursalId: branchId,
        observaciones: toOptionalString(payload.observaciones),
        createdById: userId,
        updatedById: userId,
      },
    })
    return { item: await tx.ordenServicio.findFirst({ where: { id }, select: ordenSelect }) }
  })
}

// ============================================================
// PRESUPUESTO VERSIONAR + APROBACION CLIENTE
// ============================================================
export async function crearVersionPresupuesto(request: FastifyRequest, id: string, payload: any) {
  const { companyId, branchId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'ordenesServicio.write')
  return await prisma.$transaction(async (tx) => {
    const orden = await tx.ordenServicio.findFirst({ where: { id, empresaId: companyId, deletedAt: null } })
    if (!orden) throw UNAUTH(404, 'Orden no existe.')
    const last = await tx.ordenPresupuestoVersion.findFirst({
      where: { ordenServicioId: id }, orderBy: { version: 'desc' },
    })
    const version = last ? last.version + 1 : 1
    const igvPorc = Number(payload.igvPorcentaje ?? decimalToNumber(orden.igvPorcentaje)) || 18
    const sub = roundMoney(Number(payload.subTotal ?? payload.montoTotal ?? 0))
    const igv = roundMoney(sub * (igvPorc / 100))
    const total = roundMoney(sub + igv)
    const pv = await tx.ordenPresupuestoVersion.create({
      data: {
        ordenServicioId: id,
        version,
        descripcion: toOptionalString(payload.descripcion) || `Presupuesto v${version}`,
        montoManoObra: toDecimal(Number(payload.montoManoObra || 0), 2),
        montoRepuestos: toDecimal(Number(payload.montoRepuestos || 0), 2),
        montoServicios: toDecimal(Number(payload.montoServicios || 0), 2),
        subTotal: toDecimal(sub, 2),
        igvPorcentaje: toDecimal(igvPorc, 4),
        igvMonto: toDecimal(igv, 2),
        total: toDecimal(total, 2),
        empresaId: companyId,
        sucursalId: branchId,
        aprobadoCliente: false,
        createdById: userId,
        updatedById: userId,
      },
    })
    // Si es >v1 → estado pasa a ESPERANDO_APROBACION (solo si estado era anterior a APROBADO)
    const estadosCambioPend = [EstadoOrdenServicio.RECIBIDO, EstadoOrdenServicio.DIAGNOSTICO, EstadoOrdenServicio.PRESUPUESTO]
    if (estadosCambioPend.includes(orden.estado as any)) {
      await tx.ordenServicio.update({ where: { id }, data: { estado: EstadoOrdenServicio.ESPERANDO_APROBACION, updatedById: userId } })
      await tx.ordenEstadoHistorial.create({
        data: { ordenServicioId: id, estadoAnterior: orden.estado, estadoNuevo: EstadoOrdenServicio.ESPERANDO_APROBACION, fechaCambio: new Date(), usuarioId: userId, empresaId: companyId, sucursalId: branchId, observaciones: `Se creó presupuesto v${version}.`, createdById: userId, updatedById: userId },
      })
    }
    return { presupuesto: pv }
  })
}
export async function aprobarPresupuestoCliente(request: FastifyRequest, id: string, payload: any) {
  const { companyId, branchId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'ordenesServicio.aprobar')
  const version = Number(payload.version) || 0
  const accion = String(payload.accion || 'APROBAR').toUpperCase()
  if (!version) throw UNAUTH(400, 'version es obligatoria.')
  return await prisma.$transaction(async (tx) => {
    const orden = await tx.ordenServicio.findFirst({ where: { id, empresaId: companyId, deletedAt: null } })
    if (!orden) throw UNAUTH(404, 'Orden no existe.')
    const pv = await tx.ordenPresupuestoVersion.findFirst({ where: { ordenServicioId: id, version } })
    if (!pv) throw UNAUTH(404, `Presupuesto v${version} no existe.`)
    const aprobado = accion === 'APROBAR'
    await tx.ordenPresupuestoVersion.update({
      where: { id: pv.id },
      data: {
        aprobadoCliente: aprobado,
        fechaAprobacionCliente: new Date(),
        usuarioAprobacionClienteId: userId,
        comentariosCliente: toOptionalString(payload.comentarios),
        updatedById: userId,
      },
    })
    if (aprobado) {
      // Actualiza montos de orden según el presupuesto aprobado oficial
      const newSub = decimalToNumber(pv.subTotal)
      const igv = decimalToNumber(pv.igvMonto)
      const total = roundMoney(newSub + igv)
      await tx.ordenServicio.update({
        where: { id },
        data: {
          montoManoObra: pv.montoManoObra,
          montoRepuestos: pv.montoRepuestos,
          montoServicios: pv.montoServicios,
          subTotal: pv.subTotal,
          igvPorcentaje: pv.igvPorcentaje,
          igvMonto: pv.igvMonto,
          total: toDecimal(total, 2),
          saldoPendiente: toDecimal(total, 2),
          aprobadoPorClienteAt: new Date(),
          estado: EstadoOrdenServicio.APROBADO,
          updatedById: userId,
        },
      })
      await tx.ordenEstadoHistorial.create({
        data: { ordenServicioId: id, estadoAnterior: orden.estado, estadoNuevo: EstadoOrdenServicio.APROBADO, fechaCambio: new Date(), usuarioId: userId, empresaId: companyId, sucursalId: branchId, observaciones: `Cliente aprueba presupuesto v${version}.`, createdById: userId, updatedById: userId },
      })
    }
    return { ok: true, aprobado }
  })
}

// ============================================================
// DIAGNOSTICOS
// ============================================================
export async function addDiagnostico(request: FastifyRequest, id: string, payload: any) {
  const { companyId, branchId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'ordenesServicio.write')
  const texto = String(payload.diagnostico || '').trim()
  if (!texto) throw UNAUTH(400, 'diagnostico es obligatorio.')
  return await prisma.$transaction(async (tx) => {
    const orden = await tx.ordenServicio.findFirst({ where: { id, empresaId: companyId, deletedAt: null } })
    if (!orden) throw UNAUTH(404, 'Orden no existe.')
    const d = await tx.ordenDiagnostico.create({
      data: {
        ordenServicioId: id,
        tecnicoId: toOptionalString(payload.tecnicoId),
        fechaDiagnostico: new Date(),
        diagnostico: texto,
        recomendaciones: toOptionalString(payload.recomendaciones),
        requiereRepuestos: Boolean(payload.requiereRepuestos ?? false),
        empresaId: companyId,
        sucursalId: branchId,
        usuarioId: userId,
        createdById: userId,
        updatedById: userId,
      },
    })
    // Si estado era RECIBIDO → pasa a DIAGNOSTICO automáticamente (opcional)
    if (orden.estado === EstadoOrdenServicio.RECIBIDO) {
      await tx.ordenServicio.update({ where: { id }, data: { estado: EstadoOrdenServicio.DIAGNOSTICO, updatedById: userId } })
      await tx.ordenEstadoHistorial.create({
        data: { ordenServicioId: id, estadoAnterior: EstadoOrdenServicio.RECIBIDO, estadoNuevo: EstadoOrdenServicio.DIAGNOSTICO, fechaCambio: new Date(), usuarioId: userId, empresaId: companyId, sucursalId: branchId, observaciones: 'Diagnóstico inicial registrado.', createdById: userId, updatedById: userId },
      })
    }
    return { diagnostico: d }
  })
}

// ============================================================
// ITEMS SERVICIO (REPUESTO → genera Kardex SALIDA; MO/SERVICIO/ACC no)
// ============================================================
export async function addOrdenItem(request: FastifyRequest, ordenId: string, payload: any) {
  const { companyId, branchId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'ordenesServicio.write')
  return await prisma.$transaction(async (tx) => {
    const orden = await tx.ordenServicio.findFirst({ where: { id: ordenId, empresaId: companyId, deletedAt: null }, select: ordenSelect })
    if (!orden) throw UNAUTH(404, 'Orden no existe.')
    await addOrdenItemInternal(tx, orden as any, payload, userId, companyId, branchId)
    return { item: await recalcularMontosOrden(tx, ordenId, userId, companyId, branchId) }
  })
}
export async function deleteOrdenItem(request: FastifyRequest, itemId: string) {
  const { companyId, userId, branchId } = await requireBranchAuthContext(request)
  requirePermission(request, 'inventarioServicio.write')
  return await prisma.$transaction(async (tx) => {
    const item = await tx.ordenItemServicio.findFirst({ where: { id: itemId, empresaId: companyId, deletedAt: null } })
    if (!item) throw UNAUTH(404, 'Item no existe.')
    // Si era REPUESTO y tenía loteId: devolver stock (MovimientoInventario ORIGEN DEVOLUCION)
    if (item.tipo === TipoItemOrdenServicio.REPUESTO && item.loteId && item.productoId) {
      const qty = Math.max(0, Number(item.cantidad || 0))
      if (qty > 0) {
        const lote = await tx.lote.findFirst({ where: { id: item.loteId, empresaId: companyId, deletedAt: null } })
        if (lote) {
          const costoUnit = lote.costoUnitario
          const prevStock = decimalToNumber(lote.stockDisponible)
          const nextStock = prevStock + qty
          await tx.lote.update({ where: { id: lote.id }, data: { stockDisponible: toDecimal(nextStock, 4), updatedById: userId } })
          const prodPrev = decimalToNumber(
            (await tx.producto.findFirst({
              where: { id: item.productoId, empresaId: companyId },
              select: { stockTotal: true },
            }))?.stockTotal || 0,
          )
          await tx.producto.update({ where: { id: item.productoId }, data: { stockTotal: toDecimal(prodPrev + qty, 4), updatedById: userId } })
          await tx.movimientoInventario.create({
            data: {
              sucursalId: branchId, productoId: item.productoId, loteId: item.loteId,
              tipo: TipoMovimientoInventario.INGRESO,
              origen: OrigenMovimientoInventario.SERVICIO_TECNICO_DEVOLUCION,
              cantidad: toDecimal(qty, 4) as any,
              costoUnitario: costoUnit,
              stockResultante: toDecimal(nextStock, 4),
              referencia: `Devolución ${item.id.slice(0, 6)} OS`,
              ordenServicioId: item.ordenServicioId,
              itemOrdenServicioId: item.id,
              createdById: userId,
              updatedById: userId,
            },
          })
        }
      }
    }
    await tx.ordenItemServicio.update({ where: { id: item.id }, data: { deletedAt: new Date(), updatedById: userId } })
    return { ok: true, item: await recalcularMontosOrden(tx, item.ordenServicioId, userId, companyId, branchId) }
  })
}

// ============================================================
// PAGOS ORDEN (1:N) + MOVIMIENTO_CAJA INGRESO 1:1 UNIQUE
// ============================================================
export async function registrarPagoOrden(request: FastifyRequest, id: string, payload: any) {
  const { companyId, branchId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'pagosOrdenServicio.write')
  const monto = Number(payload.monto || 0)
  const formaPagoId = String(payload.formaPagoId || '').trim()
  if (monto <= 0) throw UNAUTH(400, 'monto > 0 es obligatorio.')
  if (!formaPagoId) throw UNAUTH(400, 'formaPagoId es obligatorio.')
  const fechaPago = payload.fechaPago ? new Date(payload.fechaPago) : new Date()
  return await prisma.$transaction(async (tx) => {
    const orden = await tx.ordenServicio.findFirst({ where: { id, empresaId: companyId, deletedAt: null } })
    if (!orden) throw UNAUTH(404, 'Orden no existe.')
    const fp = await tx.formaPago.findFirst({ where: { id: formaPagoId, empresaId: companyId, deletedAt: null, activo: true } })
    if (!fp) throw UNAUTH(404, 'Forma de pago no existe.')
    // Determinar apertura caja vigente en sucursal
    // Requisito: debe haber una apertura de caja abierta.
    const apertura = await tx.aperturaCaja.findFirst({
      where: { deletedAt: null, caja: { sucursalId: branchId, empresaId: companyId, activo: true }, estado: 'ABIERTA' as any },
      orderBy: { fechaApertura: 'desc' },
    })
    if (!apertura) throw UNAUTH(409, 'No hay una caja abierta en la sucursal. Abre caja antes de registrar pagos.')
    const totalActual = decimalToNumber(orden.total)
    const pagadoActual = (await tx.ordenServicioPago.aggregate({ _sum: { monto: true }, where: { ordenServicioId: id, deletedAt: null } }))._sum.monto
    const totalPagado = decimalToNumber(pagadoActual)
    const saldo = Math.max(0, roundMoney(totalActual - totalPagado))
    if (monto - saldo > 0.005) throw UNAUTH(409, `Monto S/ ${monto.toFixed(2)} excede saldo pendiente S/ ${saldo.toFixed(2)}.`)
    const mov = await tx.movimientoCaja.create({
      data: {
        aperturaCajaId: apertura.id,
        tipo: TipoMovimientoCaja.SERVICIO_TECNICO,
        operacion: OperacionCaja.INGRESO,
        monto: toDecimal(monto, 2),
        fechaMovimiento: fechaPago,
        referencia: `Pago OS ${orden.numeroOrden}`,
        formaPagoId: fp.id,
        observaciones: toOptionalString(payload.observaciones),
        createdById: userId,
        updatedById: userId,
      },
    })
    const pago = await tx.ordenServicioPago.create({
      data: {
        ordenServicioId: id,
        formaPagoId: fp.id,
        monto: toDecimal(monto, 2),
        fechaPago,
        observaciones: toOptionalString(payload.observaciones),
        movimientoCajaId: mov.id, // UNIQUE constraint garantiza 1:1
        empresaId: companyId,
        sucursalId: branchId,
        createdById: userId,
        updatedById: userId,
      },
    })
    const nuevoPagado = totalPagado + monto
    const nuevoSaldo = Math.max(0, roundMoney(totalActual - nuevoPagado))
    await tx.ordenServicio.update({ where: { id }, data: { saldoPendiente: toDecimal(nuevoSaldo, 2), updatedById: userId } })
    return { pago, orden: await tx.ordenServicio.findFirst({ where: { id }, select: ordenSelect }) }
  })
}

// ============================================================
// HELPERS INTERNOS
// ============================================================
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + (Number(n) || 0)); return r
}
async function clientIgvDefault(empresaId: string): Promise<number> {
  try {
    const emp = await prisma.empresa.findFirst({ where: { id: empresaId }, select: { igvPorDefecto: true } })
    return Number(emp?.igvPorDefecto || 18)
  } catch { return 18 }
}
function calcMontosDesdeItems(items: any[], igvPorc: number) {
  if (!items || !items.length) return { totalManoObra: 0, totalRepuestos: 0, totalServicios: 0, subTotal: 0 }
  let mo = 0, rep = 0, ser = 0, sub = 0
  for (const it of items) {
    const tipo: TipoItemOrdenServicio = it.tipo || TipoItemOrdenServicio.MANO_OBRA
    const qty = Math.max(0, Number(it.cantidad || 1) || 1)
    const pu = Math.max(0, Number(it.precioUnitario || 0) || 0)
    const totalLinea = roundMoney(qty * pu)
    if (tipo === TipoItemOrdenServicio.MANO_OBRA) mo += totalLinea
    else if (tipo === TipoItemOrdenServicio.REPUESTO) rep += totalLinea
    else ser += totalLinea
    sub += totalLinea
  }
  return { totalManoObra: mo, totalRepuestos: rep, totalServicios: ser, subTotal: roundMoney(sub) }
}

async function addOrdenItemInternal(
  tx: Prisma.TransactionClient,
  orden: { id: string; empresaId: string; sucursalId: string; numeroOrden: string },
  payload: any,
  userId: string,
  companyId: string,
  branchId: string,
) {
  const tipo: TipoItemOrdenServicio = payload.tipo || TipoItemOrdenServicio.MANO_OBRA
  const qty = Math.max(0, Number(payload.cantidad || 1) || 1)
  const pu = Math.max(0, Number(payload.precioUnitario || 0) || 0)
  const totalLinea = roundMoney(qty * pu)
  const dataLinea: any = {
    ordenServicioId: orden.id,
    tipo,
    descripcion: toOptionalString(payload.descripcion) || (tipo === TipoItemOrdenServicio.MANO_OBRA ? 'Mano de obra' : tipo === TipoItemOrdenServicio.REPUESTO ? 'Repuesto' : tipo === TipoItemOrdenServicio.SERVICIO_ADICIONAL ? 'Servicio Adicional' : 'Accesorio entregado'),
    cantidad: toDecimal(qty, 4) as any,
    precioUnitario: toDecimal(pu, 2),
    subtotal: toDecimal(totalLinea, 2),
    estado: 'PENDIENTE',
    observaciones: toOptionalString(payload.observaciones),
    empresaId: companyId,
    sucursalId: branchId,
    createdById: userId,
    updatedById: userId,
    tecnicoAsignadoId: toOptionalString(payload.tecnicoAsignadoId),
    garantiaDias: Number(payload.garantiaDias || 0) || 0,
  }
  if (tipo === TipoItemOrdenServicio.REPUESTO) {
    // Requiere productoId + loteId (solo lotes existentes, stock actualiza).
    const productoId = String(payload.productoId || '').trim()
    const loteId = String(payload.loteId || '').trim()
    if (!productoId) throw UNAUTH(400, 'Item tipo REPUESTO requiere productoId.')
    const prod = await tx.producto.findFirst({ where: { id: productoId, empresaId: companyId, deletedAt: null } })
    if (!prod) throw UNAUTH(404, 'Producto (repuesto) no existe.')
    // Rechazar si el uso del producto no permite servicio técnico
    const uso: any = (prod as any).usoServicioTecnico || 'AMBOS'
    if (uso === 'SOLO_VENTA') throw UNAUTH(409, 'Producto está marcado como SOLO_VENTA, no puede ser repuesto.')
    let costoUnitario = prod.costoUnitarioPromedio
    let nextStockLote = 0
    let stockAnteriorLote = 0
    let lote: any = null
    if (loteId) {
      lote = await tx.lote.findFirst({ where: { id: loteId, productoId, empresaId: companyId, deletedAt: null } })
      if (!lote) throw UNAUTH(404, 'Lote del repuesto no existe.')
      dataLinea.loteId = lote.id
      costoUnitario = lote.costoUnitario
      stockAnteriorLote = decimalToNumber(lote.stockDisponible)
      if (stockAnteriorLote - qty < -0.0001) throw UNAUTH(409, `Stock insuficiente en lote: ${stockAnteriorLote} < ${qty}.`)
      nextStockLote = stockAnteriorLote - qty
      await tx.lote.update({ where: { id: lote.id }, data: { stockDisponible: toDecimal(nextStockLote, 4), updatedById: userId } })
    }
    dataLinea.productoId = prod.id
    dataLinea.costoUnitario = costoUnitario
    // Actualizar producto stock total (si había lote)
    if (lote) {
      const stPrev = decimalToNumber((await tx.producto.findFirst({ where: { id: productoId }, select: { stockTotal: true } }))?.stockTotal || 0)
      await tx.producto.update({ where: { id: productoId }, data: { stockTotal: toDecimal(Math.max(0, stPrev - qty), 4), updatedById: userId } })
    }
    // Item lo creamos primero para tener su id y referenciarlo en Kardex
    const item = await tx.ordenItemServicio.create({ data: dataLinea })
    // Generar Kardex SALIDA por el lote, origen SERVICIO_TECNICO_CONSUMO
    if (lote) {
      await tx.movimientoInventario.create({
        data: {
          sucursalId: branchId, productoId: prod.id, loteId: lote.id,
          motivoId: await getMotivoConsumoIdRT(tx),
          tipo: TipoMovimientoInventario.SALIDA,
          origen: OrigenMovimientoInventario.SERVICIO_TECNICO_CONSUMO,
          cantidad: toDecimal(qty, 4) as any,
          costoUnitario: costoUnitario,
          stockResultante: toDecimal(nextStockLote, 4),
          referencia: `Consumo repuesto OS ${orden.numeroOrden} ${prod.nombre.slice(0, 32)}`,
          observaciones: toOptionalString(payload.observacionesKardex),
          ordenServicioId: orden.id,
          itemOrdenServicioId: item.id,
          createdById: userId,
          updatedById: userId,
        },
      })
    }
    return item
  } else {
    // MO / SERVICIO_ADICIONAL / ACCESORIO_ENTREGADO no afectan kardex
    return await tx.ordenItemServicio.create({ data: dataLinea })
  }
}

async function getMotivoConsumoIdRT(tx: Prisma.TransactionClient | PrismaClient): Promise<string | null> {
  try {
    const r = await prisma.motivoMovimientoInventario.findFirst({ where: { codigo: 'CONSUMO_ORDEN_SERVICIO' } })
    return r?.id || null
  } catch { return null }
}

async function recalcularMontosOrden(
  tx: Prisma.TransactionClient,
  ordenId: string,
  userId: string,
  empresaId: string,
  _sucursalId: string,
) {
  const items = await tx.ordenItemServicio.findMany({ where: { ordenServicioId: ordenId, deletedAt: null } })
  let mo = 0, rep = 0, ser = 0
  for (const it of items) {
    const t = Number(it.subTotal || 0)
    if (it.tipo === TipoItemOrdenServicio.MANO_OBRA) mo += t
    else if (it.tipo === TipoItemOrdenServicio.REPUESTO) rep += t
    else ser += t
  }
  const sub = roundMoney(mo + rep + ser)
  const orden = await tx.ordenServicio.findFirst({ where: { id: ordenId, empresaId } })
  if (!orden) throw UNAUTH(404, 'Orden no existe al recalcular.')
  const igvPorc = decimalToNumber(orden.igvPorcentaje) || 18
  const igv = roundMoney(sub * (igvPorc / 100))
  const total = roundMoney(sub + igv)
  // Recalcular saldo pendiente con base a pagos actuales
  const pagadoSum = (await tx.ordenServicioPago.aggregate({ _sum: { monto: true }, where: { ordenServicioId: ordenId, deletedAt: null } }))._sum.monto
  const pagado = decimalToNumber(pagadoSum)
  const saldo = Math.max(0, roundMoney(total - pagado))
  return await tx.ordenServicio.update({
    where: { id: ordenId },
    data: {
      montoManoObra: toDecimal(mo, 2),
      montoRepuestos: toDecimal(rep, 2),
      montoServicios: toDecimal(ser, 2),
      subTotal: toDecimal(sub, 2),
      igvMonto: toDecimal(igv, 2),
      total: toDecimal(total, 2),
      saldoPendiente: toDecimal(saldo, 2),
      updatedById: userId,
    },
    select: ordenSelect,
  })
}
