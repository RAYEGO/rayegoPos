import { AccionAuditoria, Prisma } from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import {
  getAuthContext,
  requireBranchAuthContext,
  requirePermission,
} from '../../lib/auth.js'
import type { AuthPermission, AuthRole } from '../auth/auth.types.js'
import { AUTH_ROLE_CODES } from '../users/users.service.js'

const PLATFORM_ONLY_ROLES: AuthRole[] = ['ADMIN_POS']

export type RoleListItem = {
  codigo: AuthRole
  nombre: string
  descripcion: string | null
  isPlatformOnly: boolean
  permissionsCount: number
}

export type RolePermissionsDetail = {
  codigo: AuthRole
  nombre: string
  descripcion: string | null
  isPlatformOnly: boolean
  permisos: AuthPermission[]
  permisosDisponibles: {
    codigo: string
    modulo: string
    nombre: string
    descripcion: string | null
    tipo: 'read' | 'manage' | 'otro'
  }[]
}

export type UpdateRolePermissionsPayload = {
  codigo: AuthRole
  permisos: AuthPermission[]
}

export const updateRolePermissionsSchema = z.object({
  codigo: z.enum(AUTH_ROLE_CODES),
  permisos: z.array(z.string().min(1).max(100)).default([]),
})

type HttpError = Error & { statusCode: number; code?: string }

function createHttpError(statusCode: number, message: string, code?: string): HttpError {
  const error = new Error(message) as HttpError
  error.statusCode = statusCode
  if (code) error.code = code
  return error
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
        valorAnterior: data.previousValue as Prisma.InputJsonValue | undefined,
        valorNuevo: data.nextValue as Prisma.InputJsonValue | undefined,
        direccionIp: request.ip,
        userAgent: request.headers['user-agent'],
      },
    })
  } catch {
    /* ignore audit errors */
  }
}

async function assertCanAdministerRole(
  request: FastifyRequest,
  roleCodigo: AuthRole,
): Promise<{
  isPlatform: boolean
  companyId: string | null
  currentUserId: string
}> {
  await requirePermission(request, 'usuarios.manage')
  const ctx = await getAuthContext(request)
  const isPlatform = Boolean(ctx.isPlatformAdmin) || ctx.roles.includes('ADMIN_POS')
  const isPlatformOnly = PLATFORM_ONLY_ROLES.includes(roleCodigo)

  if (isPlatformOnly && !isPlatform) {
    throw createHttpError(
      403,
      'No tienes autorización para administrar roles de plataforma.',
      'ROLE_PLATFORM_ONLY',
    )
  }
  return {
    isPlatform,
    companyId: ctx.isPlatformAdmin ? null : (ctx.companyId ?? null),
    currentUserId: ctx.userId,
  }
}

function normalizeTipoPermiso(codigo: string): 'read' | 'manage' | 'otro' {
  if (codigo.endsWith('.read')) return 'read'
  if (codigo.endsWith('.manage')) return 'manage'
  return 'otro'
}

export async function listRolesForAdmin(
  request: FastifyRequest,
): Promise<RoleListItem[]> {
  await requirePermission(request, 'usuarios.read')
  const ctx = await getAuthContext(request)
  const isPlatform = Boolean(ctx.isPlatformAdmin) || ctx.roles.includes('ADMIN_POS')

  const where: Prisma.RolWhereInput = {
    deletedAt: null,
    activo: true,
  }
  if (!isPlatform) {
    where.AND = [{ NOT: { codigo: { in: PLATFORM_ONLY_ROLES } } }]
  }

  const roles = await prisma.rol.findMany({
    where,
    orderBy: [{ codigo: 'asc' }],
    select: {
      codigo: true,
      nombre: true,
      descripcion: true,
      rolesPermisos: {
        where: { deletedAt: null },
        select: { id: true },
      },
    },
  })

  return roles.map((rol) => ({
    codigo: rol.codigo as AuthRole,
    nombre: rol.nombre,
    descripcion: rol.descripcion,
    isPlatformOnly: PLATFORM_ONLY_ROLES.includes(rol.codigo as AuthRole),
    permissionsCount: rol.rolesPermisos.length,
  }))
}

export async function getRolePermissionsDetail(
  roleCodigo: AuthRole,
  request: FastifyRequest,
): Promise<RolePermissionsDetail> {
  const auth = await assertCanAdministerRole(request, roleCodigo)
  void auth

  const [rol, permisosDisponibles] = await Promise.all([
    prisma.rol.findFirst({
      where: {
        codigo: roleCodigo,
        deletedAt: null,
        activo: true,
      },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        descripcion: true,
        rolesPermisos: {
          where: { deletedAt: null },
          include: {
            permiso: {
              select: { codigo: true, modulo: true, nombre: true, descripcion: true, activo: true },
            },
          },
        },
      },
    }),
    prisma.permiso.findMany({
      where: { deletedAt: null, activo: true },
      select: { codigo: true, modulo: true, nombre: true, descripcion: true },
      orderBy: [{ modulo: 'asc' }, { codigo: 'asc' }],
    }),
  ])

  if (!rol) {
    throw createHttpError(404, 'Rol no encontrado.', 'ROLE_NOT_FOUND')
  }

  const permisos = rol.rolesPermisos
    .filter((rp) => rp.permiso.activo)
    .map((rp) => rp.permiso.codigo) as AuthPermission[]

  return {
    codigo: rol.codigo as AuthRole,
    nombre: rol.nombre,
    descripcion: rol.descripcion,
    isPlatformOnly: PLATFORM_ONLY_ROLES.includes(rol.codigo as AuthRole),
    permisos,
    permisosDisponibles: permisosDisponibles.map((p) => ({
      codigo: p.codigo,
      modulo: p.modulo,
      nombre: p.nombre,
      descripcion: p.descripcion,
      tipo: normalizeTipoPermiso(p.codigo),
    })),
  }
}

