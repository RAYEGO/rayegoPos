import type { FastifyRequest } from 'fastify'
import { prisma } from './prisma.js'
import { isPlatformAdminRole } from '../modules/auth/auth.permissions.js'
import type { AuthRole } from '../modules/auth/auth.types.js'

const MODULE_CODE_ALIASES_BACKEND: Readonly<Record<string, readonly string[]>> = {
  ordenesServicio: ['ordenesServicio', 'ordenes_servicio', 'pagosOrdenServicio'],
  ordenes_servicio: ['ordenes_servicio', 'ordenesServicio', 'pagosOrdenServicio'],
  pagosOrdenServicio: ['pagosOrdenServicio', 'ordenesServicio', 'ordenes_servicio'],
  servicioTecnico: ['servicioTecnico', 'ordenesServicio', 'ordenes_servicio', 'pagosOrdenServicio'],
  diagnostico: ['diagnostico', 'ordenesServicio', 'ordenes_servicio'],
  presupuestos: ['presupuestos', 'ordenesServicio', 'ordenes_servicio'],
  reparaciones: ['reparaciones', 'ordenesServicio', 'ordenes_servicio'],
  entregas: ['entregas', 'ordenesServicio', 'ordenes_servicio'],
  equipos: ['equipos', 'ordenesServicio', 'ordenes_servicio'],
} as const

function resolveModuleCodesCanonical(moduleCode: string): ReadonlySet<string> {
  const direct = MODULE_CODE_ALIASES_BACKEND[moduleCode]
  if (Array.isArray(direct) && direct.length > 0) return new Set(direct)
  return new Set([moduleCode])
}

function isModuleEnabled(enabledModules: readonly string[], moduleCode: string): boolean {
  if (!moduleCode) return false
  const normalizedEnabled = Array.isArray(enabledModules) ? enabledModules : []
  if (normalizedEnabled.length === 0) return true
  const accepted = resolveModuleCodesCanonical(moduleCode)
  for (const code of accepted) {
    if (normalizedEnabled.includes(code)) return true
    const inverses = MODULE_CODE_ALIASES_BACKEND[code]
    if (Array.isArray(inverses)) {
      for (const alias of inverses) {
        if (normalizedEnabled.includes(alias)) return true
      }
    }
  }
  return false
}

type AuthTokenPayload = {
  sub: string
  email: string
  typ: 'access' | 'refresh' | 'reset-password'
  companyId?: string | null
  branchId?: string | null
  roles?: string[]
  permissions?: string[]
  iat?: number
  exp?: number
}

type AuthHttpError = Error & {
  statusCode: number
  code?: string
}

export type PlatformAuthContext = {
  userId: string
  companyId: string
  branchId: string
  roles: AuthRole[]
  permissions: string[]
  companyTypeId: string | null
  companyTypeCode: string | null
  enabledModules: string[]
  isPlatformAdmin: boolean
}

export type BranchlessAuthContext = {
  userId: string
  companyId: null
  branchId: null
  roles: AuthRole[]
  permissions: string[]
  companyTypeId: null
  companyTypeCode: null
  enabledModules: string[]
  isPlatformAdmin: true
}

export type AuthContext = PlatformAuthContext | BranchlessAuthContext

function createHttpError(statusCode: number, message: string, code?: string): AuthHttpError {
  const error = new Error(message) as AuthHttpError
  error.statusCode = statusCode
  if (code) error.code = code
  return error
}

function normalizeRoles(roles: string[] | undefined): AuthRole[] {
  if (!roles || roles.length === 0) return []
  const valid = new Set<AuthRole>([
    'ADMIN',
    'ADMIN_EMPRESA',
    'ADMIN_BOTICA',
    'ADMIN_SERVICIO_TECNICO',
    'ADMIN_POS',
    'SUPERVISOR',
    'SUPERVISOR_BOTICA',
    'SUPERVISOR_ST',
    'CAJERO',
    'CAJERO_BOTICA',
    'CAJERO_ST',
    'ALMACEN',
    'ALMACEN_BOTICA',
    'TECNICO',
    'TECNICO_ST',
  ])
  return roles.filter((r): r is AuthRole => valid.has(r as AuthRole))
}

function hasPlatformRole(roles: AuthRole[]): boolean {
  return roles.some((r) => isPlatformAdminRole(r))
}

