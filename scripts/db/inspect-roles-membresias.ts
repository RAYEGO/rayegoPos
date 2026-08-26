import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const roles = await prisma.rol.findMany({
    where: { deletedAt: null, activo: true },
    select: { id: true, codigo: true, nombre: true },
  })
  console.log('Roles activos:\n', roles)

  // Verificar usuario_rol existentes
  const usuarioRol = await prisma.usuarioRol.findMany({
    where: { deletedAt: null, activo: true },
    select: {
      usuarioId: true,
      rolId: true,
      rol: { select: { codigo: true } },
      usuario: { select: { username: true } },
    },
  })
  console.log('\nUsuario_rol actual:\n', usuarioRol)

  // Verificar usuario_sucursal actuales
  const usuarioSucursal = await prisma.usuarioSucursal.findMany({
    where: { deletedAt: null, activo: true },
    select: {
      usuarioId: true,
      sucursalId: true,
      rolId: true,
      usuario: { select: { username: true } },
      sucursal: { select: { nombre: true } },
    },
  })
  console.log('\nUsuario_sucursal actuales (activo+no eliminados):\n', usuarioSucursal)
}
main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
