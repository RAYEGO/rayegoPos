import { compare, hash } from 'bcryptjs'
import { AccionAuditoria, Prisma } from '@prisma/client'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import {
  getPermissionsForRoles,
  getRoleLabel,
  isAuthRole,
  isPlatformAdminRole,
} from './auth.permissions.js'
import type { AuthBranch, AuthLoginResponse, AuthRole, AuthSession } from './auth.types.js'

const BOTICA_DEFAULT_MODULES = [
  'dashboard',
  'ventas',
  'compras',
  'productos',
  'inventario',
  'lotes',
  'kardex',
  'clientes',
  'proveedores',
  'caja',
  'reportes',
  'configuracion',
  'usuarios',
  'sesiones',
  'auditoria',
]

type LoginPayload = {
  email: string
  password: string
  branchId?: string
}

type ForgotPasswordPayload = {
  email: string
}

type ResetPasswordPayload = {
  token: string
  password: string
}

type AuthTokenPayload = {
  sub: string
  email: string
  typ: 'access' | 'refresh' | 'reset-password'
  companyId?: string | null
  branchId?: string | null
  roles?: string[]
}

type AuthenticatedUser = any

function createHttpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number }
  error.statusCode = statusCode
  return error
}

function isSchemaMismatchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = String(err?.message ?? '')
  if (/column.*tipo_empresa_id.*does not exist/i.test(msg)) return true
  if (/does not exist.*tipo_empresa_id/i.test(msg)) return true
  if (/Unknown argument `tipoEmpresaId`/i.test(msg)) return true
  if (/Unknown argument `tipoEmpresa`/i.test(msg)) return true
  return false
}

function withBoticaFallback<U extends { empresa: any } | null>(user: U): U {
  if (!user) return user
  if (!user.empresa) return user
  const empresa = user.empresa as unknown as Record<string, unknown>
  if (empresa.tipoEmpresaId == null) {
    empresa.tipoEmpresaId = '00000000-0000-0000-0000-000000000001'
  }
  if (!empresa.tipoEmpresa) {
    empresa.tipoEmpresa = {
      id: String(empresa.tipoEmpresaId ?? '00000000-0000-0000-0000-000000000001'),
      codigo: 'BOTICA',
      nombre: 'Botica y Farmacia',
      modulos: BOTICA_DEFAULT_MODULES.map((moduloCodigo) => ({ moduloCodigo })),
    }
  } else if (
    Array.isArray((empresa.tipoEmpresa as any).modulos) === false ||
    (empresa.tipoEmpresa as any).modulos.length === 0
  ) {
    const tipo = empresa.tipoEmpresa as any
    tipo.modulos = BOTICA_DEFAULT_MODULES.map((moduloCodigo) => ({ moduloCodigo }))
  }
  return user
}

async function findUserByIdentifier(identifier: string): Promise<AuthenticatedUser | null> {
  const normalizedIdentifier = identifier.trim().toLowerCase()
  const now = new Date()

  const baseInclude = {
    sucursal: {
      select: {
        id: true,
        codigo: true,
        nombre: true,
        empresaId: true,
        activo: true,
        deletedAt: true,
        empresa: {
          select: { razonSocial: true },
        },
      },
    },
    usuarioSucursales: {
      where: { deletedAt: null, activo: true },
      include: {
        sucursal: {
          select: {
            id: true,
            codigo: true,
            nombre: true,
            empresaId: true,
            empresa: { select: { razonSocial: true } },
            activo: true,
            deletedAt: true,
          },
        },
        rol: {
          include: {
            rolesPermisos: {
              where: { deletedAt: null },
              include: { permiso: { select: { codigo: true } } },
            },
          },
        },
      },
    },
    usuariosRoles: {
      where: {
        deletedAt: null,
        activo: true,
        OR: [{ fechaFin: null }, { fechaFin: { gte: now } }],
      },
      include: {
        rol: {
          include: {
            rolesPermisos: {
              where: { deletedAt: null },
              include: { permiso: { select: { codigo: true } } },
            },
          },
        },
      },
    },
  } as any

  const where = {
    deletedAt: null,
    activo: true,
    OR: [{ email: normalizedIdentifier }, { username: normalizedIdentifier }],
  } as any

  try {
    const user = (await prisma.usuario.findFirst({
      where,
      include: {
        empresa: {
          select: {
            id: true,
            razonSocial: true,
            tipoEmpresaId: true,
            tipoEmpresa: {
              select: {
                id: true,
                codigo: true,
                nombre: true,
                modulos: { select: { moduloCodigo: true } },
              },
            },
          },
        },
        ...baseInclude,
      },
    })) as AuthenticatedUser | null

    return withBoticaFallback(user)
  } catch (err) {
    if (!isSchemaMismatchError(err)) {
      throw err
    }

    const user = (await prisma.usuario.findFirst({
      where,
      include: {
        empresa: {
          select: {
            id: true,
            razonSocial: true,
          },
        },
        ...baseInclude,
      },
    })) as AuthenticatedUser | null

    return withBoticaFallback(user)
  }
}

