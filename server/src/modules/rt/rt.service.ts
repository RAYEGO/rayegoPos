// ==============================================================
// RayegoTech (RT) Servicio Técnico — Lógica Backend
// Fastify Plugin-style service functions.
// Nombres alineados EXACTAMENTE a prisma/schema.prisma v actual.
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
import { requireBranchAuthContext, requirePermission } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'

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

function httpError(statusCode: number, message: string): Error {
  const err = new Error(message) as any
  err.statusCode = statusCode
  return err
}
const UNAUTH = (s: number, m: string) => httpError(s, m)

// ============================================================
// HELPERS: scope por empresa
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
  _empresaId: string,
  sucursalId: string,
  sucursalCodigo: string,
  anio: number,
  userId: string,
): Promise<{ numeroOrden: string; proximoNumero: number }> {
  const row = await db.$queryRawUnsafe<Array<{ proximo_numero: number }>>(`
    UPDATE secuencias_ordenes_servicio
    SET proximo_numero = proximo_numero + 1, updated_at = NOW(), updated_by = $5::uuid
    WHERE sucursal_id = $2::uuid AND anio = $3::int
    RETURNING proximo_numero;
  `, _empresaId, sucursalId, anio, userId, userId)
  let proximo = row && row[0] ? row[0].proximo_numero : 0
  if (!proximo) {
    const ins = await db.$queryRawUnsafe<Array<{ proximo_numero: number }>>(`
      INSERT INTO secuencias_ordenes_servicio
        (id, empresa_id, sucursal_id, anio, proximo_numero, created_at, updated_at, created_by, updated_by)
      VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::int, 1, NOW(), NOW(), $4::uuid, $4::uuid)
      ON CONFLICT (sucursal_id, anio) DO UPDATE SET proximo_numero = secuencias_ordenes_servicio.proximo_numero + 1
      RETURNING proximo_numero;
    `, _empresaId, sucursalId, anio, userId)
    proximo = ins && ins[0] ? ins[0].proximo_numero : 1
  }
  const codSuc = sucursalCodigo.padStart(3, '0').toUpperCase()
  const sec = String(proximo).padStart(5, '0')
  return { numeroOrden: `OS-${codSuc}-${anio}-${sec}`, proximoNumero: proximo }
}

// ============================================================
// CATALOGOS: tiposEquipos, tiposServicio
// ============================================================
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
  const exists = await prisma.tipoEquipoCliente.findFirst({ where: { empresaId: companyId, codigo } })
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
      orden: Number(payload.orden || 0) || 0,
      activo: true,
      createdById: userId,
      updatedById: userId,
    },
  })
  return { item: row }
}

// ============================================================
// TECNICOS
// Columnas schema: id, usuarioId, legajo, especialidad, telefono,
// emailContacto, estado, observaciones, activo, + relaciones/auditoria
// ============================================================
export async function listTecnicos(request: FastifyRequest, inactivo = false) {
  const { companyId } = await requireBranchAuthContext(request)
  requirePermission(request, 'tecnicos.read')
  return {
    items: await prisma.tecnico.findMany({
      where: {
        usuario: { empresaId: companyId, deletedAt: null },
        deletedAt: null,
        activo: inactivo ? undefined : true,
      },
      include: {
        usuario: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            email: true,
            numeroDocumento: true,
            activo: true,
          },
        },
      },
      orderBy: [{ activo: 'desc' }],
    }),
  }
}
export async function getTecnico(request: FastifyRequest, id: string) {
  const { companyId } = await requireBranchAuthContext(request)
  requirePermission(request, 'tecnicos.read')
  const row = await prisma.tecnico.findFirst({
    where: { id, usuario: { empresaId: companyId }, deletedAt: null },
    include: {
      usuario: {
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          email: true,
          numeroDocumento: true,
          activo: true,
        },
      },
    },
  })
  if (!row) throw UNAUTH(404, 'Técnico no existe.')
  return { item: row }
}
export async function createTecnico(request: FastifyRequest, payload: any) {
  const { companyId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'tecnicos.write')
  const usuarioId = String(payload.usuarioId || '').trim()
  if (!usuarioId) throw UNAUTH(400, 'Se requiere usuarioId (Usuario asociado).')
  const user = await prisma.usuario.findFirst({
    where: { id: usuarioId, deletedAt: null, empresaId: companyId },
  })
  if (!user) throw UNAUTH(404, 'Usuario no existe en la empresa.')
  const exists = await prisma.tecnico.findFirst({ where: { usuarioId } })
  if (exists) throw UNAUTH(409, 'Usuario ya tiene perfil Técnico.')
  const esp = Array.isArray(payload.especialidades) ? payload.especialidades : []
  const row = await prisma.tecnico.create({
    data: {
      usuarioId,
      legajo: String(payload.legajo || user.numeroDocumento || user.email || '').slice(0, 30) || undefined,
      especialidad: esp.length ? esp.join(', ') : (payload.especialidad ? String(payload.especialidad) : null),
      telefono: toOptionalString(payload.telefono),
      emailContacto: toOptionalString(payload.email),
      estado: 'ACTIVO',
      observaciones: toOptionalString(payload.observaciones),
      activo: Boolean(payload.activo ?? true),
      createdById: userId,
      updatedById: userId,
    },
    include: {
      usuario: {
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          email: true,
          numeroDocumento: true,
          activo: true,
        },
      },
    },
  })
  return { item: row }
}
export async function updateTecnico(request: FastifyRequest, id: string, payload: any) {
  const { companyId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'tecnicos.write')
  const t = await prisma.tecnico.findFirst({
    where: { id, usuario: { empresaId: companyId }, deletedAt: null },
  })
  if (!t) throw UNAUTH(404, 'Técnico no existe.')
  const patch: any = { updatedById: userId }
  if ('legajo' in payload) patch.legajo = toOptionalString(payload.legajo) || undefined
  if ('especialidad' in payload) patch.especialidad = toOptionalString(payload.especialidad)
  if ('especialidades' in payload && Array.isArray(payload.especialidades)) {
    patch.especialidad = payload.especialidades.length ? payload.especialidades.join(', ') : null
  }
  if ('telefono' in payload) patch.telefono = toOptionalString(payload.telefono)
  if ('email' in payload || 'emailContacto' in payload) {
    patch.emailContacto = toOptionalString(payload.emailContacto ?? payload.email)
  }
  if ('estado' in payload) patch.estado = String(payload.estado || 'ACTIVO')
  if ('activo' in payload) patch.activo = Boolean(payload.activo)
  if ('observaciones' in payload) patch.observaciones = toOptionalString(payload.observaciones)
  return {
    item: await prisma.tecnico.update({
      where: { id },
      data: patch,
      include: {
        usuario: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            email: true,
            numeroDocumento: true,
            activo: true,
          },
        },
      },
    }),
  }
}
export async function deleteTecnico(request: FastifyRequest, id: string) {
  const { companyId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'tecnicos.write')
  const t = await prisma.tecnico.findFirst({
    where: { id, usuario: { empresaId: companyId }, deletedAt: null },
  })
  if (!t) throw UNAUTH(404, 'Técnico no existe.')
  await prisma.tecnico.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: userId, activo: false },
  })
  return { ok: true }
}

