import process from 'node:process'
import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'dotenv'
import pkg from '@prisma/client'
const { PrismaClient } = pkg
import bcrypt from 'bcryptjs'

const envPath = path.resolve(process.cwd(), '.env.development')
if (fs.existsSync(envPath)) {
  const parsed = parse(fs.readFileSync(envPath))
  for (const [k, v] of Object.entries(parsed)) if (process.env[k] === undefined) process.env[k] = v
}

const API_BASE = (process.env.VITE_API_BASE_URL && process.env.VITE_API_BASE_URL.startsWith('http'))
  ? process.env.VITE_API_BASE_URL
  : 'http://127.0.0.1:4000'

const prisma = new PrismaClient()
const devPw = process.env.DEV_ADMIN_PASSWORD ?? 'DevPassword123!'
const pwHash = bcrypt.hashSync(devPw, 10)

function uid() { return crypto.randomUUID() }

/**
 * @typedef {{email:string, password:string, id:string, token?:string, branchId?:string, userId?:string}} TestUser
 */

/** @type {{ADMIN_ST: TestUser, SUPERVISOR_ST: TestUser, CAJERO_ST: TestUser, TECNICO_ST: TestUser, TECNICO2_ST: TestUser, OTHER_COMPANY_ADMIN: TestUser}} */
const USERS = {
  ADMIN_ST: { email: 'c1_admin_st_bloque5@rayego.pe', password: devPw },
  SUPERVISOR_ST: { email: 'c1_super_st_bloque5@rayego.pe', password: devPw },
  CAJERO_ST: { email: 'c1_cajero_st_bloque5@rayego.pe', password: devPw },
  TECNICO_ST: { email: 'c1_tec1_st_bloque5@rayego.pe', password: devPw },
  TECNICO2_ST: { email: 'c1_tec2_st_bloque5@rayego.pe', password: devPw },
  OTHER_COMPANY_ADMIN: { email: 'c1_other_admin_bloque5@rayego.pe', password: devPw },
}
for (const u of Object.values(USERS)) u.id = uid();

// ============== Prisma helpers: create RayegoTech company + branches + roles + users ==============

