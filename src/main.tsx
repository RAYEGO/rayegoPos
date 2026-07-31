import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource/inter/latin.css'
import './index.css'
import { App } from '@/app/App'

// #region debug-point module-white-screen:global-errors
;(function () {
  const url = 'http://127.0.0.1:7777/event'
  const sessionId = 'module-white-screen'
  const runId = 'pre-fix'

  const report = (hypothesisId: string, msg: string, data: Record<string, unknown>) => {
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        runId,
        hypothesisId,
        location: 'src/main.tsx',
        msg,
        data,
        ts: Date.now(),
      }),
    }).catch(() => null)
  }

  window.addEventListener('error', (event) => {
    report('A', '[DEBUG] window.error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack:
        'error' in event && event.error instanceof Error ? event.error.stack ?? null : null,
      href: window.location.href,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    report('A', '[DEBUG] window.unhandledrejection', {
      reasonType: typeof reason,
      reasonMessage: reason instanceof Error ? reason.message : String(reason),
      reasonStack: reason instanceof Error ? reason.stack ?? null : null,
      href: window.location.href,
    })
  })

  let lastHref = window.location.href
  setInterval(() => {
    if (window.location.href === lastHref) return
    lastHref = window.location.href
    report('D', '[DEBUG] route.changed', { href: lastHref })
  }, 250)
})()
// #endregion

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