export async function getAuthContext(request: FastifyRequest): Promise<AuthContext> {
  if (request.auth) {
    return request.auth as AuthContext
  }

  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) {
    throw createHttpError(401, 'Sesión no disponible.')
  }

  const decoded = await request.server.jwt.verify<AuthTokenPayload>(token)
  if (decoded.typ !== 'access') {
    throw createHttpError(401, 'El token de acceso no es válido.', 'ACCESS_TOKEN_INVALID')
  }

  const userId = decoded.sub
  const roles = normalizeRoles(decoded.roles)
  const rawTokenPermissions = Array.isArray(decoded.permissions) ? decoded.permissions : []
  const isPlatformAdmin = hasPlatformRole(roles)
  const tokenIatSec = typeof decoded.iat === 'number' ? decoded.iat : null

  if (isPlatformAdmin) {
    const user = await prisma.usuario.findFirst({
      where: { id: userId, deletedAt: null, activo: true },
      select: { id: true, updatedAt: true },
    })
    if (!user) {
      throw createHttpError(401, 'El usuario asociado a la sesión no está disponible.')
    }
    if (rawTokenPermissions.length === 0) {
      throw createHttpError(
        401,
        'Tu sesión fue creada antes de una actualización de seguridad. Tu sesión se renovará automáticamente.',
        'TOKEN_OLD_REQUIRES_REFRESH',
      )
    }
    const tokenPermissions = rawTokenPermissions
    if (tokenIatSec && user.updatedAt) {
      const updatedAtSec = Math.floor(user.updatedAt.getTime() / 1000)
      if (updatedAtSec > tokenIatSec) {
        throw createHttpError(
          401,
          'Tu perfil fue modificado recientemente. Tu sesión se renovará automáticamente para reflejar los cambios.',
          'TOKEN_OLD_REQUIRES_REFRESH',
        )
      }
    }
    const ctx: BranchlessAuthContext = {
      userId,
      companyId: null,
      branchId: null,
      roles,
      permissions: tokenPermissions.length > 0 ? tokenPermissions : ['*'],
      companyTypeId: null,
      companyTypeCode: null,
      enabledModules: [
        'dashboard',
        'usuarios',
        'sesiones',
        'auditoria',
        'reportes',
        'configuracion',
        'tipos_empresa',
        'empresas',
      ],
      isPlatformAdmin: true,
    }
    request.auth = ctx
    return ctx
  }

  const branchId = decoded.branchId
  if (!branchId) {
    throw createHttpError(409, 'No hay una sucursal activa en la sesión.')
  }

  const companyId = decoded.companyId
  if (!companyId) {
    throw createHttpError(409, 'No hay una empresa activa en la sesión.')
  }

  const [branch, membership, userCompanyMatch, companyRaw] = await Promise.all([
    prisma.sucursal.findFirst({
      where: { id: branchId, deletedAt: null, activo: true },
      select: { id: true, empresaId: true, activo: true },
    }),
    prisma.usuarioSucursal.findFirst({
      where: { usuarioId: userId, sucursalId: branchId, deletedAt: null, activo: true },
      select: { id: true },
    }),
    prisma.usuario.findFirst({
      where: { id: userId, deletedAt: null, activo: true, empresaId: companyId },
      select: { id: true, sucursalId: true, updatedAt: true },
    }),
    prisma.empresa.findFirst({
      where: { id: companyId, deletedAt: null },
      select: {
        activo: true,
        tipoEmpresaId: true,
        tipoEmpresa: {
          select: {
            id: true,
            codigo: true,
            activo: true,
            modulos: {
              where: { activo: true },
              select: { moduloCodigo: true },
            },
          },
        },
      },
    }),
  ])

  if (!branch) {
    throw createHttpError(409, 'La sucursal seleccionada no existe o se encuentra inactiva.')
  }
  if (branch.empresaId !== companyId) {
    throw createHttpError(409, 'La sucursal seleccionada pertenece a una empresa distinta a la de tu sesión.')
  }
  if (!companyRaw) {
    throw createHttpError(409, 'La empresa asociada a la sesión no existe o fue eliminada.')
  }
  if (!companyRaw.activo) {
    throw createHttpError(
      409,
      'La empresa se encuentra desactivada. Comunícate con el administrador de plataforma para solicitar su reactivación.',
      'EMPRESA_INACTIVA',
    )
  }
  if (!userCompanyMatch) {
    throw createHttpError(401, 'El usuario no pertenece a la empresa de la sesión.')
  }

  const tipo = companyRaw.tipoEmpresa
  const companyType =
    !tipo || !tipo.activo
      ? { companyTypeId: null, companyTypeCode: null, enabledModules: [] as string[] }
      : (() => {
          const enabledModules = Array.isArray(tipo.modulos)
            ? tipo.modulos
                .map((m) => (m as { moduloCodigo?: string }).moduloCodigo)
                .filter((m): m is string => Boolean(m))
            : ([] as string[])
          return {
            companyTypeId: tipo.id,
            companyTypeCode: tipo.codigo,
            enabledModules,
          }
        })()

  if (rawTokenPermissions.length === 0) {
    throw createHttpError(
      401,
      'Tu sesión fue creada antes de una actualización de seguridad. Tu sesión se renovará automáticamente.',
      'TOKEN_OLD_REQUIRES_REFRESH',
    )
  }
  if (tokenIatSec && userCompanyMatch.updatedAt) {
    const updatedAtSec = Math.floor(userCompanyMatch.updatedAt.getTime() / 1000)
    if (updatedAtSec > tokenIatSec) {
      throw createHttpError(
        401,
        'Tu perfil fue modificado recientemente. Tu sesión se renovará automáticamente para reflejar los cambios.',
        'TOKEN_OLD_REQUIRES_REFRESH',
      )
    }
  }
  const tokenPermissions = rawTokenPermissions

  const hasExplicitMembership = Boolean(membership)
  const hasLegacyBranchAssoc = userCompanyMatch.sucursalId === branchId
  if (!hasExplicitMembership && !hasLegacyBranchAssoc) {
    throw createHttpError(403, 'No tienes permiso para operar en la sucursal seleccionada.')
  }

  const ctx: PlatformAuthContext = {
    userId,
    companyId,
    branchId,
    roles,
    permissions: tokenPermissions,
    companyTypeId: companyType.companyTypeId,
    companyTypeCode: companyType.companyTypeCode,
    enabledModules: Array.isArray(companyType.enabledModules) ? companyType.enabledModules : ([] as string[]),
    isPlatformAdmin: false,
  }

  request.auth = ctx
  return ctx
}

