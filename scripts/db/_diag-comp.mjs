import { config as loadEnvFile } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWriteStream } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..', '..')
const OUT = resolve(root, 'scripts', 'db', '_diagnostico-output-complemento.txt')
loadEnvFile({ path: resolve(root, '.env.production'), override: false })

const prismaClientPath = resolve(root, 'node_modules', '@prisma', 'client', 'index.js')
const { PrismaClient } = await import('file:///' + prismaClientPath.replace(/\\/g, '/'))
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })

const out = createWriteStream(OUT, { flags: 'w' })
function log(...a) {
  const line = a.map(x => typeof x === 'object' ? JSON.stringify(x, null, 0) : String(x)).join(' ')
  out.write(line + '\n'); process.stdout.write(line + '\n')
}
const SUB = '-'.repeat(80)
const sub = (t) => log('\n' + SUB + '\n  ' + t + '\n' + SUB)
const tr = (s, n = 70) => { if (s == null) return '-'; const t = String(s); return t.length > n ? t.slice(0, n) + '...' : t }
const nm = (v) => {
  if (v == null) return '-'
  if (typeof v.toNumber === 'function') return v.toNumber().toFixed(2)
  return Number(v).toFixed(2)
}
function flagTest(v) {
  if (!v) return '  '
  const s = String(v).toLowerCase()
  const tokens = ['prueba','test','demo','ejemplo','rayego','20612345678','20654321987',
    'admin@rayego','supervisor@rayego','caja@rayego','20999999999','20123456789',
    '@rayego.pe','medifarma','amoxicilina','loratadina','paracetamol','vitamina c',
    'drogueria distribuidora','ddp','sucursal principal','sucursal san miguel',
    'av. la marina 845','saucedo','77500000000','77555555','44444444','88888888',
    'juan perez','maria lopez','empresa cliente demo','botica del pueblo','botica popular',
    'ac farma']
  return tokens.some(t => s.includes(t)) ? '⚠️ ' : '  '
}

