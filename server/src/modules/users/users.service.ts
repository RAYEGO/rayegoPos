import { AccionAuditoria, Prisma, Rol } from '@prisma/client'
import { hash } from 'bcryptjs'
import type { FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import {
  getAuthContext,
  requireBranchAuthContext,
  requirePermission,
} from '../../lib/auth.js'
import type { AuthRole } from '../auth/auth.types.js'

const SALT_ROUNDS = 12

type HttpError = Error & { statusCode: number }

function createHttpError(statusCode: number, message: string): HttpError {
  const error = new Error(message) as HttpError
  error.statusCode = statusCode
  return error
}

export const AUTH_ROLE_CODES = [
  'ADMIN_POS',
  'ADMIN_EMPRESA',
  'ADMIN',
  'SUPERVISOR',
  'CAJERO',
  'ALMACEN',
] as const

export const createUserSchema = z.object({
  firstName: z.string().min(1, 'Nombres es obligatorio.').max(120),
  lastName: z.string().min(1, 'Apellidos es obligatorio.').max(120),
  documentId: z.string().min(1, 'Documento es obligatorio.').max(20),
  tipoDocumento: z.enum(['DNI', 'CE', 'PASAPORTE', 'RUC', 'OTRO']).default('DNI'),
  phone: z.string().min(1, 'Celular es obligatorio.').max(30),
  email: z.string().min(1, 'Correo es obligatorio.').email('Correo inválido.').max(150),
  username: z.string().min(1, 'Usuario es obligatorio.').max(50),
  password: z.string().min(8, 'Contraseña debe tener mínimo 8 caracteres.').max(255),
  role: z.enum(AUTH_ROLE_CODES),
  branchIds: z.array(z.string().uuid('Sucursal inválida.')).default([]),
  isActive: z.boolean().default(true),
  mustChangePassword: z.boolean().default(false),
})

export const updateUserSchema = createUserSchema
  .omit({ password: true })
  .extend({
    password: z
      .string()
      .min(8, 'Contraseña debe tener mínimo 8 caracteres.')
      .max(255)
      .optional()
      .or(z.literal('')),
  })

export type CreateUserPayload = z.infer<typeof createUserSchema>
export type UpdateUserPayload = z.infer<typeof updateUserSchema>

export type UsersListUserRecord = {
  id: string
  firstName: string
  lastName: string
  documentId: string | null
  phone: string | null
  email: string | null
  username: string
  primaryRole: AuthRole
  roles: AuthRole[]
  branchIds: string[]
  status: 'ACTIVO' | 'BLOQUEADO' | 'INVITADO'
  lastAccessAt: string
  mustChangePassword: boolean
  mfaEnabled: boolean
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
          ? (data.previousValue as Prisma.InputJsonValue)
          : undefined,
        valorNuevo: data.nextValue ? (data.nextValue as Prisma.InputJsonValue) : undefined,
        direccionIp: request.ip,
        userAgent: request.headers['user-agent'],
      },
    })
  } catch {
    // audit no debe romper flujo principal
  }
}

async function resolveRoleByCodigo(codigo: AuthRole): Promise<Rol> {
  const rol = await prisma.rol.findFirst({
    where: { codigo, activo: true, deletedAt: null },
  })
  if (!rol) {
    throw createHttpError(400, `Rol inválido: ${codigo}`)
  }
  return rol
}

type ValidatedBranches = {
  ids: string[]
  companyId: string
  allActive: boolean
}

