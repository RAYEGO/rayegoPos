import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const ADMIN_POS_EMAIL = process.env.ADMIN_POS_EMAIL?.trim() || 'admin.pos@rayego.pe'
const ADMIN_POS_USERNAME = process.env.ADMIN_POS_USERNAME?.trim() || 'admin.pos'
const ADMIN_POS_PASSWORD = process.env.ADMIN_POS_PASSWORD || 'RayegoPOS2026!'

async function withTimeout<T>(fn: () => Promise<T>, ms: number, label: string): Promise<T> {
  let tid: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    tid = setTimeout(() => reject(new Error(`TIMEOUT after ${ms}ms: ${label}`)), ms)
  })
  try {
    return await Promise.race([fn(), timeout])
  } finally {
    if (tid) clearTimeout(tid)
  }
}

async function ensureAdminPosRole(): Promise<string> {
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM public.roles WHERE codigo = 'ADMIN_POS' LIMIT 1`,
  )
  if (rows[0]?.id) return rows[0].id

  const inserted = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO public.roles (id, codigo, nombre, descripcion, activo, created_at, updated_at)
     VALUES (gen_random_uuid(), 'ADMIN_POS', 'Administrador POS', 'Administrador de plataforma Rayego POS.', true, NOW(), NOW())
     RETURNING id`,
  )
  if (!inserted[0]?.id) {
    throw new Error('No se pudo crear el rol ADMIN_POS.')
  }
  return inserted[0].id
}

async function isNullableColumn(tableName: string, columnName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ is_nullable: 'YES' | 'NO' }>>(
    `SELECT is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     LIMIT 1`,
    tableName,
    columnName,
  )
  const value = rows[0]?.is_nullable
  if (!value) {
    throw new Error(`No se pudo resolver la columna public.${tableName}.${columnName}.`)
  }
  return value === 'YES'
}

async function findFallbackCompanyId(): Promise<string | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM public.empresas WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1`,
    )
    return rows[0]?.id ?? null
  } catch {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM public.empresas ORDER BY id ASC LIMIT 1`,
    )
    return rows[0]?.id ?? null
  }
}

async function findFallbackBranchId(companyId?: string | null): Promise<string | null> {
  if (companyId) {
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id
         FROM public.sucursales
         WHERE empresa_id = $1 AND deleted_at IS NULL AND activo = true
         ORDER BY created_at ASC
         LIMIT 1`,
        companyId,
      )
      return rows[0]?.id ?? null
    } catch {
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM public.sucursales WHERE empresa_id = $1 ORDER BY id ASC LIMIT 1`,
        companyId,
      )
      return rows[0]?.id ?? null
    }
  }

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM public.sucursales WHERE deleted_at IS NULL AND activo = true ORDER BY created_at ASC LIMIT 1`,
    )
    return rows[0]?.id ?? null
  } catch {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM public.sucursales ORDER BY id ASC LIMIT 1`,
    )
    return rows[0]?.id ?? null
  }
}

async function upsertAdminPosUser(): Promise<string> {
  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM public.usuarios WHERE lower(email) = lower($1) OR lower(username) = lower($2) LIMIT 1`,
    ADMIN_POS_EMAIL,
    ADMIN_POS_USERNAME,
  )

  const passwordHash = await bcrypt.hash(ADMIN_POS_PASSWORD, 10)
  const empresaIdNullable = await isNullableColumn('usuarios', 'empresa_id')
  const sucursalIdNullable = await isNullableColumn('usuarios', 'sucursal_id')

  const empresaId = empresaIdNullable ? null : await findFallbackCompanyId()
  if (!empresaIdNullable && !empresaId) {
    throw new Error('La BD exige empresa_id para usuarios. No existe ninguna empresa para asignar.')
  }

  const sucursalId = sucursalIdNullable ? null : await findFallbackBranchId(empresaId)
  if (!sucursalIdNullable && !sucursalId) {
    throw new Error('La BD exige sucursal_id para usuarios. No existe ninguna sucursal para asignar.')
  }

  if (existing[0]?.id) {
    await prisma.$executeRawUnsafe(
      `UPDATE public.usuarios
       SET email = $1,
           username = $2,
           password_hash = $3,
           nombres = 'Administrador',
           apellidos = 'Plataforma',
           activo = true,
           updated_at = NOW(),
           empresa_id = $4::uuid,
           sucursal_id = $5::uuid
       WHERE id = $6`,
      ADMIN_POS_EMAIL,
      ADMIN_POS_USERNAME,
      passwordHash,
      empresaId,
      sucursalId,
      existing[0].id,
    )
    return existing[0].id
  }

  const inserted = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO public.usuarios (id, username, email, password_hash, nombres, apellidos, activo, created_at, updated_at, empresa_id, sucursal_id)
     VALUES (gen_random_uuid(), $1, $2, $3, 'Administrador', 'Plataforma', true, NOW(), NOW(), $4::uuid, $5::uuid)
     RETURNING id`,
    ADMIN_POS_USERNAME,
    ADMIN_POS_EMAIL,
    passwordHash,
    empresaId,
    sucursalId,
  )
  if (!inserted[0]?.id) {
    throw new Error('No se pudo crear el usuario ADMIN_POS.')
  }
  return inserted[0].id
}

async function ensureUserRole(userId: string, roleId: string): Promise<void> {
  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM public.usuario_rol WHERE usuario_id = $1::uuid AND rol_id = $2::uuid LIMIT 1`,
    userId,
    roleId,
  )
  if (existing[0]?.id) {
    await prisma.$executeRawUnsafe(
      `UPDATE public.usuario_rol
       SET activo = true,
           updated_at = NOW()
       WHERE id = $1::uuid`,
      existing[0].id,
    )
    return
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO public.usuario_rol (id, usuario_id, rol_id, activo, fecha_inicio, created_at, updated_at)
     VALUES (gen_random_uuid(), $1::uuid, $2::uuid, true, NOW(), NOW(), NOW())`,
    userId,
    roleId,
  )
}

async function run() {
  console.log(`\n>>> Ensure ADMIN_POS user (no migraciones)`)
  await withTimeout(() => prisma.$connect(), 20000, 'connect')

  const roleId = await ensureAdminPosRole()
  const userId = await upsertAdminPosUser()
  await ensureUserRole(userId, roleId)

  console.log(`  [OK] Usuario ADMIN_POS listo: ${ADMIN_POS_EMAIL} (username=${ADMIN_POS_USERNAME})`)
  console.log(`  [OK] Rol asignado: ADMIN_POS`)

  await prisma.$disconnect()
  console.log(`>>> DONE.`)
}

run().catch(async (err) => {
  console.error(`\n!!! FAIL:`, err instanceof Error ? err.message : String(err))
  try {
    await prisma.$disconnect()
  } catch {
    // ignore
  }
  process.exit(1)
})
