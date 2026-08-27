import { config as loadEnvFile } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createWriteStream } from 'node:fs'

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
  const line = a.map((x) => (typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x))).join(' ')
  out.write(line + '\n')
  process.stdout.write(line + '\n')
}

const SEP = '='.repeat(80)
const SUB = '-'.repeat(80)
const sec = (t) => { log(`\n${SEP}`); log(`  ${String(t).toUpperCase()}`); log(SEP) }
const sub = (t) => { log(`\n${SUB}`); log(`  ${t}`); log(SUB) }

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
    'sucursal principal','sucursal san miguel',
    'av. principal 123','av. la marina 845',
    '77500000000','77555555','44444444','88888888',
    'juan perez','maria lopez','luis fernandez','ana torres',
    'empresa cliente demo','botica del pueblo','botica popular',
    'botica saucedo','saucedo',
    'generico','marca','analg','antib','vitsup','resp',
    'tab','cap','fra','amp',
    'ac farma','medifarma','bayer',
  ]
  if (tokens.some((t) => v.includes(t))) return '⚠️ '
  return '  '
}

function trunc(s, n = 60) {
  if (s == null) return '-'
  const t = String(s)
  return t.length > n ? t.slice(0, n) + '...' : t
}

function num(v) {
  if (v == null) return '-'
  if (typeof v.toNumber === 'function') return v.toNumber().toFixed(2)
  return Number(v).toFixed(2)
}