async function validateBranchOwnershipAndAvailability(
  branchIds: string[],
  expectedCompanyId: string,
): Promise<ValidatedBranches> {
  const uniqueBranchIds = Array.from(new Set(branchIds))
  if (uniqueBranchIds.length === 0) {
    throw createHttpError(400, 'Asigna al menos una sucursal.')
  }

  const branches = await prisma.sucursal.findMany({
    where: {
      id: { in: uniqueBranchIds },
      deletedAt: null,
    },
    select: {
      id: true,
      empresaId: true,
      activo: true,
    },
  })

  if (branches.length !== uniqueBranchIds.length) {
    const missing = uniqueBranchIds.filter((id) => !branches.some((b) => b.id === id))
    throw createHttpError(400, `Sucursales inexistentes: ${missing.join(', ')}`)
  }

  const invalidCompany = branches.find((b) => b.empresaId !== expectedCompanyId)
  if (invalidCompany) {
    throw createHttpError(
      400,
      'No puedes asignar una sucursal que pertenece a otra empresa.',
    )
  }

  const inactive = branches.find((b) => !b.activo)
  if (inactive) {
    throw createHttpError(
      400,
      'No puedes asignar una sucursal inactiva a un usuario nuevo. Activa la sucursal primero.',
    )
  }

  return {
    ids: uniqueBranchIds,
    companyId: expectedCompanyId,
    allActive: true,
  }
}