export async function requireBranchAuthContext(request: FastifyRequest): Promise<PlatformAuthContext> {
  const ctx = await getAuthContext(request)
  if (ctx.isPlatformAdmin || !ctx.companyId || !ctx.branchId) {
    throw createHttpError(409, 'Esta operación requiere una empresa y sucursal activas en la sesión.')
  }
  return ctx as PlatformAuthContext
}

export async function requirePlatformAdmin(request: FastifyRequest): Promise<BranchlessAuthContext> {
  const ctx = await getAuthContext(request)
  if (!ctx.isPlatformAdmin) {
    throw createHttpError(403, 'Esta operación es solo para administradores de plataforma.')
  }
  return ctx as BranchlessAuthContext
}

export type CompanyScopedWhere<T> = T & { empresaId?: string | null }

export function applyCompanyScope<W extends Record<string, unknown>>(
  auth: AuthContext,
  where: W,
  empresaField: keyof W & string = 'empresaId',
): W {
  if (auth.isPlatformAdmin) return where
  if (!auth.companyId) {
    throw createHttpError(409, 'No hay una empresa activa en la sesión.')
  }
  const next = { ...where } as unknown as Record<string, unknown>
  if (next[empresaField] && String(next[empresaField]) !== String(auth.companyId)) {
    throw createHttpError(403, 'No puedes acceder a recursos de otra empresa.')
  }
  next[empresaField] = auth.companyId
  return next as W
}

function permissionToModuleCode(permissionCode: string): string {
  return permissionCode.split('.')[0] ?? permissionCode
}

