import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { InactivityProvider } from '@/contexts/InactivityProvider'
import { SessionWarningModal } from '@/components/auth/SessionWarningModal'
import { AppRoutes } from '@/routes/AppRoutes'

function GlobalDialogSanitizer() {
  useEffect(() => {
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
      if (event.defaultPrevented || event.isComposing) return
      const target = event.target as HTMLElement | null
      if (!target) return
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
        const asEl = target as HTMLInputElement | HTMLTextAreaElement
        if (!asEl.disabled && !(asEl as any).readOnly) {
          if (document.activeElement !== target) {
            window.requestAnimationFrame(() => {
              try {
                if (document.activeElement !== target && !asEl.disabled && !(asEl as any).readOnly) {
                  target.focus({ preventScroll: true })
                }
              } catch {
              }
            })
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
