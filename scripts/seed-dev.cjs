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
 *   5. Si los usuarios ya existen → SKIP, no duplicar.
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
  { codigo: 'empresas', nombre: 'Empresas', categoria: 'Plataforma' },
  { codigo: 'usuarios', nombre: 'Usuarios', categoria: 'Sistema' },
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
const ROL_ADMIN_EMPRESA = {
  codigo: 'ADMIN',
  nombre: 'Administrador',
  descripcion: 'Acceso total DEV en la empresa/sucursal.',
}
const ROL_ADMIN_POS = {
  codigo: 'ADMIN_POS',
  nombre: 'Administrador POS (Plataforma)',
  descripcion: 'Acceso cross-empresa a gestión de empresas/usuarios/auditoría DEV.',
}

const PERMISOS_ADMIN_EMPRESA = [
  { codigo: 'dashboard.read', modulo: 'dashboard', nombre: 'Ver Dashboard' },
  { codigo: 'configuracion.read', modulo: 'configuracion', nombre: 'Ver Configuración' },
  { codigo: 'configuracion.manage', modulo: 'configuracion', nombre: 'Editar Configuración' },
]
// Permisos de ADMIN_POS según auth.permissions.ts L47-60 — NO inventar nuevos:
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
  tipoDocumento: 'DNI',
  numeroDocumento: '00000000',
}
const USUARIO_ADMIN_POS = {
  username: 'admin.pos',
  email: 'admin.pos@rayego.pe',
  nombres: 'Administrador',
  apellidos: 'POS DEV',
  tipoDocumento: 'DNI',
  numeroDocumento: '00000001',
}

const BCRYPT_COST = 10 // MISMO COSTO QUE auth.service.ts L1059 (NO CAMBIAR)

