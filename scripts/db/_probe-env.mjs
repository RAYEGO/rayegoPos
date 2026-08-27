import { config as loadEnvFile } from 'dotenv'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..', '..')
const envFile = resolve(root, '.env.production')

loadEnvFile({ path: envFile, override: false })

console.log('====================================')
console.log('   PROBE: .env.production + deps + BD')
console.log('====================================')
console.log('archivo env  :', envFile)
console.log('existe       :', existsSync(envFile))
console.log('env mode     :', process.env.APP_ENV || process.env.RAYEGO_ENV_MODE || 'n/a')

const required = [
  ['DATABASE_URL', (v) => v && !v.includes('TU_PASSWORD') && v.length > 20],
  ['DIRECT_URL',   (v) => v && !v.includes('TU_PASSWORD') && v.length > 20],
  ['JWT_SECRET',   (v) => v && v.length >= 20],
]
let varsOK = true
for (const [v, check] of required) {
  const val = process.env[v]
  const ok = check(val)
  if (!ok) varsOK = false
  const preview = val ? (val.slice(0, 12).replace(/[^:]/g, '*').slice(0,6) + '***[' + val.length + 'c]') : '(vacio)'
  console.log(`  ${v.padEnd(15)}: ${ok ? '✅' : '❌'}  ${preview}`)
}

console.log('')
const prismaClientPath = resolve(root, 'node_modules', '@prisma', 'client', 'index.js')
const prismaBin = resolve(root, 'node_modules', '.bin', 'prisma.cmd')
const tsxBin = resolve(root, 'node_modules', '.bin', 'tsx.cmd')
console.log('Prisma Client  :', existsSync(prismaClientPath) ? '✅' : '❌')
console.log('Prisma CLI bin :', existsSync(prismaBin) ? '✅' : '❌')
console.log('tsx runner     :', existsSync(tsxBin) ? '✅' : '❌')

if (!varsOK) {
  console.log('\n⚠️  Faltan o son inválidas variables en .env.production. Revisa DATABASE_URL y DIRECT_URL.')
  process.exit(1)
}

if (!existsSync(prismaClientPath)) {
  console.log('\n⚠️  Falta @prisma/client. Ejecuta: npx prisma generate')
  process.exit(1)
}

console.log('\n> Probando conexión a Railway PostgreSQL (SÓLO SELECT 1)...')
try {
  const prismaUrl = 'file:///' + prismaClientPath.replace(/\\/g, '/')
  const { PrismaClient } = await import(prismaUrl)
  const prisma = new PrismaClient({
    datasources: {
      db: { url: process.env.DATABASE_URL },
    },
  })
  const r = await prisma.$queryRawUnsafe(
    `SELECT current_database()::text as db, current_user::text as usr, version()::text as v, now()::text as ahora;`
  )
  console.log('✅ CONEXIÓN EXITOSA')
  console.log('   DB name :', r[0].db)
  console.log('   Usuario :', r[0].usr)
  console.log('   PG ver  :', (r[0].v || '').split('\n')[0].slice(0, 50))
  console.log('   Hora BD :', r[0].ahora)

  console.log('\n> Conteo rápido de tablas clave...')
  const cc = {}
  const tables = [
    'empresas','sucursales','usuarios','roles','permisos','rol_permiso',
    'tipos_empresa','modulos','configuracion',
    'categorias','laboratorios','presentaciones','unidades_medida','principios_activos',
    'productos','proveedores','clientes',
    'inventario','lotes','movimientos_inventario',
    'compras','ventas','cajas','apertura_caja','cierre_caja',
    'movimientos_caja','ingresos','egresos','arqueo_caja','conciliacion_caja',
    'auditoria',
  ]
  for (const t of tables) {
    try {
      const [row] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as cnt FROM ${t};`)
      cc[t] = row.cnt
    } catch (e) {
      cc[t] = `ERROR:${e.message.split('\n')[0].slice(0,60)}`
    }
  }
  console.log('')
  for (const [t, c] of Object.entries(cc)) {
    const mark = typeof c === 'number' && c > 0 ? '🔵' : '⚪'
    console.log(`   ${mark} ${t.padEnd(30)}: ${c}`)
  }

  await prisma.$disconnect()
  console.log('\n✅ PROBE COMPLETADO OK')
  process.exit(0)
} catch (e) {
  console.log('\n❌ ERROR en conexión:')
  console.log('   Mensaje :', e.message)
  if (e.code) console.log('   Código  :', e.code)
  process.exit(2)
}
