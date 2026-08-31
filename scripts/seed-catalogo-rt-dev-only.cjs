/**
 * ==============================================================
 *  SEED CATÁLOGO RAYEGO TECH — SOLO ENTORNO DEVELOPMENT
 *  Catálogos iniciales:
 *    - Rol TECNICO
 *    - Motivo Movimiento Inventario: CONSUMO_ORDEN_SERVICIO
 *    - 11 permisos RT (órdenes / equipos / inventario servicio /
 *      técnicos / pagos orden / reportes servicio)
 *    - 5 TiposEquipo inicial: Celular, PC, Laptop, Impresora, Audio
 *    - Config Empresa: garantia_default_dias = 30
 * ==============================================================
 *  Reglas INQUEBRANTABLES (igual que seed-dev.cjs):
 *   1. Este script SOLO corre en entorno development.
 *   2. NUNCA usa DATABASE_URL sakura (producción).
 *   3. Idempotente: si registro existe → NO insertar de nuevo.
 *   4. Todo insert usa SQL DIRECTO ($queryRawUnsafe) sin ON CONFLICT
 *      (primero SELECT existe → luego INSERT si falta).
 * ==============================================================
 */
const process = require('node:process')
const { PrismaClient } = require('@prisma/client')

const FAIL = (msg) => { console.error('\n❌ [SEED CATÁLOGO RT ABORTADO] ' + msg); process.exit(1) }

// ============================================================
// PASO 0: VALIDACIONES DE SEGURIDAD
// ============================================================
const envMode = (
  process.env.RAYEGO_ENV_MODE ||
  process.env.APP_ENV ||
  process.env.NODE_ENV ||
  ''
).toLowerCase()

if (envMode !== 'development' && envMode !== 'dev') {
  FAIL(
    `Entorno detectado='${envMode || '(vacio)'}. SOLO entorno development. ` +
      'Setea RAYEGO_ENV_MODE=development.'
  )
}
console.log('✅ Valid #1: Entorno → development')

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim()
if (!DATABASE_URL) FAIL('Falta DATABASE_URL (provisto desde .env.development)')

if (/sakura\.proxy\.rlwy\.net/i.test(DATABASE_URL)) {
  FAIL('DATABASE_URL = Postgres PRODUCCIÓN (sakura.proxy.rlwy.net). ABORTADO.')
}
const dbHostMatch = DATABASE_URL.match(/@([^/?]+)/)
const dbHost = dbHostMatch ? dbHostMatch[1] : '(desconocido)'
console.log('✅ Valid #2: BD host →', dbHost, '(no producción)')

// ============================================================
// PASO 1: Conectar Prisma + obtener empresa_id dev (1 sola empresa)
// ============================================================
const prisma = new PrismaClient()
const LOG_OK = (tit, det = '') => console.log(`  ✅ ${tit}` + (det ? ' → ' + det : ''))
const LOG_SKIP = (tit, det = '') => console.log(`  ⏭️  ${tit} — ya existe` + (det ? ' → ' + det : ''))
const LOG_INS = (tit, det = '') => console.log(`  ➕ ${tit} — insertado OK` + (det ? ' → ' + det : ''))

const sqlGetEmpresaDev = `SELECT id, razon_social, ruc FROM empresas ORDER BY created_at LIMIT 1;`

