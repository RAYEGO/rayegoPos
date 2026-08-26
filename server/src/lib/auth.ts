import type { FastifyRequest } from 'fastify'
import { prisma } from './prisma.js'
import { isPlatformAdminRole } from '../modules/auth/auth.permissions.js'
import type { AuthRole } from '../modules/auth/auth.types.js'

type AuthTokenPayload = {
  sub: string
  email: string
  typ: 'access' | 'refresh' | 'reset-password'
  companyId?: string | null
  branchId?: string | null
  roles?: string[]
}

export type PlatformAuthContext = {
  userId: string
  companyId: string
  branchId: string
  roles: AuthRole[]
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
  companyTypeId: null
  companyTypeCode: null
  enabledModules: string[]
  isPlatformAdmin: true
}

export type AuthContext = PlatformAuthContext | BranchlessAuthContext

function createHttpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number }
  error.statusCode = statusCode
  return error
}

function normalizeRoles(roles: string[] | undefined): AuthRole[] {
  if (!roles || roles.length === 0) return []
  const valid = new Set<AuthRole>(['ADMIN', 'ADMIN_POS', 'SUPERVISOR', 'CAJERO', 'ALMACEN'])
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
    throw createHttpError(401, 'El token de acceso no es válido.')
  }

  const userId = decoded.sub
  const roles = normalizeRoles(decoded.roles)
  const isPlatformAdmin = hasPlatformRole(roles)

  if (isPlatformAdmin) {
    const user = await prisma.usuario.findFirst({
      where: { id: userId, deletedAt: null, activo: true },
      select: { id: true },
    })
    if (!user) {
      throw createHttpError(401, 'El usuario asociado a la sesión no está disponible.')
    }
    const ctx: BranchlessAuthContext = {
      userId,
      companyId: null,
      branchId: null,
      roles,
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

  const [branch, membership, userCompanyMatch, companyType] = await Promise.all([
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
      select: { id: true, sucursalId: true },
    }),
    prisma.empresa
      .findFirst({
        where: { id: companyId, deletedAt: null, activo: true },
        select: {
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
      })
      .then((empresa) => {
        const tipo = empresa?.tipoEmpresa
        if (!tipo || !tipo.activo) return { companyTypeId: null, companyTypeCode: null, enabledModules: [] as string[] }
        const enabledModules = Array.isArray(tipo.modulos)
          ? tipo.modulos.map((m) => (m as { moduloCodigo?: string }).moduloCodigo).filter((m): m is string => Boolean(m))
          : ([] as string[])
        return {
          companyTypeId: tipo.id,
          companyTypeCode: tipo.codigo,
          enabledModules,
        }
      }),
  ])

  if (!branch) {
    throw createHttpError(409, 'La sucursal seleccionada no existe o se encuentra inactiva.')
  }
  if (branch.empresaId !== companyId) {
    throw createHttpError(409, 'La sucursal seleccionada pertenece a una empresa distinta a la de tu sesión.')
  }
  if (!userCompanyMatch) {
    throw createHttpError(401, 'El usuario no pertenece a la empresa de la sesión.')
  }
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
  if (ctx.roles.includes('ADMIN')) return ctx

  const moduleCode = permissionToModuleCode(permissionCode)
  const ctxEnabledModules = Array.isArray(ctx.enabledModules) ? ctx.enabledModules : ([] as string[])

  const platform = ctx as PlatformAuthContext
  const platformModules = Array.isArray(platform.enabledModules) ? platform.enabledModules : ([] as string[])
  if (platformModules.length > 0 && !platformModules.includes(moduleCode)) {
    throw createHttpError(
      403,
      `El módulo "${moduleCode}" no está habilitado para empresas de tipo ${platform.companyTypeCode ?? 'desconocido'}.`,
    )
  }

  if (ctxEnabledModules.length === 0 && ctx.isPlatformAdmin) return ctx
  const requiredModule = permissionToModuleCode(permissionCode)
  if (permissionCode.endsWith('.read') || permissionCode.endsWith('.manage')) {
    if (!ctx.isPlatformAdmin) {
      if (!ctxEnabledModules.includes(requiredModule) && requiredModule !== permissionCode) {
        throw createHttpError(403, 'No tienes autorización para usar este módulo.')
      }
    }
  }
  return ctx
}
