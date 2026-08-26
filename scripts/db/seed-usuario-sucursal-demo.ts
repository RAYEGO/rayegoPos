import 'dotenv/config'
import { PrismaClient, type Rol } from '@prisma/client'
import { hash } from 'bcryptjs'
const prisma = new PrismaClient()
const SALT_ROUNDS = 12

const EMPRESA_ID = '6b612c37-03cc-433b-9ab9-2d8ad19f08b9'
const BRANCH_PRINCIPAL = '091eb48c-8443-45ab-82ac-f74bbbaf78af'
const BRANCH_SAN_MIGUEL = '4778b516-3705-4595-81bf-b02769933b7a'

const USUARIO_ADMIN_ID = '6b8def7f-0bcf-4656-9126-2b20910e59ff'
const USUARIO_SUPERVISOR_ID = 'cfbd9dbe-1414-4554-be90-a3f6914176f3'
const USUARIO_CAJA_ID = '69478418-4097-44a2-86a6-d6aee30ec0d5'

const ROL_CODIGO_TO_ID: Record<string, string> = {}

async function main() {
  const roles = await prisma.rol.findMany({
    where: { codigo: { in: ['ADMIN', 'SUPERVISOR', 'CAJERO'] }, deletedAt: null, activo: true },
    select: { id: true, codigo: true },
  })
  roles.forEach((r) => { ROL_CODIGO_TO_ID[r.codigo] = r.id })

  console.log('Usando roles:', ROL_CODIGO_TO_ID)

  const existing = await prisma.usuarioSucursal.findMany({
    where: { usuarioId: { in: [USUARIO_ADMIN_ID, USUARIO_SUPERVISOR_ID, USUARIO_CAJA_ID] }, deletedAt: null },
    select: { id: true, usuarioId: true, sucursalId: true },
  })
  if (existing.length > 0) {
    console.log('Hay usuarioSucursal existentes, borrando logical delete para reset...')
    await prisma.usuarioSucursal.updateMany({
      where: { id: { in: existing.map((e) => e.id) } },
      data: { deletedAt: new Date(), activo: false },
    })
  }

  const rows = [
    // ADMIN = 2 sucursales
    { usuarioId: USUARIO_ADMIN_ID, sucursalId: BRANCH_PRINCIPAL, rolId: ROL_CODIGO_TO_ID.ADMIN },
    { usuarioId: USUARIO_ADMIN_ID, sucursalId: BRANCH_SAN_MIGUEL, rolId: ROL_CODIGO_TO_ID.ADMIN },
    // SUPERVISOR = 2 sucursales
    { usuarioId: USUARIO_SUPERVISOR_ID, sucursalId: BRANCH_PRINCIPAL, rolId: ROL_CODIGO_TO_ID.SUPERVISOR },
    { usuarioId: USUARIO_SUPERVISOR_ID, sucursalId: BRANCH_SAN_MIGUEL, rolId: ROL_CODIGO_TO_ID.SUPERVISOR },
    // CAJERO = 1 sucursal
    { usuarioId: USUARIO_CAJA_ID, sucursalId: BRANCH_PRINCIPAL, rolId: ROL_CODIGO_TO_ID.CAJERO },
  ]

  await prisma.usuarioSucursal.createMany({
    data: rows.map((r) => ({
      ...r,
      activo: true,
    })),
    skipDuplicates: true,
  })

  console.log('Insertados ' + rows.length + ' filas en usuario_sucursal.')

  // Crear usuario temporal SIN sucursales para testear 409 bloqueo
  const USR_SIN_SUCURSAL_EMAIL = 'sin.sucursal@rayego.pe'
  const USR_SIN_SUCURSAL_USERNAME = 'sin.sucursal'
  let sinSucursalUser = await prisma.usuario.findFirst({
    where: { username: USR_SIN_SUCURSAL_USERNAME, deletedAt: null },
    select: { id: true },
  })
  const passwdHash = await hash('DemoSinSucursal123!', SALT_ROUNDS)
  if (!sinSucursalUser) {
    sinSucursalUser = await prisma.usuario.create({
      data: {
        empresaId: EMPRESA_ID,
        nombres: 'Usuario',
        apellidos: 'Sin Sucursal',
        tipoDocumento: 'DNI',
        numeroDocumento: '00000000',
        telefono: '900000000',
        email: USR_SIN_SUCURSAL_EMAIL,
        username: USR_SIN_SUCURSAL_USERNAME,
        passwordHash: passwdHash,
        activo: true,
      },
      select: { id: true },
    })
    // Asignar rol CAJERO en usuario_rol (para login pase)
    await prisma.usuarioRol.create({
      data: {
        usuarioId: sinSucursalUser.id,
        rolId: ROL_CODIGO_TO_ID.CAJERO,
        activo: true,
      },
    })
    console.log('Usuario sin sucursal creado:', sinSucursalUser.id)
  } else {
    console.log('Usuario sin sucursal ya existente:', sinSucursalUser.id)
    // Asegurarse que NO tenga ninguna asignación en usuario_sucursal
    const s = await prisma.usuarioSucursal.findMany({ where: { usuarioId: sinSucursalUser.id, deletedAt: null } })
    if (s.length > 0) {
      await prisma.usuarioSucursal.updateMany({
        where: { id: { in: s.map((x) => x.id) } },
        data: { deletedAt: new Date(), activo: false },
      })
      console.log(' - removidas asignaciones anteriores de usuario sin sucursal.')
    }
  }

  // Listar resultado final
  const final = await prisma.usuarioSucursal.findMany({
    where: { deletedAt: null, activo: true },
    select: {
      usuarioId: true,
      sucursalId: true,
      rolId: true,
      usuario: { select: { username: true } },
      sucursal: { select: { nombre: true } },
    },
  })
  console.log('\nUsuario_Sucursal finales activos:')
  final.forEach((f) => {
    console.log(` - ${f.usuario?.username} @ ${f.sucursal?.nombre}`)
  })
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
