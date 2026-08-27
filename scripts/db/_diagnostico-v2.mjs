import { config as loadEnvFile } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createWriteStream, existsSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..', '..')
const OUT = resolve(root, 'scripts', 'db', '_diagnostico-output.txt')

loadEnvFile({ path: resolve(root, '.env.production'), override: false })
process.env.RAYEGO_ENV_MODE = 'production'
process.env.RAYEGO_ENV_SOURCE = 'archivo:.env.production'

const prismaClientPath = resolve(root, 'node_modules', '@prisma', 'client', 'index.js')
const prismaUrl = 'file:///' + prismaClientPath.replace(/\\/g, '/')
const { PrismaClient } = await import(prismaUrl)
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })

const out = createWriteStream(OUT, { flags: 'w' })
function log(...a) {
  const line = a.map((x) => (typeof x === 'object' ? JSON.stringify(x, null, 0) : String(x))).join(' ')
  out.write(line + '\n')
  process.stdout.write(line + '\n')
}
const SEP = '='.repeat(80)
const SUB = '-'.repeat(80)
const sec = (t) => { log('\n' + SEP); log('  ' + String(t).toUpperCase()); log(SEP) }
const sub = (t) => { log('\n' + SUB); log('  ' + t); log(SUB) }
const tr = (s, n = 60) => { if (s == null) return '-'; const t = String(s); return t.length > n ? t.slice(0, n) + '...' : t }
const nm = (v) => {
  if (v == null) return '-'
  if (typeof v.toNumber === 'function') return v.toNumber().toFixed(2)
  return Number(v).toFixed(2)
}

function flagTest(value) {
  if (!value) return '  '
  const v = String(value).toLowerCase()
  const tokens = [
    'prueba','test','demo','ejemplo','rayego','20612345678','20654321987',
    'admin@rayego','supervisor@rayego','caja@rayego','sin.sucursal','@rayego.pe',
    'med-0001','med-0002','med-0003','med-0004',
    'paracetamol','amoxicilina','loratadina','vitamina c',
    'para-500','amox-500','lora-jbe','vitc-1000',
    'drogueria distribuidora','ddp',
    'sucursal principal','sucursal san miguel','sucursal central',
    'av. principal 123','av. la marina 845',
    '77500000000','77555555','44444444','88888888',
    'juan perez','maria lopez','luis fernandez','ana torres',
    'empresa cliente demo','botica del pueblo','botica popular','botica saucedo','saucedo',
    'generico','marca','analg','antib','vitsup','resp',
    'tab','cap','fra','amp',
    'ac farma','medifarma','bayer',
  ]
  if (tokens.some(t => v.includes(t))) return '⚠️ '
  return '  '
}

async function counts() {
  const r = {}
  const names = {
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
    arqueo_caja: 'arqueoCaja', conciliacion_caja: 'conciliacionCaja', auditoria: 'auditoria',
  }
  for (const [k, m] of Object.entries(names)) {
    try {
      r[k] = await prisma[m].count({ where: { deletedAt: null } })
    } catch { r[k] = 'N/A' }
  }
  return r
}

