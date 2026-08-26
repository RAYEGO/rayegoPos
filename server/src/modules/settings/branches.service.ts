import { AccionAuditoria, Prisma } from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { requireBranchAuthContext, requirePermission } from '../../lib/auth.js'

type BranchListItem = {
  id: string
  nombre: string
  codigo: string
  direccion: string | null
  telefono: string | null
  email: string | null
  activo: boolean
}

type BranchDetail = BranchListItem

type CreateBranchPayload = {
  nombre: string
  codigo: string
  direccion?: string | null
  telefono?: string | null
  email?: string | null
  activo?: boolean
}

type UpdateBranchPayload = {
  nombre?: string
  direccion?: string | null
  telefono?: string | null
  email?: string | null
  activo?: boolean
}

function createHttpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number }
  error.statusCode = statusCode
  return error
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase()
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

export async function listBranchesForCompany(request: FastifyRequest): Promise<BranchListItem[]> {
  const { companyId } = await requireBranchAuthContext(request)
  return prisma.sucursal.findMany({
    where: {
      empresaId: companyId,
      deletedAt: null,
    },
    select: {
      id: true,
      nombre: true,
      codigo: true,
      direccion: true,
      telefono: true,
      email: true,
      activo: true,
    },
    orderBy: [
      { activo: 'desc' },
      { codigo: 'asc' },
      { nombre: 'asc' },
    ],
  })
}

export async function getBranchDetail(
  branchId: string,
  request: FastifyRequest,
): Promise<BranchDetail> {
  const { companyId } = await requireBranchAuthContext(request)
  const branch = await prisma.sucursal.findFirst({
    where: {
      id: branchId,
      empresaId: companyId,
      deletedAt: null,
    },
    select: {
      id: true,
      nombre: true,
      codigo: true,
      direccion: true,
      telefono: true,
      email: true,
      activo: true,
    },
  })

  if (!branch) {
    throw createHttpError(404, 'La sucursal no fue encontrada.')
  }
  return branch
}

export async function createBranch(
  payload: CreateBranchPayload,
  request: FastifyRequest,
): Promise<BranchDetail> {
  requirePermission(request, 'configuracion.read')
  const { companyId, userId } = await requireBranchAuthContext(request)

  const nombre = payload.nombre.trim()
  const codigo = normalizeCode(payload.codigo)

  if (!nombre) {
    throw createHttpError(400, 'El nombre de la sucursal es obligatorio.')
  }
  if (!codigo) {
    throw createHttpError(400, 'El código de la sucursal es obligatorio.')
  }

  const conflicting = await prisma.sucursal.findFirst({
    where: {
      empresaId: companyId,
      codigo,
      deletedAt: null,
    },
    select: { id: true, codigo: true },
  })

  if (conflicting) {
    throw createHttpError(
      409,
      'Ya existe una sucursal con este código dentro de la empresa.',
    )
  }

  const created = await prisma.sucursal.create({
    data: {
      empresaId: companyId,
      nombre,
      codigo,
      direccion: payload.direccion?.trim() || null,
      telefono: payload.telefono?.trim() || null,
      email: payload.email?.trim() || null,
      activo: payload.activo ?? true,
      createdById: userId,
      updatedById: userId,
    },
    select: {
      id: true,
      nombre: true,
      codigo: true,
      direccion: true,
      telefono: true,
      email: true,
      activo: true,
    },
  })

  await writeAudit(request, {
    userId,
    action: AccionAuditoria.INSERT,
    table: 'sucursales',
    recordId: created.id,
    nextValue: created,
  })

  return created
}

export async function updateBranch(
  branchId: string,
  payload: UpdateBranchPayload,
  request: FastifyRequest,
): Promise<BranchDetail> {
  requirePermission(request, 'configuracion.read')
  const { companyId, userId } = await requireBranchAuthContext(request)

  const existing = await prisma.sucursal.findFirst({
    where: {
      id: branchId,
      empresaId: companyId,
      deletedAt: null,
    },
    select: {
      id: true,
      nombre: true,
      codigo: true,
      direccion: true,
      telefono: true,
      email: true,
      activo: true,
    },
  })

  if (!existing) {
    throw createHttpError(404, 'La sucursal no fue encontrada.')
  }

  const next: Record<string, unknown> = {
    updatedById: userId,
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'nombre') && payload.nombre !== undefined) {
    const nombre = payload.nombre.trim()
    if (!nombre) {
      throw createHttpError(400, 'El nombre de la sucursal es obligatorio.')
    }
    next.nombre = nombre
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'direccion')) {
    next.direccion = payload.direccion?.trim() || null
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'telefono')) {
    next.telefono = payload.telefono?.trim() || null
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'email')) {
    next.email = payload.email?.trim() || null
  }
  if (typeof payload.activo === 'boolean') {
    next.activo = payload.activo
  }

  if (Object.keys(next).filter((k) => k !== 'updatedById').length === 0) {
    return existing
  }

  const updated = await prisma.sucursal.update({
    where: { id: existing.id },
    data: next,
    select: {
      id: true,
      nombre: true,
      codigo: true,
      direccion: true,
      telefono: true,
      email: true,
      activo: true,
    },
  })

  await writeAudit(request, {
    userId,
    action: AccionAuditoria.UPDATE,
    table: 'sucursales',
    recordId: updated.id,
    previousValue: existing,
    nextValue: updated,
  })

  return updated
}

export async function toggleBranchStatus(
  branchId: string,
  request: FastifyRequest,
): Promise<BranchDetail> {
  const { companyId } = await requireBranchAuthContext(request)
  const existing = await prisma.sucursal.findFirst({
    where: {
      id: branchId,
      empresaId: companyId,
      deletedAt: null,
    },
    select: {
      id: true,
      activo: true,
    },
  })
  if (!existing) {
    throw createHttpError(404, 'La sucursal no fue encontrada.')
  }
  return updateBranch(
    branchId,
    { activo: !existing.activo },
    request,
  )
}
