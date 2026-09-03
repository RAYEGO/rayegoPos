import * as React from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type ComboboxOption = {
  value: string
  label: string
  description?: string
}

type ComboboxProps = {
  value?: string
  onValueChange: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
}

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = 'Selecciona una opción',
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'No hay resultados.',
  disabled = false,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  const selectedOption = React.useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  )

  const filteredOptions = React.useMemo(() => {
    const normalized = search.trim().toLowerCase()
    if (!normalized) return options
    return options.filter((option) => {
      const label = option.label.toLowerCase()
      const desc = option.description?.toLowerCase() ?? ''
      return label.includes(normalized) || desc.includes(normalized)
    })
  }, [options, search])

  React.useEffect(() => {
    const pointerTargetIsInOverlayOrPortal = (target: HTMLElement) => {
      const portalOrOverlay = target.closest<HTMLElement>(
        '[data-radix-dialog-overlay], [data-radix-dialog-content], [data-radix-popper-content-wrapper], [data-radix-dropdown-menu-content], [data-radix-tooltip-content], [data-radix-popover-content], [data-radix-hover-card-content], [data-side-panel-content], [data-radix-select-content], [data-radix-select-viewport]',
      )
      if (portalOrOverlay) return true
      const isFixedTopLevel = (el: HTMLElement) => {
        let n: HTMLElement | null = el
        for (let i = 0; i < 6 && n; i++) {
          const cs = window.getComputedStyle(n)
          if ((cs.position === 'fixed' || cs.position === 'absolute') && Number(cs.zIndex) >= 40) {
            return true
          }
          n = n.parentElement
        }
        return false
      }
      return isFixedTopLevel(target)
    }
    function handlePointerDown(event: PointerEvent) {
      const tgt = event.target as HTMLElement | null
      if (!wrapperRef.current) return
      if (tgt && wrapperRef.current.contains(tgt)) return
      if (tgt && pointerTargetIsInOverlayOrPortal(tgt)) return
      setOpen(false)
      setSearch('')
    }
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target) {
        const inTemporaryOverlay = target.closest<HTMLElement>(
          '[data-radix-popper-content-wrapper], [data-side-panel-content], [data-radix-dialog-content]',
        )
        if (inTemporaryOverlay && event.key === 'Escape') return
      }
      if (event.key === 'Escape') {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="w-full justify-between px-3 font-normal text-left shadow-none"
      >
        <span className={cn('truncate', !selectedOption && 'text-muted-foreground')}>
          {selectedOption?.label ?? placeholder}
        </span>
        <div className="ml-2 flex shrink-0 items-center gap-1 text-muted-foreground">
          {selectedOption ? (
            <X
              role="button"
              aria-label="Limpiar selección"
              tabIndex={0}
              className="h-4 w-4 cursor-pointer opacity-70 transition-opacity hover:opacity-100"
              onPointerDown={(event) => {
                event.stopPropagation()
                event.preventDefault()
                onValueChange('')
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onValueChange('')
                }
              }}
            />
          ) : null}
          <ChevronDown className="h-4 w-4 opacity-60 transition-transform" />
        </div>
      </Button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg outline-none animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="border-b p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 border-0 bg-transparent pl-8 pr-3 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              <ul role="listbox" className="p-1">
                {filteredOptions.map((option) => {
                  const active = option.value === value
                  return (
                    <li
                      key={option.value}
                      role="option"
                      aria-selected={active}
                      onPointerDown={(event) => {
                        event.preventDefault()
                        onValueChange(option.value)
                        setOpen(false)
                        setSearch('')
                      }}
                      className={cn(
                        'flex cursor-pointer items-start gap-2 rounded-sm px-2 py-2 text-sm outline-none transition-colors',
                        active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/70',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-primary',
                          active ? 'opacity-100' : 'opacity-0',
                        )}
                        aria-hidden="true"
                      >
                        <Check className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{option.label}</p>
                        {option.description ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {option.description}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
