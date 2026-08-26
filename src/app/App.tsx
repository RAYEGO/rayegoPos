import { Toaster } from 'sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { InactivityProvider } from '@/contexts/InactivityProvider'
import { SessionWarningModal } from '@/components/auth/SessionWarningModal'
import { AppRoutes } from '@/routes/AppRoutes'

export function App() {
  return (
    <AuthProvider>
      <InactivityProvider>
        <AppRoutes />
        <SessionWarningModal />
        <Toaster richColors position="top-right" />
      </InactivityProvider>
    </AuthProvider>
  )
}