function toUserRecord(
  raw: {
    id: string
    nombres: string
    apellidos: string
    numeroDocumento: string | null
    telefono: string | null
    email: string | null
    username: string
    activo: boolean
    ultimoAccesoAt: Date | null
    usuariosRoles: { rol: { codigo: string } }[]
    usuarioSucursales: { sucursalId: string }[]
  },
): UsersListUserRecord {
  const roles = raw.usuariosRoles
    .map((ur) => ur.rol.codigo)
    .filter((c): c is AuthRole => AUTH_ROLE_CODES.includes(c as AuthRole))
  const primaryRole: AuthRole = (roles[0] as AuthRole) ?? 'CAJERO'

  return {
    id: raw.id,
    firstName: raw.nombres,
    lastName: raw.apellidos,
    documentId: raw.numeroDocumento,
    phone: raw.telefono,
    email: raw.email,
    username: raw.username,
    primaryRole,
    roles: roles.length > 0 ? roles : [primaryRole],
    branchIds: raw.usuarioSucursales.map((us) => us.sucursalId),
    status: raw.activo ? 'ACTIVO' : 'BLOQUEADO',
    lastAccessAt: raw.ultimoAccesoAt
      ? new Date(raw.ultimoAccesoAt).toLocaleString('es-PE', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Pendiente',
    mustChangePassword: false,
    mfaEnabled: false,
  }
}

export async function listUsersForCompany(
  request: FastifyRequest,
): Promise<UsersListUserRecord[]> {
  const { companyId } = await requireBranchAuthContext(request)
  requirePermission(request, 'usuarios.read')

  const now = new Date()
  const users = await prisma.usuario.findMany({
    where: {
      empresaId: companyId,
      deletedAt: null,
      NOT: {
        usuariosRoles: {
          some: {
            activo: true,
            deletedAt: null,
            rol: {
              codigo: 'ADMIN_POS',
            },
            OR: [{ fechaFin: null }, { fechaFin: { gte: now } }],
          },
        },
      },
    },
    select: {
      id: true,
      nombres: true,
      apellidos: true,
      numeroDocumento: true,
      telefono: true,
      email: true,
      username: true,
      activo: true,
      ultimoAccesoAt: true,
      usuariosRoles: {
        where: {
          activo: true,
          deletedAt: null,
          OR: [{ fechaFin: null }, { fechaFin: { gte: now } }],
        },
        select: {
          rol: { select: { codigo: true } },
        },
      },
      usuarioSucursales: {
        where: {
          activo: true,
          deletedAt: null,
        },
        select: {
          sucursalId: true,
        },
      },
    },
    orderBy: [
      { activo: 'desc' },
      { apellidos: 'asc' },
      { nombres: 'asc' },
    ],
  })

  return users.map(toUserRecord)
}

export async function createUser(
  payload: CreateUserPayload,
  request: FastifyRequest,
): Promise<UsersListUserRecord> {
  const authCtx = await getAuthContext(request)
  requirePermission(request, 'usuarios.manage')

  const isPlatform = authCtx.isPlatformAdmin
  const companyId = isPlatform ? undefined : authCtx.companyId

  if (!isPlatform && !companyId) {
    throw createHttpError(409, 'Esta operación requiere una empresa activa en la sesión.')
  }

  const requiresBranches = payload.role !== 'ADMIN_POS'

  if (payload.role === 'ADMIN_POS' && !isPlatform) {
    throw createHttpError(403, 'Solo el administrador de plataforma puede crear ADMIN_POS.')
  }

  const rol = await resolveRoleByCodigo(payload.role)

  let validatedBranchIds: string[] = []
  if (requiresBranches) {
    if (!companyId) {
      throw createHttpError(400, 'Este rol requiere asignar sucursales a una empresa.')
    }
    const validated = await validateBranchOwnershipAndAvailability(payload.branchIds, companyId)
    validatedBranchIds = validated.ids
  }

  const currentUserId = authCtx.userId

  const existingUsername = await prisma.usuario.findFirst({
    where: { username: payload.username.trim(), deletedAt: null },
    select: { id: true },
  })
  if (existingUsername) {
    throw createHttpError(409, 'Ya existe un usuario con este nombre de usuario.')
  }

  if (payload.email) {
    const existingEmail = await prisma.usuario.findFirst({
      where: { email: payload.email.trim(), deletedAt: null },
      select: { id: true },
    })
    if (existingEmail) {
      throw createHttpError(409, 'Ya existe un usuario con este correo.')
    }
  }

  const passwordHash = await hash(payload.password, SALT_ROUNDS)

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.usuario.create({
      data: {
        empresaId: companyId,
        nombres: payload.firstName.trim(),
        apellidos: payload.lastName.trim(),
        tipoDocumento: payload.tipoDocumento,
        numeroDocumento: payload.documentId.trim() || null,
        telefono: payload.phone.trim() || null,
        email: payload.email.trim() || null,
        username: payload.username.trim(),
        passwordHash,
        activo: payload.isActive,
        createdById: currentUserId,
        updatedById: currentUserId,
      },
      select: {
        id: true,
      },
    })

    await tx.usuarioRol.create({
      data: {
        usuarioId: created.id,
        rolId: rol.id,
        activo: true,
        createdById: currentUserId,
        updatedById: currentUserId,
      },
    })

    if (validatedBranchIds.length > 0) {
      await tx.usuarioSucursal.createMany({
        data: validatedBranchIds.map((sucursalId) => ({
          usuarioId: created.id,
          sucursalId,
          rolId: rol.id,
          activo: true,
          createdById: currentUserId,
          updatedById: currentUserId,
        })),
        skipDuplicates: true,
      })
    }

    return created
  })

  const createdRecord = await prisma.usuario.findFirstOrThrow({
    where: { id: user.id, deletedAt: null },
    select: {
      id: true,
      nombres: true,
      apellidos: true,
      numeroDocumento: true,
      telefono: true,
      email: true,
      username: true,
      activo: true,
      ultimoAccesoAt: true,
      usuariosRoles: {
        where: { activo: true, deletedAt: null },
        select: { rol: { select: { codigo: true } } },
      },
      usuarioSucursales: {
        where: { activo: true, deletedAt: null },
        select: { sucursalId: true },
      },
    },
  })

  await writeAudit(request, {
    userId: currentUserId,
    action: AccionAuditoria.INSERT,
    table: 'usuarios',
    recordId: createdRecord.id,
    nextValue: {
      role: payload.role,
      branchIds: validatedBranchIds,
      isActive: payload.isActive,
    },
  })

  return toUserRecord(createdRecord)
}

