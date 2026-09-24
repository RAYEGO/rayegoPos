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

const uid = () => crypto.randomUUID()

const USERS = {
  ADMIN_ST:  { email: 'c1_admin_st_bloque5@rayego.pe', password: devPw, id: uid() },
  SUP_ST:    { email: 'c1_super_st_bloque5@rayego.pe',  password: devPw, id: uid() },
  CAJ_ST:    { email: 'c1_cajero_st_bloque5@rayego.pe', password: devPw, id: uid() },
  TEC1:      { email: 'c1_tec1_st_bloque5@rayego.pe',   password: devPw, id: uid() },
  TEC2:      { email: 'c1_tec2_st_bloque5@rayego.pe',   password: devPw, id: uid() },
  ADMIN_B:   { email: 'c1_empb_bloque5@rayego.pe',      password: devPw, id: uid() },
}

const report = {}
const fail = (id, exp, got, where, err, cls) => { report[id] = { result: 'FAIL', expected: exp, got, where, error: err, classification: cls } }
const pass = (id, extra) => { report[id] = { result: 'PASS', ...(extra ? { extra } : {}) } }

// ====================== SETUP DB VIA PRISMA ======================
async function setupDevData() {
  // TipoEmpresa SERVICIO_TECNICO
  let tipo = await prisma.tipoEmpresa.findFirst({ where: { codigo: 'SERVICIO_TECNICO' } })
  if (!tipo) {
    tipo = await prisma.tipoEmpresa.create({
      data: {
        codigo: 'SERVICIO_TECNICO', nombre: 'Servicio Técnico',
        modulos: {
          create: [
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
        },
      },
    })
  }

  // Empresas A y B
  const upsertEmp = async (rs, nc, ndoc) => {
    let e = await prisma.empresa.findFirst({ where: { razonSocial: rs } })
    if (!e) e = await prisma.empresa.create({ data: { razonSocial: rs, nombreComercial: nc, numeroDocumento: ndoc, tipoDocumento: 'RUC', email: rs.replace(/\s+/g,'.').toLowerCase()+'@rayego.pe', direccion: 'Av Test 123', ubigeo: '150101', tipoEmpresaId: tipo.id } })
    return e
  }
  const empA = await upsertEmp('BLOQUE5 RAYEGOTECH A','RT Bloque5 A','20RTEB5000001')
  const empB = await upsertEmp('BLOQUE5 EMPRESA B','Empresa B Bloque5','20RTEB5000002')

  // Sucursales
  const upsertSuc = async (empId, cod, nom) => {
    let s = await prisma.sucursal.findFirst({ where: { AND: [{ empresaId: empId }, { codigo: cod }] } })
    if (!s) s = await prisma.sucursal.create({ data: { empresaId: empId, codigo: cod, nombre: nom, direccion: 'Dir '+nom, esPrincipal: true } })
    return s
  }
  const sucA = await upsertSuc(empA.id, 'RTE-B5-A', 'Suc RT B5 A')
  const sucB = await upsertSuc(empB.id, 'RTE-B5-B', 'Suc B5 B')

  // Roles ST globales: upsert por codigo
  const ROL_ST = [
    ['ADMIN_SERVICIO_TECNICO','Admin ST Bloque5','ordenesServicio.read ordenesServicio.write tecnicos.read tecnicos.write clientes.read clientes.write caja.read caja.write reportes.read usuarios.read configuracion.read configuracion.manage dashboard.read garantiasOrdenServicio.write'.split(' ')],
    ['SUPERVISOR_ST','Supervisor ST Bloque5','ordenesServicio.read ordenesServicio.write tecnicos.read clientes.read reportes.read dashboard.read garantiasOrdenServicio.write'.split(' ')],
    ['CAJERO_ST','Cajero ST Bloque5','ordenesServicio.read ordenesServicio.write caja.read caja.write clientes.read dashboard.read'.split(' ')],
    ['TECNICO_ST','Técnico ST Bloque5','ordenesServicio.read ordenesServicio.write tecnicos.read clientes.read dashboard.read'.split(' ')],
  ]
  const allPermisos = await prisma.permiso.findMany()
  const permByCod = new Map(allPermisos.map(p => [p.codigo, p.id]))
  for (const [cod, nombre, perms] of ROL_ST) {
    let r = await prisma.rol.findUnique({ where: { codigo: cod }, include: { rolesPermisos: true } })
    if (!r) {
      const data = perms.filter(c => permByCod.has(c)).map(c => ({ permisoId: permByCod.get(c) }))
      r = await prisma.rol.create({ data: { codigo: cod, nombre, descripcion: 'Bloque5', rolesPermisos: { createMany: { data, skipDuplicates: true } } }, include: { rolesPermisos: true } })
    } else {
      const existP = new Set(r.rolesPermisos.map(rp => rp.permisoId))
      const faltan = perms.filter(c => permByCod.has(c)).map(c => permByCod.get(c)).filter(pid => !existP.has(pid))
      if (faltan.length) await prisma.rolPermiso.createMany({ data: faltan.map(pid => ({ rolId: r.id, permisoId: pid })), skipDuplicates: true })
    }
  }
  const roles = await prisma.rol.findMany({ where: { codigo: { in: ROL_ST.map(r=>r[0]) } } })
  const rolByCod = new Map(roles.map(r=>[r.codigo, r.id]))

  // TipoEquipoCliente genérico
  let tGral = await prisma.tipoEquipoCliente.findFirst({ where: { AND:[{ empresaId: empA.id }, { codigo: 'GENERAL' }] } })
  if (!tGral) tGral = await prisma.tipoEquipoCliente.create({ data: { empresaId: empA.id, codigo: 'GENERAL', nombre: 'General', descripcion: 'Cualquier equipo' } })
  let tGralB = await prisma.tipoEquipoCliente.findFirst({ where: { AND:[{ empresaId: empB.id }, { codigo: 'GENERAL' }] } })
  if (!tGralB) tGralB = await prisma.tipoEquipoCliente.create({ data: { empresaId: empB.id, codigo: 'GENERAL', nombre: 'General', descripcion: 'Cualquier equipo' } })

  // Cliente A
  let cliA = await prisma.cliente.findFirst({ where: { AND:[{ empresaId: empA.id },{ numeroDocumento: '75000001' }] } })
  if (!cliA) cliA = await prisma.cliente.create({ data: { empresaId: empA.id, tipoPersona: 'NATURAL', tipoDocumento: 'DNI', numeroDocumento: '75000001', nombres: 'Cliente', apellidos: 'Bloque5 A', nombreCompleto: 'Cliente Bloque5 A', email: 'cli.b5a@rayego.pe', telefono: '910000001', direccion: 'Av 1' } })

  // Clientes / equipos para C17 etc
  let cliB = await prisma.cliente.findFirst({ where: { AND:[{ empresaId: empB.id },{ numeroDocumento: '75000002' }] } })
  if (!cliB) cliB = await prisma.cliente.create({ data: { empresaId: empB.id, tipoPersona: 'NATURAL', tipoDocumento: 'DNI', numeroDocumento: '75000002', nombres: 'Cliente', apellidos: 'Bloque5 B', nombreCompleto: 'Cliente Bloque5 B' } })

  let eqA = await prisma.clienteEquipo.findFirst({ where: { AND:[{ empresaId: empA.id },{ numeroSerie: 'B5-TEST-GENERAL' }] } })
  if (!eqA) eqA = await prisma.clienteEquipo.create({ data: { empresaId: empA.id, clienteId: cliA.id, tipoEquipoId: tGral.id, marca: 'Test', modelo: 'General', numeroSerie: 'B5-TEST-GENERAL' } })

  let eqB = await prisma.clienteEquipo.findFirst({ where: { AND:[{ empresaId: empB.id },{ numeroSerie: 'B5-TEST-EMPB' }] } })
  if (!eqB) eqB = await prisma.clienteEquipo.create({ data: { empresaId: empB.id, clienteId: cliB.id, tipoEquipoId: tGralB.id, marca: 'Test', modelo: 'Empresa B', numeroSerie: 'B5-TEST-EMPB' } })

  // FormaPago: Global enum CodigoFormaPago EFECTIVO
  let fpEfectivo = await prisma.formaPago.findFirst({ where: { codigo: 'EFECTIVO', activo: true } })
  if (!fpEfectivo) fpEfectivo = await prisma.formaPago.create({ data: { codigo: 'EFECTIVO', nombre: 'Efectivo', predeterminado: true, activo: true, requiereReferencia: false, permiteVuelto: true, orden: 1 } })

  // Caja: una por sucursal (unique [sucursalId, codigo])
  for (const [suc, cod, nom, desc] of [
    [sucA, 'CAJA-B5-A', 'Caja Bloque5 Suc A', 'Caja principal B5-A'],
    [sucB, 'CAJA-B5-B', 'Caja Bloque5 Suc B', 'Caja principal B5-B'],
  ]) {
    const existe = await prisma.caja.findFirst({ where: { sucursalId: suc.id, codigo: cod, deletedAt: null } })
    if (!existe) {
      await prisma.caja.create({
        data: {
          sucursalId: suc.id,
          codigo: cod,
          nombre: nom,
          descripcion: desc,
          estado: 'ACTIVA',
        },
      })
    }
  }

  // Usuarios
  const USPEC = [
    [USERS.ADMIN_ST, empA.id, sucA.id, 'ADMIN_SERVICIO_TECNICO', false],
    [USERS.SUP_ST,   empA.id, sucA.id, 'SUPERVISOR_ST', false],
    [USERS.CAJ_ST,   empA.id, sucA.id, 'CAJERO_ST', false],
    [USERS.TEC1,     empA.id, sucA.id, 'TECNICO_ST', true],
    [USERS.TEC2,     empA.id, sucA.id, 'TECNICO_ST', true],
    [USERS.ADMIN_B,  empB.id, sucB.id, 'ADMIN_SERVICIO_TECNICO', false],
  ]
  for (const [u, empId, sucId, rolCod, esTec] of USPEC) {
    let user = await prisma.usuario.findFirst({ where: { email: u.email } })
    const rolId = rolByCod.get(rolCod)
    if (!user) {
      user = await prisma.usuario.create({
        data: {
          id: u.id,
          empresa: { connect: { id: empId } },
          username: u.email.split('@')[0],
          email: u.email, passwordHash: pwHash,
          nombres: rolCod.replaceAll('_',' '), apellidos: 'Bloque5',
          tipoDocumento: 'DNI', numeroDocumento: '7' + u.id.slice(2,9).padStart(7,'0').slice(0,7),
        },
      })
      // UsuarioSucursal
      await prisma.$executeRawUnsafe(`INSERT INTO public.usuario_sucursal (id, usuario_id, sucursal_id, rol_id, activo, created_at, updated_at) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, true, NOW(), NOW()) ON CONFLICT (usuario_id, sucursal_id) DO NOTHING;`, uid(), user.id, sucId, rolId)
      // UsuarioRol
      await prisma.$executeRawUnsafe(`INSERT INTO public.usuario_rol (id, usuario_id, rol_id, activo, created_at, updated_at) VALUES ($1::uuid, $2::uuid, $3::uuid, true, NOW(), NOW()) ON CONFLICT (usuario_id, rol_id) DO NOTHING;`, uid(), user.id, rolId)
    } else {
      u.id = user.id
    }
    u.userId = user.id
    // Técnico row
    if (esTec) {
      let t = await prisma.tecnico.findFirst({ where: { usuarioId: user.id } })
      if (!t) {
        t = await prisma.tecnico.create({ data: { usuarioId: user.id, legajo: 'T-'+rolCod+'-'+user.id.slice(0,4), especialidad: 'General', estado: 'ACTIVO' } })
      }
      u.tecnicoId = t.id
    }
  }

  return { empA, empB, sucA, sucB, cliA, cliB, eqA, eqB, fpEfectivo }
}

// ====================== LOGIN HTTP ======================
async function login(u) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: u.email, password: u.password, remember: false }),
  })
  let d = null
  try { d = await res.json() } catch { d = {} }
  if (res.status !== 200) throw new Error(`Login ${u.email} HTTP ${res.status}: ${JSON.stringify(d)}`)
  if (d.requiresBranchSelection) {
    const b = (d.branches || [])[0]
    const r2 = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u.email, password: u.password, remember: false, branchId: b.id }),
    })
    const d2 = await r2.json().catch(() => ({}))
    if (r2.status !== 200) throw new Error(`Login2 ${u.email} HTTP ${r2.status}: ${JSON.stringify(d2)}`)
    u.token = d2.accessToken; u.branchId = d2.user?.branchId
  } else {
    u.token = d.accessToken; u.branchId = d.user?.branchId
  }
}