async function main() {
  sec('DIAGNÓSTICO BD PRODUCCIÓN RAYEGO POS - LIMPIEZA OPERACIÓN REAL')
  log('Fecha: ' + new Date().toLocaleString('es-PE'))
  const now = await prisma.$queryRawUnsafe('select now()::text t;')
  log('Hora BD: ' + now[0].t)
  const C = await counts()

  sec('0. RESUMEN RÁPIDO CONTEOS POR TABLA')
  log('GRUPO 1 — NO TOCAR')
  log('  empresas       : ' + C.empresas)
  log('  sucursales     : ' + C.sucursales)
  log('  usuarios       : ' + C.usuarios)
  log('  roles          : ' + C.roles)
  log('  permisos       : ' + C.permisos)
  log('  rol_permiso    : ' + C.rol_permiso)
  log('  tipos_empresa  : ' + C.tipos_empresa)
  log('  modulos        : ' + C.modulos)
  log('  configuracion  : ' + C.configuracion)
  log('')
  log('GRUPO 2 — CATÁLOGOS (revisar nombres; estructura OK → conservar por defecto)')
  log('  categorias     : ' + C.categorias)
  log('  laboratorios   : ' + C.laboratorios)
  log('  presentaciones : ' + C.presentaciones)
  log('  unidades_medida: ' + C.unidades_medida)
  log('  tipos_comerciales: ' + C.tipos_comerciales)
  log('  principios_activos: ' + C.principios_activos)
  log('  formas_pago    : ' + C.formas_pago)
  log('  impuestos      : ' + C.impuestos)
  log('  motivos_mov_inv: ' + C.motivos_movimiento_inventario)
  log('')
  log('GRUPO 3 — CATÁLOGOS NEGOCIO (⚠️ revisar UNO A UNO → decidir conservar/eliminar)')
  log('  productos      : ' + C.productos + '   ⚠️ ')
  log('  proveedores    : ' + C.proveedores + '   ⚠️ ')
  log('  clientes       : ' + C.clientes + '   ⚠️ ')
  log('')
  log('GRUPO 4 — CAJA (TODO de PRUEBA → eliminar)')
  log('  cajas (definición) : ' + C.cajas + '  ➡️ conservar definición, limpiar transacciones')
  log('  apertura_caja      : ' + C.apertura_caja + '   ⚠️ INCLUYE LA CAJA ABIERTA S/ 30')
  log('  cierre_caja        : ' + C.cierre_caja)
  log('  movimientos_caja   : ' + C.movimientos_caja)
  log('  ingresos           : ' + C.ingresos)
  log('  egresos            : ' + C.egresos)
  log('  arqueo_caja        : ' + C.arqueo_caja)
  log('  conciliacion_caja  : ' + C.conciliacion_caja)
  log('')
  log('GRUPO 5 — TRANSACCIONALES (TODO de PRUEBA → eliminar)')
  log('  ventas             : ' + C.ventas)
  log('  compras            : ' + C.compras)
  log('  inventario (def)   : ' + C.inventario + '   ➡️ conservar definición; resetear stock')
  log('  lotes              : ' + C.lotes + '   ⚠️ (depende de productos reales / prueba)')
  log('  movimientos_inv    : ' + C.movimientos_inventario)
  log('  auditoria          : ' + C.auditoria + '   (decidir: truncar o conservar)')

  // 1. EMPRESAS
  sec('1. EMPRESAS (NO TOCAR)')
  const rows_emp = await prisma.empresa.findMany({ where: { deletedAt: null } })
  for (const e of rows_emp) {
    const f = flagTest(e.razonSocial) || flagTest(e.numeroDocumento) || flagTest(e.nombreComercial)
    log(`  ${f}Razón Social: ${e.razonSocial} (${e.nombreComercial ?? ''})  ${e.tipoDocumento}:${e.numeroDocumento} | Modo: ${e.modoOperacion} | activo=${e.activo}`)
  }

  // 2. SUCURSALES
  sec('2. SUCURSALES (NO TOCAR)')
  const rows_suc = await prisma.sucursal.findMany({ where: { deletedAt: null },
    include: { empresa: { select: { razonSocial: true } } } })
  for (const s of rows_suc) {
    const f = flagTest(s.nombre) || flagTest(s.codigo) || flagTest(s.direccion)
    log(`  ${f}Emp: ${s.empresa.razonSocial} | ${s.codigo} - ${s.nombre} | Dir: ${s.direccion ?? '-'} | ${s.esPrincipal ? 'PRINCIPAL' : ''} activo=${s.activo}`)
  }

  // 3. USUARIOS
  sec('3. USUARIOS (validar; NO tocar REALES; borrar ⚠️ de PRUEBA)')
  const rows_usr = await prisma.usuario.findMany({ where: { deletedAt: null } })
  for (const u of rows_usr) {
    const f = flagTest(u.username) || flagTest(u.email) || flagTest(u.nombres) || flagTest(u.apellidos) || flagTest(u.numeroDocumento)
    const acc = u.ultimoAccesoAt ? u.ultimoAccesoAt.toLocaleString('es-PE') : 'NUNCA'
    log(`  ${f}@${u.username} - ${u.nombres} ${u.apellidos} | email:${u.email ?? '-'} | ${u.tipoDocumento ?? ''}:${u.numeroDocumento ?? '-'} | activo=${u.activo} | último acceso: ${acc} | id: ${u.id.slice(0,8)}...`)
  }

  // 4. ROLES / SERIES / CONFIG
  sec('4. ESTRUCTURA BASE (conservar) — Roles, Config, Series Documento')
  sub('4.1 Roles')
  for (const r of await prisma.rol.findMany({ where: { deletedAt: null } })) log(`  - ${r.codigo} : ${r.nombre} (activo=${r.activo})`)
  sub('4.2 Configuraciones')
  const rows_conf = await prisma.configuracion.findMany({ where: { deletedAt: null } })
  log('Total: ' + rows_conf.length)
  for (const c of rows_conf) {
    const v = c.valorTexto ?? (c.valorNumero != null ? c.valorNumero : c.valorBooleano) ?? '-'
    log(`  [${c.ambito}] ${c.clave} = ${tr(String(v), 100)}`)
  }
  sub('4.3 Series de Documentos por sucursal')
  const rows_ser = await prisma.serieDocumento.findMany({ where: { deletedAt: null },
    include: { sucursal: { select: { codigo: true, nombre: true, empresa: { select: { razonSocial: true } } } } })
  for (const s of rows_ser) {
    const suc = s.sucursal ? `${s.sucursal.empresa.razonSocial}/${s.sucursal.codigo} ${s.sucursal.nombre}` : 'GENERAL'
    log(`  [${suc}] ${s.tipoComprobante} ${s.serie}-${String(s.siguienteNumero).padStart(s.longitudNumero, '0')} | sig=${s.siguienteNumero} long=${s.longitudNumero} activo=${s.activo}`)
  }

  // 5. CATÁLOGOS BASE (lista completa con ⚠️)
  sec('5. CATÁLOGOS MAESTROS (estructura → conservar)')
  sub('5.1 Categorías (' + C.categorias + ')')
  for (const r of await prisma.categoria.findMany({ where: { deletedAt: null }, orderBy: { orden: 'asc' } })) {
    const f = flagTest(r.codigo) || flagTest(r.nombre)
    log(`  ${f}${r.codigo} - ${r.nombre} ${r.activo ? '' : '[INACTIVO]'}`)
  }
  sub('5.2 Laboratorios (' + C.laboratorios + ')')
  for (const r of await prisma.laboratorio.findMany({ where: { deletedAt: null } })) {
    const f = flagTest(r.codigo) || flagTest(r.nombre)
    log(`  ${f}${r.codigo} - ${r.nombre} (${r.pais ?? '-'})`)
  }
  sub('5.3 Presentaciones (' + C.presentaciones + ')')
  for (const r of await prisma.presentacion.findMany({ where: { deletedAt: null } })) {
    const f = flagTest(r.codigo) || flagTest(r.nombre)
    log(`  ${f}${r.codigo} - ${r.nombre}`)
  }
  sub('5.4 Unidades Medida (' + C.unidades_medida + ')')
  for (const r of await prisma.unidadMedida.findMany({ where: { deletedAt: null } })) {
    log(`  ${flagTest(r.codigo)}${r.codigo} - ${r.nombre} (${r.simbolo})`)
  }
  sub('5.5 Tipos Comerciales (' + C.tipos_comerciales + ')')
  for (const r of await prisma.tipoComercial.findMany({ where: { deletedAt: null } })) {
    log(`  ${flagTest(r.codigo) || flagTest(r.nombre)}${r.codigo} - ${r.nombre}`)
  }
  sub('5.6 Principios Activos (' + C.principios_activos + ')')
  for (const r of await prisma.principioActivo.findMany({ where: { deletedAt: null } })) {
    log(`  ${flagTest(r.codigo) || flagTest(r.nombre)}${r.codigo} - ${r.nombre}`)
  }
  sub('5.7 Formas Pago (' + C.formas_pago + ')')
  for (const r of await prisma.formaPago.findMany({ where: { deletedAt: null } })) {
    log(`  ${r.codigo} - ${r.nombre} | efectivo=${r.esEfectivo} digital=${r.esDigital} ref=${r.necesitaReferencia}`)
  }
  sub('5.8 Impuestos (' + C.impuestos + ')')
  for (const r of await prisma.impuesto.findMany({ where: { deletedAt: null } })) {
    log(`  ${r.codigo} - ${r.nombre} tipo=${r.tipo} ${r.porcentaje}% sunat=${r.codigoSunat ?? '-'}`)
  }
  sub('5.9 Motivos Movimiento Inventario (' + C.motivos_movimiento_inventario + ')')
  for (const r of await prisma.motivoMovimientoInventario.findMany({ where: { deletedAt: null } })) {
    log(`  ${flagTest(r.codigo)}${r.codigo} - ${r.nombre} [${r.tipo}] ${r.activo ? '' : '[INACTIVO]'}`)
  }

  // 6. PRODUCTOS (⚠️ UNO A UNO)
  sec('6. PRODUCTOS (' + C.productos + ') — ⚠️ VALIDAR UNO A UNO: REAL o PRUEBA')
  const prodRows = await prisma.producto.findMany({ where: { deletedAt: null }, orderBy: { sku: 'asc' } })
  for (const p of prodRows) {
    const f = flagTest(p.sku) || flagTest(p.nombre) || flagTest(p.codigoInterno) || flagTest(p.codigoBarras) || flagTest(p.concentracion)
    log(`  ${f}SKU:${p.sku} | Nombre: ${p.nombre} ${p.concentracion ?? ''} | Barras:${p.codigoBarras ?? '-'} Int:${p.codigoInterno ?? '-'} | PV:${nm(p.precioVenta)} PM:${nm(p.precioVentaMayor)} CUC:${nm(p.costoUltimoCompra)} CPP:${nm(p.costoPromedioPonderado)} | Receta:${p.requiereReceta} StockMin:${p.stockMinimoGlobal ?? '-'} Estado:${p.estado}`)
  }
  if (prodRows.length === 0) log('  (sin productos)')

  // 7. PROVEEDORES (⚠️)
  sec('7. PROVEEDORES (' + C.proveedores + ') — ⚠️ VALIDAR UNO A UNO')
  const provRows = await prisma.proveedor.findMany({ where: { deletedAt: null }, orderBy: { razonSocial: 'asc' } })
  for (const p of provRows) {
    const f = flagTest(p.numeroDocumento) || flagTest(p.razonSocial) || flagTest(p.nombreComercial) || flagTest(p.email) || flagTest(p.contactoTelefono) || flagTest(p.direccion)
    const ubic = [p.pais,p.departamento,p.provincia,p.distrito,p.direccion].filter(Boolean).join('/') || '-'
    const cred = p.permiteCredito ? `LIM:${nm(p.limiteCredito)} SALDO:${nm(p.saldoPendiente)}` : 'SIN-CREDITO'
    log(`  ${f}${p.tipoDocumento}:${p.numeroDocumento} - ${p.razonSocial} (${p.nombreComercial ?? '-'}) | Contacto: ${p.contactoNombre ?? '-'} Tlf:${p.contactoTelefono ?? '-'} Email:${p.email ?? '-'} | ${ubic} | ${cred} | activo=${p.activo}`)
  }
  if (provRows.length === 0) log('  (sin proveedores)')

  // 8. CLIENTES (⚠️)
  sec('8. CLIENTES (' + C.clientes + ') — ⚠️ VALIDAR UNO A UNO')
  const cliRows = await prisma.cliente.findMany({ where: { deletedAt: null } })
  for (const c of cliRows) {
    const nom = c.nombreCompleto || c.razonSocial || `${c.nombres ?? ''} ${c.apellidos ?? ''}`.trim()
    const doc = c.tipoDocumento && c.numeroDocumento ? `${c.tipoDocumento}:${c.numeroDocumento}` : 'sin-doc'
    const f = flagTest(nom) || flagTest(c.email) || flagTest(c.telefono) || flagTest(c.numeroDocumento) || flagTest(c.razonSocial)
    const cred = c.permitirCredito ? `LIM:${nm(c.limiteCredito)} SALDO:${nm(c.saldoPendiente)}` : 'SIN-CREDITO'
    log(`  ${f}${doc} - ${nom} | Email:${c.email ?? '-'} Tlf:${c.telefono ?? '-'} Dir:${c.direccion ?? '-'} | ${cred} | activo=${c.activo}`)
  }
  if (cliRows.length === 0) log('  (sin clientes)')

  // 9. COMPRAS
  sec('9. COMPRAS (' + C.compras + ') — (TODO de PRUEBA → eliminar)')
  const comps = await prisma.compra.findMany({ where: { deletedAt: null },
    include: { proveedor: true, sucursal: true, usuarioResponsable: true,
      _count: { select: { detalles: true, pagos: true, recepciones: true } } }, orderBy: { fechaEmision: 'desc' } })
  for (const c of comps) {
    const f = flagTest(c.proveedor?.razonSocial) || flagTest(c.proveedor?.numeroDocumento) || flagTest(c.observaciones)
    const comp = `${c.tipoComprobante ?? 'SIN-TIPO'} ${c.serieComprobante ?? ''}-${c.numeroComprobante ?? ''}`
    log(`  ${f}${comp} | ${c.fechaEmision.toLocaleString('es-PE')} | ${c.sucursal?.codigo ?? '?'} | Prov: ${tr(c.proveedor?.razonSocial || '?',40)} | Resp: @${c.usuarioResponsable?.username ?? '?'} | Sub:${nm(c.subtotal)} Desc:${nm(c.descuentoTotal)} Igv:${nm(c.impuestoTotal)} Tot:${nm(c.total)} Saldo:${nm(c.saldoPendiente)} | Estado:${c.estado} Log:${c.estadoLogistico} Fin:${c.estadoFinanciero} | items:${c._count.detalles} pagos:${c._count.pagos} rec:${c._count.recepciones} obs:${tr(c.observaciones,60)}`)
  }
  if (comps.length === 0) log('  (sin compras)')

  // 10. VENTAS
  sec('10. VENTAS (' + C.ventas + ') — (TODO de PRUEBA → eliminar)')
  const vts = await prisma.venta.findMany({ where: { deletedAt: null },
    include: { cliente: true, sucursal: true, usuarioResponsable: true, cajaApertura: true,
      _count: { select: { detalles: true, pagos: true } } }, orderBy: { fechaEmision: 'desc' } })
  for (const v of vts) {
    const cli = v.cliente ? (v.cliente.nombreCompleto || v.cliente.razonSocial || `${v.cliente.tipoDocumento}:${v.cliente.numeroDocumento}`) : 'GENERICO'
    const f = flagTest(cli) || flagTest(v.usuarioResponsable?.username) || flagTest(v.observaciones)
    const comp = `${v.tipoComprobante} ${v.serie ?? ''}-${v.numero ?? ''}`
    const caja = v.cajaApertura ? `Apertura:${v.cajaApertura.estado} Caja:${v.cajaApertura.id.slice(0,8)}` : 'SIN-CAJA'
    log(`  ${f}${comp} | ${v.fechaEmision.toLocaleString('es-PE')} | ${v.sucursal?.codigo ?? '?'} | Cli: ${tr(cli,40)} | Resp: @${v.usuarioResponsable?.username ?? '?'} | ${caja} | Sub:${nm(v.subtotal)} Desc:${nm(v.descuentoTotal)} Igv:${nm(v.impuestoTotal)} Tot:${nm(v.total)} Vuelto:${nm(v.vuelto)} Saldo:${nm(v.saldoPendiente)} | ${v.estado} Ent:${v.estadoEntrega} Pag:${v.estadoPago} | items:${v._count.detalles} pagos:${v._count.pagos} obs:${tr(v.observaciones,60)}`)
  }
  if (vts.length === 0) log('  (sin ventas)')

  // 11. CAJA (prioridad)
  sec('11. CAJA — (PRIORIDAD: caja abierta con S/30)')
  sub('11.1 Definición de cajas (' + C.cajas + ')')
  for (const c of await prisma.caja.findMany({ where: { deletedAt: null }, include: { sucursal: { include: { empresa: true } } } })) {
    const f = flagTest(c.codigo) || flagTest(c.nombre) || flagTest(c.descripcion)
    log(`  ${f}${c.codigo} - ${c.nombre} (${c.descripcion ?? '-'}) | ${c.sucursal.empresa.razonSocial}/${c.sucursal.codigo} ${c.sucursal.nombre} | Estado:${c.estado}`)
  }

  sub('11.2 APERTURAS DE CAJA (' + C.apertura_caja + ') — INCLUYE ABIERTA CON S/ 30')
  const aps = await prisma.aperturaCaja.findMany({ where: { deletedAt: null },
    include: {
      caja: { include: { sucursal: { include: { empresa: true } } } },
      usuario: true,
      cierre: true,
    }, orderBy: { fechaApertura: 'desc' } })
  for (const a of aps) {
    const est = a.estado === 'ABIERTA' ? '🔴 ABIERTA' : a.estado
    const cierre = a.cierre ? `✅ Cerrada: ${a.cierre.fechaCierre.toLocaleString('es-PE')} sist:${nm(a.cierre.montoSistemaEfectivo)} dec:${nm(a.cierre.montoDeclaradoEfectivo)} dif:${nm(a.cierre.diferenciaEfectivo)} ${a.cierre.observaciones ? 'obs: '+tr(a.cierre.observaciones, 60) : ''}` : '⚠️ AÚN ABIERTA — SIN CIERRE'
    log(`  ${est} | ${a.caja.sucursal.empresa.razonSocial}/${a.caja.sucursal.codigo}/${a.caja.codigo} ${a.caja.nombre} | Apertura: ${a.fechaApertura.toLocaleString('es-PE')} | Usuario: @${a.usuario.username} (${a.usuario.nombres} ${a.usuario.apellidos}) | Fondo Efectivo: S/ ${nm(a.montoAperturaEfectivo)} | cierrePendiente:${a.cierrePendiente} | ${cierre}`)
    if (a.observaciones) log(`     Obs apertura: ${a.observaciones}`)
  }

  const abiertas = aps.filter(a => a.estado === 'ABIERTA')
  log('\n🚨 CAJAS ACTIVAS (ABIERTA): ' + abiertas.length)
  for (const a of abiertas) {
    log('\n  ============= DETALLE CAJA ABIERTA =============')
    log(`  Caja: ${a.caja.codigo} - ${a.caja.nombre} | Sucursal: ${a.caja.sucursal.empresa.razonSocial}/${a.caja.sucursal.codigo} ${a.caja.sucursal.nombre}`)
    log(`  Abierta por: @${a.usuario.username} - ${a.usuario.nombres} ${a.usuario.apellidos}`)
    log(`  Fecha/hora : ${a.fechaApertura.toLocaleString('es-PE')} (${a.fechaApertura.toISOString()})`)
    log(`  Fondo inicial EFECTIVO: S/ ${nm(a.montoAperturaEfectivo)}  ⭐ (coincide con S/ 30.00 que mencionaste)`)
    log(`  Flag cierre pendiente: ${a.cierrePendiente}`)
    if (a.observaciones) log(`  Observaciones: ${a.observaciones}`)
    log('\n  >> MOVIMIENTOS DE CAJA EN ESTA APERTURA:')
    const movs = await prisma.movimientoCaja.findMany({ where: { aperturaCajaId: a.id, deletedAt: null },
      include: { formaPago: true, ventaPago: { include: { venta: true } }, ingreso: true, egreso: true },
      orderBy: { fechaMovimiento: 'asc' } })
    let saldoEf = Number(a.montoAperturaEfectivo || 0)
    log(`  Total movs: ${movs.length}`)
    for (let i = 0; i < movs.length; i++) {
      const m = movs[i]
      const sg = m.operacion === 'INGRESO' ? '+' : '-'
      const mn = Number(m.monto)
      if (m.formaPago?.esEfectivo) saldoEf += (m.operacion === 'INGRESO' ? mn : -mn)
      const fp = m.formaPago ? `${m.formaPago.codigo}${m.formaPago.esEfectivo ? '(EFE)':''}` : '???'
      let vin = ''
      if (m.ventaPago) vin = `PagoVta#${m.ventaPago.id} (${m.ventaPago.venta.tipoComprobante} ${m.ventaPago.venta.serie ?? ''}-${m.ventaPago.venta.numero ?? ''})`
      else if (m.ingreso) vin = `INGRESO concepto="${tr(m.ingreso.concepto, 80)}" ref="${m.ingreso.referencia ?? ''}"`
      else if (m.egreso) vin = `EGRESO concepto="${tr(m.egreso.concepto, 80)}" ref="${m.egreso.referencia ?? ''}"`
      else vin = `${m.tipo ?? '?'} ref="${m.referencia ?? ''}"`
      log(`   ${String(i+1).padStart(2,' ')}. [${m.fechaMovimiento.toLocaleString('es-PE')}] ${(m.tipo ?? '').padEnd(18)} ${sg}${nm(m.monto)} | FP:${fp.padEnd(15)} | Saldo EFE: ${saldoEf.toFixed(2)} | ${vin}`)
    }
    log(`\n  🏁 SALDO EFECTIVO FINAL (calculado): S/ ${saldoEf.toFixed(2)}`)
    log(`     (Si fondo = 30, y no hay movs → 30.00, que coincide con lo que indicaste: esperado 30, contado 30)`)
  }

  sub('11.3 Arqueos en aperturas (' + C.arqueo_caja + ')')
  const arq = await prisma.arqueoCaja.findMany({ where: { deletedAt: null }, include: { aperturaCaja: { include: { caja: true, usuario: true } }, usuario: true } })
  for (const a of arq) log(`  [${a.createdAt.toLocaleString('es-PE')}] ${a.aperturaCaja.caja.codigo} ${a.aperturaCaja.estado} | @${a.usuario.username} | Decl:${nm(a.totalDeclaradoEfectivo)} Sist:${nm(a.totalSistemaEfectivo)} Dif:${nm(a.diferenciaEfectivo)} obs:${tr(a.observaciones, 60)}`)
  if (arq.length === 0) log('  (sin arqueos)')
  sub('11.4 Conciliaciones (' + C.conciliacion_caja + ')')
  const conc = await prisma.conciliacionCaja.findMany({ where: { deletedAt: null }, include: { aperturaCaja: { include: { caja: true } }, usuario: true, _count: { select: { detalles: true } } } })
  for (const c of conc) log(`  [${c.createdAt.toLocaleString('es-PE')}] ${c.aperturaCaja.caja.codigo} | @${c.usuario.username} | det:${c._count.detalles} obs:${tr(c.observaciones,60)}`)
  if (conc.length === 0) log('  (sin conciliaciones)')

  // 12. LOTES + INVENTARIO
  sec('12. LOTES E INVENTARIO')
  sub('12.1 Inventario por sucursal (' + C.inventario + ')')
  for (const inv of await prisma.inventario.findMany({ where: { deletedAt: null },
    include: { producto: true, sucursal: true } })) {
    const f = flagTest(inv.producto.sku) || flagTest(inv.producto.nombre)
    log(`  ${f}[${inv.sucursal.codigo}] ${inv.producto.sku} ${inv.producto.nombre} | stMin:${inv.stockMinimo ?? '-'} stMax:${inv.stockMaximo ?? '-'} reord:${inv.puntoReorden ?? '-'} ubi:${inv.ubicacion ?? '-'} | ${inv.permiteVentaSinStock ? 'permite VentaSinStock' : ''}`)
  }
  if (C.inventario === 0) log('  (sin filas inventario)')

  sub('12.2 Lotes (' + C.lotes + ')')
  const lotes = await prisma.lote.findMany({ where: { deletedAt: null }, include: { producto: true, sucursal: true, proveedor: true, detalleCompra: { include: { compra: true } } } })
  for (const l of lotes) {
    const f = flagTest(l.numeroLote) || flagTest(l.producto.sku) || flagTest(l.producto.nombre) || flagTest(l.proveedor?.razonSocial) || flagTest(l.detalleCompra?.compra?.proveedor?.razonSocial)
    const ven = new Date(l.fechaVencimiento) < new Date() ? ' ⚠️ VENCIDO' : ''
    const origen = l.detalleCompra ? `Compra ${l.detalleCompra.compra.tipoComprobante ?? '?'} ${l.detalleCompra.compra.serieComprobante ?? ''}-${l.detalleCompra.compra.numeroComprobante ?? ''}` : 'Carga inicial/manual'
    log(`  ${f}[${l.sucursal.codigo}] SKU:${l.producto.sku} Lote:${l.numeroLote} | ${l.producto.nombre} | Inic:${l.stockInicial} Disp:${l.stockDisponible} Res:${l.stockReservado} Bloq:${l.stockBloqueado} | Costo:${nm(l.costoUnitario)} | Venc:${l.fechaVencimiento.toISOString().slice(0,10)}${ven} | ${origen}`)
  }
  if (C.lotes === 0) log('  (sin lotes)')

  sub('12.3 Movimientos Inventario (KARDEX): ' + C.movimientos_inventario)
  if (C.movimientos_inventario > 0) {
    try {
      const g = await prisma.$queryRawUnsafe(`
        SELECT tipo, origen, motivo_codigo, COUNT(*)::int cnt, SUM(cantidad) sum_cant
        FROM movimientos_inventario WHERE deleted_at IS NULL
        GROUP BY tipo, origen, motivo_codigo ORDER BY cnt DESC;
      `)
      for (const r of g) log(`  [${r.tipo}] origen:${r.origen} motivo:${r.motivo_codigo ?? '-'} → ${r.cnt} movimientos, cant total ${r.sum_cant}`)
    } catch (e) { log('  error: ' + e.message) }
  } else log('  (sin movimientos inventario)')

  // 13. AUDITORIA
  sec('13. AUDITORÍA (' + C.auditoria + ') — (decidir: truncar o conservar)')
  if (C.auditoria > 0) {
    try {
      const g = await prisma.$queryRawUnsafe(`
        SELECT accion, tabla, COUNT(*)::int cnt
        FROM auditoria WHERE deleted_at IS NULL GROUP BY accion, tabla ORDER BY cnt DESC LIMIT 30;
      `)
      for (const r of g) log(`  ${r.accion} sobre ${r.tabla}: ${r.cnt} filas`)
    } catch (e) { log('  error: ' + e.message) }
  } else log('  (sin auditoria)')

  // 14. PROPUESTA FINAL Y PREGUNTAS PARA APROBAR LIMPIEZA
  sec('14. PROPUESTA FINAL DE LIMPIEZA (SÓLO INFORME — NADA BORRADO)')
  log(`

╔═══════════════════════════════════════════════════════════════════════════════╗
║  RESUMEN QUÉ SE BORRA / QUÉ NO                                                ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  🚫 NO SE TOCA (100% SEGURO):                                                 ║
║    • Empresas, Sucursales, Estructura BD (schema/migraciones NO se tocan)    ║
║    • Roles, Permisos, Tipos Empresa / Módulos Plataforma                     ║
║    • Configuraciones del Sistema, Series Documento                           ║
║    • Formas Pago, Impuestos, Motivos Movimiento Inv.                         ║
║    • Catálogos base: Categorías, Laboratorios, Presentaciones,               ║
║      Unidades Medida, Tipos Comerciales, Principios Activos.                 ║
║        (Si alguno de los nombres no te gusta, lo cambias desde el Admin,     ║
║         NO requieren limpieza.)                                              ║
║  ⚠️  REVISAR UNO A UNO (decidir por registro):                               ║
║    • Usuarios (${C.usuarios} totales) → conservar REALES, borrar ⚠️ PRUEBA     ║
║    • Productos (${C.productos}) → conservar REALES de tu botica                ║
║    • Proveedores (${C.proveedores}) → conservar REALES                         ║
║    • Clientes (${C.clientes}) → conservar REALES                               ║
║    • Lotes (${C.lotes}) → borrar sólo si producto es PRUEBA o si todo lote    ║
║           es de prueba. Si hay productos REALES con lotes de prueba → TÚ     ║
║           decides si borrar el lote y volver a cargar inventario real.       ║
║  🗑️  TODO ELIMINAR (porque NO hay operación real aún):                       ║
║    • Ventas (${String(C.ventas).padStart(5)})  + detalle + lotes de venta + pagos venta  ║
║    • Compras (${String(C.compras).padStart(5)}) + detalle + recepciones + pagos compra   ║
║    • CAJA: ${C.apertura_caja} apertura(s) (⭐ INCLUYE la ABIERTA con S/ 30),  ║
║           ${C.cierre_caja} cierre(s), ${C.movimientos_caja} movimientos,     ║
║           ${C.ingresos} ingresos, ${C.egresos} egresos,                       ║
║           ${C.arqueo_caja} arqueos, ${C.conciliacion_caja} conciliaciones    ║
║           → (la definición "Caja Principal" SE CONSERVA)                     ║
║    • ${C.movimientos_inventario} movimientos inventario (kardex)              ║
║  ❓ DECIDIR (opciones A/B):                                                   ║
║    • Auditoría (${C.auditoria} registros):                                    ║
║         A) TRUNCATE (recomendado, producción LIMPIA de 0)                    ║
║         B) conservar (mantener historial de acciones de prueba)              ║
╚═══════════════════════════════════════════════════════════════════════════════╝

👉 PARA APROBAR LIMPIEZA RESPONDE ESTAS 6 PREGUNTAS:

1) PRODUCTOS (${C.productos}): ¿Son REALES o DE PRUEBA? Enumerar cuáles conservar o
   di "borra TODOS los productos, empezamos de cero".
2) PROVEEDORES (${C.proveedores}): ¿Cuáles son REALES / de PRUEBA?
3) CLIENTES (${C.clientes}): ¿Cuáles son REALES / de PRUEBA?
4) CAJA ABIERTA S/ 30: ¿Cómo proceder? → Recomiendo C.1 CIERRE LÓGICO FORMAL
     C.1 CIERRE LÓGICO: cierro con fecha ahora, monto declarado 30.00,
         sist 30.00, dif 0, observación "Cierre de limpieza pre-producción".
         Luego se borran todas las aperturas (incluida la recién cerrada).
     C.2 ANULACIÓN DIRECTA: borro directamente la apertura + su movimiento.
     (Cuál eliges?)
5) LOTES/STOCK: ¿Eliminar TODO lote (limpieza total, luego se carga inventario
   real con el módulo de Carga Inicial oficial), o conservar lotes de productos
   REALES y sólo eliminar lotes de productos de PRUEBA?
6) AUDITORÍA (${C.auditoria}): Truncar (A) o conservar (B)?

Cuando respondas estas 6 preguntas, preparo el script de limpieza en SQL (dentro
de una TRANSACCIÓN con BEGIN / posibilidad de ROLLBACK / COMMIT final), con
backup lógico de las tablas a borrar (SELECT INTO tablas backup _bak dentro de
la misma BD), y lo ejecuto SÓLO con tu aprobación final. No ejecuto migraciones,
no hago db push, solo DELETE/TRUNCATE ordenados por FK en orden seguro.
`)
  log('FIN DEL INFORME DIAGNÓSTICO')
}

await main()
  .catch(e => { log('ERROR: ' + e.message); log('STACK: ' + (e.stack?.slice(0, 3000) || '-')); process.exitCode = 1 })
  .finally(async () => { await prisma.$disconnect(); out.end() })
