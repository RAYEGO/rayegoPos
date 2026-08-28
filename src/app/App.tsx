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

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('focusin', onAnyFocusChange, true)
      document.removeEventListener('focusout', onAnyFocusChange, true)
      window.removeEventListener('keydown', onKeyDownCapture, true)
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
