import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const empresas = await prisma.empresa.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      razonSocial: true,
    },
  })
  console.log('Empresas:\n', empresas, '\n')

  for (const emp of empresas) {
    const branches = await prisma.sucursal.findMany({
      where: { empresaId: emp.id, deletedAt: null },
      select: { id: true, codigo: true, nombre: true, activo: true },
    })
    console.log(`Sucursales ${emp.razonSocial} (${emp.id}):\n`, branches, '\n')
  }

  const users = await prisma.usuario.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      username: true,
      email: true,
      nombres: true,
      apellidos: true,
      empresaId: true,
    },
  })
  console.log('Usuarios existentes:\n', users)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
