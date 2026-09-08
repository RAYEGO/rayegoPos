/**
 * ==============================================================
 *  SEED SOLO ENTORNO DEVELOPMENT — 2 usuarios DEV:
 *    (a) ADMIN      de EMPRESA  → admin@rayego.pe
 *    (b) ADMIN_POS  PLATAFORMA  → admin.pos@rayego.pe
 * ==============================================================
 *  Reglas INQUEBRANTABLES (NUNCA modificar estas líneas):
 *   1. Este script SOLO corre en entorno development.
 *   2. NUNCA usa DATABASE_URL de producción (sakura.proxy.rlwy.net).
 *   3. Requiere variable DEV_ADMIN_PASSWORD — NO default hardcodeada.
 *   4. Nunca loguea password_hash, password ni secrets.
 *   5. Si los usuarios ya existen → UPDATE idempotente, NUNCA duplicar.
 *   6. Todo el upsert interno usa SQL DIRECTO ($queryRawUnsafe) con
 *      la técnica SELECT id → UPDATE/INSERT (sin ON CONFLICT → no
 *      dependemos de constraints unique en Postgres).
 * ==============================================================
 */
const process = require('node:process')
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

// ============================================================
// PASO 0: VALIDACIONES DE SEGURIDAD ANTES DE TOCAR NADA
// ============================================================
const FAIL = (msg) => { console.error('\n❌ [SEED DEV ABORTADO] ' + msg); process.exit(1) }

const envMode = (
  process.env.RAYEGO_ENV_MODE ||
  process.env.APP_ENV ||
  process.env.NODE_ENV ||
  ''
).toLowerCase()

if (envMode !== 'development' && envMode !== 'dev') {
  FAIL(
    `Entorno detectado='${envMode || '(vacio)'}. ` +
      'Este script SOLO se puede ejecutar en entorno development. ' +
      'Setea RAYEGO_ENV_MODE=development.',
  )
}
console.log('✅ Validación #1: Entorno → development')

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim()
if (!DATABASE_URL) FAIL('Falta DATABASE_URL (provista desde .env.development vía run-seed-dev-direct)')

if (/sakura\.proxy\.rlwy\.net/i.test(DATABASE_URL)) {
  FAIL('DATABASE_URL apunta a Postgres PRODUCCION (sakura.proxy.rlwy.net). ABORTADO.')
}
const dbHostMatch = DATABASE_URL.match(/@([^/?]+)/)
const dbHost = dbHostMatch ? dbHostMatch[1] : '(desconocido)'
console.log('✅ Validación #2: BD host DEV →', dbHost, '(no producción)')

const rawPw = String(process.env.DEV_ADMIN_PASSWORD || '').trim()
if (!rawPw) FAIL('Falta variable DEV_ADMIN_PASSWORD. Definila antes de ejecutar (NUNCA hardcodearla).')
console.log('✅ Validación #3: DEV_ADMIN_PASSWORD provista (long=', rawPw.length, '). No se mostrará.')

// ============================================================
// PASO 1: Datos mínimos (hardcodeados intencionalmente para DEV)
// ============================================================
const TIPO_EMPRESA = { codigo: 'BOTICA', nombre: 'Botica' }
const MODULOS_REQUERIDOS = [
  { codigo: 'dashboard', nombre: 'Dashboard', categoria: 'Operaciones' },
  { codigo: 'configuracion', nombre: 'Configuración', categoria: 'Sistema' },
  { codigo: 'empresas', nombre: 'Empresas', categoria: 'Plataforma' },
  { codigo: 'usuarios', nombre: 'Usuarios', categoria: 'Sistema' },
]
const EMPRESA = {
  razon_social: 'BOTICA DEV SAC',
  nombre_comercial: 'Botica DEV',
  numero_documento: '20DEV0000000',
  tipo_documento: 'RUC',
  email: 'dev@rayego.pe',
  direccion: 'Av. DEV 123, Lima',
  ubigeo: '150101',
}
const SUCURSAL = { codigo: 'DEV01', nombre: 'Sucursal DEV Principal', es_principal: true, direccion: 'Av. DEV 123, Lima' }
const ROL_ADMIN_EMPRESA = { codigo: 'ADMIN', nombre: 'Administrador', descripcion: 'Acceso total DEV (empresa/sucursal).' }
const ROL_ADMIN_POS     = { codigo: 'ADMIN_POS', nombre: 'Administrador POS (Plataforma)', descripcion: 'Acceso cross-empresa DEV.' }

