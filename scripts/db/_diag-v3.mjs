import { config as loadEnvFile } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWriteStream } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..', '..')
const OUT = resolve(root, 'scripts', 'db', '_diagnostico-output.txt')
loadEnvFile({ path: resolve(root, '.env.production'), override: false })
process.env.RAYEGO_ENV_MODE = 'production'

const prismaClientPath = resolve(root, 'node_modules', '@prisma', 'client', 'index.js')
const prismaUrl = 'file:///' + prismaClientPath.replace(/\\/g, '/')
const { PrismaClient } = await import(prismaUrl)
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })

const out = createWriteStream(OUT, { flags: 'w' })
function log(...a) {
  const line = a.map(x => typeof x === 'object' ? JSON.stringify(x, null, 0) : String(x)).join(' ')
  out.write(line + '\n'); process.stdout.write(line + '\n')
}

const SEP = '='.repeat(80), SUB = '-'.repeat(80)
const sec = (t) => log('\n' + SEP + '\n  ' + String(t).toUpperCase() + '\n' + SEP)
const sub = (t) => log('\n' + SUB + '\n  ' + t + '\n' + SUB)
const tr = (s, n = 60) => { if (s == null) return '-'; const t = String(s); return t.length > n ? t.slice(0, n) + '...' : t }
const nm = (v) => {
  if (v == null) return '-'
  if (typeof v.toNumber === 'function') return v.toNumber().toFixed(2)
  return Number(v).toFixed(2)
}
function flagTest(v) {
  if (!v) return '  '
  const s = String(v).toLowerCase()
  const tokens = ['prueba','test','demo','ejemplo','rayego','20612345678','20654321987',
    'admin@rayego','supervisor@rayego','caja@rayego','sin.sucursal','@rayego.pe',
    'med-0001','med-0002','med-0003','med-0004','paracetamol','amoxicilina','loratadina','vitamina c',
    'drogueria distribuidora','ddp','sucursal principal','sucursal san miguel','sucursal central',
    'av. principal 123','av. la marina 845','77500000000','juan perez','maria lopez',
    'empresa cliente demo','botica del pueblo','botica popular','botica saucedo','saucedo',
    'ac farma','medifarma','bayer']
  return tokens.some(t => s.includes(t)) ? '⚠️ ' : '  '
}

async function cnt(model) {
  try { return await prisma[model].count({ where: { deletedAt: null } }) } catch { return 0 }
}

async function listSQL(query, params = []) {
  try { return await prisma.$queryRawUnsafe(query, ...params) } catch (e) { log('SQL_ERR: ' + e.message.slice(0, 200)); return [] }
}

