import { cn } from '@/lib/utils'

type AppLogoProps = {
  variant: 'sidebar' | 'auth'
  className?: string
}

export function AppLogo({ variant, className }: AppLogoProps) {
  const isSidebar = variant === 'sidebar'

  return (
    <div
      className={cn(
        'flex items-center',
        isSidebar ? 'gap-3' : 'flex-col gap-2 text-center',
        className,
      )}
    >
      <div
        className={cn(
          'shrink-0 overflow-hidden rounded-2xl',
          isSidebar
            ? 'bg-white/95 p-1.5 shadow-softSm ring-1 ring-primary-foreground/10'
            : 'hidden',
        )}
      >
        <img
          src="/rayego-isotipo.png"
          alt="Isotipo Rayego POS"
          className={cn('h-12 w-12 rounded-xl object-contain')}
        />
      </div>

      <div
        className={cn(
          'flex overflow-hidden rounded-2xl',
          isSidebar ? 'hidden' : 'h-[128px] w-full max-w-[280px] justify-center',
        )}
      >
        <img
          src="/rayego-logo.png"
          alt="Logo Rayego POS Botica y Farmacia"
          className={cn(
            'h-full w-full object-contain',
            isSidebar ? 'hidden' : '',
          )}
        />
      </div>

      {isSidebar && (
        <div className="leading-tight">
          <div className="text-sm font-semibold text-primary-foreground">
            Rayego POS
          </div>
          <div className="text-xs text-primary-foreground/75">
            Botica &amp; Farmacia
          </div>
        </div>
      )}
    </div>
  )
}
