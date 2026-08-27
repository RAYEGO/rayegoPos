import { AccionAuditoria, Prisma, TipoDocumentoIdentidad } from '@prisma/client'
import { hash } from 'bcryptjs'
import type { FastifyRequest } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { requirePermission, requirePlatformAdmin } from '../../lib/auth.js'

export type TipoEmpresaListItem = {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  icono: string | null
  color: string | null
  orden: number
  activo: boolean
  modulosHabilitadosCount: number
  empresasCount: number
}

export type TipoEmpresaDetail = {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  icono: string | null
  color: string | null
  orden: number
  activo: boolean
  modulosHabilitados: ModuloCatalogoItem[]
}

export type ModuloCatalogoItem = {
  codigo: string
  nombre: string
  descripcion: string | null
  icono: string | null
  categoria: string | null
  orden: number
  activo: boolean
}

export type EmpresaListItem = {
  id: string
  razonSocial: string
  nombreComercial: string | null
  numeroDocumento: string
  tipoEmpresa: {
    id: string
    codigo: string
    nombre: string
    color: string | null
    activo: boolean
  }
  sucursalesCount: number
  usuariosCount: number
  activo: boolean
  createdAt: string | null
}

export type EmpresaDetail = {
  id: string
  tipoEmpresaId: string
  razonSocial: string
  nombreComercial: string | null
  tipoDocumento: TipoDocumentoIdentidad
  numeroDocumento: string
  email: string | null
  telefono: string | null
  direccion: string | null
  ubigeo: string | null
  monedaBase: string
  zonaHoraria: string
  activo: boolean
  createdAt: string | null
  tipoEmpresa: {
    id: string
    codigo: string
    nombre: string
    color: string | null
    activo: boolean
  }
  sucursalesCount: number
  usuariosCount: number
}

export type CreateEmpresaOnboardingPayload = {
  empresa: CreateEmpresaPayload
  sucursal: {
    codigo: string
    nombre: string
    direccion?: string | null
    telefono?: string | null
    email?: string | null
    ubigeo?: string | null
  }
  admin: {
    username: string
    email?: string | null
    password: string
    nombres: string
    apellidos: string
    tipoDocumento?: TipoDocumentoIdentidad
    numeroDocumento?: string | null
    telefono?: string | null
    activo?: boolean
  }
}

export type EmpresaOnboardingResult = {
  empresa: EmpresaDetail
  sucursalId: string
  adminUsuario: {
    id: string
    username: string
    email: string | null
  }
}

type CreateTipoEmpresaPayload = {
  codigo: string
  nombre: string
  descripcion?: string | null
  icono?: string | null
  color?: string | null
  orden?: number
  activo?: boolean
  modulosHabilitados?: string[]
}

type UpdateTipoEmpresaPayload = {
  nombre?: string
  descripcion?: string | null
  icono?: string | null
  color?: string | null
  orden?: number
  activo?: boolean
}

type CreateEmpresaPayload = {
  tipoEmpresaId: string
  razonSocial: string
  nombreComercial?: string | null
  tipoDocumento?: TipoDocumentoIdentidad
  numeroDocumento: string
  email?: string | null
  telefono?: string | null
  direccion?: string | null
  ubigeo?: string | null
  monedaBase?: string
  zonaHoraria?: string
  activo?: boolean
}

type UpdateEmpresaPayload = Partial<CreateEmpresaPayload>

function createHttpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number }
  error.statusCode = statusCode
  return error
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '_')
}

async function getPlatformUserId(request: FastifyRequest): Promise<string> {
  const ctx = await requirePlatformAdmin(request)
  return ctx.userId
}

async function writeAudit(
  request: FastifyRequest,
  data: {
    userId: string
    action: AccionAuditoria
    table: string
    recordId: string
    previousValue?: unknown
    nextValue?: unknown
  },
) {
  try {
    await prisma.auditoria.create({
      data: {
        usuarioId: data.userId,
        tabla: data.table,
        registroId: data.recordId,
        accion: data.action,
        valorAnterior: data.previousValue
          ? (data.previousValue as Prisma.InputJsonValue | undefined)
          : undefined,
        valorNuevo: data.nextValue
          ? (data.nextValue as Prisma.InputJsonValue | undefined)
          : undefined,
        direccionIp: request.ip,
        userAgent: request.headers['user-agent'],
      },
    })
  } catch {
    // auditoría no debe romper el flujo operativo principal
  }
}

export async function listTiposEmpresa(request: FastifyRequest): Promise<TipoEmpresaListItem[]> {
  await requirePlatformAdmin(request)
  await requirePermission(request, 'tipos_empresa.manage')
  await getPlatformUserId(request)

  const rows = await prisma.tipoEmpresa.findMany({
    where: { deletedAt: null },
    include: {
      _count: {
        select: {
          empresas: true,
          modulos: true,
        },
      },
    },
    orderBy: [
      { activo: 'desc' },
      { orden: 'asc' },
      { codigo: 'asc' },
    ],
  })

  return rows.map((r) => ({
    id: r.id,
    codigo: r.codigo,
    nombre: r.nombre,
    descripcion: r.descripcion,
    icono: r.icono,
    color: r.color,
    orden: r.orden,
    activo: r.activo,
    modulosHabilitadosCount: r._count.modulos,
    empresasCount: r._count.empresas,
  }))
}

