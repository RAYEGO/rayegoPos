import 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    auth?: {
      userId: string
      companyId: string
      branchId: string
      roles: string[]
    }
  }
}
