import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import Fastify from 'fastify'
import { ZodError } from 'zod'
import { serverConfig } from './config.js'
import { authRoutes } from './routes/auth.js'

export function createApp() {
  const app = Fastify({
    logger: true,
  })

  app.register(cors, {
    origin: serverConfig.frontendOrigin,
    credentials: true,
  })

  app.register(jwt, {
    secret: serverConfig.jwtSecret,
  })

  app.get('/health', async () => ({
    status: 'ok',
    service: 'rayego-auth-api',
  }))

  app.register(async (instance) => {
    instance.register(authRoutes, {
      prefix: '/api/auth',
    })
  })

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: 'La solicitud contiene datos inválidos.',
        issues: error.flatten(),
      })
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
    ) {
      const message =
        'message' in error && typeof error.message === 'string'
          ? error.message
          : 'La API respondió con un error.'

      return reply.code(error.statusCode).send({
        message,
      })
    }

    return reply.code(500).send({
      message: 'Ocurrió un error inesperado en la API.',
    })
  })

  return app
}
