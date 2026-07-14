import { createApp } from './app.js'
import { serverConfig } from './config.js'

async function start() {
  const app = createApp()

  try {
    await app.listen({
      host: serverConfig.host,
      port: serverConfig.port,
    })
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

void start()
