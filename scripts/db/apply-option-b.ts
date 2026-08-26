import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const prisma = new PrismaClient()

const MIGRATION_NAME = '20260825230000_add_tipo_empresa_modulos'
const ADMIN_POS_EMAIL = 'admin.pos@rayego.pe'
const ADMIN_POS_PASSWORD = 'RayegoPOS2026!'

const ADMIN_POS_PERMISSIONS = [
  'dashboard.read',
  'tipos_empresa.manage',
  'empresas.read',
  'empresas.manage',
  'administradores.manage',
  'usuarios.read',
  'usuarios.manage',
  'sesiones.read',
  'sesiones.revoke',
  'auditoria.read',
  'reportes.read',
  'configuracion.read',
] as const

const ALMACEN_PERMISSIONS = [
  'dashboard.read',
  'productos.read',
  'compras.read',
  'inventario.read',
  'proveedores.read',
] as const

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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

async function run() {
  console.log(`\n>>> Connecting to DB...`)
  await withTimeout(async () => prisma.$connect(), 20000, 'prisma.$connect')
  console.log('>>> Connected.')

  // 1) Verificar si la migración ya está marcada aplicada
  const migrationsTableExists = await withTimeout(
    () =>
      prisma.$queryRawUnsafe<{ exists: boolean }[]>(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='_prisma_migrations') AS "exists"`,
      ),
    15000,
    `check _prisma_migrations exists`,
  )
  console.log(`_prisma_migrations exists: ${migrationsTableExists[0]?.exists}`)

  let migrationAlreadyApplied = false
  if (migrationsTableExists[0]?.exists) {
    const applied = await withTimeout(
      () =>
        prisma.$queryRawUnsafe<{ count: bigint | number }[]>(
          `SELECT COUNT(*)::int AS "count" FROM public."_prisma_migrations" WHERE migration_name = $1`,
          MIGRATION_NAME,
        ),
      15000,
      `check migration ${MIGRATION_NAME} applied`,
    )
    migrationAlreadyApplied = Number(applied[0]?.count ?? 0) > 0
  }
  console.log(`[mig-1] ${MIGRATION_NAME} already applied? ${migrationAlreadyApplied}`)

  // 2) Verificar si la columna ya existe (aplicada parcialmente sin marcar)
  const columnCheck = await withTimeout(
    () =>
      prisma.$queryRawUnsafe<{ count: bigint | number }[]>(
        `SELECT COUNT(*)::int AS "count" FROM information_schema.columns WHERE table_schema='public' AND table_name='empresas' AND column_name='tipo_empresa_id'`,
      ),
    15000,
    `check column empresas.tipo_empresa_id exists`,
  )
  const columnExists = Number(columnCheck[0]?.count ?? 0) > 0
  console.log(`[mig-1] column empresas.tipo_empresa_id exists: ${columnExists}`)

  const tiposEmpresaExists = await withTimeout(
    () =>
      prisma.$queryRawUnsafe<{ exists: boolean }[]>(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tipos_empresa') AS "exists"`,
      ),
    15000,
    `check tipos_empresa table`,
  )
  console.log(`[mig-1] table tipos_empresa exists: ${tiposEmpresaExists[0]?.exists}`)

  if (!migrationAlreadyApplied && !tiposEmpresaExists[0]?.exists) {
    console.log(`\n>>> Running migration SQL: ${MIGRATION_NAME} ...`)
    const migrationFile = path.resolve(
      __dirname,
      '..',
      '..',
      'prisma',
      'migrations',
      MIGRATION_NAME,
      'migration.sql',
    )
    let migrationSql = readFileSync(migrationFile, 'utf8')
    // Quitar comments y separar por punto y coma simple (en strings no hay ;)
    migrationSql = migrationSql.replace(/^\s*--.*$/gm, '')
    // Nota: la migración NO tiene strings con ';' internos. Separar.
    const statements = migrationSql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 5)

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i]
      try {
        await withTimeout(
          async () => prisma.$executeRawUnsafe(stmt),
          20000,
          `migration stmt #${i + 1}/${statements.length}`,
        )
        console.log(`  [OK #${i + 1}/${statements.length}] ${stmt.slice(0, 90).replace(/\s+/g, ' ')}...`)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        if (/already exists|duplicate key|constraint|does not exist/i.test(msg) && /IF NOT EXISTS|ADD COLUMN|CREATE UNIQUE INDEX|CREATE INDEX|ON CONFLICT|DROP CONSTRAINT/i.test(stmt)) {
          console.log(`  [SKIP #${i + 1}] ${msg.slice(0, 180)}`)
        } else {
          console.error(`  [FAIL #${i + 1}] ${msg}`)
          console.error(`     stmt: ${stmt.slice(0, 260)}`)
          throw error
        }
      }
    }
  } else {
    console.log(`\n>>> Migration ${MIGRATION_NAME} SQL data (tablas/columnas) ya aplicada; skip ejecución SQL.`)
  }

  // Marcar como aplicada en _prisma_migrations si hace falta (no migración programática; solo insert)
  if (!migrationAlreadyApplied && migrationsTableExists[0]?.exists) {
    try {
      const checksum = 'sha256:multinegocio-20260825230000-manual'
      await prisma.$executeRawUnsafe(
        `INSERT INTO public."_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
         VALUES (gen_random_uuid(), $1, NOW(), $2, NULL, NULL, NOW(), 1)
         ON CONFLICT DO NOTHING`,
        checksum,
        MIGRATION_NAME,
      )
      console.log(`[mig-1] Marca en _prisma_migrations insertada (ON CONFLICT DO NOTHING).`)
    } catch (error) {
      console.warn(`[mig-1] Warning al marcar en _prisma_migrations: ${(error as Error).message}`)
    }
  }

  await delay(300)

  // ============================================================
  // PARTE 2: Roles (ADMIN_POS + ALMACEN) + ADMIN_POS usuario demo
  // ============================================================
  console.log(`\n>>> Parte 2: Roles + permisos + usuario demo ADMIN_POS ...`)

  async function ensureRol(codigo: string, label: string, descripcion: string) {
    let rolId: string
    const find = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM public.rol WHERE codigo = $1 LIMIT 1`,
      codigo,
    )
    if (find[0]) {
      rolId = find[0].id
      console.log(`  rol ${codigo}: exists (id=${rolId.slice(0, 8)}…).`)
    } else {
      const ins = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `INSERT INTO public.rol (id, codigo, nombre, descripcion, activo, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW())
         RETURNING id`,
        codigo,
        label,
        descripcion,
      )
      rolId = ins[0].id
      console.log(`  rol ${codigo}: created (id=${rolId.slice(0, 8)}…).`)
    }
    return rolId
  }

  async function ensurePermiso(codigo: string, label: string, moduloCodigo: string) {
    const find = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM public.permiso WHERE codigo = $1 LIMIT 1`,
      codigo,
    )
    if (find[0]) return find[0].id
    const ins = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO public.permiso (id, codigo, nombre, modulo_codigo, descripcion, activo, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $2, true, NOW(), NOW())
       RETURNING id`,
      codigo,
      label,
      moduloCodigo,
    )
    return ins[0].id
  }

  async function ensureRolPermiso(rolId: string, permisoId: string) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO public.rol_permiso (id, rol_id, permiso_id, activo, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      rolId,
      permisoId,
    )
  }

  const adminPosRolId = await ensureRol(
    'ADMIN_POS',
    'Administrador POS',
    'Administrador de plataforma Rayego POS.',
  )
  await ensureRol(
    'ALMACEN',
    'Almacén',
    'Rol operativo encargado de almacén e inventario.',
  )

  const permisosToEnsure: Record<string, { label: string; modulo: string }> = {
    'dashboard.read': { label: 'Ver dashboard', modulo: 'GENERAL' },
    'tipos_empresa.manage': { label: 'Gestionar tipos de empresa', modulo: 'ADMIN_POS' },
    'empresas.read': { label: 'Ver empresas', modulo: 'ADMIN_POS' },
    'empresas.manage': { label: 'Gestionar empresas', modulo: 'ADMIN_POS' },
    'administradores.manage': { label: 'Gestionar administradores', modulo: 'ADMIN_POS' },
    'usuarios.read': { label: 'Ver usuarios', modulo: 'SEGURIDAD' },
    'usuarios.manage': { label: 'Gestionar usuarios', modulo: 'SEGURIDAD' },
    'sesiones.read': { label: 'Ver sesiones', modulo: 'SEGURIDAD' },
    'sesiones.revoke': { label: 'Revocar sesiones', modulo: 'SEGURIDAD' },
    'auditoria.read': { label: 'Ver auditoría', modulo: 'SEGURIDAD' },
    'reportes.read': { label: 'Ver reportes', modulo: 'REPORTES' },
    'configuracion.read': { label: 'Ver configuración', modulo: 'CONFIGURACION' },
    'ventas.read': { label: 'Ver ventas', modulo: 'OPERATIVO' },
    'productos.read': { label: 'Ver productos', modulo: 'OPERATIVO' },
    'compras.read': { label: 'Ver compras', modulo: 'OPERATIVO' },
    'inventario.read': { label: 'Ver inventario', modulo: 'OPERATIVO' },
    'clientes.read': { label: 'Ver clientes', modulo: 'GESTION' },
    'proveedores.read': { label: 'Ver proveedores', modulo: 'GESTION' },
    'caja.read': { label: 'Ver caja', modulo: 'OPERATIVO' },
  }

  const permisoIds = new Map<string, string>()
  for (const [codigo, info] of Object.entries(permisosToEnsure)) {
    const id = await ensurePermiso(codigo, info.label, info.modulo)
    permisoIds.set(codigo, id)
  }

  // ADMIN_POS permisos
  for (const codigo of ADMIN_POS_PERMISSIONS) {
    const permisoId = permisoIds.get(codigo)
    if (permisoId) await ensureRolPermiso(adminPosRolId, permisoId)
  }
  console.log(`  rol ADMIN_POS: ${ADMIN_POS_PERMISSIONS.length} permisos garantizados.`)

  // ALMACEN permisos (si rol vacío)
  for (const codigo of ALMACEN_PERMISSIONS) {
    const permisoId = permisoIds.get(codigo)
    if (permisoId) {
      const findAlmacen = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM public.rol WHERE codigo = 'ALMACEN' LIMIT 1`,
      )
      if (findAlmacen[0]) await ensureRolPermiso(findAlmacen[0].id, permisoId)
    }
  }
  console.log(`  rol ALMACEN: ${ALMACEN_PERMISSIONS.length} permisos garantizados.`)

  // ============================================================
  // PARTE 3: Usuario demo ADMIN_POS (admin.pos@rayego.pe)
  // ============================================================
  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM public.usuarios WHERE email = $1 LIMIT 1`,
    ADMIN_POS_EMAIL,
  )
  let adminPosUserId: string
  if (existing[0]) {
    adminPosUserId = existing[0].id
    console.log(`  usuario ${ADMIN_POS_EMAIL}: exists (id=${adminPosUserId.slice(0, 8)}…).`)
  } else {
    const passwordHash = await bcrypt.hash(ADMIN_POS_PASSWORD, 10)
    const ins = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO public.usuarios (id, email, password_hash, nombre, apellido_paterno, username, activo, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'Administrador', 'Plataforma', 'admin.pos', true, NOW(), NOW())
       RETURNING id`,
      ADMIN_POS_EMAIL,
      passwordHash,
    )
    adminPosUserId = ins[0].id
    console.log(`  usuario ${ADMIN_POS_EMAIL}: created (id=${adminPosUserId.slice(0, 8)}…).`)
  }

  // Asignar global (usuario_rol) ADMIN_POS
  await prisma.$executeRawUnsafe(
    `INSERT INTO public.usuario_rol (id, usuario_id, rol_id, activo, fecha_inicio, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW(), NOW())
     ON CONFLICT DO NOTHING`,
    adminPosUserId,
    adminPosRolId,
  )
  console.log(`  usuario_rol ADMIN_POS asignado (ON CONFLICT DO NOTHING).`)

  // NO usuario_sucursal, NO empresa.
  console.log(`\n>>> TODO OK. Verificaciones:`)

  const rowTipo = await prisma.$queryRawUnsafe<{ count: bigint | number }[]>(
    `SELECT COUNT(*)::int AS "count" FROM public.tipos_empresa WHERE codigo IN ('BOTICA','SERVICIO_TECNICO')`,
  )
  console.log(`  - tipos_empresa (BOTICA+SERV): ${rowTipo[0].count}`)

  const rowMod = await prisma.$queryRawUnsafe<{ count: bigint | number }[]>(
    `SELECT COUNT(*)::int AS "count" FROM public.modulos`,
  )
  console.log(`  - modulos catálogo: ${rowMod[0].count}`)

  const rowBotica = await prisma.$queryRawUnsafe<{ count: bigint | number }[]>(
    `SELECT COUNT(*)::int AS "count"
     FROM public.tipo_empresa_modulo tem
     JOIN public.tipos_empresa te ON te.id = tem.tipo_empresa_id
     WHERE te.codigo = 'BOTICA'`,
  )
  console.log(`  - tipo_empresa_modulo (BOTICA habilitados): ${rowBotica[0].count}`)

  const rowEmp = await prisma.$queryRawUnsafe<{ count: bigint | number; nulos: bigint | number }[]>(
    `SELECT COUNT(*)::int AS "count",
            COUNT(CASE WHEN tipo_empresa_id IS NULL THEN 1 END)::int AS "nulos"
     FROM public.empresas`,
  )
  console.log(`  - empresas con tipo_empresa_id asignado: ${Number(rowEmp[0].count) - Number(rowEmp[0].nulos)} / ${rowEmp[0].count}`)

  const rUsuario = await prisma.$queryRawUnsafe<{ r: string }[]>(
    `SELECT r.codigo AS "r"
     FROM public.usuario_rol ur
     JOIN public.rol r ON r.id = ur.rol_id
     JOIN public.usuarios u ON u.id = ur.usuario_id
     WHERE u.email = $1`,
    ADMIN_POS_EMAIL,
  )
  console.log(`  - roles demo admin.pos@: [${rUsuario.map((r) => r.r).join(', ')}]`)

  await prisma.$disconnect()
  console.log(`\n>>> DONE.`)
}

run().catch(async (error) => {
  console.error(`\n!!! FAIL OPTION B:`, error)
  try {
    await prisma.$disconnect()
  } catch {
    // ignore
  }
  process.exit(1)
})