export async function getTipoEmpresaDetail(
  tipoId: string,
  request: FastifyRequest,
): Promise<TipoEmpresaDetail> {
  await requirePlatformAdmin(request)
  await requirePermission(request, 'tipos_empresa.manage')
  await getPlatformUserId(request)

  const tipo = await prisma.tipoEmpresa.findFirst({
    where: { id: tipoId, deletedAt: null },
    include: {
      modulos: {
        orderBy: [{ orden: 'asc' }, { moduloCodigo: 'asc' }],
        include: {
          modulo: {
            select: {
              codigo: true,
              nombre: true,
              descripcion: true,
              icono: true,
              categoria: true,
              orden: true,
              activo: true,
            },
          },
        },
      },
    },
  })

  if (!tipo) {
    throw createHttpError(404, 'El tipo de empresa no fue encontrado.')
  }

  return {
    id: tipo.id,
    codigo: tipo.codigo,
    nombre: tipo.nombre,
    descripcion: tipo.descripcion,
    icono: tipo.icono,
    color: tipo.color,
    orden: tipo.orden,
    activo: tipo.activo,
    modulosHabilitados: tipo.modulos.map((m) => ({
      codigo: m.modulo.codigo,
      nombre: m.modulo.nombre,
      descripcion: m.modulo.descripcion,
      icono: m.modulo.icono,
      categoria: m.modulo.categoria,
      orden: m.modulo.orden,
      activo: m.modulo.activo,
    })),
  }
}

export async function listModulosCatalogo(request: FastifyRequest): Promise<ModuloCatalogoItem[]> {
  await requirePlatformAdmin(request)
  await requirePermission(request, 'tipos_empresa.manage')
  await getPlatformUserId(request)

  return prisma.modulo.findMany({
    where: { deletedAt: null, activo: true },
    select: {
      codigo: true,
      nombre: true,
      descripcion: true,
      icono: true,
      categoria: true,
      orden: true,
      activo: true,
    },
    orderBy: [
      { categoria: 'asc' },
      { orden: 'asc' },
      { nombre: 'asc' },
    ],
  })
}

export async function createTipoEmpresa(
  payload: CreateTipoEmpresaPayload,
  request: FastifyRequest,
): Promise<TipoEmpresaDetail> {
  await requirePlatformAdmin(request)
  await requirePermission(request, 'tipos_empresa.manage')
  const userId = await getPlatformUserId(request)

  const codigo = normalizeCode(payload.codigo)
  const nombre = payload.nombre.trim()

  if (!codigo) {
    throw createHttpError(400, 'El código del tipo de empresa es obligatorio.')
  }
  if (!nombre) {
    throw createHttpError(400, 'El nombre del tipo de empresa es obligatorio.')
  }

  const conflicting = await prisma.tipoEmpresa.findFirst({
    where: { codigo, deletedAt: null },
    select: { id: true },
  })
  if (conflicting) {
    throw createHttpError(409, 'Ya existe un tipo de empresa con este código.')
  }

  const todosModulos = await prisma.modulo.findMany({
    where: { deletedAt: null, activo: true },
    select: { codigo: true },
  })
  const codigosValidos = new Set(todosModulos.map((m) => m.codigo))
  const modulosSeleccionados = (payload.modulosHabilitados ?? []).filter((c) => codigosValidos.has(c))

  const created = await prisma.tipoEmpresa.create({
    data: {
      codigo,
      nombre,
      descripcion: payload.descripcion?.trim() || null,
      icono: payload.icono?.trim() || null,
      color: payload.color?.trim() || null,
      orden: payload.orden ?? 0,
      activo: payload.activo ?? true,
      createdById: userId,
      updatedById: userId,
      modulos: {
        create: modulosSeleccionados.map((codigo, idx) => ({
          moduloCodigo: codigo,
          orden: idx,
          activo: true,
        })),
      },
    },
    include: {
      modulos: {
        orderBy: [{ orden: 'asc' }, { moduloCodigo: 'asc' }],
        include: {
          modulo: {
            select: {
              codigo: true,
              nombre: true,
              descripcion: true,
              icono: true,
              categoria: true,
              orden: true,
              activo: true,
            },
          },
        },
      },
    },
  })

  const out: TipoEmpresaDetail = {
    id: created.id,
    codigo: created.codigo,
    nombre: created.nombre,
    descripcion: created.descripcion,
    icono: created.icono,
    color: created.color,
    orden: created.orden,
    activo: created.activo,
    modulosHabilitados: created.modulos.map((m) => ({
      codigo: m.modulo.codigo,
      nombre: m.modulo.nombre,
      descripcion: m.modulo.descripcion,
      icono: m.modulo.icono,
      categoria: m.modulo.categoria,
      orden: m.modulo.orden,
      activo: m.modulo.activo,
    })),
  }

  await writeAudit(request, {
    userId,
    action: AccionAuditoria.INSERT,
    table: 'tipos_empresa',
    recordId: created.id,
    nextValue: out,
  })

  return out
}

