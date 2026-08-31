import { useEffect, useState } from 'react'
import { RoleBadge } from '@/components/auth/RoleBadge'
import { Bell, Building2, Globe2, LogOut, Menu, Search, UserCircle2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { useAuthorization } from '@/hooks/useAuthorization'
import { paths } from '@/routes/paths'
import { getEnvironmentBadge, systemService, type EnvironmentMode } from '@/services/systemService'

type TopbarProps = {
  onOpenNavigation: () => void
}

type EnvironmentStatus = {
  kind: ReturnType<typeof getEnvironmentBadge>['kind']
  label: string
  mode: EnvironmentMode
}

const statusCache: { value: EnvironmentStatus | null; expiresAt: number } = { value: null, expiresAt: 0 }

function useEnvironmentStatus(accessToken?: string, authenticated = false): EnvironmentStatus | null {
  const [status, setStatus] = useState<EnvironmentStatus | null>(null)

  useEffect(() => {
    if (!authenticated) {
      setStatus(null)
      return
    }
    const now = Date.now()
    if (statusCache.value && now < statusCache.expiresAt) {
      setStatus(statusCache.value)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const env = await systemService.getEnvironment(accessToken ? { accessToken } : undefined)
        if (cancelled) return
        const badge = getEnvironmentBadge(env.environment)
        const next: EnvironmentStatus = { kind: badge.kind, label: badge.label, mode: env.environment }
        statusCache.value = next
        statusCache.expiresAt = Date.now() + 60 * 1000
        setStatus(next)
      } catch {
        if (cancelled) return
        const fallback: EnvironmentStatus = { kind: 'unknown', label: '—', mode: 'unknown' }
        statusCache.value = fallback
        statusCache.expiresAt = Date.now() + 15 * 1000
        setStatus(fallback)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [accessToken, authenticated])

  return status
}

export function Topbar({ onOpenNavigation }: TopbarProps) {
  const navigate = useNavigate()
  const { session, logout } = useAuth()
  const { hasRole } = useAuthorization()
  const isPlatformAdmin = hasRole('ADMIN_POS')
  const environmentStatus = useEnvironmentStatus(session?.accessToken, Boolean(session?.accessToken))

  async function handleLogout() {
    await logout('Topbar.handleLogout')
    toast.success('Sesión cerrada correctamente.')
    navigate(paths.login, { replace: true })
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Abrir menú principal"
            onClick={onOpenNavigation}
          >
            <Menu />
          </Button>

          <div className="lg:hidden leading-tight">
            <div className="text-sm font-semibold text-foreground">Rayego POS</div>
            <div className="text-xs text-muted-foreground">Botica &amp; Farmacia</div>
          </div>
        </div>

        <div className="hidden w-[420px] max-w-[42vw] items-center lg:flex">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar en Rayego POS (próximamente)" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {environmentStatus ? (
            <div
              className={
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ' +
                (environmentStatus.kind === 'prod'
                  ? 'bg-rose-500/10 text-rose-700 ring-rose-500/30 dark:text-rose-300'
                  : environmentStatus.kind === 'dev'
                    ? 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300'
                    : environmentStatus.kind === 'other'
                      ? 'bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300'
                      : 'bg-muted text-muted-foreground ring-muted')
              }
              aria-label={`Entorno: ${environmentStatus.label}`}
            >
              <span
                aria-hidden
                className={
                  'inline-block h-2 w-2 rounded-full ' +
                  (environmentStatus.kind === 'prod'
                    ? 'bg-rose-500'
                    : environmentStatus.kind === 'dev'
                      ? 'bg-emerald-500'
                      : environmentStatus.kind === 'other'
                        ? 'bg-amber-500'
                        : 'bg-muted-foreground')
                }
              />
              <span className="inline-flex items-center gap-1">
                {environmentStatus.kind === 'prod' ? '🔴' : environmentStatus.kind === 'dev' ? '🟢' : environmentStatus.kind === 'other' ? '🟡' : '⚪️'}
                {environmentStatus.label}
              </span>
            </div>
          ) : null}
          {isPlatformAdmin ? (
            <div className="hidden items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary sm:flex">
              <Globe2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate font-medium">Rayego POS · Administración de plataforma</span>
            </div>
          ) : session?.user.companyName || session?.user.branchName ? (
            <div className="hidden items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground sm:flex">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {session.user.companyName ?? '—'}
                {session.user.branchName ? ` · ${session.user.branchName}` : ''}
              </span>
            </div>
          ) : null}
          {session?.user.roleName ? (
            <div className="hidden items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground md:flex">
              <span className="truncate">{session.user.roleName}</span>
            </div>
          ) : null}
          <Button type="button" variant="ghost" size="icon" aria-label="Notificaciones">
            <Bell />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" className="gap-2 px-2 sm:px-3">
                <UserCircle2 />
                <span className="hidden text-sm font-medium md:inline">
                  {session?.user.fullName ?? 'Usuario'}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div className="space-y-1">
                  <div className="text-sm font-semibold">{session?.user.fullName}</div>
                  <div className="flex items-center gap-2">
                    {session?.user.roles[0] ? <RoleBadge role={session.user.roles[0]} /> : null}
                    <span className="text-xs text-muted-foreground">
                      {isPlatformAdmin
                        ? 'Administración de plataforma'
                        : session?.user.companyName
                          ? session.user.companyName + (session.user.branchName ? ` · ${session.user.branchName}` : '')
                          : ''}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>Mi cuenta (próximamente)</DropdownMenuItem>
              <DropdownMenuItem disabled>Preferencias (próximamente)</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault()
                  void handleLogout()
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

export { Topbar as default }
