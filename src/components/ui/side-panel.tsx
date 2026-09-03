import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export type SidePanelProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>
export function SidePanel({ modal = false, ...props }: SidePanelProps) {
  return <DialogPrimitive.Root modal={modal} {...props} />
}

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
      'fixed inset-0 z-[50] bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
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
>(({ className, children, showCloseButton = false, onPointerDownOutside, onEscapeKeyDown, ...props }, ref) => {
  const hasAnyOpenNestedDialog = React.useCallback(() => {
    if (typeof document === 'undefined') return false
    const candidateRoots = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-radix-dialog-root][data-state="open"], [role="dialog"][data-state="open"]',
      ),
    )
    const container = document.body
    for (const el of candidateRoots) {
      if (!container.contains(el)) continue
      if (el.hasAttribute('data-side-panel-root')) continue
      return true
    }
    return false
  }, [])

  return (
  <SidePanelPortal>
    <SidePanelOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed inset-y-0 right-0 z-[50] flex h-full w-full flex-col border-l bg-popover text-popover-foreground shadow-soft outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:w-[70vw] sm:max-w-[70vw] sm:rounded-l-2xl lg:w-[700px] lg:max-w-[700px]',
        className,
      )}
      onPointerDownOutside={(event) => {
        if (hasAnyOpenNestedDialog()) {
          event.preventDefault()
          return
        }
        if (typeof onPointerDownOutside === 'function') onPointerDownOutside(event)
      }}
      onEscapeKeyDown={(event) => {
        if (hasAnyOpenNestedDialog()) {
          event.preventDefault()
          return
        }
        if (typeof onEscapeKeyDown === 'function') onEscapeKeyDown(event)
      }}
      onOpenAutoFocus={(event) => {
        const root = event.currentTarget as HTMLElement | null
        if (!root) return

        const pick = (selector: string) => {
          const els = Array.from(root.querySelectorAll<HTMLElement>(selector))
          return els.find((el) => {
            if (el.closest('[aria-hidden="true"]')) return false
            if (el.getAttribute('aria-hidden') === 'true') return false
            if (el.getAttribute('tabindex') === '-1') return false

            if (el instanceof HTMLInputElement) {
              if (el.type === 'hidden') return false
              if (el.disabled) return false
              if (el.readOnly) return false
            }
            if (el instanceof HTMLTextAreaElement) {
              if (el.disabled) return false
              if (el.readOnly) return false
            }
            if (el instanceof HTMLButtonElement) {
              if (el.disabled) return false
            }

            const style = window.getComputedStyle(el)
            if (style.display === 'none') return false
            if (style.visibility === 'hidden') return false
            if (style.pointerEvents === 'none') return false
            const rect = el.getBoundingClientRect()
            if (rect.width <= 0 || rect.height <= 0) return false
            return true
          })
        }

        const active = document.activeElement as HTMLElement | null
        if (active && root.contains(active)) {
          event.preventDefault()
          return
        }

        const candidate =
          pick('input:not([type="hidden"])') ??
          pick('textarea') ??
          pick('[role="combobox"]') ??
          pick('button:not([disabled])') ??
          pick('[tabindex]:not([tabindex="-1"])')

        if (!candidate) {
          return
        }
        candidate.focus({ preventScroll: true })
        event.preventDefault()
      }}
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
  )
})

SidePanelContent.displayName = 'SidePanelContent'
