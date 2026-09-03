import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export type DialogProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>
export function Dialog({ modal = true, ...props }: DialogProps) {
  return <DialogPrimitive.Root modal={modal} {...props} />
}

export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const DialogPortal = DialogPrimitive.Portal

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px] animate-in fade-in-0',
      className,
    )}
    {...props}
  />
))

DialogOverlay.displayName = 'DialogOverlay'

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, onPointerDownOutside, onEscapeKeyDown, ...props }, ref) => {
  const selfRef = React.useRef<HTMLElement | null>(null)
  const setRefs = React.useCallback(
    (node: HTMLElement | null) => {
      selfRef.current = node
      if (typeof ref === 'function') {
        ;(ref as any)(node)
      } else if (ref) {
        ;(ref as React.MutableRefObject<HTMLElement | null>).current = node
      }
    },
    [ref],
  )
  const hasAnyOpenNestedDialog = React.useCallback(() => {
    if (typeof document === 'undefined') return false
    const self = selfRef.current
    const candidateRoots = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-radix-dialog-root][data-state="open"], [role="dialog"][data-state="open"]',
      ),
    )
    const container = document.body
    for (const el of candidateRoots) {
      if (!container.contains(el)) continue
      if (el === self) continue
      if (self && el.contains(self)) continue
      return true
    }
    return false
  }, [])
  const eventTargetLivesInTemporaryOverlay = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false
    const portalAncestor = target.closest<HTMLElement>(
      '[data-radix-popper-content-wrapper], [data-radix-dropdown-menu-content], [data-radix-tooltip-content], [data-radix-popover-content], [data-radix-hover-card-content]',
    )
    return Boolean(portalAncestor)
  }
  return (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={setRefs as any}
      className={cn(
        'fixed left-1/2 top-1/2 z-[60] grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-popover p-6 text-popover-foreground shadow-soft animate-in fade-in-0 zoom-in-95',
        className,
      )}
      onPointerDownOutside={(event) => {
        if (eventTargetLivesInTemporaryOverlay(event.target)) {
          event.preventDefault()
          return
        }
        const target = event.target as HTMLElement | null
        if (target && target.closest('[data-radix-popper-content-wrapper]')) {
          event.preventDefault()
          return
        }
        if (hasAnyOpenNestedDialog()) {
          event.preventDefault()
          return
        }
        if (typeof onPointerDownOutside === 'function') onPointerDownOutside(event)
      }}
      onEscapeKeyDown={(event) => {
        if (eventTargetLivesInTemporaryOverlay(document.activeElement)) {
          event.preventDefault()
          return
        }
        if (hasAnyOpenNestedDialog()) {
          event.preventDefault()
          return
        }
        if (typeof onEscapeKeyDown === 'function') onEscapeKeyDown(event)
      }}
      {...props}
    >
      {children}
      <DialogPrimitive.Close asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3 h-9 w-9"
        >
          <X />
          <span className="sr-only">Cerrar</span>
        </Button>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
  )
})

DialogContent.displayName = 'DialogContent'

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1.5', className)} {...props} />
)

export const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
)

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-base font-semibold', className)} {...props} />
))

DialogTitle.displayName = 'DialogTitle'

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))

DialogDescription.displayName = 'DialogDescription'