// ============================================================
// CLIENTE EQUIPOS
// Columnas schema: id,empresaId,clienteId,tipoEquipoId,marca,modelo,
// numeroSerie,accesorios,notasInternas,activo + auditoria
// ============================================================
export async function listEquiposCliente(request: FastifyRequest, clienteId?: string) {
  const { companyId } = await requireBranchAuthContext(request)
  requirePermission(request, 'equiposCliente.read')
  const where: Prisma.ClienteEquipoWhereInput = { empresaId: companyId, deletedAt: null }
  if (clienteId) where.clienteId = clienteId
  return {
    items: await prisma.clienteEquipo.findMany({
      where,
      include: {
        tipoEquipo: true,
        cliente: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            razonSocial: true,
            nombreCompleto: true,
            numeroDocumento: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    }),
  }
}
export async function getEquipo(request: FastifyRequest, id: string) {
  const { companyId } = await requireBranchAuthContext(request)
  requirePermission(request, 'equiposCliente.read')
  const r = await prisma.clienteEquipo.findFirst({
    where: { id, empresaId: companyId, deletedAt: null },
    include: {
      tipoEquipo: true,
      cliente: {
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          razonSocial: true,
          nombreCompleto: true,
          numeroDocumento: true,
        },
      },
    },
  })
  if (!r) throw UNAUTH(404, 'Equipo no existe.')
  return { item: r }
}
export async function createEquipo(request: FastifyRequest, payload: any) {
  const { companyId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'equiposCliente.write')
  const clienteId = String(payload.clienteId || '').trim()
  const tipoEquipoId = String(payload.tipoEquipoId || '').trim()
  if (!clienteId || !tipoEquipoId || !payload.marca || !payload.modelo)
    throw UNAUTH(400, 'Falta data (clienteId/tipoEquipoId/marca/modelo).')
  const cli = await prisma.cliente.findFirst({
    where: { id: clienteId, empresaId: companyId, deletedAt: null },
  })
  if (!cli) throw UNAUTH(404, 'Cliente no existe.')
  const tipo = await prisma.tipoEquipoCliente.findFirst({
    where: { id: tipoEquipoId, empresaId: companyId },
  })
  if (!tipo) throw UNAUTH(404, 'Tipo Equipo no existe.')
  const row = await prisma.clienteEquipo.create({
    data: {
      empresaId: companyId,
      clienteId,
      tipoEquipoId,
      marca: String(payload.marca),
      modelo: String(payload.modelo),
      numeroSerie: toOptionalString(payload.numeroSerie),
      accesorios: toOptionalString(payload.accesorios),
      notasInternas: toOptionalString(payload.observaciones),
      activo: true,
      createdById: userId,
      updatedById: userId,
    },
    include: {
      tipoEquipo: true,
      cliente: {
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          razonSocial: true,
          nombreCompleto: true,
          numeroDocumento: true,
        },
      },
    },
  })
  return { item: row }
}
export async function updateEquipo(request: FastifyRequest, id: string, payload: any) {
  const { companyId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'equiposCliente.write')
  const row = await prisma.clienteEquipo.findFirst({
    where: { id, empresaId: companyId, deletedAt: null },
  })
  if (!row) throw UNAUTH(404, 'Equipo no existe.')
  const patch: any = { updatedById: userId }
  for (const k of [
    'tipoEquipoId',
    'marca',
    'modelo',
    'numeroSerie',
    'accesorios',
    'notasInternas',
  ] as const) {
    if (k in payload) patch[k] = toOptionalString(payload[k])
  }
  if ('observaciones' in payload) patch.notasInternas = toOptionalString(payload.observaciones)
  if ('activo' in payload) patch.activo = Boolean(payload.activo)
  return {
    item: await prisma.clienteEquipo.update({
      where: { id },
      data: patch,
      include: {
        tipoEquipo: true,
        cliente: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            razonSocial: true,
            nombreCompleto: true,
            numeroDocumento: true,
          },
        },
      },
    }),
  }
}

// ============================================================
// ORDENES SERVICIO (CENTRAL)
// ============================================================
const ordenInclude: any = {
  cliente: {
    select: {
      id: true,
      nombres: true,
      apellidos: true,
      razonSocial: true,
      nombreCompleto: true,
      numeroDocumento: true,
      telefono: true,
      email: true,
    },
  },
  clienteEquipo: { include: { tipoEquipo: true } },
  tecnicoAsignado: {
    include: {
      usuario: { select: { id: true, nombres: true, apellidos: true } },
    },
  },
  items: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    include: {
      producto: true,
      lote: true,
      tipoServicio: true,
      tecnico: {
        include: {
          usuario: { select: { id: true, nombres: true, apellidos: true } },
        },
      },
    },
  },
  pagos: {
    where: { deletedAt: null },
    orderBy: { fechaPago: 'asc' },
    include: { formaPago: true, movimientoCaja: true },
  },
  historialEstados: {
    where: { deletedAt: null },
    orderBy: { fecha: 'asc' },
    include: {
      realizadoPor: { select: { id: true, nombres: true, apellidos: true } },
    },
  },
  diagnosticos: {
    where: { deletedAt: null },
    orderBy: { fecha: 'asc' },
    include: {
      tecnico: true,
      creadoPor: { select: { id: true, nombres: true, apellidos: true } },
    },
  },
  presupuestos: {
    where: { deletedAt: null },
    orderBy: { version: 'desc' },
  },
  asignacionesTecnico: {
    where: { deletedAt: null },
    orderBy: { fechaAsignacion: 'desc' },
    include: {
      tecnico: {
        include: {
          usuario: { select: { id: true, nombres: true, apellidos: true } },
        },
      },
    },
  },
  garantias: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
}

