import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { paths } from '@/routes/paths'

export function NotFoundRedirect() {
  const { isAuthenticated, isBootstrapping } = useAuth()

  if (isBootstrapping) {
    return null
  }

  return (
    <Navigate to={isAuthenticated ? paths.dashboard : paths.landing} replace />
  )
}

