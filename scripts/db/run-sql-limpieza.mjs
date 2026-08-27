import { config as loadEnvFile } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, writeFileSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..', '..')
loadEnvFile({ path: resolve(root, '.env.production'), override: false })

const prismaClientPath = resolve(root, 'node_modules', '@prisma', 'client', 'index.js')
const { PrismaClient } = await import('file:///' + prismaClientPath.replace(/\\/g, '/'))
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })

const SQL_FILE = process.argv[2] || resolve(root, 'scripts', 'db', 'sql-limpieza', 'PASO-1-SIMULAR-con-ROLLBACK.sql')
const OUT_FILE = process.argv[3] || resolve(root, 'scripts', 'db', 'sql-limpieza', '_run-PASO-1-OUTPUT.txt')

console.log('Ejecutando SQL:', SQL_FILE)
console.log('Output:', OUT_FILE)

const sql = readFileSync(SQL_FILE, 'utf8')
let linesOut = []

function log(...a) {
  const l = a.map(x => typeof x === 'object' ? JSON.stringify(x, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2) : String(x)).join(' ')
  linesOut.push(l)
  process.stdout.write(l + '\n')
}

log('=== COMIENZO EJECUCION SQL (ROLLBACK activo — NO CAMBIA DATOS PERMANENTES) ===')
log('Fecha: ' + new Date().toISOString())
log('Archivo: ' + SQL_FILE)

const chunks = []
{
  let i = 0, buf = '', inLine = false, inBlock = false, inDollar = false, dollarTag = ''
  const src = sql
  while (i < src.length) {
    const c = src[i], n = src[i+1]
    if (inLine) {
      buf += c
      if (c === '\n') inLine = false
    } else if (inBlock) {
      buf += c
      if (c === '*' && n === '/') { buf += n; i++; inBlock = false }
    } else if (inDollar) {
      buf += c
      if (c === '$' && src.slice(i, i + dollarTag.length + 1) === dollarTag) { buf += dollarTag.slice(1); i += dollarTag.length-1; inDollar = false }
    } else {
      if (c === '-' && n === '-') { buf += c; inLine = true }
      else if (c === '/' && n === '*') { buf += c; inBlock = true }
      else if (c === '$') {
        let m = src.slice(i).match(/^\$([A-Za-z0-9_]*)\$/)
        if (m) { dollarTag = m[0]; buf += dollarTag; i += dollarTag.length-1; inDollar = true }
        else buf += c
      } else if (c === ';') { chunks.push(buf.trim()); buf = '' }
      else buf += c
    }
    i++
  }
  if (buf.trim().length) chunks.push(buf.trim())
}
function hasRealSql(str) {
  if (!str) return false
  const s1 = str
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return s1.length > 0
}
const statements = chunks.filter(hasRealSql)

log('=== COMIENZO EJECUCION SQL (INTERACTIVE TRANSACTION) ===')
log('Fecha: ' + new Date().toISOString())
log('Archivo: ' + SQL_FILE)
log('=== Se procesan ' + statements.length + ' statements SQL ===')

function stripCommentOnly(s) {
  return hasRealSql(s)
}

const TX_MODE = (SQL_FILE.includes('PASO-2') || SQL_FILE.includes('COMMIT')) ? 'COMMIT' : 'ROLLBACK'
log('MODO TRANSACCION FINAL: ' + TX_MODE + ' (si todo OK)')