export async function updateTipoEmpresa(
  tipoId: string,
  payload: UpdateTipoEmpresaPayload,
  request: FastifyRequest,
): Promise<TipoEmpresaDetail> {
  await requirePlatformAdmin(request)
  await requirePermission(request, 'tipos_empresa.manage')
  const userId = await getPlatformUserId(request)

  const existing = await prisma.tipoEmpresa.findFirst({
    where: { id: tipoId, deletedAt: null },
    include: {
      modulos: {
        include: {
          modulo: {
            select: {
              codigo: true,
              nombre: true,
              descripcion: true,
              icono: true,
              categoria: true,
              orden: true,
              activo: true,
            },
          },
        },
      },
    },
  })
  if (!existing) {
    throw createHttpError(404, 'El tipo de empresa no fue encontrado.')
  }

  const next: Record<string, unknown> = {
    updatedById: userId,
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'nombre') && payload.nombre !== undefined) {
    const nombre = payload.nombre.trim()
    if (!nombre) {
      throw createHttpError(400, 'El nombre del tipo de empresa es obligatorio.')
    }
    next.nombre = nombre
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'descripcion')) {
    next.descripcion = payload.descripcion?.trim() || null
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'icono')) {
    next.icono = payload.icono?.trim() || null
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'color')) {
    next.color = payload.color?.trim() || null
  }
  if (typeof payload.orden === 'number') {
    next.orden = payload.orden
  }
  if (typeof payload.activo === 'boolean') {
    next.activo = payload.activo
  }

  if (Object.keys(next).filter((k) => k !== 'updatedById').length === 0) {
    return {
      id: existing.id,
      codigo: existing.codigo,
      nombre: existing.nombre,
      descripcion: existing.descripcion,
      icono: existing.icono,
      color: existing.color,
      orden: existing.orden,
      activo: existing.activo,
      modulosHabilitados: existing.modulos.map((m) => ({
        codigo: m.modulo.codigo,
        nombre: m.modulo.nombre,
        descripcion: m.modulo.descripcion,
        icono: m.modulo.icono,
        categoria: m.modulo.categoria,
        orden: m.modulo.orden,
        activo: m.modulo.activo,
      })),
    }
  }

  const prev: TipoEmpresaDetail = {
    id: existing.id,
    codigo: existing.codigo,
    nombre: existing.nombre,
    descripcion: existing.descripcion,
    icono: existing.icono,
    color: existing.color,
    orden: existing.orden,
    activo: existing.activo,
    modulosHabilitados: existing.modulos.map((m) => ({
      codigo: m.modulo.codigo,
      nombre: m.modulo.nombre,
      descripcion: m.modulo.descripcion,
      icono: m.modulo.icono,
      categoria: m.modulo.categoria,
      orden: m.modulo.orden,
      activo: m.modulo.activo,
    })),
  }

  const updated = await prisma.tipoEmpresa.update({
    where: { id: existing.id },
    data: next,
    include: {
      modulos: {
        include: {
          modulo: {
            select: {
              codigo: true,
              nombre: true,
              descripcion: true,
              icono: true,
              categoria: true,
              orden: true,
              activo: true,
            },
          },
        },
      },
    },
  })

  const out: TipoEmpresaDetail = {
    id: updated.id,
    codigo: updated.codigo,
    nombre: updated.nombre,
    descripcion: updated.descripcion,
    icono: updated.icono,
    color: updated.color,
    orden: updated.orden,
    activo: updated.activo,
    modulosHabilitados: updated.modulos.map((m) => ({
      codigo: m.modulo.codigo,
      nombre: m.modulo.nombre,
      descripcion: m.modulo.descripcion,
      icono: m.modulo.icono,
      categoria: m.modulo.categoria,
      orden: m.modulo.orden,
      activo: m.modulo.activo,
    })),
  }

  await writeAudit(request, {
    userId,
    action: AccionAuditoria.UPDATE,
    table: 'tipos_empresa',
    recordId: updated.id,
    previousValue: prev,
    nextValue: out,
  })

  return out
}

export async function toggleTipoEmpresaStatus(
  tipoId: string,
  _activo: boolean,
  request: FastifyRequest,
): Promise<TipoEmpresaDetail> {
  await requirePlatformAdmin(request)
  await requirePermission(request, 'tipos_empresa.manage')
  const existing = await prisma.tipoEmpresa.findFirst({
    where: { id: tipoId, deletedAt: null },
    select: { id: true, activo: true },
  })
  if (!existing) {
    throw createHttpError(404, 'El tipo de empresa no fue encontrado.')
  }

  return updateTipoEmpresa(tipoId, { activo: !existing.activo }, request)
}

