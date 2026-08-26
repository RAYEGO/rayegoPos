import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

declare global {
  var __rayegoPrisma__: PrismaClient | undefined
  var __rayegoPrismaPerformanceDebugAttached__: boolean | undefined
}

const performanceDebugConfig = (() => {
  const fallback = {
    url: 'http://127.0.0.1:7777/event',
    sessionId: 'system-performance-audit',
  }

  try {
    const content = readFileSync('.dbg/system-performance-audit.env', 'utf8')
    return {
      url: content.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || fallback.url,
      sessionId:
        content.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || fallback.sessionId,
    }
  } catch {
    return fallback
  }
})()

function reportPerformanceDebugEvent(payload: {
  runId: 'pre-fix' | 'post-fix'
  hypothesisId: string
  location: string
  msg: string
  data: Record<string, unknown>
}) {
  void fetch(performanceDebugConfig.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sessionId: performanceDebugConfig.sessionId,
      ts: Date.now(),
      ...payload,
    }),
  }).catch(() => null)
}

export const prisma =
  globalThis.__rayegoPrisma__ ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['error', 'warn', { emit: 'event', level: 'query' }]
        : ['error', { emit: 'event', level: 'query' }],
  })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__rayegoPrisma__ = prisma
}

if (!globalThis.__rayegoPrismaPerformanceDebugAttached__) {
  // #region debug-point B:slow-prisma-query
  prisma.$on('query' as never, (event: any) => {
    if (event.duration < 100) {
      return
    }

    reportPerformanceDebugEvent({
      runId: 'pre-fix',
      hypothesisId: 'B',
      location: 'server/src/lib/prisma.ts:query',
      msg: '[DEBUG] Slow Prisma query',
      data: {
        durationMs: event.duration,
        target: event.target,
        query: event.query,
        params: event.params,
      },
    })
  })
  // #endregion
  globalThis.__rayegoPrismaPerformanceDebugAttached__ = true
}