function resolveGlobalRoles(
  user: NonNullable<AuthenticatedUser>,
): { roles: AuthRole[]; permissions: string[] } {
  const roles = user.usuariosRoles
    .map((entry: any) => entry.rol.codigo)
    .filter(isAuthRole)

  const dbPermissions = user.usuariosRoles.flatMap((entry: any) =>
    entry.rol.rolesPermisos.map((permission: any) => permission.permiso.codigo),
  )
  const rolePermissions = getPermissionsForRoles(roles)
  const permissions = rolePermissions.includes('*')
    ? ['*']
    : Array.from(new Set([...dbPermissions, ...rolePermissions]))

  return { roles, permissions }
}

function hasPlatformAdminRole(user: NonNullable<AuthenticatedUser>): boolean {
  const { roles } = resolveGlobalRoles(user)
  return roles.some((r) => isPlatformAdminRole(r))
}

function resolveAvailableBranches(user: NonNullable<AuthenticatedUser>): AuthBranch[] {
  const userCompanyId = user.empresaId
  const companyIds = new Set<string>()

  const memberships = user.usuarioSucursales
    .filter((entry: any) => entry.sucursal.activo && entry.sucursal.deletedAt === null)
    .map((entry: any) => {
      companyIds.add(entry.sucursal.empresaId)
      return {
        id: entry.sucursal.id,
        code: entry.sucursal.codigo,
        name: entry.sucursal.nombre,
        companyId: entry.sucursal.empresaId,
        companyName: entry.sucursal.empresa?.razonSocial ?? 'Empresa',
      }
    })

  const uniqueMembershipsMap = new Map<string, AuthBranch>()
  for (const branch of memberships as AuthBranch[]) {
    uniqueMembershipsMap.set(branch.id, branch)
  }

  const uniqueMemberships = Array.from(uniqueMembershipsMap.values())
  uniqueMemberships.sort((a, b) => {
    const byName = a.name.localeCompare(b.name)
    if (byName !== 0) return byName
    return a.code.localeCompare(b.code)
  })

  if (user.sucursal && user.sucursal.activo && user.sucursal.deletedAt === null) {
    companyIds.add(user.sucursal.empresaId)
  }

  if (companyIds.size > 1) {
    throw createHttpError(
      409,
      'El usuario está asociado a más de una empresa. Esta versión de Rayego POS no lo permite.',
    )
  }

  if (companyIds.size === 1 && !companyIds.has(userCompanyId)) {
    throw createHttpError(409, 'La empresa del usuario no es válida para sus sucursales.')
  }

  if (uniqueMemberships.length > 0) {
    return uniqueMemberships.filter((branch) => branch.companyId === userCompanyId)
  }

  if (user.sucursal) {
    return [
      {
        id: user.sucursal.id,
        code: user.sucursal.codigo,
        name: user.sucursal.nombre,
        companyId: user.sucursal.empresaId,
        companyName: user.sucursal.empresa?.razonSocial ?? 'Empresa',
      },
    ]
  }

  return []
}