export async function getTipoEmpresaModulos(
  tipoId: string,
  request: FastifyRequest,
): Promise<ModuloCatalogoItem[]> {
  await requirePlatformAdmin(request)
  await requirePermission(request, 'tipos_empresa.manage')
  await getPlatformUserId(request)

  const tipo = await prisma.tipoEmpresa.findFirst({
    where: { id: tipoId, deletedAt: null },
    include: {
      modulos: {
        orderBy: [{ orden: 'asc' }, { moduloCodigo: 'asc' }],
        include: {
          modulo: {
            select: {
              codigo: true,
              nombre: true,
              descripcion: true,
              icono: true,
              categoria: true,
              orden: true,
              activo: true,
            },
          },
        },
      },
    },
  })
  if (!tipo) {
    throw createHttpError(404, 'El tipo de empresa no fue encontrado.')
  }

  return tipo.modulos.map((m) => ({
    codigo: m.modulo.codigo,
    nombre: m.modulo.nombre,
    descripcion: m.modulo.descripcion,
    icono: m.modulo.icono,
    categoria: m.modulo.categoria,
    orden: m.modulo.orden,
    activo: m.modulo.activo,
  }))
}

type UpdateModulosPayload = {
  modulosHabilitados: string[]
}

export async function updateTipoEmpresaModulos(
  tipoId: string,
  payload: UpdateModulosPayload,
  request: FastifyRequest,
): Promise<ModuloCatalogoItem[]> {
  await requirePlatformAdmin(request)
  await requirePermission(request, 'tipos_empresa.manage')
  const userId = await getPlatformUserId(request)

  const existing = await prisma.tipoEmpresa.findFirst({
    where: { id: tipoId, deletedAt: null },
    include: {
      modulos: {
        select: { moduloCodigo: true },
      },
    },
  })
  if (!existing) {
    throw createHttpError(404, 'El tipo de empresa no fue encontrado.')
  }

  const todosModulos = await prisma.modulo.findMany({
    where: { deletedAt: null, activo: true },
    select: { codigo: true },
  })
  const codigosValidos = new Set(todosModulos.map((m) => m.codigo))
  const codigosSolicitados = Array.from(new Set((payload.modulosHabilitados ?? []).filter((c) => codigosValidos.has(c))))

  const anteriores = existing.modulos.map((m) => m.moduloCodigo)
  const anterioresSet = new Set(anteriores)
  const siguientesSet = new Set(codigosSolicitados)
  const paraRemover = anteriores.filter((c) => !siguientesSet.has(c))
  const paraAgregar = codigosSolicitados.filter((c) => !anterioresSet.has(c))

  if (paraRemover.length > 0 || paraAgregar.length > 0) {
    await prisma.$transaction(async (tx) => {
      if (paraRemover.length > 0) {
        await tx.tipoEmpresaModulo.updateMany({
          where: {
            tipoEmpresaId: tipoId,
            moduloCodigo: { in: paraRemover },
          },
          data: {
            activo: false,
          },
        })
      }
      for (let i = 0; i < codigosSolicitados.length; i++) {
        const codigo = codigosSolicitados[i]
        await tx.tipoEmpresaModulo.upsert({
          where: {
            tipoEmpresaId_moduloCodigo: {
              tipoEmpresaId: tipoId,
              moduloCodigo: codigo,
            },
          },
          create: {
            tipoEmpresaId: tipoId,
            moduloCodigo: codigo,
            orden: i,
            activo: true,
          },
          update: {
            activo: true,
            orden: i,
          },
        })
      }
    })
  }

  const final = await prisma.tipoEmpresa.findFirstOrThrow({
    where: { id: tipoId, deletedAt: null },
    include: {
      modulos: {
        orderBy: [{ orden: 'asc' }, { moduloCodigo: 'asc' }],
        include: {
          modulo: {
            select: {
              codigo: true,
              nombre: true,
              descripcion: true,
              icono: true,
              categoria: true,
              orden: true,
              activo: true,
            },
          },
        },
      },
    },
  })

  const out: ModuloCatalogoItem[] = final.modulos.map((m) => ({
    codigo: m.modulo.codigo,
    nombre: m.modulo.nombre,
    descripcion: m.modulo.descripcion,
    icono: m.modulo.icono,
    categoria: m.modulo.categoria,
    orden: m.modulo.orden,
    activo: m.modulo.activo,
  }))

  await writeAudit(request, {
    userId,
    action: AccionAuditoria.UPDATE,
    table: 'tipo_empresa_modulo',
    recordId: tipoId,
    previousValue: { anteriores },
    nextValue: { siguientes: codigosSolicitados },
  })

  return out
}

