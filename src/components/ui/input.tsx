import * as React from 'react'
import { cn } from '@/lib/utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    const innerRef = React.useRef<HTMLInputElement | null>(null)
    const mergedRef = (node: HTMLInputElement | null) => {
      innerRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node
    }
    return (
      <input
        ref={mergedRef}
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors duration-150 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        onPointerDown={(event) => {
          const el = innerRef.current
          if (el && !el.disabled && !(el as any).readOnly && document.activeElement !== el) {
            try {
              el.focus({ preventScroll: true })
            } catch {
            }
          }
          props.onPointerDown?.(event)
        }}
        {...props}
      />
    )
  },
)

Input.displayName = 'Input'
