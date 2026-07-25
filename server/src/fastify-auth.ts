import 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    auth?: {
      userId: string
      branchId: string
      roles: string[]
    }
  }
}