function flatClienteNombre(c: any): string | null {
  if (!c) return null
  return c.razonSocial || c.nombreCompleto || [c.nombres, c.apellidos].filter(Boolean).join(' ').trim() || null
}

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
  if (filters.estado) {
    where.estadoActual = Array.isArray(filters.estado) ? { in: filters.estado } : filters.estado
  }
  if (filters.clienteId) where.clienteId = filters.clienteId
  if (filters.tecnicoAsignadoId) where.tecnicoAsignadoId = filters.tecnicoAsignadoId
  if (filters.desde || filters.hasta) {
    where.fechaRecepcion = {} as any
    if (filters.desde) (where.fechaRecepcion as any).gte = new Date(filters.desde + 'T00:00:00')
    if (filters.hasta) (where.fechaRecepcion as any).lte = new Date(filters.hasta + 'T23:59:59')
  }
  if (filters.search) {
    const q = filters.search.trim()
    where.OR = [
      { numeroOrden: { contains: q, mode: 'insensitive' } },
      {
        cliente: {
          OR: [
            { numeroDocumento: { contains: q, mode: 'insensitive' } },
            { razonSocial: { contains: q, mode: 'insensitive' } },
            { nombreCompleto: { contains: q, mode: 'insensitive' } },
            { nombres: { contains: q, mode: 'insensitive' } },
            { apellidos: { contains: q, mode: 'insensitive' } },
          ],
        },
      },
      { clienteEquipo: { numeroSerie: { contains: q, mode: 'insensitive' } } },
    ] as any
  }
  const [items, total] = await Promise.all([
    prisma.ordenServicio.findMany({
      where,
      include: ordenInclude,
      orderBy: { fechaRecepcion: 'desc' },
      take: 200,
    }),
    prisma.ordenServicio.count({ where }),
  ])
  const itemsNormalizado = items.map((o: any) => ({
    ...o,
    estado: o.estadoActual,
    cliente: o.cliente
      ? { ...o.cliente, nombresRazonSocial: flatClienteNombre(o.cliente) }
      : o.cliente,
    tipoServicioId: o.tipoServicioId,
    fechaEntregado: o.fechaEntregaReal,
    fechaPrometida: o.fechaEntregaEstimada,
    clienteReporto: o.problemaReportado,
    diagnosticoRecepcion: toOptionalString(o.observacionesInternas),
    montoManoObra: decimalToNumber(o.subtotalManoObra),
    montoRepuestos: decimalToNumber(o.subtotalRepuestos),
    montoServicios: decimalToNumber(o.subtotalServiciosAdic),
    subTotal: decimalToNumber(o.subtotalRepuestos) +
      decimalToNumber(o.subtotalManoObra) +
      decimalToNumber(o.subtotalServiciosAdic) -
      decimalToNumber(o.descuentoTotal),
    igvPorcentaje: decimalToNumber(o.impuestoTotal) > 0
      ? 18
      : 0,
    igvMonto: decimalToNumber(o.impuestoTotal),
    total: decimalToNumber(o.totalOrden),
    totalFinal: decimalToNumber(o.totalOrden),
    saldoPendiente: decimalToNumber(o.saldoPendiente),
    garantiaVence: null,
    creadoEnSucursalId: o.sucursalId,
  }))
  return { items: itemsNormalizado, total }
}

export async function getOrdenServicio(request: FastifyRequest, id: string) {
  const { companyId } = await requireBranchAuthContext(request)
  requirePermission(request, 'ordenesServicio.read')
  const row = await prisma.ordenServicio.findFirst({
    where: { id, empresaId: companyId, deletedAt: null },
    include: ordenInclude,
  })
  if (!row) throw UNAUTH(404, 'Orden de Servicio no existe.')
  const o = row as any
  return {
    item: {
      ...o,
      estado: o.estadoActual,
      cliente: o.cliente
        ? { ...o.cliente, nombresRazonSocial: flatClienteNombre(o.cliente) }
        : o.cliente,
      fechaEntregado: o.fechaEntregaReal,
      fechaPrometida: o.fechaEntregaEstimada,
      clienteReporto: o.problemaReportado,
      diagnosticoRecepcion: toOptionalString(o.observacionesInternas),
      montoManoObra: decimalToNumber(o.subtotalManoObra),
      montoRepuestos: decimalToNumber(o.subtotalRepuestos),
      montoServicios: decimalToNumber(o.subtotalServiciosAdic),
      subTotal: decimalToNumber(o.subtotalRepuestos) +
        decimalToNumber(o.subtotalManoObra) +
        decimalToNumber(o.subtotalServiciosAdic) -
        decimalToNumber(o.descuentoTotal),
      igvPorcentaje: decimalToNumber(o.impuestoTotal) > 0 ? 18 : 0,
      igvMonto: decimalToNumber(o.impuestoTotal),
      total: decimalToNumber(o.totalOrden),
      totalFinal: decimalToNumber(o.totalOrden),
      saldoPendiente: decimalToNumber(o.saldoPendiente),
      garantiaVence: null,
      creadoEnSucursalId: o.sucursalId,
    },
  }
}

