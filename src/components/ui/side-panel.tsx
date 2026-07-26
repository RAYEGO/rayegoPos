import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export const SidePanel = DialogPrimitive.Root
export const SidePanelTrigger = DialogPrimitive.Trigger
export const SidePanelClose = DialogPrimitive.Close
export const SidePanelPortal = DialogPrimitive.Portal

export const SidePanelOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
))

SidePanelOverlay.displayName = 'SidePanelOverlay'

export const SidePanelContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    showCloseButton?: boolean
  }
>(({ className, children, showCloseButton = false, ...props }, ref) => (
  <SidePanelPortal>
    <SidePanelOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col border-l bg-popover text-popover-foreground shadow-soft outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:w-[70vw] sm:max-w-[70vw] sm:rounded-l-2xl lg:w-[700px] lg:max-w-[700px]',
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton ? (
        <SidePanelClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3 h-9 w-9"
          >
            <X />
            <span className="sr-only">Cerrar</span>
          </Button>
        </SidePanelClose>
      ) : null}
    </DialogPrimitive.Content>
  </SidePanelPortal>
))

SidePanelContent.displayName = 'SidePanelContent'