async function main() {
  sec('Diagnóstico de Base de Datos Producción - Limpieza Operación Real')
  log('Fecha: ' + new Date().toLocaleString('es-PE'))
  log('BD: Railway PostgreSQL | env: .env.production')
  const now = await prisma.$queryRawUnsafe(`select now()::text as t;`)
  log('Hora servidor BD: ' + now[0].t)

  // ------------------------------------------------------------------
  // GRUPO 1 — NO ELIMINAR
  // ------------------------------------------------------------------
  sec('1. DATOS MAESTROS - NO ELIMINAR (Validar todos)')

  sub('1.1 Empresas')
  const empresas = await prisma.empresa.findMany({ where: { deletedAt: null },
    select: { id:true, razonSocial:true, nombreComercial:true, tipoDocumento:true, numeroDocumento:true, email:true, modoOperacion:true, activo:true }, orderBy: { razonSocial:'asc' } })
  log(`Total empresas: ${empresas.length}`)
  for (const e of empresas) {
    const f = flagTest(e.razonSocial) || flagTest(e.numeroDocumento) || flagTest(e.nombreComercial) || flagTest(e.email)
    log(`  ${f}[${e.modoOperacion}] ${e.tipoDocumento}:${e.numeroDocumento} - ${e.razonSocial} (${e.nombreComercial ?? '-'}) | ${e.email ?? '-'} | ${e.activo ? 'ACTIVO' : 'INACTIVO'} | id=${e.id.slice(0,8)}...`)
  }

  sub('1.2 Sucursales')
  const sucursales = await prisma.sucursal.findMany({ where: { deletedAt: null },
    select: { id:true, codigo:true, nombre:true, direccion:true, esPrincipal:true, activo:true,
      empresa: { select: { razonSocial:true } } }, orderBy: [{ empresa: { razonSocial: 'asc' } }, { codigo: 'asc' }] })
  log(`Total sucursales: ${sucursales.length}`)
  for (const s of sucursales) {
    const f = flagTest(s.nombre) || flagTest(s.direccion) || flagTest(s.codigo)
    log(`  ${f}[${s.empresa.razonSocial}] ${s.codigo} - ${s.nombre} | Dir: ${s.direccion ?? '-'} | ${s.esPrincipal ? 'PRINCIPAL' : ''} | ${s.activo ? 'ACTIVO' : 'INACTIVO'} | id=${s.id.slice(0,8)}...`)
  }

  sub('1.3 Usuarios')
  const usuarios = await prisma.usuario.findMany({ where: { deletedAt: null },
    select: { id:true, username:true, email:true, nombres:true, apellidos:true, tipoDocumento:true, numeroDocumento:true, activo:true, ultimoAccesoAt:true,
      sucursalPrincipal: { select: { codigo:true, nombre:true, empresa: { select: { razonSocial:true } } } },
      roles: { select: { rol: { select: { codigo:true, nombre:true } } } } },
    orderBy: { username: 'asc' } })
  log(`Total usuarios: ${usuarios.length}`)
  for (const u of usuarios) {
    const f = flagTest(u.username) || flagTest(u.email) || flagTest(u.nombres) || flagTest(u.apellidos) || flagTest(u.numeroDocumento)
    const acc = u.ultimoAccesoAt ? u.ultimoAccesoAt.toLocaleString('es-PE') : 'NUNCA'
    const rs = u.sucursalPrincipal ? `[${u.sucursalPrincipal.empresa.razonSocial}/${u.sucursalPrincipal.codigo}]` : '[SIN-SUCURSAL]'
    const rls = u.roles.map(r => `${r.rol.codigo}:${r.rol.nombre}`).join(' | ') || 'SIN-ROLES'
    log(`  ${f}@${u.username} - ${u.nombres} ${u.apellidos} | ${u.email ?? '-'} | ${u.tipoDocumento??''}:${u.numeroDocumento ?? '-'} | ${rs} | roles: ${rls} | ${u.activo ? 'ACTIVO' : 'INACTIVO'} | último acceso: ${acc}`)
  }

  sub('1.4 Roles / Permisos')
  const roles = await prisma.rol.findMany({ where: { deletedAt: null }, select: { id:true, codigo:true, nombre:true, activo:true, _count: { select: { rolPermisos: true, usuarios: true } } } })
  const permisos = await prisma.permiso.count({ where: { deletedAt: null, activo: true } })
  const rolPermisos = await prisma.rolPermiso.count({ where: { deletedAt: null } })
  log(`Roles: ${roles.length}`)
  for (const r of roles) log(`  - ${r.codigo}: ${r.nombre} (${r.activo ? 'ACTIVO':'INACTIVO'}) | permisos: ${r._count.rolPermisos} | usuarios: ${r._count.usuarios}`)
  log(`Permisos activos: ${permisos}`)
  log(`Asignaciones rol-permiso: ${rolPermisos}`)

  sub('1.5 Tipos Empresa / Módulos')
  const tiposEmp = await prisma.tipoEmpresa.findMany({ where: { deletedAt: null }, select: { codigo:true, nombre:true, activo:true } })
  const modulos = await prisma.modulo.count({ where: { deletedAt: null, activo: true } })
  log(`Tipos Empresa: ${tiposEmp.length}`)
  tiposEmp.forEach(t => log(`  - ${t.codigo}: ${t.nombre}`))
  log(`Módulos plataforma activos: ${modulos}`)

  sub('1.6 Configuración del Sistema')
  const conf = await prisma.configuracion.findMany({ where: { deletedAt: null }, select: { ambito:true, clave:true, valorTexto:true, valorBooleano:true, valorNumero:true } })
  log(`Total configuraciones: ${conf.length}`)
  if (conf.length === 0) log('  (Sin configuraciones definidas)')
  conf.forEach(c => {
    const v = c.valorTexto ?? (c.valorNumero != null ? String(c.valorNumero) : c.valorBooleano != null ? String(c.valorBooleano) : '-')
    log(`  [${c.ambito}] ${c.clave} = ${trunc(v, 100)}`)
  })

  sub('1.7 Series de Documentos')
  const series = await prisma.serieDocumento.findMany({ where: { deletedAt: null },
    select: { id:true, tipoComprobante:true, serie:true, siguienteNumero:true, longitudNumero:true, activo:true,
      sucursal: { select: { codigo:true, nombre:true, empresa: { select: { razonSocial:true } } } } })
  log(`Total series: ${series.length}`)
  if (series.length === 0) log('  (Sin series definidas)')
  series.forEach(s => {
    const suc = s.sucursal ? `[${s.sucursal.empresa.razonSocial}/${s.sucursal.codigo}]` : '[GENERAL]'
    log(`  ${suc} ${s.tipoComprobante} Ser:${s.serie} | siguiente: ${s.siguienteNumero} | longitud: ${s.longitudNumero} | ${s.activo ? 'ACTIVO' : 'INACTIVO'}`)
  })

  // ------------------------------------------------------------------
  // GRUPO 2 — CATÁLOGOS MAESTROS A EVALUAR
  // ------------------------------------------------------------------
  sec('2. CATÁLOGOS MAESTROS - EVALUAR (estructura base del seed)')

  const cats = ['categorias', 'laboratorios', 'presentaciones', 'unidades_medida', 'tipos_comerciales', 'principios_activos', 'formas_pago', 'impuestos', 'motivos_movimiento_inventario']
  for (const c of cats) {
    sub(`2.x Catálogo: ${c}`)
    try {
      const mapTable = {
        categorias: { model: 'categoria', fields: ['codigo', 'nombre', 'descripcion', 'activo'] },
        laboratorios: { model: 'laboratorio', fields: ['codigo', 'nombre', 'pais', 'activo'] },
        presentaciones: { model: 'presentacion', fields: ['codigo', 'nombre', 'activo'] },
        unidades_medida: { model: 'unidadMedida', fields: ['codigo', 'nombre', 'simbolo', 'activo'] },
        tipos_comerciales: { model: 'tipoComercial', fields: ['codigo', 'nombre', 'activo'] },
        principios_activos: { model: 'principioActivo', fields: ['codigo', 'nombre', 'activo'] },
        formas_pago: { model: 'formaPago', fields: ['codigo', 'nombre', 'descripcion', 'activo', 'necesitaReferencia', 'esDigital', 'esEfectivo'] },
        impuestos: { model: 'impuesto', fields: ['codigo', 'nombre', 'tipo', 'porcentaje', 'activo', 'codigoSunat'] },
        motivos_movimiento_inventario: { model: 'motivoMovimientoInventario', fields: ['codigo', 'nombre', 'tipo', 'descripcion', 'activo'] },
      }
      const m = mapTable[c]
      const rows = await prisma[m.model].findMany({ where: { deletedAt: null } })
      log(`Total: ${rows.length}`)
      if (rows.length === 0) log('  (vacío)')
      for (const r of rows.slice(0, 50)) {
        const main = m.fields[1] || 'nombre'
        const f = flagTest(r.codigo) || flagTest(r[main]) || flagTest(r.nombre)
        const detalle = m.fields.filter(f => f !== 'id' && f !== 'deletedAt').map(f => `${f}:${trunc(r[f], 40)}`).join(' | ')
        log(`  ${f}${detalle}`)
      }
      if (rows.length > 50) log(`  ... (${rows.length - 50} más, lista disponible en BD)`)
    } catch (e) {
      log(`  ERROR: ${e.message.slice(0, 200)}`)
    }
  }

  // ------------------------------------------------------------------
  // GRUPO 2.2 — PRODUCTOS, PROVEEDORES, CLIENTES (evaluar ⚠️)
  // ------------------------------------------------------------------
  sec('3. CATÁLOGOS A VALIDAR UNO A UNO: Productos / Proveedores / Clientes')

  sub('3.1 Productos')
  const productos = await prisma.producto.findMany({ where: { deletedAt: null },
    select: { id:true, sku:true, codigoInterno:true, codigoBarras:true, nombre:true, concentracion:true,
      estado:true, requiereReceta:true, stockMinimoGlobal:true,
      precioVenta:true, precioVentaMayor:true, costoUltimoCompra:true, costoPromedioPonderado:true,
      categoria: { select: { codigo:true, nombre:true } },
      laboratorio: { select: { codigo:true, nombre:true } },
      presentacion: { select: { codigo:true, nombre:true } },
      principioActivo: { select: { codigo:true, nombre:true } },
      unidadMedidaVenta: { select: { codigo:true, nombre:true } },
      _count: { select: { lotes: true, inventarios: true } },
    }, orderBy: { sku: 'asc' } })
  log(`Total productos: ${productos.length}`)
  for (const p of productos) {
    const f = flagTest(p.sku) || flagTest(p.nombre) || flagTest(p.codigoInterno) || flagTest(p.codigoBarras) || flagTest(p.categoria?.nombre) || flagTest(p.laboratorio?.nombre) || flagTest(p.presentacion?.nombre) || flagTest(p.principioActivo?.nombre)
    const cat = p.categoria?.nombre ?? '-'
    const lab = p.laboratorio?.nombre ?? '-'
    const pres = p.presentacion?.nombre ?? '-'
    const pa = p.principioActivo?.nombre ?? '-'
    log(`  ${f}${p.sku} | ${p.nombre} ${p.concentracion ?? ''} | pvp:${num(p.precioVenta)} pvm:${num(p.precioVentaMayor)} cuc:${num(p.costoUltimoCompra)} cpp:${num(p.costoPromedioPonderado)} | Cat:${cat} Lab:${lab} Pres:${pres} PA:${pa} | lotes:${p._count.lotes} inventarios:${p._count.inventarios} | ${p.estado} | stockMinGlob:${p.stockMinimoGlobal ?? '-'} | receta:${p.requiereReceta}`)
  }

  sub('3.2 Proveedores')
  const proveedores = await prisma.proveedor.findMany({ where: { deletedAt: null },
    select: { id:true, tipoDocumento:true, numeroDocumento:true, razonSocial:true, nombreComercial:true,
      contactoNombre:true, contactoTelefono:true, email:true, activo:true, permiteCredito:true, limiteCredito:true, saldoPendiente:true,
      pais:true, departamento:true, provincia:true, distrito:true, direccion:true,
      _count: { select: { compras: true, lotes: true } } }, orderBy: { razonSocial: 'asc' } })
  log(`Total proveedores: ${proveedores.length}`)
  for (const pr of proveedores) {
    const f = flagTest(pr.numeroDocumento) || flagTest(pr.razonSocial) || flagTest(pr.nombreComercial) || flagTest(pr.email) || flagTest(pr.contactoTelefono) || flagTest(pr.direccion)
    const ubigeo = [pr.pais, pr.departamento, pr.provincia, pr.distrito, pr.direccion].filter(Boolean).join('/') || '-'
    const cred = pr.permiteCredito ? `LIM:${num(pr.limiteCredito)} SALDO:${num(pr.saldoPendiente)}` : 'SIN-CREDITO'
    log(`  ${f}${pr.tipoDocumento}:${pr.numeroDocumento} - ${pr.razonSocial} (${pr.nombreComercial ?? '-'}) | Contacto: ${pr.contactoNombre ?? '-'} ${pr.contactoTelefono ?? '-'} ${pr.email ?? '-'} | Ubic: ${ubigeo} | ${cred} | compras:${pr._count.compras} lotes:${pr._count.lotes} | ${pr.activo ? 'ACTIVO':'INACTIVO'}`)
  }

  sub('3.3 Clientes')
  const clientes = await prisma.cliente.findMany({ where: { deletedAt: null },
    select: { id:true, tipoDocumento:true, numeroDocumento:true, nombres:true, apellidos:true, razonSocial:true, nombreCompleto:true,
      email:true, telefono:true, direccion:true, permitirCredito:true, limiteCredito:true, saldoPendiente:true, activo:true,
      clienteTipo: true,
      _count: { select: { ventas: true } } }, orderBy: [{ apellidos: 'asc' }, { razonSocial: 'asc' }] })
  log(`Total clientes: ${clientes.length}`)
  if (clientes.length === 0) log('  (Sin clientes)')
  for (const c of clientes) {
    const nombre = c.nombreCompleto || c.razonSocial || `${c.nombres ?? ''} ${c.apellidos ?? ''}`.trim()
    const doc = c.tipoDocumento && c.numeroDocumento ? `${c.tipoDocumento}:${c.numeroDocumento}` : 'sin-doc'
    const f = flagTest(nombre) || flagTest(c.email) || flagTest(c.telefono) || flagTest(c.numeroDocumento) || flagTest(c.razonSocial) || flagTest(c.direccion)
    const cred = c.permitirCredito ? `LIM:${num(c.limiteCredito)} SALDO:${num(c.saldoPendiente)}` : 'SIN-CREDITO'
    log(`  ${f}${doc} - ${nombre} | ${c.email ?? '-'} | ${c.telefono ?? '-'} | Dir: ${c.direccion ?? '-'} | Tipo: ${c.clienteTipo ?? '-'} | ventas:${c._count.ventas} | ${cred} | ${c.activo ? 'ACTIVO' : 'INACTIVO'}`)
  }

  // ------------------------------------------------------------------
  // GRUPO 3 — CAJA (ANÁLISIS MÁS IMPORTANTE)
  // ------------------------------------------------------------------
  sec('4. CAJA - CAJA ABIERTA, MOVIMIENTOS Y RELACIONADOS (PRIORIDAD)')

  sub('4.1 Definiciones de cajas')
  const cajas = await prisma.caja.findMany({ where: { deletedAt: null },
    select: { id:true, codigo:true, nombre:true, descripcion:true, estado:true, impresoraTicket:true,
      sucursal: { select: { codigo:true, nombre:true, empresa: { select: { razonSocial:true } } },
      _count: { select: { aperturas: true } } } })
  log(`Total cajas: ${cajas.length}`)
  for (const c of cajas) {
    const f = flagTest(c.nombre) || flagTest(c.codigo) || flagTest(c.descripcion)
    log(`  ${f}[${c.sucursal.empresa.razonSocial}/${c.sucursal.codigo}] ${c.codigo} - ${c.nombre} | ${c.descripcion ?? '-'} | impresora:${c.impresoraTicket ?? '-'} | ${c.estado} | aperturas:${c._count.aperturas} | id=${c.id.slice(0,12)}...`)
  }

  sub('4.2 Aperturas de Caja (TODAS)')
  const aperturas = await prisma.aperturaCaja.findMany({ where: { deletedAt: null },
    include: {
      caja: { select: { id:true, codigo:true, nombre:true, sucursal: { select: { codigo:true, nombre:true, empresa: { select: { razonSocial:true } } } } },
      usuario: { select: { username:true, nombres:true, apellidos:true } },
      cierre: { select: { id:true, fechaCierre:true, montoSistemaEfectivo:true, montoDeclaradoEfectivo:true, diferenciaEfectivo:true, observaciones:true } },
      _count: { select: { movimientos: true, arqueos: true, conciliaciones: true } },
    }, orderBy: { fechaApertura: 'desc' } })
  log(`Total aperturas: ${aperturas.length}`)
  for (const a of aperturas) {
    const f = flagTest(a.caja.nombre) || flagTest(a.usuario.username) || flagTest(a.observaciones)
    const estado = a.estado === 'ABIERTA' ? '🔴 ABIERTA' : a.estado
    const cierreStr = a.cierre ? `Cierre: ${a.cierre.fechaCierre.toLocaleString('es-PE')} sist:${num(a.cierre.montoSistemaEfectivo)} dec:${num(a.cierre.montoDeclaradoEfectivo)} dif:${num(a.cierre.diferenciaEfectivo)} ${a.cierre.observaciones ? ' Obs: '+trunc(a.cierre.observaciones,60) : ''}` : '⚠️ SIN CIERRE (APERTURA ACTIVA)'
    log(`  ${f}${estado} | ${a.caja.sucursal.empresa.razonSocial}/${a.caja.sucursal.codigo}/${a.caja.codigo} ${a.caja.nombre} | Apertura: ${a.fechaApertura.toLocaleString('es-PE')} | Usuario: @${a.usuario.username} (${a.usuario.nombres} ${a.usuario.apellidos}) | Fondo apertura EFECTIVO: S/ ${num(a.montoAperturaEfectivo)} | cierrePendiente:${a.cierrePendiente} | movimientos:${a._count.movimientos} arqueos:${a._count.arqueos} conciliaciones:${a._count.conciliaciones} | ${cierreStr}`)
    if (a.observaciones) log(`      > Observaciones apertura: ${a.observaciones}`)
  }

  const abiertas = aperturas.filter(a => a.estado === 'ABIERTA')
  log(`\n🚨 CAJAS ABIERTAS ACTUALMENTE: ${abiertas.length}`)
  for (const a of abiertas) {
    log(`\n   ============ DETALLE DE CAJA ABIERTA (aperturaId=${a.id.slice(0,16)}...) ============`)
    log(`   - Caja   : ${a.caja.codigo} ${a.caja.nombre} (${a.caja.sucursal.empresa.razonSocial}/${a.caja.sucursal.codigo} ${a.caja.sucursal.nombre})`)
    log(`   - Abierta por : @${a.usuario.username} - ${a.usuario.nombres} ${a.usuario.apellidos}`)
    log(`   - Fecha/hora  : ${a.fechaApertura.toLocaleString('es-PE')} (${a.fechaApertura.toISOString()})`)
    log(`   - Fondo inicial EFECTIVO: S/ ${num(a.montoAperturaEfectivo)}  ← ⚠️ (mencionado S/ 30.00)`)
    for (const [k, v] of Object.entries(a)) {
      if (k.startsWith('fondos_') || k.startsWith('montoApertura') || k.startsWith('saldo')) {
        log(`   - ${k}: ${num(v)}`)
      }
    }
    log(`   - Cierre pendiente flag: ${a.cierrePendiente}`)
    if (a.observaciones) log(`   - Observaciones: ${a.observaciones}`)

    log(`\n   >>> MOVIMIENTOS DE CAJA EN ESTA APERTURA:`)
    const movs = await prisma.movimientoCaja.findMany({ where: { aperturaCajaId: a.id, deletedAt: null },
      include: {
        formaPago: { select: { codigo:true, nombre:true, esEfectivo:true } },
        ventaPago: { select: { id:true, monto:true, venta: { select: { id:true, tipoComprobante:true, serie:true, numero:true, total:true, cliente: { select: { nombreCompleto:true, razonSocial:true } } } } },
        ingreso: { select: { concepto:true, referencia:true } },
        egreso: { select: { concepto:true, referencia:true } },
      }, orderBy: { fechaMovimiento: 'asc' } })
    log(`   Total movimientos: ${movs.length}`)
    let saldoEf = Number(a.montoAperturaEfectivo || 0)
    for (let i=0; i<movs.length; i++) {
      const m = movs[i]
      const signo = m.operacion === 'INGRESO' ? '+' : '-'
      const montoN = Number(m.monto)
      const fp = m.formaPago ? `${m.formaPago.codigo}${m.formaPago.esEfectivo ? '(EFE)':''}` : '???'
      if (m.formaPago?.esEfectivo) {
        saldoEf += m.operacion === 'INGRESO' ? montoN : -montoN
      }
      const vinculo = m.ventaPago
        ? `Vta#${m.ventaPago.id} (${m.ventaPago.venta.tipoComprobante} ${m.ventaPago.venta.serie ?? ''}-${m.ventaPago.venta.numero ?? ''}) ${m.ventaPago.venta.cliente ? ' Cli: '+trunc(m.ventaPago.venta.cliente.nombreCompleto||m.ventaPago.venta.cliente.razonSocial,30) : ''}`
        : m.ingreso
          ? `INGRESO concepto="${trunc(m.ingreso.concepto,60)}" ref=${m.ingreso.referencia ?? '-'}`
          : m.egreso
            ? `EGRESO concepto="${trunc(m.egreso.concepto,60)}" ref=${m.egreso.referencia ?? '-'}`
            : `${m.tipo??''} (${m.operacion}) ref=${m.referencia ?? '-'}`
      log(`   ${String(i+1).padStart(3,' ')}. [${m.fechaMovimiento.toLocaleString('es-PE')}] TIPO:${m.tipo?.padEnd(20)||'??'.padEnd(20)} OP:${signo}${num(m.monto)} | FP:${fp.padEnd(15)} | Saldo EFECTIVO estimado: S/ ${saldoEf.toFixed(2)} | ${vinculo}`)
    }
    log(`\n   >>> SALDO EFECTIVO ESTIMADO en caja (fondo + movimientos EFE): S/ ${saldoEf.toFixed(2)}`)
    log(`   >>> (Si la caja dice esperado=30 y contado=30 y sin movs adicionales, coincidirá)`)

    log(`\n   >>> ARQUEOS EN ESTA APERTURA (conteos físicos):`)
    const arqueos = await prisma.arqueoCaja.findMany({ where: { aperturaCajaId: a.id, deletedAt: null },
      include: { usuario: { select: { username:true } } }, orderBy: { createdAt: 'asc' } })
    log(`   Total arqueos: ${arqueos.length}`)
    for (const aq of arqueos) {
      const f = flagTest(aq.observaciones)
      log(`   ${f}[${aq.createdAt.toLocaleString('es-PE')}] Por: @${aq.usuario.username} | totDeclarado:${num(aq.totalDeclaradoEfectivo)} sist:${num(aq.totalSistemaEfectivo)} dif:${num(aq.diferenciaEfectivo)} | monedas:${aq.detalleMonedas ?? '-'} billetes:${aq.detalleBilletes ?? '-'} | ${aq.observaciones ?? ''}`)
    }

    log(`\n   >>> CONCILIACIONES (cuadre por FP) EN ESTA APERTURA:`)
    const conc = await prisma.conciliacionCaja.findMany({ where: { aperturaCajaId: a.id, deletedAt: null },
      include: { usuario: { select: { username:true } }, _count: { select: { detalles: true } } }, orderBy: { createdAt: 'asc' } })
    log(`   Total conciliaciones: ${conc.length}`)
    for (const cn of conc) {
      log(`   [${cn.createdAt.toLocaleString('es-PE')}] Por: @${cn.usuario.username} | detalle:${cn._count.detalles} | ${cn.observaciones ?? ''}`)
    }
  }

  sub('4.3 Todos los movimientos de caja (sin importar apertura)')
  const allMovs = await prisma.movimientoCaja.findMany({ where: { deletedAt: null },
    include: {
      aperturaCaja: { select: { id:true, estado:true, fechaApertura:true, caja: { select: { codigo:true, nombre:true, sucursal: { select: { codigo:true } } } } },
      formaPago: { select: { codigo:true, nombre:true, esEfectivo:true } },
      ventaPago: { select: { id:true, monto:true } },
      ingreso: { select: { id:true } },
      egreso: { select: { id:true } },
    }, orderBy: { fechaMovimiento: 'asc' } })
  log(`Total movimientos de caja (histórico): ${allMovs.length}`)
  for (const m of allMovs) {
    const estado = m.aperturaCaja ? `[${m.aperturaCaja.estado} ${m.aperturaCaja.caja.sucursal.codigo}/${m.aperturaCaja.caja.codigo} ${m.aperturaCaja.caja.nombre}]` : '[SIN-APERTURA??]'
    const v = m.ventaPago ? `VtaPago#${m.ventaPago.id}` : ''
    const i = m.ingreso ? `Ingreso#${m.ingreso.id}` : ''
    const e = m.egreso ? `Egreso#${m.egreso.id}` : ''
    log(`  ${estado} ${m.fechaMovimiento.toLocaleString('es-PE')} TIPO:${m.tipo} OP:${m.operacion} ${num(m.monto)} FP:${m.formaPago?.codigo ?? '?'} ${v}${i}${e} ${m.referencia ?? ''}`)
  }

  sub('4.4 Todos los Ingresos / Egresos (caja chica)')
  const ingresos = await prisma.ingreso.findMany({ where: { deletedAt: null },
    include: { movimientoCaja: { select: { monto:true, fechaMovimiento:true, aperturaCaja: { select: { caja: { select: { codigo:true } } } } } } })
  const egresos = await prisma.egreso.findMany({ where: { deletedAt: null },
    include: { movimientoCaja: { select: { monto:true, fechaMovimiento:true, aperturaCaja: { select: { caja: { select: { codigo:true } } } } } } })
  log(`Total ingresos: ${ingresos.length}`)
  for (const i of ingresos) log(`  [${i.movimientoCaja.aperturaCaja?.caja.codigo ?? '?'}] ${i.movimientoCaja.fechaMovimiento.toLocaleString('es-PE')} ${num(i.movimientoCaja.monto)} concepto:${trunc(i.concepto,60)} ref:${i.referencia ?? '-'}`)
  log(`Total egresos: ${egresos.length}`)
  for (const e of egresos) log(`  [${e.movimientoCaja.aperturaCaja?.caja.codigo ?? '?'}] ${e.movimientoCaja.fechaMovimiento.toLocaleString('es-PE')} ${num(e.movimientoCaja.monto)} concepto:${trunc(e.concepto,60)} ref:${e.referencia ?? '-'}`)

  // ------------------------------------------------------------------
  // GRUPO 4 — VENTAS
  // ------------------------------------------------------------------
  sec('5. VENTAS TRANSACCIONALES (histórico completo)')

  const ventas = await prisma.venta.findMany({ where: { deletedAt: null },
    select: { id:true, fechaEmision:true, tipoComprobante:true, serie:true, numero:true,
      estado:true, estadoEntrega:true, estadoPago:true,
      subtotal:true, descuentoTotal:true, impuestoTotal:true, total:true, vuelto:true, saldoPendiente:true, percepcion:true, detraccion:true,
      opGravadas:true, opExoneradas:true, opInafectas:true,
      sucursal: { select: { codigo:true, nombre:true, empresa: { select: { razonSocial:true } } } },
      cliente: { select: { nombreCompleto:true, razonSocial:true, numeroDocumento:true, tipoDocumento:true } },
      usuarioResponsable: { select: { username:true, nombres:true, apellidos:true } },
      cajaApertura: { select: { id:true, estado:true, caja: { select: { codigo:true, nombre:true } } } },
      _count: { select: { detalles: true, pagos: true } },
    }, orderBy: { fechaEmision: 'desc' } })
  log(`Total ventas: ${ventas.length}`)
  if (ventas.length === 0) log('  (Sin ventas)')
  for (const v of ventas) {
    const cli = v.cliente
      ? (v.cliente.nombreCompleto || v.cliente.razonSocial || `${v.cliente.tipoDocumento}:${v.cliente.numeroDocumento}`)
      : 'CLIENTE-GENERICO'
    const f = flagTest(cli) || flagTest(v.usuarioResponsable?.username)
    const comp = (v.serie || '') + (v.numero ? '-' + v.numero : '')
    const cajaRef = v.cajaApertura ? `[${v.cajaApertura.estado} ${v.cajaApertura.caja.codigo} ${v.cajaApertura.caja.nombre}]` : '[SIN-CAJA]'
    log(`  ${f}${v.tipoComprobante} ${comp} | ${v.fechaEmision.toLocaleString('es-PE')} | ${v.sucursal.codigo} | Cliente: ${trunc(cli,50)} | Resp: @${v.usuarioResponsable?.username ?? '?'} | items:${v._count.detalles} pagos:${v._count.pagos} | ${cajaRef} | Sub:${num(v.subtotal)} Desc:${num(v.descuentoTotal)} Igv:${num(v.impuestoTotal)} Tot:${num(v.total)} Vuelto:${num(v.vuelto)} SaldoPen:${num(v.saldoPendiente)} | ${v.estado} / Ent:${v.estadoEntrega} / Pag:${v.estadoPago} | Grav:${num(v.opGravadas)} Exo:${num(v.opExoneradas)} Inaf:${num(v.opInafectas)} | Perc:${num(v.percepcion)} Detr:${num(v.detraccion)}`)
  }

  sub('5.1 Pagos de ventas (ventaPagos)')
  const vps = await prisma.ventaPago.findMany({ where: { deletedAt: null },
    include: {
      venta: { select: { id:true, tipoComprobante:true, serie:true, numero:true, total:true } },
      formaPago: { select: { codigo:true, nombre:true } },
      movimientoCaja: { select: { id:true, monto:true, operacion:true, aperturaCaja: { select: { id:true, estado:true, caja: { select: { codigo:true } } } } },
    }, orderBy: { createdAt: 'desc' } })
  log(`Total pagos de venta: ${vps.length}`)
  for (const p of vps) {
    const v = p.venta
    const comp = `${v.tipoComprobante} ${v.serie ?? ''}-${v.numero ?? ''}`
    const mc = p.movimientoCaja ? `MovCaja#${p.movimientoCaja.id} ${p.movimientoCaja.operacion} ${num(p.movimientoCaja.monto)} en caja:${p.movimientoCaja.aperturaCaja?.caja.codigo ?? '?'}` : '(sin MovCaja?)'
    log(`  Pago#${p.id} Venta#${v.id} ${comp} (tot venta:${num(v.total)}) pago:${num(p.monto)} FP:${p.formaPago.codigo}/${p.formaPago.nombre} ref:${p.referencia ?? '-'} | ${mc}`)
  }

  // ------------------------------------------------------------------
  // GRUPO 5 — COMPRAS
  // ------------------------------------------------------------------
  sec('6. COMPRAS TRANSACCIONALES (histórico completo)')

  const compras = await prisma.compra.findMany({ where: { deletedAt: null },
    select: { id:true, fechaEmision:true, fechaRecepcion:true, tipoComprobante:true, serieComprobante:true, numeroComprobante:true,
      estado:true, estadoLogistico:true, estadoFinanciero:true,
      subtotal:true, descuentoTotal:true, impuestoTotal:true, total:true, saldoPendiente:true, percepcion:true, detraccion:true,
      opGravadas:true, opExoneradas:true, opInafectas:true,
      sucursal: { select: { codigo:true, nombre:true } },
      proveedor: { select: { razonSocial:true, numeroDocumento:true, tipoDocumento:true } },
      usuarioResponsable: { select: { username:true } },
      _count: { select: { detalles: true, pagos: true, recepciones: true } },
    }, orderBy: { fechaEmision: 'desc' } })
  log(`Total compras: ${compras.length}`)
  if (compras.length === 0) log('  (Sin compras)')
  for (const c of compras) {
    const f = flagTest(c.proveedor?.razonSocial) || flagTest(c.proveedor?.numeroDocumento)
    const comp = (c.serieComprobante || '') + (c.numeroComprobante ? '-' + c.numeroComprobante : '')
    log(`  ${f}${c.tipoComprobante ?? 'SIN-TIPO'} ${comp} | F.Emisión:${c.fechaEmision.toLocaleString('es-PE')} F.Recepción:${c.fechaRecepcion?.toLocaleString('es-PE') ?? '-'} | ${c.sucursal.codigo} | Prov: ${trunc(c.proveedor?.razonSocial,40) ?? '?'} (${c.proveedor?.tipoDocumento}:${c.proveedor?.numeroDocumento ?? '?'}) | Resp: @${c.usuarioResponsable?.username ?? '?'} | items:${c._count.detalles} pagos:${c._count.pagos} recepciones:${c._count.recepciones} | Sub:${num(c.subtotal)} Desc:${num(c.descuentoTotal)} Igv:${num(c.impuestoTotal)} Tot:${num(c.total)} SaldoPen:${num(c.saldoPendiente)} | ${c.estado}/Log:${c.estadoLogistico}/Fin:${c.estadoFinanciero} | Grav:${num(c.opGravadas)} Exo:${num(c.opExoneradas)} Inaf:${num(c.opInafectas)} | Perc:${num(c.percepcion)} Detr:${num(c.detraccion)}`)
  }

  // ------------------------------------------------------------------
  // GRUPO 6 — INVENTARIO Y LOTES
  // ------------------------------------------------------------------
  sec('7. INVENTARIO, LOTES Y MOVIMIENTOS')

  sub('7.1 Inventario por sucursal (definición)')
  const invs = await prisma.inventario.findMany({ where: { deletedAt: null },
    include: { producto: { select: { sku:true, nombre:true } }, sucursal: { select: { codigo:true, nombre:true } } },
    orderBy: [{ sucursal: { codigo: 'asc' } }, { producto: { sku: 'asc' } }] })
  log(`Total registros de inventario: ${invs.length}`)
  if (invs.length === 0) log('  (Sin inventario)')
  for (const inv of invs) {
    const f = flagTest(inv.producto.sku) || flagTest(inv.producto.nombre)
    log(`  ${f}[${inv.sucursal.codigo}] ${inv.producto.sku} ${inv.producto.nombre} | stockMin:${inv.stockMinimo ?? '-'} stockMax:${inv.stockMaximo ?? '-'} puntoReorden:${inv.puntoReorden ?? '-'} ubic:${inv.ubicacion ?? '-'} | permiteVentaSinStock:${inv.permiteVentaSinStock}`)
  }

  sub('7.2 Lotes')
  const lotes = await prisma.lote.findMany({ where: { deletedAt: null },
    include: {
      producto: { select: { sku:true, nombre:true } },
      sucursal: { select: { codigo:true, nombre:true } },
      proveedor: { select: { razonSocial:true } },
      detalleCompra: { select: { id:true, compra: { select: { id:true, tipoComprobante:true, serieComprobante:true, numeroComprobante:true, proveedor: { select: { razonSocial:true } } } } } },
      compraRecepcion: { select: { id:true, fechaRecepcion:true } },
    }, orderBy: [{ sucursal: { codigo: 'asc' } }, { producto: { sku: 'asc' } }, { numeroLote: 'asc' }] })
  log(`Total lotes: ${lotes.length}`)
  if (lotes.length === 0) log('  (Sin lotes)')
  for (const l of lotes) {
    const f = flagTest(l.numeroLote) || flagTest(l.producto.sku) || flagTest(l.producto.nombre) || flagTest(l.proveedor?.razonSocial) || flagTest(l.detalleCompra?.compra?.proveedor?.razonSocial)
    const venc = new Date(l.fechaVencimiento) < new Date() ? '⚠️ VENCIDO' : ''
    const vinculo = l.detalleCompra?.compra
      ? `Origen: Compra#${l.detalleCompra.compra.id} ${l.detalleCompra.compra.tipoComprobante} ${l.detalleCompra.compra.serieComprobante ?? ''}-${l.detalleCompra.compra.numeroComprobante ?? ''}`
      : 'Origen: Inventario inicial / carga manual'
    log(`  ${f}[${l.sucursal.codigo}] SKU:${l.producto.sku} Lote:${l.numeroLote} | ${l.producto.nombre} | StockInit:${l.stockInicial} Disp:${l.stockDisponible} Res:${l.stockReservado} Bloq:${l.stockBloqueado} | CostUnit:${num(l.costoUnitario)} FecFab:${l.fechaFabricacion?.toISOString().slice(0,10) ?? '-'} FecVenc:${l.fechaVencimiento.toISOString().slice(0,10)} ${venc} | Prov:${trunc(l.proveedor?.razonSocial ?? l.detalleCompra?.compra?.proveedor?.razonSocial ?? '-', 40)} | ${vinculo} | ${l.estado}`)
  }

  sub('7.3 Cargas Inventario Inicial')
  const cargas = await prisma.cargaInventarioInicial.findMany({ where: { deletedAt: null },
    include: { sucursal: { select: { codigo:true } }, usuario: { select: { username:true } }, _count: { select: { detalles: true } } }, orderBy: { createdAt: 'desc' } })
  log(`Total cargas inventario inicial: ${cargas.length}`)
  for (const c of cargas) log(`  [${c.sucursal.codigo}] ${c.createdAt.toLocaleString('es-PE')} ${c.estado} | prods:${c.productosCargados} lotes:${c.lotesCreados} detalles:${c._count.detalles} | @${c.usuario?.username ?? '?'} | obs:${trunc(c.observaciones, 100)}`)

  sub('7.4 Movimientos Inventario (KARDEX) - RESUMEN')
  const movInvTot = await prisma.movimientoInventario.count({ where: { deletedAt: null } })
  log(`Total movimientos inventario: ${movInvTot}`)
  if (movInvTot > 0) {
    try {
      const rows = await prisma.$queryRawUnsafe(`
        SELECT tipo, origen, motivo_codigo, COUNT(*)::int as cnt, sum(cantidad) as suma_cant
        FROM movimientos_inventario
        WHERE deleted_at IS NULL
        GROUP BY tipo, origen, motivo_codigo
        ORDER BY tipo, origen, cnt DESC;
      `)
      log('  Desglose por tipo/origen/motivo:')
      for (const r of rows) log(`    [${r.tipo}] origen:${r.origen} motivo:${r.motivo_codigo ?? '-'} → ${r.cnt} movs, cantidad total ${r.suma_cant}`)
    } catch (e) { log('  error al agrupar: ' + e.message) }
  }

  // ------------------------------------------------------------------
  // GRUPO 7 — AUDITORÍA
  // ------------------------------------------------------------------
  sec('8. AUDITORÍA')
  const auditTotal = await prisma.auditoria.count({ where: { deletedAt: null } })
  log(`Total registros auditoría: ${auditTotal}`)
  if (auditTotal > 0) {
    try {
      const rows = await prisma.$queryRawUnsafe(`
        SELECT accion, tabla, COUNT(*)::int as cnt
        FROM auditoria
        WHERE deleted_at IS NULL
        GROUP BY accion, tabla
        ORDER BY cnt DESC
        LIMIT 30;
      `)
      log('  Top 30 acciones/tablas auditadas:')
      for (const r of rows) log(`    ${r.accion} sobre ${r.tabla}: ${r.cnt} registros`)
    } catch (e) { log('  error: ' + e.message) }
    log('  (Detalle completo de auditoría disponible si se requiere antes de truncar)')
  }

  // ------------------------------------------------------------------
  // RESUMEN FINAL + PROPUESTA DE LIMPIEZA
  // ------------------------------------------------------------------
  sec('9. RESUMEN FINAL Y PROPUESTA DE LIMPIEZA')
  const res = {}
  res['1. Empresas / Sucursales / Usuarios / Roles / Permisos / TiposEmpresa / Módulos / Configuración'] =
    `(NO TOCAR) | Emp:${empresas.length} Suc:${sucursales.length} Usu:${usuarios.length} Roles:${roles.length} Permisos:${permisos} TiposEmp:${tiposEmp.length} Módulos:${modulos} Config:${conf.length}`
  res['2. Catálogos base (Categorías / Laboratorios / Presentaciones / Unidades Medida / Tipos Comerciales / Formas Pago / Impuestos / Motivos)'] =
    `(REVISAR) | Cats:${categoriasCount} Labs:${laboratoriosCount} Pres:${presentacionesCount} Unid:${unidadesCount} TipCom:${tiposComercialesCount} FormPag:${formasPagoCount} Imp:${impuestosCount} Mot:${motivosCount}`
  res['3. Catálogos de negocio (Productos / Proveedores / Clientes)'] =
    `(REVISAR UNO A UNO) | Prods:${productos.length} Provs:${proveedores.length} Clis:${clientes.length}`
  res['4. Caja y transacciones monetarias'] =
    `(TODO ELIMINAR) | Cajas(def):${cajas.length} Aperturas:${aperturas.length} (abiertas:${abiertas.length}) Cierres:${cierresCount} MovimientosCaja:${allMovs.length} Ingresos:${ingresos.length} Egresos:${egresos.length} Arqueos:${arqueosCount} Conciliaciones:${conciliacionesCount}`
  res['5. Ventas'] =
    `(TODO ELIMINAR) | Ventas:${ventas.length} Pagos de venta:${vps.length}`
  res['6. Compras'] =
    `(TODO ELIMINAR) | Compras:${compras.length}`
  res['7. Inventario transaccional'] =
    `(ELIMINAR o RESETEAR) | Invent(def):${invs.length} Lotes:${lotes.length} MovInv:${movInvTot} CargasIni:${cargas.length}`
  res['8. Auditoría'] =
    `(TRUNCAR o CONSERVAR, decidir) | Registros:${auditTotal}`
  for (const [k, v] of Object.entries(res)) log(`\n  ${k}\n    → ${v}`)

  log(`

╔══════════════════════════════════════════════════════════════════════════════╗
║                       PROPUESTA DE LIMPIEZA (FASE DE APROBACIÓN)              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ ¡IMPORTANTE! NADA SE HA ELIMINADO AÚN. Esto es sólo propuesta.               ║
╚══════════════════════════════════════════════════════════════════════════════╝

A) QUE NO SE TOCA (confirmado):
  ✔ Empresas: ${empresas.length} registros
  ✔ Sucursales: ${sucursales.length} registros
  ✔ Usuarios (reales): ${usuarios.length} registros  ⚠️ Revisa el listado de usuarios
      arriba. Si algún usuario marcado con ⚠️ es REAL y operativo → lo conservamos.
      Si fue un usuario creado de prueba (ej: admin@rayego.pe, etc.) TU DECIDES.
  ✔ Roles / permisos / tipos_empresa / módulos / configuración / series_doc /
    tipos_comerciales / formas_pago / impuestos / motivos_movimiento /
    categorias / laboratorios / presentaciones / unidades_medida / principios_activos
    → POR DEFECTO se CONSERVAN todos, ya que son catálogos de estructura base
    del seed. Si alguno de los nombres es inapropiado para operación real,
    tú lo puedes eliminar/modificar desde el ADMIN del sistema, no requiere SQL.

B) CATÁLOGOS DE NEGOCIO A VALIDAR UNO A UNO CONTIGO:
  1) Productos (${productos.length}) → Por cada uno confirma: REAL o PRUEBA.
     Los ⚠️ son claramente de prueba. Los demás → confirmar.
  2) Proveedores (${proveedores.length}) → Confirmar lista real. Si alguno tiene
     compras asociadas, al borrar compra (FASE 2) luego se puede borrar proveedor.
  3) Clientes (${clientes.length}) → Confirmar lista real. Clientes ⚠️ → borrar.

C) CAJA (TU CASO ESPECIAL: CAJA ABIERTA CON S/ 30)
  La(s) ${abiertas.length} apertura(s) ABIERTA(s) existen. La detallamos arriba
  con su fondo inicial S/ ${abiertas[0] ? num(abiertas[0].montoAperturaEfectivo) : '30.00'} y sus ${allMovs.length} movimientos.
  PROPUESTA para CAJA ABIERTA (hay 2 caminos, tu eliges):
     OPCIÓN C.1 — CIERRE LÓGICO FORMAL (recomendado para no romper integridad):
        1. Desde el sistema o con SQL, hacemos un CIERRE de caja para la
           apertura actual: fecha "ahora", monto declarado = S/ 30.00,
           monto sistema = calculado real, diferencia = 0.
        2. Luego se borran de forma segura TODAS las aperturas (incluida
           la recién cerrada), en el orden correcto.
        3. Definición de "Caja Principal" se CONSERVA.
     OPCIÓN C.2 — ANULACIÓN DIRECTA (más simple, borramos apertura abierta
        directamente con su movimiento fundacional y demás):
        1. Borramos primero movimientos → ingresos/egresos → arqueos →
           conciliaciones → movimiento apertura → apertura.
        2. Definición "Caja Principal" se conserva.
  ⚠️ TÚ eliges C.1 o C.2. Yo recomiendo C.1 (limpia y traza que hubo una apertura
     de prueba con su cierre).

D) TODO LO TRANSACCIONAL (DE PRUEBA) SE ELIMINA:
  FASE 1 — VENTAS  (orden hijo → padre, por FK restrict):
    1. detalle_venta_lote
    2. movimientos_inventario  (donde apunte a detalle_venta / detalle_venta_lote)
    3. movimientos_caja        (donde venta_pago_id no es NULL)
    4. venta_pagos
    5. detalle_venta
    6. ventas                  (TODO: ${ventas.length} filas)

  FASE 2 — COMPRAS:
    7. lotes SET detalle_compra_id = NULL, compra_recepcion_id = NULL
    8. detalle_compra
    9. movimientos_inventario  (donde detalle_compra_id no es NULL)
    10. compra_pagos
    11. compra_recepciones
    12. compras                 (TODO: ${compras.length} filas)

  FASE 3 — CAJA:
    13. ingresos                (borrado cascada movimiento_caja o manual)
    14. egresos
    15. conciliacion_caja_detalle → conciliacion_caja
    16. arqueo_caja
    17. movimientos_caja restantes (los de apertura/cierre y manuales)
    18. cierre_caja             (${cierresCount})
    19. apertura_caja           (${aperturas.length}, incluida la abierta S/ 30)
    20. cajas ??? → NO: definición de caja se conserva. Sólo se limpia operación.

  FASE 4 — INVENTARIO TRANSACCIONAL:
    21. carga_inventario_inicial_detalle → carga_inventario_inicial
    22. lotes: se elimina SOLO si el producto es de prueba (validado en B)
               O SI TÚ QUIERES borrar TODO lote para empezar desde cero
               con la carga oficial de inventario (recomendado para limpieza).
               Si producto es REAL pero lote es de prueba → lo validamos.
    23. movimientos_inventario (todos los restantes: inventario inicial, ajustes)
    24. inventario (definición): NO BORRAMOS filas; sólo se reinician los
        campos calculados de stock (de hecho se recalculan desde lotes, que
        ya estarán limpios → stock = 0 en todos, que es lo correcto).

  FASE 5 — CATÁLOGOS DE NEGOCIO PRUEBA (validados en B):
    25. productos marcados ⚠️ (que confirmaste como PRUEBA)
    26. clientes marcados ⚠️
    27. proveedores marcados ⚠️ (si ya no tienen compras)

  FASE 6 — AUDITORÍA (DECIDIR):
    OPCIÓN 6.A (recomendado, producción LIMPIA):
      28. TRUNCATE TABLE auditoría RESTART IDENTITY;
      (borra TODO el log de acciones de prueba, comienza auditoría de 0)
    OPCIÓN 6.B (conservar historial):
      Nada que hacer. Auditoría queda con registros de prueba incluidos.
  ⚠️ TÚ eliges 6.A o 6.B.

E) QUEDEMOS CLAROS ANTES DE EJECUTAR NADA:
  Para aprobar la limpieza contéstame estas 6 preguntas:
  1. ¿Se borran TODOS los productos ⚠️ PRUEBA? ¿Cuáles PRODUCTOS reales conservamos?
     (Indícame cuáles son los productos REALES o di "borra todos, empezamos de cero")
  2. ¿Cuáles PROVEEDORES son REALES (conservar) / cuales PRUEBA (eliminar)?
  3. ¿Cuáles CLIENTES son REALES / cuales PRUEBA?
  4. Para la CAJA ABIERTA de S/ 30: eliges CIERRE LÓGICO (C.1) o ANULACIÓN (C.2)?
  5. Para LOTES: eliminar TODO (limpieza total, carga inventario oficial después)
     o conservar lotes de productos REALES?
  6. Auditoría: TRUNCAR (6.A) o CONSERVAR (6.B)?

Cuando respondas esas 6, te preparo el script SQL en una TRANSACCIÓN
(BEGIN; …; ROLLBACK de prueba o COMMIT si todo OK), con backup lógico
(SELECT INTO tabla_backup o csv) antes de borrar, y lo ejecuto SÓLO
con tu aprobación final.
`)

  log('FIN DEL INFORME DE DIAGNÓSTICO')
}

// helpers counts (avoiding await-if scoping issues in sec 9 template literal):
let categoriasCount = 0, laboratoriosCount = 0, presentacionesCount = 0, unidadesCount = 0
let tiposComercialesCount = 0, formasPagoCount = 0, impuestosCount = 0, motivosCount = 0
let cierresCount = 0, arqueosCount = 0, conciliacionesCount = 0
try { categoriasCount = await prisma.categoria.count({ where: { deletedAt: null } }) } catch {}
try { laboratoriosCount = await prisma.laboratorio.count({ where: { deletedAt: null } }) } catch {}
try { presentacionesCount = await prisma.presentacion.count({ where: { deletedAt: null } }) } catch {}
try { unidadesCount = await prisma.unidadMedida.count({ where: { deletedAt: null } }) } catch {}
try { tiposComercialesCount = await prisma.tipoComercial.count({ where: { deletedAt: null } }) } catch {}
try { formasPagoCount = await prisma.formaPago.count({ where: { deletedAt: null } }) } catch {}
try { impuestosCount = await prisma.impuesto.count({ where: { deletedAt: null } }) } catch {}
try { motivosCount = await prisma.motivoMovimientoInventario.count({ where: { deletedAt: null } }) } catch {}
try { cierresCount = await prisma.cierreCaja.count({ where: { deletedAt: null } }) } catch {}
try { arqueosCount = await prisma.arqueoCaja.count({ where: { deletedAt: null } }) } catch {}
try { conciliacionesCount = await prisma.conciliacionCaja.count({ where: { deletedAt: null } }) } catch {}

await main()
  .catch(e => { log('ERROR GRAVE: ' + e.message); log('Stack: ' + (e.stack?.slice(0, 2000) || '-')); process.exitCode = 1 })
  .finally(async () => { await prisma.$disconnect(); out.end() })