// Helper para crear Orden. Acepta payload flex; campos schema oficiales.
export async function createOrdenServicio(request: FastifyRequest, payload: any) {
  const { companyId, branchId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'ordenesServicio.write')
  const clienteId = String(payload.clienteId || '').trim()
  const clienteEquipoId = toOptionalString(payload.clienteEquipoId)
  const tipoServicioId = toOptionalString(payload.tipoServicioId)
  if (!clienteId) throw UNAUTH(400, 'clienteId es obligatorio.')
  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, empresaId: companyId, deletedAt: null },
  })
  if (!cliente) throw UNAUTH(404, 'Cliente no existe.')
  const sucursal = await prisma.sucursal.findFirst({
    where: { id: branchId, empresaId: companyId, activo: true, deletedAt: null },
  })
  if (!sucursal) throw UNAUTH(409, 'Sucursal no disponible para OS.')
  if (clienteEquipoId) {
    const eq = await prisma.clienteEquipo.findFirst({
      where: { id: clienteEquipoId, empresaId: companyId, deletedAt: null },
    })
    if (!eq) throw UNAUTH(404, 'Equipo no existe en la empresa.')
  }
  let garantiaDef = 30
  try {
    const cfg = await prisma.configuracion.findFirst({
      where: {
        empresaId: companyId,
        ambito: 'EMPRESA',
        clave: 'GARANTIA_DEFAULT_DIAS',
        deletedAt: null,
      },
    })
    if (cfg && cfg.valorNumero != null) garantiaDef = Number(cfg.valorNumero) || 30
  } catch {
    garantiaDef = 30
  }
  const garantiaDias =
    Number(payload.garantiaDiasAplicados ?? payload.garantiaDias ?? garantiaDef) || 0

  const fechaRecepcion = payload.fechaRecepcion ? new Date(payload.fechaRecepcion) : new Date()
  const anio = fechaRecepcion.getFullYear()

  const igvPorc = Number(payload.igvPorcentaje ?? clientIgvDefault(companyId)) || 18

  return await prisma.$transaction(async (tx: any) => {
    const { numeroOrden } = await getNextNumeroOrden(
      tx,
      companyId,
      branchId,
      sucursal.codigo,
      anio,
      userId,
    )

    const repuestos = 0
    const manoObra = 0
    const servicios = 0
    const descuento = 0
    const sub = Math.max(0, roundMoney(repuestos + manoObra + servicios - descuento))
    const igv = roundMoney(sub * (igvPorc / 100))
    const totalOrden = roundMoney(sub + igv)

    const orden = await tx.ordenServicio.create({
      data: {
        empresaId: companyId,
        sucursalId: branchId,
        numeroOrden,
        estadoActual: EstadoOrdenServicio.RECIBIDO,
        clienteId,
        clienteEquipoId: clienteEquipoId || undefined,
        tipoServicioId: tipoServicioId || undefined,
        tecnicoAsignadoId: payload.tecnicoAsignadoId
          ? String(payload.tecnicoAsignadoId)
          : undefined,
        fechaRecepcion,
        fechaEntregaEstimada: payload.fechaPrometida
          ? new Date(payload.fechaPrometida)
          : undefined,
        problemaReportado: String(payload.clienteReporto || payload.problemaReportado || '').slice(0, 2000),
        accesoriosRecibidos: toOptionalString(payload.accesoriosRecibidos),
        contrasenaEquipo: toOptionalString(payload.contrasenaEquipo),
        garantiaDiasAplicados: garantiaDias,
        subtotalRepuestos: toDecimal(repuestos, 2),
        subtotalManoObra: toDecimal(manoObra, 2),
        subtotalServiciosAdic: toDecimal(servicios, 2),
        descuentoTotal: toDecimal(descuento, 2),
        impuestoTotal: toDecimal(igv, 2),
        totalOrden: toDecimal(totalOrden, 2),
        totalPagado: toDecimal(0, 2),
        saldoPendiente: toDecimal(totalOrden, 2),
        observacionesInternas: toOptionalString(payload.diagnosticoRecepcion ?? payload.observaciones),
        createdById: userId,
        updatedById: userId,
      },
      include: ordenInclude,
    })

    await tx.ordenEstadoHistorial.create({
      data: {
        ordenId: orden.id,
        estado: EstadoOrdenServicio.RECIBIDO,
        observaciones: 'Creación de la Orden de Servicio.',
        fecha: new Date(),
        realizadoPorId: userId,
      },
    })

    if (payload.tecnicoAsignadoId) {
      const tec = await tx.tecnico.findFirst({
        where: {
          id: String(payload.tecnicoAsignadoId),
          usuario: { empresaId: companyId },
          deletedAt: null,
          activo: true,
        },
      })
      if (!tec) throw UNAUTH(404, 'Técnico asignado no existe en la empresa.')
      await tx.ordenAsignacionTecnico.create({
        data: {
          ordenId: orden.id,
          tecnicoId: tec.id,
          fechaAsignacion: new Date(),
          activo: true,
          motivoCambio: 'Asignación inicial en la creación de OS.',
        },
      })
    }

    await tx.ordenPresupuestoVersion.create({
      data: {
        ordenId: orden.id,
        version: 1,
        subtotalRepuestos: toDecimal(repuestos, 2),
        subtotalManoObra: toDecimal(manoObra, 2),
        subtotalServiciosAdic: toDecimal(servicios, 2),
        descuentoTotal: toDecimal(descuento, 2),
        impuestoTotal: toDecimal(igv, 2),
        total: toDecimal(totalOrden, 2),
        estadoAprobacion: 'PENDIENTE',
        notasCliente: toOptionalString(payload.descripcionPresupuesto) || 'Presupuesto inicial al crear OS.',
        creadoPorId: userId,
      },
    })

    if (Array.isArray(payload.items) && payload.items.length) {
      for (const it of payload.items) {
        await addOrdenItemInternal(tx, orden as any, it, userId, companyId, branchId)
      }
    }

    return getOrdenServicioFromTx(tx, orden.id)
  })
}

async function getOrdenServicioFromTx(tx: any, id: string) {
  const row = await tx.ordenServicio.findFirst({
    where: { id },
    include: ordenInclude,
  })
  if (!row) throw UNAUTH(404, 'Orden de Servicio no existe.')
  const o = row as any
  return {
    item: {
      ...o,
      estado: o.estadoActual,
      cliente: o.cliente
        ? { ...o.cliente, nombresRazonSocial: flatClienteNombre(o.cliente) }
        : o.cliente,
      fechaEntregado: o.fechaEntregaReal,
      fechaPrometida: o.fechaEntregaEstimada,
      clienteReporto: o.problemaReportado,
      diagnosticoRecepcion: toOptionalString(o.observacionesInternas),
      montoManoObra: decimalToNumber(o.subtotalManoObra),
      montoRepuestos: decimalToNumber(o.subtotalRepuestos),
      montoServicios: decimalToNumber(o.subtotalServiciosAdic),
      subTotal: decimalToNumber(o.subtotalRepuestos) +
        decimalToNumber(o.subtotalManoObra) +
        decimalToNumber(o.subtotalServiciosAdic) -
        decimalToNumber(o.descuentoTotal),
      igvPorcentaje: decimalToNumber(o.impuestoTotal) > 0 ? 18 : 0,
      igvMonto: decimalToNumber(o.impuestoTotal),
      total: decimalToNumber(o.totalOrden),
      totalFinal: decimalToNumber(o.totalOrden),
      saldoPendiente: decimalToNumber(o.saldoPendiente),
      garantiaVence: null,
      creadoEnSucursalId: o.sucursalId,
    },
  }
}