function resolveRoleContext(
  user: NonNullable<AuthenticatedUser>,
  branchId: string,
) {
  const membership = user.usuarioSucursales.find(
    (entry: any) => entry.sucursal.id === branchId,
  )

  const roles = membership
    ? [membership.rol.codigo].filter(isAuthRole)
    : user.usuariosRoles.map((entry: any) => entry.rol.codigo).filter(isAuthRole)

  const primaryRole = roles[0] ?? 'CAJERO'
  const dbPermissions = membership
    ? membership.rol.rolesPermisos.map((permission: any) => permission.permiso.codigo)
    : user.usuariosRoles.flatMap((entry: any) =>
        entry.rol.rolesPermisos.map((permission: any) => permission.permiso.codigo),
      )
  const rolePermissions = getPermissionsForRoles(roles)
  const permissions =
    rolePermissions.includes('*')
      ? (['*'] as AuthSession['user']['permissions'])
      : (Array.from(
          new Set([...dbPermissions, ...rolePermissions]),
        ) as AuthSession['user']['permissions'])

  return { roles, primaryRole, permissions }
}

function resolveEnabledModules(
  user: NonNullable<AuthenticatedUser>,
): { companyTypeId: string | null; companyTypeCode: string | null; enabledModules: string[] } {
  const tipoEmpresa = user.empresa?.tipoEmpresa
  if (!tipoEmpresa) {
    return {
      companyTypeId: null,
      companyTypeCode: null,
      enabledModules: [],
    }
  }

  const enabledModules = tipoEmpresa.modulos
    .map((m: any) => m.moduloCodigo)
    .filter(Boolean) as string[]

  return {
    companyTypeId: tipoEmpresa.id,
    companyTypeCode: tipoEmpresa.codigo,
    enabledModules,
  }
}

function buildSessionFromUser(
  user: NonNullable<AuthenticatedUser>,
  branch: AuthBranch | null,
  accessToken: string,
  refreshToken: string,
): AuthSession {
  const isPlatformAdmin = hasPlatformAdminRole(user)
  const moduleCtx = resolveEnabledModules(user)

  let roles: AuthRole[]
  let primaryRole: AuthRole
  let permissions: AuthSession['user']['permissions']
  let companyId: string
  let companyName: string
  let branchId: string | null
  let branchCode: string | null
  let branchName: string | null
  let companyTypeId: string | null
  let companyTypeCode: string | null
  let enabledModules: string[]

  if (isPlatformAdmin && !branch) {
    const globalCtx = resolveGlobalRoles(user)
    roles = globalCtx.roles
    primaryRole = roles[0] ?? 'ADMIN_POS'
    const perms = globalCtx.permissions
    permissions = (perms.includes('*') ? ['*'] : perms) as AuthSession['user']['permissions']
    companyId = user.empresaId
    companyName = user.empresa?.razonSocial ?? 'Plataforma'
    branchId = null
    branchCode = null
    branchName = null
    companyTypeId = null
    companyTypeCode = null
    enabledModules = [
      'dashboard',
      'tipos_empresa',
      'empresas',
      'usuarios',
      'sesiones',
      'auditoria',
      'reportes',
      'configuracion',
    ]
  } else if (branch) {
    const roleCtx = resolveRoleContext(user, branch.id)
    roles = roleCtx.roles
    primaryRole = roleCtx.primaryRole
    permissions = roleCtx.permissions
    companyId = branch.companyId
    companyName = branch.companyName
    branchId = branch.id
    branchCode = branch.code
    branchName = branch.name
    companyTypeId = moduleCtx.companyTypeId
    companyTypeCode = moduleCtx.companyTypeCode
    enabledModules = moduleCtx.enabledModules
  } else {
    throw createHttpError(409, 'No se pudo construir la sesión: falta sucursal o rol de plataforma.')
  }

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email ?? user.username,
      fullName: `${user.nombres} ${user.apellidos}`.trim(),
      roleName: getRoleLabel(primaryRole),
      companyId,
      companyName,
      branchId,
      branchCode,
      branchName,
      companyTypeId,
      companyTypeCode,
      enabledModules,
      roles,
      permissions,
    },
  }
}

async function writeAuditEntry(
  userId: string | null,
  action: AccionAuditoria,
  request: FastifyRequest,
  nextValue?: Record<string, unknown>,
) {
  await prisma.auditoria.create({
    data: {
      usuarioId: userId,
      tabla: 'usuarios',
      registroId: userId,
      accion: action,
      valorNuevo: nextValue as Prisma.InputJsonValue | undefined,
      direccionIp: request.ip,
      userAgent: request.headers['user-agent'],
    },
  })
}