export async function updateUser(
  userId: string,
  payload: UpdateUserPayload,
  request: FastifyRequest,
): Promise<UsersListUserRecord> {
  const authCtx = await getAuthContext(request)
  requirePermission(request, 'usuarios.manage')

  const isPlatform = authCtx.isPlatformAdmin
  const companyId = isPlatform ? undefined : authCtx.companyId

  if (!isPlatform && !companyId) {
    throw createHttpError(409, 'Esta operación requiere una empresa activa en la sesión.')
  }

  const userWhere: { id: string; empresaId?: string; deletedAt: null } = {
    id: userId,
    deletedAt: null,
  }
  if (companyId) {
    userWhere.empresaId = companyId
  }

  const existing = await prisma.usuario.findFirst({
    where: userWhere,
    select: {
      id: true,
      username: true,
      email: true,
      empresaId: true,
      usuariosRoles: {
        where: { activo: true, deletedAt: null },
        select: { id: true, rolId: true, rol: { select: { codigo: true } } },
      },
      usuarioSucursales: {
        where: { activo: true, deletedAt: null },
        select: { id: true, sucursalId: true, rolId: true },
      },
    },
  })

  if (!existing) {
    throw createHttpError(404, 'Usuario no encontrado.')
  }

  const currentPrimaryRoleCodigo = (existing.usuariosRoles[0]?.rol?.codigo as AuthRole) ?? 'CAJERO'

  if (currentPrimaryRoleCodigo === 'ADMIN_POS' && payload.role !== 'ADMIN_POS' && !isPlatform) {
    throw createHttpError(403, 'Solo el administrador de plataforma puede cambiar el rol de un ADMIN_POS.')
  }
  if (payload.role === 'ADMIN_POS' && !isPlatform) {
    throw createHttpError(403, 'Solo el administrador de plataforma puede asignar el rol ADMIN_POS.')
  }

  const requiresBranches = payload.role !== 'ADMIN_POS'

  const rol = await resolveRoleByCodigo(payload.role)

  const branchIdsForValidation = Array.isArray(payload.branchIds) ? payload.branchIds : []
  let validatedBranchIds: string[] = []
  if (requiresBranches) {
    const effectiveCompanyId = companyId ?? existing.empresaId
    if (!effectiveCompanyId) {
      throw createHttpError(400, 'Este rol requiere asignar sucursales a una empresa.')
    }
    const validated = await validateBranchOwnershipAndAvailability(
      branchIdsForValidation,
      effectiveCompanyId,
    )
    validatedBranchIds = validated.ids
  }

  const currentUserId = authCtx.userId

  if (payload.username && payload.username.trim() !== existing.username) {
    const collision = await prisma.usuario.findFirst({
      where: {
        username: payload.username.trim(),
        deletedAt: null,
        NOT: { id: userId },
      },
      select: { id: true },
    })
    if (collision) {
      throw createHttpError(409, 'Ya existe un usuario con este nombre de usuario.')
    }
  }

  if (payload.email && payload.email.trim() !== existing.email) {
    const collision = await prisma.usuario.findFirst({
      where: {
        email: payload.email.trim(),
        deletedAt: null,
        NOT: { id: userId },
      },
      select: { id: true },
    })
    if (collision) {
      throw createHttpError(409, 'Ya existe un usuario con este correo.')
    }
  }

  const passwordUpdate =
    payload.password && payload.password.trim().length >= 8
      ? { passwordHash: await hash(payload.password.trim(), SALT_ROUNDS) }
      : {}

  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id: userId },
      data: {
        nombres: payload.firstName.trim(),
        apellidos: payload.lastName.trim(),
        tipoDocumento: payload.tipoDocumento ?? 'DNI',
        numeroDocumento: payload.documentId.trim() || null,
        telefono: payload.phone.trim() || null,
        email: payload.email.trim() || null,
        username: payload.username.trim(),
        activo: payload.isActive,
        updatedById: currentUserId,
        ...passwordUpdate,
      },
    })

    const currentRole = existing.usuariosRoles[0]
    if (currentRole && currentRole.rolId !== rol.id) {
      await tx.usuarioRol.updateMany({
        where: { id: currentRole.id },
        data: {
          rolId: rol.id,
          updatedById: currentUserId,
        },
      })
    }

    if (requiresBranches) {
      const previousBranchIds = new Set(existing.usuarioSucursales.map((u) => u.sucursalId))
      const nextBranchIds = new Set(validatedBranchIds)

      const toRemove = existing.usuarioSucursales.filter((u) => !nextBranchIds.has(u.sucursalId))
      if (toRemove.length > 0) {
        await tx.usuarioSucursal.updateMany({
          where: { id: { in: toRemove.map((u) => u.id) } },
          data: {
            activo: false,
            deletedAt: new Date(),
            updatedById: currentUserId,
          },
        })
      }

      const toAdd = validatedBranchIds.filter((id) => !previousBranchIds.has(id))
      if (toAdd.length > 0) {
        await tx.usuarioSucursal.createMany({
          data: toAdd.map((sucursalId) => ({
            usuarioId: userId,
            sucursalId,
            rolId: rol.id,
            activo: true,
            createdById: currentUserId,
            updatedById: currentUserId,
          })),
          skipDuplicates: true,
        })
      }

      const toUpdateRol = existing.usuarioSucursales.filter(
        (u) => nextBranchIds.has(u.sucursalId) && u.rolId !== rol.id,
      )
      if (toUpdateRol.length > 0) {
        await tx.usuarioSucursal.updateMany({
          where: { id: { in: toUpdateRol.map((u) => u.id) } },
          data: {
            rolId: rol.id,
            updatedById: currentUserId,
          },
        })
      }
    } else {
      // ADMIN_POS: no necesita sucursales; marcamos las existentes como borradas
      if (existing.usuarioSucursales.length > 0) {
        await tx.usuarioSucursal.updateMany({
          where: { id: { in: existing.usuarioSucursales.map((u) => u.id) } },
          data: {
            activo: false,
            deletedAt: new Date(),
            updatedById: currentUserId,
          },
        })
      }
    }
  })

  const updated = await prisma.usuario.findFirstOrThrow({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      nombres: true,
      apellidos: true,
      numeroDocumento: true,
      telefono: true,
      email: true,
      username: true,
      activo: true,
      ultimoAccesoAt: true,
      usuariosRoles: {
        where: { activo: true, deletedAt: null },
        select: { rol: { select: { codigo: true } } },
      },
      usuarioSucursales: {
        where: { activo: true, deletedAt: null },
        select: { sucursalId: true },
      },
    },
  })

  await writeAudit(request, {
    userId: currentUserId,
    action: AccionAuditoria.UPDATE,
    table: 'usuarios',
    recordId: userId,
    previousValue: {
      branchIds: existing.usuarioSucursales.map((u) => u.sucursalId),
    },
    nextValue: {
      role: payload.role,
      branchIds: validatedBranchIds,
      isActive: payload.isActive,
    },
  })

  return toUserRecord(updated)
}