async function ensureRayegoTechCompany() {
  // Find or create TipoEmpresa SERVICIO_TECNICO
  let tipoEmp = await prisma.tipoEmpresa.findFirst({ where: { codigo: 'SERVICIO_TECNICO' } })
  if (!tipoEmp) {
    tipoEmp = await prisma.tipoEmpresa.create({
      data: {
        codigo: 'SERVICIO_TECNICO',
        nombre: 'Servicio Técnico',
        descripcion: 'Tipo de empresa vertical Servicio Técnico RayegoTech',
        modulos: {
          create: [
            ...[
              ['ordenes_servicio','Ordenes Servicio','Servicio Técnico'],
              ['diagnostico','Diagnóstico','Servicio Técnico'],
              ['presupuestos','Presupuestos','Servicio Técnico'],
              ['reparaciones','Reparaciones','Servicio Técnico'],
              ['entregas','Entregas','Servicio Técnico'],
              ['equipos','Equipos','Servicio Técnico'],
              ['dashboard','Dashboard','Operaciones'],
              ['clientes','Clientes','Operaciones'],
              ['caja','Caja','Operaciones'],
              ['reportes','Reportes','Reportes'],
              ['usuarios','Usuarios','Sistema'],
              ['configuracion','Configuración','Sistema'],
            ].map(([codigo, nombre, categoria]) => ({ codigo, nombre, categoria })),
          ],
        },
      },
    })
  }

  // RayegoTech empresa
  let empresaA = await prisma.empresa.findFirst({ where: { razonSocial: 'RAYEGOTECH BLOQUE5 DEV SAC' } })
  if (!empresaA) {
    empresaA = await prisma.empresa.create({
      data: {
        razonSocial: 'RAYEGOTECH BLOQUE5 DEV SAC',
        nombreComercial: 'RayegoTech Bloque5',
        numeroDocumento: '20RTBB5000000',
        tipoDocumento: 'RUC',
        email: 'bloque5@rayego.pe',
        direccion: 'Av. Test 123 Lima',
        ubigeo: '150101',
        tipoEmpresaId: tipoEmp.id,
      },
    })
  }
  // Otra empresa B (para cross-empresa C18)
  let empresaB = await prisma.empresa.findFirst({ where: { razonSocial: 'OTRA EMPRESA BLOQUE5 SAC' } })
  if (!empresaB) {
    empresaB = await prisma.empresa.create({
      data: {
        razonSocial: 'OTRA EMPRESA BLOQUE5 SAC',
        nombreComercial: 'Empresa B',
        numeroDocumento: '20RTEB5000000',
        tipoDocumento: 'RUC',
        email: 'empb@rayego.pe',
        direccion: 'Av. Other 456',
        ubigeo: '150101',
        tipoEmpresaId: tipoEmp.id,
      },
    })
  }
  // Sucursales
  let sucA = await prisma.sucursal.findFirst({ where: { AND: [{ empresaId: empresaA.id }, { codigo: 'RTB5' }] } })
  if (!sucA) sucA = await prisma.sucursal.create({ data: { empresaId: empresaA.id, codigo: 'RTB5', nombre: 'Suc RayegoTech B5', direccion: 'Av. Test 123' } })
  let sucB = await prisma.sucursal.findFirst({ where: { AND: [{ empresaId: empresaB.id }, { codigo: 'EMPB' }] } })
  if (!sucB) sucB = await prisma.sucursal.create({ data: { empresaId: empresaB.id, codigo: 'EMPB', nombre: 'Suc B', direccion: 'Av B 456' } })

  // Roles ST son GLOBALES (no empresaId). Búsqueda por código.
  const ROL = [
    ['ADMIN_SERVICIO_TECNICO', 'Admin ST Bloque5', 'Acceso total ST'],
    ['SUPERVISOR_ST', 'Supervisor ST Bloque5', 'Supervisa ST'],
    ['CAJERO_ST', 'Cajero ST Bloque5', 'Caja ST'],
    ['TECNICO_ST', 'Técnico ST Bloque5', 'Ejecuta reparaciones'],
  ]
  const allPermisos = await prisma.permiso.findMany()
  const permisoMap = new Map(allPermisos.map(p => [p.codigo, p.id]))
  for (const [cod, nom, desc] of ROL) {
    let r = await prisma.rol.findUnique({ where: { codigo: cod }, include: { rolesPermisos: true } })
    if (!r) {
      const perms = (
        cod === 'ADMIN_SERVICIO_TECNICO'
          ? ['ordenesServicio.read','ordenesServicio.write','tecnicos.read','tecnicos.write','clientes.read','clientes.write','caja.read','caja.write','reportes.read','usuarios.read','configuracion.read','configuracion.manage','dashboard.read','garantiasOrdenServicio.write']
          : cod === 'SUPERVISOR_ST'
          ? ['ordenesServicio.read','ordenesServicio.write','tecnicos.read','clientes.read','reportes.read','dashboard.read','garantiasOrdenServicio.write']
          : cod === 'CAJERO_ST'
          ? ['ordenesServicio.read','ordenesServicio.write','caja.read','caja.write','clientes.read','dashboard.read']
          : ['ordenesServicio.read','ordenesServicio.write','tecnicos.read','clientes.read','dashboard.read']
      ).filter(c => permisoMap.has(c)).map(c => ({ permisoId: permisoMap.get(c) }))
      r = await prisma.rol.create({ data: { codigo: cod, nombre: nom, descripcion: desc, rolesPermisos: { createMany: { data: perms, skipDuplicates: true } } }, include: { rolesPermisos: true } })
    } else {
      // Asegurar que están todos los permisos (skipDuplicates no inserta repetidos)
      const existingP = new Set(r.rolesPermisos.map(rp => rp.permisoId))
      const permsFaltan = (
        cod === 'ADMIN_SERVICIO_TECNICO'
          ? ['ordenesServicio.read','ordenesServicio.write','tecnicos.read','tecnicos.write','clientes.read','clientes.write','caja.read','caja.write','reportes.read','usuarios.read','configuracion.read','configuracion.manage','dashboard.read','garantiasOrdenServicio.write']
          : cod === 'SUPERVISOR_ST'
          ? ['ordenesServicio.read','ordenesServicio.write','tecnicos.read','clientes.read','reportes.read','dashboard.read','garantiasOrdenServicio.write']
          : cod === 'CAJERO_ST'
          ? ['ordenesServicio.read','ordenesServicio.write','caja.read','caja.write','clientes.read','dashboard.read']
          : ['ordenesServicio.read','ordenesServicio.write','tecnicos.read','clientes.read','dashboard.read']
      ).filter(c => permisoMap.has(c)).map(c => permisoMap.get(c)).filter(pid => !existingP.has(pid))
      if (permsFaltan.length) {
        await prisma.rolPermiso.createMany({ data: permsFaltan.map(pid => ({ rolId: r.id, permisoId: pid })), skipDuplicates: true })
      }
    }
  }
  const rolesGlobal = await prisma.rol.findMany({ where: { codigo: { in: ROL.map(r=>r[0]) } } })
  const roleAByCod = new Map(rolesGlobal.map(r=>[r.codigo, r.id]))
  const roleBAdminId = roleAByCod.get('ADMIN_SERVICIO_TECNICO')

  // Create cliente para OS
  let cliA = await prisma.cliente.findFirst({ where: { AND:[{ empresaId: empresaA.id },{ numeroDocumento: '70000001' }] } })
  if (!cliA) cliA = await prisma.cliente.create({ data: { empresaId: empresaA.id, tipoDocumento: 'DNI', numeroDocumento: '70000001', nombres: 'Cliente', apellidosPaterno: 'Bloque5', apellidosMaterno: 'A', email: 'cli_b5@rayego.pe', telefono: '900000001' } })

  return { empresaA, empresaB, sucA, sucB, roleAByCod, roleBAdminId, cliA }
}

