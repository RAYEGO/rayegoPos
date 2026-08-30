import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { InactivityProvider } from '@/contexts/InactivityProvider'
import { SessionWarningModal } from '@/components/auth/SessionWarningModal'
import { AppRoutes } from '@/routes/AppRoutes'

function GlobalDialogSanitizer() {
  useEffect(() => {
    const hasActiveRadixOverlay = () =>
      Boolean(
        document.querySelector(
          '[data-state="open"][role="dialog"], [data-state="open"][data-radix-focus-scope-root], [data-state="open"][role="alertdialog"]',
        ),
      )

    const sanitize = () => {
      try {
        if (hasActiveRadixOverlay()) return
        document.querySelectorAll('[inert]').forEach((node) => {
          node.removeAttribute('inert')
        })
      } catch {
      }
    }
    sanitize()
    const timer = window.setInterval(sanitize, 400)

    const onAnyFocusChange = () => {
      if (hasActiveRadixOverlay()) return
      sanitize()
    }
    document.addEventListener('focusin', onAnyFocusChange, true)
    document.addEventListener('focusout', onAnyFocusChange, true)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('focusin', onAnyFocusChange, true)
      document.removeEventListener('focusout', onAnyFocusChange, true)
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