export async function listEmpresas(request: FastifyRequest): Promise<EmpresaListItem[]> {
  await requirePlatformAdmin(request)
  await requirePermission(request, 'empresas.read')
  await getPlatformUserId(request)

  const rows = await prisma.empresa.findMany({
    where: { deletedAt: null },
    include: {
      tipoEmpresa: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          color: true,
          activo: true,
        },
      },
      _count: {
        select: {
          sucursales: true,
          usuarios: true,
        },
      },
    },
    orderBy: [{ activo: 'desc' }, { razonSocial: 'asc' }],
  })

  return rows.map((r) => ({
    id: r.id,
    razonSocial: r.razonSocial,
    nombreComercial: r.nombreComercial,
    numeroDocumento: r.numeroDocumento,
    tipoEmpresa: {
      id: r.tipoEmpresa.id,
      codigo: r.tipoEmpresa.codigo,
      nombre: r.tipoEmpresa.nombre,
      color: r.tipoEmpresa.color,
      activo: r.tipoEmpresa.activo,
    },
    sucursalesCount: r._count.sucursales,
    usuariosCount: r._count.usuarios,
    activo: r.activo,
    createdAt: r.createdAt ? r.createdAt.toISOString() : null,
  }))
}

export async function getEmpresaDetail(
  empresaId: string,
  request: FastifyRequest,
): Promise<EmpresaDetail> {
  await requirePlatformAdmin(request)
  await requirePermission(request, 'empresas.read')
  await getPlatformUserId(request)

  const empresa = await prisma.empresa.findFirst({
    where: { id: empresaId, deletedAt: null },
    include: {
      tipoEmpresa: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          color: true,
          activo: true,
        },
      },
      _count: {
        select: {
          sucursales: true,
          usuarios: true,
        },
      },
    },
  })
  if (!empresa) {
    throw createHttpError(404, 'La empresa no fue encontrada.')
  }

  return {
    id: empresa.id,
    tipoEmpresaId: empresa.tipoEmpresaId,
    razonSocial: empresa.razonSocial,
    nombreComercial: empresa.nombreComercial,
    tipoDocumento: empresa.tipoDocumento,
    numeroDocumento: empresa.numeroDocumento,
    email: empresa.email,
    telefono: empresa.telefono,
    direccion: empresa.direccion,
    ubigeo: empresa.ubigeo,
    monedaBase: empresa.monedaBase,
    zonaHoraria: empresa.zonaHoraria,
    activo: empresa.activo,
    createdAt: empresa.createdAt ? empresa.createdAt.toISOString() : null,
    tipoEmpresa: {
      id: empresa.tipoEmpresa.id,
      codigo: empresa.tipoEmpresa.codigo,
      nombre: empresa.tipoEmpresa.nombre,
      color: empresa.tipoEmpresa.color,
      activo: empresa.tipoEmpresa.activo,
    },
    sucursalesCount: empresa._count.sucursales,
    usuariosCount: empresa._count.usuarios,
  }
}

export async function createEmpresa(
  payload: CreateEmpresaPayload,
  request: FastifyRequest,
): Promise<EmpresaDetail> {
  await requirePlatformAdmin(request)
  await requirePermission(request, 'empresas.manage')
  const userId = await getPlatformUserId(request)

  const razonSocial = payload.razonSocial.trim()
  const numeroDocumento = payload.numeroDocumento.trim()
  const tipoEmpresaId = payload.tipoEmpresaId

  if (!razonSocial) {
    throw createHttpError(400, 'La razón social es obligatoria.')
  }
  if (!numeroDocumento) {
    throw createHttpError(400, 'El número de documento es obligatorio.')
  }
  if (!tipoEmpresaId) {
    throw createHttpError(400, 'El tipo de empresa es obligatorio.')
  }

  const tipoEmpresa = await prisma.tipoEmpresa.findFirst({
    where: { id: tipoEmpresaId, deletedAt: null },
    select: { id: true, codigo: true, nombre: true, color: true, activo: true },
  })
  if (!tipoEmpresa) {
    throw createHttpError(400, 'El tipo de empresa seleccionado no es válido.')
  }

  const existing = await prisma.empresa.findFirst({
    where: { numeroDocumento, deletedAt: null },
    select: { id: true },
  })
  if (existing) {
    throw createHttpError(409, 'Ya existe una empresa con ese número de documento.')
  }

  const created = await prisma.empresa.create({
    data: {
      tipoEmpresaId,
      razonSocial,
      nombreComercial: payload.nombreComercial?.trim() || null,
      tipoDocumento: payload.tipoDocumento ?? TipoDocumentoIdentidad.RUC,
      numeroDocumento,
      email: payload.email?.trim() || null,
      telefono: payload.telefono?.trim() || null,
      direccion: payload.direccion?.trim() || null,
      ubigeo: payload.ubigeo?.trim() || null,
      monedaBase: payload.monedaBase?.trim() || 'PEN',
      zonaHoraria: payload.zonaHoraria?.trim() || 'America/Lima',
      activo: payload.activo ?? true,
      createdById: userId,
      updatedById: userId,
    },
    include: {
      tipoEmpresa: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          color: true,
          activo: true,
        },
      },
      _count: {
        select: {
          sucursales: true,
          usuarios: true,
        },
      },
    },
  })

  const out: EmpresaDetail = {
    id: created.id,
    tipoEmpresaId: created.tipoEmpresaId,
    razonSocial: created.razonSocial,
    nombreComercial: created.nombreComercial,
    tipoDocumento: created.tipoDocumento,
    numeroDocumento: created.numeroDocumento,
    email: created.email,
    telefono: created.telefono,
    direccion: created.direccion,
    ubigeo: created.ubigeo,
    monedaBase: created.monedaBase,
    zonaHoraria: created.zonaHoraria,
    activo: created.activo,
    createdAt: created.createdAt ? created.createdAt.toISOString() : null,
    tipoEmpresa: {
      id: created.tipoEmpresa.id,
      codigo: created.tipoEmpresa.codigo,
      nombre: created.tipoEmpresa.nombre,
      color: created.tipoEmpresa.color,
      activo: created.tipoEmpresa.activo,
    },
    sucursalesCount: created._count.sucursales,
    usuariosCount: created._count.usuarios,
  }

  await writeAudit(request, {
    userId,
    action: AccionAuditoria.INSERT,
    table: 'empresas',
    recordId: created.id,
    nextValue: out,
  })

  return out
}

