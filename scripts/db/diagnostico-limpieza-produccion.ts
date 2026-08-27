import 'dotenv/config'
import { PrismaClient, EstadoAperturaCaja, EstadoVenta, EstadoCompra } from '@prisma/client'

const prisma = new PrismaClient()

const SEPARATOR = '='.repeat(80)
const SUBSEPARATOR = '-'.repeat(80)

function printSection(title: string) {
  console.log('\n' + SEPARATOR)
  console.log('  ' + title.toUpperCase())
  console.log(SEPARATOR)
}

function printSubsection(title: string) {
  console.log('\n' + SUBSEPARATOR)
  console.log('  ' + title)
  console.log(SUBSEPARATOR)
}

function flagTest(value: string | null | undefined): string {
  if (!value) return '  '
  const v = value.toString().toLowerCase()
  const testTokens = [
    'prueba', 'test', 'demo', 'ejemplo', 'rayego', '20612345678', '20654321987',
    'admin@rayego', 'supervisor@rayego', 'caja@rayego', 'sin.sucursal', '@rayego.pe',
    'MED-0001', 'MED-0002', 'MED-0003', 'MED-0004',
    'PARACETAMOL', 'AMOXICILINA', 'LORATADINA', 'VITAMINA C',
    'PARA-500', 'AMOX-500', 'LORA-JBE', 'VITC-1000',
    'ddp', 'drogueria distribuidora',
    'sucursal principal', 'sucursal san miguel',
    'av. principal 123', 'av. la marina 845',
    '77500000000',
    'GENERICO', 'MARCA', 'ANALG', 'ANTIB', 'VITSUP', 'RESP',
    'TAB', 'CAP', 'FRA', 'AMP',
    'AC FARMA', 'MEDIFARMA', 'BAYER',
  ]
  if (testTokens.some(t => v.includes(t.toLowerCase()))) return '⚠️ '
  return '  '
}

