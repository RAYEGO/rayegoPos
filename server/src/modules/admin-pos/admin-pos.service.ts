import { AccionAuditoria, Prisma } from '@prisma/client'
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