export type RemoveUserResult =
  | {
      kind: 'DELETED'
      id: string
      username: string
      message: string
    }
  | {
      kind: 'DEACTIVATED'
      id: string
      username: string
      message: string
    }

/**
 * Elimina o desactiva un usuario según sus dependencias históricas.
 *
 * Reglas:
 * - NO se permite eliminar/desactivar al usuario actual (auto-protección).
 * - NO se permite tocar ADMIN_POS a menos que el solicitante sea platform admin
 *   (y nunca puede ser sí mismo).
 * - Si el usuario tiene registros en ventas, caja, compras, conciliaciones,
 *   arqueos, auditoría, etc. → se DESACTIVA (activo=false), NO se borra.
 * - Si el usuario no tiene dependencias históricas → se soft-delete físico
 *   (deletedAt, no hard DELETE) para preservar trazabilidad.
 * - Las relaciones UsuarioRol y UsuarioSucursal siempre se marcan deletedAt
 *   (independientemente del camino), para evitar login/autorización residual.
 */
export async function removeOrDeactivateUser(
  userId: string,
  request: FastifyRequest,
): Promise<RemoveUserResult> {
  const authCtx = await getAuthContext(request)
  requirePermission(request, 'usuarios.manage')

  if (userId === authCtx.userId) {
    throw createHttpError(400, 'No puedes eliminar o desactivar tu propia cuenta.')
  }

  const isPlatform = authCtx.isPlatformAdmin
  const companyId = isPlatform ? undefined : authCtx.companyId

  const userWhere: { id: string; empresaId?: string; deletedAt: null } = {
    id: userId,
    deletedAt: null,
  }
  if (companyId) {
    userWhere.empresaId = companyId
  }

  const target = await prisma.usuario.findFirst({
    where: userWhere,
    select: {
      id: true,
      username: true,
      usuariosRoles: {
        where: { activo: true, deletedAt: null },
        select: { rol: { select: { codigo: true } } },
      },
    },
  })
  if (!target) {
    throw createHttpError(404, 'Usuario no encontrado.')
  }

  const targetRoles = target.usuariosRoles.map((r) => r.rol.codigo)
  const isTargetAdminPos = targetRoles.includes('ADMIN_POS')
  const isTargetAdminEmpresa = targetRoles.includes('ADMIN_EMPRESA')

  if (isTargetAdminPos && !isPlatform) {
    throw createHttpError(
      403,
      'Solo el administrador de plataforma puede administrar usuarios ADMIN_POS.',
    )
  }
  if (isTargetAdminEmpresa && !isPlatform && target.usuariosRoles[0]?.rol?.codigo !== 'ADMIN_EMPRESA') {
    // ya está cubierto por el where empresaId = companyId; check defensivo
  }
  if (userId === authCtx.userId) {
    throw createHttpError(400, 'No puedes eliminar o desactivar tu propia cuenta.')
  }

  const counts = await Promise.all([
    prisma.venta.count({ where: { usuarioResponsableId: userId } }),
    prisma.aperturaCaja.count({ where: { usuarioId: userId } }),
    prisma.cierreCaja.count({ where: { usuarioId: userId } }),
    prisma.arqueoCaja.count({ where: { usuarioId: userId } }),
    prisma.conciliacionCaja.count({ where: { usuarioId: userId } }),
    prisma.compra.count({ where: { usuarioResponsableId: userId } }),
    prisma.auditoria.count({ where: { usuarioId: userId } }),
    prisma.usuario.count({ where: { createdById: userId, deletedAt: null } }),
  ])
  const hasHistoricalDependencies = counts.some((n) => n > 0)

  const currentUserId = authCtx.userId

  await prisma.$transaction(async (tx) => {
    // Bloqueamos roles y sucursales siempre (para no poder autenticarse)
    await tx.usuarioRol.updateMany({
      where: { usuarioId: userId, deletedAt: null },
      data: {
        activo: false,
        deletedAt: new Date(),
        updatedById: currentUserId,
      },
    })
    await tx.usuarioSucursal.updateMany({
      where: { usuarioId: userId, deletedAt: null },
      data: {
        activo: false,
        deletedAt: new Date(),
        updatedById: currentUserId,
      },
    })

    if (hasHistoricalDependencies) {
      await tx.usuario.update({
        where: { id: userId },
        data: {
          activo: false,
          updatedById: currentUserId,
        },
      })
    } else {
      // Soft-delete (deletedAt) — NO hard delete, para preservar FKs nullable.
      await tx.usuario.update({
        where: { id: userId },
        data: {
          activo: false,
          deletedAt: new Date(),
          updatedById: currentUserId,
        },
      })
    }
  })

  await writeAudit(request, {
    userId: currentUserId,
    action: hasHistoricalDependencies ? AccionAuditoria.UPDATE : AccionAuditoria.DELETE,
    table: 'usuarios',
    recordId: userId,
    previousValue: { username: target.username, hasHistoricalDependencies },
    nextValue: { action: hasHistoricalDependencies ? 'DEACTIVATED' : 'DELETED_SOFT' },
  })

  if (hasHistoricalDependencies) {
    return {
      kind: 'DEACTIVATED',
      id: target.id,
      username: target.username,
      message:
        'Este usuario tiene registros históricos y fue desactivado en lugar de eliminado. Seguirá apareciendo en reportes históricos.',
    }
  }
  return {
    kind: 'DELETED',
    id: target.id,
    username: target.username,
    message:
      'El usuario no tenía dependencias históricas y fue eliminado de forma segura (soft-delete).',
  }
}
