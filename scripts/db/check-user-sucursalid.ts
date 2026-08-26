import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const users = await prisma.usuario.findMany({
    where: { username: { in: ['admin', 'supervisor', 'caja'] }, deletedAt: null },
    select: { id: true, username: true, sucursalId: true, empresaId: true, email: true },
  })
  console.log('Legacy sucursalId check:', users)
}
main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
