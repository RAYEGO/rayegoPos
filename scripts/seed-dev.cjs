/**
 * ==============================================================
 *  SEED SOLO ENTORNO DEVELOPMENT — Usuario admin inicial DEV
 * ==============================================================
 *  Reglas INQUEBRANTABLES (NUNCA modificar estas líneas):
 *   1. Este script SOLO corre en entorno development.
 *   2. NUNCA usa DATABASE_URL de producción (sakura.proxy.rlwy.net).
 *   3. Requiere variable DEV_ADMIN_PASSWORD — NO default hardcodeada.
 *   4. Nunca loguea password_hash, password ni secrets.
 *   5. Si el usuario admin@rayego.pe ya existe → SKIP, no duplicar.
 *   6. Solo crea registros MINIMOS OBLIGATORIOS para login.
 *      NADA de productos/categorías/clientes/proveedores.
 * ==============================================================
 */
const process = require('node:process')
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

// ============================================================
// PASO 0: VALIDACIONES DE SEGURIDAD ANTES DE TOCAR NADA
// ============================================================
const FAIL = (msg) => {
  console.error('\n❌ [SEED DEV ABORTADO] ' + msg)
  process.exit(1)
}

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
      'Setea RAYEGO_ENV_MODE=development o usa run-with-project-env.mjs --env development.',
  )
}
console.log('✅ Validación #1: Entorno → development')

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim()
if (!DATABASE_URL) FAIL('Falta DATABASE_URL. Usar run-with-project-env.mjs --env development')

if (/sakura\.proxy\.rlwy\.net/i.test(DATABASE_URL)) {
  FAIL('DATABASE_URL apunta a Postgres PRODUCCION (sakura.proxy.rlwy.net). ABORTADO.')
}
const dbHostMatch = DATABASE_URL.match(/@([^/?]+)/)
const dbHost = dbHostMatch ? dbHostMatch[1] : '(desconocido)'
console.log('✅ Validación #2: BD host DEV →', dbHost, '(no producción)')

const rawPw = String(process.env.DEV_ADMIN_PASSWORD || '').trim()
if (!rawPw) FAIL('Falta variable DEV_ADMIN_PASSWORD. Definila antes de ejecutar (NUNCA hardcodearla).')
console.log('✅ Validación #3: DEV_ADMIN_PASSWORD provista (no se mostrará).')

// ============================================================
// PASO 1: Datos mínimos (hardcodeados intencionalmente para DEV)
// ============================================================
const TIPO_EMPRESA = {
  codigo: 'BOTICA',
  nombre: 'Botica',
}
const MODULOS_REQUERIDOS = [
  { codigo: 'dashboard', nombre: 'Dashboard', categoria: 'Operaciones' },
  { codigo: 'configuracion', nombre: 'Configuración', categoria: 'Sistema' },
]
const EMPRESA = {
  razonSocial: 'BOTICA DEV SAC',
  nombreComercial: 'Botica DEV',
  numeroDocumento: '20DEV0000000',
  tipoDocumento: 'RUC',
  email: 'dev@rayego.pe',
  direccion: 'Av. DEV 123, Lima',
  ubigeo: '150101',
}
const SUCURSAL = {
  codigo: 'DEV01',
  nombre: 'Sucursal DEV Principal',
  esPrincipal: true,
  direccion: 'Av. DEV 123, Lima',
}
const ROL_ADMIN = {
  codigo: 'ADMIN',
  nombre: 'Administrador',
  descripcion: 'Acceso total DEV',
}
const USUARIO_ADMIN = {
  username: 'admin',
  email: 'admin@rayego.pe',
  nombres: 'Administrador',
  apellidos: 'DEV',
  tipoDocumento: 'DNI',
  numeroDocumento: '00000000',
}
const PERMISOS_ROL_ADMIN = [
  { codigo: 'configuracion.read', modulo: 'configuracion', nombre: 'Ver Configuración' },
  { codigo: 'dashboard.read', modulo: 'dashboard', nombre: 'Ver Dashboard' },
]

const BCRYPT_COST = 10 // MISMO COSTO QUE auth.service.ts L1059 (NO CAMBIAR)

