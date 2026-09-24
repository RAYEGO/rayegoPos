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
import { AUTH_ROLE_CODES, ensureDefaultRoles } from '../users/users.service.js'

const PLATFORM_ONLY_ROLES: AuthRole[] = ['ADMIN_POS']

type CanonicalPermission = {
  codigo: AuthPermission
  modulo: string
  nombre: string
  descripcion: string
}

const CANONICAL_PERMISSIONS: CanonicalPermission[] = [
  { codigo: 'dashboard.read', modulo: 'General', nombre: 'Ver dashboard', descripcion: 'Permite acceder al panel principal y sus indicadores.' },
  { codigo: 'ventas.read', modulo: 'Ventas', nombre: 'Ver ventas', descripcion: 'Permite acceder al módulo de ventas.' },
  { codigo: 'ventas.manage', modulo: 'Ventas', nombre: 'Gestionar ventas', descripcion: 'Permite realizar operaciones de venta que modifican el estado de una venta, incluyendo crear y cancelar ventas.' },
  { codigo: 'productos.read', modulo: 'Productos', nombre: 'Ver productos', descripcion: 'Permite acceder al catálogo de productos.' },
  { codigo: 'productos.manage', modulo: 'Productos', nombre: 'Gestionar productos', descripcion: 'Permite crear, editar, duplicar, activar y desactivar productos del catálogo.' },
  { codigo: 'compras.read', modulo: 'Compras', nombre: 'Ver compras', descripcion: 'Permite acceder al módulo de compras.' },
  { codigo: 'compras.manage', modulo: 'Compras', nombre: 'Gestionar compras', descripcion: 'Permite realizar operaciones de compra que modifican su estado, incluyendo crear, editar compras y registrar recepciones.' },
  { codigo: 'inventario.read', modulo: 'Inventario', nombre: 'Ver inventario', descripcion: 'Permite revisar stock, lotes y movimientos.' },
  { codigo: 'inventario.manage', modulo: 'Inventario', nombre: 'Gestionar inventario', descripcion: 'Permite realizar operaciones que modifican el inventario, incluyendo ajustes, transferencias y movimientos de stock.' },
  { codigo: 'clientes.read', modulo: 'Clientes', nombre: 'Ver clientes', descripcion: 'Permite acceder al padrón de clientes.' },
  { codigo: 'clientes.manage', modulo: 'Clientes', nombre: 'Gestionar clientes', descripcion: 'Permite crear, editar y cambiar el estado de clientes.' },
  { codigo: 'proveedores.read', modulo: 'Proveedores', nombre: 'Ver proveedores', descripcion: 'Permite acceder al padrón de proveedores.' },
  { codigo: 'proveedores.manage', modulo: 'Proveedores', nombre: 'Gestionar proveedores', descripcion: 'Permite crear, editar y cambiar el estado de proveedores.' },
  { codigo: 'caja.read', modulo: 'Caja', nombre: 'Ver caja', descripcion: 'Permite operar y consultar el módulo de caja.' },
  { codigo: 'caja.manage', modulo: 'Caja', nombre: 'Gestionar caja', descripcion: 'Permite realizar operaciones de gestión de caja que modifican su estado, incluyendo apertura y operaciones administrativas de caja.' },
  { codigo: 'usuarios.read', modulo: 'Seguridad', nombre: 'Ver usuarios', descripcion: 'Permite acceder a usuarios, roles y permisos.' },
  { codigo: 'usuarios.manage', modulo: 'Seguridad', nombre: 'Gestionar usuarios', descripcion: 'Permite crear, editar y cambiar el estado de usuarios.' },
  { codigo: 'sesiones.read', modulo: 'Seguridad', nombre: 'Ver sesiones', descripcion: 'Permite consultar sesiones activas y recientes.' },
  { codigo: 'sesiones.revoke', modulo: 'Seguridad', nombre: 'Revocar sesiones', descripcion: 'Permite cerrar sesiones activas de otros usuarios.' },
  { codigo: 'auditoria.read', modulo: 'Seguridad', nombre: 'Ver auditoría', descripcion: 'Permite consultar el historial de acciones del sistema.' },
  { codigo: 'reportes.read', modulo: 'Reportes', nombre: 'Ver reportes', descripcion: 'Permite acceder al módulo de reportes.' },
  { codigo: 'configuracion.read', modulo: 'Configuración', nombre: 'Ver configuración', descripcion: 'Permite acceder a la configuración general del sistema.' },
  { codigo: 'tipos_empresa.manage', modulo: 'Administración POS', nombre: 'Gestionar tipos de empresa', descripcion: 'Permite crear, editar y activar tipos de empresa y sus módulos (plataforma).' },
  { codigo: 'empresas.read', modulo: 'Administración POS', nombre: 'Ver empresas', descripcion: 'Permite listar y consultar la información de empresas de la plataforma.' },
  { codigo: 'empresas.manage', modulo: 'Administración POS', nombre: 'Gestionar empresas', descripcion: 'Permite crear, editar y configurar empresas en la plataforma.' },
  { codigo: 'administradores.manage', modulo: 'Administración POS', nombre: 'Gestionar administradores', descripcion: 'Permite asignar y administrar los administradores de empresa.' },
  { codigo: 'ordenesServicio.read', modulo: 'Servicio Técnico', nombre: 'Ver órdenes de servicio', descripcion: 'Permite acceder a las órdenes de servicio técnico.' },
  { codigo: 'ordenesServicio.write', modulo: 'Servicio Técnico', nombre: 'Crear/editar órdenes de servicio', descripcion: 'Permite crear y editar órdenes de servicio técnico.' },
  { codigo: 'ordenesServicio.cambioEstado', modulo: 'Servicio Técnico', nombre: 'Cambiar estado de órdenes', descripcion: 'Permite cambiar el estado de las órdenes de servicio técnico.' },
  { codigo: 'ordenesServicio.aprobar', modulo: 'Servicio Técnico', nombre: 'Órdenes Servicio — Aprobar Presupuesto', descripcion: 'Aprobar/rechazar el presupuesto presentado al cliente.' },
  { codigo: 'tecnicos.read', modulo: 'Servicio Técnico', nombre: 'Ver técnicos', descripcion: 'Permite listar y consultar el padrón de técnicos.' },
  { codigo: 'tecnicos.write', modulo: 'Servicio Técnico', nombre: 'Crear/editar técnicos', descripcion: 'Permite crear y editar registros de técnicos.' },
  { codigo: 'equiposCliente.read', modulo: 'Servicio Técnico', nombre: 'Ver equipos de clientes', descripcion: 'Permite consultar los equipos registrados de los clientes.' },
  { codigo: 'equiposCliente.write', modulo: 'Servicio Técnico', nombre: 'Crear/editar equipos de clientes', descripcion: 'Permite crear y editar equipos de clientes.' },
  { codigo: 'presupuestosOrdenServicio.write', modulo: 'Servicio Técnico', nombre: 'Gestionar presupuestos de órdenes', descripcion: 'Permite crear y editar presupuestos para órdenes de servicio técnico.' },
  { codigo: 'pagosOrdenServicio.write', modulo: 'Servicio Técnico', nombre: 'Gestionar pagos de órdenes', descripcion: 'Permite registrar y editar pagos relacionados con órdenes de servicio técnico.' },
  { codigo: 'consumoInventarioRT.write', modulo: 'Servicio Técnico', nombre: 'Gestionar consumo de inventario en RT', descripcion: 'Permite registrar el consumo de inventario dentro de órdenes de servicio técnico.' },
  { codigo: 'inventarioServicio.write', modulo: 'Inventario', nombre: 'Inventario Técnico — Consumir', descripcion: 'Consumir/devolver repuestos y materiales desde Orden Servicio → Kardex.' },
  { codigo: 'reportesServicioTecnico.read', modulo: 'Reportes', nombre: 'Reportes Servicio Técnico', descripcion: 'Ver reportes/estadísticas de servicio técnico (productividad, tiempos, garantías).' },
  { codigo: 'garantiasOrdenServicio.read', modulo: 'Servicio Técnico', nombre: 'Ver garantías de órdenes', descripcion: 'Permite consultar las garantías asociadas a órdenes de servicio técnico.' },
  { codigo: 'garantiasOrdenServicio.write', modulo: 'Servicio Técnico', nombre: 'Gestionar garantías de órdenes', descripcion: 'Permite registrar, aprobar/rechazar y atender solicitudes de garantía asociadas a órdenes de servicio.' },
]