async function cols(table) {
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`, table)
    return rows.map(r => r.column_name)
  } catch { return [] }
}

async function pick(table, keep, drop = []) {
  const all = await cols(table)
  const lowKeep = keep.map(k => k.toLowerCase())
  const lowDrop = drop.map(k => k.toLowerCase())
  return all.filter(c =>
    (lowKeep.length === 0 || lowKeep.includes(c.toLowerCase())) &&
    !lowDrop.includes(c.toLowerCase())
  )
}

async function safeSQL(table, keep, drop = [], where = '', order = '') {
  const cs = await pick(table, keep, drop)
  if (cs.length === 0) { log('  (no columns for ' + table + ')'); return [] }
  const q = `SELECT ${cs.map(c => `"${c}"`).join(', ')} FROM "${table}" ${where} ${order};`
  try { return await prisma.$queryRawUnsafe(q) } catch (e) { log('  SQL_ERR_' + table + ': ' + e.message.slice(0, 200)); return [] }
}

sub('A. Formas de Pago (columnas reales)')
for (const r of await safeSQL('formas_pago', [], ['deleted_at','created_at','updated_at','id','empresa_id','orden']))
  log(`  ${r.codigo ? r.codigo + ' - ' : ''}${JSON.stringify(r)}`)

sub('B. Impuestos (columnas reales)')
const imp = await safeSQL('impuestos', [], ['deleted_at','created_at','updated_at','id','empresa_id'])
for (const r of imp) log('  ' + JSON.stringify(r))

sub('C. Motivos movimiento inventario - tabla real')
const motivesList = [
  'motivos_movimiento_inventario', 'motivos_mov_inv', 'motivo_movimiento_inventario',
  'motivos_movimientos_inventario', 'inventario_motivos'
]
for (const t of motivesList) {
  const c = await cols(t)
  if (c.length > 0) {
    log(`  Tabla existe: ${t} → cols: ${c.join(', ')}`)
    for (const r of await safeSQL(t, [], ['deleted_at','created_at','updated_at','id','empresa_id'])) log('    ' + JSON.stringify(r))
    break
  }
}

sub('D. Productos (columnas reales)')
const pCols = await cols('productos')
log('  Columnas productos: ' + pCols.join(', '))
for (const r of await safeSQL('productos', [], ['deleted_at','created_at','updated_at','id','empresa_id','imagenes','metadata','principal_activo_id','unidad_medida_compra_id','unidad_medida_venta_id'])) {
  const f = flagTest(JSON.stringify(r))
  log('  ' + f + JSON.stringify(r))
}

sub('E. Proveedores (columnas reales)')
log('  Columnas proveedores: ' + (await cols('proveedores')).join(', '))
for (const r of await safeSQL('proveedores', [], ['deleted_at','created_at','updated_at','id','empresa_id','condiciones_pago','metadata','contacto_puestos'])) {
  const f = flagTest(JSON.stringify(r))
  log('  ' + f + JSON.stringify(r))
}

sub('F. Clientes (columnas reales)')
log('  Columnas clientes: ' + (await cols('clientes')).join(', '))
for (const r of await safeSQL('clientes', [], ['deleted_at','created_at','updated_at','id','empresa_id','metadata','direccion_geo'])) {
  const f = flagTest(JSON.stringify(r))
  log('  ' + f + JSON.stringify(r))
}

sub('G. Ventas - columnas reales + todas las ventas')
log('  Columnas ventas: ' + (await cols('ventas')).join(', '))
for (const r of await safeSQL('ventas', [], ['deleted_at','updated_at','hash_documento','qr_url','metadata','xml_path','pdf_path','cdr_path','obs_anulacion'])) {
  const f = flagTest(JSON.stringify(r))
  log('  ' + f + JSON.stringify(r))
}

sub('H. Caja definición (columnas reales)')
log('  Columnas cajas: ' + (await cols('cajas')).join(', '))
for (const r of await safeSQL('cajas', [], ['deleted_at','created_at','updated_at','id','metadata'])) log('  ' + JSON.stringify(r))

sub('I. Aperturas (columnas reales) + cierre columnas')
log('  Columnas apertura_caja: ' + (await cols('apertura_caja')).join(', '))
log('  Columnas cierre_caja: ' + (await cols('cierre_caja')).join(', '))
for (const r of await safeSQL('apertura_caja', [], ['deleted_at','updated_at','metadata'])) {
  const f = flagTest(JSON.stringify(r))
  log('  ' + f + JSON.stringify(r))
}
for (const r of await safeSQL('cierre_caja', [], ['deleted_at','updated_at','metadata','detalle_efectivo','detalle_formas_pago','archivos'])) log('  CIERRE: ' + JSON.stringify(r))

sub('J. Movimientos de caja (columnas reales) - CAJA ABIERTA')
log('  Columnas movimientos_caja: ' + (await cols('movimientos_caja')).join(', '))
for (const r of await safeSQL('movimientos_caja', [], ['deleted_at','updated_at','metadata','referencia_id','created_by','ingreso_id','egreso_id'])) {
  const f = flagTest(JSON.stringify(r))
  log('  ' + f + JSON.stringify(r))
}

sub('K. Ingresos / Egresos (columnas reales)')
log('  Columnas ingresos: ' + (await cols('ingresos')).join(', '))
for (const r of await safeSQL('ingresos', [], ['deleted_at','updated_at'])) log('  ING: ' + JSON.stringify(r))
log('  Columnas egresos: ' + (await cols('egresos')).join(', '))
for (const r of await safeSQL('egresos', [], ['deleted_at','updated_at'])) log('  EGR: ' + JSON.stringify(r))

sub('L. Arqueos (columnas reales)')
log('  Columnas arqueo_caja: ' + (await cols('arqueo_caja')).join(', '))
for (const r of await safeSQL('arqueo_caja', [], ['deleted_at','updated_at','detalle_monedas','detalle_billetes','diferencias_detalle'])) log('  ' + JSON.stringify(r))

sub('M. Lotes (columnas reales)')
log('  Columnas lotes: ' + (await cols('lotes')).join(', '))
for (const r of await safeSQL('lotes', [], ['deleted_at','created_at','updated_at','id','metadata'])) {
  const f = flagTest(JSON.stringify(r))
  log('  ' + f + JSON.stringify(r))
}

sub('N. Inventario (columnas reales)')
log('  Columnas inventario: ' + (await cols('inventario')).join(', '))
for (const r of await safeSQL('inventario', [], ['deleted_at','updated_at','id','metadata','stock_disponible','stock_reservado','stock_bloqueado','stock_total'])) log('  ' + JSON.stringify(r))

log('FIN COMPLEMENTO')
out.end()
await prisma.$disconnect()
