import { AlertTriangle, Clock, LogIn } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useInactivityContext } from '@/contexts/InactivityProvider'

export function SessionWarningModal() {
  const {
    status,
    warningCountdownSeconds,
    acknowledgeWarning,
    pendingOperation,
    settings,
    refreshSession,
    markExpired,
  } = useInactivityContext()

  const open = status === 'warning'

  const handleContinue = async () => {
    try {
      await refreshSession()
    } catch {
    } finally {
      acknowledgeWarning()
    }
  }

  const handleLogoutNow = () => {
    markExpired({
      reason: 'manual-logout',
      message: 'El usuario solicitó cerrar sesión desde el aviso de inactividad.',
    })
  }

  return open ? (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md [&>button[type='button'][aria-label='Cerrar']]:hidden"
        onInteractOutside={(e) => {
          e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault()
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold">
                Tu sesión está por expirar
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm">
                Por inactividad, tu sesión de Rayego POS se cerrará automáticamente.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
              <Clock className="h-4 w-4" aria-hidden="true" />
              Cierre automático en
              <span
                className="inline-flex min-w-[3rem] items-center justify-center rounded-md bg-amber-600 px-2 py-0.5 font-mono text-base font-bold text-white"
                aria-live="polite"
                aria-atomic="true"
              >
                {warningCountdownSeconds}s
              </span>
            </div>
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300/90">
              Si deseas seguir trabajando, pulsa &ldquo;Continuar trabajando&rdquo; antes de que
              termine el conteo.
            </p>
          </div>

          {pendingOperation ? (
            <div className="rounded-lg border border-dashed border-rose-200 bg-rose-50/70 p-3 dark:border-rose-500/30 dark:bg-rose-500/10">
              <p className="text-xs font-semibold text-rose-700 dark:text-rose-200">
                Tienes una operación en curso: {pendingOperation.label}
              </p>
              <p className="mt-1 text-xs text-rose-600/90 dark:text-rose-300/90">
                Si la sesión se cierra, intentaremos recuperarla después de que vuelvas a iniciar
                sesión.
              </p>
            </div>
          ) : null}

          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>
              · Tiempo límite de inactividad: {Math.round(settings.idleTimeoutMs / 60000)} minutos
            </li>
            <li>
              · Cualquier clic, escritura, scroll o selección cuenta como actividad y reinicia el
              temporizador.
            </li>
          </ul>
        </div>

        <DialogFooter className="mt-2 flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={handleLogoutNow}
            className="justify-start gap-2 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Cerrar sesión ahora
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={handleContinue}
              className="gap-2 shadow-sm"
              autoFocus
            >
              Continuar trabajando
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null
}
