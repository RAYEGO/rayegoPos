import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { AUTH_ROLE_CODES } from '../modules/users/users.service.js'
import {
  getRolePermissionsDetail,
  listRolesForAdmin,
  updateRolePermissions,
} from '../modules/roles/roles.service.js'

const roleCodigoParamSchema = z.object({
  codigo: z.enum(AUTH_ROLE_CODES, {
    required_error: 'Rol inválido.',
  }),
})

export const rolesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => listRolesForAdmin(request))
  app.get('/list', async (request) => listRolesForAdmin(request))

  app.get('/:codigo/permissions', async (request) => {
    const params = roleCodigoParamSchema.parse(request.params)
    return getRolePermissionsDetail(params.codigo, request)
  })

  app.put('/:codigo/permissions', async (request) => {
    const params = roleCodigoParamSchema.parse(request.params)
    const body = (request.body ?? {}) as { permisos?: string[] }
    return updateRolePermissions(
      params.codigo,
      {
        codigo: params.codigo,
        permisos: Array.isArray(body.permisos) ? (body.permisos as never) : [],
      },
      request,
    )
  })
}

export default rolesRoutes