async function ensureUsersAndLogin(ctx) {
  const { empresaA, empresaB, sucA, sucB, roleAByCod, roleBAdminId } = ctx
  const specs = [
    [USERS.ADMIN_ST, empresaA.id, sucA.id, roleAByCod.get('ADMIN_SERVICIO_TECNICO')],
    [USERS.SUPERVISOR_ST, empresaA.id, sucA.id, roleAByCod.get('SUPERVISOR_ST')],
    [USERS.CAJERO_ST, empresaA.id, sucA.id, roleAByCod.get('CAJERO_ST')],
    [USERS.TECNICO_ST, empresaA.id, sucA.id, roleAByCod.get('TECNICO_ST')],
    [USERS.TECNICO2_ST, empresaA.id, sucA.id, roleAByCod.get('TECNICO_ST')],
    [USERS.OTHER_COMPANY_ADMIN, empresaB.id, sucB.id, roleBAdminId],
  ]
  // Crea usuario + sucursal asignada + rol
  for (const [u, empId, sucId, rolId] of specs) {
    let user = await prisma.usuario.findFirst({ where: { email: u.email } })
    if (!user) {
      user = await prisma.usuario.create({
        data: {
          id: u.id,
          empresaId: empId,
          email: u.email,
          username: u.email.split('@')[0],
          passwordHash: pwHash,
          nombres: u.email.split('@')[0].replaceAll('_',' ').toUpperCase(),
          apellidosPaterno: 'Bloque5',
          apellidosMaterno: 'ST',
          tipoDocumento: 'DNI',
          numeroDocumento: '7' + u.email.slice(2, 9).padStart(7, '0').slice(0,7),
          usuarioSucursales: { create: { sucursalId: sucId, esPrincipal: true } },
          roles: { create: { rolId } },
        },
      })
    } else {
      u.id = user.id
    }
    // Técnicos: asegurarse registro en tabla tecnico
    if (u === USERS.TECNICO_ST || u === USERS.TECNICO2_ST) {
      let t = await prisma.tecnico.findFirst({ where: { usuarioId: user.id } })
      if (!t) t = await prisma.tecnico.create({ data: { empresaId: empId, usuarioId: user.id, codigoTecnico: 'T-'+user.id.slice(0,6).toUpperCase(), especialidad: 'General', activo: true } })
    }
  }

  // Logins
  for (const u of Object.values(USERS)) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u.email, password: u.password, remember: false }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.status !== 200) throw new Error('Login ' + u.email + ' HTTP ' + res.status + ' ' + (data.message || ''))
    if (data.requiresBranchSelection) {
      const b = (data.branches || [])[0]
      const r2 = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: u.email, password: u.password, remember: false, branchId: b.id }),
      })
      const d2 = await r2.json().catch(() => ({}))
      if (r2.status !== 200) throw new Error('Login w/ branch ' + u.email + ' HTTP ' + r2.status + ' ' + JSON.stringify(d2))
      u.token = d2.accessToken; u.branchId = d2.user?.branchId; u.userId = d2.user?.id
    } else {
      u.token = data.accessToken; u.branchId = data.user?.branchId; u.userId = data.user?.id
    }
  }
}

// ============== HTTP helpers ==============
async function req(user, method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': user?.token ? `Bearer ${user.token}` : '',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await res.text()
  let json = {}
  try { json = JSON.parse(text) } catch { json = { _raw: text } }
  return { status: res.status, data: json }
}
const POST = (u, p, b) => req(u, 'POST', p, b)
const PUT  = (u, p, b) => req(u, 'PUT', p, b)
const GET  = (u, p)    => req(u, 'GET', p)

// ============== Driver 18 cases ==============
const report = {}

function fail(caseId, expected, got, where, error, classification) {
  report[caseId] = { result: 'FAIL', expected, got, where, error, classification }
}
function pass(caseId, extra) {
  report[caseId] = { result: 'PASS', ...(extra ? { extra } : {}) }
}

