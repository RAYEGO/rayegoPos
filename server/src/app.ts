import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import Fastify from 'fastify'
import { ZodError } from 'zod'
import { isAllowedOrigin, serverConfig } from './config.js'
import { authRoutes } from './routes/auth.js'
import { inventoryRoutes } from './routes/inventory.js'
import { purchaseRoutes } from './routes/purchases.js'
import { productRoutes } from './routes/products.js'
import { salesRoutes } from './routes/sales.js'
import { cashierRoutes } from './routes/cashier.js'

export function createApp() {
  const app = Fastify({
    logger: true,
  })

  app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true)
        return
      }

      callback(new Error('Origin not allowed'), false)
    },
    credentials: true,
  })

  app.register(jwt, {
    secret: serverConfig.jwtSecret,
  })

  app.get('/health', async () => ({
    status: 'ok',
    service: 'rayego-api',
  }))

  app.register(async (instance) => {
    instance.register(authRoutes, {
      prefix: '/api/auth',
    })

    instance.register(productRoutes, {
      prefix: '/api/products',
    })

    instance.register(inventoryRoutes, {
      prefix: '/api/inventory',
    })

    instance.register(purchaseRoutes, {
      prefix: '/api/purchases',
    })

    instance.register(salesRoutes, {
      prefix: '/api/sales',
    })

    instance.register(cashierRoutes, {
      prefix: '/api/cashier',
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