const SALT_ROUNDS = 10

function normalizeSucursalCode(input: string) {
  return input.trim().toUpperCase().replace(/\s+/g, '_')
}

export async function createEmpresaOnboarding(
  payload: CreateEmpresaOnboardingPayload,
  request: FastifyRequest,
): Promise<EmpresaOnboardingResult> {
  await requirePlatformAdmin(request)
  await requirePermission(request, 'empresas.manage')
  await requirePermission(request, 'administradores.manage')
  await requirePermission(request, 'usuarios.manage')
  const userId = await getPlatformUserId(request)

  const empresaPayload = payload.empresa
  const sucursalPayload = payload.sucursal
  const adminPayload = payload.admin

  const razonSocial = empresaPayload.razonSocial.trim()
  const numeroDocumento = empresaPayload.numeroDocumento.trim()
  const tipoEmpresaId = empresaPayload.tipoEmpresaId

  if (!razonSocial) {
    throw createHttpError(400, 'La razón social es obligatoria.')
  }
  if (!numeroDocumento) {
    throw createHttpError(400, 'El número de documento es obligatorio.')
  }
  if (!tipoEmpresaId) {
    throw createHttpError(400, 'El tipo de empresa es obligatorio.')
  }

  const sucursalCodigo = normalizeSucursalCode(sucursalPayload.codigo)
  const sucursalNombre = sucursalPayload.nombre.trim()

  if (!sucursalCodigo) {
    throw createHttpError(400, 'El código de la sucursal es obligatorio.')
  }
  if (!sucursalNombre) {
    throw createHttpError(400, 'El nombre de la sucursal es obligatorio.')
  }

  const adminUsername = adminPayload.username.trim()
  const adminNombres = adminPayload.nombres.trim()
  const adminApellidos = adminPayload.apellidos.trim()
  const adminPassword = adminPayload.password.trim()

  if (!adminUsername) {
    throw createHttpError(400, 'El username del administrador es obligatorio.')
  }
  if (!adminPassword) {
    throw createHttpError(400, 'La contraseña del administrador es obligatoria.')
  }
  if (!adminNombres) {
    throw createHttpError(400, 'Los nombres del administrador son obligatorios.')
  }
  if (!adminApellidos) {
    throw createHttpError(400, 'Los apellidos del administrador son obligatorios.')
  }

  const tipoEmpresa = await prisma.tipoEmpresa.findFirst({
    where: { id: tipoEmpresaId, deletedAt: null },
    select: { id: true },
  })
  if (!tipoEmpresa) {
    throw createHttpError(400, 'El tipo de empresa seleccionado no es válido.')
  }

  const existingEmpresa = await prisma.empresa.findFirst({
    where: { numeroDocumento, deletedAt: null },
    select: { id: true },
  })
  if (existingEmpresa) {
    throw createHttpError(409, 'Ya existe una empresa con ese número de documento.')
  }

  const existingUsername = await prisma.usuario.findFirst({
    where: { username: adminUsername, deletedAt: null },
    select: { id: true },
  })
  if (existingUsername) {
    throw createHttpError(409, 'Ya existe un usuario con este nombre de usuario.')
  }

  const adminEmail = adminPayload.email?.trim() || null
  if (adminEmail) {
    const existingEmail = await prisma.usuario.findFirst({
      where: { email: adminEmail, deletedAt: null },
      select: { id: true },
    })
    if (existingEmail) {
      throw createHttpError(409, 'Ya existe un usuario con este correo.')
    }
  }

  const onboarding = await prisma.$transaction(async (tx) => {
    const rolAdmin = await tx.rol.findFirst({
      where: { codigo: 'ADMIN', deletedAt: null, activo: true },
      select: { id: true },
    })
    if (!rolAdmin) {
      throw createHttpError(500, 'No se encontró el rol ADMIN para crear el administrador de empresa.')
    }

    const empresa = await tx.empresa.create({
      data: {
        tipoEmpresaId,
        razonSocial,
        nombreComercial: empresaPayload.nombreComercial?.trim() || null,
        tipoDocumento: empresaPayload.tipoDocumento ?? TipoDocumentoIdentidad.RUC,
        numeroDocumento,
        email: empresaPayload.email?.trim() || null,
        telefono: empresaPayload.telefono?.trim() || null,
        direccion: empresaPayload.direccion?.trim() || null,
        ubigeo: empresaPayload.ubigeo?.trim() || null,
        monedaBase: empresaPayload.monedaBase?.trim() || 'PEN',
        zonaHoraria: empresaPayload.zonaHoraria?.trim() || 'America/Lima',
        activo: empresaPayload.activo ?? true,
        createdById: userId,
        updatedById: userId,
      },
      select: { id: true },
    })

    const sucursal = await tx.sucursal.create({
      data: {
        empresaId: empresa.id,
        codigo: sucursalCodigo,
        nombre: sucursalNombre,
        direccion: sucursalPayload.direccion?.trim() || null,
        telefono: sucursalPayload.telefono?.trim() || null,
        email: sucursalPayload.email?.trim() || null,
        ubigeo: sucursalPayload.ubigeo?.trim() || null,
        esPrincipal: true,
        activo: true,
        createdById: userId,
        updatedById: userId,
      },
      select: { id: true },
    })

    const passwordHash = await hash(adminPassword, SALT_ROUNDS)

    const usuario = await tx.usuario.create({
      data: {
        empresaId: empresa.id,
        sucursalId: sucursal.id,
        username: adminUsername,
        email: adminEmail,
        passwordHash,
        nombres: adminNombres,
        apellidos: adminApellidos,
        tipoDocumento: adminPayload.tipoDocumento,
        numeroDocumento: adminPayload.numeroDocumento?.trim() || null,
        telefono: adminPayload.telefono?.trim() || null,
        activo: adminPayload.activo ?? true,
        createdById: userId,
        updatedById: userId,
      },
      select: { id: true, username: true, email: true },
    })

    await tx.usuarioRol.create({
      data: {
        usuarioId: usuario.id,
        rolId: rolAdmin.id,
        activo: true,
        createdById: userId,
        updatedById: userId,
      },
    })

    await tx.usuarioSucursal.create({
      data: {
        usuarioId: usuario.id,
        sucursalId: sucursal.id,
        rolId: rolAdmin.id,
        activo: true,
        createdById: userId,
        updatedById: userId,
      },
    })

    return {
      empresaId: empresa.id,
      sucursalId: sucursal.id,
      adminUsuario: usuario,
    }
  })

  const empresaDetail = await getEmpresaDetail(onboarding.empresaId, request)

  await writeAudit(request, {
    userId,
    action: AccionAuditoria.INSERT,
    table: 'empresas_onboarding',
    recordId: onboarding.empresaId,
    nextValue: {
      empresaId: onboarding.empresaId,
      sucursalId: onboarding.sucursalId,
      adminUsuarioId: onboarding.adminUsuario.id,
    },
  })

  return {
    empresa: empresaDetail,
    sucursalId: onboarding.sucursalId,
    adminUsuario: onboarding.adminUsuario,
  }
}

