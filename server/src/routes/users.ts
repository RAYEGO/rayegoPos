import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import {
  createUser,
  createUserSchema,
  listUsersForCompany,
  updateUser,
  updateUserSchema,
} from '../modules/users/users.service.js'

const userIdParamSchema = z.object({
  id: z.string().uuid('Usuario inválido.'),
})

export const usersRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => listUsersForCompany(request))

  app.post('/', async (request) => {
    const body = createUserSchema.parse(request.body)
    return createUser(body, request)
  })

  app.put('/:id', async (request) => {
    const params = userIdParamSchema.parse(request.params)
    const body = updateUserSchema.parse(request.body)
    return updateUser(params.id, body, request)
  })
}

export default usersRoutes
