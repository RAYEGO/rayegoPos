import { config as loadEnvFile } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWriteStream } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..', '..')
const OUT = resolve(root, 'scripts', 'db', '_pre-limpieza-fk.txt')
loadEnvFile({ path: resolve(root, '.env.production'), override: false })

const prismaClientPath = resolve(root, 'node_modules', '@prisma', 'client', 'index.js')
const { PrismaClient } = await import('file:///' + prismaClientPath.replace(/\\/g, '/'))
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })

const out = createWriteStream(OUT, { flags: 'w' })
function log(...a) {
  const l = a.map(x => typeof x === 'object' ? JSON.stringify(x, (k, v) => typeof v === 'bigint' ? v.toString() : v) : String(x)).join(' ')
  out.write(l + '\n'); process.stdout.write(l + '\n')
}

async function cols(table) {
  const r = await prisma.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1;`, table)
  return r.map(x => x.column_name)
}
async function dynCount(table, extraCol, id) {
  const cs = await cols(table)
  if (cs.includes(extraCol) && cs.includes('deleted_at')) {
    try {
      const r = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int c FROM "${table}" WHERE "${extraCol}" = $1::uuid AND deleted_at IS NULL;`, id)
      return r[0].c
    } catch (e) { return 'ERR:' + e.code }
  }
  return 'n/a'
}
async function dynCol(table, pickCols, extraCol, id) {
  const cs = await cols(table)
  const sel = pickCols.filter(c => cs.includes(c)).map(c => `"${c}"`).join(',') || 'COUNT(*)::int c'
  if (cs.includes(extraCol) && cs.includes('deleted_at')) {
    try {
      return await prisma.$queryRawUnsafe(`SELECT ${sel} FROM "${table}" WHERE "${extraCol}" = $1::uuid AND deleted_at IS NULL;`, id)
    } catch (e) { return ['ERR:' + e.message.slice(0, 80)] }
  }
  return []
}

log('== REVISION DEPENDENCIAS FK PRE-LIMPIEZA ==')

const QA = await prisma.$queryRawUnsafe(`SELECT id, razon_social, numero_documento FROM empresas WHERE razon_social ILIKE '%QA Rayego%' AND deleted_at IS NULL;`)
log('Empresa QA a eliminar: ' + JSON.stringify(QA))

if (QA.length > 0) {
  const qaid = QA[0].id
  const tables = [
    'sucursales','usuarios','configuracion','series_documentos','formas_pago','impuestos','categorias','laboratorios','presentaciones','unidades_medida','tipos_comerciales','principios_activos','productos','proveedores','clientes','compras','ventas','tipo_empresa_modulo'
  ]
  for (const tab of tables) {
    const c = await dynCount(tab, 'empresa_id', qaid)
    log(`  QA -> ${tab.padEnd(25)}: ${c} fila(s)`)
    if (typeof c === 'number' && c > 0) {
      const pickMap = {
        sucursales: ['codigo','nombre'],
        usuarios: ['username','email'],
        configuracion: ['ambito','clave','valor'],
        series_documentos: ['tipo_comprobante','serie','siguiente_numero'],
        formas_pago: ['codigo','nombre'],
        impuestos: ['codigo','nombre','porcentaje'],
        categorias: ['codigo','nombre'],
        laboratorios: ['codigo','nombre'],
        presentaciones: ['codigo','nombre'],
        unidades_medida: ['codigo','nombre'],
        tipos_comerciales: ['codigo','nombre'],
        principios_activos: ['codigo','nombre'],
        productos: ['sku','nombre'],
        proveedores: ['numero_documento','razon_social'],
        clientes: ['numero_documento','nombre_completo'],
        compras: ['id'],
        ventas: ['id'],
        tipo_empresa_modulo: ['id'],
      }
      const rows = await dynCol(tab, pickMap[tab] || ['id'], 'empresa_id', qaid)
      for (const r of rows) log(`       ${JSON.stringify(r)}`)
    }
  }
  try {
    const aud_cols = await cols('auditoria')
    const isText = (aud_cols.includes('registro_id'))
    let aud
    if (isText) {
      try { aud = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int c FROM auditoria WHERE tabla='empresas' AND registro_id::text=$1;`, qaid) }
      catch { aud = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int c FROM auditoria WHERE tabla='empresas' AND registro_id=$1::uuid;`, qaid) }
    } else aud = [{ c: -1 }]
    log(`  QA -> auditoria (registro_id): ${aud[0].c}`)
  } catch (e) { log(`  QA -> auditoria: ERR ${e.code} ${e.message.slice(0,60)}`) }
}

log('')
const SM = await prisma.$queryRawUnsafe(`SELECT s.id, s.codigo, s.nombre FROM sucursales s WHERE (s.codigo = 'SECUNDARIA' OR s.nombre ILIKE '%San Miguel%') AND s.deleted_at IS NULL;`)
log('Sucursal San Miguel a eliminar: ' + JSON.stringify(SM))

