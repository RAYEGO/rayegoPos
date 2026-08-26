import * as React from 'react'
import { cn } from '@/lib/utils'

export type ScrollAreaProps = React.HTMLAttributes<HTMLDivElement> & {
  viewportRef?: React.RefObject<HTMLDivElement | null>
  viewportClassName?: string
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, viewportClassName, viewportRef, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('relative overflow-hidden', className)}
      {...props}
    >
      <div
        ref={viewportRef}
        className={cn(
          'h-full w-full overflow-y-auto overscroll-contain',
          'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30 hover:scrollbar-thumb-muted-foreground/50',
          viewportClassName,
        )}
      >
        {children}
      </div>
    </div>
  ),
)
ScrollArea.displayName = 'ScrollArea'

export { ScrollArea }
