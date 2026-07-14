import { PrismaClient } from '@prisma/client'

declare global {
  var __rayegoPrisma__: PrismaClient | undefined
}

export const prisma =
  globalThis.__rayegoPrisma__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__rayegoPrisma__ = prisma
}