async function runCases(ctx) {
  // -- C1 ADMIN_ST crea OS → RECEPCIONADO
  try {
    const r = await POST(USERS.ADMIN_ST, '/api/rt/ordenes-servicio', {
      clienteId: ctx.cliA.id,
      equipoTipo: 'LAPTOP', marca: 'HP', modelo: 'Pavilion G6', numeroSerie: 'SN-C1-' + Date.now(),
      problemaReportado: 'No enciende', diagnosticoInicial: null, recepcionObservaciones: 'Caso C1',
      estadoActual: 'RECEPCIONADO',
      items: [],
    })
    ctx.OS_ID_C1 = r.data?.id
    if (r.status === 200 || r.status === 201) {
      if (r.data?.estadoActual === 'RECEPCIONADO') pass('C1', { id: ctx.OS_ID_C1 })
      else fail('C1','estado=RECEPCIONADO', `estado=${r.data?.estadoActual}`, 'POST /api/rt/ordenes-servicio', JSON.stringify(r.data), 'código / payload')
    } else {
      fail('C1','HTTP 200/201 OS creada', `HTTP ${r.status}`, 'POST /api/rt/ordenes-servicio', JSON.stringify(r.data), 'código o datos')
    }
  } catch (e) { fail('C1','creada OS OK','excepción','POST /api/rt/ordenes-servicio', e.message,'código') }

  // -- C2 CAJERO_ST crea OS → 200
  try {
    const r = await POST(USERS.CAJERO_ST, '/api/rt/ordenes-servicio', {
      clienteId: ctx.cliA.id,
      equipoTipo: 'IMPRESORA', marca: 'Epson', modelo: 'L3250', numeroSerie: 'SN-C2-' + Date.now(),
      problemaReportado: 'No imprime negro', diagnosticoInicial: null, recepcionObservaciones: 'Caso C2',
      estadoActual: 'RECEPCIONADO',
      items: [],
    })
    ctx.OS_ID_C2 = r.data?.id
    if ((r.status === 200 || r.status === 201) && r.data?.id) pass('C2', { id: ctx.OS_ID_C2 })
    else fail('C2','HTTP 200 + id', `HTTP ${r.status} ${JSON.stringify(r.data)}`, 'POST /api/rt/ordenes-servicio', JSON.stringify(r.data),'código / permisos CAJERO_ST ordenesServicio.write')
  } catch (e) { fail('C2','200','excepción','POST /api/rt/ordenes-servicio', e.message,'código') }

  // -- C3 TECNICO_ST crea OS sin tecnico → tecnicoAsignadoId = sí mismo
  try {
    const r = await POST(USERS.TECNICO_ST, '/api/rt/ordenes-servicio', {
      clienteId: ctx.cliA.id,
      equipoTipo: 'CELULAR', marca: 'Samsung', modelo: 'A54', numeroSerie: 'SN-C3-' + Date.now(),
      problemaReportado: 'Batería', diagnosticoInicial: null, recepcionObservaciones: 'Caso C3',
      estadoActual: 'RECEPCIONADO',
      items: [],
    })
    ctx.OS_ID_C3 = r.data?.id
    if (r.status === 200 || r.status === 201) {
      const tecnicoAsigId = r.data?.tecnicoAsignadoId
      // El endpoint suele no devolver relación, hay que hacer GET
      const g = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}`)
      const realTecId = g.data?.tecnicoAsignadoId
      // Necesitamos id del técnico asociado al usuario TECNICO_ST
      const tecnicoRow = await prisma.tecnico.findFirst({ where: { usuarioId: USERS.TECNICO_ST.userId } })
      ctx.TEC1_ID = tecnicoRow?.id
      ctx.TEC1_USUARIO_ID = USERS.TECNICO_ST.userId
      if (realTecId === tecnicoRow?.id) pass('C3', { tecnicoId: realTecId, esperado: tecnicoRow?.id })
      else fail('C3', `tecnicoAsignadoId = ${tecnicoRow?.id} (self)`, `obtenido=${realTecId}`, 'POST /api/rt/ordenes-servicio TECNICO_ST + GET', `autoasign no match. Creación: ${JSON.stringify(r.data)} | GET: ${JSON.stringify(g.data)}`, 'código T4 autoasignación')
    } else fail('C3','HTTP 200 OS creada', `HTTP ${r.status}`, 'POST /api/rt/ordenes-servicio', JSON.stringify(r.data), 'código')
  } catch (e) { fail('C3','200 + self','excepción','POST OS / GET', e.message,'código') }

  // -- C4 Técnico diagnóstico → RECEPCIONADO → EN_DIAGNOSTICO
  try {
    const r = await POST(USERS.TECNICO_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}/diagnosticos`, {
      diagnostico: 'Batería defectuosa, reemplazo recomendado',
      tecnicoId: ctx.TEC1_ID,
    })
    // Ahora cambiar estado a EN_DIAGNOSTICO o el endpoint mismo lo hace? Revisaremos si el endpoint cambia el estado o es via cambiarEstadoOrden
    // Si diagnosticos endpoint no cambia estado → manualmente cambiar
    let cambio = null
    if (r.status >= 200 && r.status < 300) {
      cambio = await PUT(USERS.TECNICO_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}/estado`, { nuevoEstado: 'EN_DIAGNOSTICO', motivo: 'Inicio diagnóstico C4' })
    }
    const g = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}`)
    const est = g.data?.estadoActual
    if (est === 'EN_DIAGNOSTICO') pass('C4', { estado: est })
    else fail('C4','EN_DIAGNOSTICO', `estado=${est}`, `POST diagnosticos ${r.status} + PUT estado ${cambio?.status}`, `POST diag=${JSON.stringify(r.data)} | PUT=${JSON.stringify(cambio?.data)} | GET=${JSON.stringify(g.data)}`, 'código validador transiciones')
  } catch (e) { fail('C4','EN_DIAGNOSTICO','excepción','POST diagnosticos / PUT estado', e.message,'código') }

  // -- C5 Técnico crea presupuesto → PRESUPUESTADO
  try {
    const r = await POST(USERS.TECNICO_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}/presupuestos`, {
      items: [{ concepto: 'Reemplazo batería', cantidad: 1, precioUnitario: 150, tipoItem: 'SERVICIO' }],
      manoObra: 50,
      subtotal: 200,
      impuestos: 36,
      total: 236,
      moneda: 'PEN',
      validoHasta: new Date(Date.now()+7*86400000).toISOString().slice(0,10),
      observaciones: 'Presupuesto C5',
    })
    const g = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}`)
    const est = g.data?.estadoActual
    if (est === 'PRESUPUESTADO') pass('C5', { estado: est, presupCreado: r.status<300 })
    else fail('C5','PRESUPUESTADO', `estado=${est}`, 'POST presupuestos', `HTTP=${r.status} body=${JSON.stringify(r.data)} | GET estado=${JSON.stringify(g.data?.estadoActual)}`, 'código endpoint presupuestos o PRESUPUESTADO no seteado')
  } catch (e) { fail('C5','PRESUPUESTADO','excepción','POST presupuestos', e.message,'código') }

  // -- C6 Presentar para aprobación → ESPERANDO_AUTORIZACION
  try {
    const r = await PUT(USERS.TECNICO_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}/estado`, { nuevoEstado: 'ESPERANDO_AUTORIZACION', motivo: 'Presentar para aprobación C6' })
    const g = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}`)
    const est = g.data?.estadoActual
    if (est === 'ESPERANDO_AUTORIZACION') pass('C6', { estado: est })
    else fail('C6','ESPERANDO_AUTORIZACION', `estado=${est}`, 'PUT estado nuevo ESPERANDO_AUTORIZACION', `HTTP ${r.status} ${JSON.stringify(r.data)} | GET estado=${JSON.stringify(g.data)}`, 'validador transiciones PRESUPUESTADO → ESPERANDO_AUTORIZACION')
  } catch (e) { fail('C6','ESPERANDO_AUTORIZACION','excepción','PUT estado', e.message,'código') }

  // -- C7 Sin aprobación cliente aprobadoClienteAt=null → Intentar EN_REPARACION → 409
  try {
    const antes = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}`)
    const aprob = antes.data?.aprobadoClienteAt
    if (aprob) {
      fail('C7','aprobadoClienteAt=null antes del test', `ya estaba aprobado=${aprob}`, 'GET OS precondición', JSON.stringify(antes.data), 'datos preexistentes / aprobación anterior')
    } else {
      const r = await PUT(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}/estado`, { nuevoEstado: 'EN_REPARACION', motivo: 'C7 sin aprobar → debe fallar' })
      if (r.status === 409) pass('C7', { status: r.status, msg: r.data?.message })
      else fail('C7','HTTP 409 transición inválida', `HTTP ${r.status} ${JSON.stringify(r.data)}`, 'PUT estado EN_REPARACION con aprobadoClienteAt=null', JSON.stringify(r.data), 'validador T2: regla ESPERANDO_AUTORIZACION→EN_REPARACION requiere ctx.aprobadoClienteAt')
    }
  } catch (e) { fail('C7','409','excepción','PUT estado', e.message,'código') }

  // -- C8 aprobarPresupuesto PUT → cliente autoriza. luego avanzar → EN_REPARACION
  try {
    const antes = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}`)
    const presId = antes.data?.presupuestoActualId ?? antes.data?.presupuestos?.[0]?.id
    if (!presId) { fail('C8','presupuesto id existente', 'no hay presupuesto id en GET', 'precondición GET OS C3', JSON.stringify(antes.data), 'datos endpoint presupuestos no asociando') }
    else {
      const aprob = await PUT(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}/presupuestos/aprobar`, { presupuestoId: presId, observaciones: 'Cliente aprueba C8' })
      if (aprob.status >= 200 && aprob.status < 300) {
        const r = await PUT(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}/estado`, { nuevoEstado: 'EN_REPARACION', motivo: 'Inicio reparación C8' })
        const g = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}`)
        const est = g.data?.estadoActual
        if (est === 'EN_REPARACION') pass('C8', { estado: est, aprobStatus: aprob.status })
        else fail('C8','EN_REPARACION', `estado=${est}`, 'PUT aprobar + PUT estado EN_REPARACION', `aprobar=${aprob.status} ${JSON.stringify(aprob.data)} | cambiar=${r.status} ${JSON.stringify(r.data)} | GET=${JSON.stringify(g.data)}`, 'código aprobación set aprobadoClienteAt o validador')
      } else fail('C8','HTTP 2xx aprobar presupuesto', `HTTP ${aprob.status} ${JSON.stringify(aprob.data)}`, 'PUT /presupuestos/aprobar', JSON.stringify(aprob.data), 'endpoint aprobarPresupuesto')
    }
  } catch (e) { fail('C8','EN_REPARACION','excepción','PUT aprobarPresupuesto + PUT estado', e.message,'código') }

  // -- C9 Trabajo terminado EN_REPARACION → TRABAJO_TERMINADO
  try {
    const r = await PUT(USERS.TECNICO_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}/estado`, { nuevoEstado: 'TRABAJO_TERMINADO', motivo: 'Finaliza reparación C9' })
    const g = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}`)
    const est = g.data?.estadoActual
    if (est === 'TRABAJO_TERMINADO') pass('C9', { estado: est })
    else fail('C9','TRABAJO_TERMINADO', `estado=${est}`, 'PUT estado nuevo TRABAJO_TERMINADO', `HTTP ${r.status} ${JSON.stringify(r.data)} | GET=${JSON.stringify(g.data)}`, 'validador transición EN_REPARACION → TRABAJO_TERMINADO')
  } catch (e) { fail('C9','TRABAJO_TERMINADO','excepción','PUT estado', e.message,'código') }

  // -- C10 Listo cobro → TRABAJO_TERMINADO → LISTO_PARA_COBRO
  try {
    const r = await PUT(USERS.TECNICO_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}/estado`, { nuevoEstado: 'LISTO_PARA_COBRO', motivo: 'Listo cobro C10' })
    const g = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}`)
    const est = g.data?.estadoActual
    if (est === 'LISTO_PARA_COBRO') pass('C10', { estado: est })
    else fail('C10','LISTO_PARA_COBRO', `estado=${est}`, 'PUT estado LISTO_PARA_COBRO', `HTTP ${r.status} ${JSON.stringify(r.data)} | GET=${JSON.stringify(g.data)}`, 'validador TRABAJO_TERMINADO → LISTO_PARA_COBRO')
  } catch (e) { fail('C10','LISTO_PARA_COBRO','excepción','PUT estado', e.message,'código') }

  // -- C11 Pago parcial 50% → NO pasa a PAGADO
  try {
    const g0 = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}`)
    const total = Number(g0.data?.presupuestoActual?.total ?? g0.data?.presupuestos?.[0]?.total ?? 236)
    const parcial = Math.round((total / 2) * 100) / 100
    const r = await POST(USERS.CAJERO_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}/pagos`, {
      monto: parcial,
      metodoPago: 'EFECTIVO',
      referencia: 'PARCIAL C11',
      fechaPago: new Date().toISOString(),
    })
    const g = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}`)
    const est = g.data?.estadoActual
    const saldo = Number(g.data?.saldoPendiente ?? -1)
    if (est !== 'PAGADO' && est === 'LISTO_PARA_COBRO' && saldo > 0.005) pass('C11', { parcial, total, estado: est, saldoPendiente: saldo })
    else fail('C11','LISTO_PARA_COBRO + saldo>0.005', `estado=${est} saldo=${saldo}`, 'POST pagos parcial 50%', `pago=${r.status} ${JSON.stringify(r.data)} | GET=${JSON.stringify(g.data)}`, 'T10 trigger PAGADO automático demasiado ansioso o calculo saldo')
  } catch (e) { fail('C11','LISTO + saldo>0','excepción','POST pagos parcial', e.message,'código') }

  // -- C12 Pago total → PAGADO automático
  try {
    const g0 = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}`)
    const saldo = Number(g0.data?.saldoPendiente ?? 118)
    const r = await POST(USERS.CAJERO_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}/pagos`, {
      monto: saldo,
      metodoPago: 'EFECTIVO',
      referencia: 'TOTAL C12',
      fechaPago: new Date().toISOString(),
    })
    const g = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}`)
    const est = g.data?.estadoActual
    const saldoFinal = Number(g.data?.saldoPendiente ?? 999)
    if (est === 'PAGADO' && saldoFinal <= 0.005) pass('C12', { estado: est, saldoFinal })
    else fail('C12','PAGADO + saldo<=0.005', `estado=${est} saldo=${saldoFinal}`, 'POST pagos final', `pago=${r.status} ${JSON.stringify(r.data)} | GET=${JSON.stringify(g.data)}`, 'T10 registrarPagoOrden trigger PAGADO')
  } catch (e) { fail('C12','PAGADO','excepción','POST pagos total', e.message,'código') }

  // -- C13 Entrega PAGADO → ENTREGADO por técnico responsable OK
  try {
    const r = await PUT(USERS.TECNICO_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}/estado`, { nuevoEstado: 'ENTREGADO', motivo: 'Entrega al cliente C13' })
    const g = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}`)
    const est = g.data?.estadoActual
    if (est === 'ENTREGADO') pass('C13', { estado: est })
    else fail('C13','ENTREGADO', `estado=${est}`, 'PUT estado ENTREGADO por técnico responsable', `HTTP ${r.status} ${JSON.stringify(r.data)} | GET=${JSON.stringify(g.data)}`, 'regla ENTREGA T3: técnico responsable debe pasar')
  } catch (e) { fail('C13','ENTREGADO','excepción','PUT estado ENTREGADO', e.message,'código') }

  // -- C14 Salto arbitrario RECEPCIONADO → PAGADO → 409
  try {
    // Creamos OS nueva C14 en RECEPCIONADO y saltamos directamente a PAGADO
    const cr = await POST(USERS.ADMIN_ST, '/api/rt/ordenes-servicio', {
      clienteId: ctx.cliA.id,
      equipoTipo: 'MONITOR', marca: 'LG', modelo: '27MP400', numeroSerie: 'SN-C14-' + Date.now(),
      problemaReportado: 'Parpadeo', recepcionObservaciones: 'C14 salt test',
      estadoActual: 'RECEPCIONADO',
      items: [],
    })
    const id = cr.data?.id
    if (cr.status >= 300 || !id) fail('C14','OS creada en RECEPCIONADO', `HTTP ${cr.status}`, 'POST /api/rt/ordenes-servicio pre C14', JSON.stringify(cr.data), 'setup datos')
    else {
      const r = await PUT(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${id}/estado`, { nuevoEstado: 'PAGADO', motivo: 'Salto arbitrario C14 (DEBE fallar)' })
      if (r.status === 409) pass('C14', { status: r.status })
      else fail('C14','HTTP 409 salto inválido', `HTTP ${r.status} ${JSON.stringify(r.data)}`, 'PUT /estado PAGADO desde RECEPCIONADO', JSON.stringify(r.data), 'validador T2: regla saltos arbitrarios')
    }
  } catch (e) { fail('C14','409','excepción','PUT estado PAGADO', e.message,'código') }

  // -- C15 TECNICO_ST intenta reasignar → 403
  try {
    const tecnico2 = await prisma.tecnico.findFirst({ where: { usuarioId: USERS.TECNICO2_ST.userId } })
    ctx.TEC2_ID = tecnico2?.id
    const r = await PUT(USERS.TECNICO_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}/asignar-tecnico`, { tecnicoId: tecnico2.id, motivo: 'Reasignación C15 (debe fallar)' })
    if (r.status === 403) pass('C15', { status: r.status })
    else fail('C15','HTTP 403 Forbidden TECNICO_ST no puede reasignar', `HTTP ${r.status} ${JSON.stringify(r.data)}`, 'PUT /asignar-tecnico como TECNICO_ST', JSON.stringify(r.data), 'regla T4: solo ADMIN_SERVICIO_TECNICO / SUPERVISOR_ST pueden reasignar')
  } catch (e) { fail('C15','403','excepción','PUT asignar-tecnico', e.message,'código') }

  // -- C16 SUPERVISOR_ST reasigna → 200 + historial asignación ANTERIOR INACTIVA
  try {
    const r = await PUT(USERS.SUPERVISOR_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}/asignar-tecnico`, { tecnicoId: ctx.TEC2_ID, motivo: 'Reasignación SUP ST C16' })
    let g = null, asignAnterior = null, asignNueva = null
    if (r.status < 300) {
      g = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}`)
      asignAnterior = await prisma.ordenTecnicoAsignacion.findFirst({ where: { ordenServicioId: ctx.OS_ID_C3, tecnicoId: ctx.TEC1_ID }, orderBy: { creadoEn: 'desc' } })
      asignNueva    = await prisma.ordenTecnicoAsignacion.findFirst({ where: { ordenServicioId: ctx.OS_ID_C3, tecnicoId: ctx.TEC2_ID }, orderBy: { creadoEn: 'desc' } })
    }
    const ok = r.status < 300 && g?.data?.tecnicoAsignadoId === ctx.TEC2_ID && (!asignAnterior || asignAnterior.activo === false) && asignNueva?.activo === true
    if (ok) pass('C16', { nuevoTecnicoId: ctx.TEC2_ID, anteriorActivo: asignAnterior?.activo, nuevaActivo: asignNueva?.activo })
    else fail('C16','HTTP 200 + nueva activa + anterior inactiva', `HTTP ${r.status} | GET=${JSON.stringify(g?.data)} | anterior.activo=${asignAnterior?.activo} nueva.activo=${asignNueva?.activo}`, 'PUT asignar-tecnico SUP_ST', JSON.stringify(r.data), 'asignarTecnicoOrden T4 / regla autorización SUPERVISOR_ST')
  } catch (e) { fail('C16','200 OK + historial','excepción','PUT asignar-tecnico + DB check', e.message,'código') }

  // -- C17 CAJERO_ST marca ENTREGADO (no es técnico responsable ni admin) → 403
  try {
    // Creamos nueva OS C17, asignamos técnico 2, estado avanzamos a PAGADO, luego CAJERO intenta entregar
    const cr = await POST(USERS.ADMIN_ST, '/api/rt/ordenes-servicio', {
      clienteId: ctx.cliA.id,
      equipoTipo: 'TECLADO', marca: 'Logitech', modelo: 'K120', numeroSerie: 'SN-C17-' + Date.now(),
      problemaReportado: 'Teclas pegadas', recepcionObservaciones: 'C17 entrega cajero forbidden',
      estadoActual: 'RECEPCIONADO',
      tecnicoAsignadoId: ctx.TEC2_ID,
      items: [{ concepto: 'Limpieza', cantidad: 1, precioUnitario: 100, tipoItem: 'SERVICIO' }],
    })
    const id = cr.data?.id
    if (!id) { fail('C17','OS creada', `HTTP ${cr.status}`, 'POST OS pre C17', JSON.stringify(cr.data), 'setup datos'); return }
    // Setear presupuesto + aprobado + EN_REPARACION → TRABAJO_TERMINADO → LISTO_PARA_COBRO + pagos → PAGADO
    for (const [est, motivo] of [['EN_DIAGNOSTICO','setup C17'],['PRESUPUESTADO','setup'],['ESPERANDO_AUTORIZACION','setup']]) {
      await PUT(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${id}/estado`, { nuevoEstado: est, motivo })
    }
    // aprobar
    const gPre = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${id}`)
    const pid = gPre.data?.presupuestos?.[0]?.id
    if (pid) await PUT(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${id}/presupuestos/aprobar`, { presupuestoId: pid, observaciones: 'auto setup c17' })
    for (const est of ['EN_REPARACION','TRABAJO_TERMINADO','LISTO_PARA_COBRO']) {
      await PUT(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${id}/estado`, { nuevoEstado: est, motivo: 'setup c17' })
    }
    // pago total para llegar a PAGADO
    const gPre2 = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${id}`)
    const totalPago = Number(gPre2.data?.saldoPendiente ?? 118)
    if (totalPago > 0.005) {
      await POST(USERS.CAJERO_ST, `/api/rt/ordenes-servicio/${id}/pagos`, { monto: totalPago, metodoPago: 'EFECTIVO', referencia: 'SETUP C17 PAY', fechaPago: new Date().toISOString() })
    }
    const verify = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${id}`)
    if (verify.data?.estadoActual !== 'PAGADO') {
      fail('C17','precondición estado=PAGADO / técnico asignado != CAJERO usuario', `estado=${verify.data?.estadoActual}`, 'setup C17', JSON.stringify(verify.data), 'setup datos fallido')
    } else {
      const r = await PUT(USERS.CAJERO_ST, `/api/rt/ordenes-servicio/${id}/estado`, { nuevoEstado: 'ENTREGADO', motivo: 'Cajero intenta entregar C17 (FORBIDDEN)' })
      if (r.status === 403) pass('C17', { status: r.status })
      else fail('C17','HTTP 403 Forbidden CAJERO_ST no es técnico ni admin', `HTTP ${r.status} ${JSON.stringify(r.data)}`, 'PUT estado ENTREGADO como CAJERO_ST', JSON.stringify(r.data), 'regla ENTREGA T3: validación roles entrega')
    }
  } catch (e) { fail('C17','403','excepción','setup + PUT ENTREGADO CAJERO_ST', e.message,'código') }

  // -- C18 Cross-empresa: OS de A, usuario B consulta → 404
  try {
    const r = await GET(USERS.OTHER_COMPANY_ADMIN, `/api/rt/ordenes-servicio/${ctx.OS_ID_C3}`)
    if (r.status === 404) pass('C18', { status: r.status })
    else fail('C18','HTTP 404 al consultar orden de otra empresa', `HTTP ${r.status} ${JSON.stringify(r.data)}`, 'GET OS C3 desde sesión empresa B', JSON.stringify(r.data), 'scope cross-empresa OrdenServicio')
  } catch (e) { fail('C18','404','excepción','GET OS cross empresa', e.message,'código') }
}

