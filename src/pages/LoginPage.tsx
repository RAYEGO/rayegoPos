import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Loader } from '@/components/ui/loader'
import { useAuth } from '@/hooks/useAuth'
import { AuthScreenHeader } from '@/modules/auth/AuthScreenHeader'
import {
  loginSchema,
  type LoginSchemaValues,
} from '@/modules/auth/schemas'
import { paths } from '@/routes/paths'
import { BranchSelectionRequiredError, authService } from '@/services/authService'
import type { AuthBranch } from '@/types/auth'
import { ArrowLeft, Building2, MapPin, Store } from 'lucide-react'

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
  const [pendingCredentials, setPendingCredentials] = useState<LoginSchemaValues | null>(null)
  const [isSelectingBranch, setIsSelectingBranch] = useState(false)
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

  async function submitWithBranch(values: LoginSchemaValues, branchId?: string) {
    try {
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
      toast.error(
        error instanceof Error ? error.message : 'No se pudo iniciar sesión.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function onSubmit(values: LoginSchemaValues) {
    await submitWithBranch(values)
  }

  async function handleBranchSelect(branchId: string) {
    if (!pendingCredentials) return
    await submitWithBranch(pendingCredentials, branchId)
  }

  function handleBackToLogin() {
    setIsSelectingBranch(false)
    setAvailableBranches([])
    setPendingCredentials(null)
  }

  if (isSelectingBranch && availableBranches.length > 0) {
    return (
      <div className="space-y-8">
        <AuthScreenHeader
          title="Selecciona tu sucursal"
          description={`Hola ${pendingCredentials?.email ?? ''}. Tu cuenta tiene acceso a varias sucursales activas.`}
        />

        <div className="space-y-3">
          {availableBranches.map((branch) => (
            <button
              key={branch.id}
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleBranchSelect(branch.id)}
              className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-background p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                <Store className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-lg font-semibold text-foreground">
                    {branch.name}
                  </p>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {branch.code}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  <span className="truncate">{branch.companyName}</span>
                </div>
              </div>
              <div className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                <MapPin className="h-5 w-5" />
              </div>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={handleBackToLogin}
            disabled={isSubmitting}
            className="w-full gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a iniciar sesión
          </Button>
          {isSubmitting ? (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-primary/10 px-4 py-3 text-sm text-primary">
              <Loader className="h-4 w-4" />
              Iniciando sesión en la sucursal seleccionada...
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AuthScreenHeader
        title="Iniciar sesión"
        description="Accede al panel de Rayego POS con tu cuenta de trabajo."
      />

      {demoAccounts.length > 0 ? (
        <Alert variant="info">
          <AlertTitle>Credenciales demo</AlertTitle>
          <AlertDescription className="space-y-3">
            {demoAccounts.map((account) => (
              <div key={account.email} className="rounded-xl border border-info/20 bg-white/60 p-3">
                <p className="font-medium text-foreground">{account.session.user.roleName}</p>
                <p>Correo: {account.email}</p>
                <p>Contraseña: {account.password}</p>
              </div>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}

      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <label className="text-small font-medium text-foreground" htmlFor="email">
            Correo corporativo
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="admin@rayego.pe"
            {...form.register('email')}
          />
          {form.formState.errors.email ? (
            <p className="text-caption text-destructive">
              {form.formState.errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <label
              className="text-small font-medium text-foreground"
              htmlFor="password"
            >
              Contraseña
            </label>
            <Link
              to={paths.forgotPassword}
              className="text-small font-medium text-primary hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Ingresa tu contraseña"
            {...form.register('password')}
          />
          {form.formState.errors.password ? (
            <p className="text-caption text-destructive">
              {form.formState.errors.password.message}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <Controller
            control={form.control}
            name="remember"
            render={({ field }) => (
              <Checkbox
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                id="remember"
              />
            )}
          />
          <label className="text-small text-muted-foreground" htmlFor="remember">
            Mantener sesión iniciada en este dispositivo
          </label>
        </div>

        <Button className="w-full" size="lg" type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader className="h-4 w-4 text-current" />
              Validando acceso...
            </>
          ) : (
            'Ingresar'
          )}
        </Button>
      </form>
    </div>
  )
}
