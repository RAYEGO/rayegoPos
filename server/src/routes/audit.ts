import { AccionAuditoria } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createAuditEntry } from '../modules/audit/audit.service.js'
import { requirePermission } from '../lib/auth.js'
import { prisma } from '../lib/prisma.js'

const createAuditSchema = z.object({
  tabla: z.string().min(1),
  registroId: z.string().uuid(),
  accion: z.nativeEnum(AccionAuditoria),
  valorNuevo: z.record(z.string(), z.unknown()).optional(),
})

const listAuditQuerySchema = z.object({
  search: z.string().max(240).optional(),
  usuarioId: z.string().uuid().optional(),
  tabla: z.string().max(120).optional(),
  accion: z
    .union([z.nativeEnum(AccionAuditoria), z.array(z.nativeEnum(AccionAuditoria)).min(1).max(24)])
    .optional(),
  fechaDesde: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: 'Fecha desde inválida' })
    .optional(),
  fechaHasta: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: 'Fecha hasta inválida' })
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
})

export async function auditRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    await requirePermission(request, 'auditoria.read')
    const rawQuery = listAuditQuerySchema.parse(request.query)
    const normalized = {
      ...rawQuery,
      limit: rawQuery.limit ?? 50,
      offset: rawQuery.offset ?? 0,
    }

    const accionFilter =
      normalized.accion == null
        ? undefined
        : Array.isArray(normalized.accion)
          ? { in: normalized.accion }
          : { equals: normalized.accion }

    const search = normalized.search?.trim().toLowerCase()

    const usuarioSearch = search
      ? {
          OR: [
            { usuario: { is: null } },
            { usuario: { firstName: { contains: search, mode: 'insensitive' } } },
            { usuario: { lastName: { contains: search, mode: 'insensitive' } } },
            { usuario: { username: { contains: search, mode: 'insensitive' } } },
            { usuario: { email: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : undefined

    const where: any = {
      deletedAt: null,
      ...(normalized.usuarioId ? { usuarioId: normalized.usuarioId } : null),
      ...(normalized.tabla ? { tabla: { equals: normalized.tabla, mode: 'insensitive' } } : null),
      ...(accionFilter ? { accion: accionFilter } : null),
      ...(normalized.fechaDesde || normalized.fechaHasta
        ? {
            fechaEvento: {
              ...(normalized.fechaDesde ? { gte: new Date(normalized.fechaDesde) } : null),
              ...(normalized.fechaHasta ? { lte: new Date(normalized.fechaHasta) } : null),
            },
          }
        : null),
      ...(search
        ? {
            OR: [
              { tabla: { contains: search, mode: 'insensitive' } },
              ...(usuarioSearch?.OR ?? []),
            ],
          }
        : null),
    }

    const orderBy: any = { fechaEvento: 'desc' }

    const include = {
      usuario: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          email: true,
        },
      },
    }

    const [items, total] = await prisma.$transaction([
      prisma.auditoria.findMany({
        where,
        orderBy,
        include,
        take: normalized.limit,
        skip: normalized.offset,
      }),
      prisma.auditoria.count({ where }),
    ])

    return reply.code(200).send({
      items,
      total,
      limit: normalized.limit,
      offset: normalized.offset,
    })
  })

  app.post('/', async (request, reply) => {
    const body = createAuditSchema.parse(request.body)
    await createAuditEntry(body, request)
    return reply.code(204).send()
  })
}