export async function updateRolePermissions(
  roleCodigo: AuthRole,
  rawPayload: UpdateRolePermissionsPayload,
  request: FastifyRequest,
): Promise<{ ok: true; affectedUsers: number }> {
  const payload = updateRolePermissionsSchema.parse({
    codigo: roleCodigo,
    permisos: rawPayload.permisos ?? [],
  })
  if (payload.codigo !== roleCodigo) {
    throw createHttpError(400, 'Rol inconsistente en la solicitud.', 'ROLE_MISMATCH')
  }

  const auth = await assertCanAdministerRole(request, roleCodigo)
  const companyScope = auth.isPlatform ? undefined : auth.companyId

  const rol = await prisma.rol.findFirst({
    where: {
      codigo: payload.codigo,
      deletedAt: null,
      activo: true,
    },
    select: { id: true, codigo: true, nombre: true },
  })
  if (!rol) {
    throw createHttpError(404, 'Rol no encontrado.', 'ROLE_NOT_FOUND')
  }

  const allPermisosRows = await prisma.permiso.findMany({
    where: { deletedAt: null, activo: true },
    select: { id: true, codigo: true },
  })
  const permisoPorCodigo = new Map(allPermisosRows.map((p) => [p.codigo, p.id]))

  const permisosNormalizados = Array.from(new Set(payload.permisos)).filter(
    (codigo) => permisoPorCodigo.has(codigo),
  )

  const previousPermisos = await prisma.rolPermiso.findMany({
    where: { rolId: rol.id, deletedAt: null },
    include: { permiso: { select: { codigo: true } } },
  })

  const previousCodes = new Set(previousPermisos.map((p) => p.permiso.codigo))
  const nextCodes = new Set(permisosNormalizados)

  if (
    previousCodes.size === nextCodes.size &&
    Array.from(previousCodes).every((c) => nextCodes.has(c))
  ) {
    return { ok: true, affectedUsers: 0 }
  }

  const toSoftDelete = previousPermisos.filter((p) => !nextCodes.has(p.permiso.codigo))
  const toAdd = permisosNormalizados.filter((c) => !previousCodes.has(c))

  const affectedUsersCount = await prisma.$transaction(async (tx) => {
    if (toSoftDelete.length > 0) {
      await tx.rolPermiso.updateMany({
        where: {
          id: { in: toSoftDelete.map((p) => p.id) },
        },
        data: {
          deletedAt: new Date(),
          updatedById: auth.currentUserId,
        },
      })
    }

    const toAddPermisoIds = toAdd.map((codigo) => permisoPorCodigo.get(codigo)).filter(
      (v): v is string => typeof v === 'string' && v.length > 0,
    )

    if (toAddPermisoIds.length > 0) {
      await tx.rolPermiso.deleteMany({
        where: {
          rolId: rol.id,
          permisoId: { in: toAddPermisoIds },
        },
      })
      const createRows = toAddPermisoIds.map((pid) => ({
        rolId: rol.id,
        permisoId: pid,
        createdById: auth.currentUserId,
        updatedById: auth.currentUserId,
      }))
      await tx.rolPermiso.createMany({
        data: createRows,
      })
    }

    const usuarioRolWhere: Prisma.UsuarioWhereInput = {
      deletedAt: null,
    }
    if (companyScope) {
      usuarioRolWhere.empresaId = companyScope
    }
    usuarioRolWhere.usuariosRoles = {
      some: {
        deletedAt: null,
        activo: true,
        rolId: rol.id,
      },
    }

    const usuarioSucursalWhere: Prisma.UsuarioWhereInput = {
      deletedAt: null,
    }
    if (companyScope) {
      usuarioSucursalWhere.empresaId = companyScope
    }
    usuarioSucursalWhere.usuarioSucursales = {
      some: {
        deletedAt: null,
        activo: true,
        rolId: rol.id,
      },
    }

    const usuariosWithRolGlobal = await tx.usuario.findMany({
      where: usuarioRolWhere,
      select: { id: true },
    })
    const usuariosWithRolSucursal = await tx.usuario.findMany({
      where: usuarioSucursalWhere,
      select: { id: true },
    })

    const uniqueUserIds = Array.from(
      new Set([
        ...usuariosWithRolGlobal.map((u) => u.id),
        ...usuariosWithRolSucursal.map((u) => u.id),
      ]),
    )

    if (uniqueUserIds.length > 0) {
      await tx.usuario.updateMany({
        where: { id: { in: uniqueUserIds } },
        data: { updatedAt: new Date() },
      })
    }

    return uniqueUserIds.length
  })

  await writeAudit(request, {
    userId: auth.currentUserId,
    action: AccionAuditoria.UPDATE,
    table: 'roles_permisos',
    recordId: rol.id,
    previousValue: {
      rol: rol.codigo,
      permisos: Array.from(previousCodes).sort(),
    },
    nextValue: {
      rol: rol.codigo,
      permisos: Array.from(nextCodes).sort(),
      affectedUsers: affectedUsersCount,
    },
  })

  return { ok: true, affectedUsers: affectedUsersCount }
}

export function requireManagePermission(request: FastifyRequest) {
  return requirePermission(request, 'usuarios.manage')
}

export function requireReadPermission(request: FastifyRequest) {
  return requirePermission(request, 'usuarios.read')
}

void requireBranchAuthContext
