import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { paths } from '@/routes/paths'

export function ForbiddenPage() {
  return (
    <div className="flex min-h-[calc(100dvh-8rem)] items-center justify-center px-6">
      <div className="w-full max-w-xl rounded-3xl border bg-card p-8 shadow-soft">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/15 text-warning">
          <ShieldAlert className="h-7 w-7" />
        </div>

        <div className="space-y-3">
          <p className="text-small font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Acceso restringido
          </p>
          <h1 className="text-h2">No tienes permiso para entrar a esta sección.</h1>
          <p className="text-body text-muted-foreground">
            Tu sesión está activa, pero este módulo requiere permisos o roles
            adicionales. Cuando conectemos el backend, esta misma arquitectura
            trabajará con permisos reales.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link to={paths.dashboard}>Volver al dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={paths.login}>Cambiar de usuario</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