export async function cambiarEstadoOrden(
  request: FastifyRequest,
  id: string,
  payload: any,
) {
  const { companyId, branchId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'ordenesServicio.cambioEstado')
  const estadoNuevo: EstadoOrdenServicio | undefined = payload?.estado
  if (!estadoNuevo) throw UNAUTH(400, 'Parámetro estado es obligatorio.')
  const observaciones = toOptionalString(payload?.observaciones)

  return await prisma.$transaction(async (tx: any) => {
    const orden = await tx.ordenServicio.findFirst({
      where: { id, empresaId: companyId, deletedAt: null },
    })
    if (!orden) throw UNAUTH(404, 'Orden no existe.')
    const estadoAnterior: EstadoOrdenServicio = orden.estadoActual
    if (estadoAnterior === estadoNuevo) {
      return getOrdenServicioFromTx(tx, id)
    }
    if (
      estadoAnterior === EstadoOrdenServicio.ENTREGADO &&
      estadoNuevo !== EstadoOrdenServicio.EN_GARANTÍA
    ) {
      throw UNAUTH(409, 'Orden ENTREGADA solo puede ir a EN_GARANTÍA.')
    }
    if (estadoNuevo === EstadoOrdenServicio.ENTREGADO) {
      const saldo = decimalToNumber(orden.saldoPendiente)
      if (saldo > 0.005)
        throw UNAUTH(409, `No se puede ENTREGAR. Saldo pendiente S/ ${saldo.toFixed(2)}.`)
    }
    if (
      estadoNuevo === EstadoOrdenServicio.EN_GARANTÍA &&
      estadoAnterior !== EstadoOrdenServicio.ENTREGADO
    ) {
      throw UNAUTH(409, 'EN_GARANTÍA solo aplica después de ENTREGADO.')
    }

    if (estadoNuevo === EstadoOrdenServicio.ENTREGADO) {
      const dias = Number(orden.garantiaDiasAplicados || 0)
      const fechaInicio = new Date()
      const fechaFin = dias > 0 ? addDays(fechaInicio, dias) : undefined
      await tx.ordenGarantia.createMany({
        data: [
          {
            ordenId: id,
            dias: dias,
            fechaInicio,
            fechaFin,
            detalle: toOptionalString(payload?.terminosGarantia),
            estado: dias > 0 ? 'VIGENTE' : 'SIN_GARANTIA',
          },
        ],
        skipDuplicates: true,
      })
    }

    const updateData: any = {
      estadoActual: estadoNuevo,
      updatedById: userId,
    }
    if (estadoNuevo === EstadoOrdenServicio.ENTREGADO) {
      updateData.fechaEntregaReal = new Date()
    }
    await tx.ordenServicio.update({ where: { id }, data: updateData })

    await tx.ordenEstadoHistorial.create({
      data: {
        ordenId: id,
        estado: estadoNuevo,
        observaciones,
        fecha: new Date(),
        realizadoPorId: userId,
      },
    })
    return getOrdenServicioFromTx(tx, id)
  })
}

export async function asignarTecnicoOrden(
  request: FastifyRequest,
  id: string,
  payload: any,
) {
  const { companyId, branchId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'ordenesServicio.cambioEstado')
  const tecnicoId = String(payload.tecnicoId || '').trim()
  if (!tecnicoId) throw UNAUTH(400, 'tecnicoId es obligatorio.')
  return await prisma.$transaction(async (tx: any) => {
    const orden = await tx.ordenServicio.findFirst({
      where: { id, empresaId: companyId, deletedAt: null },
    })
    if (!orden) throw UNAUTH(404, 'Orden no existe.')
    const tec = await tx.tecnico.findFirst({
      where: {
        id: tecnicoId,
        usuario: { empresaId: companyId },
        deletedAt: null,
        activo: true,
      },
    })
    if (!tec) throw UNAUTH(404, 'Técnico no existe.')
    await tx.ordenAsignacionTecnico.updateMany({
      where: { ordenId: id, activo: true },
      data: { activo: false, fechaLiberacion: new Date(), motivoCambio: 'Reasignación' },
    })
    await tx.ordenServicio.update({
      where: { id },
      data: { tecnicoAsignadoId: tecnicoId, updatedById: userId },
    })
    await tx.ordenAsignacionTecnico.create({
      data: {
        ordenId: id,
        tecnicoId,
        fechaAsignacion: new Date(),
        activo: true,
        motivoCambio: toOptionalString(payload.observaciones),
      },
    })
    return getOrdenServicioFromTx(tx, id)
  })
}

// ============================================================
// PRESUPUESTO
// ============================================================
export async function crearVersionPresupuesto(
  request: FastifyRequest,
  id: string,
  payload: any,
) {
  const { companyId, branchId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'ordenesServicio.write')
  return await prisma.$transaction(async (tx: any) => {
    const orden = await tx.ordenServicio.findFirst({
      where: { id, empresaId: companyId, deletedAt: null },
    })
    if (!orden) throw UNAUTH(404, 'Orden no existe.')
    const last = await tx.ordenPresupuestoVersion.findFirst({
      where: { ordenId: id, deletedAt: null },
      orderBy: { version: 'desc' },
    })
    const version = last ? last.version + 1 : 1
    const igvPorc = Number(payload.igvPorcentaje || 18) || 18
    const rep = Number(payload.subtotalRepuestos || payload.montoRepuestos || 0)
    const mo = Number(payload.subtotalManoObra || payload.montoManoObra || 0)
    const serv = Number(payload.subtotalServiciosAdic || payload.montoServicios || 0)
    const des = Number(payload.descuentoTotal || 0)
    const sub = Math.max(0, roundMoney(rep + mo + serv - des))
    const igv = roundMoney(sub * (igvPorc / 100))
    const total = roundMoney(sub + igv)
    const pv = await tx.ordenPresupuestoVersion.create({
      data: {
        ordenId: id,
        version,
        subtotalRepuestos: toDecimal(rep, 2),
        subtotalManoObra: toDecimal(mo, 2),
        subtotalServiciosAdic: toDecimal(serv, 2),
        descuentoTotal: toDecimal(des, 2),
        impuestoTotal: toDecimal(igv, 2),
        total: toDecimal(total, 2),
        estadoAprobacion: 'PENDIENTE',
        notasCliente: toOptionalString(payload.descripcion) || `Presupuesto v${version}`,
        creadoPorId: userId,
      },
    })
    const estadosCambioPend = [
      EstadoOrdenServicio.RECIBIDO,
      EstadoOrdenServicio.DIAGNÓSTICO,
      EstadoOrdenServicio.PRESUPUESTO,
    ]
    if (estadosCambioPend.includes(orden.estadoActual)) {
      await tx.ordenServicio.update({
        where: { id },
        data: {
          estadoActual: EstadoOrdenServicio.ESPERANDO_APROBACIÓN,
          updatedById: userId,
        },
      })
      await tx.ordenEstadoHistorial.create({
        data: {
          ordenId: id,
          estado: EstadoOrdenServicio.ESPERANDO_APROBACIÓN,
          observaciones: `Se creó presupuesto v${version}.`,
          fecha: new Date(),
          realizadoPorId: userId,
        },
      })
    }
    return { presupuesto: pv }
  })
}