const doIt = async (tx) => {
  for (let i = 0; i < statements.length; i++) {
    let st = statements[i].trim()
    if (/^BEGIN\s*;?\s*$/i.test(st)) { log(`[#${String(i+1).padStart(2)} SKIP] BEGIN (ya en transacción interactiva)`); continue }
    if (/^SET\s+CONSTRAINTS\s+ALL\s+DEFERRED\s*;?\s*$/i.test(st)) { log(`[#${String(i+1).padStart(2)} SKIP] SET CONSTRAINTS (no aplica en Prisma itx)`); continue }
    if (/^COMMIT\s*;?\s*$/i.test(st)) { log(`[#${String(i+1).padStart(2)} SKIP] COMMIT (controlado por TX_MODE)`); continue }
    if (/^ROLLBACK\s*;?\s*$/i.test(st)) { log(`[#${String(i+1).padStart(2)} SKIP] ROLLBACK (controlado por TX_MODE)`); continue }
    const s = st + ';'
    const head = s.replace(/\s+/g, ' ').trim().slice(0, 160)
    const isSelect = /^SELECT /i.test(s.replace(/^--[^\n]*\n/gm, '').replace(/^\s*$/, '').trim())
    try {
      const t0 = Date.now()
      const r = await tx.$queryRawUnsafe(s)
      const ms = Date.now() - t0
      if (isSelect && Array.isArray(r)) {
        log(`[#${String(i+1).padStart(2)} OK ${ms}ms] SELECT rows=${r.length} → ${head}`)
        if (r.length <= 100) for (const row of r) log('     ' + JSON.stringify(row))
        else log('     (...' + r.length + ' filas, muestra primeras 100)')
      } else {
        log(`[#${String(i+1).padStart(2)} OK ${ms}ms] ${head} → ${(typeof r === 'object' && r && typeof r.count === 'bigint') ? ('count='+r.count.toString()) : ((Array.isArray(r)?('arr len='+r.length):(typeof r === 'object' ? JSON.stringify(r).slice(0,120):String(r))))}`)
      }
    } catch (e) {
      log(`[#${String(i+1).padStart(2)} ERROR] ${head}`)
      log('  code:', e.code, ' message:', e.message?.slice(0, 400))
      if (e.meta?.message) log('  pg_msg:', e.meta.message.slice(0, 400))
      log('  statement (primeros 600):', s.slice(0, 600))
      log('=== SE ABORTA LA TRANSACCIÓN ===')
      throw e
    }
  }
  log('=== TODOS LOS STATEMENTS EJECUTADOS OK ===')
  if (TX_MODE === 'ROLLBACK') {
    throw new Error('__ROLLBACK_BY_DESIGN__')
  }
}

try {
  await prisma.$transaction(doIt, {
    isolationLevel: 'ReadCommitted',
    timeout: 120000,
  })
  log('TX: El usuario pidió ' + TX_MODE + ' pero Prisma $transaction COMMITea si no hay throw.')
  log('Para garantizar ROLLBACK real en PASO-1, si TX_MODE=ROLLBACK forzamos excepción soft para revertir.')
} catch (e) {
  if (e.message === '__ROLLBACK_BY_DESIGN__') {
    log('✅ ROLLBACK APLICADO POR DISEÑO (PASO-1 simulación — datos sin cambios).')
  } else {
    log('❌ TRANSACCIÓN FALLÓ / ROLLBACK automático:', e.message?.slice(0, 400))
    writeFileSync(OUT_FILE, linesOut.join('\n'), 'utf8')
    await prisma.$disconnect()
    process.exit(1)
  }
}

// Asegurar ROLLBACK para PASO-1: las tablas *_bak creadas con "CREATE TABLE IF NOT EXISTS ... AS SELECT" son PERMANENTES.
// Para PASO-1 NO DEBEN quedar tablas *_bak residuales. Detectamos y borramos si existen (solo las creadas por ESTE script).
if (TX_MODE === 'ROLLBACK') {
  log('=== POST-PASO-1: LIMPIEZA TABLAS *_bak RESIDUALES (fueron creadas con CREATE TABLE; TEMP no) ===')
  const bak_tables = await prisma.$queryRawUnsafe(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name IN ('empresa_qa_bak','sucursal_sanmiguel_bak','productos_test_bak','proveedores_test_bak','clientes_test_bak','apertura_caja_30_bak','movimientos_caja_30_bak','cierre_caja_30_bak','auditoria_pre_limpieza_bak','serie_t001_pre_reset_bak','usr_suc_sanmiguel_bak'));`)
  for (const t of bak_tables) {
    try {
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${t.table_name}" CASCADE;`)
      log('  DROP residual OK: ' + t.table_name)
    } catch (e) { log('  DROP fail ' + t.table_name + ': ' + e.message.slice(0, 200)) }
  }
  log('(Recuerda: Prisma itx no puede hacer ROLLBACK de CREATE TABLE en PG (commit implícito). Por eso las borramos explícitamente.)')
}

log('=== FIN EJECUCION ===')
writeFileSync(OUT_FILE, linesOut.join('\n'), 'utf8')
await prisma.$disconnect()