// ====================== HTTP REQ ======================
async function req(u, method, p, body) {
  const res = await fetch(`${API_BASE}${p}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(u?.token ? { Authorization: `Bearer ${u.token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const t = await res.text()
  let json
  try { json = JSON.parse(t) } catch { json = { _raw: t } }
  return { status: res.status, data: json }
}
const POST = (u, p, b) => req(u, 'POST', p, b)
const PUT  = (u, p, b) => req(u, 'PUT', p, b)
const GET  = (u, p)    => req(u, 'GET', p)

// ====================== DRIVER C1-C18 ======================
async function driver(ctx) {
  // ====== C1 ADMIN_ST crea OS → RECEPCIONADO ======
  {
    const caseId = 'C1'
    try {
      const payload = {
        clienteId: ctx.cliA.id,
        clienteEquipoId: ctx.eqA.id,
        fechaPrometida: new Date(Date.now() + 10*86400000).toISOString().slice(0,10),
        clienteReporto: 'C1: No enciende',
        observaciones: 'Caso C1',
        items: [],
      }
      const r = await POST(USERS.ADMIN_ST, '/api/rt/ordenes-servicio', payload)
      const item = r.data?.item ?? r.data
      ctx.OS1 = item?.id
      if ((r.status === 200 || r.status === 201) && item?.estadoActual === 'RECEPCIONADO') {
        pass(caseId, { id: ctx.OS1, numero: item?.numeroOrden })
      } else {
        fail(caseId, 'HTTP 2xx + estadoActual=RECEPCIONADO',
          `HTTP ${r.status} estado=${item?.estadoActual ?? 'NULL'}`,
          'POST /api/rt/ordenes-servicio (ADMIN_ST)',
          JSON.stringify(r.data).slice(0, 400),
          (r.status >= 500 || !item?.estadoActual) ? 'código endpoint create OS' : 'payload o default estado')
      }
    } catch (e) { fail(caseId, 'OK', 'excepción', 'POST /api/rt/ordenes-servicio', e.message, 'código') }
  }

  // ====== C2 CAJERO_ST crea OS → 200 ======
  {
    const caseId = 'C2'
    try {
      const payload = {
        clienteId: ctx.cliA.id, clienteEquipoId: ctx.eqA.id,
        fechaPrometida: new Date(Date.now()+8*86400000).toISOString().slice(0,10),
        clienteReporto: 'C2: Pantalla rota', items: [],
      }
      const r = await POST(USERS.CAJ_ST, '/api/rt/ordenes-servicio', payload)
      const item = r.data?.item ?? r.data
      ctx.OS2 = item?.id
      if ((r.status === 200 || r.status === 201) && item?.id) pass(caseId, { id: ctx.OS2 })
      else fail(caseId, 'HTTP 2xx + id', `HTTP ${r.status} data=${JSON.stringify(r.data).slice(0,300)}`,
        'POST /api/rt/ordenes-servicio (CAJERO_ST)', JSON.stringify(r.data).slice(0,500),
        r.status === 403 ? 'permisos CAJERO_ST ordenesServicio.write' : 'código endpoint')
    } catch (e) { fail(caseId,'OK','excepción','POST OS CAJ_ST',e.message,'código') }
  }

  // ====== C3 TECNICO_ST crea OS sin técnico → tecnicoAsignadoId = sí mismo ======
  {
    const caseId = 'C3'
    try {
      const payload = {
        clienteId: ctx.cliA.id, clienteEquipoId: ctx.eqA.id,
        fechaPrometida: new Date(Date.now()+7*86400000).toISOString().slice(0,10),
        clienteReporto: 'C3: Batería muerta', items: [],
      }
      const r = await POST(USERS.TEC1, '/api/rt/ordenes-servicio', payload)
      const itemPost = r.data?.item ?? r.data
      ctx.OS3 = itemPost?.id
      if (!ctx.OS3) { fail(caseId,'HTTP 2xx + id',`HTTP ${r.status}`, 'POST OS TEC1', JSON.stringify(r.data).slice(0,500), 'código create OS'); return }
      const g = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS3}`)
      const itemGet = g.data?.item ?? g.data
      const tecnicoAsignado = itemGet?.tecnicoAsignadoId
      const esperado = USERS.TEC1.tecnicoId
      if (tecnicoAsignado === esperado) pass(caseId, { tecnicoAsignado, esperado })
      else fail(caseId, `tecnicoAsignadoId = ${esperado} (self TEC1)`,
        `obtenido=${tecnicoAsignado}`,
        'POST /api/rt/ordenes-servicio TEC1 + GET /:id',
        `POST=${JSON.stringify(r.data).slice(0,300)} | GET=${JSON.stringify(g.data).slice(0,500)}`,
        !tecnicoAsignado ? 'T4 auto-asignación no disparó o usuario no es Técnico en tabla tecnicos' : 'código asignación')
    } catch (e) { fail(caseId,'OK','excepción','POST + GET TEC1',e.message,'código') }
  }

  // ====== C4 Técnico diagnóstico RECEPCIONADO → EN_DIAGNOSTICO ======
  {
    const caseId = 'C4'
    try {
      const p1 = await POST(USERS.TEC1, `/api/rt/ordenes-servicio/${ctx.OS3}/diagnosticos`, {
        diagnostico: 'Batería hinchada, reemplazar. Placa OK',
        recomendaciones: 'Reemplazar batería original 4500mAh. Validar carga lenta.',
        requiereRepuestos: true,
        tecnicoId: USERS.TEC1.tecnicoId,
      })
      const p2 = await PUT(USERS.TEC1, `/api/rt/ordenes-servicio/${ctx.OS3}/estado`, { estado: 'EN_DIAGNOSTICO', observaciones: 'Inicia diagnóstico C4' })
      const rawG = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS3}`)
      const g = { data: rawG.data?.item ?? rawG.data }
      if (g.data?.estadoActual === 'EN_DIAGNOSTICO') pass(caseId, { diagStatus: p1.status, cambioStatus: p2.status, estado: g.data?.estadoActual })
      else fail(caseId, 'estado=EN_DIAGNOSTICO', `estado=${g.data?.estadoActual}`,
        'POST diagnosticos + PUT estado EN_DIAGNOSTICO (TEC1)',
        `diag HTTP ${p1.status}=${JSON.stringify(p1.data).slice(0,200)} | cambio ${p2.status}=${JSON.stringify(p2.data).slice(0,300)} | GET=${JSON.stringify(g.data).slice(0,300)}`,
        p2.status === 409 ? 'validador T2 RECEPCIONADO→EN_DIAGNOSTICO' : 'código')
    } catch (e) { fail(caseId,'OK','excepción','POST diag / PUT estado',e.message,'código') }
  }

  // ====== C5 Técnico crea presupuesto + RECEPCIONADO→…→PRESUPUESTADO manual ======
  {
    const caseId = 'C5'
    try {
      const p = await POST(USERS.TEC1, `/api/rt/ordenes-servicio/${ctx.OS3}/presupuestos`, {
        descripcion: 'C5: Reemplazo batería. Mano de obra + repuesto.',
        montoManoObra: 80,
        montoRepuestos: 120,
        montoServicios: 0,
        subTotal: 200,
        igvPorcentaje: 18,
      })
      // Transición manual diagnóstico y PRESUPUESTADO para que quede PRESUPUESTADO
      const chA = await PUT(USERS.TEC1, `/api/rt/ordenes-servicio/${ctx.OS3}/estado`, { estado: 'EN_DIAGNOSTICO', observaciones: 'C5 diag (si no está)' })
      const chB = await PUT(USERS.TEC1, `/api/rt/ordenes-servicio/${ctx.OS3}/estado`, { estado: 'PRESUPUESTADO', observaciones: 'C5 presupuesto presentado cliente' })
      const rawG = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS3}`)
      const g = { data: rawG.data?.item ?? rawG.data }
      if (g.data?.estadoActual === 'PRESUPUESTADO') pass(caseId, { presupStatus: p.status, chA: chA.status, chB: chB.status, estado: g.data?.estadoActual, presupId: g.data?.presupuestos?.[0]?.id ?? p.data?.presupuesto?.id ?? p.data?.id })
      else fail(caseId, 'PRESUPUESTADO', `estado=${g.data?.estadoActual}`,
        'POST /presupuestos (TEC1) + PUT estado PRESUPUESTADO',
        `presup HTTP ${p.status}=${JSON.stringify(p.data).slice(0,350)} | chA=${chA.status} chB=${chB.status} | GET=${JSON.stringify(g.data).slice(0,350)}`,
        p.status >= 400 ? 'endpoint POST presupuestos payload/validación' : 'estado PRESUPUESTADO no se asentó tras crear presupuesto')
    } catch (e) { fail(caseId,'OK','excepción','POST presupuestos',e.message,'código') }
  }

  // ====== C6 Presupuesto presentado → ESPERANDO_AUTORIZACION ======
  {
    const caseId = 'C6'
    try {
      const p = await PUT(USERS.TEC1, `/api/rt/ordenes-servicio/${ctx.OS3}/estado`, { estado: 'ESPERANDO_AUTORIZACION', observaciones: 'Presentar a cliente C6' })
      const rawG = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS3}`)
      const g = { data: rawG.data?.item ?? rawG.data }
      if (g.data?.estadoActual === 'ESPERANDO_AUTORIZACION') pass(caseId, { estado: g.data?.estadoActual })
      else fail(caseId, 'ESPERANDO_AUTORIZACION', `estado=${g.data?.estadoActual}`,
        'PUT estado ESPERANDO_AUTORIZACION (TEC1)',
        `HTTP ${p.status}=${JSON.stringify(p.data).slice(0,400)} | GET=${JSON.stringify(g.data).slice(0,300)}`,
        p.status === 409 ? 'validador PRESUPUESTADO→ESPERANDO_AUTORIZACION' : 'código')
    } catch (e) { fail(caseId,'OK','excepción','PUT ESPERANDO_AUTORIZACION',e.message,'código') }
  }

  // ====== C7 Sin aprobaciónClienteAt → EN_REPARACION → 409 ======
  {
    const caseId = 'C7'
    try {
      const rawPre = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS3}`)
      const pre = { data: rawPre.data?.item ?? rawPre.data }
      if (pre.data?.aprobadoClienteAt) { fail(caseId,'aprobadoClienteAt=null precondición',`ya aprobado=${pre.data?.aprobadoClienteAt}`,'pre GET OS3',JSON.stringify(pre.data).slice(0,400),'datos preexistentes / aprobación anterior') }
      else {
        const p = await PUT(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS3}/estado`, { estado: 'EN_REPARACION', observaciones: 'C7 DEBE FALLAR sin aprobación' })
        if (p.status === 409) pass(caseId, { status: 409, msg: p.data?.message ?? 'OK' })
        else fail(caseId, 'HTTP 409', `HTTP ${p.status} body=${JSON.stringify(p.data).slice(0,400)}`,
          'PUT estado EN_REPARACION con aprobadoClienteAt=null',
          JSON.stringify(p.data).slice(0,500),
          'validador T2 regla ESPERANDO_AUTORIZACION→EN_REPARACION requiere ctx.aprobadoClienteAt not null')
      }
    } catch (e) { fail(caseId,'409','excepción','PUT EN_REPARACION sin aprobar',e.message,'código') }
  }

  // ====== C8 Aprobar presupuesto + avanzar → EN_REPARACION ======
  {
    const caseId = 'C8'
    try {
      const rawPre = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS3}`)
      const pre = { data: rawPre.data?.item ?? rawPre.data }
      const lastPv = (Array.isArray(pre.data?.presupuestos) && pre.data.presupuestos.length) ? pre.data.presupuestos[0] : null
      const version = lastPv ? Number(lastPv.version) : 1
      if (!lastPv && !version) { fail(caseId,'presupuesto version existente','no hay presupuesto en respuesta GET','GET OS3 previo',JSON.stringify(pre.data).slice(0,500),'presupuestos endpoint no está asociando relación a la orden') }
      else {
        const ap = await PUT(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS3}/presupuestos/aprobar`, { version, accion: 'APROBAR', comentarios: 'Cliente aprueba C8' })
        if (ap.status < 200 || ap.status >= 300) { fail(caseId,'HTTP 2xx aprobar presupuesto',`HTTP ${ap.status}=${JSON.stringify(ap.data).slice(0,400)}`,'PUT /presupuestos/aprobar',JSON.stringify(ap.data).slice(0,500),'endpoint aprobarPresupuesto') }
        else {
          const ch = await PUT(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS3}/estado`, { estado: 'EN_REPARACION', observaciones: 'Cliente autorizó → iniciar reparación C8' })
          const rawG = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS3}`)
          const g = { data: rawG.data?.item ?? rawG.data }
          if (g.data?.estadoActual === 'EN_REPARACION') pass(caseId, { aprobarStatus: ap.status, cambioStatus: ch.status, estado: g.data.estadoActual, aprobadoAt: g.data.aprobadoClienteAt ? 'OK' : null })
          else fail(caseId,'EN_REPARACION tras aprobación', `estado=${g.data?.estadoActual} aprobadoClienteAt=${g.data?.aprobadoClienteAt ?? 'null'}`,
            'PUT aprobarPresupuesto + PUT estado EN_REPARACION',
            `aprobar=${JSON.stringify(ap.data).slice(0,200)} | cambio=${ch.status} ${JSON.stringify(ch.data).slice(0,300)} | GET=${JSON.stringify(g.data).slice(0,300)}`,
            !g.data?.aprobadoClienteAt ? 'aprobarPresupuesto no setea aprobadoClienteAt en OrdenServicio' : 'validador transición después aprobación')
        }
      }
    } catch (e) { fail(caseId,'EN_REPARACION','excepción','PUT aprobar + PUT EN_REPARACION',e.message,'código') }
  }

  // ====== C9 EN_REPARACION → TRABAJO_TERMINADO ======
  {
    const caseId = 'C9'
    try {
      const p = await PUT(USERS.TEC1, `/api/rt/ordenes-servicio/${ctx.OS3}/estado`, { estado: 'TRABAJO_TERMINADO', observaciones: 'Reparación completada C9' })
      const rawG = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS3}`)
      const g = { data: rawG.data?.item ?? rawG.data }
      if (g.data?.estadoActual === 'TRABAJO_TERMINADO') pass(caseId, { estado: g.data.estadoActual })
      else fail(caseId, 'TRABAJO_TERMINADO', `estado=${g.data?.estadoActual}`,
        'PUT estado TRABAJO_TERMINADO (TEC1)',
        `HTTP ${p.status} ${JSON.stringify(p.data).slice(0,400)} | GET=${JSON.stringify(g.data).slice(0,250)}`,
        p.status === 409 ? 'validador EN_REPARACION→TRABAJO_TERMINADO' : 'código')
    } catch (e) { fail(caseId,'OK','excepción','PUT TRABAJO_TERMINADO',e.message,'código') }
  }

  // ====== C10 TRABAJO_TERMINADO → LISTO_PARA_COBRO ======
  {
    const caseId = 'C10'
    try {
      const p = await PUT(USERS.TEC1, `/api/rt/ordenes-servicio/${ctx.OS3}/estado`, { estado: 'LISTO_PARA_COBRO', observaciones: 'Listo para cobro C10' })
      const rawG = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS3}`)
      const g = { data: rawG.data?.item ?? rawG.data }
      if (g.data?.estadoActual === 'LISTO_PARA_COBRO') pass(caseId, { estado: g.data.estadoActual })
      else fail(caseId, 'LISTO_PARA_COBRO', `estado=${g.data?.estadoActual}`,
        'PUT estado LISTO_PARA_COBRO',
        `HTTP ${p.status} ${JSON.stringify(p.data).slice(0,400)} | GET=${JSON.stringify(g.data).slice(0,250)}`,
        p.status === 409 ? 'validador TRABAJO_TERMINADO→LISTO_PARA_COBRO' : 'código')
    } catch (e) { fail(caseId,'OK','excepción','PUT LISTO_PARA_COBRO',e.message,'código') }
  }

  // ====== Apertura de caja (necesaria para pagos) ======
  const aperturaResult = { ok: false, openingId: null, status: null, err: null }
  try {
    // GET /api/cashier/active y si no hay abierto → POST /api/cashier/open
    const activeResp = await GET(USERS.CAJ_ST, '/api/cashier/active')
    const activeData = activeResp.data?.item ?? activeResp.data
    const opening = activeResp.data?.opening ?? activeData?.opening ?? activeData
    if (activeResp.status >= 200 && activeResp.status < 300 && opening?.id) {
      aperturaResult.ok = true; aperturaResult.openingId = opening.id; aperturaResult.status = activeResp.status
    } else {
      const openResp = await POST(USERS.CAJ_ST, '/api/cashier/open', { openingAmount: 500, observations: 'Apertura BLOQUE5 CAJ_ST' })
      const openData = openResp.data?.item ?? openResp.data
      const opening2 = openResp.data?.opening ?? openData?.opening ?? openData
      if (openResp.status >= 200 && openResp.status < 300) {
        aperturaResult.ok = true; aperturaResult.openingId = openResp.data?.id ?? opening2?.id; aperturaResult.status = openResp.status
      } else if (openResp.status === 400 && /caja abierta|abierta/i.test(JSON.stringify(openResp.data))) {
        const active2 = await GET(USERS.CAJ_ST, '/api/cashier/active')
        const a2 = active2.data?.item ?? active2.data
        const op2 = active2.data?.opening ?? a2?.opening ?? a2
        if (active2.status >= 200 && active2.status < 300 && op2?.id) {
          aperturaResult.ok = true; aperturaResult.openingId = op2.id; aperturaResult.status = active2.status
        } else {
          aperturaResult.status = openResp.status; aperturaResult.err = JSON.stringify(openResp.data).slice(0,400)
        }
      } else {
        aperturaResult.status = openResp.status; aperturaResult.err = JSON.stringify(openResp.data).slice(0,400)
      }
    }
  } catch (e) { aperturaResult.err = e.message }

  // ====== C11 Pago parcial 50% → NO PAGADO (permanece LISTO_PARA_COBRO) ======
  {
    const caseId = 'C11'
    try {
      if (!aperturaResult.ok) { fail(caseId, 'caja abierta (setup previo pago)', `status=${aperturaResult.status} err=${aperturaResult.err}`, 'GET /cajero/active + POST /cajero/open', aperturaResult.err, 'setup: apertura caja necesaria para pagos (409: "No hay una caja abierta en la sucursal")') }
      else {
        const rawG0 = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS3}`)
        const g0 = { data: rawG0.data?.item ?? rawG0.data }
        const total = Number(g0.data?.totalOrden ?? 236)
        const monto50 = Math.round((total/2)*100)/100
        const p = await POST(USERS.CAJ_ST, `/api/rt/ordenes-servicio/${ctx.OS3}/pagos`, {
          formaPagoId: ctx.fpEfectivo.id,
          monto: monto50,
          observaciones: 'C11 PARCIAL 50%',
        })
        const rawG = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS3}`)
        const g = { data: rawG.data?.item ?? rawG.data }
        const est = g.data?.estadoActual
        const saldo = Number(g.data?.saldoPendiente ?? -1)
        if (est === 'LISTO_PARA_COBRO' && saldo > 0.005) pass(caseId, { total, pagoParcial: monto50, saldo, estado: est })
        else fail(caseId, 'LISTO_PARA_COBRO y saldo>0.005', `estado=${est} saldo=${saldo}`,
          'POST /pagos (CAJ_ST) pago parcial',
          `pago ${p.status} ${JSON.stringify(p.data).slice(0,400)} | GET=${JSON.stringify(g.data).slice(0,350)}`,
          est === 'PAGADO' ? 'T10 trigger PAGADO se dispara con saldo>0' : 'cálculo saldo pendiente')
      }
    } catch (e) { fail(caseId,'OK','excepción','POST pago parcial',e.message,'código') }
  }

  // ====== C12 Pago total → PAGADO automático ======
  {
    const caseId = 'C12'
    try {
      if (!aperturaResult.ok) { fail(caseId, 'caja abierta (setup previo pago)', `status=${aperturaResult.status} err=${aperturaResult.err}`, 'GET /cajero/active + POST /cajero/open', aperturaResult.err, 'setup: apertura caja necesaria para pagos') }
      else {
        const rawG0 = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS3}`)
        const g0 = { data: rawG0.data?.item ?? rawG0.data }
        const saldo = Number(g0.data?.saldoPendiente ?? 118)
        const p = await POST(USERS.CAJ_ST, `/api/rt/ordenes-servicio/${ctx.OS3}/pagos`, {
          formaPagoId: ctx.fpEfectivo.id,
          monto: saldo,
          observaciones: 'C12 PAGO TOTAL',
        })
        const rawG = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS3}`)
        const g = { data: rawG.data?.item ?? rawG.data }
        const est = g.data?.estadoActual
        const saldoF = Number(g.data?.saldoPendiente ?? -1)
        if (est === 'PAGADO' && saldoF <= 0.005) pass(caseId, { estado: est, saldoFinal: saldoF })
        else fail(caseId, 'PAGADO + saldo<=0.005', `estado=${est} saldoFinal=${saldoF}`,
          'POST /pagos total (CAJ_ST)',
          `pago ${p.status} ${JSON.stringify(p.data).slice(0,400)} | GET=${JSON.stringify(g.data).slice(0,400)}`,
          est !== 'PAGADO' ? 'T10 registrarPagoOrden no dispara cambio PAGADO cuando saldo<=0.005' : 'saldo no cero')
      }
    } catch (e) { fail(caseId,'PAGADO','excepción','POST pago total',e.message,'código') }
  }

  // ====== C13 Entrega: PAGADO → ENTREGADO por técnico responsable OK ======
  {
    const caseId = 'C13'
    try {
      const p = await PUT(USERS.TEC1, `/api/rt/ordenes-servicio/${ctx.OS3}/estado`, { estado: 'ENTREGADO', observaciones: 'Entregado al cliente C13', terminosGarantia: 'Garantía 30 días reparación batería' })
      const rawG = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS3}`)
      const g = { data: rawG.data?.item ?? rawG.data }
      if (g.data?.estadoActual === 'ENTREGADO') pass(caseId, { estado: g.data.estadoActual })
      else fail(caseId, 'ENTREGADO por TEC1 responsable', `estado=${g.data?.estadoActual}`,
        'PUT estado ENTREGADO (TEC1 = técnico asignado responsable)',
        `HTTP ${p.status} ${JSON.stringify(p.data).slice(0,450)} | GET=${JSON.stringify(g.data).slice(0,250)}`,
        p.status === 403 ? 'T3 regla ENTREGA debe permitir técnico responsable' : p.status === 409 ? 'validador PAGADO→ENTREGADO' : 'código')
    } catch (e) { fail(caseId,'OK','excepción','PUT ENTREGADO TEC1',e.message,'código') }
  }

  // ====== C14 Salto arbitrario RECEPCIONADO → PAGADO → 409 ======
  {
    const caseId = 'C14'
    try {
      const cr = await POST(USERS.ADMIN_ST, '/api/rt/ordenes-servicio', {
        clienteId: ctx.cliA.id, clienteEquipoId: ctx.eqA.id,
        fechaPrometida: new Date(Date.now()+5*86400000).toISOString().slice(0,10),
        clienteReporto: 'C14 salto test',
        observaciones: 'Caso C14 setup salto arbitrario',
        items: [],
      })
      const crItem = cr.data?.item ?? cr.data
      const id = crItem?.id
      if (cr.status >= 300 || !id) { fail(caseId,'OS creada RECEPCIONADO',`HTTP ${cr.status} ${JSON.stringify(cr.data).slice(0,400)}`,'POST OS pre C14',JSON.stringify(cr.data).slice(0,500),'setup endpoint create OS') }
      else {
        const p = await PUT(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${id}/estado`, { estado: 'PAGADO', observaciones: 'C14 SALTO ARBITRARIO (DEBE FALLAR)' })
        if (p.status === 409) pass(caseId, { status: 409, msg: p.data?.message ?? 'OK' })
        else fail(caseId,'HTTP 409',`HTTP ${p.status} body=${JSON.stringify(p.data).slice(0,500)}`,
          'PUT estado PAGADO desde RECEPCIONADO', JSON.stringify(p.data).slice(0,600),
          'validador T2: no está bloqueando saltos arbitrarios fuera del grafo')
      }
    } catch (e) { fail(caseId,'409','excepción','PUT PAGADO salto arbitrario',e.message,'código') }
  }

  // ====== C15 TECNICO_ST intenta reasignar → 403 ======
  {
    const caseId = 'C15'
    try {
      const p = await PUT(USERS.TEC1, `/api/rt/ordenes-servicio/${ctx.OS3}/asignar-tecnico`, { tecnicoId: USERS.TEC2.tecnicoId, observaciones: 'C15 TEC intenta reasignar → DEBE fallar 403' })
      if (p.status === 403) pass(caseId, { status: 403, msg: p.data?.message ?? 'OK' })
      else fail(caseId, 'HTTP 403 Forbidden', `HTTP ${p.status} body=${JSON.stringify(p.data).slice(0,450)}`,
        'PUT /asignar-tecnico (TEC1_ST, no admin/super)',
        JSON.stringify(p.data).slice(0,500),
        'T4 asignarTecnicoOrden: chequeo autorización TECNICO_ST debe bloquear')
    } catch (e) { fail(caseId,'403','excepción','PUT reasignar tecnico TEC1',e.message,'código') }
  }

  // ====== C16 SUPERVISOR_ST reasigna → 200 OK + historial ANTERIOR INACTIVO ======
  {
    const caseId = 'C16'
    try {
      const p = await PUT(USERS.SUP_ST, `/api/rt/ordenes-servicio/${ctx.OS3}/asignar-tecnico`, { tecnicoId: USERS.TEC2.tecnicoId, observaciones: 'C16 Supervisor reasigna a TEC2' })
      let asignAnt = null, asigNueva = null, tecAsig = null
      if (p.status < 300) {
        const rawG = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${ctx.OS3}`)
        const g = { data: rawG.data?.item ?? rawG.data }
        tecAsig = g.data?.tecnicoAsignadoId
        asignAnt = await prisma.ordenAsignacionTecnico.findFirst({ where: { ordenId: ctx.OS3, tecnicoId: USERS.TEC1.tecnicoId }, orderBy: { fechaAsignacion: 'desc' } })
        asigNueva = await prisma.ordenAsignacionTecnico.findFirst({ where: { ordenId: ctx.OS3, tecnicoId: USERS.TEC2.tecnicoId }, orderBy: { fechaAsignacion: 'desc' } })
      }
      const ok = p.status < 300 && tecAsig === USERS.TEC2.tecnicoId && (!asignAnt || asignAnt.activo === false) && asigNueva?.activo === true
      if (ok) pass(caseId, { status: p.status, nuevoTecnicoId: USERS.TEC2.tecnicoId, anteriorActivo: asignAnt?.activo ?? null, nuevaActivo: asigNueva?.activo })
      else fail(caseId, 'HTTP 2xx + nuevo técnico + asign. anterior INACTIVA + asign. nueva ACTIVA',
        `HTTP=${p.status} | tecAsig=${tecAsig} esperado=${USERS.TEC2.tecnicoId} | anterior.activo=${asignAnt?.activo} nueva.activo=${asigNueva?.activo}`,
        'PUT /asignar-tecnico SUP_ST',
        `body=${JSON.stringify(p.data).slice(0,500)}`,
        p.status === 403 ? 'permiso SUPERVISOR_ST reasignar NO permitido' : 'T4 asignarTecnicoOrden lógica marca activo/anterior inactiva')
    } catch (e) { fail(caseId,'OK','excepción','PUT reasignar SUP + DB check',e.message,'código') }
  }

  // ====== C17 CAJERO_ST marca ENTREGADO → 403 (no técnico ni admin) ======
  {
    const caseId = 'C17'
    try {
      // Setup OS nueva con TEC2 asignado, estado final PAGADO, técnico asignado != CAJ_ST usuario y != admin
      const cr = await POST(USERS.ADMIN_ST, '/api/rt/ordenes-servicio', {
        clienteId: ctx.cliA.id, clienteEquipoId: ctx.eqA.id,
        fechaPrometida: new Date(Date.now()+3*86400000).toISOString().slice(0,10),
        clienteReporto: 'C17: fallo de altavoz',
        observaciones: 'Caso C17 setup CAJ entrega no autorizada',
        tecnicoAsignadoId: USERS.TEC2.tecnicoId, items: [],
      })
      const crItem = cr.data?.item ?? cr.data
      const id = crItem?.id
      if (!id) { fail(caseId,'OS nueva creada',`HTTP ${cr.status}`, 'POST OS C17', JSON.stringify(cr.data).slice(0,500), 'setup create OS'); return }

      // Presupuesto rápido
      const presup = await POST(USERS.TEC2, `/api/rt/ordenes-servicio/${id}/presupuestos`, {
        descripcion: 'C17 setup: Reparación altavoz + 18% IGV.',
        montoManoObra: 100,
        montoRepuestos: 0,
        montoServicios: 0,
        subTotal: 100,
        igvPorcentaje: 18,
      })

      // GET
      const rawG0 = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${id}`)
      const g0 = { data: rawG0.data?.item ?? rawG0.data }
      const est0 = g0.data?.estadoActual
      if (est0 !== 'PRESUPUESTADO') {
        const chs = ['EN_DIAGNOSTICO','PRESUPUESTADO']
        for (const e of chs) await PUT(USERS.TEC2, `/api/rt/ordenes-servicio/${id}/estado`, { estado: e, observaciones: 'Setup C17' })
      }
      await PUT(USERS.TEC2, `/api/rt/ordenes-servicio/${id}/estado`, { estado: 'ESPERANDO_AUTORIZACION', observaciones: 'Setup C17' })
      // aprobar
      const rawGPre = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${id}`)
      const gPre = { data: rawGPre.data?.item ?? rawGPre.data }
      const lastPv = Array.isArray(gPre.data?.presupuestos) && gPre.data.presupuestos.length ? gPre.data.presupuestos[0] : null
      const version = lastPv ? Number(lastPv.version) : 1
      if (version) await PUT(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${id}/presupuestos/aprobar`, { version, accion: 'APROBAR', comentarios: 'Cliente aprueba setup C17' })
      // avanzar EN_REPARACION → TRABAJO_TERMINADO → LISTO_PARA_COBRO
      for (const e of ['EN_REPARACION','TRABAJO_TERMINADO','LISTO_PARA_COBRO']) {
        await PUT(USERS.TEC2, `/api/rt/ordenes-servicio/${id}/estado`, { estado: e, observaciones: 'Setup C17' })
      }
      // Pago total (usa misma apertura si existe)
      if (aperturaResult.ok) {
        const rawGSaldo = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${id}`)
        const gSaldo = { data: rawGSaldo.data?.item ?? rawGSaldo.data }
        const total = Number(gSaldo.data?.totalOrden ?? 118)
        await POST(USERS.CAJ_ST, `/api/rt/ordenes-servicio/${id}/pagos`, {
          formaPagoId: ctx.fpEfectivo.id,
          monto: total,
          observaciones: 'SETUP C17 PAGO TOTAL',
        })
      }
      const rawGFinal = await GET(USERS.ADMIN_ST, `/api/rt/ordenes-servicio/${id}`)
      const gFinal = { data: rawGFinal.data?.item ?? rawGFinal.data }
      if (gFinal.data?.estadoActual !== 'PAGADO') {
        fail(caseId,'Precondición PAGADO y técnico asignado=TEC2',`estado=${gFinal.data?.estadoActual} tecAsign=${gFinal.data?.tecnicoAsignadoId} esperado=${USERS.TEC2.tecnicoId}`, 'setup OS C17', JSON.stringify(gFinal.data).slice(0,500), aperturaResult.ok ? 'setup datos fallido: flujo estado/pago' : `setup caja falló apertura=${aperturaResult.status} ${aperturaResult.err}`)
      } else {
        const p = await PUT(USERS.CAJ_ST, `/api/rt/ordenes-servicio/${id}/estado`, { estado: 'ENTREGADO', observaciones: 'CAJ intenta ENTREGAR (DEBE 403)' })
        if (p.status === 403) pass(caseId, { status: 403, msg: p.data?.message ?? 'OK' })
        else fail(caseId, 'HTTP 403 Forbidden CAJ_ST entrega', `HTTP ${p.status} body=${JSON.stringify(p.data).slice(0,500)}`,
          'PUT estado ENTREGADO (usuario CAJ_ST, no es técnico ni ADMIN_SERVICIO_TECNICO)',
          JSON.stringify(p.data).slice(0,600),
          'T3 regla ENTREGA: CAJERO_ST no autorizado para entregar (403)')
      }
    } catch (e) { fail(caseId,'403','excepción','setup OS + PUT ENTREGADO CAJ_ST',e.message,'código') }
  }

  // ====== NO EJECUTAR C18 (autorización hasta C17) ======
  return

  // ====== C18 Cross-empresa: OS de A, usuario B consulta → 404 ======
  {
    const caseId = 'C18'
    try {
      const p = await GET(USERS.ADMIN_B, `/api/rt/ordenes-servicio/${ctx.OS3}`)
      if (p.status === 404) pass(caseId, { status: 404 })
      else fail(caseId, 'HTTP 404 (cross empresa)', `HTTP ${p.status} body=${JSON.stringify(p.data).slice(0,500)}`,
        'GET /api/rt/ordenes-servicio/:id (usuario EMPRESA B, orden EMPRESA A)',
        JSON.stringify(p.data).slice(0,600),
        p.status === 200 ? 'scope empresa OrdenServicio (getOne) no filtra por empresaId' : 'código scope')
    } catch (e) { fail(caseId,'404','excepción','GET OS cross',e.message,'código') }
  }
}

// ====================== MAIN ======================
void (async () => {
  console.log('[C1-C18 Bloque5] API_BASE=', API_BASE)
  let ctx
  try {
    ctx = await setupDevData()
    for (const u of Object.values(USERS)) await login(u)
    await driver(ctx)
  } catch (e) { console.error('\nDRIVER/SETUP ERR:', e); process.exitCode = 1 }
  finally { await prisma.$disconnect() }

  console.log('\n\n============================================================')
  console.log('  REPORTE FINAL C1-C18 Bloque5 (Railway DEV via local API)')
  console.log('============================================================\n')
  const ids = Array.from({length:18},(_,i)=>`C${i+1}`)
  for (const id of ids) {
    const r = report[id] ?? { result: 'NO_EJECUTADO' }
    console.log(`${id}: ${r.result}`)
    if (r.result === 'FAIL') {
      console.log('  esperado       :', r.expected)
      console.log('  obtenido       :', r.got)
      console.log('  endpoint/flujo :', r.where)
      console.log('  error exacto   :', r.error)
      console.log('  clasificación  :', r.classification)
    } else if (r.extra) {
      console.log('  evidencia      :', JSON.stringify(r.extra))
    }
  }
  let P=0,F=0,N=0
  for (const id of ids) {
    const s = report[id]?.result ?? 'NO_EJECUTADO'
    if (s==='PASS') P++; else if (s==='FAIL') F++; else N++
  }
  console.log(`\n---- RESUMEN ---- PASS=${P} FAIL=${F} NO_EJECUTADO=${N} (18 totales)`)
})()
