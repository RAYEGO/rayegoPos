function parseOrigins(rawOrigins?: string) {
  return (rawOrigins ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

export const serverConfig = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET ?? 'rayego-pos-dev-secret',
  frontendOrigins: parseOrigins(process.env.FRONTEND_ORIGIN),
}

export function isAllowedOrigin(origin: string) {
  return serverConfig.frontendOrigins.some((allowedOrigin) => {
    if (allowedOrigin === origin) {
      return true
    }

    if (!allowedOrigin.includes('*')) {
      return false
    }

    try {
      const originUrl = new URL(origin)
      const allowedUrl = new URL(allowedOrigin.replace('*.', 'placeholder.'))

      if (originUrl.protocol !== allowedUrl.protocol) {
        return false
      }

      const allowedHost = allowedUrl.hostname.replace('placeholder.', '')

      return originUrl.hostname === allowedHost || originUrl.hostname.endsWith(`.${allowedHost}`)
    } catch {
      return false
    }
  })
}