async function main() {
  sec('DIAGNOSTICO BD PRODUCCION - LIMPIEZA OPERACION REAL')
  log('Fecha: ' + new Date().toLocaleString('es-PE'))
  const now = await listSQL('select now()::text as t;')
  log('Hora BD: ' + now[0].t)

  const C = {}
  const map = {
    empresas: 'empresa', sucursales: 'sucursal', usuarios: 'usuario',
    roles: 'rol', permisos: 'permiso', rol_permiso: 'rolPermiso',
    tipos_empresa: 'tipoEmpresa', modulos: 'modulo', configuracion: 'configuracion',
    categorias: 'categoria', laboratorios: 'laboratorio', presentaciones: 'presentacion',
    unidades_medida: 'unidadMedida', tipos_comerciales: 'tipoComercial', principios_activos: 'principioActivo',
    formas_pago: 'formaPago', impuestos: 'impuesto', motivos_movimiento_inventario: 'motivoMovimientoInventario',
    productos: 'producto', proveedores: 'proveedor', clientes: 'cliente',
    inventario: 'inventario', lotes: 'lote', movimientos_inventario: 'movimientoInventario',
    compras: 'compra', ventas: 'venta',
    cajas: 'caja', apertura_caja: 'aperturaCaja', cierre_caja: 'cierreCaja',
    movimientos_caja: 'movimientoCaja', ingresos: 'ingreso', egresos: 'egreso',
    arqueo_caja: 'arqueoCaja', conciliacion_caja: 'conciliacionCaja',
    auditoria: 'auditoria'
  }
  for (const [k, m] of Object.entries(map)) C[k] = await cnt(m)

  sec('0. CONTEOS RAPIDOS POR TABLA')
  log('GRUPO 1 - NO TOCAR')
  log('  empresas        : ' + C.empresas)
  log('  sucursales      : ' + C.sucursales)
  log('  usuarios        : ' + C.usuarios)
  log('  roles           : ' + C.roles)
  log('  permisos        : ' + C.permisos)
  log('  rol_permiso     : ' + C.rol_permiso)
  log('  tipos_empresa   : ' + C.tipos_empresa)
  log('  modulos         : ' + C.modulos)
  log('  configuracion   : ' + C.configuracion)
  log('GRUPO 2 - CATALOGOS BASE (conservar estructura)')
  log('  categorias      : ' + C.categorias)
  log('  laboratorios    : ' + C.laboratorios)
  log('  presentaciones  : ' + C.presentaciones)
  log('  unidades_medida : ' + C.unidades_medida)
  log('  tipos_comerciales : ' + C.tipos_comerciales)
  log('  principios_activos : ' + C.principios_activos)
  log('  formas_pago     : ' + C.formas_pago)
  log('  impuestos       : ' + C.impuestos)
  log('  motivos_mov_inv : ' + C.motivos_movimiento_inventario)
  log('GRUPO 3 - CATALOGOS NEGOCIO (validar 1 a 1)')
  log('  productos       : ' + C.productos + '   <<< VALIDAR')
  log('  proveedores     : ' + C.proveedores + '   <<< VALIDAR')
  log('  clientes        : ' + C.clientes + '   <<< VALIDAR')
  log('GRUPO 4 - CAJA (TODO de PRUEBA - eliminar)')
  log('  cajas (def)     : ' + C.cajas + '  (se conserva la definicion)')
  log('  apertura_caja   : ' + C.apertura_caja + '  INCLUYE LA CAJA ABIERTA S/ 30 <<<')
  log('  cierre_caja     : ' + C.cierre_caja)
  log('  movimientos_caja: ' + C.movimientos_caja)
  log('  ingresos        : ' + C.ingresos)
  log('  egresos         : ' + C.egresos)
  log('  arqueo_caja     : ' + C.arqueo_caja)
  log('  conciliacion_caja : ' + C.conciliacion_caja)
  log('GRUPO 5 - TRANSACCIONALES (TODO de PRUEBA - eliminar)')
  log('  ventas          : ' + C.ventas)
  log('  compras         : ' + C.compras)
  log('  inventario (def): ' + C.inventario + '  (se conserva; resetear stock)')
  log('  lotes           : ' + C.lotes + '  (depende productos REALES/PRUEBA)')
  log('  movimientos_inv : ' + C.movimientos_inventario)
  log('  auditoria       : ' + C.auditoria + '  (A: truncar / B: conservar)')

  sec('1. EMPRESAS (NO TOCAR)')
  for (const e of await listSQL(`
    SELECT id, razon_social, nombre_comercial, tipo_documento, numero_documento, email, modo_operacion, activo
    FROM empresas WHERE deleted_at IS NULL ORDER BY razon_social`)) {
    const f = flagTest(e.razon_social) || flagTest(e.numero_documento)
    log(`  ${f}${e.tipo_documento}:${e.numero_documento} - ${e.razon_social} (${e.nombre_comercial || '-'}) | Modo:${e.modo_operacion} | ${e.activo ? 'ACTIVO':'INACTIVO'} | email: ${e.email || '-'}`)
  }

  sec('2. SUCURSALES (NO TOCAR)')
  for (const s of await listSQL(`
    SELECT s.id, s.codigo, s.nombre, s.direccion, s.es_principal, s.activo,
           e.razon_social as empresa
    FROM sucursales s JOIN empresas e ON e.id = s.empresa_id
    WHERE s.deleted_at IS NULL ORDER BY s.codigo`)) {
    const f = flagTest(s.nombre) || flagTest(s.codigo) || flagTest(s.direccion)
    log(`  ${f}[${s.empresa}] ${s.codigo} - ${s.nombre} | Dir: ${s.direccion || '-'} | ${s.es_principal ? 'PRINCIPAL' : ''} | ${s.activo ? 'ACTIVO':'INACTIVO'}`)
  }

  sec('3. USUARIOS (validar 1 a 1; NO tocar REALES; borrar los de PRUEBA)')
  for (const u of await listSQL(`
    SELECT id, username, email, nombres, apellidos, tipo_documento, numero_documento,
           activo, ultimo_acceso_at, created_at
    FROM usuarios WHERE deleted_at IS NULL ORDER BY username`)) {
    const f = flagTest(u.username) || flagTest(u.email) || flagTest(u.nombres) || flagTest(u.apellidos) || flagTest(u.numero_documento)
    const acc = u.ultimo_acceso_at ? new Date(u.ultimo_acceso_at).toLocaleString('es-PE') : 'NUNCA'
    log(`  ${f}@${u.username} - ${u.nombres || ''} ${u.apellidos || ''} | ${u.email || '-'} | ${u.tipo_documento || ''}:${u.numero_documento || '-'} | ${u.activo ? 'ACTIVO':'INACTIVO'} | ultimo acceso: ${acc}`)
  }

  sec('4. ESTRUCTURA BASE (conservar)')
  sub('4.1 Roles y Permisos')
  for (const r of await listSQL(`SELECT codigo, nombre, activo FROM roles WHERE deleted_at IS NULL ORDER BY codigo`))
    log(`  - ${r.codigo} : ${r.nombre} (activo=${r.activo})`)
  log('Permisos activos: ' + C.permisos + ' | Asignaciones rol-permiso: ' + C.rol_permiso)

  sub('4.2 Configuracion del Sistema (' + C.configuracion + ')')
  for (const c of await listSQL(`SELECT ambito, clave, valor_texto, valor_booleano, valor_numero FROM configuracion WHERE deleted_at IS NULL ORDER BY ambito, clave`)) {
    const v = c.valor_texto ?? (c.valor_numero != null ? String(c.valor_numero) : c.valor_booleano != null ? String(c.valor_booleano) : '-')
    log(`  [${c.ambito}] ${c.clave} = ${tr(String(v), 100)}`)
  }
  if (C.configuracion === 0) log('  (sin configuraciones)')

  sub('4.3 Series de Documentos')
  for (const s of await listSQL(`
    SELECT sd.tipo_comprobante, sd.serie, sd.siguiente_numero, sd.longitud_numero, sd.activo,
           s.codigo as suc_cod, s.nombre as suc_nom, e.razon_social as empresa
    FROM series_documentos sd
      LEFT JOIN sucursales s ON s.id = sd.sucursal_id
      LEFT JOIN empresas e ON e.id = s.empresa_id
    WHERE sd.deleted_at IS NULL`)) {
    const suc = s.empresa ? `${s.empresa}/${s.suc_cod} ${s.suc_nom}` : 'GENERAL'
    log(`  [${suc}] ${s.tipo_comprobante} ${s.serie}-${String(s.siguiente_numero).padStart(s.longitud_numero, '0')} | siguiente:${s.siguiente_numero} long:${s.longitud_numero} activo:${s.activo}`)
  }

  sec('5. CATALOGOS MAESTROS (estructura base - conservar por defecto)')
  sub('5.1 Categorias (' + C.categorias + ')')
  for (const r of await listSQL(`SELECT codigo, nombre, descripcion, orden, activo FROM categorias WHERE deleted_at IS NULL ORDER BY orden NULLS LAST, codigo`)) {
    const f = flagTest(r.codigo) || flagTest(r.nombre)
    log(`  ${f}${r.codigo} - ${r.nombre} ${r.activo ? '' : '[INACTIVO]'}`)
  }
  sub('5.2 Laboratorios (' + C.laboratorios + ')')
  for (const r of await listSQL(`SELECT codigo, nombre, pais, activo FROM laboratorios WHERE deleted_at IS NULL ORDER BY nombre`)) {
    const f = flagTest(r.codigo) || flagTest(r.nombre)
    log(`  ${f}${r.codigo} - ${r.nombre} (${r.pais || '-'})`)
  }
  sub('5.3 Presentaciones (' + C.presentaciones + ')')
  for (const r of await listSQL(`SELECT codigo, nombre, activo FROM presentaciones WHERE deleted_at IS NULL ORDER BY nombre`)) {
    const f = flagTest(r.codigo) || flagTest(r.nombre)
    log(`  ${f}${r.codigo} - ${r.nombre}`)
  }
  sub('5.4 Unidades Medida (' + C.unidades_medida + ')')
  for (const r of await listSQL(`SELECT codigo, nombre, simbolo, activo FROM unidades_medida WHERE deleted_at IS NULL ORDER BY nombre`)) {
    log(`  ${flagTest(r.codigo)}${r.codigo} - ${r.nombre} (${r.simbolo})`)
  }
  sub('5.5 Tipos Comerciales (' + C.tipos_comerciales + ')')
  for (const r of await listSQL(`SELECT codigo, nombre, activo FROM tipos_comerciales WHERE deleted_at IS NULL ORDER BY nombre`))
    log(`  ${flagTest(r.codigo)||flagTest(r.nombre)}${r.codigo} - ${r.nombre}`)
  sub('5.6 Principios Activos (' + C.principios_activos + ')')
  for (const r of await listSQL(`SELECT codigo, nombre, activo FROM principios_activos WHERE deleted_at IS NULL ORDER BY nombre`))
    log(`  ${flagTest(r.codigo)||flagTest(r.nombre)}${r.codigo} - ${r.nombre}`)
  sub('5.7 Formas Pago (' + C.formas_pago + ')')
  for (const r of await listSQL(`SELECT codigo, nombre, descripcion, activo, necesita_referencia, es_digital, es_efectivo FROM formas_pago WHERE deleted_at IS NULL ORDER BY orden NULLS LAST, codigo`))
    log(`  ${r.codigo} - ${r.nombre} | efectivo:${r.es_efectivo} digital:${r.es_digital} ref:${r.necesita_referencia}`)
  sub('5.8 Impuestos (' + C.impuestos + ')')
  for (const r of await listSQL(`SELECT codigo, nombre, tipo, porcentaje, codigo_sunat, activo FROM impuestos WHERE deleted_at IS NULL ORDER BY porcentaje DESC NULLS LAST, codigo`))
    log(`  ${r.codigo} - ${r.nombre} tipo:${r.tipo} ${r.porcentaje || '-'}% sunat:${r.codigo_sunat || '-'}`)
  sub('5.9 Motivos Movimiento Inventario (' + C.motivos_movimiento_inventario + ')')
  for (const r of await listSQL(`SELECT codigo, nombre, tipo, descripcion, activo FROM motivos_movimiento_inventario WHERE deleted_at IS NULL ORDER BY tipo, nombre`))
    log(`  ${flagTest(r.codigo)}${r.codigo} - ${r.nombre} [${r.tipo}]`)

  sec('6. PRODUCTOS (' + C.productos + ') - <<< VALIDAR 1 A 1: REAL o PRUEBA')
  const prod = await listSQL(`
    SELECT p.id, p.sku, p.codigo_interno, p.codigo_barras, p.nombre, p.concentracion, p.estado,
           p.requiere_receta, p.stock_minimo_global, p.precio_venta, p.precio_venta_mayor,
           p.costo_ultima_compra, p.costo_promedio_ponderado,
           c.nombre as cat, l.nombre as lab, pr.nombre as pres, pa.nombre as p_act,
           um.nombre as um_venta
    FROM productos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      LEFT JOIN laboratorios l ON l.id = p.laboratorio_id
      LEFT JOIN presentaciones pr ON pr.id = p.presentacion_id
      LEFT JOIN principios_activos pa ON pa.id = p.principio_activo_id
      LEFT JOIN unidades_medida um ON um.id = p.unidad_medida_venta_id
    WHERE p.deleted_at IS NULL ORDER BY p.sku`)
  for (const p of prod) {
    const f = flagTest(p.sku) || flagTest(p.nombre) || flagTest(p.codigo_interno) || flagTest(p.codigo_barras)
    const tags = [p.cat,p.lab,p.pr,p.p_act].filter(Boolean).join('/') || '-'
    log(`  ${f}SKU:${p.sku} | ${p.nombre} ${p.concentracion || ''} | Barras:${p.codigo_barras || '-'} Int:${p.codigo_interno || '-'} | PV:${nm(p.precio_venta)} PM:${nm(p.precio_venta_mayor)} CUC:${nm(p.costo_ultima_compra)} CPP:${nm(p.costo_promedio_ponderado)} | Cat/Lab/Pres/PA: ${tags} | UMvta:${p.um_venta || '-'} | Receta:${p.requiere_receta} StockMinG:${p.stock_minimo_global || '-'} Estado:${p.estado}`)
  }
  if (C.productos === 0) log('  (sin productos)')

  sec('7. PROVEEDORES (' + C.proveedores + ') - <<< VALIDAR 1 A 1')
  for (const p of await listSQL(`
    SELECT id, tipo_documento, numero_documento, razon_social, nombre_comercial,
           contacto_nombre, contacto_telefono, email, pais, departamento, provincia, distrito, direccion,
           permite_credito, limite_credito, saldo_pendiente, activo
    FROM proveedores WHERE deleted_at IS NULL ORDER BY razon_social`)) {
    const f = flagTest(p.numero_documento) || flagTest(p.razon_social) || flagTest(p.nombre_comercial) || flagTest(p.direccion) || flagTest(p.email) || flagTest(p.contacto_telefono)
    const ubi = [p.pais,p.departamento,p.provincia,p.distrito,p.direccion].filter(Boolean).join('/') || '-'
    const cred = p.permite_credito ? `LIM:${nm(p.limite_credito)} SALDO:${nm(p.saldo_pendiente)}` : 'SIN-CREDITO'
    log(`  ${f}${p.tipo_documento}:${p.numero_documento} - ${p.razon_social} (${p.nombre_comercial || '-'}) | Contacto: ${p.contacto_nombre || '-'} Tlf:${p.contacto_telefono || '-'} Email:${p.email || '-'} | ${ubi} | ${cred} | activo:${p.activo}`)
  }
  if (C.proveedores === 0) log('  (sin proveedores)')

  sec('8. CLIENTES (' + C.clientes + ') - <<< VALIDAR 1 A 1')
  for (const c of await listSQL(`
    SELECT id, tipo_documento, numero_documento, nombres, apellidos, razon_social, nombre_completo,
           email, telefono, direccion, cliente_tipo, permite_credito, limite_credito, saldo_pendiente, activo
    FROM clientes WHERE deleted_at IS NULL ORDER BY COALESCE(apellidos, razon_social) NULLS LAST, numero_documento`)) {
    const nom = c.nombre_completo || c.razon_social || `${c.nombres || ''} ${c.apellidos || ''}`.trim()
    const doc = c.tipo_documento && c.numero_documento ? `${c.tipo_documento}:${c.numero_documento}` : 'sin-doc'
    const f = flagTest(nom) || flagTest(c.email) || flagTest(c.telefono) || flagTest(c.numero_documento) || flagTest(c.razon_social)
    const cred = c.permite_credito ? `LIM:${nm(c.limite_credito)} SALDO:${nm(c.saldo_pendiente)}` : 'SIN-CREDITO'
    log(`  ${f}${doc} - ${nom} | Email:${c.email || '-'} Tlf:${c.telefono || '-'} Dir:${c.direccion || '-'} Tipo:${c.cliente_tipo || '-'} | ${cred} | activo:${c.activo}`)
  }
  if (C.clientes === 0) log('  (sin clientes)')

  sec('9. COMPRAS (' + C.compras + ') - TODO de PRUEBA -> eliminar')
  for (const c of await listSQL(`
    SELECT co.id, co.fecha_emision, co.fecha_recepcion, co.tipo_comprobante, co.serie_comprobante, co.numero_comprobante,
           co.estado, co.estado_logistico, co.estado_financiero,
           co.subtotal, co.descuento_total, co.impuesto_total, co.total, co.saldo_pendiente,
           co.observaciones,
           s.codigo as suc,
           pr.razon_social as prov, pr.numero_documento as prov_doc,
           u.username as resp
    FROM compras co
      LEFT JOIN sucursales s ON s.id = co.sucursal_id
      LEFT JOIN proveedores pr ON pr.id = co.proveedor_id
      LEFT JOIN usuarios u ON u.id = co.usuario_responsable_id
    WHERE co.deleted_at IS NULL ORDER BY co.fecha_emision DESC`)) {
    const f = flagTest(c.prov) || flagTest(c.prov_doc) || flagTest(c.observaciones)
    const comp = `${c.tipo_comprobante || 'SIN-TIPO'} ${c.serie_comprobante || ''}-${c.numero_comprobante || ''}`
    log(`  ${f}${comp} | Emision:${new Date(c.fecha_emision).toLocaleString('es-PE')} Recepcion:${c.fecha_recepcion ? new Date(c.fecha_recepcion).toLocaleString('es-PE') : '-'} | Suc:${c.suc || '-'} | Prov:${tr(c.prov || '?', 40)} | Resp:@${c.resp || '?'} | Sub:${nm(c.subtotal)} Dsc:${nm(c.descuento_total)} Igv:${nm(c.impuesto_total)} Tot:${nm(c.total)} Saldo:${nm(c.saldo_pendiente)} | Est:${c.estado} Log:${c.estado_logistico} Fin:${c.estado_financiero} | obs:${tr(c.observaciones, 60)}`)
  }
  if (C.compras === 0) log('  (sin compras)')

  sec('10. VENTAS (' + C.ventas + ') - TODO de PRUEBA -> eliminar')
  for (const v of await listSQL(`
    SELECT v.id, v.fecha_emision, v.tipo_comprobante, v.serie, v.numero,
           v.estado, v.estado_entrega, v.estado_pago,
           v.subtotal, v.descuento_total, v.impuesto_total, v.total, v.vuelto, v.saldo_pendiente,
           v.observaciones,
           s.codigo as suc,
           COALESCE(cl.nombre_completo, cl.razon_social, cl.nombres || ' ' || cl.apellidos, 'GENERICO') as cliente,
           u.username as resp,
           CASE WHEN a.id IS NULL THEN NULL ELSE a.estado END as apertura_estado,
           c.codigo as caja_cod
    FROM ventas v
      LEFT JOIN sucursales s ON s.id = v.sucursal_id
      LEFT JOIN clientes cl ON cl.id = v.cliente_id
      LEFT JOIN usuarios u ON u.id = v.usuario_responsable_id
      LEFT JOIN apertura_caja a ON a.id = v.caja_apertura_id
      LEFT JOIN cajas c ON c.id = a.caja_id
    WHERE v.deleted_at IS NULL ORDER BY v.fecha_emision DESC`)) {
    const f = flagTest(v.cliente) || flagTest(v.resp) || flagTest(v.observaciones)
    const comp = `${v.tipo_comprobante} ${v.serie || ''}-${v.numero || ''}`
    log(`  ${f}${comp} | ${new Date(v.fecha_emision).toLocaleString('es-PE')} | Suc:${v.suc || '-'} | Cli:${tr(v.cliente, 40)} | Resp:@${v.resp || '?'} | Apertura:${v.apertura_estado || '-'} Caja:${v.caja_cod || '-'} | Sub:${nm(v.subtotal)} Dsc:${nm(v.descuento_total)} Igv:${nm(v.impuesto_total)} Tot:${nm(v.total)} Vuelto:${nm(v.vuelto)} Saldo:${nm(v.saldo_pendiente)} | ${v.estado} Ent:${v.estado_entrega} Pag:${v.estado_pago} | obs:${tr(v.observaciones, 60)}`)
  }
  if (C.ventas === 0) log('  (sin ventas)')

  sec('11. CAJA - PRIORIDAD: caja abierta S/ 30')
  sub('11.1 Definicion de cajas (' + C.cajas + ')')
  for (const c of await listSQL(`
    SELECT ca.id, ca.codigo, ca.nombre, ca.descripcion, ca.estado, ca.impresora_ticket,
           s.codigo as suc_cod, s.nombre as suc_nom, e.razon_social as empresa
    FROM cajas ca
      JOIN sucursales s ON s.id = ca.sucursal_id
      JOIN empresas e ON e.id = s.empresa_id
    WHERE ca.deleted_at IS NULL`)) {
    const f = flagTest(c.codigo) || flagTest(c.nombre) || flagTest(c.descripcion)
    log(`  ${f}[${c.empresa}/${c.suc_cod} ${c.suc_nom}] ${c.codigo} - ${c.nombre} (${c.descripcion || '-'}) | Impresora:${c.impresora_ticket || '-'} | Estado:${c.estado}`)
  }

  sub('11.2 APERTURAS DE CAJA (' + C.apertura_caja + ') - <<< INCLUYE ABIERTA S/30')
  const aps = await listSQL(`
    SELECT a.id, a.estado, a.fecha_apertura, a.monto_apertura_efectivo,
           a.cierre_pendiente, a.observaciones,
           c.codigo as caja_cod, c.nombre as caja_nom, s.codigo as suc_cod, s.nombre as suc_nom, e.razon_social as empresa,
           u.username as user_name, u.nombres as user_n, u.apellidos as user_a,
           ci.fecha_cierre, ci.monto_sistema_efectivo, ci.monto_declarado_efectivo,
           ci.diferencia_efectivo, ci.observaciones as cierre_obs
    FROM apertura_caja a
      JOIN cajas c ON c.id = a.caja_id
      JOIN sucursales s ON s.id = c.sucursal_id
      JOIN empresas e ON e.id = s.empresa_id
      JOIN usuarios u ON u.id = a.usuario_id
      LEFT JOIN cierre_caja ci ON ci.apertura_caja_id = a.id
    WHERE a.deleted_at IS NULL ORDER BY a.fecha_apertura DESC`)
  for (const a of aps) {
    const est = a.estado === 'ABIERTA' ? '🔴 ABIERTA' : a.estado
    const ci = a.fecha_cierre ? `✅ Cierre: ${new Date(a.fecha_cierre).toLocaleString('es-PE')} sist:${nm(a.monto_sistema_efectivo)} dec:${nm(a.monto_declarado_efectivo)} dif:${nm(a.diferencia_efectivo)} ${a.cierre_obs ? 'obs:' + tr(a.cierre_obs, 60) : ''}` : '⚠️ SIN CIERRE (APERTURA ACTIVA)'
    log(`  ${est} | ${a.empresa}/${a.suc_cod}/${a.caja_cod} ${a.caja_nom} | Apertura:${new Date(a.fecha_apertura).toLocaleString('es-PE')} | @${a.user_name} ${a.user_n || ''} ${a.user_a || ''} | Fondo EFECTIVO: S/ ${nm(a.monto_apertura_efectivo)} | cierrePendiente:${a.cierre_pendiente} | ${ci}`)
    if (a.observaciones) log(`    Obs apertura: ${a.observaciones}`)
  }

  const abiertas = aps.filter(a => a.estado === 'ABIERTA')
  log('\n🚨 CAJAS ACTIVAS (ABIERTA): ' + abiertas.length)
  for (const a of abiertas) {
    log('\n  ========= DETALLE CAJA ABIERTA =========')
    log(`  Empresa / Suc / Caja: ${a.empresa} / ${a.suc_cod} ${a.suc_nom} / ${a.caja_cod} ${a.caja_nom}`)
    log(`  Abierta por: @${a.user_name} - ${a.user_n || ''} ${a.user_a || ''}`)
    log(`  Fecha/Hora apertura: ${new Date(a.fecha_apertura).toLocaleString('es-PE')} (UTC: ${a.fecha_apertura})`)
    log(`  Fondo inicial EFECTIVO: S/ ${nm(a.monto_apertura_efectivo)}  ⭐ (mencionaste S/ 30.00)`)
    log(`  Flag cierre pendiente: ${a.cierre_pendiente}`)
    if (a.observaciones) log(`  Observaciones: ${a.observaciones}`)
    log('\n  >> MOVIMIENTOS EN ESTA APERTURA:')
    const mcs = await listSQL(`
      SELECT m.id, m.fecha_movimiento, m.tipo, m.operacion, m.monto, m.referencia,
             fp.codigo as fp_cod, fp.nombre as fp_nom, fp.es_efectivo as fp_ef,
             vp.id as vp_id, vp.monto as vp_monto,
             v.tipo_comprobante as v_tip, v.serie as v_ser, v.numero as v_num, v.total as v_tot,
             i.id as ing_id, i.concepto as ing_c, i.referencia as ing_r,
             eg.id as eg_id, eg.concepto as eg_c, eg.referencia as eg_r
      FROM movimientos_caja m
        LEFT JOIN formas_pago fp ON fp.id = m.forma_pago_id
        LEFT JOIN venta_pagos vp ON vp.id = m.venta_pago_id
        LEFT JOIN ventas v ON v.id = vp.venta_id
        LEFT JOIN ingresos i ON i.id = m.ingreso_id
        LEFT JOIN egresos eg ON eg.id = m.egreso_id
      WHERE m.apertura_caja_id = $1 AND m.deleted_at IS NULL
      ORDER BY m.fecha_movimiento ASC`, [a.id])
    let saldoEf = Number(a.monto_apertura_efectivo || 0)
    log(`  Total movimientos: ${mcs.length}`)
    for (let i = 0; i < mcs.length; i++) {
      const m = mcs[i]
      const sg = m.operacion === 'INGRESO' ? '+' : '-'
      const mn = Number(m.monto)
      if (m.fp_ef) saldoEf += m.operacion === 'INGRESO' ? mn : -mn
      const fp = m.fp_cod ? `${m.fp_cod}${m.fp_ef ? '(EFE)' : ''}` : '???'
      let vin = ''
      if (m.vp_id) vin = `PagoVta#${m.vp_id} (${m.v_tip} ${m.v_ser || ''}-${m.v_num || ''})`
      else if (m.ing_id) vin = `INGRESO concepto="${tr(m.ing_c, 80)}" ref="${m.ing_r || ''}"`
      else if (m.eg_id) vin = `EGRESO concepto="${tr(m.eg_c, 80)}" ref="${m.eg_r || ''}"`
      else vin = `${m.tipo || '?'} ref="${m.referencia || ''}"`
      log(`   ${String(i+1).padStart(2, ' ')}. [${new Date(m.fecha_movimiento).toLocaleString('es-PE')}] ${(m.tipo || '').padEnd(18)} ${sg}${nm(m.monto)} | FP:${fp.padEnd(15)} | Saldo EFE:${saldoEf.toFixed(2)} | ${vin}`)
    }
    log(`\n  🏁 SALDO EFECTIVO FINAL (calculado): S/ ${saldoEf.toFixed(2)}`)
    log(`     (Si fondo=30 y no hay movs adicionales → 30.00, coincide con tu info)`)
  }

  sub('11.3 Arqueos (' + C.arqueo_caja + ')')
  const arq = await listSQL(`
    SELECT a.created_at, a.total_declarado_efectivo, a.total_sistema_efectivo, a.diferencia_efectivo,
           a.detalle_monedas, a.detalle_billetes, a.observaciones,
           c.codigo as caja_cod, a_c.estado as apertura_est, u.username as user
    FROM arqueo_caja a
      JOIN apertura_caja a_c ON a_c.id = a.apertura_caja_id
      JOIN cajas c ON c.id = a_c.caja_id
      JOIN usuarios u ON u.id = a.usuario_id
    WHERE a.deleted_at IS NULL ORDER BY a.created_at`)
  for (const a of arq) log(`  [${new Date(a.created_at).toLocaleString('es-PE')}] Caja:${a.caja_cod} ${a.apertura_est} @${a.user} | Declarado:${nm(a.total_declarado_efectivo)} Sist:${nm(a.total_sistema_efectivo)} Dif:${nm(a.diferencia_efectivo)} | ${a.observaciones || ''}`)
  if (C.arqueo_caja === 0) log('  (sin arqueos)')

  sub('11.4 Conciliaciones (' + C.conciliacion_caja + ')')
  for (const c of await listSQL(`
    SELECT co.created_at, co.observaciones, u.username as user, c.codigo as caja_cod,
           (SELECT COUNT(*) FROM conciliacion_caja_detalle d WHERE d.conciliacion_caja_id = co.id AND d.deleted_at IS NULL) as ndet
    FROM conciliacion_caja co
      JOIN apertura_caja a ON a.id = co.apertura_caja_id
      JOIN cajas c ON c.id = a.caja_id
      JOIN usuarios u ON u.id = co.usuario_id
    WHERE co.deleted_at IS NULL`))
    log(`  [${new Date(c.created_at).toLocaleString('es-PE')}] Caja:${c.caja_cod} @${c.user} | detalle:${c.ndet} | ${c.observaciones || ''}`)
  if (C.conciliacion_caja === 0) log('  (sin conciliaciones)')

  sec('12. LOTES E INVENTARIO')
  sub('12.1 Inventario por sucursal (' + C.inventario + ')')
  for (const i of await listSQL(`
    SELECT i.stock_minimo, i.stock_maximo, i.punto_reorden, i.ubicacion, i.permite_venta_sin_stock,
           p.sku, p.nombre as producto, s.codigo as suc_cod
    FROM inventario i
      JOIN productos p ON p.id = i.producto_id
      JOIN sucursales s ON s.id = i.sucursal_id
    WHERE i.deleted_at IS NULL ORDER BY s.codigo, p.sku`)) {
    const f = flagTest(i.sku) || flagTest(i.producto)
    log(`  ${f}[${i.suc_cod}] ${i.sku} ${i.producto} | stMin:${i.stock_minimo || '-'} stMax:${i.stock_maximo || '-'} Reord:${i.punto_reorden || '-'} Ubic:${i.ubicacion || '-'} | ${i.permite_venta_sin_stock ? 'VentaSinStock' : ''}`)
  }
  if (C.inventario === 0) log('  (sin inventario)')

  sub('12.2 Lotes (' + C.lotes + ')')
  for (const l of await listSQL(`
    SELECT l.numero_lote, l.fecha_fabricacion, l.fecha_vencimiento, l.costo_unitario,
           l.stock_inicial, l.stock_disponible, l.stock_reservado, l.stock_bloqueado, l.estado,
           p.sku, p.nombre as producto, s.codigo as suc_cod,
           COALESCE(pr.razon_social, pr2.razon_social, '-') as prov,
           CASE WHEN dc.id IS NULL THEN 'Carga inicial/manual'
                ELSE (coalesce(c.tipo_comprobante,'?') || ' ' || coalesce(c.serie_comprobante,'') || '-' || coalesce(c.numero_comprobante,'')) END as origen
    FROM lotes l
      JOIN productos p ON p.id = l.producto_id
      JOIN sucursales s ON s.id = l.sucursal_id
      LEFT JOIN proveedores pr ON pr.id = l.proveedor_id
      LEFT JOIN detalle_compra dc ON dc.id = l.detalle_compra_id
      LEFT JOIN compras c ON c.id = dc.compra_id
      LEFT JOIN proveedores pr2 ON pr2.id = c.proveedor_id
    WHERE l.deleted_at IS NULL ORDER BY s.codigo, p.sku, l.numero_lote`)) {
    const f = flagTest(l.numero_lote) || flagTest(l.sku) || flagTest(l.producto) || flagTest(l.prov)
    const venc = new Date(l.fecha_vencimiento) < new Date() ? ' ⚠️ VENCIDO' : ''
    log(`  ${f}[${l.suc_cod}] SKU:${l.sku} Lote:${l.numero_lote} | ${l.producto} | Inic:${l.stock_inicial} Disp:${l.stock_disponible} Res:${l.stock_reservado} Bloq:${l.stock_bloqueado} | Costo:${nm(l.costo_unitario)} | FecVenc:${l.fecha_vencimiento.toISOString().slice(0,10)}${venc} | Prov:${tr(l.prov, 30)} | ${l.origen} | Estado:${l.estado}`)
  }
  if (C.lotes === 0) log('  (sin lotes)')

  sub('12.3 Movimientos Inventario (KARDEX): ' + C.movimientos_inventario)
  if (C.movimientos_inventario > 0) {
    for (const g of await listSQL(`SELECT tipo, origen, motivo_codigo, COUNT(*)::int as cnt, SUM(cantidad) as sum_cant FROM movimientos_inventario WHERE deleted_at IS NULL GROUP BY tipo, origen, motivo_codigo ORDER BY cnt DESC`))
      log(`  [${g.tipo}] origen:${g.origen} motivo:${g.motivo_codigo || '-'} → ${g.cnt} movimientos, cant total ${g.sum_cant}`)
  } else log('  (sin movimientos inventario)')

  sec('13. AUDITORIA (' + C.auditoria + ') - (A) truncar o (B) conservar')
  if (C.auditoria > 0) {
    for (const g of await listSQL(`SELECT accion, tabla, COUNT(*)::int as cnt FROM auditoria WHERE deleted_at IS NULL GROUP BY accion, tabla ORDER BY cnt DESC LIMIT 30`))
      log(`  ${g.accion} sobre ${g.tabla}: ${g.cnt} filas`)
  } else log('  (sin auditoria)')

  sec('14. PROPUESTA FINAL DE LIMPIEZA (SOLO INFORME - NADA BORRADO)')
  log(`

╔═══════════════════════════════════════════════════════════════════════════════════════╗
║  RESUMEN QUE SE BORRA / QUE NO                                                        ║
╠═══════════════════════════════════════════════════════════════════════════════════════╣
║  🚫 NO SE TOCA (100% SEGURO):                                                         ║
║    • Empresas (${C.empresas}), Sucursales (${C.sucursales})                              ║
║    • Estructura BD: NO migraciones, NO db push, NO se cambia esquema.                 ║
║    • Roles (${C.roles}), Permisos (${C.permisos}), Tipos Empresa/Módulos.              ║
║    • Configuraciones (${C.configuracion}), Series Documentos, Formas Pago, Impuestos, ║
║      Motivos Movimiento Inventario, Categorías, Laboratorios, Presentaciones, etc.    ║
║      (Si nombres de catálogos no son los que quieres, cambialos desde el Admin)       ║
║  ⚠️  REVISAR 1 A 1 (decidir por registro):                                            ║
║    • Usuarios    (${String(C.usuarios).padStart(4)}) → conservar REALES, borrar ⚠️ PRUEBA  ║
║    • Productos   (${String(C.productos).padStart(4)}) → conservar REALES botica          ║
║    • Proveedores (${String(C.proveedores).padStart(4)}) → conservar REALES               ║
║    • Clientes    (${String(C.clientes).padStart(4)}) → conservar REALES                  ║
║    • Lotes       (${String(C.lotes).padStart(4)}) → borrar si producto PRUEBA; o TODO si ║
║                       se prefiere empezar inventario de cero.                          ║
║  🗑️  TODO ELIMINAR (operacion real no ha comenzado):                                   ║
║    • Ventas         (${String(C.ventas).padStart(5)}) + detalle + lotes vta + pagos vta ║
║    • Compras        (${String(C.compras).padStart(5)}) + detalle + recepc + pagos compra ║
║    • CAJA: ${C.apertura_caja} apertura(s) ⭐ INCLUYE ABIERTA S/ 30,                     ║
║           ${C.cierre_caja} cierre(s), ${C.movimientos_caja} movs caja,                 ║
║           ${C.ingresos} ingresos, ${C.egresos} egresos,                                ║
║           ${C.arqueo_caja} arqueos, ${C.conciliacion_caja} conciliaciones              ║
║           → Definicion "Caja Principal" SE CONSERVA.                                   ║
║    • Kardex: ${C.movimientos_inventario} movimientos inventario                        ║
║  ❓ DECIDIR (A/B): Auditoría (${C.auditoria})                                           ║
║     (A) TRUNCATE RECOMENDADO → producción limpia de 0                                  ║
║     (B) conservar historial (incluye pruebas)                                          ║
╚═══════════════════════════════════════════════════════════════════════════════════════╝

👉 PARA APROBAR LIMPIEZA, RESPONDE ESTAS 6 PREGUNTAS (lo otro está decidido):

1) PRODUCTOS (${C.productos}): ¿Cuáles son REALES? Indica nombres/códigos, o di:
     "Borra TODOS los productos, empezamos de cero"
2) PROVEEDORES (${C.proveedores}): ¿Cuáles son REALES / de PRUEBA?
3) CLIENTES (${C.clientes}): ¿Cuáles son REALES / de PRUEBA?
4) CAJA ABIERTA S/ 30.00 → ¿C.1 CIERRE LÓGICO (recomendado: cierro con
     monto 30.00, dif 0, obs "Cierre limpieza pre-producción", luego
     se elimina todo) o C.2 ANULACIÓN DIRECTA?
5) LOTES/STOCK: ¿(A) Eliminar TODO lote (reinicio total, luego carga inventario
     oficial con la herramienta de Carga Inicial) o
     (B) conservar lotes SOLO de los productos que sean REALES?
6) AUDITORÍA (${C.auditoria}): (A) TRUNCAR tabla auditoría (limpia)
                           (B) conservar todo

Cuando respondas estas 6 preguntas, te armaré el script SQL de limpieza
dentro de una TRANSACCIÓN (BEGIN; ... ; opción de ROLLBACK o COMMIT final),
con backup lógico (tablas *_bak con los datos a borrar) en la misma BD, y lo
ejecutaré SÓLO con tu aprobación final.
`)

  log('FIN DEL INFORME DE DIAGNOSTICO')
}

await main()
  .catch(e => { log('ERROR: ' + e.message); log('STACK: ' + (e.stack?.slice(0, 3000) || '-')); process.exitCode = 1 })
  .finally(async () => { await prisma.$disconnect(); out.end() })