async function signSessionTokens(
  request: FastifyRequest,
  user: NonNullable<AuthenticatedUser>,
  companyId: string | null,
  branchId: string | null,
  roles: string[],
) {
  const payload = {
    sub: user.id,
    email: user.email ?? user.username,
    companyId,
    branchId,
    roles,
  }

  const accessToken = await request.server.jwt.sign(
    {
      ...payload,
      typ: 'access',
    },
    {
      expiresIn: '15m',
    },
  )
  const refreshToken = await request.server.jwt.sign(
    {
      ...payload,
      typ: 'refresh',
    },
    {
      expiresIn: '7d',
    },
  )

  return { accessToken, refreshToken }
}

export async function login(
  payload: LoginPayload,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const user = await findUserByIdentifier(payload.email)

  if (!user) {
    return reply.code(401).send({
      message: 'Credenciales inválidas. Verifica tu correo y contraseña.',
    })
  }

  const isPasswordValid = await compare(payload.password, user.passwordHash)

  if (!isPasswordValid) {
    return reply.code(401).send({
      message: 'Credenciales inválidas. Verifica tu correo y contraseña.',
    })
  }

  const isPlatformAdmin = hasPlatformAdminRole(user)

  if (isPlatformAdmin && !payload.branchId) {
    const globalCtx = resolveGlobalRoles(user)
    const roles = globalCtx.roles

    const { accessToken, refreshToken } = await signSessionTokens(
      request,
      user,
      user.empresaId,
      null,
      roles,
    )

    await prisma.usuario.update({
      where: { id: user.id },
      data: { ultimoAccesoAt: new Date() },
    })

    await writeAuditEntry(user.id, AccionAuditoria.LOGIN, request, {
      source: 'auth.login',
      mode: 'platform_admin_branchless',
    })

    return reply.send(buildSessionFromUser(user, null, accessToken, refreshToken))
  }

  const branches = resolveAvailableBranches(user)
  if (branches.length === 0) {
    return reply.code(409).send({
      message:
        'Tu cuenta no tiene ninguna sucursal asignada. Comunícate con tu administrador para que te autorice el acceso operativo.',
    })
  }

  if (branches.length > 1 && !payload.branchId) {
    return reply.send({
      requiresBranchSelection: true,
      branches,
    } satisfies AuthLoginResponse)
  }

  const activeBranch =
    payload.branchId
      ? branches.find((branch) => branch.id === payload.branchId)
      : branches[0]

  if (!activeBranch) {
    return reply.code(400).send({
      message: 'La sucursal seleccionada no es válida para este usuario.',
    })
  }

  if (activeBranch.companyId !== user.empresaId) {
    return reply.code(409).send({
      message: 'La sucursal seleccionada pertenece a una empresa distinta a la del usuario.',
    })
  }

  const { roles } = resolveRoleContext(user, activeBranch.id)

  const { accessToken, refreshToken } = await signSessionTokens(
    request,
    user,
    activeBranch.companyId,
    activeBranch.id,
    roles,
  )

  await prisma.usuario.update({
    where: {
      id: user.id,
    },
    data: {
      ultimoAccesoAt: new Date(),
    },
  })

  await writeAuditEntry(user.id, AccionAuditoria.LOGIN, request, {
    source: 'auth.login',
    mode: 'branch',
  })

  return reply.send(buildSessionFromUser(user, activeBranch, accessToken, refreshToken))
}