async function main() {
  printSection('DIAGNÓSTICO DE BASE DE DATOS - LIMPIEZA PARA OPERACIÓN REAL')
  console.log('Fecha diagnóstico:', new Date().toLocaleString('es-PE'))
  console.log('Modo detectado:', process.env.RAYEGO_ENV_MODE || 'desconocido')
  console.log('Fuente env:', process.env.RAYEGO_ENV_SOURCE || 'desconocido')

  // ------------------------------------------------------------------
  // 1. DATOS MAESTROS QUE NO SE DEBEN TOCAR (validar existencia)
  // ------------------------------------------------------------------
  printSection('1. DATOS MAESTROS - NO ELIMINAR')

  printSubsection('1.1 Empresas')
  const empresas = await prisma.empresa.findMany({
    where: { deletedAt: null },
    select: {
      id: true, razonSocial: true, nombreComercial: true,
      tipoDocumento: true, numeroDocumento: true,
      email: true, modoOperacion: true, activo: true,
    },
    orderBy: { razonSocial: 'asc' },
  })
  console.log(`Total empresas activas: ${empresas.length}`)
  empresas.forEach(e => {
    const f = flagTest(e.razonSocial) || flagTest(e.numeroDocumento) || flagTest(e.nombreComercial)
    console.log(`  ${f}[${e.modoOperacion}] ${e.razonSocial} | ${e.tipoDocumento}: ${e.numeroDocumento} | ${e.activo ? 'ACTIVO' : 'INACTIVO'} | id=${e.id.slice(0, 8)}...`)
  })

  printSubsection('1.2 Sucursales')
  const sucursales = await prisma.sucursal.findMany({
    where: { deletedAt: null },
    select: {
      id: true, codigo: true, nombre: true, direccion: true,
      esPrincipal: true, activo: true,
      empresa: { select: { razonSocial: true } },
    },
    orderBy: [{ empresa: { razonSocial: 'asc' } }, { codigo: 'asc' }],
  })
  console.log(`Total sucursales activas: ${sucursales.length}`)
  sucursales.forEach(s => {
    const f = flagTest(s.nombre) || flagTest(s.direccion) || flagTest(s.codigo)
    console.log(`  ${f}[${s.empresa.razonSocial}] ${s.codigo} - ${s.nombre} | ${s.esPrincipal ? 'PRINCIPAL' : ''} | ${s.activo ? 'ACTIVO' : 'INACTIVO'} | id=${s.id.slice(0, 8)}...`)
  })

  printSubsection('1.3 Usuarios reales')
  const usuarios = await prisma.usuario.findMany({
    where: { deletedAt: null },
    select: {
      id: true, username: true, email: true,
      nombres: true, apellidos: true,
      tipoDocumento: true, numeroDocumento: true,
      activo: true, ultimoAccesoAt: true,
    },
    orderBy: [{ username: 'asc' }],
  })
  console.log(`Total usuarios activos: ${usuarios.length}`)
  usuarios.forEach(u => {
    const f = flagTest(u.username) || flagTest(u.email) || flagTest(u.nombres) || flagTest(u.apellidos)
    const acceso = u.ultimoAccesoAt ? u.ultimoAccesoAt.toLocaleString('es-PE') : 'NUNCA'
    console.log(`  ${f}@${u.username} - ${u.nombres} ${u.apellidos} | ${u.email ?? 'sin-email'} | ${u.activo ? 'ACTIVO' : 'INACTIVO'} | último acceso: ${acceso}`)
  })

  printSubsection('1.4 Roles y Permisos')
  const roles = await prisma.rol.findMany({ where: { deletedAt: null }, select: { id: true, codigo: true, nombre: true, activo: true } })
  const permisos = await prisma.permiso.count({ where: { deletedAt: null, activo: true } })
  const rolPermisos = await prisma.rolPermiso.count({ where: { deletedAt: null } })
  console.log(`Roles activos: ${roles.length}`)
  roles.forEach(r => console.log(`  - ${r.codigo}: ${r.nombre} (${r.activo ? 'ACTIVO' : 'INACTIVO'})`))
  console.log(`Permisos activos: ${permisos}`)
  console.log(`Asignaciones rol-permiso: ${rolPermisos}`)

  printSubsection('1.5 Tipos de Empresa + Módulos')
  const tiposEmpresa = await prisma.tipoEmpresa.findMany({ where: { deletedAt: null }, select: { codigo: true, nombre: true, activo: true, modulos: true } })
  const modulos = await prisma.modulo.count({ where: { deletedAt: null, activo: true } })
  const tipoEmpresaModulo = await prisma.tipoEmpresaModulo.count({ where: { activo: true } })
  console.log(`Tipos de empresa: ${tiposEmpresa.length}`)
  tiposEmpresa.forEach(t => console.log(`  - ${t.codigo}: ${t.nombre} | modulos activos: ${t.modulos.length}`))
  console.log(`Módulos plataforma activos: ${modulos}`)
  console.log(`Asignaciones tipoEmpresa-modulo: ${tipoEmpresaModulo}`)

  printSubsection('1.6 Configuración del sistema')
  const configuraciones = await prisma.configuracion.findMany({ where: { deletedAt: null }, select: { ambito: true, clave: true, valorTexto: true, valorBooleano: true, valorNumero: true } })
  console.log(`Total configuraciones: ${configuraciones.length}`)
  configuraciones.forEach(c => {
    const val = c.valorTexto ?? (c.valorNumero !== null ? c.valorNumero.toString() : c.valorBooleano !== null ? c.valorBooleano.toString() : '(vacío)')
    console.log(`  [${c.ambito}] ${c.clave} = ${val.toString().slice(0, 80)}`)
  })

  // ------------------------------------------------------------------
  // 2. CATÁLOGOS MAESTROS A EVALUAR (productos, clientes, proveedores, etc)
  // ------------------------------------------------------------------
  printSection('2. CATÁLOGOS MAESTROS - EVALUAR SI SON DE PRUEBA')

  printSubsection('2.1 Categorías de productos')
  const categorias = await prisma.categoria.findMany({
    where: { deletedAt: null },
    select: { id: true, codigo: true, nombre: true, descripcion: true, orden: true, activo: true },
    orderBy: { orden: 'asc' },
  })
  console.log(`Total categorías: ${categorias.length}`)
  categorias.forEach(c => {
    const f = flagTest(c.codigo) || flagTest(c.nombre)
    console.log(`  ${f}${c.codigo} - ${c.nombre} ${c.activo ? '' : '[INACTIVO]'}`)
  })

  printSubsection('2.2 Laboratorios')
  const laboratorios = await prisma.laboratorio.findMany({
    where: { deletedAt: null },
    select: { id: true, codigo: true, nombre: true, pais: true, activo: true },
    orderBy: { nombre: 'asc' },
  })
  console.log(`Total laboratorios: ${laboratorios.length}`)
  laboratorios.forEach(l => {
    const f = flagTest(l.nombre) || flagTest(l.codigo)
    console.log(`  ${f}${l.codigo} - ${l.nombre} (${l.pais ?? 'sin-país'}) ${l.activo ? '' : '[INACTIVO]'}`)
  })

  printSubsection('2.3 Presentaciones')
  const presentaciones = await prisma.presentacion.findMany({
    where: { deletedAt: null },
    select: { id: true, codigo: true, nombre: true, activo: true },
    orderBy: { nombre: 'asc' },
  })
  console.log(`Total presentaciones: ${presentaciones.length}`)
  presentaciones.forEach(p => {
    const f = flagTest(p.codigo) || flagTest(p.nombre)
    console.log(`  ${f}${p.codigo} - ${p.nombre} ${p.activo ? '' : '[INACTIVO]'}`)
  })

  printSubsection('2.4 Unidades de Medida')
  const unidades = await prisma.unidadMedida.findMany({
    where: { deletedAt: null },
    select: { id: true, codigo: true, nombre: true, simbolo: true, activo: true },
  })
  console.log(`Total unidades: ${unidades.length}`)
  unidades.forEach(u => console.log(`  ${flagTest(u.codigo)}${u.codigo} - ${u.nombre} (${u.simbolo})`))

  printSubsection('2.5 Tipos Comerciales')
  const tiposComerciales = await prisma.tipoComercial.findMany({ where: { deletedAt: null }, select: { codigo: true, nombre: true, activo: true } })
  console.log(`Total tipos comerciales: ${tiposComerciales.length}`)
  tiposComerciales.forEach(t => console.log(`  ${flagTest(t.codigo) || flagTest(t.nombre)}${t.codigo} - ${t.nombre}`))

  printSubsection('2.6 Principios Activos')
  const principios = await prisma.principioActivo.findMany({ where: { deletedAt: null }, select: { codigo: true, nombre: true, activo: true }, orderBy: { nombre: 'asc' } })
  console.log(`Total principios activos: ${principios.length}`)
  principios.forEach(p => console.log(`  ${flagTest(p.nombre) || flagTest(p.codigo)}${p.codigo} - ${p.nombre}`))

  printSubsection('2.7 Impuestos')
  const impuestos = await prisma.impuesto.findMany({ where: { deletedAt: null }, select: { codigo: true, nombre: true, tipo: true, porcentaje: true, activo: true } })
  console.log(`Total impuestos: ${impuestos.length}`)
  impuestos.forEach(i => console.log(`  ${i.codigo} - ${i.nombre} (${i.tipo}) ${i.porcentaje}%`))

  printSubsection('2.8 Formas de Pago')
  const formasPago = await prisma.formaPago.findMany({ where: { deletedAt: null }, select: { codigo: true, nombre: true, activo: true } })
  console.log(`Total formas de pago: ${formasPago.length}`)
  formasPago.forEach(f => console.log(`  ${f.codigo} - ${f.nombre}`))

  printSubsection('2.9 Series de Documentos')
  const seriesDoc = await prisma.serieDocumento.findMany({
    where: { deletedAt: null },
    select: { id: true, tipoComprobante: true, serie: true, siguienteNumero: true, longitudNumero: true, activo: true, sucursal: { select: { codigo: true, nombre: true } } },
  })
  console.log(`Total series documento: ${seriesDoc.length}`)
  seriesDoc.forEach(s => {
    const suc = s.sucursal ? `${s.sucursal.codigo} - ${s.sucursal.nombre}` : 'EMPRESA'
    console.log(`  [${suc}] ${s.tipoComprobante} ${s.serie}-00000001 | siguiente=${s.siguienteNumero} | ${s.activo ? 'ACTIVO' : 'INACTIVO'}`)
  })

  printSubsection('2.10 Motivos Movimiento Inventario')
  const motivos = await prisma.motivoMovimientoInventario.findMany({ where: { deletedAt: null }, select: { codigo: true, nombre: true, tipo: true, activo: true } })
  console.log(`Total motivos inventario: ${motivos.length}`)
  motivos.forEach(m => console.log(`  ${flagTest(m.codigo)}${m.codigo} - ${m.nombre} [${m.tipo}]`))

  // ------------------------------------------------------------------
  // 3. PRODUCTOS - ANÁLISIS DETALLADO
  // ------------------------------------------------------------------
  printSection('3. PRODUCTOS - DETALLE')
  const productos = await prisma.producto.findMany({
    where: { deletedAt: null },
    select: {
      id: true, sku: true, codigoInterno: true, codigoBarras: true,
      nombre: true, concentracion: true, precioVenta: true, costoReferencia: true,
      estado: true,
      categoria: { select: { nombre: true } },
      laboratorio: { select: { nombre: true } },
      presentacion: { select: { nombre: true } },
      unidadMedida: { select: { nombre: true } },
      lotes: { select: { id: true, numeroLote: true, stockInicial: true, stockDisponible: true, stockReservado: true, stockBloqueado: true } },
      inventarios: { select: { id: true, sucursal: { select: { codigo: true, nombre: true } } } },
    },
    orderBy: { sku: 'asc' },
  })
  console.log(`Total productos activos/no eliminados: ${productos.length}`)
  productos.forEach(p => {
    const flags = [
      flagTest(p.sku), flagTest(p.nombre), flagTest(p.codigoBarras),
      flagTest(p.categoria?.nombre), flagTest(p.laboratorio?.nombre),
    ].join('').trim() || '  '
    const stockTotal = p.lotes.reduce((sum, l) => sum + l.stockDisponible, 0)
    const lotesStr = p.lotes.map(l => `${l.numeroLote}(disp:${l.stockDisponible})`).join(', ') || '(sin lotes)'
    const invStr = p.inventarios.map(i => i.sucursal.codigo).join(', ') || '(sin inventario)'
    console.log(`  ${flags}${p.sku} | ${p.nombre} ${p.concentracion ?? ''} | pvs:${p.precioVenta} cost:${p.costoReferencia} | stock disp:${stockTotal} | lotes: ${lotesStr} | inventario en: ${invStr}`)
  })

  // ------------------------------------------------------------------
  // 4. PROVEEDORES
  // ------------------------------------------------------------------
  printSection('4. PROVEEDORES')
  const proveedores = await prisma.proveedor.findMany({
    where: { deletedAt: null },
    select: {
      id: true, tipoDocumento: true, numeroDocumento: true,
      razonSocial: true, nombreComercial: true, contactoNombre: true, contactoTelefono: true,
      email: true, activo: true,
      _count: { select: { compras: true, lotes: true } },
    },
    orderBy: { razonSocial: 'asc' },
  })
  console.log(`Total proveedores: ${proveedores.length}`)
  proveedores.forEach(pr => {
    const f = flagTest(pr.numeroDocumento) || flagTest(pr.razonSocial) || flagTest(pr.nombreComercial) || flagTest(pr.email) || flagTest(pr.contactoTelefono)
    console.log(`  ${f}${pr.tipoDocumento}:${pr.numeroDocumento} - ${pr.razonSocial} (${pr.nombreComercial ?? '-'}) | compras:${pr._count.compras} lotes:${pr._count.lotes} | ${pr.activo ? 'ACTIVO' : 'INACTIVO'}`)
  })

  // ------------------------------------------------------------------
  // 5. CLIENTES
  // ------------------------------------------------------------------
  printSection('5. CLIENTES')
  const clientes = await prisma.cliente.findMany({
    where: { deletedAt: null },
    select: {
      id: true, tipoDocumento: true, numeroDocumento: true,
      nombres: true, apellidos: true, razonSocial: true, nombreCompleto: true,
      email: true, telefono: true, permitirCredito: true, limiteCredito: true, saldoPendiente: true,
      activo: true,
      _count: { select: { ventas: true } },
    },
    orderBy: [{ apellidos: 'asc' }, { razonSocial: 'asc' }],
  })
  console.log(`Total clientes: ${clientes.length}`)
  if (clientes.length === 0) {
    console.log('  (Sin clientes registrados)')
  }
  clientes.forEach(c => {
    const nombre = c.nombreCompleto || c.razonSocial || `${c.nombres ?? ''} ${c.apellidos ?? ''}`.trim()
    const doc = c.tipoDocumento && c.numeroDocumento ? `${c.tipoDocumento}:${c.numeroDocumento}` : 'sin-doc'
    const f = flagTest(nombre) || flagTest(c.email) || flagTest(c.telefono)
    const credito = c.permitirCredito ? `LIM:${c.limiteCredito} SALDO:${c.saldoPendiente}` : 'SIN-CREDITO'
    console.log(`  ${f}${doc} - ${nombre} | ${c.email ?? '-'} | ${c.telefono ?? '-'} | ventas:${c._count.ventas} | ${credito} | ${c.activo ? 'ACTIVO' : 'INACTIVO'}`)
  })

  // ------------------------------------------------------------------
  // 6. COMPRAS TRANSACCIONALES
  // ------------------------------------------------------------------
  printSection('6. COMPRAS TRANSACCIONALES')

  const compras = await prisma.compra.findMany({
    where: { deletedAt: null },
    select: {
      id: true, fechaEmision: true, fechaRecepcion: true,
      tipoComprobante: true, serieComprobante: true, numeroComprobante: true,
      estado: true, estadoLogistico: true, estadoFinanciero: true,
      subtotal: true, descuentoTotal: true, impuestoTotal: true, total: true, saldoPendiente: true,
      sucursal: { select: { codigo: true, nombre: true } },
      proveedor: { select: { razonSocial: true, numeroDocumento: true } },
      usuarioResponsable: { select: { username: true, nombres: true, apellidos: true } },
      _count: { select: { detalles: true, pagos: true, recepciones: true } },
    },
    orderBy: { fechaEmision: 'desc' },
  })
  console.log(`Total compras: ${compras.length}`)
  compras.forEach(c => {
    const f = flagTest(c.proveedor?.numeroDocumento) || flagTest(c.proveedor?.razonSocial)
    const comp = c.serieComprobante && c.numeroComprobante ? `${c.serieComprobante}-${c.numeroComprobante}` : '(sin-comp)'
    console.log(`  ${f}${c.tipoComprobante ?? 'SIN-TIPO'} ${comp} | Fecha: ${c.fechaEmision.toLocaleString('es-PE')} | ${c.sucursal.codigo} | Prov: ${c.proveedor?.razonSocial} | Total: ${c.total} | Estado: ${c.estado} / Log:${c.estadoLogistico} / Fin:${c.estadoFinanciero} | items:${c._count.detalles} pagos:${c._count.pagos} rec:${c._count.recepciones} | Resp: @${c.usuarioResponsable?.username}`)
  })

  // ------------------------------------------------------------------
  // 7. VENTAS TRANSACCIONALES
  // ------------------------------------------------------------------
  printSection('7. VENTAS TRANSACCIONALES')

  const ventas = await prisma.venta.findMany({
    where: { deletedAt: null },
    select: {
      id: true, fechaEmision: true,
      tipoComprobante: true, serie: true, numero: true,
      estado: true,
      subtotal: true, descuentoTotal: true, impuestoTotal: true, total: true, vuelto: true, saldoPendiente: true,
      sucursal: { select: { codigo: true, nombre: true } },
      cliente: { select: { nombreCompleto: true, razonSocial: true, numeroDocumento: true } },
      usuarioResponsable: { select: { username: true, nombres: true, apellidos: true } },
      _count: { select: { detalles: true, pagos: true } },
    },
    orderBy: { fechaEmision: 'desc' },
  })
  console.log(`Total ventas: ${ventas.length}`)
  ventas.forEach(v => {
    const cli = v.cliente ? (v.cliente.nombreCompleto || v.cliente.razonSocial || `DOC:${v.cliente.numeroDocumento || 'SIN'}`) : 'CLIENTE-GENERICO'
    const f = flagTest(cli) || flagTest(v.usuarioResponsable?.username)
    const comp = v.serie && v.numero ? `${v.serie}-${v.numero}` : '(sin-comp)'
    console.log(`  ${f}${v.tipoComprobante} ${comp} | Fecha: ${v.fechaEmision.toLocaleString('es-PE')} | ${v.sucursal.codigo} | Cliente: ${cli} | Total:${v.total} Vuelto:${v.vuelto} Saldo:${v.saldoPendiente} | ${v.estado} | items:${v._count.detalles} pagos:${v._count.pagos} | Resp: @${v.usuarioResponsable?.username}`)
  })

  // ------------------------------------------------------------------
  // 8. CAJA (PRIORIDAD - CAJA ABIERTA MENCIONADA)
  // ------------------------------------------------------------------
  printSection('8. CAJA - PRIORIDAD: CAJAS, APERTURAS, MOVIMIENTOS')

  printSubsection('8.1 Cajas definidas')
  const cajas = await prisma.caja.findMany({
    where: { deletedAt: null },
    select: { id: true, codigo: true, nombre: true, descripcion: true, estado: true, sucursal: { select: { codigo: true, nombre: true } } },
  })
  console.log(`Total cajas: ${cajas.length}`)
  cajas.forEach(c => {
    const f = flagTest(c.nombre) || flagTest(c.codigo) || flagTest(c.descripcion)
    console.log(`  ${f}[${c.sucursal.codigo}] ${c.codigo} - ${c.nombre} | ${c.descripcion ?? ''} | ${c.estado}`)
  })

  printSubsection('8.2 Aperturas de Caja (TODAS)')
  const aperturas = await prisma.aperturaCaja.findMany({
    where: { deletedAt: null },
    include: {
      caja: { select: { codigo: true, nombre: true, sucursal: { select: { codigo: true } } } },
      usuario: { select: { username: true, nombres: true, apellidos: true } },
      cierre: { select: { id: true, fechaCierre: true, montoSistemaEfectivo: true, montoDeclaradoEfectivo: true, diferenciaEfectivo: true } },
      _count: { select: { movimientos: true, arqueos: true, conciliaciones: true } },
    },
    orderBy: { fechaApertura: 'desc' },
  })
  console.log(`Total aperturas de caja: ${aperturas.length}`)
  aperturas.forEach(a => {
    const f = flagTest(a.caja.nombre) || flagTest(a.usuario.username) || flagTest(a.observaciones)
    const estado = a.estado === 'ABIERTA' ? '🔴 ABIERTA' : a.estado
    const cierre = a.cierre
      ? `Cierre: ${a.cierre.fechaCierre.toLocaleString('es-PE')} sist:${a.cierre.montoSistemaEfectivo} dec:${a.cierre.montoDeclaradoEfectivo} dif:${a.cierre.diferenciaEfectivo}`
      : '⚠️ SIN CIERRE'
    console.log(`  ${f}${estado} | ${a.caja.sucursal.codigo}/${a.caja.codigo} ${a.caja.nombre} | Apertura: ${a.fechaApertura.toLocaleString('es-PE')} | Usuario: @${a.usuario.username} | Fondo apertura: S/ ${a.montoAperturaEfectivo} | cierrePendiente=${a.cierrePendiente} | movs:${a._count.movimientos} arqueos:${a._count.arqueos} conciliaciones:${a._count.conciliaciones} | ${cierre}`)
    if (a.observaciones) console.log(`      Obs apertura: ${a.observaciones}`)
  })

  const aperturasAbiertas = aperturas.filter(a => a.estado === EstadoAperturaCaja.ABIERTA)
  console.log(`\n🚨 CAJAS ABIERTAS ACTUALMENTE: ${aperturasAbiertas.length}`)
  aperturasAbiertas.forEach(a => {
    console.log(`\n   >>> CAJA ABIERTA: ${a.caja.codigo} (${a.caja.nombre}) en sucursal ${a.caja.sucursal.codigo}`)
    console.log(`       Abierta por: @${a.usuario.username} - ${a.usuario.nombres} ${a.usuario.apellidos}`)
    console.log(`       Fecha apertura: ${a.fechaApertura.toLocaleString('es-PE')}`)
    console.log(`       Fondo apertura efectivo: S/ ${a.montoAperturaEfectivo}`)
    console.log(`       Cierre pendiente flag: ${a.cierrePendiente}`)
    if (a.observaciones) console.log(`       Observaciones: ${a.observaciones}`)
  })

  printSubsection('8.3 Detalle de movimientos por caja abierta')
  for (const apertura of aperturasAbiertas) {
    console.log(`\n   === MOVIMIENTOS DE CAJA ABIERTA (aperturaId=${apertura.id.slice(0, 12)}...) ===`)
    const movs = await prisma.movimientoCaja.findMany({
      where: { aperturaCajaId: apertura.id, deletedAt: null },
      include: {
        formaPago: { select: { codigo: true, nombre: true } },
        ventaPago: { select: { monto: true, venta: { select: { id: true, tipoComprobante: true, serie: true, numero: true, total: true } } } },
      },
      orderBy: { fechaMovimiento: 'asc' },
    })
    console.log(`     Total movimientos en esta apertura: ${movs.length}`)
    let sumaEfectivo = apertura.montoAperturaEfectivo.toNumber()
    movs.forEach((m, idx) => {
      const fp = m.formaPago ? `${m.formaPago.codigo}` : 'SIN-FP'
      const ventaRef = m.ventaPago ? `Vta ${m.ventaPago.venta.tipoComprobante} ${m.ventaPago.venta.serie ?? ''}-${m.ventaPago.venta.numero ?? ''} (${m.ventaPago.venta.total})` : ''
      const operacionSign = m.operacion === 'INGRESO' ? '+' : '-'
      if (fp === 'EFECTIVO') sumaEfectivo += (m.operacion === 'INGRESO' ? 1 : -1) * m.monto.toNumber()
      console.log(`     ${idx + 1}. [${m.fechaMovimiento.toLocaleString('es-PE')}] TIPO:${m.tipo} OP:${m.operacion}(${operacionSign})${m.monto} | FP:${fp} | ${m.referencia ?? ''} | ${ventaRef}`)
    })
    console.log(`     >>> SALDO EFECTIVO CALCULADO en esta apertura: S/ ${sumaEfectivo.toFixed(2)}`)
  }

  // ------------------------------------------------------------------
  // 9. INVENTARIO / LOTES / MOVIMIENTOS INVENTARIO
  // ------------------------------------------------------------------
  printSection('9. INVENTARIO Y LOTES')

  printSubsection('9.1 Inventarios por sucursal')
  const inventarios = await prisma.inventario.findMany({
    where: { deletedAt: null },
    select: {
      id: true, stockMinimo: true, stockMaximo: true, puntoReorden: true, permiteVentaSinStock: true, ubicacion: true,
      producto: { select: { sku: true, nombre: true } },
      sucursal: { select: { codigo: true, nombre: true } },
    },
    orderBy: [{ sucursal: { codigo: 'asc' } }, { producto: { sku: 'asc' } }],
  })
  console.log(`Total registros inventario: ${inventarios.length}`)
  inventarios.forEach(inv => {
    const f = flagTest(inv.producto.sku) || flagTest(inv.producto.nombre) || flagTest(inv.ubicacion)
    console.log(`  ${f}[${inv.sucursal.codigo}] ${inv.producto.sku} ${inv.producto.nombre} | ubic:${inv.ubicacion ?? '-'} | min:${inv.stockMinimo ?? '-'} max:${inv.stockMaximo ?? '-'} reord:${inv.puntoReorden ?? '-'} | sinStock:${inv.permiteVentaSinStock}`)
  })

  printSubsection('9.2 Lotes por producto/sucursal')
  const lotes = await prisma.lote.findMany({
    where: { deletedAt: null },
    select: {
      id: true, numeroLote: true, fechaFabricacion: true, fechaVencimiento: true,
      costoUnitario: true, stockInicial: true, stockDisponible: true, stockReservado: true, stockBloqueado: true, estado: true,
      producto: { select: { sku: true, nombre: true } },
      sucursal: { select: { codigo: true, nombre: true } },
      proveedor: { select: { razonSocial: true } },
    },
    orderBy: [{ sucursal: { codigo: 'asc' } }, { producto: { sku: 'asc' } }, { numeroLote: 'asc' }],
  })
  console.log(`Total lotes: ${lotes.length}`)
  lotes.forEach(l => {
    const f = flagTest(l.numeroLote) || flagTest(l.producto.sku) || flagTest(l.producto.nombre) || flagTest(l.proveedor?.razonSocial)
    const venc = new Date(l.fechaVencimiento) < new Date() ? '⚠️ VENCIDO' : ''
    console.log(`  ${f}[${l.sucursal.codigo}] ${l.producto.sku} LOTE:${l.numeroLote} | ${l.producto.nombre} | stockInic:${l.stockInicial} disp:${l.stockDisponible} res:${l.stockReservado} bloq:${l.stockBloqueado} | costo:${l.costoUnitario} | venc:${l.fechaVencimiento.toISOString().slice(0,10)} ${venc} | ${l.estado} | prov: ${l.proveedor?.razonSocial ?? '-'}`)
  })

  printSubsection('9.3 Cargas de Inventario Inicial')
  const cargasIni = await prisma.cargaInventarioInicial.findMany({
    where: { deletedAt: null },
    select: {
      id: true, estado: true, productosCargados: true, lotesCreados: true, createdAt: true,
      sucursal: { select: { codigo: true } },
      _count: { select: { detalles: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  console.log(`Total cargas inventario inicial: ${cargasIni.length}`)
  cargasIni.forEach(c => {
    console.log(`  [${c.sucursal.codigo}] ${c.createdAt.toLocaleString('es-PE')} | estado:${c.estado} | prod:${c.productosCargados} lotes:${c.lotesCreados} detalle:${c._count.detalles}`)
  })

  printSubsection('9.4 Movimientos de Inventario (KARDEX) - RESUMEN')
  const movsInvTotal = await prisma.movimientoInventario.count({ where: { deletedAt: null } })
  console.log(`Total movimientos inventario (kardex): ${movsInvTotal}`)
  const movsInvGroup = await prisma.$queryRaw`
    SELECT tipo, origen, COUNT(*) as cnt
    FROM movimientos_inventario
    WHERE deleted_at IS NULL
    GROUP BY tipo, origen
    ORDER BY tipo, origen
  ` as any[]
  movsInvGroup.forEach(r => console.log(`  [${r.tipo}] ${r.origen}: ${r.cnt} movimientos`))

  // ------------------------------------------------------------------
  // 10. COMPLEMENTARIOS: ARQUEOS, CONCILIACIONES, INGRESOS, EGRESOS
  // ------------------------------------------------------------------
  printSection('10. MOVIMIENTOS COMPLEMENTARIOS')

  const arqueos = await prisma.arqueoCaja.count({ where: { deletedAt: null } })
  const conciliaciones = await prisma.conciliacionCaja.count({ where: { deletedAt: null } })
  const conciliacionesDet = await prisma.conciliacionCajaDetalle.count({ where: { deletedAt: null } })
  const ingresos = await prisma.ingreso.findMany({ where: { deletedAt: null }, select: { concepto: true, referencia: true, movimientoCaja: { select: { monto: true, fechaMovimiento: true, aperturaCaja: { select: { caja: { select: { codigo: true } } } } } } })
  const egresos = await prisma.egreso.findMany({ where: { deletedAt: null }, select: { concepto: true, referencia: true, movimientoCaja: { select: { monto: true, fechaMovimiento: true, aperturaCaja: { select: { caja: { select: { codigo: true } } } } } } })
  const ventaPagos = await prisma.ventaPago.count({ where: { deletedAt: null } })
  const compraPagos = await prisma.compraPago.count({ where: { deletedAt: null } })
  const compraRecepciones = await prisma.compraRecepcion.count({ where: { deletedAt: null } })

  console.log(`Arqueos de caja: ${arqueos}`)
  console.log(`Conciliaciones de caja: ${conciliaciones} (${conciliacionesDet} detalles)`)
  console.log(`Pagos de venta: ${ventaPagos}`)
  console.log(`Pagos de compra: ${compraPagos}`)
  console.log(`Recepciones de compra: ${compraRecepciones}`)

  printSubsection('10.1 Ingresos de caja')
  console.log(`Total ingresos: ${ingresos.length}`)
  ingresos.forEach(i => console.log(`  ${flagTest(i.concepto) || flagTest(i.referencia)}[${i.movimientoCaja.aperturaCaja.caja.codigo}] ${i.movimientoCaja.fechaMovimiento.toLocaleString('es-PE')} | concepto:${i.concepto} | monto:${i.movimientoCaja.monto} | ref:${i.referencia ?? ''}`))

  printSubsection('10.2 Egresos de caja')
  console.log(`Total egresos: ${egresos.length}`)
  egresos.forEach(e => console.log(`  ${flagTest(e.concepto) || flagTest(e.referencia)}[${e.movimientoCaja.aperturaCaja.caja.codigo}] ${e.movimientoCaja.fechaMovimiento.toLocaleString('es-PE')} | concepto:${e.concepto} | monto:${e.movimientoCaja.monto} | ref:${e.referencia ?? ''}`))

  // ------------------------------------------------------------------
  // 11. AUDITORÍA
  // ------------------------------------------------------------------
  printSection('11. AUDITORÍA')
  const auditTotal = await prisma.auditoria.count({ where: { deletedAt: null } })
  console.log(`Total registros auditoría: ${auditTotal}`)
  if (auditTotal > 0) {
    const auditGroup = await prisma.$queryRaw`
      SELECT accion, tabla, COUNT(*) as cnt
      FROM auditoria
      WHERE deleted_at IS NULL
      GROUP BY accion, tabla
      ORDER BY cnt DESC
      LIMIT 20
    ` as any[]
    console.log('Top 20 acciones auditadas:')
    auditGroup.forEach(r => console.log(`  ${r.accion} sobre ${r.tabla}: ${r.cnt} registros`))
  }

  // ------------------------------------------------------------------
  // 12. RESUMEN GENERAL DE CONTEOS
  // ------------------------------------------------------------------
  printSection('12. RESUMEN GENERAL - CONTEOS POR TABLA')
  const counts: Array<{ grupo: string, tabla: string, count: number }> = [
    { grupo: 'NO TOCAR', tabla: 'empresas', count: empresas.length },
    { grupo: 'NO TOCAR', tabla: 'sucursales', count: sucursales.length },
    { grupo: 'NO TOCAR', tabla: 'usuarios', count: usuarios.length },
    { grupo: 'NO TOCAR', tabla: 'roles', count: roles.length },
    { grupo: 'NO TOCAR', tabla: 'permisos', count: permisos },
    { grupo: 'NO TOCAR', tabla: 'rol_permiso', count: rolPermisos },
    { grupo: 'NO TOCAR', tabla: 'tipos_empresa', count: tiposEmpresa.length },
    { grupo: 'NO TOCAR', tabla: 'modulos', count: modulos },
    { grupo: 'NO TOCAR', tabla: 'configuracion', count: configuraciones.length },
    { grupo: 'NO TOCAR', tabla: 'formas_pago', count: formasPago.length },
    { grupo: 'NO TOCAR', tabla: 'impuestos', count: impuestos.length },
    { grupo: 'NO TOCAR', tabla: 'series_documentos', count: seriesDoc.length },
    { grupo: 'EVALUAR', tabla: 'categorias', count: categorias.length },
    { grupo: 'EVALUAR', tabla: 'laboratorios', count: laboratorios.length },
    { grupo: 'EVALUAR', tabla: 'presentaciones', count: presentaciones.length },
    { grupo: 'EVALUAR', tabla: 'unidades_medida', count: unidades.length },
    { grupo: 'EVALUAR', tabla: 'tipos_comerciales', count: tiposComerciales.length },
    { grupo: 'EVALUAR', tabla: 'principios_activos', count: principios.length },
    { grupo: 'EVALUAR', tabla: 'motivos_movimiento', count: motivos.length },
    { grupo: 'EVALUAR', tabla: 'productos', count: productos.length },
    { grupo: 'EVALUAR', tabla: 'proveedores', count: proveedores.length },
    { grupo: 'EVALUAR', tabla: 'clientes', count: clientes.length },
    { grupo: 'TRANSACCIONAL', tabla: 'inventario', count: inventarios.length },
    { grupo: 'TRANSACCIONAL', tabla: 'lotes', count: lotes.length },
    { grupo: 'TRANSACCIONAL', tabla: 'movimientos_inventario', count: movsInvTotal },
    { grupo: 'TRANSACCIONAL', tabla: 'cargas_inventario_inicial', count: cargasIni.length },
    { grupo: 'TRANSACCIONAL', tabla: 'compras', count: compras.length },
    { grupo: 'TRANSACCIONAL', tabla: 'ventas', count: ventas.length },
    { grupo: 'TRANSACCIONAL', tabla: 'cajas', count: cajas.length },
    { grupo: 'TRANSACCIONAL', tabla: 'apertura_caja', count: aperturas.length },
    { grupo: 'TRANSACCIONAL', tabla: 'arqueo_caja', count: arqueos },
    { grupo: 'TRANSACCIONAL', tabla: 'conciliacion_caja', count: conciliaciones },
    { grupo: 'TRANSACCIONAL', tabla: 'ingresos', count: ingresos.length },
    { grupo: 'TRANSACCIONAL', tabla: 'egresos', count: egresos.length },
    { grupo: 'TRANSACCIONAL', tabla: 'auditoria', count: auditTotal },
  ]
  const groups = [...new Set(counts.map(c => c.grupo))]
  groups.forEach(g => {
    console.log(`\n  📂 ${g}:`)
    counts.filter(c => c.grupo === g).forEach(c => console.log(`    - ${c.tabla}: ${c.count} registros`))
  })

  // ------------------------------------------------------------------
  // 13. PROPUESTA DE LIMPIEZA (SOLO TEXTO, NINGUNA ACCIÓN)
  // ------------------------------------------------------------------
  printSection('13. PROPUESTA DE LIMPIEZA - FASE DE DIAGNÓSTICO')
  console.log(`
  ╔══════════════════════════════════════════════════════════════════╗
  ║  PROPUESTA DE LIMPIEZA - SOLO INFORME, AÚN SIN ACCIONES          ║
  ╚══════════════════════════════════════════════════════════════════╝

  GRUPO 1 — DATOS QUE NO SE DEBEN TOCAR NUNCA:
  -------------------------------------------------
  ✓ empresas, sucursales
  ✓ usuarios reales (validar con lista de negocio)
  ✓ roles, permisos, rol_permiso, usuario_rol, usuario_sucursal
  ✓ tipos_empresa, modulos, tipo_empresa_modulo
  ✓ configuracion (claves del sistema)
  ✓ formas_pago, impuestos, series_documentos
  ✓ categorias, laboratorios, presentaciones, unidades_medida
  ✓ tipos_comerciales, principios_activos, motivos_movimiento_inventario
    (NOTA: Estos catálogos sí podrían evaluarse, pero si la estructura
    base es correcta para operar, se conservan incluso si algunos
    catálogos iniciales eran del seed. Se revisan en EVALUAR.)

  GRUPO 2 — CATÁLOGOS MAESTROS A EVALUAR UNO A UNO (CON NEGOCIO):
  ---------------------------------------------------------------
  ⚠️ productos (incluye lotes e inventario asociado)
     - Revisar lista con el cliente. Los que son REALES de la botica
       se conservan. Los del seed MED-0001 a MED-0004 y otros marcados
       con ⚠️ se eliminan (con efecto cascada en inventario + lotes
       + movimientos_inventario).
  ⚠️ proveedores
     - Revisar lista con el cliente. DDP y otros de prueba ⚠️ se eliminan.
       Los proveedores reales con compras asociadas: si las compras
       son de prueba, primero se eliminan compras → luego proveedor.
  ⚠️ clientes
     - Revisar lista con el cliente. Clientes de prueba ⚠️ → eliminar.
       Clientes reales se conservan INCLUSO si no tienen ventas.

  GRUPO 3 — TRANSACCIONALES DE PRUEBA (SE LIMPIAN COMPLETAMENTE):
  ----------------------------------------------------------------
  🗑️ TODAS LAS COMPRAS (incluyendo detalle_compra, compra_pagos,
     compra_recepciones). Las compras reales NO EXISTEN aún (fecha
     puesta en marcha = ahora).
     DELETE orden:
       1. compra_recepciones.lotes -> SET NULL lote.compraRecepcionId
       2. detalle_compra.lotes -> SET NULL lote.detalleCompraId
       3. movimientos_inventario WHERE detalleCompraId IS NOT NULL
       4. compra_pagos
       5. compra_recepciones
       6. detalle_compra
       7. compras

  🗑️ TODAS LAS VENTAS (incluyendo detalle_venta, detalle_venta_lote,
     venta_pagos). Ventas reales NO EXISTEN aún.
     DELETE orden:
       1. movimientos_inventario WHERE detalleVentaId IS NOT NULL
       2. movimientos_inventario WHERE detalleVentaLoteId IS NOT NULL
       3. movimientos_caja WHERE ventaPagoId IS NOT NULL
       4. detalle_venta_lote
       5. venta_pagos
       6. detalle_venta
       7. ventas

  🗑️ CAJA - OPERACIONES COMPLETAS (ORDEN CRÍTICO):
     1. Cerrar lógicamente la apertura ABIERTA actual si el negocio
        confirma. Alternativa: anular la apertura ABIERTA.
        AMBAS OPCIONES requieren validación con usuario real.
     2. egresos (borra en cascada su movimiento_caja)
     3. ingresos (borra en cascada su movimiento_caja)
     4. conciliacion_caja_detalle
     5. conciliacion_caja
     6. arqueo_caja
     7. cierre_caja (uno por apertura)
     8. movimientos_caja restantes (los de apertura y cierre manual)
     9. apertura_caja
     10. cajas (definiciones de caja - SÓLO si son de prueba;
         por defecto "Caja Principal" probablemente se conserve pero
         debe re-inicializarse con un apertura nueva real)

  🗑️ INVENTARIO TRANSACCIONAL:
     1. cargas_inventario_inicial_detalle
     2. cargas_inventario_inicial
     3. movimientos_inventario de origen=APERTURA o INVENTARIO_INICIAL
        (dejando los de COMPRA/VENTA que ya se borran antes)
     4. lotes (TODO o sólo los de productos de prueba → depende de
        si los productos de la lista se conservan como reales)
     5. inventario (si se resetea TODO el stock desde cero para
        la carga real; alternativamente se conservan inventario
        de productos reales y se reinician stock a 0 para cargar
        mediante CargaInventarioInicial oficial)

  GRUPO 4 — AUDITORÍA:
  ---------------------
  🗑️ auditoria → OPCIÓN A (recomendado para producción limpia):
     TRUNCATE completo. Los datos de prueba no deben figurar en
     auditoría de producción.
     OPCIÓN B: mantener auditoría histórica por trazabilidad.
     Esta decisión es del cliente.

  ╔══════════════════════════════════════════════════════════════════╗
  ║  PASOS SIGUIENTES - ANTES DE EJECUTAR NADA:                      ║
  ╠══════════════════════════════════════════════════════════════════╣
  ║  1. TÚ VALIDAS este diagnóstico (listas productos, proveedores, ║
  ║     clientes marcados con ⚠️).                                   ║
  ║  2. Confirmas cuáles CATÁLOGOS MAESTROS se eliminan.            ║
  ║  3. Confirmas si se RESETEA TODO lote/inventario o sólo lo de   ║
  ║     productos de prueba (depende de si hay productos REALES ya  ║
  ║     bien cargados en lotes).                                     ║
  ║  4. Confirmas qué hacer con la CAJA ABIERTA (anular / cerrar).  ║
  ║  5. Confirmas si se trunca AUDITORÍA o se conserva.              ║
  ║  6. Yo preparo el script de limpieza en una TRANSACCIÓN con     ║
  ║     backup lógico (SELECT previo), y lo ejecuto SÓLO con tu OK.  ║
  ╚══════════════════════════════════════════════════════════════════╝
`)

  printSection('FIN DIAGNÓSTICO')
}

main()
  .catch((e) => {
    console.error('ERROR EN DIAGNÓSTICO:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
