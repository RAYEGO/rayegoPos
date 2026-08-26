import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

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

const MODULOS: Array<{ id: string; codigo: string; nombre: string; descripcion: string; icono: string; orden: number; categoria: string; activo: boolean }> = [
  { id: '10000000-0000-0000-0000-000000000001', codigo: 'dashboard', nombre: 'Dashboard', descripcion: 'Panel principal con métricas y KPIs.', icono: 'LayoutDashboard', orden: 10, categoria: 'OPERATIVO', activo: true },
  { id: '10000000-0000-0000-0000-000000000002', codigo: 'ventas', nombre: 'Ventas', descripcion: 'Registro y cobro de ventas mostrador.', icono: 'ShoppingCart', orden: 20, categoria: 'OPERATIVO', activo: true },
  { id: '10000000-0000-0000-0000-000000000003', codigo: 'compras', nombre: 'Compras', descripcion: 'Órdenes de compra y recepciones a proveedores.', icono: 'Truck', orden: 30, categoria: 'OPERATIVO', activo: true },
  { id: '10000000-0000-0000-0000-000000000004', codigo: 'productos', nombre: 'Productos', descripcion: 'Catálogo maestro de productos y servicios.', icono: 'Package', orden: 40, categoria: 'OPERATIVO', activo: true },
  { id: '10000000-0000-0000-0000-000000000005', codigo: 'inventario', nombre: 'Inventario', descripcion: 'Saldos de stock y movimientos de inventario.', icono: 'Boxes', orden: 50, categoria: 'OPERATIVO', activo: true },
  { id: '10000000-0000-0000-0000-000000000006', codigo: 'lotes', nombre: 'Lotes', descripcion: 'Gestión de lotes, vencimientos y trazabilidad.', icono: 'ClipboardList', orden: 55, categoria: 'OPERATIVO', activo: true },
  { id: '10000000-0000-0000-0000-000000000007', codigo: 'kardex', nombre: 'Kardex', descripcion: 'Kardex valorizado de productos farmacéuticos.', icono: 'BookOpen', orden: 57, categoria: 'OPERATIVO', activo: true },
  { id: '10000000-0000-0000-0000-000000000008', codigo: 'clientes', nombre: 'Clientes', descripcion: 'Registro de clientes y estado de cuenta.', icono: 'Users', orden: 60, categoria: 'GESTION', activo: true },
  { id: '10000000-0000-0000-0000-000000000009', codigo: 'proveedores', nombre: 'Proveedores', descripcion: 'Registro de proveedores y condiciones comerciales.', icono: 'Store', orden: 70, categoria: 'GESTION', activo: true },
  { id: '10000000-0000-0000-0000-000000000010', codigo: 'caja', nombre: 'Caja', descripcion: 'Apertura, cierre, movimientos y conciliación de caja.', icono: 'CreditCard', orden: 80, categoria: 'OPERATIVO', activo: true },
  { id: '10000000-0000-0000-0000-000000000011', codigo: 'usuarios', nombre: 'Usuarios', descripcion: 'Gestión de usuarios, roles y asignaciones.', icono: 'ClipboardList', orden: 90, categoria: 'GESTION', activo: true },
  { id: '10000000-0000-0000-0000-000000000012', codigo: 'sesiones', nombre: 'Sesiones', descripcion: 'Administración de sesiones activas y revocación.', icono: 'Monitor', orden: 92, categoria: 'GESTION', activo: true },
  { id: '10000000-0000-0000-0000-000000000013', codigo: 'auditoria', nombre: 'Auditoría', descripcion: 'Historial de acciones y cambios del sistema.', icono: 'FileSearch', orden: 94, categoria: 'GESTION', activo: true },
  { id: '10000000-0000-0000-0000-000000000014', codigo: 'reportes', nombre: 'Reportes', descripcion: 'Reportes operativos, financieros y gerenciales.', icono: 'BarChart3', orden: 100, categoria: 'GESTION', activo: true },
  { id: '10000000-0000-0000-0000-000000000015', codigo: 'configuracion', nombre: 'Configuración', descripcion: 'Parámetros operativos, sucursales y empresa.', icono: 'Settings', orden: 110, categoria: 'CONFIGURACION', activo: true },
  { id: '10000000-0000-0000-0000-000000000101', codigo: 'equipos', nombre: 'Equipos', descripcion: 'Registro de equipos y dispositivos de clientes.', icono: 'Server', orden: 41, categoria: 'OPERATIVO', activo: true },
  { id: '10000000-0000-0000-0000-000000000102', codigo: 'ordenes_servicio', nombre: 'Órdenes de servicio', descripcion: 'Flujo de órdenes de servicio / tickets.', icono: 'Ticket', orden: 42, categoria: 'OPERATIVO', activo: true },
  { id: '10000000-0000-0000-0000-000000000103', codigo: 'diagnostico', nombre: 'Diagnóstico', descripcion: 'Registro de diagnósticos técnicos por equipo.', icono: 'Stethoscope', orden: 43, categoria: 'OPERATIVO', activo: true },
  { id: '10000000-0000-0000-0000-000000000104', codigo: 'presupuestos', nombre: 'Presupuestos', descripcion: 'Presupuestos aprobados por cliente / orden servicio.', icono: 'FileText', orden: 44, categoria: 'OPERATIVO', activo: true },
  { id: '10000000-0000-0000-0000-000000000105', codigo: 'reparaciones', nombre: 'Reparaciones', descripcion: 'Progreso y detalle de reparaciones en curso.', icono: 'Hammer', orden: 45, categoria: 'OPERATIVO', activo: true },
  { id: '10000000-0000-0000-0000-000000000106', codigo: 'entregas', nombre: 'Entregas', descripcion: 'Entrega de equipos reparados al cliente.', icono: 'PackageCheck', orden: 46, categoria: 'OPERATIVO', activo: true },
]

