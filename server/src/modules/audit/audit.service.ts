import { AccionAuditoria, Prisma } from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { prisma } from '../../lib/prisma.js'

function createHttpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number }
  error.statusCode = statusCode
  return error
}

type AuthTokenPayload = {
  sub: string
  typ: 'access' | 'refresh' | 'reset-password'
}

type CreateAuditEntryPayload = {
  tabla: string
  registroId: string
  accion: AccionAuditoria
  valorNuevo?: Record<string, unknown>
}

async function getAuthenticatedUserId(request: FastifyRequest) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')

  if (!token) {
    throw createHttpError(401, 'Sesión no disponible.')
  }

  let decoded: AuthTokenPayload | null = null

  try {
    decoded = await request.server.jwt.verify<AuthTokenPayload>(token)
  } catch {
    decoded = null
  }

  if (!decoded || decoded.typ !== 'access') {
    throw createHttpError(401, 'El token de acceso no es válido.')
  }

  return decoded.sub
}

export async function createAuditEntry(payload: CreateAuditEntryPayload, request: FastifyRequest) {
  const userId = await getAuthenticatedUserId(request)

  await prisma.auditoria.create({
    data: {
      usuarioId: userId,
      tabla: payload.tabla,
      registroId: payload.registroId,
      accion: payload.accion,
      valorNuevo: payload.valorNuevo as Prisma.InputJsonValue | undefined,
      direccionIp: request.ip,
      userAgent: request.headers['user-agent'],
    },
  })
}