export async function requirePermission(request: FastifyRequest, permissionCode: string) {
  const ctx = await getAuthContext(request)

  if (permissionCode === '*') return ctx
  if (ctx.isPlatformAdmin) return ctx

  const moduleCode = permissionToModuleCode(permissionCode)
  const ctxEnabledModules = Array.isArray(ctx.enabledModules) ? ctx.enabledModules : ([] as string[])

  const platform = ctx as PlatformAuthContext
  const platformModules = Array.isArray(platform.enabledModules) ? platform.enabledModules : ([] as string[])
  if (platformModules.length > 0 && !isModuleEnabled(platformModules, moduleCode)) {
    throw createHttpError(
      403,
      `El módulo "${moduleCode}" no está habilitado para empresas de tipo ${platform.companyTypeCode ?? 'desconocido'}.`,
    )
  }

  if (permissionCode.endsWith('.read') || permissionCode.endsWith('.manage') || permissionCode.endsWith('.revoke') || permissionCode.endsWith('.write') || permissionCode.endsWith('.cambioEstado')) {
    if (!ctx.isPlatformAdmin) {
      if (!isModuleEnabled(ctxEnabledModules, moduleCode) && moduleCode !== permissionCode) {
        throw createHttpError(403, 'No tienes autorización para usar este módulo.')
      }
    }
  }

  const ctxPermissions = Array.isArray(ctx.permissions) ? ctx.permissions : []
  if (ctxPermissions.includes('*')) {
    return ctx
  }
  if (!ctxPermissions.includes(permissionCode)) {
    const label = moduleCode === permissionCode
      ? `el recurso "${permissionCode}"`
      : `el permiso "${permissionCode}"`
    throw createHttpError(
      403,
      `No tienes autorización para realizar esta acción. Requiere ${label}.`,
    )
  }
  return ctx
}

const ROLES_CIERRE_CAJA_BOTICA: ReadonlySet<AuthRole> = new Set([
  'ADMIN',
  'ADMIN_EMPRESA',
  'ADMIN_POS',
  'ADMIN_BOTICA',
  'SUPERVISOR',
  'SUPERVISOR_BOTICA',
])
const ROLES_CIERRE_CAJA_ST: ReadonlySet<AuthRole> = new Set([
  'ADMIN',
  'ADMIN_EMPRESA',
  'ADMIN_POS',
  'ADMIN_SERVICIO_TECNICO',
  'SUPERVISOR',
  'SUPERVISOR_ST',
])
const ROLES_ADMIN_CAJAS_ESTRUCTURAL_BOTICA: ReadonlySet<AuthRole> = new Set(['ADMIN_BOTICA'])
const ROLES_ADMIN_CAJAS_ESTRUCTURAL_ST: ReadonlySet<AuthRole> = new Set(['ADMIN_SERVICIO_TECNICO'])

export async function requireCanCloseCashDrawer(request: FastifyRequest): Promise<AuthContext> {
  const ctx = await getAuthContext(request)
  if (ctx.isPlatformAdmin) {
    throw createHttpError(
      403,
      'El administrador de plataforma no opera cajas. Utiliza un rol de empresa para cerrar la caja.',
      'CIERRE_CAJA_SOLO_ROL_EMPRESA',
    )
  }
  const platformCtx = ctx as PlatformAuthContext
  const rolesUsuario = platformCtx.roles
  const tipo = platformCtx.companyTypeCode
  const esST = tipo === 'SERVICIO_TECNICO'
  const permitidos = esST ? ROLES_CIERRE_CAJA_ST : ROLES_CIERRE_CAJA_BOTICA
  const puede = rolesUsuario.some((r) => permitidos.has(r))
  if (!puede) {
    throw createHttpError(
      403,
      esST
        ? 'No tienes permisos para cerrar la caja. Contacta al Administrador de Servicio Técnico.'
        : 'No tienes permisos para cerrar la caja. Contacta al Administrador de Botica o Supervisor.',
      'CIERRE_CAJA_NO_AUTORIZADO',
    )
  }
  return ctx
}

export async function requireCanAdminCajasEstructuralmente(request: FastifyRequest): Promise<AuthContext> {
  const ctx = await getAuthContext(request)
  if (ctx.isPlatformAdmin) {
    throw createHttpError(
      403,
      'El administrador de plataforma no gestiona cajas operativas. Utiliza un rol de empresa.',
      'ADMIN_CAJAS_SOLO_ROL_EMPRESA',
    )
  }
  const platformCtx = ctx as PlatformAuthContext
  const rolesUsuario = platformCtx.roles
  const tipo = platformCtx.companyTypeCode
  const esST = tipo === 'SERVICIO_TECNICO'
  const permitidos = esST ? ROLES_ADMIN_CAJAS_ESTRUCTURAL_ST : ROLES_ADMIN_CAJAS_ESTRUCTURAL_BOTICA
  const puede = rolesUsuario.some((r) => permitidos.has(r))
  if (!puede) {
    throw createHttpError(
      409,
      esST
        ? 'No existen cajas configuradas para esta sucursal. Contacta al Administrador de Servicio Técnico para crear una.'
        : 'No existen cajas configuradas para esta sucursal. Contacta al Administrador de Botica para crear una.',
      'CAJA_INEXISTENTE_SIN_PERMISO_CREACION',
    )
  }
  return ctx
}