// ============== MAIN ==============
void (async () => {
  console.log('[C1-C18 Bloque5] API_BASE=', API_BASE)
  try {
    const ctx = await ensureRayegoTechCompany()
    await ensureUsersAndLogin(ctx)
    await runCases(ctx)
  } catch (e) { console.error('SETUP ERR:', e); process.exitCode = 1 }
  finally { await prisma.$disconnect() }

  // Imprimir reporte
  console.log('\n\n============================================================')
  console.log('  REPORTE FINAL C1-C18 Bloque5 (Railway DEV via localhost:4000)')
  console.log('============================================================')
  const ids = Array.from({length:18},(_,i)=>`C${i+1}`)
  for (const id of ids) {
    const r = report[id] ?? { result: 'NO_EJECUTADO' }
    console.log(`\n${id}: ${r.result}`)
    if (r.result === 'FAIL') {
      console.log('  esperado       :', r.expected)
      console.log('  obtenido       :', r.got)
      console.log('  endpoint/flujo :', r.where)
      console.log('  error exacto   :', r.error)
      console.log('  clasificación  :', r.classification)
    } else if (r.extra) {
      console.log('  datos evidencia:', JSON.stringify(r.extra))
    }
  }
  console.log('\n---- RESUMEN PASS / FAIL ----')
  let pass=0,fail=0,ne=0
  for (const id of ids) {
    const r = report[id]?.result ?? 'NO_EJECUTADO'
    if (r === 'PASS') pass++
    else if (r === 'FAIL') fail++
    else ne++
  }
  console.log(`PASS=${pass} / FAIL=${fail} / NO_EJECUTADO=${ne}  (18 totales)`)
})()