const PERMISOS_ADMIN_EMPRESA = [
  { codigo: 'dashboard.read', modulo: 'dashboard', nombre: 'Ver Dashboard' },
  { codigo: 'configuracion.read', modulo: 'configuracion', nombre: 'Ver Configuración' },
  { codigo: 'configuracion.manage', modulo: 'configuracion', nombre: 'Editar Configuración' },
]
const PERMISOS_ADMIN_POS = [
  { codigo: 'dashboard.read', modulo: 'dashboard', nombre: 'Ver Dashboard' },
  { codigo: 'tipos_empresa.manage', modulo: 'empresas', nombre: 'Gestionar Tipos de Empresa' },
  { codigo: 'empresas.read', modulo: 'empresas', nombre: 'Ver Empresas' },
  { codigo: 'empresas.manage', modulo: 'empresas', nombre: 'Gestionar Empresas' },
  { codigo: 'administradores.manage', modulo: 'usuarios', nombre: 'Gestionar Administradores' },
  { codigo: 'usuarios.read', modulo: 'usuarios', nombre: 'Ver Usuarios' },
  { codigo: 'usuarios.manage', modulo: 'usuarios', nombre: 'Gestionar Usuarios' },
  { codigo: 'sesiones.read', modulo: 'usuarios', nombre: 'Ver Sesiones' },
  { codigo: 'sesiones.revoke', modulo: 'usuarios', nombre: 'Revocar Sesiones' },
  { codigo: 'auditoria.read', modulo: 'reportes', nombre: 'Ver Auditoría' },
  { codigo: 'reportes.read', modulo: 'reportes', nombre: 'Ver Reportes' },
  { codigo: 'configuracion.read', modulo: 'configuracion', nombre: 'Ver Configuración' },
]
const USUARIO_ADMIN_EMPRESA = {
  username: 'admin',
  email: 'admin@rayego.pe',
  nombres: 'Administrador',
  apellidos: 'DEV',
  tipo_documento: 'DNI',
  numero_documento: '00000000',
}
const USUARIO_ADMIN_POS = {
  username: 'admin.pos',
  email: 'admin.pos@rayego.pe',
  nombres: 'Administrador',
  apellidos: 'POS DEV',
  tipo_documento: 'DNI',
  numero_documento: '00000001',
}

const BCRYPT_COST = 10

function genUuid() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID()
  const rnd = (n) => [...Array(n)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')
  return `${rnd(8)}-${rnd(4)}-4${rnd(3)}-${['8','9','a','b'][Math.floor(Math.random()*4)]}${rnd(3)}-${rnd(12)}`
}

