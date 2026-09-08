import { readFileSync } from 'node:fs'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import Fastify from 'fastify'
import { ZodError } from 'zod'
import { isAllowedOrigin, serverConfig } from './config.js'
import { getAuthContext } from './lib/auth.js'
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
import { settingsRoutes } from './routes/settings.js'
import { adminPosRoutes } from './routes/admin-pos.js'
import { systemRoutes } from './routes/system.js'
import usersRoutes from './routes/users.js'
import { rtRoutes } from './routes/rt.js'

const performanceDebugConfig = (() => {
  const fallback = {
    url: 'http://127.0.0.1:7777/event',
    sessionId: 'system-performance-audit',
  }

  try {
    const content = readFileSync('.dbg/system-performance-audit.env', 'utf8')
    return {
      url: content.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || fallback.url,
      sessionId:
        content.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || fallback.sessionId,
    }
  } catch {
    return fallback
  }
})()

function reportPerformanceDebugEvent(payload: {
  runId: 'pre-fix' | 'post-fix'
  hypothesisId: string
  location: string
  msg: string
  data: Record<string, unknown>
}) {
  void fetch(performanceDebugConfig.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sessionId: performanceDebugConfig.sessionId,
      ts: Date.now(),
      ...payload,
    }),
  }).catch(() => null)
}

export function createApp() {
  const app = Fastify({
    logger: true,
  })

  app.addHook('onRequest', async (request) => {
    // #region debug-point A:api-request-start
    ;(request as typeof request & { __debugStartedAt?: number }).__debugStartedAt = Date.now()
    // #endregion
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

    try {
      await getAuthContext(request)
    } catch (error) {
      const statusCode =
        typeof (error as { statusCode?: unknown } | null)?.statusCode === 'number'
          ? ((error as { statusCode: number }).statusCode ?? 401)
          : 401
      const message =
        error instanceof Error
          ? error.message
          : statusCode === 401
            ? 'La sesión ya no es válida.'
            : 'No fue posible validar la sesión.'
      reply.code(statusCode).send({ message })
    }
  })

  app.addHook('onResponse', async (request, reply) => {
    // #region debug-point A:api-request-end
    const startedAt = (request as typeof request & { __debugStartedAt?: number }).__debugStartedAt
    const durationMs = typeof startedAt === 'number' ? Date.now() - startedAt : null
    reportPerformanceDebugEvent({
      runId: 'pre-fix',
      hypothesisId: 'A',
      location: 'server/src/app.ts:onResponse',
      msg: '[DEBUG] API endpoint timing',
      data: {
        requestId: request.id,
        method: request.method,
        url: request.url,
        route: request.routeOptions.url,
        statusCode: reply.statusCode,
        durationMs,
      },
    })
    // #endregion
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

    instance.register(settingsRoutes, {
      prefix: '/api/settings',
    })

    instance.register(auditRoutes, {
      prefix: '/api/audit',
    })

    instance.register(adminPosRoutes, {
      prefix: '/api/admin-pos',
    })

    instance.register(usersRoutes, {
      prefix: '/api/users',
    })

    instance.register(systemRoutes, {
      prefix: '/api/system',
    })

    instance.register(rtRoutes, {
      prefix: '/api/rt',
    })
  })

  app.setErrorHandler((error, _request, reply) => {
    // #region debug-point purchase-payment-advance-500.error-handler
    try {
      const debugServerUrl = process.env.DEBUG_SERVER_URL?.trim()
      const sessionId = (process.env.DEBUG_SESSION_ID ?? 'session').trim() || 'session'
      const request = _request as {
        id?: string
        method?: string
        url?: string
      }
      const statusCode =
        error instanceof ZodError
          ? 400
          : typeof error === 'object' &&
              error !== null &&
              'statusCode' in error &&
              typeof (error as { statusCode?: unknown }).statusCode === 'number'
            ? (error as { statusCode: number }).statusCode
            : 500

      if (debugServerUrl) {
        void fetch(`${debugServerUrl.replace(/\/+$/, '')}/log`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            event: 'api.error',
            statusCode,
            requestId: request.id ?? null,
            method: request.method ?? null,
            url: request.url ?? null,
            error: {
              name: (error as { name?: unknown })?.name ?? null,
              message: (error as { message?: unknown })?.message ?? null,
              stack: (error as { stack?: unknown })?.stack ?? null,
              prismaCode:
                typeof error === 'object' && error !== null && 'code' in error
                  ? (error as { code?: unknown }).code
                  : null,
              prismaMeta:
                typeof error === 'object' && error !== null && 'meta' in error
                  ? (error as { meta?: unknown }).meta
                  : null,
            },
          }),
        }).catch(() => null)
      }
    } catch {}
    // #endregion debug-point purchase-payment-advance-500.error-handler
    const requestId =
      typeof _request === 'object' &&
      _request !== null &&
      'id' in _request &&
      typeof (_request as { id?: unknown }).id === 'string'
        ? (_request as { id: string }).id
        : null
    const isDev = (process.env.NODE_ENV ?? 'development') !== 'production'
    const exposeErrors = isDev || process.env.DEBUG_EXPOSE_ERRORS?.trim().toLowerCase() === 'true'

    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: 'La solicitud contiene datos inválidos.',
        issues: error.flatten(),
        ...(requestId ? { requestId } : {}),
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
      const stack =
        exposeErrors &&
        'stack' in error &&
        typeof (error as { stack?: unknown }).stack === 'string'
          ? (error as { stack: string }).stack
          : null

      return reply.code(error.statusCode).send({
        message,
        ...(requestId ? { requestId } : {}),
        ...(stack ? { stack } : {}),
      })
    }

    const debugMessage =
      typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
        ? error.message
        : 'Ocurrió un error inesperado en la API.'
    const debugStack =
      typeof error === 'object' && error !== null && 'stack' in error && typeof error.stack === 'string'
        ? error.stack
        : null

    return reply.code(500).send({
      message: exposeErrors ? debugMessage : 'Ocurrió un error inesperado en la API.',
      ...(requestId ? { requestId } : {}),
      ...(exposeErrors && debugStack ? { stack: debugStack } : {}),
    })
  })

  return app
}