export async function aprobarPresupuestoCliente(
  request: FastifyRequest,
  id: string,
  payload: any,
) {
  const { companyId, branchId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'ordenesServicio.aprobar')
  const version = Number(payload.version) || 0
  const accion = String(payload.accion || 'APROBAR').toUpperCase()
  if (!version) throw UNAUTH(400, 'version es obligatoria.')
  return await prisma.$transaction(async (tx: any) => {
    const orden = await tx.ordenServicio.findFirst({
      where: { id, empresaId: companyId, deletedAt: null },
    })
    if (!orden) throw UNAUTH(404, 'Orden no existe.')
    const pv = await tx.ordenPresupuestoVersion.findFirst({
      where: { ordenId: id, version, deletedAt: null },
    })
    if (!pv) throw UNAUTH(404, `Presupuesto v${version} no existe.`)
    const aprobado = accion === 'APROBAR'
    const newEstado = aprobado ? 'APROBADO' : accion === 'RECHAZAR' ? 'RECHAZADO' : 'PENDIENTE'
    await tx.ordenPresupuestoVersion.update({
      where: { id: pv.id },
      data: {
        estadoAprobacion: newEstado,
        fechaDecisionCliente: new Date(),
        decididoClientePor: toOptionalString(payload.nombreCliente) || 'Cliente',
        motivoRechazo: toOptionalString(payload.comentarios),
      },
    })
    if (aprobado) {
      const sub =
        decimalToNumber(pv.subtotalRepuestos) +
        decimalToNumber(pv.subtotalManoObra) +
        decimalToNumber(pv.subtotalServiciosAdic) -
        decimalToNumber(pv.descuentoTotal)
      const igv = decimalToNumber(pv.impuestoTotal)
      const total = roundMoney(Math.max(0, sub) + igv)
      const totalPagado = decimalToNumber(orden.totalPagado)
      const saldoPendiente = Math.max(0, roundMoney(total - totalPagado))
      await tx.ordenServicio.update({
        where: { id },
        data: {
          subtotalRepuestos: pv.subtotalRepuestos,
          subtotalManoObra: pv.subtotalManoObra,
          subtotalServiciosAdic: pv.subtotalServiciosAdic,
          descuentoTotal: pv.descuentoTotal,
          impuestoTotal: pv.impuestoTotal,
          totalOrden: pv.total,
          saldoPendiente: toDecimal(saldoPendiente, 2),
          aprobadoClienteAt: new Date(),
          aprobadoClientePorId: userId,
          estadoActual: EstadoOrdenServicio.APROBADO,
          updatedById: userId,
        },
      })
      await tx.ordenEstadoHistorial.create({
        data: {
          ordenId: id,
          estado: EstadoOrdenServicio.APROBADO,
          observaciones: `Cliente aprueba presupuesto v${version}.`,
          fecha: new Date(),
          realizadoPorId: userId,
        },
      })
    }
    return { ok: true, aprobado }
  })
}

// ============================================================
// DIAGNOSTICOS
// ============================================================
export async function addDiagnostico(
  request: FastifyRequest,
  id: string,
  payload: any,
) {
  const { companyId, branchId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'ordenesServicio.write')
  const texto = String(payload.diagnostico || payload.detalle || '').trim()
  if (!texto) throw UNAUTH(400, 'diagnostico es obligatorio.')
  return await prisma.$transaction(async (tx: any) => {
    const orden = await tx.ordenServicio.findFirst({
      where: { id, empresaId: companyId, deletedAt: null },
    })
    if (!orden) throw UNAUTH(404, 'Orden no existe.')
    const d = await tx.ordenDiagnostico.create({
      data: {
        ordenId: id,
        tecnicoId: toOptionalString(payload.tecnicoId),
        detalle: texto,
        fecha: new Date(),
        creadoPorId: userId,
      },
    })
    if (orden.estadoActual === EstadoOrdenServicio.RECIBIDO) {
      await tx.ordenServicio.update({
        where: { id },
        data: { estadoActual: EstadoOrdenServicio.DIAGNÓSTICO, updatedById: userId },
      })
      await tx.ordenEstadoHistorial.create({
        data: {
          ordenId: id,
          estado: EstadoOrdenServicio.DIAGNÓSTICO,
          observaciones: 'Diagnóstico inicial registrado.',
          fecha: new Date(),
          realizadoPorId: userId,
        },
      })
    }
    return { diagnostico: d }
  })
}

// ============================================================
// ITEMS SERVICIO
// ============================================================
export async function addOrdenItem(
  request: FastifyRequest,
  ordenId: string,
  payload: any,
) {
  const { companyId, branchId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'ordenesServicio.write')
  return await prisma.$transaction(async (tx: any) => {
    const orden = await tx.ordenServicio.findFirst({
      where: { id: ordenId, empresaId: companyId, deletedAt: null },
      include: ordenInclude,
    })
    if (!orden) throw UNAUTH(404, 'Orden no existe.')
    await addOrdenItemInternal(tx, orden as any, payload, userId, companyId, branchId)
    await recalcularMontosOrden(tx, ordenId, userId, companyId)
    return getOrdenServicioFromTx(tx, ordenId)
  })
}

