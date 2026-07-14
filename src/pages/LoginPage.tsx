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
import { authService } from '@/services/authService'

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

  async function onSubmit(values: LoginSchemaValues) {
    try {
      setIsSubmitting(true)
      await login(values)
      toast.success('Bienvenido a Rayego POS.')
      navigate(redirectTo, { replace: true })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo iniciar sesión.',
      )
    } finally {
      setIsSubmitting(false)
    }
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
