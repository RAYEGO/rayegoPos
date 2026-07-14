import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader } from '@/components/ui/loader'
import { useAuth } from '@/hooks/useAuth'
import { AuthScreenHeader } from '@/modules/auth/AuthScreenHeader'
import {
  resetPasswordSchema,
  type ResetPasswordSchemaValues,
} from '@/modules/auth/schemas'
import { paths } from '@/routes/paths'

export function ResetPasswordPage() {
  const { resetPassword } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const token = useMemo(() => searchParams.get('token') ?? '', [searchParams])

  const form = useForm<ResetPasswordSchemaValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  })

  async function onSubmit(values: ResetPasswordSchemaValues) {
    try {
      setIsSubmitting(true)
      await resetPassword({ token, password: values.password })
      setIsSuccess(true)
      toast.success('Tu contraseña fue actualizada correctamente.')
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'No se pudo restablecer la contraseña.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <AuthScreenHeader
        title="Restablecer contraseña"
        description="Define una nueva contraseña segura para tu cuenta."
      />

      {token === '' ? (
        <Alert variant="warning">
          <AlertTitle>Enlace incompleto</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>Necesitas un token de recuperación válido para continuar.</p>
            <Link
              to={paths.forgotPassword}
              className="text-small font-medium text-primary hover:underline"
            >
              Solicitar nuevo enlace
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      {isSuccess ? (
        <Alert variant="success">
          <AlertTitle>Contraseña actualizada</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>Tu acceso ya está listo. Ahora puedes volver al login.</p>
            <Button type="button" onClick={() => navigate(paths.login, { replace: true })}>
              Ir al inicio de sesión
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <label
              className="text-small font-medium text-foreground"
              htmlFor="password"
            >
              Nueva contraseña
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Nueva contraseña"
              disabled={token === ''}
              {...form.register('password')}
            />
            {form.formState.errors.password ? (
              <p className="text-caption text-destructive">
                {form.formState.errors.password.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label
              className="text-small font-medium text-foreground"
              htmlFor="confirmPassword"
            >
              Confirmar contraseña
            </label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Repite la nueva contraseña"
              disabled={token === ''}
              {...form.register('confirmPassword')}
            />
            {form.formState.errors.confirmPassword ? (
              <p className="text-caption text-destructive">
                {form.formState.errors.confirmPassword.message}
              </p>
            ) : null}
          </div>

          <Button
            className="w-full"
            size="lg"
            type="submit"
            disabled={isSubmitting || token === ''}
          >
            {isSubmitting ? (
              <>
                <Loader className="h-4 w-4 text-current" />
                Actualizando contraseña...
              </>
            ) : (
              'Guardar nueva contraseña'
            )}
          </Button>
        </form>
      )}

      <div className="text-center">
        <Link to={paths.login} className="text-small font-medium text-primary hover:underline">
          Volver al inicio de sesión
        </Link>
      </div>
    </div>
  )
}

