import { spawn } from 'node:child_process'
import process from 'node:process'
import {
  loadResolvedProjectEnvironment,
  resolveProjectEnvironment,
} from './project-env.mjs'

function printUsageAndExit() {
  console.error(
    'Uso: node scripts/run-with-project-env.mjs [--env development|production] [--print] -- <comando> [args...]',
  )
  process.exit(1)
}

function parseArguments(argv) {
  let requestedEnv = null
  let printOnly = false
  let commandIndex = argv.indexOf('--')

  const optionArgs = commandIndex >= 0 ? argv.slice(0, commandIndex) : argv
  const commandArgs = commandIndex >= 0 ? argv.slice(commandIndex + 1) : []

  for (let index = 0; index < optionArgs.length; index += 1) {
    const arg = optionArgs[index]

    if (arg === '--print') {
      printOnly = true
      continue
    }

    if (arg === '--env') {
      requestedEnv = optionArgs[index + 1] ?? null
      index += 1
      continue
    }

    printUsageAndExit()
  }

  if (requestedEnv && requestedEnv !== 'development' && requestedEnv !== 'production') {
    console.error(`Entorno no soportado: ${requestedEnv}`)
    process.exit(1)
  }

  return {
    requestedEnv,
    printOnly,
    commandArgs,
  }
}

function printResolution(target) {
  const summary = {
    source: target.source,
    branch: target.branch,
    mode: target.mode,
    envFile: target.envFile,
    managedPlatform: target.managedPlatform,
  }

  console.log(JSON.stringify(summary, null, 2))
}

function runCommand(commandArgs, target) {
  if (commandArgs.length === 0) {
    printUsageAndExit()
  }

  process.env.RAYEGO_ENV_MODE = target.mode
  process.env.RAYEGO_ENV_SOURCE = target.source
  if (target.envFile) {
    process.env.RAYEGO_ENV_FILE = target.envFile
  }

  const [command, ...args] = commandArgs

  const child = spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
    shell: true,
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }

    process.exit(code ?? 0)
  })
}

const parsed = parseArguments(process.argv.slice(2))
const target = resolveProjectEnvironment(parsed.requestedEnv)

if (!target.managedPlatform) {
  try {
    loadResolvedProjectEnvironment(target)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

if (parsed.printOnly) {
  printResolution(target)
  process.exit(0)
}

runCommand(parsed.commandArgs, target)