;(async () => {
  const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } })
  try {
    // ============================================================
    // PASO 2: Password hash 1 sola vez (mismo valor para ambos users)
    // ============================================================
    const passwordHash = await bcrypt.hash(rawPw, BCRYPT_COST)
    console.log(`✅ Password hasheado bcryptjs cost=${BCRYPT_COST} (longitud=${passwordHash.length}). No se muestra ni guarda texto plano.`)

    // ============================================================
    // PASO 3: Fast check — Si AMBOS usuarios existen → EXIT OK (idempotente)
    // ============================================================
    const preExisting = await prisma.$queryRawUnsafe(`
      SELECT id, username, email, activo FROM public.usuarios
      WHERE deleted_at IS NULL
        AND (
          LOWER(COALESCE(email,''))    IN ('admin@rayego.pe','admin.pos@rayego.pe') OR
          LOWER(COALESCE(username,'')) IN ('admin','admin.pos')
        )
      ORDER BY username;
    `)
    if (preExisting && preExisting.length === 2) {
      console.log('\nℹ️  AMBOS usuarios DEV ya existen en Postgres-dev → SKIP (seed idempotente).')
      for (const u of preExisting) console.log(`   · ${u.username} / ${u.email} · activo=${u.activo}`)
      process.exit(0)
    }

    // ============================================================
    // PASO 4: Transacción — TODO o nada (evita estado roto)
    // ============================================================
    await prisma.$transaction(async (tx) => {
      // 4a. TipoEmpresa BOTICA
      const tipoEmp = await tx.tipoEmpresa.upsert({
        where: { codigo: TIPO_EMPRESA.codigo },
        update: { nombre: TIPO_EMPRESA.nombre, deletedAt: null },
        create: TIPO_EMPRESA,
      })

      // 4b. Modulos + TipoEmpresaModulo (basicos + plataforma)
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

      // ============================================================
      // 4e. ROLES + PERMISOS
      // ============================================================
      const rolAdminEmpresa = await tx.rol.upsert({
        where: { codigo: ROL_ADMIN_EMPRESA.codigo },
        update: { nombre: ROL_ADMIN_EMPRESA.nombre, descripcion: ROL_ADMIN_EMPRESA.descripcion, activo: true, deletedAt: null },
        create: ROL_ADMIN_EMPRESA,
      })
      for (const p of PERMISOS_ADMIN_EMPRESA) {
        const perm = await tx.permiso.upsert({
          where: { codigo: p.codigo },
          update: { modulo: p.modulo, nombre: p.nombre, activo: true, deletedAt: null },
          create: p,
        })
        await tx.rolPermiso.upsert({
          where: { rolId_permisoId: { rolId: rolAdminEmpresa.id, permisoId: perm.id } },
          update: { deletedAt: null },
          create: { rolId: rolAdminEmpresa.id, permisoId: perm.id },
        })
      }

      const rolAdminPos = await tx.rol.upsert({
        where: { codigo: ROL_ADMIN_POS.codigo },
        update: { nombre: ROL_ADMIN_POS.nombre, descripcion: ROL_ADMIN_POS.descripcion, activo: true, deletedAt: null },
        create: ROL_ADMIN_POS,
      })
      for (const p of PERMISOS_ADMIN_POS) {
        const perm = await tx.permiso.upsert({
          where: { codigo: p.codigo },
          update: { modulo: p.modulo, nombre: p.nombre, activo: true, deletedAt: null },
          create: p,
        })
        await tx.rolPermiso.upsert({
          where: { rolId_permisoId: { rolId: rolAdminPos.id, permisoId: perm.id } },
          update: { deletedAt: null },
          create: { rolId: rolAdminPos.id, permisoId: perm.id },
        })
      }

      // ============================================================
      // 4f. USUARIO (a) ADMIN de EMPRESA — con empresaId + sucursalId
      // ============================================================
      const usuarioAdminEmpresa = await tx.usuario.upsert({
        where: { username: USUARIO_ADMIN_EMPRESA.username },
        update: {
          email: USUARIO_ADMIN_EMPRESA.email,
          nombres: USUARIO_ADMIN_EMPRESA.nombres,
          apellidos: USUARIO_ADMIN_EMPRESA.apellidos,
          tipoDocumento: USUARIO_ADMIN_EMPRESA.tipoDocumento,
          numeroDocumento: USUARIO_ADMIN_EMPRESA.numeroDocumento,
          activo: true,
          deletedAt: null,
          passwordHash,
          empresaId: empresa.id,
          sucursalId: sucursal.id,
        },
        create: {
          ...USUARIO_ADMIN_EMPRESA,
          passwordHash,
          empresaId: empresa.id,
          sucursalId: sucursal.id,
        },
      })
      // UsuarioSucursal (rol por sucursal) + UsuarioRol (compatibilidad)
      await tx.usuarioSucursal.upsert({
        where: { usuarioId_sucursalId: { usuarioId: usuarioAdminEmpresa.id, sucursalId: sucursal.id } },
        update: { rolId: rolAdminEmpresa.id, activo: true, deletedAt: null },
        create: { usuarioId: usuarioAdminEmpresa.id, sucursalId: sucursal.id, rolId: rolAdminEmpresa.id },
      })
      await tx.usuarioRol.upsert({
        where: { usuarioId_rolId: { usuarioId: usuarioAdminEmpresa.id, rolId: rolAdminEmpresa.id } },
        update: { activo: true, fechaFin: null, deletedAt: null },
        create: { usuarioId: usuarioAdminEmpresa.id, rolId: rolAdminEmpresa.id },
      })

      // ============================================================
      // 4g. USUARIO (b) ADMIN_POS PLATAFORMA — SIN empresaId, SIN sucursalId, SOLO usuario_rol GLOBAL
      // ============================================================
      const usuarioAdminPos = await tx.usuario.upsert({
        where: { username: USUARIO_ADMIN_POS.username },
        update: {
          email: USUARIO_ADMIN_POS.email,
          nombres: USUARIO_ADMIN_POS.nombres,
          apellidos: USUARIO_ADMIN_POS.apellidos,
          tipoDocumento: USUARIO_ADMIN_POS.tipoDocumento,
          numeroDocumento: USUARIO_ADMIN_POS.numeroDocumento,
          activo: true,
          deletedAt: null,
          passwordHash,
          // 🔴 SIN empresaId (plataforma)
          empresaId: null,
          // 🔴 SIN sucursalId (plataforma)
          sucursalId: null,
        },
        create: {
          ...USUARIO_ADMIN_POS,
          passwordHash,
          empresaId: null,     // plataforma
          sucursalId: null,    // plataforma
        },
      })
      // SOLO UsuarioRol GLOBAL (no UsuarioSucursal, ya que platform admin no tiene sucursal)
      await tx.usuarioRol.upsert({
        where: { usuarioId_rolId: { usuarioId: usuarioAdminPos.id, rolId: rolAdminPos.id } },
        update: { activo: true, fechaFin: null, deletedAt: null },
        create: { usuarioId: usuarioAdminPos.id, rolId: rolAdminPos.id },
      })

      console.log('\n=========================================================')
      console.log('✅ SEED DEV OK (solo Postgres-dev). Resumen:')
      console.log('   TipoEmpresa :', tipoEmp.codigo, tipoEmp.nombre)
      console.log('   Modulos     :', MODULOS_REQUERIDOS.map(m => m.codigo).join(', '))
      console.log('   Empresa     :', EMPRESA.numeroDocumento, EMPRESA.razonSocial, `(id=${empresa.id.slice(0,8)}...)`)
      console.log('   Sucursal    :', SUCURSAL.codigo, SUCURSAL.nombre, `(id=${sucursal.id.slice(0,8)}...)`)
      console.log('   Roles       : ADMIN empresa + ADMIN_POS plataforma (2)')
      console.log('   Permisos    :', PERMISOS_ADMIN_EMPRESA.length + PERMISOS_ADMIN_POS.length, ' (empresa + plataforma)')
      console.log('   👤 Usuario 1 (ADMIN EMPRESA):')
      console.log('       · Login   :', USUARIO_ADMIN_EMPRESA.username, '/', USUARIO_ADMIN_EMPRESA.email)
      console.log('       · Alcance : 1 empresa + sucursal DEV01 + sucursal + global usuario_rol')
      console.log('       · Pill Topbar: "Empresa - Botica DEV"')
      console.log('   👤 Usuario 2 (ADMIN POS PLATAFORMA):')
      console.log('       · Login   :', USUARIO_ADMIN_POS.username, '/', USUARIO_ADMIN_POS.email)
      console.log('       · Alcance : SIN empresaId · SIN sucursalId · SOLO rol global ADMIN_POS')
      console.log('       · Pill Topbar: "Administración plataforma"')
      console.log('   🔐 Password  : Mismo bcryptjs cost=10 para ambos. NUNCA se mostró/hardcodeó.')
      console.log('   NOTA        : Sin datos de negocio (0 productos/clientes/proveedores/lotes).')
      console.log('=========================================================')
    })
  } finally {
    await prisma.$disconnect()
  }
})().catch(err => {
  console.error('\n💥 Error en seed DEV:', (err && err.message) ? err.message.split('\n')[0] : String(err))
  process.exit(1)
})
