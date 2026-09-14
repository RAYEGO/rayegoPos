import { useCallback, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  MapPin,
  ShieldAlert,
  Store,
  Zap,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader } from '@/components/ui/loader'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AppLogo } from '@/components/brand/AppLogo'
import { useAuth } from '@/hooks/useAuth'
import {
  loginSchema,
  type LoginSchemaValues,
} from '@/modules/auth/schemas'
import { paths } from '@/routes/paths'
import { BranchSelectionRequiredError, authService } from '@/services/authService'
import type { AuthBranch } from '@/types/auth'

type RedirectState = {
  from?: {
    pathname?: string
  }
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [availableBranches, setAvailableBranches] = useState<AuthBranch[]>([])
  const [pendingCredentials, setPendingCredentials] =
    useState<LoginSchemaValues | null>(null)
  const [isSelectingBranch, setIsSelectingBranch] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const demoCredentials = authService.getDemoCredentials()
  const demoAccounts = authService.getDemoAccounts()

  const redirectTo =
    (location.state as RedirectState | null)?.from?.pathname ?? paths.dashboard

  const form = useForm<LoginSchemaValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: demoCredentials?.email ?? '',
      password: demoCredentials?.password ?? '',
      remember: true,
    },
  })

  const submitWithBranch = useCallback(
    async (values: LoginSchemaValues, branchId?: string) => {
      try {
        setFormError(null)
        setIsSubmitting(true)
        await login({
          ...values,
          branchId,
        })
        toast.success('Bienvenido a Rayego POS.')
        navigate(redirectTo, { replace: true })
      } catch (error) {
        if (error instanceof BranchSelectionRequiredError) {
          setAvailableBranches(error.branches)
          setPendingCredentials(values)
          setIsSelectingBranch(true)
          return
        }
        const message =
          error instanceof Error
            ? error.message
            : 'No se pudo iniciar sesión. Revisa tus credenciales.'
        setFormError(message)
        toast.error(message)
      } finally {
        setIsSubmitting(false)
      }
    },
    [login, navigate, redirectTo],
  )

  const onSubmit = useCallback(
    async (values: LoginSchemaValues) => {
      await submitWithBranch(values)
    },
    [submitWithBranch],
  )

  const handleBranchSelect = useCallback(
    async (branchId: string) => {
      if (!pendingCredentials) return
      await submitWithBranch(pendingCredentials, branchId)
    },
    [pendingCredentials, submitWithBranch],
  )

  const handleBackToLogin = useCallback(() => {
    setIsSelectingBranch(false)
    setAvailableBranches([])
    setPendingCredentials(null)
  }, [])

  if (isSelectingBranch && availableBranches.length > 0) {
    return (
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-2">
        <div className="flex min-h-0 flex-col rounded-3xl border border-border/60 bg-white/95 p-4 shadow-2xl shadow-primary/10 backdrop-blur sm:p-5 lg:p-6 [@media(max-height:820px)]:p-4 [@media(max-height:600px)]:p-3 [@media(max-height:450px)]:p-2">
          <div className="mb-4 flex flex-col items-center sm:mb-5 [@media(max-height:820px)]:mb-3 [@media(max-height:600px)]:mb-2 [@media(max-height:450px)]:mb-1.5">
            <div id="branch-logo-wrap" className="flex h-[220px] w-[220px] shrink-0 flex-col items-center justify-center overflow-hidden sm:h-[230px] sm:w-[230px] lg:h-[240px] lg:w-[240px]">
              <AppLogo variant="auth" />
            </div>
          </div>

          <div className="space-y-1.5 text-center sm:space-y-2 [@media(max-height:600px)]:space-y-0.5 [@media(max-height:450px)]:space-y-0">
            <h1 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl lg:text-3xl [@media(max-height:600px)]:text-lg [@media(max-height:450px)]:text-base">
              Selecciona tu sucursal
            </h1>
            <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm [@media(max-height:600px)]:text-[11px] [@media(max-height:500px)]:hidden">
              Hola {pendingCredentials?.email ?? ''}. Tu cuenta tiene acceso a
              varias sucursales activas.
            </p>
          </div>

          <div className="mt-4 max-h-[calc(100dvh-340px)] min-h-0 space-y-2.5 overflow-y-auto pr-0.5 sm:mt-5 [@media(max-height:780px)]:mt-3 [@media(max-height:600px)]:mt-2 [@media(max-height:450px)]:mt-1.5 [@media(max-height:600px)]:space-y-1.5 [@media(max-height:450px)]:space-y-1">
            {availableBranches.map((branch) => (
              <button
                key={branch.id}
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleBranchSelect(branch.id)}
                className="group flex w-full items-center gap-3 rounded-2xl border border-border bg-background/60 p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none sm:p-4 [@media(max-height:780px)]:p-3 [@media(max-height:600px)]:p-2 [@media(max-height:450px)]:p-1.5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15 sm:h-11 sm:w-11 [@media(max-height:600px)]:h-8 [@media(max-height:600px)]:w-8 [@media(max-height:450px)]:h-7 [@media(max-height:450px)]:w-7">
                  <Store className="h-5 w-5 sm:h-6 sm:w-6 [@media(max-height:600px)]:h-4 [@media(max-height:600px)]:w-4" />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground sm:text-base [@media(max-height:600px)]:text-xs [@media(max-height:450px)]:text-[11px]">
                      {branch.name}
                    </p>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground [@media(max-height:600px)]:text-[10px] [@media(max-height:450px)]:hidden">
                      {branch.code}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground sm:text-xs [@media(max-height:600px)]:text-[10px] [@media(max-height:450px)]:hidden">
                    <Building2 className="h-3 w-3 shrink-0 [@media(max-height:450px)]:hidden" />
                    <span className="truncate">{branch.companyName}</span>
                  </div>
                </div>
                <div className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 [@media(max-height:600px)]:hidden">
                  <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-2.5 sm:mt-5 [@media(max-height:600px)]:mt-2 [@media(max-height:450px)]:mt-1.5 [@media(max-height:600px)]:gap-1.5 [@media(max-height:450px)]:gap-1">
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={handleBackToLogin}
              disabled={isSubmitting}
              className="w-full gap-2 [@media(max-height:600px)]:h-9 [@media(max-height:600px)]:text-xs [@media(max-height:450px)]:h-8"
            >
              <ArrowLeft className="h-4 w-4 [@media(max-height:600px)]:h-3.5 [@media(max-height:600px)]:w-3.5" />
              Volver a iniciar sesión
            </Button>
            {isSubmitting ? (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-primary/10 px-4 py-2.5 text-xs text-primary sm:text-sm [@media(max-height:600px)]:py-1.5 [@media(max-height:600px)]:text-[11px]">
                <Loader className="h-4 w-4 [@media(max-height:600px)]:h-3 [@media(max-height:600px)]:w-3" />
                Iniciando sesión en la sucursal seleccionada...
              </div>
            ) : null}
          </div>
        </div>

        <p className="pt-1 text-center text-[11px] text-muted-foreground/80 sm:text-[12px] [@media(max-height:600px)]:pt-0.5 [@media(max-height:600px)]:text-[10px] [@media(max-height:500px)]:hidden">
          Rayego POS © 2026. Todos los derechos reservados.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full">
      <style>{`
        #login-logo-wrap { height: 230px; width: 230px; }
        #login-logo-block { margin-bottom: 1rem; }
        #login-version-badge { margin-top: 0.75rem; display: inline-flex; }
        #login-title { font-size: 1.5rem; line-height: 1.2; }
        #login-desc { font-size: 12px; display: block; }
        #login-form-block { margin-top: 1rem; }
        #login-form-block > form { gap: 1rem; }
        #login-card { padding: 1rem; }
        #branch-logo-wrap { height: 220px; width: 220px; }
        #login-card input[type="email"], #login-card input[type="password"], #login-card #email, #login-card #password { height: 44px; font-size: 13px; }
        #login-card button[type="submit"] { height: 44px; font-size: 14px; }
        #remember { height: 20px !important; width: 20px !important; }
        #login-legal { margin-top: 0.75rem; }
        @media (min-width: 640px) {
          #login-logo-wrap { height: 230px; width: 230px; }
          #login-title { font-size: 1.875rem; }
          #login-card { padding: 1.25rem; }
          #login-logo-block { margin-bottom: 1.25rem; }
          #login-form-block { margin-top: 1.25rem; }
          #login-form-block > form { gap: 1rem; }
        }
        @media (min-width: 1024px) {
          #login-card { padding: 1.5rem; }
          #login-logo-block { margin-bottom: 1.25rem; }
        }
        @media (max-height: 900px) {
          #login-logo-wrap { height: 215px; width: 215px; }
        }
        @media (max-height: 880px) {
          #login-demo-alert { display: none !important; }
        }
        @media (max-height: 820px) {
          #login-logo-wrap { height: 210px; width: 210px; }
          #login-logo-block { margin-bottom: 0.75rem; }
          #login-title { font-size: 1.5rem; }
          #login-card { padding: 1rem; }
          #login-form-block { margin-top: 0.75rem; }
          #login-form-block > form { gap: 0.85rem; }
          #login-card input[type="email"], #login-card input[type="password"], #login-card #email, #login-card #password { height: 44px; font-size: 13px; }
          #login-card button[type="submit"] { height: 44px; font-size: 14px; }
          #remember { height: 18px !important; width: 18px !important; }
        }
        @media (max-height: 780px) {
          #login-logo-wrap { height: 210px; width: 210px; }
          #login-logo-block { margin-bottom: 0.625rem; }
          #login-version-badge { margin-top: 0.65rem; }
        }
        @media (max-height: 760px) {
          #login-logo-wrap { height: 208px; width: 208px; }
          #login-logo-block { margin-bottom: 0.55rem; }
          #login-card { padding: 0.8rem; }
          #login-title { font-size: 1.35rem; }
          #login-desc { font-size: 11px; display: block; }
          #login-version-badge { margin-top: 0.6rem; }
          #login-form-block { margin-top: 0.6rem; }
          #login-form-block > form { gap: 0.65rem; }
          #login-card input[type="email"], #login-card input[type="password"], #login-card #email, #login-card #password { height: 42px; font-size: 12.5px; }
          #login-card button[type="submit"] { height: 42px; font-size: 13.5px; }
          #remember { height: 17px !important; width: 17px !important; }
          #login-legal { margin-top: 0.5rem; }
        }
        @media (max-height: 740px) {
          #login-logo-wrap { height: 206px; width: 206px; }
          #login-logo-block { margin-bottom: 0.5rem; }
          #login-card { padding: 0.75rem; }
          #login-title { font-size: 1.28rem; }
          #login-desc { font-size: 10.5px; display: block; }
          #login-version-badge { margin-top: 0.55rem; }
          #login-form-block { margin-top: 0.55rem; }
          #login-form-block > form { gap: 0.6rem; }
          #login-card input[type="email"], #login-card input[type="password"], #login-card #email, #login-card #password { height: 41px; font-size: 12.5px; }
          #login-card button[type="submit"] { height: 41px; font-size: 13px; }
          #remember { height: 17px !important; width: 17px !important; }
          #login-legal { margin-top: 0.45rem; font-size: 10.5px; }
          #branch-logo-wrap { height: 205px; width: 205px; }
        }
        @media (max-height: 720px) {
          #login-logo-wrap { height: 205px; width: 205px; }
          #login-logo-block { margin-bottom: 0.45rem; }
          #login-card { padding: 0.7rem; }
          #login-title { font-size: 1.22rem; }
          #login-desc { font-size: 10.5px; display: block; }
          #login-version-badge { margin-top: 0.5rem; }
          #login-form-block { margin-top: 0.5rem; }
          #login-form-block > form { gap: 0.58rem; }
          #login-card input[type="email"], #login-card input[type="password"], #login-card #email, #login-card #password { height: 40px; font-size: 12.5px; }
          #login-card button[type="submit"] { height: 40px; font-size: 13px; }
          #remember { height: 16px !important; width: 16px !important; }
          #login-legal { margin-top: 0.4rem; font-size: 10.5px; }
          #branch-logo-wrap { height: 205px; width: 205px; }
        }
        @media (max-height: 700px) {
          #login-logo-wrap { height: 204px; width: 204px; }
          #login-logo-block { margin-bottom: 0.4rem; }
          #login-card { padding: 0.65rem; }
          #login-title { font-size: 1.18rem; }
          #login-desc { font-size: 10px; display: block; }
          #login-version-badge { margin-top: 0.48rem; }
          #login-form-block { margin-top: 0.48rem; }
          #login-form-block > form { gap: 0.54rem; }
          #login-card input[type="email"], #login-card input[type="password"], #login-card #email, #login-card #password { height: 39px; font-size: 12px; }
          #login-card button[type="submit"] { height: 39px; font-size: 12.5px; }
          #remember { height: 16px !important; width: 16px !important; }
          #login-legal { margin-top: 0.38rem; font-size: 10px; }
          #branch-logo-wrap { height: 200px; width: 200px; }
        }
        @media (max-height: 680px) {
          #login-logo-wrap { height: 204px; width: 204px; }
          #login-logo-block { margin-bottom: 0.35rem; }
          #login-card { padding: 0.6rem; }
          #login-title { font-size: 1.14rem; }
          #login-desc { font-size: 10px; display: block; }
          #login-version-badge { margin-top: 0.45rem; }
          #login-form-block { margin-top: 0.45rem; }
          #login-form-block > form { gap: 0.52rem; }
          #login-card input[type="email"], #login-card input[type="password"], #login-card #email, #login-card #password { height: 38px; font-size: 12px; }
          #login-card button[type="submit"] { height: 38px; font-size: 12.5px; }
          #remember { height: 15px !important; width: 15px !important; }
          #login-legal { margin-top: 0.35rem; font-size: 10px; }
          #branch-logo-wrap { height: 195px; width: 195px; }
        }
        @media (max-height: 660px) {
          #login-logo-wrap { height: 204px; width: 204px; }
          #login-logo-block { margin-bottom: 0.3rem; }
          #login-card { padding: 0.55rem; }
          #login-title { font-size: 1.1rem; }
          #login-desc { font-size: 9.5px; display: block; line-height: 1.4; }
          #login-version-badge { margin-top: 0.4rem; }
          #login-form-block { margin-top: 0.42rem; }
          #login-form-block > form { gap: 0.5rem; }
          #login-card input[type="email"], #login-card input[type="password"], #login-card #email, #login-card #password { height: 37px; font-size: 11.5px; }
          #login-card button[type="submit"] { height: 37px; font-size: 12px; }
          #remember { height: 15px !important; width: 15px !important; }
          #login-legal { margin-top: 0.32rem; font-size: 9.5px; }
          #branch-logo-wrap { height: 190px; width: 190px; }
        }
        @media (max-height: 640px) {
          #login-logo-wrap { height: 202px; width: 202px; }
          #login-logo-block { margin-bottom: 0.25rem; }
          #login-card { padding: 0.5rem; }
          #login-title { font-size: 1.08rem; }
          #login-desc { font-size: 9.5px; display: block; line-height: 1.35; }
          #login-version-badge { margin-top: 0.35rem; }
          #login-form-block { margin-top: 0.38rem; }
          #login-form-block > form { gap: 0.48rem; }
          #login-card input[type="email"], #login-card input[type="password"], #login-card #email, #login-card #password { height: 36px; font-size: 11.5px; }
          #login-card button[type="submit"] { height: 36px; font-size: 12px; }
          #remember { height: 14px !important; width: 14px !important; }
          #login-legal { margin-top: 0.3rem; font-size: 9px; }
          #login-legal p:first-child { display: none !important; }
          #branch-logo-wrap { height: 185px; width: 185px; }
        }
        @media (max-height: 620px) {
          #login-logo-wrap { height: 200px; width: 200px; }
          #login-logo-block { margin-bottom: 0.22rem; }
          #login-card { padding: 0.48rem; }
          #login-title { font-size: 1.06rem; }
          #login-desc { font-size: 9px; display: block; line-height: 1.3; }
          #login-version-badge { margin-top: 0.32rem; }
          #login-form-block { margin-top: 0.35rem; }
          #login-form-block > form { gap: 0.45rem; }
          #login-card input[type="email"], #login-card input[type="password"], #login-card #email, #login-card #password { height: 36px; font-size: 11px; }
          #login-card button[type="submit"] { height: 36px; font-size: 11.5px; }
          #remember { height: 14px !important; width: 14px !important; }
          #login-legal { margin-top: 0.28rem; font-size: 9px; }
          #login-legal p:first-child { display: none !important; }
          #branch-logo-wrap { height: 180px; width: 180px; }
        }
        @media (max-height: 600px) {
          #login-logo-wrap { height: 170px; width: 170px; }
          #login-logo-block { margin-bottom: 0.5rem; }
          #login-desc { display: block !important; font-size: 10px; }
          #login-title { font-size: 1.1rem; }
          #login-card { padding: 0.7rem; }
          #login-form-block { margin-top: 0.5rem; }
          #login-form-block > form { gap: 0.6rem; }
          #login-card input[type="email"], #login-card input[type="password"], #login-card #email, #login-card #password { height: 40px !important; font-size: 12px; }
          #login-card button[type="submit"] { height: 40px !important; font-size: 12.5px; }
          #remember { height: 16px !important; width: 16px !important; }
          #login-legal p:first-child { display: block !important; }
          #branch-logo-wrap { height: 160px; width: 160px; }
        }
        @media (max-height: 500px) {
          #login-logo-wrap { height: 120px; width: 120px; }
          #login-title { font-size: 1rem; }
          #login-form-block > form { gap: 0.5rem; }
          #login-form-block { margin-top: 0.4rem; }
          #login-desc { display: none !important; }
          #login-version-badge { display: none !important; }
          #login-legal p:first-child { display: none !important; }
        }
        @media (max-height: 450px) {
          #login-logo-wrap { height: 85px; width: 85px; }
          #login-logo-block { margin-bottom: 0.25rem; }
          #login-title { font-size: 1rem; }
          #login-card { padding: 0.5rem; }
          #login-form-block { margin-top: 0.375rem; }
          #login-form-block > form { gap: 0.4rem; }
          #login-card input[type="email"], #login-card input[type="password"], #login-card #email, #login-card #password { height: 36px !important; font-size: 12px !important; }
          #login-card button[type="submit"] { height: 36px !important; font-size: 12px !important; }
          #remember { height: 14px !important; width: 14px !important; }
          #login-version-badge { display: none !important; }
          #login-legal p:first-child { display: none !important; }
        }
        @media (max-height: 400px) {
          #login-logo-wrap { height: 70px; width: 70px; }
          #login-card { padding: 0.35rem; }
          #login-form-block { margin-top: 0.3rem; }
          #login-form-block > form { gap: 0.32rem; }
          #login-card input[type="email"], #login-card input[type="password"], #login-card #email, #login-card #password { height: 32px !important; font-size: 11px !important; }
          #login-card button[type="submit"] { height: 32px !important; font-size: 11px !important; }
          #remember { height: 12px !important; width: 12px !important; }
          #login-version-badge { display: none !important; }
          #login-legal p:first-child { display: none !important; }
        }
        @media (max-height: 380px) {
          #login-logo-wrap { height: 60px; width: 60px; }
          #login-logo-block { margin-bottom: 0.1rem; }
          #login-card { padding: 0.3rem; }
          #login-form-block { margin-top: 0.2rem; }
          #login-form-block > form { gap: 0.28rem; }
          #login-card input[type="email"], #login-card input[type="password"], #login-card #email, #login-card #password { height: 32px !important; font-size: 11px !important; }
          #login-card button[type="submit"] { height: 32px !important; font-size: 11px !important; }
          #remember { height: 12px !important; width: 12px !important; }
          #login-title { font-size: 0.875rem; }
          #login-version-badge { display: none !important; }
          #login-legal p:first-child { display: none !important; }
        }
      `}</style>
      <TooltipProvider delayDuration={100}>
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-2 [@media(max-height:500px)]:gap-1 [@media(max-height:380px)]:gap-0.5">
          <div id="login-card" className="flex min-h-0 flex-col rounded-3xl border border-border/60 bg-white/95 p-4 shadow-2xl shadow-primary/10 backdrop-blur sm:p-5 lg:p-6">
            <div id="login-logo-block" className="mx-auto mb-4 flex flex-col items-center sm:mb-5">
              <div id="login-logo-wrap" className="flex shrink-0 flex-col items-center justify-center overflow-hidden">
                <AppLogo variant="auth" />
              </div>
              <div id="login-version-badge" className="flex items-center gap-2 rounded-full border border-secondary/20 bg-secondary/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-secondary shadow-inner sm:text-[12px]">
                <Zap className="h-3.5 w-3.5 fill-secondary/20" /> v1.0.0
              </div>
            </div>

            <div className="space-y-1 text-center sm:space-y-1.5">
              <h1 id="login-title" className="font-extrabold tracking-tight text-foreground">
                Iniciar sesión
              </h1>
              <p id="login-desc" className="leading-relaxed text-muted-foreground">
                Accede al panel de Rayego POS con tu cuenta
                <br className="hidden sm:block" /> de trabajo.
              </p>
            </div>

            <div id="login-form-block" className="space-y-3.5 sm:space-y-4">
              {demoAccounts.length > 0 ? (
                <Alert
                  id="login-demo-alert"
                  variant="info"
                  className="rounded-xl"
                >
                  <AlertTitle>Credenciales demo</AlertTitle>
                  <AlertDescription className="space-y-2">
                    {demoAccounts.map((account) => (
                      <div
                        key={account.email}
                        className="rounded-xl border border-info/20 bg-white/60 p-2.5 sm:p-3"
                      >
                        <p className="text-sm font-medium text-foreground">
                          {account.session.user.roleName}
                        </p>
                        <p className="text-xs">Correo: {account.email}</p>
                        <p className="text-xs">
                          Contraseña: {account.password}
                        </p>
                      </div>
                    ))}
                  </AlertDescription>
                </Alert>
              ) : null}

              {formError ? (
                <Alert
                  variant="destructive"
                  className="gap-2 rounded-xl py-2.5 sm:py-3 [@media(max-height:600px)]:py-2 [@media(max-height:450px)]:py-1.5 [@media(max-height:380px)]:py-1"
                >
                  <ShieldAlert className="h-4 w-4 shrink-0 [@media(max-height:600px)]:h-3.5 [@media(max-height:600px)]:w-3.5 [@media(max-height:400px)]:h-3 [@media(max-height:400px)]:w-3" />
                  <div className="min-w-0 space-y-0.5">
                    <AlertTitle className="text-sm font-semibold [@media(max-height:600px)]:text-xs [@media(max-height:400px)]:text-[11px]">
                      No se pudo iniciar sesión
                    </AlertTitle>
                    <AlertDescription className="text-[13px] leading-relaxed [@media(max-height:780px)]:text-[12px] [@media(max-height:600px)]:text-[11px] [@media(max-height:400px)]:text-[10px]">
                      {formError}
                    </AlertDescription>
                  </div>
                </Alert>
              ) : null}

              <form
                className="space-y-3.5 sm:space-y-4 [@media(max-height:780px)]:space-y-3 [@media(max-height:600px)]:space-y-2 [@media(max-height:450px)]:space-y-1.5 [@media(max-height:380px)]:space-y-1"
                onSubmit={form.handleSubmit(onSubmit)}
              >
                <div className="space-y-1.5 sm:space-y-2 [@media(max-height:600px)]:space-y-1 [@media(max-height:450px)]:space-y-0.5 [@media(max-height:380px)]:space-y-0.5">
                  <Label
                    htmlFor="email"
                    className="text-[12px] font-semibold text-foreground sm:text-[13px] [@media(max-height:600px)]:text-[11px] [@media(max-height:400px)]:text-[10px]"
                  >
                    Correo corporativo
                  </Label>
                  <div className="relative">
                    <Mail
                      aria-hidden
                      className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-muted-foreground sm:h-[18px] sm:w-[18px] [@media(max-height:600px)]:h-4 [@media(max-height:600px)]:w-4 [@media(max-height:450px)]:h-3.5 [@media(max-height:450px)]:w-3.5 [@media(max-height:400px)]:h-3 [@media(max-height:400px)]:w-3"
                    />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="tucorreo@rayego.pe"
                      className="h-11 pl-10 pr-3 text-[13px] rounded-xl border-muted/80 bg-muted/20 transition-all focus-visible:ring-2 focus-visible:ring-primary/70 sm:h-12 sm:pl-11 sm:text-[14px] [@media(max-height:600px)]:h-10 [@media(max-height:600px)]:pl-9 [@media(max-height:450px)]:h-9 [@media(max-height:450px)]:text-[12px] [@media(max-height:400px)]:h-8 [@media(max-height:400px)]:pl-8 [@media(max-height:400px)]:text-[11px]"
                      {...form.register('email')}
                    />
                  </div>
                  {form.formState.errors.email ? (
                    <p className="text-caption text-destructive [@media(max-height:600px)]:text-[10px] [@media(max-height:400px)]:text-[9px]">
                      {form.formState.errors.email.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5 sm:space-y-2 [@media(max-height:600px)]:space-y-1 [@media(max-height:450px)]:space-y-0.5 [@media(max-height:380px)]:space-y-0.5">
                  <div className="flex items-center justify-between gap-3">
                    <Label
                      htmlFor="password"
                      className="text-[12px] font-semibold text-foreground sm:text-[13px] [@media(max-height:600px)]:text-[11px] [@media(max-height:400px)]:text-[10px]"
                    >
                      Contraseña
                    </Label>
                    <Link
                      to={paths.forgotPassword}
                      className="text-[11px] font-semibold text-primary transition-colors hover:text-primary/80 hover:underline hover:underline-offset-2 sm:text-[12px] [@media(max-height:600px)]:text-[10px] [@media(max-height:500px)]:text-[9px] [@media(max-height:400px)]:text-[8px]"
                    >
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>
                  <div className="relative">
                    <LockKeyhole
                      aria-hidden
                      className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-muted-foreground sm:h-[18px] sm:w-[18px] [@media(max-height:600px)]:h-4 [@media(max-height:600px)]:w-4 [@media(max-height:450px)]:h-3.5 [@media(max-height:450px)]:w-3.5 [@media(max-height:400px)]:h-3 [@media(max-height:400px)]:w-3"
                    />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••••••"
                      className="h-11 pl-10 pr-12 text-[13px] rounded-xl border-muted/80 bg-muted/20 transition-all focus-visible:ring-2 focus-visible:ring-primary/70 sm:h-12 sm:pl-11 sm:text-[14px] [@media(max-height:600px)]:h-10 [@media(max-height:600px)]:pl-9 [@media(max-height:450px)]:h-9 [@media(max-height:450px)]:text-[12px] [@media(max-height:400px)]:h-8 [@media(max-height:400px)]:pl-8 [@media(max-height:400px)]:text-[11px]"
                      {...form.register('password')}
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={
                            showPassword
                              ? 'Ocultar contraseña'
                              : 'Mostrar contraseña'
                          }
                          aria-pressed={showPassword}
                          tabIndex={0}
                          onClick={() =>
                            setShowPassword((prev) => !prev)
                          }
                          className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-1 sm:h-9 sm:w-9 [@media(max-height:600px)]:h-7 [@media(max-height:600px)]:w-7 [@media(max-height:450px)]:h-6 [@media(max-height:450px)]:w-6 [@media(max-height:400px)]:h-5 [@media(max-height:400px)]:w-5"
                        >
                          {showPassword ? (
                            <EyeOff
                              aria-hidden
                              className="h-[17px] w-[17px] sm:h-[18px] sm:w-[18px] [@media(max-height:600px)]:h-4 [@media(max-height:600px)]:w-4 [@media(max-height:450px)]:h-3.5 [@media(max-height:450px)]:w-3.5 [@media(max-height:400px)]:h-3 [@media(max-height:400px)]:w-3"
                            />
                          ) : (
                            <Eye
                              aria-hidden
                              className="h-[17px] w-[17px] sm:h-[18px] sm:w-[18px] [@media(max-height:600px)]:h-4 [@media(max-height:600px)]:w-4 [@media(max-height:450px)]:h-3.5 [@media(max-height:450px)]:w-3.5 [@media(max-height:400px)]:h-3 [@media(max-height:400px)]:w-3"
                            />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        align="end"
                        sideOffset={6}
                        className="text-[12px]"
                      >
                        <p>
                          {showPassword
                            ? 'Ocultar contraseña'
                            : 'Mostrar contraseña'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {form.formState.errors.password ? (
                    <p className="text-caption text-destructive [@media(max-height:600px)]:text-[10px] [@media(max-height:400px)]:text-[9px]">
                      {form.formState.errors.password.message}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-start gap-2.5 pt-0.5 sm:gap-3 sm:pt-1 [@media(max-height:600px)]:gap-1.5 [@media(max-height:600px)]:pt-0 [@media(max-height:450px)]:gap-1 [@media(max-height:400px)]:gap-0.5 [@media(max-height:380px)]:gap-0.5">
                  <Controller
                    control={form.control}
                    name="remember"
                    render={({ field }) => (
                      <Checkbox
                        id="remember"
                        checked={field.value}
                        onCheckedChange={(checked) =>
                          field.onChange(checked === true)
                        }
                        className="mt-0.5 h-5 w-5 rounded-md border-primary/60 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground [@media(max-height:600px)]:h-4 [@media(max-height:600px)]:w-4 [@media(max-height:450px)]:h-3.5 [@media(max-height:450px)]:w-3.5 [@media(max-height:400px)]:h-3 [@media(max-height:400px)]:w-3"
                      />
                    )}
                  />
                  <Label
                    htmlFor="remember"
                    className="cursor-pointer select-none text-[12px] leading-snug text-muted-foreground sm:text-[13px] [@media(max-height:600px)]:text-[11px] [@media(max-height:450px)]:text-[10px] [@media(max-height:400px)]:text-[9px]"
                  >
                    Mantener sesión iniciada en este dispositivo
                  </Label>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={isSubmitting}
                  className="h-11 w-full gap-2 rounded-xl text-[14px] font-semibold text-primary-foreground transition-all duration-200
                    bg-gradient-to-r from-primary via-primary to-primary/90
                    shadow-lg shadow-primary/20
                    hover:-translate-y-0.5 hover:from-primary hover:via-primary/95 hover:to-primary/85 hover:shadow-xl hover:shadow-primary/25
                    active:translate-y-0 active:scale-[0.99] active:shadow-md
                    disabled:opacity-75 disabled:hover:translate-y-0 disabled:hover:scale-100
                    sm:h-12 sm:text-[15px] [@media(max-height:600px)]:h-10 [@media(max-height:600px)]:text-[13px] [@media(max-height:450px)]:h-9 [@media(max-height:450px)]:text-[12px] [@media(max-height:400px)]:h-8 [@media(max-height:400px)]:text-[11px]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader className="h-4 w-4 text-current [@media(max-height:600px)]:h-3.5 [@media(max-height:600px)]:w-3.5 [@media(max-height:400px)]:h-3 [@media(max-height:400px)]:w-3" />
                      <span>Ingresando...</span>
                    </>
                  ) : (
                    <>
                      <span>Ingresar</span>
                      <ArrowRight className="h-[17px] w-[17px] sm:h-[18px] sm:w-[18px] [@media(max-height:600px)]:h-4 [@media(max-height:600px)]:w-4 [@media(max-height:450px)]:h-3.5 [@media(max-height:450px)]:w-3.5 [@media(max-height:400px)]:h-3 [@media(max-height:400px)]:w-3" />
                    </>
                  )}
                </Button>
              </form>
            </div>

            <div id="login-legal" className="mt-3 space-y-0.5 text-center [@media(max-height:780px)]:mt-2 [@media(max-height:720px)]:mt-1.5 [@media(max-height:650px)]:mt-0.5">
              <p className="hidden text-[11px] text-muted-foreground/90 sm:block [@media(max-height:780px)]:hidden [@media(max-height:760px)]:block [@media(max-height:720px)]:text-[10.5px] [@media(max-height:700px)]:text-[10px] [@media(max-height:650px)]:hidden">
                Sistema de gestión para boticas y farmacias
              </p>
              <p className="text-[11px] font-medium text-muted-foreground/90 sm:text-[12px] [@media(max-height:768px)]:text-[11px] [@media(max-height:700px)]:text-[10.5px] [@media(max-height:650px)]:text-[10px] [@media(max-height:500px)]:text-[9px] [@media(max-height:400px)]:hidden">
                Rayego POS © 2026. Todos los derechos reservados.
              </p>
            </div>
          </div>
        </div>
      </TooltipProvider>
    </div>
  )
}
