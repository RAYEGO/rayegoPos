import { Link, Outlet } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { BrandSeal } from '@/components/brand/BrandSeal'
import { paths } from '@/routes/paths'

export function PublicLayout() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link to={paths.landing} className="flex items-center gap-3">
            <div className="rounded-xl bg-white p-1.5 shadow-softSm ring-1 ring-border">
              <BrandSeal className="h-8 w-8" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-foreground">Rayego POS</div>
              <div className="text-xs text-muted-foreground">Botica &amp; Farmacia</div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link to={paths.login}>Iniciar sesión</Link>
            </Button>
            <Button asChild>
              <Link to={paths.register}>Crear mi empresa</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-6">
        <Outlet />
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:px-6">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>Rayego POS</div>
            <div>Hecho para boticas y farmacias en Perú</div>
          </div>
        </div>
      </footer>
    </div>
  )
}

