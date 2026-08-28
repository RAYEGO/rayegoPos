import * as React from 'react'
import { cn } from '@/lib/utils'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null)
    const mergedRef = (node: HTMLTextAreaElement | null) => {
      innerRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node
    }
    return (
      <textarea
        ref={mergedRef}
        className={cn(
          'flex min-h-24 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors duration-150 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        onPointerDown={(event) => {
          props.onPointerDown?.(event)
          if (event.defaultPrevented) return
          const el = innerRef.current
          if (el && !el.disabled && !(el as any).readOnly) {
            window.requestAnimationFrame(() => {
              try {
                el.focus({ preventScroll: true })
              } catch {
              }
            })
          }
        }}
        {...props}
      />
    )
  },
)

Textarea.displayName = 'Textarea'

