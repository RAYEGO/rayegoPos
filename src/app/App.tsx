import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { InactivityProvider } from '@/contexts/InactivityProvider'
import { SessionWarningModal } from '@/components/auth/SessionWarningModal'
import { AppRoutes } from '@/routes/AppRoutes'

const RAYEGO_MASTERS_FIX_VERSION = 'v8-a1147e2-fixmaestros'

function GlobalDialogSanitizer() {
  useEffect(() => {
    try {
      const styleId = '__rayego_fix_badge_style'
      if (!document.getElementById(styleId)) {
        const s = document.createElement('style')
        s.id = styleId
        s.textContent =
          '#__rayego_fix_badge{position:fixed;right:12px;bottom:12px;z-index:9999999;padding:4px 8px;border-radius:6px;font-size:10px;font-weight:600;line-height:1.2;pointer-events:none;user-select:none;opacity:0.75;background:#000;color:#fff;border:1px solid rgba(255,255,255,0.12);font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:0.2px}'
        document.head.appendChild(s)
      }
      if (!document.getElementById('__rayego_fix_badge')) {
        const b = document.createElement('div')
        b.id = '__rayego_fix_badge'
        b.textContent = 'FIX MAESTROS ' + RAYEGO_MASTERS_FIX_VERSION
        document.body.appendChild(b)
      }
    } catch {
    }

    const sanitize = () => {
      try {
        document.querySelectorAll('[inert]').forEach((node) => {
          node.removeAttribute('inert')
        })
      } catch {
      }
    }
    sanitize()
    const timer = window.setInterval(sanitize, 200)

    const onAnyFocusChange = () => sanitize()
    document.addEventListener('focusin', onAnyFocusChange, true)
    document.addEventListener('focusout', onAnyFocusChange, true)

    const onKeyDownCapture = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
        const asEl = target as HTMLInputElement | HTMLTextAreaElement
        if (!asEl.disabled && !(asEl as any).readOnly) {
          if (document.activeElement !== target) {
            try {
              target.focus({ preventScroll: true })
            } catch {
            }
          }
        }
      }
    }
    window.addEventListener('keydown', onKeyDownCapture, true)

    const forceFocusIfEditableOnPointer = (event: MouseEvent | PointerEvent) => {
      try {
        const t = event.target as HTMLElement | null
        if (!t) return
        const editable = t.closest<HTMLElement>(
          'input, textarea, [contenteditable="true"], [contenteditable=""], [role="textbox"]',
        )
        if (editable && !editable.hasAttribute('disabled') && !(editable as any).readOnly) {
          if (document.activeElement !== editable) {
            editable.focus({ preventScroll: true })
          }
        }
      } catch {
      }
    }
    window.addEventListener('pointerdown', forceFocusIfEditableOnPointer, true)
    window.addEventListener('mousedown', forceFocusIfEditableOnPointer, true)

    try {
      // eslint-disable-next-line no-console
      console.log(
        '%c FIX MAESTROS ' + RAYEGO_MASTERS_FIX_VERSION + ' ',
        'background:#22c55e;color:#000;padding:4px 6px;border-radius:4px;font-weight:700',
      )
    } catch {
    }

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('focusin', onAnyFocusChange, true)
      document.removeEventListener('focusout', onAnyFocusChange, true)
      window.removeEventListener('keydown', onKeyDownCapture, true)
      window.removeEventListener('pointerdown', forceFocusIfEditableOnPointer, true)
      window.removeEventListener('mousedown', forceFocusIfEditableOnPointer, true)
    }
  }, [])

  return null
}

export function App() {
  return (
    <AuthProvider>
      <InactivityProvider>
        <GlobalDialogSanitizer />
        <AppRoutes />
        <SessionWarningModal />
        <Toaster richColors position="top-right" />
      </InactivityProvider>
    </AuthProvider>
  )
}
