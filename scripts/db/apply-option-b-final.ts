import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const ADMIN_POS_EMAIL = 'admin.pos@rayego.pe'
const ADMIN_POS_PASSWORD = 'RayegoPOS2026!'

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
  console.log(`\n>>> Option B v2 — usuarios.empresa_id nullable + usuario ADMIN_POS demo ...`)
  await withTimeout(() => prisma.$connect(), 20000, 'connect')
  console.log(`>>> Connected.`)

  // 1) usuarios.empresa_id DROP NOT NULL (para ADMIN_POS branchless)
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE public.usuarios ALTER COLUMN empresa_id DROP NOT NULL`)
    console.log(`  [OK] usuarios.empresa_id DROP NOT NULL`)
  } catch (error) {
    console.log(`  [SKIP] alter empresa_id: ${(error as Error).message.slice(0, 140)}`)
  }

  // 2) Usuario ADMIN_POS (upsert)
  let userId: string
  const prev = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM public.usuarios WHERE email = $1 LIMIT 1`,
    ADMIN_POS_EMAIL,
  )
  if (prev[0]) {
    userId = prev[0].id
  } else {
    const passwordHash = await bcrypt.hash(ADMIN_POS_PASSWORD, 10)
    const ins = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO public.usuarios (id, username, email, password_hash, nombres, apellidos, activo, created_at, updated_at, empresa_id, sucursal_id)
       VALUES (gen_random_uuid(), 'admin.pos', $1, $2, 'Administrador', 'Plataforma', true, NOW(), NOW(), NULL, NULL)
       RETURNING id`,
      ADMIN_POS_EMAIL,
      passwordHash,
    )
    userId = ins[0].id
    console.log(`  [OK] usuario creado ${ADMIN_POS_EMAIL} (id=${userId.slice(0,8)}…).`)
  }

  // 3) Usuario_rol ADMIN_POS
  const rolAdminPos = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM public.roles WHERE codigo = 'ADMIN_POS' LIMIT 1`,
  )
  if (rolAdminPos[0]) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO public.usuario_rol (id, usuario_id, rol_id, activo, fecha_inicio, created_at, updated_at)
       VALUES (gen_random_uuid(), ${`'${userId}'::uuid`}, ${`'${rolAdminPos[0].id}'::uuid`}, true, NOW(), NOW(), NOW())
       ON CONFLICT DO NOTHING`,
    )
    console.log(`  [OK] usuario_rol ${ADMIN_POS_EMAIL} → ADMIN_POS (ON CONFLICT DO NOTHING).`)
  }

  // 4) Verificación final
  console.log(`\n>>> VERIFICACIÓN FINAL (integral multinegocio Opción B):`)
  const checks = [
    ['tipos_empresa (BOTICA/SERV)', `SELECT codigo FROM public.tipos_empresa ORDER BY codigo`],
    ['modulos catalogo (count)', `SELECT COUNT(*)::int AS n FROM public.modulos`],
    ['BOTICA habilitados (count)', `SELECT COUNT(*)::int AS n FROM public.tipo_empresa_modulo tem JOIN public.tipos_empresa te ON te.id=tem.tipo_empresa_id WHERE te.codigo='BOTICA'`],
    ['SERVICIO_TECNICO habilitados', `SELECT COUNT(*)::int AS n FROM public.tipo_empresa_modulo tem JOIN public.tipos_empresa te ON te.id=tem.tipo_empresa_id WHERE te.codigo='SERVICIO_TECNICO'`],
    ['empresas tipo_empresa_id nulls', `SELECT COUNT(*)::int AS n FROM public.empresas WHERE tipo_empresa_id IS NULL`],
    ['roles nuevos (ADMIN_POS/ALMACEN)', `SELECT codigo FROM public.roles WHERE codigo IN ('ADMIN_POS','ALMACEN') ORDER BY codigo`],
    ['permisos ADMIN_POS (count)', `SELECT COUNT(*)::int AS n FROM public.rol_permiso rp JOIN public.roles r ON r.id=rp.rol_id WHERE r.codigo='ADMIN_POS'`],
    ['admin.pos@rayego.pe: roles', `SELECT r.codigo FROM public.usuarios u JOIN public.usuario_rol ur ON ur.usuario_id=u.id JOIN public.roles r ON r.id=ur.rol_id WHERE u.email=$1`],
    ['admin.pos@rayego.pe: empresa_id', `SELECT empresa_id IS NULL AS "es_null" FROM public.usuarios WHERE email=$1`],
  ] as const
  for (const [label, sql] of checks) {
    if (label.startsWith('admin.pos@rayego.pe: roles')) {
      const r = await prisma.$queryRawUnsafe<{ codigo: string }[]>(sql as unknown as TemplateStringsArray, ADMIN_POS_EMAIL)
      console.log(`  ${label}: [${r.map((x) => x.codigo).join(', ')}]`)
    } else if (label.startsWith('admin.pos@rayego.pe: empresa_id')) {
      const r = await prisma.$queryRawUnsafe<{ es_null: boolean }[]>(sql as unknown as TemplateStringsArray, ADMIN_POS_EMAIL)
      console.log(`  ${label}: ${r[0]?.es_null ? 'NULL ✔' : 'ASIGNADO (error!)'}`)
    } else if (label.includes('count)')) {
      const r = await prisma.$queryRawUnsafe<{ n: bigint | number }[]>(sql as unknown as TemplateStringsArray)
      console.log(`  ${label}: ${r[0].n}`)
    } else {
      const r = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql as unknown as TemplateStringsArray)
      console.log(`  ${label}: [${r.map((row) => Object.values(row).join(',')).join(' / ')}]`)
    }
  }

  await prisma.$disconnect()
  console.log(`\n>>> Opción B (DB) — OK. Siguiente paso: actualizar Prisma schema Usuario.empresaId? → nullable, regenerar client, login real smoke test.`)
}

run().catch(async (err) => {
  console.error(`\n!!! FAIL:`, err)
  try {
    await prisma.$disconnect()
  } catch {
    // ignore
  }
  process.exit(1)
})
