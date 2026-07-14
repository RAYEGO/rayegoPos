export const serverConfig = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET ?? 'rayego-pos-dev-secret',
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
}
