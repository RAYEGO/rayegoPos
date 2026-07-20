import { AccionAuditoria } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createAuditEntry } from '../modules/audit/audit.service.js'

const createAuditSchema = z.object({
  tabla: z.string().min(1),
  registroId: z.string().uuid(),
  accion: z.nativeEnum(AccionAuditoria),
  valorNuevo: z.record(z.string(), z.unknown()).optional(),
})

export async function auditRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply) => {
    const body = createAuditSchema.parse(request.body)
    await createAuditEntry(body, request)
    return reply.code(204).send()
  })
}