let defaultPermisosEnsured = false

export async function ensureDefaultPermisos(): Promise<void> {
  if (defaultPermisosEnsured) return
  const now = new Date()
  for (const perm of CANONICAL_PERMISSIONS) {
    await prisma.permiso.upsert({
      where: { codigo: perm.codigo },
      create: {
        codigo: perm.codigo,
        modulo: perm.modulo,
        nombre: perm.nombre,
        descripcion: perm.descripcion,
        activo: true,
        createdAt: now,
        updatedAt: now,
      },
      update: {
        modulo: perm.modulo,
        nombre: perm.nombre,
        descripcion: perm.descripcion,
        activo: true,
        deletedAt: null,
        updatedAt: now,
      },
    })
  }
  defaultPermisosEnsured = true
}

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

  await ensureDefaultRoles()
  await ensureDefaultPermisos()

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

  await ensureDefaultPermisos()

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

  await ensureDefaultPermisos()

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

  const payloadSinRepetir = Array.from(new Set(payload.permisos))
  const codigosInvalidos = payloadSinRepetir.filter((codigo) => !permisoPorCodigo.has(codigo))
  if (codigosInvalidos.length > 0) {
    const preview = codigosInvalidos.slice(0, 10).join(', ')
    const suffix = codigosInvalidos.length > 10 ? ` (+${codigosInvalidos.length - 10} más)` : ''
    throw createHttpError(
      400,
      `Se recibieron ${codigosInvalidos.length} permisos desconocidos o inactivos: [${preview}]${suffix}. No se modificaron permisos actuales del rol.`,
      'INVALID_PERMISSION_CODES',
    )
  }

  const permisosNormalizados = payloadSinRepetir

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