const BOTICA_CODIGOS = new Set([
  'dashboard','ventas','compras','productos','inventario','lotes','kardex','clientes','proveedores','caja','usuarios','sesiones','auditoria','reportes','configuracion',
])

const SERV_CODIGOS = new Set([
  'dashboard','clientes','equipos','ordenes_servicio','diagnostico','presupuestos','reparaciones','entregas','caja','usuarios','sesiones','auditoria','reportes','configuracion',
])

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
  console.log(`\n>>> Option B (retry) — connecting...`)
  await withTimeout(() => prisma.$connect(), 20000, 'connect')
  console.log(`>>> Connected.`)

  // === 1) Arreglar defaults updated_at / created_at en tablas nuevas (migration.sql no los definió) ===
  console.log(`\n>>> (fix) defaults updated_at columnas obligatorias...`)
  for (const table of ['tipos_empresa', 'modulos', 'tipo_empresa_modulo']) {
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE public."${table}" ALTER COLUMN created_at SET DEFAULT NOW()`,
      )
      await prisma.$executeRawUnsafe(
        `ALTER TABLE public."${table}" ALTER COLUMN updated_at SET DEFAULT NOW()`,
      )
    } catch (error) {
      console.log(`  skip fix ${table}: ${(error as Error).message.slice(0, 120)}`)
    }
  }

  // === 2) TIPOS EMPRESA (idempotent) ===
  console.log(`\n>>> Tipos de empresa seed...`)
  const tiposSeed = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      codigo: 'BOTICA',
      nombre: 'Botica / Farmacia',
      descripcion: 'Negocio dedicado a la dispensación de medicamentos y productos de salud.',
      icono: 'Pill',
      color: '#2563eb',
      orden: 1,
      activo: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      codigo: 'SERVICIO_TECNICO',
      nombre: 'Servicio Técnico',
      descripcion: 'Negocio dedicado a reparación, mantenimiento y atención técnica de equipos.',
      icono: 'Wrench',
      color: '#16a34a',
      orden: 2,
      activo: true,
    },
  ]
  for (const t of tiposSeed) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO public.tipos_empresa (id, codigo, nombre, descripcion, icono, color, orden, activo, created_at, updated_at)
       VALUES (${`'${t.id}'::uuid`}, $1,$2,$3,$4,$5,$6,$7, NOW(), NOW())
       ON CONFLICT (codigo) DO NOTHING`,
      t.codigo, t.nombre, t.descripcion, t.icono, t.color, t.orden, t.activo,
    )
    console.log(`  upsert tipo ${t.codigo}`)
  }

  // === 3) Modulos catalogo ===
  console.log(`\n>>> Módulos catálogo (${MODULOS.length})...`)
  for (const m of MODULOS) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO public.modulos (id, codigo, nombre, descripcion, icono, orden, categoria, activo, created_at, updated_at)
       VALUES (${`'${m.id}'::uuid`}, $1,$2,$3,$4,$5,$6,$7, NOW(), NOW())
       ON CONFLICT (codigo) DO NOTHING`,
      m.codigo, m.nombre, m.descripcion, m.icono, m.orden, m.categoria, m.activo,
    )
  }
  console.log(`  upsert ${MODULOS.length} modulos`)

  // === 4) TipoEmpresaModulo (idempotent, join BOTICA + SERV) ===
  console.log(`\n>>> Habilitando módulos por tipo...`)
  async function enableTipoModulos(codigoTipo: string, codigosModulos: Set<string>) {
    const tipo = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM public.tipos_empresa WHERE codigo = $1 LIMIT 1`,
      codigoTipo,
    )
    if (!tipo[0]) return
    for (const codigo of codigosModulos) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO public.tipo_empresa_modulo (id, tipo_empresa_id, modulo_codigo, orden, activo, created_at, updated_at)
         SELECT gen_random_uuid(), ${`'${tipo[0].id}'::uuid`}, $1, m.orden, true, NOW(), NOW()
         FROM public.modulos m WHERE m.codigo = $1
         ON CONFLICT (tipo_empresa_id, modulo_codigo) DO NOTHING`,
        codigo,
      )
    }
  }
  await enableTipoModulos('BOTICA', BOTICA_CODIGOS)
  console.log(`  BOTICA: ${BOTICA_CODIGOS.size} módulos`)
  await enableTipoModulos('SERVICIO_TECNICO', SERV_CODIGOS)
  console.log(`  SERVICIO_TECNICO: ${SERV_CODIGOS.size} módulos`)

  // === 5) Empresas existentes: asignar tipoEmpresaId BOTICA + FK not null ===
  console.log(`\n>>> Empresas → asignar tipo BOTICA + FK not null...`)
  const tipoBotica = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM public.tipos_empresa WHERE codigo = 'BOTICA' LIMIT 1`,
  )
  if (tipoBotica[0]) {
    await prisma.$executeRawUnsafe(
      `UPDATE public.empresas SET tipo_empresa_id = ${`'${tipoBotica[0].id}'::uuid`} WHERE tipo_empresa_id IS NULL`,
    )
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE public.empresas ALTER COLUMN tipo_empresa_id SET NOT NULL`,
      )
    } catch (error) {
      console.log(`  skip alter not null: ${(error as Error).message.slice(0, 160)}`)
    }
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE public.empresas DROP CONSTRAINT IF EXISTS empresas_tipo_empresa_id_fkey`,
      )
      await prisma.$executeRawUnsafe(
        `ALTER TABLE public.empresas ADD CONSTRAINT empresas_tipo_empresa_id_fkey
         FOREIGN KEY (tipo_empresa_id) REFERENCES public.tipos_empresa(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
      )
    } catch (error) {
      console.log(`  skip FK add: ${(error as Error).message.slice(0, 160)}`)
    }
  }
  const rowEmp = await prisma.$queryRawUnsafe<{ count: bigint | number; nulos: bigint | number }[]>(
    `SELECT COUNT(*)::int AS "count",
            COUNT(CASE WHEN tipo_empresa_id IS NULL THEN 1 END)::int AS "nulos"
     FROM public.empresas`,
  )
  console.log(`  empresas con tipo: ${Number(rowEmp[0].count) - Number(rowEmp[0].nulos)} / ${rowEmp[0].count}`)

  // === 6) Marcar migración aplicada ===
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO public."_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES (gen_random_uuid(), 'sha256:option-b-manual-2026-08-26', NOW(), $1, NULL, NULL, NOW(), 1)
       ON CONFLICT DO NOTHING`,
      MIGRATION_NAME,
    )
    console.log(`\n  _prisma_migrations marca ON CONFLICT DO NOTHING insertada (${MIGRATION_NAME})`)
  } catch (error) {
    console.warn(`  warn marca _prisma_migrations: ${(error as Error).message.slice(0, 160)}`)
  }

  await delay(200)

  // === PARTE 2: Roles + usuario demo ADMIN_POS ===
  console.log(`\n>>> Roles + usuario demo ADMIN_POS...`)

  async function ensureRol(codigo: string, nombre: string, descripcion: string) {
    const find = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM public.rol WHERE codigo = $1 LIMIT 1`,
      codigo,
    )
    if (find[0]) return find[0].id
    const ins = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO public.rol (id, codigo, nombre, descripcion, activo, created_at, updated_at)
       VALUES (gen_random_uuid(), $1,$2,$3, true, NOW(), NOW())
       RETURNING id`,
      codigo,
      nombre,
      descripcion,
    )
    return ins[0].id
  }
  async function ensurePermiso(codigo: string, nombre: string, moduloCodigo: string) {
    const find = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM public.permiso WHERE codigo = $1 LIMIT 1`,
      codigo,
    )
    if (find[0]) return find[0].id
    const ins = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO public.permiso (id, codigo, nombre, modulo_codigo, descripcion, activo, created_at, updated_at)
       VALUES (gen_random_uuid(), $1,$2,$3,$4, true, NOW(), NOW())
       RETURNING id`,
      codigo,
      nombre,
      moduloCodigo,
      nombre,
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
  console.log(`  rol ADMIN_POS: ${ADMIN_POS_PERMISSIONS.length} permisos`)
  for (const codigo of ALMACEN_PERMISSIONS) {
    const pid = idPermisos.get(codigo)
    if (pid) await ensureRolPermiso(almacenRolId, pid)
  }
  console.log(`  rol ALMACEN: ${ALMACEN_PERMISSIONS.length} permisos`)

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
     VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW(), NOW())
     ON CONFLICT DO NOTHING`,
    userId,
    adminPosRolId,
  )
  console.log(`  usuario_rol asignado: ${ADMIN_POS_EMAIL} → ADMIN_POS`)

  // === Verificación final ===
  console.log(`\n>>> VERIFICACIÓN FINAL:`)
  const checks = [
    ['tipos_empresa seed', `SELECT COUNT(*)::int AS n FROM public.tipos_empresa WHERE codigo IN ('BOTICA','SERVICIO_TECNICO')`],
    ['modulos catalogo', `SELECT COUNT(*)::int AS n FROM public.modulos`],
    ['BOTICA habilitados', `SELECT COUNT(*)::int AS n FROM public.tipo_empresa_modulo tem JOIN public.tipos_empresa te ON te.id=tem.tipo_empresa_id WHERE te.codigo='BOTICA'`],
    ['SERV habilitados', `SELECT COUNT(*)::int AS n FROM public.tipo_empresa_modulo tem JOIN public.tipos_empresa te ON te.id=tem.tipo_empresa_id WHERE te.codigo='SERVICIO_TECNICO'`],
    ['empresas NULL?', `SELECT COUNT(*)::int AS n FROM public.empresas WHERE tipo_empresa_id IS NULL`],
  ] as const
  for (const [label, sql] of checks) {
    const r = await prisma.$queryRawUnsafe<{ n: bigint | number }[]>(sql)
    console.log(`  ${label}: ${r[0].n}`)
  }
  const rolesAdminPos = await prisma.$queryRawUnsafe<{ codigo: string }[]>(
    `SELECT r.codigo FROM public.usuario_rol ur JOIN public.rol r ON r.id=ur.rol_id JOIN public.usuarios u ON u.id=ur.usuario_id WHERE u.email=$1`,
    ADMIN_POS_EMAIL,
  )
  console.log(`  roles admin.pos@rayego.pe: [${rolesAdminPos.map((r) => r.codigo).join(', ')}]`)

  await prisma.$disconnect()
  console.log(`\n>>> Opción B — OK.`)
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