;(async () => {
  const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } })
  try {
    // ============================================================
    // PASO 2: Fast check — Si usuario admin ya existe → EXIT OK (idempotente)
    // ============================================================
    const preExisting = await prisma.$queryRawUnsafe(`
      SELECT id, username, email, activo FROM public.usuarios
      WHERE deleted_at IS NULL
        AND (LOWER(COALESCE(email,''))='admin@rayego.pe' OR LOWER(COALESCE(username,''))='admin')
      LIMIT 1;
    `)
    if (preExisting && preExisting.length > 0) {
      console.log('\nℹ️  Usuario admin@rayego.pe YA EXISTE en Postgres-dev → no se creó nada (seed idempotente).')
      console.log('   Usuario id:', preExisting[0].id,
                  ' username:', preExisting[0].username,
                  ' email:', preExisting[0].email,
                  ' activo:', preExisting[0].activo)
      process.exit(0)
    }
    console.log('✅ Usuario admin no existe → creando registros mínimos obligatorios...')

    // ============================================================
    // PASO 3: Hash password (mismo bcryptjs 10 que producción)
    // ============================================================
    const passwordHash = await bcrypt.hash(rawPw, BCRYPT_COST)
    const pwLen = passwordHash.length
    console.log(`✅ Password hasheado (longitud=${pwLen}; bcryptjs cost=${BCRYPT_COST}). NUNCA se almacena ni muestra el texto plano.`)

    // ============================================================
    // PASO 4: Transacción — crear TODO o nada (evita estado roto a mitad)
    // ============================================================
    await prisma.$transaction(async (tx) => {
      // 4a. TipoEmpresa BOTICA
      const tipoEmp = await tx.tipoEmpresa.upsert({
        where: { codigo: TIPO_EMPRESA.codigo },
        update: { nombre: TIPO_EMPRESA.nombre, deletedAt: null },
        create: TIPO_EMPRESA,
      })

      // 4b. Modulos + TipoEmpresaModulo (2 modulos basicos para login/menu)
      for (const m of MODULOS_REQUERIDOS) {
        await tx.modulo.upsert({
          where: { codigo: m.codigo },
          update: { nombre: m.nombre, categoria: m.categoria, activo: true, deletedAt: null },
          create: m,
        })
        await tx.tipoEmpresaModulo.upsert({
          where: { tipoEmpresaId_moduloCodigo: { tipoEmpresaId: tipoEmp.id, moduloCodigo: m.codigo } },
          update: { activo: true },
          create: { tipoEmpresaId: tipoEmp.id, moduloCodigo: m.codigo },
        })
      }

      // 4c. Empresa DEV
      const empresa = await tx.empresa.upsert({
        where: { numeroDocumento: EMPRESA.numeroDocumento },
        update: { razonSocial: EMPRESA.razonSocial, nombreComercial: EMPRESA.nombreComercial, activo: true, deletedAt: null, tipoEmpresaId: tipoEmp.id },
        create: { ...EMPRESA, tipoEmpresaId: tipoEmp.id },
      })

      // 4d. Sucursal DEV01
      const sucursal = await tx.sucursal.upsert({
        where: { empresaId_codigo: { empresaId: empresa.id, codigo: SUCURSAL.codigo } },
        update: { nombre: SUCURSAL.nombre, esPrincipal: true, activo: true, deletedAt: null, direccion: SUCURSAL.direccion },
        create: { ...SUCURSAL, empresaId: empresa.id },
      })

      // 4e. Rol ADMIN + Permisos + RolPermiso
      const rol = await tx.rol.upsert({
        where: { codigo: ROL_ADMIN.codigo },
        update: { nombre: ROL_ADMIN.nombre, descripcion: ROL_ADMIN.descripcion, activo: true, deletedAt: null },
        create: ROL_ADMIN,
      })
      for (const p of PERMISOS_ROL_ADMIN) {
        const perm = await tx.permiso.upsert({
          where: { codigo: p.codigo },
          update: { modulo: p.modulo, nombre: p.nombre, activo: true, deletedAt: null },
          create: p,
        })
        await tx.rolPermiso.upsert({
          where: { rolId_permisoId: { rolId: rol.id, permisoId: perm.id } },
          update: { deletedAt: null },
          create: { rolId: rol.id, permisoId: perm.id },
        })
      }

      // 4f. Usuario Admin DEV
      const usuario = await tx.usuario.upsert({
        where: { username: USUARIO_ADMIN.username },
        update: {
          email: USUARIO_ADMIN.email,
          nombres: USUARIO_ADMIN.nombres,
          apellidos: USUARIO_ADMIN.apellidos,
          tipoDocumento: USUARIO_ADMIN.tipoDocumento,
          numeroDocumento: USUARIO_ADMIN.numeroDocumento,
          activo: true,
          deletedAt: null,
          passwordHash,
          empresaId: empresa.id,
          sucursalId: sucursal.id,
        },
        create: {
          ...USUARIO_ADMIN,
          passwordHash,
          empresaId: empresa.id,
          sucursalId: sucursal.id,
        },
      })

      // 4g. UsuarioSucursal (rol por sucursal) + UsuarioRol (global, compatibilidad)
      await tx.usuarioSucursal.upsert({
        where: { usuarioId_sucursalId: { usuarioId: usuario.id, sucursalId: sucursal.id } },
        update: { rolId: rol.id, activo: true, deletedAt: null },
        create: { usuarioId: usuario.id, sucursalId: sucursal.id, rolId: rol.id },
      })
      await tx.usuarioRol.upsert({
        where: { usuarioId_rolId: { usuarioId: usuario.id, rolId: rol.id } },
        update: { activo: true, fechaFin: null, deletedAt: null },
        create: { usuarioId: usuario.id, rolId: rol.id },
      })

      console.log('\n=========================================================')
      console.log('✅ SEED DEV OK (solo Postgres-dev). Resumen:')
      console.log('   TipoEmpresa :', tipoEmp.codigo, tipoEmp.nombre)
      console.log('   Modulos     :', MODULOS_REQUERIDOS.map(m => m.codigo).join(', '))
      console.log('   Empresa     :', EMPRESA.numeroDocumento, EMPRESA.razonSocial, `(id=${empresa.id.slice(0,8)}...)`)
      console.log('   Sucursal    :', SUCURSAL.codigo, SUCURSAL.nombre, `(id=${sucursal.id.slice(0,8)}...)`)
      console.log('   Rol         :', rol.codigo, rol.nombre, `(id=${rol.id.slice(0,8)}...)`)
      console.log('   Permisos    :', PERMISOS_ROL_ADMIN.length, '(configuracion.read + dashboard.read)')
      console.log('   Usuario     :', USUARIO_ADMIN.username, '/', USUARIO_ADMIN.email, `(id=${usuario.id.slice(0,8)}...)   activo=${true}`)
      console.log('   Password    : HASH bcryptjs cost=10 (NUNCA se mostró ni guardó el texto plano).')
      console.log('   NOTA        : No se creó ningún dato de negocio (sin productos/cat/clientes/proveedores).')
      console.log('=========================================================')
    })
  } finally {
    await prisma.$disconnect()
  }
})().catch(err => {
  console.error('\n💥 Error en seed DEV:', (err && err.message) ? err.message.split('\n')[0] : String(err))
  process.exit(1)
})
