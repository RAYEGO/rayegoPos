import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export type DialogProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>
export function Dialog({ modal = false, ...props }: DialogProps) {
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
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-[60] grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-popover p-6 text-popover-foreground shadow-soft animate-in fade-in-0 zoom-in-95',
        className,
      )}
      onPointerDown={(event) => {
        const target = event.target as HTMLElement | null
        if (!target) {
          props.onPointerDown?.(event)
          return
        }
        try {
          const editable = target.closest<HTMLElement>('input, textarea, [contenteditable="true"], [role="textbox"], [role="combobox"]')
          if (editable && document.activeElement !== editable && !editable.hasAttribute('disabled') && !(editable as any).readOnly) {
            editable.focus({ preventScroll: true })
          }
        } catch {
        }
        props.onPointerDown?.(event)
      }}
      onPointerDownOutside={(event) => {
        const target = event.target as HTMLElement | null
        if (target && target.closest('[data-radix-popper-content-wrapper]')) {
          event.preventDefault()
        }
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
))

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
