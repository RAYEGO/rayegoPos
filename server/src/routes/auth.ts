import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  getCurrentSession,
  login,
  logout,
  requestPasswordReset,
  resetPassword,
} from '../modules/auth/auth.service.js'

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
})

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
})

export async function authRoutes(app: FastifyInstance) {
  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body)
    return login(body, request, reply)
  })

  app.get('/me', async (request, reply) => getCurrentSession(request, reply))

  app.post('/logout', async (request, reply) => logout(request, reply))

  app.post('/forgot-password', async (request, reply) => {
    const body = forgotPasswordSchema.parse(request.body)
    return requestPasswordReset(body, request, reply)
  })

  app.post('/reset-password', async (request, reply) => {
    const body = resetPasswordSchema.parse(request.body)
    return resetPassword(body, request, reply)
  })
}
