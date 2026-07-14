import { RoleBadge } from '@/components/auth/RoleBadge'
import { Bell, LogOut, Search, UserCircle2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { paths } from '@/routes/paths'

export function Topbar() {
  const navigate = useNavigate()
  const { session, logout } = useAuth()

  async function handleLogout() {
    await logout()
    toast.success('Sesión cerrada correctamente.')
    navigate(paths.login, { replace: true })
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-4 px-6">
        <div className="min-w-0 flex-1" />

        <div className="hidden w-[420px] max-w-[42vw] items-center lg:flex">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar en Rayego POS (próximamente)" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" aria-label="Notificaciones">
            <Bell />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" className="gap-2">
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
                      {session?.user.branchName}
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
