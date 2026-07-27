import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthScreenHeader } from '@/modules/auth/AuthScreenHeader'
import { paths } from '@/routes/paths'

export function RegisterPage() {
  return (
    <div className="space-y-6">
      <AuthScreenHeader
        title="Crear mi empresa"
        description="Registro de empresa disponible próximamente. Por ahora, esta pantalla define la interfaz y el flujo."
      />

      <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
        <div className="space-y-2">
          <label className="text-small font-medium text-foreground" htmlFor="companyName">
            Razón social
          </label>
          <Input id="companyName" placeholder="Botica R&M SAC" disabled />
        </div>

        <div className="space-y-2">
          <label className="text-small font-medium text-foreground" htmlFor="ruc">
            RUC
          </label>
          <Input id="ruc" placeholder="20123456789" disabled />
        </div>

        <div className="space-y-2">
          <label className="text-small font-medium text-foreground" htmlFor="adminEmail">
            Correo del administrador
          </label>
          <Input id="adminEmail" type="email" placeholder="admin@botica.pe" disabled />
        </div>

        <div className="space-y-2">
          <label className="text-small font-medium text-foreground" htmlFor="password">
            Contraseña
          </label>
          <Input id="password" type="password" placeholder="••••••••" disabled />
        </div>

        <Button className="w-full" size="lg" type="submit" disabled>
          Crear empresa (próximamente)
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{' '}
          <Link className="font-medium text-primary hover:underline" to={paths.login}>
            Inicia sesión
          </Link>
        </p>
      </form>
    </div>
  )
}

