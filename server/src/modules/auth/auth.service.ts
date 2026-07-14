import { compare, hash } from 'bcryptjs'
import { AccionAuditoria, Prisma } from '@prisma/client'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import {
  getPermissionsForRoles,
  getRoleLabel,
  isAuthRole,
} from './auth.permissions.js'
import type { AuthSession } from './auth.types.js'

type LoginPayload = {
  email: string
  password: string
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
}

type AuthenticatedUser = Awaited<ReturnType<typeof findUserByIdentifier>>

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
          nombre: true,
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

function buildSessionFromUser(user: NonNullable<AuthenticatedUser>, accessToken: string, refreshToken: string): AuthSession {
  const roles = user.usuariosRoles
    .map((entry) => entry.rol.codigo)
    .filter(isAuthRole)

  const primaryRole = roles[0] ?? 'CAJERO'
  const dbPermissions = user.usuariosRoles.flatMap((entry) =>
    entry.rol.rolesPermisos.map((permission) => permission.permiso.codigo),
  )
  const rolePermissions = getPermissionsForRoles(roles)
  const permissions =
    rolePermissions.includes('*')
      ? (['*'] as AuthSession['user']['permissions'])
      : (Array.from(
          new Set([...dbPermissions, ...rolePermissions]),
        ) as AuthSession['user']['permissions'])

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email ?? user.username,
      fullName: `${user.nombres} ${user.apellidos}`.trim(),
      roleName: getRoleLabel(primaryRole),
      branchName: user.sucursal?.nombre ?? 'Sin sucursal',
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
) {
  const payload = {
    sub: user.id,
    email: user.email ?? user.username,
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

  const { accessToken, refreshToken } = await signSessionTokens(request, user)

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

  return reply.send(buildSessionFromUser(user, accessToken, refreshToken))
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
      sucursal: {
        select: {
          nombre: true,
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

  return reply.send(buildSessionFromUser(user, token, token))
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