;(async () => {
  const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } })
  try {
    const passwordHash = await bcrypt.hash(rawPw, BCRYPT_COST)
    console.log(`✅ Password hasheado bcryptjs cost=${BCRYPT_COST} (longitud=${passwordHash.length}).`)

    // Fast check idempotente: si AMBOS existen y el password coincide → SKIP sin tocar BD
    const pre = await prisma.$queryRawUnsafe(`
      SELECT id, username, email, password_hash
      FROM public.usuarios
      WHERE deleted_at IS NULL
        AND (LOWER(COALESCE(username,'')) IN ('admin','admin.pos') OR LOWER(COALESCE(email,'')) IN ('admin@rayego.pe','admin.pos@rayego.pe'))
      ORDER BY username;
    `)
    if (pre && pre.length === 2) {
      const ok1 = await bcrypt.compare(rawPw, pre[0].password_hash)
      const ok2 = await bcrypt.compare(rawPw, pre[1].password_hash)
      if (ok1 && ok2) {
        console.log('\nℹ️  Ambos usuarios ya existen + password coincide. Seed idempotente → no se tocó nada.')
        console.log('   · ', pre[0].username, '/', pre[0].email)
        console.log('   · ', pre[1].username, '/', pre[1].email)
        process.exit(0)
      }
    }

    // ============================================================
    // TRANSACCIÓN — TÉCNICA SELECT + UPDATE/INSERT (sin ON CONFLICT)
    // ============================================================
    await prisma.$transaction(async (tx) => {
      // --- 4a TipoEmpresa BOTICA ---
      let tipoEmp
      {
        const row = await tx.$queryRawUnsafe("SELECT id FROM public.tipos_empresa WHERE codigo=$1;", TIPO_EMPRESA.codigo)
        if (row && row[0]) {
          tipoEmp = row[0].id
          await tx.$executeRawUnsafe(
            "UPDATE public.tipos_empresa SET nombre=$1, deleted_at=NULL, updated_at=NOW() WHERE id=$2::uuid;",
            TIPO_EMPRESA.nombre, tipoEmp
          )
        } else {
          tipoEmp = genUuid()
          await tx.$executeRawUnsafe(
            "INSERT INTO public.tipos_empresa (id, codigo, nombre, created_at, updated_at) VALUES ($1::uuid, $2, $3, NOW(), NOW());",
            tipoEmp, TIPO_EMPRESA.codigo, TIPO_EMPRESA.nombre
          )
        }
      }

      // --- 4b Modulos + TipoEmpresaModulo ---
      for (const m of MODULOS_REQUERIDOS) {
        let moduloId
        {
          const row = await tx.$queryRawUnsafe("SELECT id FROM public.modulos WHERE codigo=$1;", m.codigo)
          if (row && row[0]) {
            moduloId = row[0].id
            await tx.$executeRawUnsafe(
              "UPDATE public.modulos SET nombre=$1, categoria=$2, activo=true, deleted_at=NULL, updated_at=NOW() WHERE id=$3::uuid;",
              m.nombre, m.categoria, moduloId
            )
          } else {
            moduloId = genUuid()
            await tx.$executeRawUnsafe(
              "INSERT INTO public.modulos (id, codigo, nombre, categoria, activo, created_at, updated_at) VALUES ($1::uuid, $2, $3, $4, true, NOW(), NOW());",
              moduloId, m.codigo, m.nombre, m.categoria
            )
          }
        }
        // TipoEmpresaModulo: buscar por (tipo_empresa_id, modulo_codigo)
        {
          const row = await tx.$queryRawUnsafe(
            "SELECT id FROM public.tipo_empresa_modulo WHERE tipo_empresa_id=$1::uuid AND modulo_codigo=$2;",
            tipoEmp, m.codigo
          )
          if (row && row[0]) {
            await tx.$executeRawUnsafe("UPDATE public.tipo_empresa_modulo SET activo=true, updated_at=NOW() WHERE id=$1::uuid;", row[0].id)
          } else {
            await tx.$executeRawUnsafe(
              "INSERT INTO public.tipo_empresa_modulo (id, tipo_empresa_id, modulo_codigo, activo, created_at, updated_at) VALUES ($1::uuid, $2::uuid, $3, true, NOW(), NOW());",
              genUuid(), tipoEmp, m.codigo
            )
          }
        }
      }

      // --- 4c Empresa ---
      let empresaId
      {
        const row = await tx.$queryRawUnsafe("SELECT id FROM public.empresas WHERE numero_documento=$1;", EMPRESA.numero_documento)
        if (row && row[0]) {
          empresaId = row[0].id
          await tx.$executeRawUnsafe(
            `UPDATE public.empresas SET
              tipo_empresa_id=$1::uuid, razon_social=$2, nombre_comercial=$3,
              tipo_documento=$4, email=$5, direccion=$6, ubigeo=$7,
              activo=true, deleted_at=NULL, updated_at=NOW()
             WHERE id=$8::uuid;`,
            tipoEmp, EMPRESA.razon_social, EMPRESA.nombre_comercial, EMPRESA.tipo_documento,
            EMPRESA.email, EMPRESA.direccion, EMPRESA.ubigeo, empresaId
          )
        } else {
          empresaId = genUuid()
          await tx.$executeRawUnsafe(
            `INSERT INTO public.empresas (id, tipo_empresa_id, razon_social, nombre_comercial, tipo_documento, numero_documento, email, direccion, ubigeo, activo, created_at, updated_at)
             VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW());`,
            empresaId, tipoEmp, EMPRESA.razon_social, EMPRESA.nombre_comercial, EMPRESA.tipo_documento,
            EMPRESA.numero_documento, EMPRESA.email, EMPRESA.direccion, EMPRESA.ubigeo
          )
        }
      }

      // --- 4d Sucursal DEV01 ---
      let sucursalId
      {
        const row = await tx.$queryRawUnsafe(
          "SELECT id FROM public.sucursales WHERE empresa_id=$1::uuid AND codigo=$2;",
          empresaId, SUCURSAL.codigo
        )
        if (row && row[0]) {
          sucursalId = row[0].id
          await tx.$executeRawUnsafe(
            `UPDATE public.sucursales SET nombre=$1, es_principal=$2, direccion=$3, activo=true, deleted_at=NULL, updated_at=NOW() WHERE id=$4::uuid;`,
            SUCURSAL.nombre, SUCURSAL.es_principal, SUCURSAL.direccion, sucursalId
          )
        } else {
          sucursalId = genUuid()
          await tx.$executeRawUnsafe(
            `INSERT INTO public.sucursales (id, empresa_id, codigo, nombre, es_principal, direccion, activo, created_at, updated_at)
             VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, true, NOW(), NOW());`,
            sucursalId, empresaId, SUCURSAL.codigo, SUCURSAL.nombre, SUCURSAL.es_principal, SUCURSAL.direccion
          )
        }
      }

      // --- 4e Roles + Permisos + RolPermiso ---
      const roleIds = {}
      const permIds = {}
      for (const [rol, perms] of [
        [ROL_ADMIN_EMPRESA, PERMISOS_ADMIN_EMPRESA],
        [ROL_ADMIN_POS, PERMISOS_ADMIN_POS],
      ]) {
        let rolId
        {
          const row = await tx.$queryRawUnsafe("SELECT id FROM public.roles WHERE codigo=$1;", rol.codigo)
          if (row && row[0]) {
            rolId = row[0].id
            await tx.$executeRawUnsafe(
              "UPDATE public.roles SET nombre=$1, descripcion=$2, activo=true, deleted_at=NULL, updated_at=NOW() WHERE id=$3::uuid;",
              rol.nombre, rol.descripcion, rolId
            )
          } else {
            rolId = genUuid()
            await tx.$executeRawUnsafe(
              "INSERT INTO public.roles (id, codigo, nombre, descripcion, activo, created_at, updated_at) VALUES ($1::uuid, $2, $3, $4, true, NOW(), NOW());",
              rolId, rol.codigo, rol.nombre, rol.descripcion
            )
          }
        }
        roleIds[rol.codigo] = rolId

        for (const p of perms) {
          let permId
          if (permIds[p.codigo]) {
            permId = permIds[p.codigo]
          } else {
            const permRow = await tx.$queryRawUnsafe("SELECT id FROM public.permisos WHERE codigo=$1;", p.codigo)
            if (permRow && permRow[0]) {
              permId = permRow[0].id
              await tx.$executeRawUnsafe(
                "UPDATE public.permisos SET nombre=$1, modulo=$2, activo=true, deleted_at=NULL, updated_at=NOW() WHERE id=$3::uuid;",
                p.nombre, p.modulo, permId
              )
            } else {
              permId = genUuid()
              await tx.$executeRawUnsafe(
                "INSERT INTO public.permisos (id, codigo, nombre, modulo, activo, created_at, updated_at) VALUES ($1::uuid, $2, $3, $4, true, NOW(), NOW());",
                permId, p.codigo, p.nombre, p.modulo
              )
            }
            permIds[p.codigo] = permId
          }
          // RolPermiso
          {
            const rpRow = await tx.$queryRawUnsafe(
              "SELECT id FROM public.rol_permiso WHERE rol_id=$1::uuid AND permiso_id=$2::uuid;",
              rolId, permId
            )
            if (!(rpRow && rpRow[0])) {
              await tx.$executeRawUnsafe(
                "INSERT INTO public.rol_permiso (id, rol_id, permiso_id, created_at, updated_at) VALUES ($1::uuid, $2::uuid, $3::uuid, NOW(), NOW());",
                genUuid(), rolId, permId
              )
            }
          }
        }
      }

      // --- 4f Usuario ADMIN EMPRESA (con empresaId + sucursalId) ---
      let u1Id
      {
        const row = await tx.$queryRawUnsafe(
          "SELECT id FROM public.usuarios WHERE LOWER(COALESCE(username,''))='admin' OR LOWER(COALESCE(email,''))='admin@rayego.pe' LIMIT 1;"
        )
        if (row && row[0]) {
          u1Id = row[0].id
          await tx.$executeRawUnsafe(
            `UPDATE public.usuarios SET
              username='admin', email='admin@rayego.pe', password_hash=$1,
              nombres=$2, apellidos=$3, tipo_documento=$4, numero_documento=$5,
              empresa_id=$6::uuid, sucursal_id=$7::uuid,
              activo=true, deleted_at=NULL, updated_at=NOW()
             WHERE id=$8::uuid;`,
            passwordHash, USUARIO_ADMIN_EMPRESA.nombres, USUARIO_ADMIN_EMPRESA.apellidos,
            USUARIO_ADMIN_EMPRESA.tipo_documento, USUARIO_ADMIN_EMPRESA.numero_documento,
            empresaId, sucursalId, u1Id
          )
        } else {
          u1Id = genUuid()
          await tx.$executeRawUnsafe(
            `INSERT INTO public.usuarios (id, username, email, password_hash, nombres, apellidos, tipo_documento, numero_documento, empresa_id, sucursal_id, activo, created_at, updated_at)
             VALUES ($1::uuid, 'admin', 'admin@rayego.pe', $2, $3, $4, $5, $6, $7::uuid, $8::uuid, true, NOW(), NOW());`,
            u1Id, passwordHash, USUARIO_ADMIN_EMPRESA.nombres, USUARIO_ADMIN_EMPRESA.apellidos,
            USUARIO_ADMIN_EMPRESA.tipo_documento, USUARIO_ADMIN_EMPRESA.numero_documento,
            empresaId, sucursalId
          )
        }
      }

      // UsuarioSucursal: U1 + DEV01 + ADMIN
      {
        const row = await tx.$queryRawUnsafe(
          "SELECT id FROM public.usuario_sucursal WHERE usuario_id=$1::uuid AND sucursal_id=$2::uuid AND rol_id=$3::uuid;",
          u1Id, sucursalId, roleIds.ADMIN
        )
        if (row && row[0]) {
          await tx.$executeRawUnsafe("UPDATE public.usuario_sucursal SET activo=true, deleted_at=NULL, updated_at=NOW() WHERE id=$1::uuid;", row[0].id)
        } else {
          await tx.$executeRawUnsafe(
            "INSERT INTO public.usuario_sucursal (id, usuario_id, sucursal_id, rol_id, activo, created_at, updated_at) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, true, NOW(), NOW());",
            genUuid(), u1Id, sucursalId, roleIds.ADMIN
          )
        }
      }
      // UsuarioRol: U1 + ADMIN global
      {
        const row = await tx.$queryRawUnsafe(
          "SELECT id FROM public.usuario_rol WHERE usuario_id=$1::uuid AND rol_id=$2::uuid;",
          u1Id, roleIds.ADMIN
        )
        if (row && row[0]) {
          await tx.$executeRawUnsafe("UPDATE public.usuario_rol SET activo=true, deleted_at=NULL, updated_at=NOW() WHERE id=$1::uuid;", row[0].id)
        } else {
          await tx.$executeRawUnsafe(
            "INSERT INTO public.usuario_rol (id, usuario_id, rol_id, activo, created_at, updated_at) VALUES ($1::uuid, $2::uuid, $3::uuid, true, NOW(), NOW());",
            genUuid(), u1Id, roleIds.ADMIN
          )
        }
      }

      // --- 4g Usuario ADMIN POS PLATAFORMA (SIN empresaId, SIN sucursalId) ---
      let u2Id
      {
        const row = await tx.$queryRawUnsafe(
          "SELECT id FROM public.usuarios WHERE LOWER(COALESCE(username,''))='admin.pos' OR LOWER(COALESCE(email,''))='admin.pos@rayego.pe' LIMIT 1;"
        )
        if (row && row[0]) {
          u2Id = row[0].id
          await tx.$executeRawUnsafe(
            `UPDATE public.usuarios SET
              username='admin.pos', email='admin.pos@rayego.pe', password_hash=$1,
              nombres=$2, apellidos=$3, tipo_documento=$4, numero_documento=$5,
              empresa_id=NULL, sucursal_id=NULL,
              activo=true, deleted_at=NULL, updated_at=NOW()
             WHERE id=$6::uuid;`,
            passwordHash, USUARIO_ADMIN_POS.nombres, USUARIO_ADMIN_POS.apellidos,
            USUARIO_ADMIN_POS.tipo_documento, USUARIO_ADMIN_POS.numero_documento, u2Id
          )
        } else {
          u2Id = genUuid()
          await tx.$executeRawUnsafe(
            `INSERT INTO public.usuarios (id, username, email, password_hash, nombres, apellidos, tipo_documento, numero_documento, empresa_id, sucursal_id, activo, created_at, updated_at)
             VALUES ($1::uuid, 'admin.pos', 'admin.pos@rayego.pe', $2, $3, $4, $5, $6, NULL, NULL, true, NOW(), NOW());`,
            u2Id, passwordHash, USUARIO_ADMIN_POS.nombres, USUARIO_ADMIN_POS.apellidos,
            USUARIO_ADMIN_POS.tipo_documento, USUARIO_ADMIN_POS.numero_documento
          )
        }
      }
      // UsuarioRol: U2 + ADMIN_POS global (SIN usuario_sucursal)
      {
        const row = await tx.$queryRawUnsafe(
          "SELECT id FROM public.usuario_rol WHERE usuario_id=$1::uuid AND rol_id=$2::uuid;",
          u2Id, roleIds.ADMIN_POS
        )
        if (row && row[0]) {
          await tx.$executeRawUnsafe("UPDATE public.usuario_rol SET activo=true, deleted_at=NULL, updated_at=NOW() WHERE id=$1::uuid;", row[0].id)
        } else {
          await tx.$executeRawUnsafe(
            "INSERT INTO public.usuario_rol (id, usuario_id, rol_id, activo, created_at, updated_at) VALUES ($1::uuid, $2::uuid, $3::uuid, true, NOW(), NOW());",
            genUuid(), u2Id, roleIds.ADMIN_POS
          )
        }
      }

      console.log('\n=========================================================')
      console.log('✅ SEED DEV OK (solo Postgres-dev). Resumen:')
      console.log('   TipoEmpresa :', TIPO_EMPRESA.codigo, TIPO_EMPRESA.nombre)
      console.log('   Modulos     :', MODULOS_REQUERIDOS.map(m => m.codigo).join(', '))
      console.log('   Empresa     :', EMPRESA.numero_documento, EMPRESA.razon_social)
      console.log('   Sucursal    :', SUCURSAL.codigo, SUCURSAL.nombre)
      console.log('   Roles       : ADMIN empresa + ADMIN_POS plataforma')
      console.log('   Permisos    :', PERMISOS_ADMIN_EMPRESA.length + PERMISOS_ADMIN_POS.length, 'totales')
      console.log('   👤 Usuario 1 (ADMIN EMPRESA):')
      console.log('       · Login   :', USUARIO_ADMIN_EMPRESA.username, '/', USUARIO_ADMIN_EMPRESA.email)
      console.log('       · Alcance : empresa + sucursal DEV01 + global ADMIN')
      console.log('   👤 Usuario 2 (ADMIN POS PLATAFORMA):')
      console.log('       · Login   :', USUARIO_ADMIN_POS.username, '/', USUARIO_ADMIN_POS.email)
      console.log('       · Alcance : SIN empresa · SIN sucursal · ROL ADMIN_POS (solo global usuario_rol)')
      console.log('   🔐 Password  : bcryptjs cost=', BCRYPT_COST, ' (MISMA para ambos usuarios)')
      console.log('=========================================================')
    })
  } finally {
    await prisma.$disconnect()
  }
})().catch(err => {
  console.error('\n💥 Error en seed DEV:')
  if (err && typeof err === 'object') {
    try { console.error(JSON.stringify(err, Object.getOwnPropertyNames(err), 2).slice(0, 8000)) }
    catch { console.error(String(err)) }
  } else console.error(String(err))
  process.exit(1)
})
