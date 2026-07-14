import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader } from '@/components/ui/loader'
import { useAuth } from '@/hooks/useAuth'
import { AuthScreenHeader } from '@/modules/auth/AuthScreenHeader'
import {
  forgotPasswordSchema,
  type ForgotPasswordSchemaValues,
} from '@/modules/auth/schemas'
import { paths } from '@/routes/paths'
import type { ForgotPasswordResult } from '@/types/auth'

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<ForgotPasswordResult | null>(null)

  const form = useForm<ForgotPasswordSchemaValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  })

  async function onSubmit(values: ForgotPasswordSchemaValues) {
    try {
      setIsSubmitting(true)
      const response = await requestPasswordReset(values)
      setResult(response)
      toast.success('Te enviamos instrucciones para recuperar tu acceso.')
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'No se pudo iniciar la recuperación de contraseña.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <AuthScreenHeader
        title="Recuperar contraseña"
        description="Ingresa tu correo y prepararemos el flujo para restablecer tu acceso."
      />

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

        <Button className="w-full" size="lg" type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader className="h-4 w-4 text-current" />
              Preparando recuperación...
            </>
          ) : (
            'Enviar instrucciones'
          )}
        </Button>
      </form>

      {result ? (
        <Alert variant="success">
          <AlertTitle>Enlace de recuperación generado</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              Si la cuenta existe, el flujo de recuperación ya fue preparado para{' '}
              <strong>{result.email}</strong>.
            </p>
            {result.resetToken ? (
              <Button asChild variant="secondary">
                <Link to={`${paths.resetPassword}?token=${result.resetToken}`}>
                  Continuar con el restablecimiento
                </Link>
              </Button>
            ) : (
              <p className="text-small text-muted-foreground">
                En producción este token se enviará por correo y no se expondrá en la interfaz.
              </p>
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="text-center">
        <Link to={paths.login} className="text-small font-medium text-primary hover:underline">
          Volver al inicio de sesión
        </Link>
      </div>
    </div>
  )
}
