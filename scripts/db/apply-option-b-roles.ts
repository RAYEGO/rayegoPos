import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

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
  console.log(`\n>>> Option B part 2 — roles + usuario demo ADMIN_POS ...`)
  await withTimeout(() => prisma.$connect(), 20000, 'connect')
  console.log(`>>> Connected.`)

  async function ensureRol(codigo: string, nombre: string, descripcion: string) {
    const find = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM public.roles WHERE codigo = $1 LIMIT 1`,
      codigo,
    )
    if (find[0]) return find[0].id
    const ins = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO public.roles (id, codigo, nombre, descripcion, activo, created_at, updated_at)
       VALUES (gen_random_uuid(), $1,$2,$3, true, NOW(), NOW())
       RETURNING id`,
      codigo,
      nombre,
      descripcion,
    )
    return ins[0].id
  }
  async function ensurePermiso(codigo: string, nombre: string, modulo: string) {
    const find = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM public.permisos WHERE codigo = $1 LIMIT 1`,
      codigo,
    )
    if (find[0]) return find[0].id
    const ins = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO public.permisos (id, codigo, modulo, nombre, descripcion, activo, created_at, updated_at)
       VALUES (gen_random_uuid(), $1,$2,$3,$4, true, NOW(), NOW())
       RETURNING id`,
      codigo,
      modulo,
      nombre,
      nombre,
    )
    return ins[0].id
  }
  async function ensureRolPermiso(rolId: string, permisoId: string) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO public.rol_permiso (id, rol_id, permiso_id, created_at, updated_at)
       VALUES (gen_random_uuid(), ${`'${rolId}'::uuid`}, ${`'${permisoId}'::uuid`}, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
    )
  }

  const adminPosRolId = await ensureRol('ADMIN_POS', 'Administrador POS', 'Administrador de plataforma Rayego POS.')
  const almacenRolId = await ensureRol('ALMACEN', 'Almacén', 'Rol operativo de almacén e inventario.')

  const permisosCatalogo: Array<{ codigo: string; nombre: string; modulo: string }> = [
    { codigo: 'dashboard.read', nombre: 'Ver dashboard', modulo: 'GENERAL' },
    { codigo: 'ventas.read', nombre: 'Ver ventas', modulo: 'OPERATIVO' },
    { codigo: 'productos.read', nombre: 'Ver productos', modulo: 'OPERATIVO' },
    { codigo: 'compras.read', nombre: 'Ver compras', modulo: 'OPERATIVO' },
    { codigo: 'inventario.read', nombre: 'Ver inventario', modulo: 'OPERATIVO' },
    { codigo: 'clientes.read', nombre: 'Ver clientes', modulo: 'GESTION' },
    { codigo: 'proveedores.read', nombre: 'Ver proveedores', modulo: 'GESTION' },
    { codigo: 'caja.read', nombre: 'Ver caja', modulo: 'OPERATIVO' },
    { codigo: 'usuarios.read', nombre: 'Ver usuarios', modulo: 'SEGURIDAD' },
    { codigo: 'usuarios.manage', nombre: 'Gestionar usuarios', modulo: 'SEGURIDAD' },
    { codigo: 'sesiones.read', nombre: 'Ver sesiones', modulo: 'SEGURIDAD' },
    { codigo: 'sesiones.revoke', nombre: 'Revocar sesiones', modulo: 'SEGURIDAD' },
    { codigo: 'auditoria.read', nombre: 'Ver auditoría', modulo: 'SEGURIDAD' },
    { codigo: 'reportes.read', nombre: 'Ver reportes', modulo: 'REPORTES' },
    { codigo: 'configuracion.read', nombre: 'Ver configuración', modulo: 'CONFIGURACION' },
    { codigo: 'tipos_empresa.manage', nombre: 'Gestionar tipos de empresa', modulo: 'ADMIN_POS' },
    { codigo: 'empresas.read', nombre: 'Ver empresas', modulo: 'ADMIN_POS' },
    { codigo: 'empresas.manage', nombre: 'Gestionar empresas', modulo: 'ADMIN_POS' },
    { codigo: 'administradores.manage', nombre: 'Gestionar administradores', modulo: 'ADMIN_POS' },
  ]

  const idPermisos = new Map<string, string>()
  for (const p of permisosCatalogo) {
    idPermisos.set(p.codigo, await ensurePermiso(p.codigo, p.nombre, p.modulo))
  }
  for (const codigo of ADMIN_POS_PERMISSIONS) {
    const pid = idPermisos.get(codigo)
    if (pid) await ensureRolPermiso(adminPosRolId, pid)
  }
  console.log(`  rol ADMIN_POS: ${ADMIN_POS_PERMISSIONS.length} permisos asignados (id ${adminPosRolId.slice(0, 8)}…).`)
  for (const codigo of ALMACEN_PERMISSIONS) {
    const pid = idPermisos.get(codigo)
    if (pid) await ensureRolPermiso(almacenRolId, pid)
  }
  console.log(`  rol ALMACEN: ${ALMACEN_PERMISSIONS.length} permisos.`)

  // Usuario demo ADMIN_POS
  let userId: string
  const prevUser = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM public.usuarios WHERE email = $1 LIMIT 1`,
    ADMIN_POS_EMAIL,
  )
  if (prevUser[0]) {
    userId = prevUser[0].id
  } else {
    const passwordHash = await bcrypt.hash(ADMIN_POS_PASSWORD, 10)
    const ins = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO public.usuarios (id, email, password_hash, nombre, apellido_paterno, username, activo, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'Administrador', 'Plataforma', 'admin.pos', true, NOW(), NOW())
       RETURNING id`,
      ADMIN_POS_EMAIL,
      passwordHash,
    )
    userId = ins[0].id
    console.log(`  usuario ${ADMIN_POS_EMAIL} creado.`)
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO public.usuario_rol (id, usuario_id, rol_id, activo, fecha_inicio, created_at, updated_at)
     VALUES (gen_random_uuid(), ${`'${userId}'::uuid`}, ${`'${adminPosRolId}'::uuid`}, true, NOW(), NOW(), NOW())
     ON CONFLICT DO NOTHING`,
  )
  console.log(`  usuario_rol asignado: ${ADMIN_POS_EMAIL} → ADMIN_POS (ON CONFLICT DO NOTHING).`)

  // Verificación final
  console.log(`\n>>> VERIFICACIÓN FINAL (PARTE 2):`)
  const checks = [
    ['roles ADMIN_POS+ALMACEN', `SELECT COUNT(*)::int AS n FROM public.roles WHERE codigo IN ('ADMIN_POS','ALMACEN')`],
    ['permisos catalogo totales', `SELECT COUNT(*)::int AS n FROM public.permisos WHERE codigo LIKE ANY(ARRAY['%.read','%.manage','%.revoke'])`],
    ['admin.pos@rayego.pe rol', `SELECT r.codigo FROM public.usuarios u JOIN public.usuario_rol ur ON ur.usuario_id=u.id JOIN public.roles r ON r.id=ur.rol_id WHERE u.email=$1`],
  ] as const
  for (const [label, sql] of checks) {
    if (label.startsWith('admin.pos@')) {
      const r = await prisma.$queryRawUnsafe<{ codigo: string }[]>(sql as unknown as TemplateStringsArray, ADMIN_POS_EMAIL)
      console.log(`  ${label}: [${r.map((x) => x.codigo).join(', ')}]`)
    } else {
      const r = await prisma.$queryRawUnsafe<{ n: bigint | number }[]>(sql as unknown as TemplateStringsArray)
      console.log(`  ${label}: ${r[0].n}`)
    }
  }

  await prisma.$disconnect()
  console.log(`\n>>> Opción B parte 2 — OK.`)
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
