import { compare, hash } from 'bcryptjs'
import { AccionAuditoria, Prisma } from '@prisma/client'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import {
  getPermissionsForRoles,
  getRoleLabel,
  isAuthRole,
} from './auth.permissions.js'
import type { AuthBranch, AuthLoginResponse, AuthSession } from './auth.types.js'

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

type AuthenticatedUser = Awaited<ReturnType<typeof findUserByIdentifier>>

function createHttpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number }
  error.statusCode = statusCode
  return error
}

async function findUserByIdentifier(identifier: string) {
  const normalizedIdentifier = identifier.trim().toLowerCase()
  const now = new Date()

  return prisma.usuario.findFirst({
    where: {
      deletedAt: null,
      activo: true,
      OR: [
        {
          email: normalizedIdentifier,
        },
        {
          username: normalizedIdentifier,
        },
      ],
    },
    include: {
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
          OR: [{ fechaFin: null }, { fechaFin: { gte: now } }],
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
}

function resolveAvailableBranches(user: NonNullable<AuthenticatedUser>): AuthBranch[] {
  const userCompanyId = user.empresaId
  const companyIds = new Set<string>()

  const memberships = user.usuarioSucursales
    .filter((entry) => entry.sucursal.activo && entry.sucursal.deletedAt === null)
    .map((entry) => {
      companyIds.add(entry.sucursal.empresaId)
      return {
        id: entry.sucursal.id,
        code: entry.sucursal.codigo,
        name: entry.sucursal.nombre,
        companyId: entry.sucursal.empresaId,
        companyName: entry.sucursal.empresa?.razonSocial ?? 'Empresa',
      }
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

  if (memberships.length > 0) {
    return memberships.filter((branch) => branch.companyId === userCompanyId)
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
    (entry) => entry.sucursal.id === branchId,
  )

  const roles = membership
    ? [membership.rol.codigo].filter(isAuthRole)
    : user.usuariosRoles.map((entry) => entry.rol.codigo).filter(isAuthRole)

  const primaryRole = roles[0] ?? 'CAJERO'
  const dbPermissions = membership
    ? membership.rol.rolesPermisos.map((permission) => permission.permiso.codigo)
    : user.usuariosRoles.flatMap((entry) =>
        entry.rol.rolesPermisos.map((permission) => permission.permiso.codigo),
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

function buildSessionFromUser(
  user: NonNullable<AuthenticatedUser>,
  branch: AuthBranch,
  accessToken: string,
  refreshToken: string,
): AuthSession {
  const { roles, primaryRole, permissions } = resolveRoleContext(user, branch.id)

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email ?? user.username,
      fullName: `${user.nombres} ${user.apellidos}`.trim(),
      roleName: getRoleLabel(primaryRole),
      companyId: branch.companyId,
      companyName: branch.companyName,
      branchId: branch.id,
      branchCode: branch.code,
      branchName: branch.name,
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

  const branches = resolveAvailableBranches(user)
  if (branches.length === 0) {
    return reply.code(409).send({
      message: 'El usuario no tiene una sucursal asignada.',
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

  const activeBranchId = decoded.branchId ?? null

  const user = await prisma.usuario.findFirst({
    where: {
      id: decoded.sub,
      activo: true,
      deletedAt: null,
    },
    include: {
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

  const branches = resolveAvailableBranches(user)
  const selectedBranch =
    activeBranchId ? branches.find((branch) => branch.id === activeBranchId) : branches[0]

  if (!selectedBranch) {
    return reply.code(401).send({
      message: 'La sucursal activa ya no es válida para este usuario.',
    })
  }

  return reply.send(buildSessionFromUser(user, selectedBranch, token, token))
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

  const branches = resolveAvailableBranches(user)
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

  const { roles } = resolveRoleContext(user, selectedBranch.id)

  const { accessToken, refreshToken } = await signSessionTokens(
    request,
    user,
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
  })

  return reply.send(buildSessionFromUser(user, selectedBranch, accessToken, refreshToken))
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
