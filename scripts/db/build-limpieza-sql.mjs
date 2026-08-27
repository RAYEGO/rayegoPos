import { config as loadEnvFile } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..', '..')
loadEnvFile({ path: resolve(root, '.env.production'), override: false })

const prismaClientPath = resolve(root, 'node_modules', '@prisma', 'client', 'index.js')
const { PrismaClient } = await import('file:///' + prismaClientPath.replace(/\\/g, '/'))
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })

const outDir = resolve(root, 'scripts', 'db', 'sql-limpieza')
mkdirSync(outDir, { recursive: true })

async function cols(table) {
  const r = await prisma.$queryRawUnsafe(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1;`, table)
  return r
}
async function pick(table, where, params, limit=50) {
  const cs = await cols(table)
  const sel = cs.map(c => `"${c.column_name}"`).join(',')
  return await prisma.$queryRawUnsafe(`SELECT ${sel} FROM "${table}" ${where} LIMIT ${limit};`, ...(params||[]))
}

const QA = (await pick('empresas', `WHERE razon_social ILIKE '%QA Rayego%' AND deleted_at IS NULL`, [], 1))[0]
const SM = (await pick('sucursales', `WHERE (codigo = 'SECUNDARIA' OR nombre ILIKE '%San Miguel%') AND deleted_at IS NULL`, [], 1))[0]

async function findBy(table, clauseArr, params, limit=50) {
  const cs = await cols(table)
  const sel = cs.map(c => `"${c.column_name}"`).join(',')
  const where = clauseArr.length ? ('WHERE ' + clauseArr.join(' AND ') + ' AND deleted_at IS NULL') : 'WHERE deleted_at IS NULL'
  return await prisma.$queryRawUnsafe(`SELECT ${sel} FROM "${table}" ${where} LIMIT ${limit};`, ...(params||[]))
}
const PROD_TEST = await findBy('productos', [`sku ILIKE 'TEST%' OR sku ILIKE '%612442%' OR nombre ILIKE '%Test%' OR nombre ILIKE '%612442%'`], [])
const PROV_TEST = await findBy('proveedores', [`razon_social ILIKE '%Test%' OR razon_social ILIKE '%680759%' OR numero_documento ILIKE '%680759%' OR email ILIKE '%@test.%'`], [])
const CLI_TEST  = await findBy('clientes',    [`nombre_completo ILIKE '%Test%' OR nombre_completo ILIKE '%680759%' OR numero_documento ILIKE '%680759%'`], [])

const APERTURA = (await pick('apertura_caja', `WHERE estado = 'ABIERTA' AND deleted_at IS NULL ORDER BY created_at ASC`, [], 1))[0]
const SERIE_T001 = (await pick('series_documentos', `WHERE serie='T001' AND deleted_at IS NULL`, [], 1))[0]
const USR_ADMIN = (await pick('usuarios', `WHERE username='@admin' AND deleted_at IS NULL`, [], 1))[0]
const CAJA_DEF = (await pick('cajas', `WHERE codigo='CAJA-001' AND deleted_at IS NULL`, [], 1))[0]

const AP_COLS = await cols('apertura_caja')
const apCol = (name, alt) => (AP_COLS.find(c=>c.column_name===name)?name:alt)
const MC_COLS = await cols('movimientos_caja')
const CC_COLS = await cols('cierre_caja')
const SUC_COL = (() => { const r = AP_COLS.find(c=>c.column_name==='sucursal_id'); return r ? 'sucursal_id' : null })()

const IDs = {
  QA_ID: QA?.id,
  SM_ID: SM?.id,
  PROD_IDS: PROD_TEST.map(p => p.id),
  PROV_IDS: PROV_TEST.map(p => p.id),
  CLI_IDS: CLI_TEST.map(p => p.id),
  AP_ID: APERTURA?.id,
  AP_FONDO: APERTURA?.fondo_efectivo ?? 30,
  AP_CAJA_ID: APERTURA?.caja_id ?? CAJA_DEF?.id,
  AP_SUC_ID: SUC_COL ? APERTURA?.sucursal_id : null,
  AP_USR_ID: (APERTURA?.usuario_apertura_id || APERTURA?.usuario_id || USR_ADMIN?.id),
  T001_ID: SERIE_T001?.id,
}
if (SM?.id) {
  const usrs = await prisma.$queryRawUnsafe(`SELECT usuario_id FROM usuario_sucursal WHERE sucursal_id=$1::uuid AND deleted_at IS NULL;`, SM.id)
  IDs.SM_USRS = usrs.map(x => x.usuario_id)
}
await prisma.$disconnect()

function l(arr) { return arr.map(id => `'${id}'::uuid`).join(',') }
function wrapId(uuid) { return uuid ? `'${uuid}'::uuid` : 'NULL' }

function col(table_cols, name, fallback, cast='') {
  const f = table_cols.find(c=>c.column_name===name)
  return f ? `"${name}"${cast}` : (fallback ?? `NULL${cast}`)
}

const Q = (fallbackStr) => fallbackStr

const colCC = (n) => { const f = CC_COLS.find(c=>c.column_name===n); return f ? `"${n}"` : null }

function hasCC(n) { return !!CC_COLS.find(c=>c.column_name===n) }
function hasCol(table_cols, n) { return !!table_cols.find(c=>c.column_name===n) }

async function colExists(table, name) {
  const r = await prisma.$queryRawUnsafe(`SELECT 1::int c FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2;`, table, name)
  return Array.isArray(r) && r.length > 0
}

const USR_COLS = await cols('usuarios')

const setNullSucPrincipalSql = (() => {
  if (!IDs.SM_ID) return '-- (sin sucursal SM)'
  if (hasCol(USR_COLS, 'sucursal_principal_id')) {
    return `UPDATE usuarios SET sucursal_principal_id = NULL WHERE sucursal_principal_id = ${wrapId(IDs.SM_ID)} AND deleted_at IS NULL;`
  }
  if (hasCol(USR_COLS, 'sucursal_id')) {
    return `UPDATE usuarios SET sucursal_id = NULL WHERE sucursal_id = ${wrapId(IDs.SM_ID)} AND deleted_at IS NULL;`
  }
  return '-- (la tabla usuarios no tiene sucursal_principal_id ni sucursal_id — SKIP)'
})()

const TE_COLS = await cols('tipos_empresa')
const TEM_COLS = await cols('tipo_empresa_modulo')
const TE_FK = hasCol(TE_COLS,'empresa_id') ? 'empresa_id' : (hasCol(TE_COLS,'empresas_id')?'empresas_id':null)
const QA_softSql = (() => {
  if (!IDs.QA_ID) return '-- (sin empresa QA; omitido)'
  const parts = []
  if (TE_FK) {
    parts.push(`DELETE FROM tipo_empresa_modulo WHERE tipo_empresa_id IN (SELECT id FROM tipos_empresa WHERE "${TE_FK}" = ${wrapId(IDs.QA_ID)} AND deleted_at IS NULL);`)
    parts.push(`DELETE FROM tipos_empresa WHERE "${TE_FK}" = ${wrapId(IDs.QA_ID)} AND deleted_at IS NULL;`)
  } else {
    parts.push('-- No existe col empresa_id en tipos_empresa; SKIP limpieza tipos_empresa.')
  }
  parts.push(`UPDATE empresas SET activo = false, deleted_at = NOW(), updated_at = NOW() WHERE id = ${wrapId(IDs.QA_ID)};`)
  return parts.join('\n')
})()

const cierreSql = (() => {
  if (!IDs.AP_ID) return '-- (sin caja abierta; paso 2.1 omitido)'
  const colVal = []
  const addCol = (colNameCandidates, valueSql) => {
    const hit = Array.isArray(colNameCandidates)
      ? colNameCandidates.find(c => hasCC(c))
      : (hasCC(colNameCandidates) ? colNameCandidates : null)
    if (hit) colVal.push([hit, valueSql])
  }
  addCol('id', `gen_random_uuid()`)
  addCol('apertura_caja_id', wrapId(IDs.AP_ID))
  addCol('caja_id', wrapId(IDs.AP_CAJA_ID))
  addCol('sucursal_id', SUC_COL ? wrapId(IDs.AP_SUC_ID) : 'NULL')
  addCol(['usuario_cierre_id','usuario_id'], wrapId(IDs.AP_USR_ID))
  addCol(['fecha_cierre','fecha'], `NOW()`)
  addCol(['monto_declarado_efectivo','monto_declarado'], `((${IDs.AP_FONDO}::numeric(12,2)))`)
  addCol(['monto_sistema_efectivo','monto_sistema'], `((${IDs.AP_FONDO}::numeric(12,2)))`)
  addCol(['diferencia_efectivo','diferencia'], `(0::numeric(12,2))`)
  addCol('estado', `'CERRADO'::text`)
  addCol('observaciones', `('Cierre de limpieza pre-produccion (fondo inicial prueba S/ ${IDs.AP_FONDO})')`)
  addCol('created_at', `NOW()`)
  addCol('updated_at', `NOW()`)
  addCol('deleted_at', `NULL`)
  const cols = colVal.map(x => x[0]).join(', ')
  const vals = colVal.map(x => x[1] + ' AS ' + x[0]).join(', ')
  return `
-- 2.1.1 Insertar cierre lógico formal (monto declarado = sistema, dif 0)
INSERT INTO cierre_caja (${cols})
SELECT ${vals}
FROM apertura_caja a WHERE a.id = ${wrapId(IDs.AP_ID)};

-- 2.1.2 Backup del cierre recién insertado (trazabilidad)
INSERT INTO cierre_caja_30_bak SELECT * FROM cierre_caja WHERE apertura_caja_id = ${wrapId(IDs.AP_ID)};

-- 2.1.3 Actualizar estado apertura (ahora está cerrada lógicamente)
UPDATE apertura_caja SET estado='CERRADA'${AP_COLS.find(c=>c.column_name==='cierre_pendiente')?', cierre_pendiente=false':''}, updated_at=NOW()
WHERE id = ${wrapId(IDs.AP_ID)};

-- 2.1.4 DELETE movimientos_caja ligados a esta apertura (1: el movimiento APERTURA)
DELETE FROM movimientos_caja WHERE apertura_caja_id = ${wrapId(IDs.AP_ID)} AND deleted_at IS NULL;

-- 2.1.5 DELETE arqueos / conciliaciones (deben ser 0; protección)
DELETE FROM arqueo_caja WHERE apertura_caja_id = ${wrapId(IDs.AP_ID)} AND deleted_at IS NULL;
DELETE FROM conciliacion_caja WHERE apertura_caja_id = ${wrapId(IDs.AP_ID)} AND deleted_at IS NULL;

-- 2.1.6 DELETE cierres caja ligados (incl. el recién creado)
DELETE FROM cierre_caja WHERE apertura_caja_id = ${wrapId(IDs.AP_ID)} AND deleted_at IS NULL;

-- 2.1.7 DELETE apertura caja (la apertura S/ 30 original)
DELETE FROM apertura_caja WHERE id = ${wrapId(IDs.AP_ID)} AND deleted_at IS NULL;
`
})()

const sql = `-- ==========================================================
-- SCRIPT LIMPIEZA PRODUCCION PRE-OPERACION BOTICA R&M
-- Fecha generacion: ${new Date().toISOString()}
-- CONVENCION: TRANSACCION COMPLETA (BEGIN/COMMIT) + BACKUPS *_bak
-- PASO 1: Ejecutar con ROLLBACK activo para SIMULAR y validar
-- PASO 2: Si OK y tu APROBACION escrita, cambiar ROLLBACK por COMMIT
-- ==========================================================

BEGIN;
SET CONSTRAINTS ALL DEFERRED;

-- ==========================================================
-- 0. REPORTE PREVIO (11 tablas)
-- ==========================================================
CREATE TEMP TABLE pre_check AS
${['empresas','sucursales','productos','proveedores','clientes','apertura_caja','cierre_caja','movimientos_caja','series_documentos','usuario_sucursal'].map(t => {
  return `SELECT '${t}' tabla, COUNT(*)::int c FROM "${t}" WHERE deleted_at IS NULL`
}).join(' UNION ALL ')}
 UNION ALL SELECT 'auditoria', COUNT(*)::int FROM auditoria;

-- ==========================================================
-- 1. BACKUPS LOGICOS *_bak
-- ==========================================================
${IDs.QA_ID   ? `CREATE TABLE IF NOT EXISTS empresa_qa_bak             AS SELECT * FROM empresas       WHERE id = ${wrapId(IDs.QA_ID)};` : '-- (empresa QA omitida)'}
${IDs.SM_ID   ? `CREATE TABLE IF NOT EXISTS sucursal_sanmiguel_bak     AS SELECT * FROM sucursales     WHERE id = ${wrapId(IDs.SM_ID)};` : '-- (sucursal SM omitida)'}
${IDs.PROD_IDS.length ? `CREATE TABLE IF NOT EXISTS productos_test_bak  AS SELECT * FROM productos      WHERE id IN (${l(IDs.PROD_IDS)});` : '-- (productos test omitidos)'}
${IDs.PROV_IDS.length ? `CREATE TABLE IF NOT EXISTS proveedores_test_bak AS SELECT * FROM proveedores    WHERE id IN (${l(IDs.PROV_IDS)});` : '-- (proveedores test omitidos)'}
${IDs.CLI_IDS.length  ? `CREATE TABLE IF NOT EXISTS clientes_test_bak   AS SELECT * FROM clientes       WHERE id IN (${l(IDs.CLI_IDS)});` : '-- (clientes test omitidos)'}
${IDs.AP_ID   ? `CREATE TABLE IF NOT EXISTS apertura_caja_30_bak       AS SELECT * FROM apertura_caja  WHERE id = ${wrapId(IDs.AP_ID)};
CREATE TABLE IF NOT EXISTS movimientos_caja_30_bak                      AS SELECT * FROM movimientos_caja WHERE apertura_caja_id = ${wrapId(IDs.AP_ID)};
CREATE TABLE IF NOT EXISTS cierre_caja_30_bak (LIKE cierre_caja INCLUDING ALL);` : '-- (caja abierta omitida)'}
CREATE TABLE IF NOT EXISTS auditoria_pre_limpieza_bak                   AS SELECT * FROM auditoria;
${IDs.T001_ID ? `CREATE TABLE IF NOT EXISTS serie_t001_pre_reset_bak    AS SELECT * FROM series_documentos WHERE id = ${wrapId(IDs.T001_ID)};` : '-- (serie T001 omitida)'}
${IDs.SM_ID   ? `CREATE TABLE IF NOT EXISTS usr_suc_sanmiguel_bak       AS SELECT * FROM usuario_sucursal WHERE sucursal_id = ${wrapId(IDs.SM_ID)};` : '-- '}

-- ==========================================================
-- 2. LIMPIEZA ORDEN HIJO -> PADRE
-- ==========================================================

-- ----------------------------------------------------------
-- 2.1 CAJA ABIERTA S/ 30 (opción recomendada: CIERRE LÓGICO)
-- ----------------------------------------------------------
${cierreSql}

-- ----------------------------------------------------------
-- 2.2 CLIENTES / PROVEEDORES / PRODUCTOS prueba
-- ----------------------------------------------------------
${IDs.CLI_IDS.length  ? `DELETE FROM clientes     WHERE id IN (${l(IDs.CLI_IDS)})  AND deleted_at IS NULL;` : '-- (sin clientes test)'}
${IDs.PROV_IDS.length ? `DELETE FROM proveedores  WHERE id IN (${l(IDs.PROV_IDS)}) AND deleted_at IS NULL;` : '-- (sin proveedores test)'}
${IDs.PROD_IDS.length ? `DELETE FROM lotes        WHERE producto_id IN (${l(IDs.PROD_IDS)}) AND deleted_at IS NULL;
DELETE FROM inventario WHERE producto_id IN (${l(IDs.PROD_IDS)}) AND deleted_at IS NULL;
DELETE FROM productos  WHERE id IN (${l(IDs.PROD_IDS)}) AND deleted_at IS NULL;` : '-- (sin productos test)'}

-- ----------------------------------------------------------
-- 2.3 SUCURSAL "San Miguel" (SECUNDARIA) -> ELIMINAR
-- ----------------------------------------------------------
${IDs.SM_ID ? `
-- 2.3.1 Desasignar usuarios en tabla usuario_sucursal
DELETE FROM usuario_sucursal WHERE sucursal_id = ${wrapId(IDs.SM_ID)} AND deleted_at IS NULL;

-- 2.3.2 Eliminar series/cajas exclusivas de la sucursal (deben ser 0)
DELETE FROM series_documentos WHERE sucursal_id = ${wrapId(IDs.SM_ID)} AND deleted_at IS NULL;
DELETE FROM cajas             WHERE sucursal_id = ${wrapId(IDs.SM_ID)} AND deleted_at IS NULL;

-- 2.3.3 SET NULL a usuarios.sucursal_principal_id si apuntaba a SM
${setNullSucPrincipalSql}

-- 2.3.4 DELETE sucursal
DELETE FROM sucursales WHERE id = ${wrapId(IDs.SM_ID)} AND deleted_at IS NULL;
` : `-- (sin sucursal San Miguel; paso 2.3 omitido)`}

-- ----------------------------------------------------------
-- 2.4 EMPRESA QA Rayego -> SOFT DELETE (activo=false + deletedAt)
-- ----------------------------------------------------------
${QA_softSql}

-- ----------------------------------------------------------
-- 2.5 RESET SERIE T001 a siguiente_numero = 1
-- ----------------------------------------------------------
${IDs.T001_ID ? `UPDATE series_documentos SET siguiente_numero = 1, updated_at = NOW() WHERE id = ${wrapId(IDs.T001_ID)} AND deleted_at IS NULL;` : '-- (sin serie T001)'}

-- ----------------------------------------------------------
-- 2.6 TRUNCATE AUDITORIA (decisión usuario)
-- ----------------------------------------------------------
TRUNCATE TABLE auditoria RESTART IDENTITY;

-- ==========================================================
-- 3. REPORTE POSTERIOR — pre vs post + tablas backup
-- ==========================================================
CREATE TEMP TABLE post_check AS
${['empresas','sucursales','productos','proveedores','clientes','apertura_caja','cierre_caja','movimientos_caja','series_documentos','usuario_sucursal'].map(t => {
  return `SELECT '${t}' tabla, COUNT(*)::int c FROM "${t}" WHERE deleted_at IS NULL`
}).join(' UNION ALL ')}
 UNION ALL SELECT 'auditoria', COUNT(*)::int FROM auditoria;

SELECT p.tabla, p.c antes, COALESCE(h.c,0) despues, (p.c - COALESCE(h.c,0)) eliminadas
  FROM pre_check p LEFT JOIN post_check h ON h.tabla = p.tabla
 ORDER BY p.tabla;

SELECT table_name
  FROM information_schema.tables
 WHERE table_schema='public'
   AND (table_name LIKE '%_bak' OR table_name LIKE '%_bak')
 ORDER BY table_name;

-- ==========================================================
-- ⚠️ CONTROL FINAL
-- Primero ejecutar CON ROLLBACK (este archivo). Si se ejecuta sin errores y el reporte "eliminadas" coincide:
--   → Pasar al archivo PASO-2-APLICAR que tiene COMMIT final.
-- ==========================================================
ROLLBACK;
-- COMMIT;
`

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const fMain = resolve(outDir, `limpieza-produccion-BoticaRM-${ts}.sql`)
const fRollback = resolve(outDir, `PASO-1-SIMULAR-con-ROLLBACK.sql`)
const fCommit   = resolve(outDir, `PASO-2-APLICAR-con-COMMIT.sql`)
writeFileSync(fMain, sql, 'utf8')
writeFileSync(fRollback, sql, 'utf8')
writeFileSync(fCommit,
  sql.replace(/^ROLLBACK;$/m,     '-- ROLLBACK;  (desactivado — PASO-2 aplica COMMIT)')
     .replace(/^-- COMMIT;$/m,    'COMMIT;'),
  'utf8')

console.log('\n=== SCRIPTS SQL GENERADOS ===')
console.log('  PASO-1 SIMULACION (ROLLBACK activo): ' + fRollback)
console.log('  PASO-2 APLICAR    (COMMIT activo):  ' + fCommit)
console.log('  Original con timestamp:             ' + fMain)
console.log('\n=== IDs USADOS ===')
console.log(JSON.stringify(IDs, null, 2))
console.log('\n=== Paso siguiente: ejecutar PASO-1 (ROLLBACK) para validar sin tocar BD. Si OK → PASO-2.')