async function main () {
  let empresa = null
  try {
    const rows = await prisma.$queryRawUnsafe(sqlGetEmpresaDev)
    if (!rows || !rows.length) FAIL('No hay ninguna empresa creada. Ejecutar primero scripts/seed-dev.cjs.')
    empresa = rows[0]
    LOG_OK('Empresa DEV detectada', `${empresa.razon_social} (RUC=${empresa.ruc || 'N/D'})`)
  } catch (e) {
    FAIL('Error SELECT empresa DEV: ' + String(e && e.message || e))
  }
  const empresaId = empresa.id

  // ============================================================
  // 2. ROL TECNICO (tabla roles)
  // ============================================================
  console.log('\n--- [1/5] Rol TECNICO')
  const rolCod = 'TECNICO'
  const rolExist = await prisma.$queryRawUnsafe(
    `SELECT id FROM roles WHERE codigo = $1::varchar LIMIT 1;`, rolCod
  )
  if (rolExist && rolExist.length) {
    LOG_SKIP(`Rol ${rolCod}`)
  } else {
    await prisma.$queryRawUnsafe(`
      INSERT INTO roles (id, codigo, nombre, descripcion, activo, created_at, updated_at)
      VALUES (gen_random_uuid(), $1::varchar, $2::varchar, $3::varchar, true, NOW(), NOW());
    `, rolCod, 'Técnico', 'Perfil Técnico de Servicio Técnico RayegoTech.')
    LOG_INS(`Rol ${rolCod}`)
  }

  // ============================================================
  // 3. MOTIVO MOVIMIENTO INVENTARIO: CONSUMO_ORDEN_SERVICIO
  //    Salida para repuestos consumidos en Orden de Servicio
  // ============================================================
  console.log('\n--- [2/5] Motivo Movimiento Inventario CONSUMO_ORDEN_SERVICIO')
  const motCod = 'CONSUMO_ORDEN_SERVICIO'
  const motExist = await prisma.$queryRawUnsafe(
    `SELECT id FROM motivos_movimiento WHERE codigo = $1::varchar LIMIT 1;`, motCod
  )
  if (motExist && motExist.length) {
    LOG_SKIP(`Motivo ${motCod}`)
  } else {
    await prisma.$queryRawUnsafe(`
      INSERT INTO motivos_movimiento (id, codigo, nombre, descripcion, tipo, activo, created_at, updated_at, empresa_id)
      VALUES (gen_random_uuid(), $1::varchar, $2::varchar, $3::varchar, 'SALIDA', true, NOW(), NOW(), $4::uuid);
    `,
      motCod,
      'Consumo Orden Servicio',
      'Salida de inventario por repuesto/material consumido en Orden de Servicio Técnico.',
      empresaId
    )
    LOG_INS(`Motivo ${motCod} (SALIDA)`)
  }

  // ============================================================
  // 4. 11 PERMISOS RAYEGO TECH (catálogo permisos)
  // ============================================================
  console.log('\n--- [3/5] 11 Permisos RayegoTech catálogo')
  const PERMISOS_RT = [
    ['ordenesServicio.read',         'Órdenes Servicio — Leer',              'Ver listado/detalle de Órdenes de Servicio.'],
    ['ordenesServicio.write',        'Órdenes Servicio — Crear/Editar',      'Crear y editar Órdenes de Servicio (sin aprobar presupuesto).'],
    ['ordenesServicio.cambioEstado', 'Órdenes Servicio — Cambiar Estado',    'Avanzar estados del flujo Orden Servicio (recibido→diagnóstico→...)'],
    ['ordenesServicio.aprobar',      'Órdenes Servicio — Aprobar Presupuesto','Aprobar/rechazar el presupuesto presentado al cliente.'],
    ['equiposCliente.read',          'Equipos Cliente — Leer',               'Ver listado/detalle de equipos asociados a clientes.'],
    ['equiposCliente.write',         'Equipos Cliente — Crear/Editar',       'Registrar/editar equipos de clientes (marca, modelo, nro serie).'],
    ['inventarioServicio.write',     'Inventario Técnico — Consumir',        'Consumir/devolver repuestos y materiales desde Orden Servicio → Kardex.'],
    ['tecnicos.read',                'Técnicos — Leer',                      'Ver listado/detalle de técnicos, asignaciones y especialidades.'],
    ['tecnicos.write',               'Técnicos — Crear/Editar',              'Dar de alta/baja técnicos, editar perfil, asignar especialidades.'],
    ['pagosOrdenServicio.write',     'Pagos Órden Servicio — Registrar',     'Registrar adelantos y pagos de Órdenes Servicio integrados a Caja.'],
    ['reportesServicioTecnico.read', 'Reportes Servicio Técnico',            'Ver reportes/estadísticas de servicio técnico (productividad, tiempos, garantías).']
  ]
  let contPerm = 0
  for (const [cod, nom, desc] of PERMISOS_RT) {
    const pEx = await prisma.$queryRawUnsafe(
      `SELECT id FROM permisos WHERE codigo = $1::varchar LIMIT 1;`, cod
    )
    if (pEx && pEx.length) { LOG_SKIP(`permiso ${cod}`); continue }
    await prisma.$queryRawUnsafe(`
      INSERT INTO permisos (id, codigo, nombre, descripcion, activo, created_at, updated_at)
      VALUES (gen_random_uuid(), $1::varchar, $2::varchar, $3::varchar, true, NOW(), NOW());
    `, cod, nom, desc)
    LOG_INS(`permiso ${cod}`)
    contPerm++
  }
  if (contPerm === 0) LOG_SKIP('11 Permisos RT', 'todos ya existentes')

  // ============================================================
  // 5. 5 TIPOS EQUIPO CLIENTE INICIALES (tipos_equipo_cliente)
  //    Celular, PC de Escritorio, Laptop, Impresora, Audio
  // ============================================================
  console.log('\n--- [4/5] 5 Tipos Equipo Cliente iniciales')
  const TIPOS_EQ = [
    ['CELULAR',   'Celular',              'Teléfonos inteligentes y teléfonos básicos.', 1],
    ['PC',        'PC de Escritorio',     'Computadoras de escritorio completas y CPU sola.', 2],
    ['LAPTOP',    'Laptop',               'Notebooks, ultrabooks, portátiles.', 3],
    ['IMPRESORA', 'Impresora',            'Impresoras de todo tipo (inkjet, laser, multifunción).', 4],
    ['AUDIO',     'Equipo de Audio',      'Parlantes, auriculares, sistemas de sonido, radios.', 5]
  ]
  let contEq = 0
  for (const [cod, nom, desc, ord] of TIPOS_EQ) {
    const eqEx = await prisma.$queryRawUnsafe(`
      SELECT id FROM tipos_equipo_cliente
      WHERE empresa_id = $1::uuid AND codigo = $2::varchar LIMIT 1;
    `, empresaId, cod)
    if (eqEx && eqEx.length) { LOG_SKIP(`tipo_equipo ${cod}`); continue }
    await prisma.$queryRawUnsafe(`
      INSERT INTO tipos_equipo_cliente
        (id, empresa_id, codigo, nombre, descripcion, orden, activo, created_at, updated_at)
      VALUES (gen_random_uuid(), $1::uuid, $2::varchar, $3::varchar, $4::varchar, $5::int, true, NOW(), NOW());
    `, empresaId, cod, nom, desc, ord)
    LOG_INS(`tipo_equipo ${cod}`, nom)
    contEq++
  }
  if (contEq === 0) LOG_SKIP('5 Tipos Equipo', 'todos ya existentes')

  // ============================================================
  // 6. CONFIGURACIÓN EMPRESA: garantia_default_dias = 30
  //    clave "GARANTIA_DEFAULT_DIAS", ambito=EMPRESA, valorNumero=30
  // ============================================================
  console.log('\n--- [5/5] Configuración garantia_default_dias = 30')
  const GAR_KEY = 'GARANTIA_DEFAULT_DIAS'
  const cfgEx = await prisma.$queryRawUnsafe(`
    SELECT id FROM configuraciones
    WHERE empresa_id = $1::uuid AND ambito = 'EMPRESA' AND sucursal_id IS NULL AND clave = $2::varchar
    LIMIT 1;
  `, empresaId, GAR_KEY)
  if (cfgEx && cfgEx.length) {
    LOG_SKIP(`config ${GAR_KEY}`, 'ya existe (valor manual se respeta)')
  } else {
    await prisma.$queryRawUnsafe(`
      INSERT INTO configuraciones
        (id, empresa_id, sucursal_id, ambito, clave, valor_numero, descripcion, created_at, updated_at)
      VALUES (gen_random_uuid(), $1::uuid, NULL, 'EMPRESA', $2::varchar, 30,
              'Garantía predeterminada en días para nuevas Órdenes de Servicio (modificable por orden individual).',
              NOW(), NOW());
    `, empresaId, GAR_KEY)
    LOG_INS(`config ${GAR_KEY}`, 'valor inicial = 30 días')
  }

  // ============================================================
  // FIN OK
  // ============================================================
  console.log('\n✨ SEED CATÁLOGO RAYEGO TECH (DEV) COMPLETADO.')
  console.log('   Nada fue tocado en producción.')
}

main()
  .catch((e) => FAIL('Excepción: ' + String(e && e.stack || e.message || e)))
  .finally(async () => { await prisma.$disconnect() })
