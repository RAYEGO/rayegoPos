import { Outlet } from 'react-router-dom'
import { AppLogo } from '@/components/brand/AppLogo'

export function AuthLayout() {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex min-h-dvh w-full max-w-[1440px] items-center justify-center p-6">
        <div className="w-full max-w-[440px] rounded-lg border bg-card p-8 shadow-softSm">
          <div className="mb-6 flex items-center justify-center">
            <AppLogo variant="auth" />
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  )
}