export async function deleteOrdenItem(request: FastifyRequest, itemId: string) {
  const { companyId, userId, branchId } = await requireBranchAuthContext(request)
  requirePermission(request, 'inventarioServicio.write')
  return await prisma.$transaction(async (tx: any) => {
    const item = await tx.ordenItemServicio.findFirst({
      where: { id: itemId, deletedAt: null },
    })
    if (!item) throw UNAUTH(404, 'Item no existe.')
    if (item.tipo === TipoItemOrdenServicio.REPUESTO && item.loteId && item.productoId) {
      const qty = Math.max(0, decimalToNumber(item.cantidad))
      if (qty > 0) {
        const lote = await tx.lote.findFirst({
          where: { id: item.loteId, empresaId: companyId, deletedAt: null },
        })
        if (lote) {
          const prevStock = decimalToNumber(lote.stockDisponible)
          const nextStock = prevStock + qty
          await tx.lote.update({
            where: { id: lote.id },
            data: { stockDisponible: toDecimal(nextStock, 4), updatedById: userId },
          })
          const prod = await tx.producto.findFirst({
            where: { id: item.productoId, empresaId: companyId, deletedAt: null },
          })
          if (prod && (prod as any).inventarios) {
            // Stock por sucursal vía Inventario (Producto no tiene stockTotal propio)
            const inv = await tx.inventario.findFirst({
              where: {
                productoId: prod.id,
                sucursalId: branchId,
                empresaId: companyId,
                deletedAt: null,
              },
            })
            if (inv) {
              const invPrev = decimalToNumber(inv.stockActual)
              await tx.inventario.update({
                where: { id: inv.id },
                data: {
                  stockActual: toDecimal(invPrev + qty, 4),
                  updatedById: userId,
                },
              })
            }
          }
          await tx.movimientoInventario.create({
            data: {
              sucursalId: branchId,
              productoId: item.productoId,
              loteId: item.loteId,
              tipo: TipoMovimientoInventario.ENTRADA,
              origen: OrigenMovimientoInventario.SERVICIO_TECNICO_DEVOLUCION,
              cantidad: toDecimal(qty, 4),
              costoUnitario: lote.costoUnitario
                ? toDecimal(decimalToNumber(lote.costoUnitario), 6)
                : undefined,
              referencia: `Devolución OS item ${item.id.slice(0, 6)}`,
              ordenServicioId: item.ordenId,
              itemOrdenServicioId: item.id,
              createdById: userId,
              updatedById: userId,
            },
          })
        }
      }
    }
    await tx.ordenItemServicio.update({
      where: { id: item.id },
      data: { deletedAt: new Date(), actualizadoPorId: userId },
    })
    await recalcularMontosOrden(tx, item.ordenId, userId, companyId)
    return getOrdenServicioFromTx(tx, item.ordenId)
  })
}

// ============================================================
// PAGOS ORDEN
// ============================================================
export async function registrarPagoOrden(
  request: FastifyRequest,
  id: string,
  payload: any,
) {
  const { companyId, branchId, userId } = await requireBranchAuthContext(request)
  requirePermission(request, 'pagosOrdenServicio.write')
  const monto = Number(payload.monto || 0)
  const formaPagoId = String(payload.formaPagoId || '').trim()
  if (monto <= 0) throw UNAUTH(400, 'monto > 0 es obligatorio.')
  if (!formaPagoId) throw UNAUTH(400, 'formaPagoId es obligatorio.')
  const fechaPago = payload.fechaPago ? new Date(payload.fechaPago) : new Date()

  return await prisma.$transaction(async (tx: any) => {
    const orden = await tx.ordenServicio.findFirst({
      where: { id, empresaId: companyId, deletedAt: null },
    })
    if (!orden) throw UNAUTH(404, 'Orden no existe.')
    const fp = await tx.formaPago.findFirst({
      where: { id: formaPagoId, empresaId: companyId, deletedAt: null, activo: true },
    })
    if (!fp) throw UNAUTH(404, 'Forma de pago no existe.')
    const apertura = await tx.aperturaCaja.findFirst({
      where: {
        deletedAt: null,
        caja: { sucursalId: branchId, empresaId: companyId, activo: true },
        estado: 'ABIERTA',
      },
      orderBy: { fechaApertura: 'desc' },
    })
    if (!apertura)
      throw UNAUTH(409, 'No hay una caja abierta en la sucursal. Abre caja antes de registrar pagos.')

    const totalActual = decimalToNumber(orden.totalOrden)
    const sum = (
      await tx.ordenServicioPago.aggregate({
        _sum: { monto: true },
        where: { ordenId: id, deletedAt: null },
      })
    )._sum.monto
    const totalPagado = decimalToNumber(sum)
    const saldo = Math.max(0, roundMoney(totalActual - totalPagado))
    if (monto - saldo > 0.005)
      throw UNAUTH(
        409,
        `Monto S/ ${monto.toFixed(2)} excede saldo pendiente S/ ${saldo.toFixed(2)}.`,
      )

    const mov = await tx.movimientoCaja.create({
      data: {
        aperturaCajaId: apertura.id,
        tipo: TipoMovimientoCaja.INGRESO,
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
        ordenId: id,
        formaPagoId: fp.id,
        monto: toDecimal(monto, 2),
        fechaPago,
        referencia: toOptionalString(payload.referencia),
        observaciones: toOptionalString(payload.observaciones),
        movimientoCajaId: mov.id,
        empresaId: companyId,
        sucursalId: branchId,
        createdById: userId,
        updatedById: userId,
      },
    })

    const nuevoTotalPagado = totalPagado + monto
    const nuevoSaldo = Math.max(0, roundMoney(totalActual - nuevoTotalPagado))
    await tx.ordenServicio.update({
      where: { id },
      data: {
        totalPagado: toDecimal(nuevoTotalPagado, 2),
        saldoPendiente: toDecimal(nuevoSaldo, 2),
        updatedById: userId,
      },
    })

    return { pago, ...(await getOrdenServicioFromTx(tx, id)) }
  })
}

// ============================================================
// HELPERS INTERNOS
// ============================================================
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + (Number(n) || 0))
  return r
}

async function clientIgvDefault(empresaId: string): Promise<number> {
  try {
    const emp = await prisma.empresa.findFirst({
      where: { id: empresaId },
      select: { igvPorDefecto: true } as any,
    })
    return Number((emp as any)?.igvPorDefecto || 18)
  } catch {
    return 18
  }
}

