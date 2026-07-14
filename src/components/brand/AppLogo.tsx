import { cn } from '@/lib/utils'
import { BrandSeal } from '@/components/brand/BrandSeal'

type AppLogoProps = {
  variant: 'sidebar' | 'auth'
}

export function AppLogo({ variant }: AppLogoProps) {
  const isSidebar = variant === 'sidebar'

  return (
    <div className={cn('flex items-center', isSidebar ? 'gap-3' : 'flex-col gap-4 text-center')}>
      <div
        className={cn(
          'shrink-0 overflow-hidden rounded-2xl',
          isSidebar
            ? 'bg-white/95 p-1.5 shadow-softSm ring-1 ring-primary-foreground/10'
            : 'bg-white p-2 shadow-soft ring-1 ring-border',
        )}
      >
        <BrandSeal className={isSidebar ? 'h-14 w-14' : 'h-32 w-32'} />
      </div>

      <div className="leading-tight">
        <div
          className={cn(
            'font-semibold',
            isSidebar ? 'text-sm text-primary-foreground' : 'text-xl text-foreground',
          )}
        >
          Rayego POS
        </div>
        <div
          className={cn(
            'text-xs',
            isSidebar ? 'text-primary-foreground/75' : 'text-muted-foreground',
          )}
        >
          Botica &amp; Farmacia
        </div>
      </div>
    </div>
  )
}
