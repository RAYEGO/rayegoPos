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
import { auditRoutes } from './routes/audit.js'
import suppliersRoutes from './routes/suppliers.js'
import customersRoutes from './routes/customers.js'
import dashboardRoutes from './routes/dashboard.js'
import reportsRoutes from './routes/reports.js'
import { implementationRoutes } from './routes/implementation.js'

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
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  app.register(jwt, {
    secret: serverConfig.jwtSecret,
  })

  app.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/api')) {
      return
    }

    if (request.url.startsWith('/api/auth/')) {
      return
    }

    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) {
      reply.code(401).send({ message: 'Sesión no disponible.' })
      return
    }

    try {
      const decoded = await request.server.jwt.verify<{
        sub: string
        typ: 'access' | 'refresh' | 'reset-password'
        branchId?: string | null
        roles?: string[]
      }>(token)

      if (decoded.typ !== 'access') {
        reply.code(401).send({ message: 'El token de acceso no es válido.' })
        return
      }

      if (!decoded.branchId) {
        reply.code(409).send({ message: 'No hay una sucursal activa en la sesión.' })
        return
      }

      request.auth = {
        userId: decoded.sub,
        branchId: decoded.branchId,
        roles: decoded.roles ?? [],
      }
    } catch {
      reply.code(401).send({ message: 'La sesión ya no es válida.' })
    }
  })

  app.get('/', async () => ({
  application: 'Rayego POS API',
  version: '1.0.0',
  environment: process.env.NODE_ENV ?? 'development',
  status: 'online',
  documentation: '/health',
  }))

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

    instance.register(suppliersRoutes, {
      prefix: '/api/suppliers',
    })

    instance.register(customersRoutes, {
      prefix: '/api/customers',
    })

    instance.register(dashboardRoutes, {
      prefix: '/api/dashboard',
    })

    instance.register(implementationRoutes, {
      prefix: '/api/implementation',
    })

    instance.register(reportsRoutes, {
      prefix: '/api/reports',
    })

    instance.register(auditRoutes, {
      prefix: '/api/audit',
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