async function addOrdenItemInternal(
  tx: any,
  orden: { id: string; empresaId: string; sucursalId: string; numeroOrden: string },
  payload: any,
  userId: string,
  companyId: string,
  branchId: string,
) {
  const tipo: TipoItemOrdenServicio =
    payload.tipo || TipoItemOrdenServicio.MANO_OBRA
  const qty = Math.max(0, Number(payload.cantidad || 1) || 1)
  const pu = Math.max(0, Number(payload.precioUnitario || 0) || 0)
  const descto = Math.max(0, Number(payload.descuentoItem || 0) || 0)
  const baseLinea = roundMoney(qty * pu)
  const totalLinea = roundMoney(Math.max(0, baseLinea - descto))
  const igvItem = roundMoney((Number(payload.igvItem ?? 0)) || 0)
  const dataLinea: any = {
    ordenId: orden.id,
    tipo,
    descripcion:
      toOptionalString(payload.descripcion) ||
      (tipo === TipoItemOrdenServicio.MANO_OBRA
        ? 'Mano de obra'
        : tipo === TipoItemOrdenServicio.REPUESTO
          ? 'Repuesto'
          : tipo === TipoItemOrdenServicio.SERVICIO_ADICIONAL
            ? 'Servicio adicional'
            : 'Accesorio entregado'),
    cantidad: toDecimal(qty, 4),
    precioUnitario: toDecimal(pu, 2),
    descuentoItem: toDecimal(descto, 2),
    impuestoItem: toDecimal(igvItem, 2),
    subtotal: toDecimal(totalLinea, 2),
    horasTrabajadas: payload.horasTrabajadas
      ? toDecimal(payload.horasTrabajadas, 2)
      : undefined,
    fechaRealizacion: payload.fechaRealizacion
      ? new Date(payload.fechaRealizacion)
      : undefined,
    observaciones: toOptionalString(payload.observaciones),
    activo: true,
    creadoPorId: userId,
    actualizadoPorId: userId,
    tecnicoId: toOptionalString(payload.tecnicoAsignadoId || payload.tecnicoId),
    tipoServicioId: toOptionalString(payload.tipoServicioId),
  }

  if (tipo === TipoItemOrdenServicio.REPUESTO) {
    const productoId = String(payload.productoId || '').trim()
    const loteId = toOptionalString(payload.loteId)
    if (!productoId) throw UNAUTH(400, 'Item tipo REPUESTO requiere productoId.')
    const prod = await tx.producto.findFirst({
      where: { id: productoId, empresaId: companyId, deletedAt: null },
    })
    if (!prod) throw UNAUTH(404, 'Producto (repuesto) no existe.')
    const uso: any = (prod as any).usoServicioTecnico || 'AMBOS'
    if (uso === 'SOLO_VENTA')
      throw UNAUTH(409, 'Producto está marcado como SOLO_VENTA, no puede ser repuesto.')
    let costoUnitario = decimalToNumber((loteId ? null : null) as any)
    let nextStockLote = 0
    let stockAnteriorLote = 0
    let lote: any = null
    if (loteId) {
      lote = await tx.lote.findFirst({
        where: { id: loteId, productoId, empresaId: companyId, deletedAt: null },
      })
      if (!lote) throw UNAUTH(404, 'Lote del repuesto no existe.')
      dataLinea.loteId = lote.id
      costoUnitario = decimalToNumber(lote.costoUnitario)
      stockAnteriorLote = decimalToNumber(lote.stockDisponible)
      if (stockAnteriorLote - qty < -0.0001)
        throw UNAUTH(409, `Stock insuficiente en lote: ${stockAnteriorLote} < ${qty}.`)
      nextStockLote = stockAnteriorLote - qty
      await tx.lote.update({
        where: { id: lote.id },
        data: { stockDisponible: toDecimal(nextStockLote, 4), updatedById: userId },
      })
    }
    dataLinea.productoId = prod.id
    dataLinea.costoUnitarioRef = costoUnitario
      ? toDecimal(costoUnitario, 6)
      : undefined

    if (loteId) {
      const inv = await tx.inventario.findFirst({
        where: {
          productoId: prod.id,
          sucursalId: branchId,
          empresaId: companyId,
          deletedAt: null,
        },
      })
      if (inv) {
        const invPrev = decimalToNumber(inv.stockActual)
        await tx.inventario.update({
          where: { id: inv.id },
          data: {
            stockActual: toDecimal(Math.max(0, invPrev - qty), 4),
            updatedById: userId,
          },
        })
      }
    }

    const item = await tx.ordenItemServicio.create({ data: dataLinea })
    if (loteId) {
      await tx.movimientoInventario.create({
        data: {
          sucursalId: branchId,
          productoId: prod.id,
          loteId: lote!.id,
          tipo: TipoMovimientoInventario.SALIDA,
          origen: OrigenMovimientoInventario.SERVICIO_TECNICO_CONSUMO,
          cantidad: toDecimal(qty, 4),
          costoUnitario: costoUnitario
            ? toDecimal(costoUnitario, 6)
            : undefined,
          referencia: `Consumo repuesto OS ${orden.numeroOrden} ${String(prod.nombre || '').slice(0, 32)}`,
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
    return await tx.ordenItemServicio.create({ data: dataLinea })
  }
}

async function recalcularMontosOrden(
  tx: any,
  ordenId: string,
  userId: string,
  empresaId: string,
) {
  const items = await tx.ordenItemServicio.findMany({
    where: { ordenId, deletedAt: null },
  })
  let mo = 0
  let rep = 0
  let ser = 0
  let desc = 0
  for (const it of items) {
    const t = decimalToNumber(it.subtotal)
    const d = decimalToNumber((it as any).descuentoItem || 0)
    desc += d
    if (it.tipo === TipoItemOrdenServicio.MANO_OBRA) mo += t
    else if (it.tipo === TipoItemOrdenServicio.REPUESTO) rep += t
    else ser += t
  }
  const sub = roundMoney(Math.max(0, mo + rep + ser))
  const orden = await tx.ordenServicio.findFirst({
    where: { id: ordenId, empresaId },
  })
  if (!orden) throw UNAUTH(404, 'Orden no existe al recalcular.')
  const igvPct =
    decimalToNumber(orden.impuestoTotal) > 0 ? 18 : Number(process.env.IGV_DEFAULT || 18) || 18
  const igv = roundMoney(sub * (igvPct / 100))
  const total = roundMoney(sub + igv)
  const pagSum = (
    await tx.ordenServicioPago.aggregate({
      _sum: { monto: true },
      where: { ordenId, deletedAt: null },
    })
  )._sum.monto
  const pagado = decimalToNumber(pagSum)
  const saldo = Math.max(0, roundMoney(total - pagado))
  return await tx.ordenServicio.update({
    where: { id: ordenId },
    data: {
      subtotalRepuestos: toDecimal(rep, 2),
      subtotalManoObra: toDecimal(mo, 2),
      subtotalServiciosAdic: toDecimal(ser, 2),
      descuentoTotal: toDecimal(desc, 2),
      impuestoTotal: toDecimal(igv, 2),
      totalOrden: toDecimal(total, 2),
      totalPagado: toDecimal(pagado, 2),
      saldoPendiente: toDecimal(saldo, 2),
      updatedById: userId,
    },
    include: ordenInclude,
  })
}