export async function getCurrentSession(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')

  if (!token) {
    return reply.code(401).send({
      message: 'Sesión no disponible.',
    })
  }

  let decoded: AuthTokenPayload | null = null

  try {
    decoded = await request.server.jwt.verify<AuthTokenPayload>(token)
  } catch {
    decoded = null
  }

  if (!decoded) {
    return reply.code(401).send({
      message: 'La sesión ya no es válida.',
    })
  }

  if (decoded.typ !== 'access') {
    return reply.code(401).send({
      message: 'El token de acceso no es válido.',
    })
  }

  const user = await prisma.usuario.findFirst({
    where: {
      id: decoded.sub,
      activo: true,
      deletedAt: null,
    },
    include: {
      empresa: {
        select: {
          id: true,
          razonSocial: true,
          tipoEmpresaId: true,
          tipoEmpresa: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
              modulos: {
                where: { activo: true },
                select: { moduloCodigo: true },
              },
            },
          },
        },
      },
      sucursal: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          empresaId: true,
          activo: true,
          deletedAt: true,
          empresa: {
            select: {
              razonSocial: true,
            },
          },
        },
      },
      usuarioSucursales: {
        where: {
          deletedAt: null,
          activo: true,
        },
        include: {
          sucursal: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
              empresaId: true,
              empresa: {
                select: {
                  razonSocial: true,
                },
              },
              activo: true,
              deletedAt: true,
            },
          },
          rol: {
            include: {
              rolesPermisos: {
                where: {
                  deletedAt: null,
                },
                include: {
                  permiso: {
                    select: {
                      codigo: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      usuariosRoles: {
        where: {
          deletedAt: null,
          activo: true,
          OR: [{ fechaFin: null }, { fechaFin: { gte: new Date() } }],
        },
        include: {
          rol: {
            include: {
              rolesPermisos: {
                where: {
                  deletedAt: null,
                },
                include: {
                  permiso: {
                    select: {
                      codigo: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!user) {
    return reply.code(401).send({
      message: 'La sesión ya no es válida.',
    })
  }

  const isPlatformAdmin = hasPlatformAdminRole(user as NonNullable<AuthenticatedUser>)
  const activeBranchId = decoded.branchId ?? null

  if (isPlatformAdmin && !activeBranchId) {
    return reply.send(buildSessionFromUser(user as NonNullable<AuthenticatedUser>, null, token, token))
  }

  const branches = resolveAvailableBranches(user as NonNullable<AuthenticatedUser>)
  const selectedBranch =
    activeBranchId ? branches.find((branch) => branch.id === activeBranchId) : branches[0]

  if (!selectedBranch) {
    return reply.code(401).send({
      message: 'La sucursal activa ya no es válida para este usuario.',
    })
  }

  return reply.send(buildSessionFromUser(user as NonNullable<AuthenticatedUser>, selectedBranch, token, token))
}

export async function logout(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')

  if (token) {
    let decoded: AuthTokenPayload | null = null

    try {
      decoded = await request.server.jwt.verify<AuthTokenPayload>(token)
    } catch {
      decoded = null
    }

    if (decoded?.sub) {
      await writeAuditEntry(decoded.sub, AccionAuditoria.LOGOUT, request, {
        source: 'auth.logout',
      })
    }
  }

  return reply.code(204).send()
}

type RefreshSessionPayload = {
  refreshToken: string
}

export async function refreshSession(
  payload: RefreshSessionPayload,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!payload.refreshToken?.trim()) {
    return reply.code(401).send({
      message: 'El token de renovación no fue enviado.',
      code: 'REFRESH_TOKEN_REQUIRED',
    })
  }

  let decoded: AuthTokenPayload | null = null
  try {
    decoded = await request.server.jwt.verify<AuthTokenPayload>(payload.refreshToken)
  } catch {
    decoded = null
  }

  if (!decoded || decoded.typ !== 'refresh') {
    return reply.code(401).send({
      message: 'El token de renovación no es válido o ha expirado.',
      code: 'REFRESH_TOKEN_INVALID',
    })
  }

  const activeBranchId = decoded.branchId ?? null
  const activeCompanyId = decoded.companyId ?? null

  const user = await prisma.usuario.findFirst({
    where: {
      id: decoded.sub,
      activo: true,
      deletedAt: null,
    },
    include: {
      empresa: {
        select: {
          id: true,
          razonSocial: true,
          tipoEmpresaId: true,
          tipoEmpresa: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
              modulos: {
                where: { activo: true },
                select: { moduloCodigo: true },
              },
            },
          },
        },
      },
      sucursal: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          empresaId: true,
          activo: true,
          deletedAt: true,
          empresa: {
            select: {
              razonSocial: true,
            },
          },
        },
      },
      usuarioSucursales: {
        where: {
          deletedAt: null,
          activo: true,
        },
        include: {
          sucursal: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
              empresaId: true,
              empresa: {
                select: {
                  razonSocial: true,
                },
              },
              activo: true,
              deletedAt: true,
            },
          },
          rol: {
            include: {
              rolesPermisos: {
                where: {
                  deletedAt: null,
                },
                include: {
                  permiso: {
                    select: {
                      codigo: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      usuariosRoles: {
        where: {
          deletedAt: null,
          activo: true,
          OR: [{ fechaFin: null }, { fechaFin: { gte: new Date() } }],
        },
        include: {
          rol: {
            include: {
              rolesPermisos: {
                where: {
                  deletedAt: null,
                },
                include: {
                  permiso: {
                    select: {
                      codigo: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!user) {
    return reply.code(401).send({
      message: 'El usuario asociado a la sesión ya no está disponible.',
      code: 'REFRESH_USER_NOT_FOUND',
    })
  }

  const isPlatformAdmin = hasPlatformAdminRole(user as NonNullable<AuthenticatedUser>)

  if (isPlatformAdmin && !activeBranchId) {
    const globalCtx = resolveGlobalRoles(user as NonNullable<AuthenticatedUser>)
    const roles = globalCtx.roles

    const { accessToken, refreshToken } = await signSessionTokens(
      request,
      user as NonNullable<AuthenticatedUser>,
      user.empresaId,
      null,
      roles,
    )

    await prisma.usuario.update({
      where: { id: user.id },
      data: { ultimoAccesoAt: new Date() },
    })

    await writeAuditEntry(user.id, AccionAuditoria.UPDATE, request, {
      source: 'auth.refreshSession',
      mode: 'platform_admin_branchless',
    })

    return reply.send(buildSessionFromUser(user as NonNullable<AuthenticatedUser>, null, accessToken, refreshToken))
  }

  const branches = resolveAvailableBranches(user as NonNullable<AuthenticatedUser>)
  let selectedBranch = activeBranchId
    ? branches.find((branch) => branch.id === activeBranchId)
    : branches[0]

  if (!selectedBranch) {
    selectedBranch = branches[0]
  }

  if (!selectedBranch) {
    return reply.code(401).send({
      message: 'No se pudo determinar la sucursal activa para renovar la sesión.',
      code: 'REFRESH_BRANCH_INVALID',
    })
  }

  if (activeCompanyId && selectedBranch.companyId !== activeCompanyId) {
    return reply.code(401).send({
      message: 'La empresa de la sesión ya no coincide con la sucursal.',
      code: 'REFRESH_COMPANY_MISMATCH',
    })
  }

  const { roles } = resolveRoleContext(user as NonNullable<AuthenticatedUser>, selectedBranch.id)

  const { accessToken, refreshToken } = await signSessionTokens(
    request,
    user as NonNullable<AuthenticatedUser>,
    selectedBranch.companyId,
    selectedBranch.id,
    roles,
  )

  await prisma.usuario.update({
    where: { id: user.id },
    data: { ultimoAccesoAt: new Date() },
  })

  await writeAuditEntry(user.id, AccionAuditoria.UPDATE, request, {
    source: 'auth.refreshSession',
    mode: 'branch',
  })

  return reply.send(buildSessionFromUser(user as NonNullable<AuthenticatedUser>, selectedBranch, accessToken, refreshToken))
}

export async function requestPasswordReset(
  payload: ForgotPasswordPayload,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const user = await findUserByIdentifier(payload.email)
  const email = payload.email.trim().toLowerCase()

  if (!user) {
    return reply.send({
      email,
      resetToken: '',
      expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
    })
  }

  const resetToken = await request.server.jwt.sign(
    {
      sub: user.id,
      email: user.email ?? user.username,
      typ: 'reset-password',
    },
    {
      expiresIn: '30m',
    },
  )

  return reply.send({
    email,
    resetToken,
    expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
  })
}

export async function resetPassword(
  payload: ResetPasswordPayload,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const token = payload.token.trim()

  if (token === '') {
    return reply.code(400).send({
      message: 'El enlace de recuperación no es válido.',
    })
  }

  let decoded: AuthTokenPayload | null = null

  try {
    decoded = await request.server.jwt.verify<AuthTokenPayload>(token)
  } catch {
    decoded = null
  }

  if (!decoded || decoded.typ !== 'reset-password') {
    return reply.code(400).send({
      message: 'El enlace de recuperación no es válido o ha expirado.',
    })
  }

  const nextPasswordHash = await hash(payload.password, 10)

  await prisma.usuario.update({
    where: {
      id: decoded.sub,
    },
    data: {
      passwordHash: nextPasswordHash,
    },
  })

  await writeAuditEntry(decoded.sub, AccionAuditoria.UPDATE, request, {
    source: 'auth.reset-password',
  })

  return reply.code(204).send()
}
