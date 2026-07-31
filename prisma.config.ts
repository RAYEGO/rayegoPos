import { defineConfig, env } from 'prisma/config'
import {
  loadResolvedProjectEnvironment,
  resolveProjectEnvironment,
} from './scripts/project-env.mjs'

const resolvedEnvironment = resolveProjectEnvironment()

if (!resolvedEnvironment.managedPlatform) {
  loadResolvedProjectEnvironment(resolvedEnvironment)
}

// Prisma CLI still resolves the main datasource through DATABASE_URL in some
// commands. For DEV with Supabase we remap it to DIRECT_URL here so migrate,
// db pull and related commands never hit the transaction pooler.
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
    directUrl: env('DIRECT_URL'),
  },
})