if (SM.length > 0) {
  const smid = SM[0].id
  const smTab = [
    ['usuarios','sucursal_principal_id',['username','email']],
    ['usuario_sucursal','sucursal_id',['usuario_id']],
    ['series_documentos','sucursal_id',['tipo_comprobante','serie']],
    ['cajas','sucursal_id',['codigo','nombre']],
    ['inventario','sucursal_id',['id']],
    ['lotes','sucursal_id',['id']],
    ['compras','sucursal_id',['id']],
    ['ventas','sucursal_id',['id']],
    ['cargas_inventario_inicial','sucursal_id',['id']],
    ['apertura_caja','sucursal_id',['id','estado']],
    ['cierre_caja','sucursal_id',['id']],
    ['movimientos_caja','sucursal_id',['tipo','monto']],
  ]
  for (const [tab, col, pick] of smTab) {
    const c = await dynCount(tab, col, smid)
    log(`  SM -> ${tab.padEnd(28)}: ${c} fila(s)`)
    if (typeof c === 'number' && c > 0) {
      const rows = await dynCol(tab, pick, col, smid)
      for (const r of rows) log(`       ${JSON.stringify(r)}`)
    }
  }
}

log('')
log('== Revision T001 siguiente numero ==')
const s = await prisma.$queryRawUnsafe(`SELECT id, tipo_comprobante, serie, siguiente_numero, longitud_numero FROM series_documentos WHERE serie = 'T001' AND deleted_at IS NULL;`)
for (const r of s) log(JSON.stringify(r))

log('')
log('== Revision producto/proveedor/cliente test ==')
try {
  const p1 = await prisma.$queryRawUnsafe(`SELECT id, sku, nombre, estado FROM productos WHERE (sku ILIKE 'TEST%' OR nombre ILIKE '%Test%') AND deleted_at IS NULL;`)
  for (const r of p1) log('Producto: ' + JSON.stringify(r))
} catch (e) { log('Producto ERR: ' + e.message) }
try {
  const p2 = await prisma.$queryRawUnsafe(`SELECT id, numero_documento, razon_social FROM proveedores WHERE (razon_social ILIKE '%Test%' OR email ILIKE '%@test.%') AND deleted_at IS NULL;`)
  for (const r of p2) log('Proveedor: ' + JSON.stringify(r))
} catch (e) { log('Proveedor ERR: ' + e.message) }
try {
  const p3 = await prisma.$queryRawUnsafe(`SELECT id, numero_documento, nombre_completo FROM clientes WHERE nombre_completo ILIKE '%Test%' AND deleted_at IS NULL;`)
  for (const r of p3) log('Cliente: ' + JSON.stringify(r))
} catch (e) { log('Cliente ERR: ' + e.message) }

log('\n== Revision mov caja de la apertura 30 ==')
const aps = await prisma.$queryRawUnsafe(`SELECT id, caja_id, estado, usuario_apertura_id, fondo_efectivo FROM apertura_caja WHERE estado = 'ABIERTA' AND deleted_at IS NULL;`)
for (const a of aps) {
  log('  Apertura ' + a.id + ' | usuario:' + a.usuario_apertura_id + ' | fondo:' + a.fondo_efectivo + ' | estado:' + a.estado)
  try {
    const mcs = await prisma.$queryRawUnsafe(`SELECT id, tipo, operacion, monto, observaciones, venta_pago_id FROM movimientos_caja WHERE apertura_caja_id = $1::uuid AND deleted_at IS NULL;`, a.id)
    for (const m of mcs) log('    Mov: ' + JSON.stringify(m))
  } catch (e) { log('    movimientos_caja ERR: ' + e.message) }
  try {
    const arq = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int c FROM arqueo_caja WHERE apertura_caja_id = $1::uuid AND deleted_at IS NULL;`, a.id)
    log('    Arqueos: ' + arq[0].c)
    const conc = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int c FROM conciliacion_caja WHERE apertura_caja_id = $1::uuid AND deleted_at IS NULL;`, a.id)
    log('    Conciliaciones: ' + conc[0].c)
    const cierre = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int c FROM cierre_caja WHERE apertura_caja_id = $1::uuid AND deleted_at IS NULL;`, a.id)
    log('    Cierre caja: ' + cierre[0].c)
  } catch (e) {}
}

log('\n== Tablas audit count ==')
const audT = await prisma.$queryRawUnsafe(`SELECT tabla, accion, COUNT(*)::int c FROM auditoria GROUP BY tabla, accion ORDER BY tabla, accion;`)
for (const r of audT) log('  ' + r.tabla + ' | ' + r.accion + ' | ' + r.c)

log('\nFIN PRE-LIMPIEZA FK')
out.end()
await prisma.$disconnect()
