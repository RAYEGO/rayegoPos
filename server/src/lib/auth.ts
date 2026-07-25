import type { FastifyRequest } from 'fastify'

type AuthTokenPayload = {
  sub: string
  email: string
  typ: 'access' | 'refresh' | 'reset-password'
  branchId?: string | null
  roles?: string[]
}

function createHttpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number }
  error.statusCode = statusCode
  return error
}

export async function getAuthContext(request: FastifyRequest) {
  if (request.auth) {
    return request.auth
  }

  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) {
    throw createHttpError(401, 'Sesión no disponible.')
  }

  const decoded = await request.server.jwt.verify<AuthTokenPayload>(token)
  if (decoded.typ !== 'access') {
    throw createHttpError(401, 'El token de acceso no es válido.')
  }

  const branchId = decoded.branchId
  if (!branchId) {
    throw createHttpError(409, 'No hay una sucursal activa en la sesión.')
  }

  const ctx = {
    userId: decoded.sub,
    branchId,
    roles: decoded.roles ?? [],
  }

  request.auth = ctx
  return ctx
}

