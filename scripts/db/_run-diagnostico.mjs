import { config as loadEnvFile } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..', '..')
loadEnvFile({ path: resolve(root, '.env.production'), override: false })

process.env.RAYEGO_ENV_MODE = 'production'
process.env.RAYEGO_ENV_SOURCE = 'archivo:.env.production'

await import('./diagnostico-limpieza-produccion.ts')