export async function updateEmpresa(
  empresaId: string,
  payload: UpdateEmpresaPayload,
  request: FastifyRequest,
): Promise<EmpresaDetail> {
  await requirePlatformAdmin(request)
  await requirePermission(request, 'empresas.manage')
  const userId = await getPlatformUserId(request)

  const existing = await prisma.empresa.findFirst({
    where: { id: empresaId, deletedAt: null },
    include: {
      tipoEmpresa: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          color: true,
          activo: true,
        },
      },
      _count: {
        select: {
          sucursales: true,
          usuarios: true,
        },
      },
    },
  })
  if (!existing) {
    throw createHttpError(404, 'La empresa no fue encontrada.')
  }

  const prev: EmpresaDetail = {
    id: existing.id,
    tipoEmpresaId: existing.tipoEmpresaId,
    razonSocial: existing.razonSocial,
    nombreComercial: existing.nombreComercial,
    tipoDocumento: existing.tipoDocumento,
    numeroDocumento: existing.numeroDocumento,
    email: existing.email,
    telefono: existing.telefono,
    direccion: existing.direccion,
    ubigeo: existing.ubigeo,
    monedaBase: existing.monedaBase,
    zonaHoraria: existing.zonaHoraria,
    activo: existing.activo,
    createdAt: existing.createdAt ? existing.createdAt.toISOString() : null,
    tipoEmpresa: {
      id: existing.tipoEmpresa.id,
      codigo: existing.tipoEmpresa.codigo,
      nombre: existing.tipoEmpresa.nombre,
      color: existing.tipoEmpresa.color,
      activo: existing.tipoEmpresa.activo,
    },
    sucursalesCount: existing._count.sucursales,
    usuariosCount: existing._count.usuarios,
  }

  const next: Prisma.EmpresaUncheckedUpdateInput = {
    updatedById: userId,
  }

  if (payload.tipoEmpresaId) {
    const tipo = await prisma.tipoEmpresa.findFirst({
      where: { id: payload.tipoEmpresaId, deletedAt: null },
      select: { id: true },
    })
    if (!tipo) {
      throw createHttpError(400, 'El tipo de empresa seleccionado no es válido.')
    }
    next.tipoEmpresaId = payload.tipoEmpresaId
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'razonSocial') && payload.razonSocial !== undefined) {
    const value = payload.razonSocial.trim()
    if (!value) {
      throw createHttpError(400, 'La razón social es obligatoria.')
    }
    next.razonSocial = value
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'nombreComercial')) {
    next.nombreComercial = payload.nombreComercial?.trim() || null
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'tipoDocumento') && payload.tipoDocumento !== undefined) {
    next.tipoDocumento = payload.tipoDocumento
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'numeroDocumento') && payload.numeroDocumento !== undefined) {
    const value = payload.numeroDocumento.trim()
    if (!value) {
      throw createHttpError(400, 'El número de documento es obligatorio.')
    }
    const conflict = await prisma.empresa.findFirst({
      where: { numeroDocumento: value, deletedAt: null, NOT: { id: existing.id } },
      select: { id: true },
    })
    if (conflict) {
      throw createHttpError(409, 'Ya existe una empresa con ese número de documento.')
    }
    next.numeroDocumento = value
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'email')) {
    next.email = payload.email?.trim() || null
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'telefono')) {
    next.telefono = payload.telefono?.trim() || null
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'direccion')) {
    next.direccion = payload.direccion?.trim() || null
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'ubigeo')) {
    next.ubigeo = payload.ubigeo?.trim() || null
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'monedaBase') && payload.monedaBase !== undefined) {
    next.monedaBase = payload.monedaBase.trim()
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'zonaHoraria') && payload.zonaHoraria !== undefined) {
    next.zonaHoraria = payload.zonaHoraria.trim()
  }

  if (typeof payload.activo === 'boolean') {
    next.activo = payload.activo
  }

  const updated = await prisma.empresa.update({
    where: { id: existing.id },
    data: next,
    include: {
      tipoEmpresa: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          color: true,
          activo: true,
        },
      },
      _count: {
        select: {
          sucursales: true,
          usuarios: true,
        },
      },
    },
  })

  const out: EmpresaDetail = {
    id: updated.id,
    tipoEmpresaId: updated.tipoEmpresaId,
    razonSocial: updated.razonSocial,
    nombreComercial: updated.nombreComercial,
    tipoDocumento: updated.tipoDocumento,
    numeroDocumento: updated.numeroDocumento,
    email: updated.email,
    telefono: updated.telefono,
    direccion: updated.direccion,
    ubigeo: updated.ubigeo,
    monedaBase: updated.monedaBase,
    zonaHoraria: updated.zonaHoraria,
    activo: updated.activo,
    createdAt: updated.createdAt ? updated.createdAt.toISOString() : null,
    tipoEmpresa: {
      id: updated.tipoEmpresa.id,
      codigo: updated.tipoEmpresa.codigo,
      nombre: updated.tipoEmpresa.nombre,
      color: updated.tipoEmpresa.color,
      activo: updated.tipoEmpresa.activo,
    },
    sucursalesCount: updated._count.sucursales,
    usuariosCount: updated._count.usuarios,
  }

  await writeAudit(request, {
    userId,
    action: AccionAuditoria.UPDATE,
    table: 'empresas',
    recordId: updated.id,
    previousValue: prev,
    nextValue: out,
  })

  return out
}

export async function toggleEmpresaStatus(
  empresaId: string,
  request: FastifyRequest,
): Promise<EmpresaDetail> {
  await requirePlatformAdmin(request)
  await requirePermission(request, 'empresas.manage')
  const existing = await prisma.empresa.findFirst({
    where: { id: empresaId, deletedAt: null },
    select: { id: true, activo: true },
  })
  if (!existing) {
    throw createHttpError(404, 'La empresa no fue encontrada.')
  }

  return updateEmpresa(empresaId, { activo: !existing.activo }, request)
}
