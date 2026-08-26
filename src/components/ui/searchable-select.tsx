import * as React from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export type SearchableOption = {
  value: string
  title: string
  subtitle?: string
}

export type SearchableSelectProps = {
  value?: string
  onValueChange: (nextValue: string, nextOption: SearchableOption | null) => void
  options: SearchableOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = 'Buscar...',
  searchPlaceholder,
  emptyMessage = 'No hay resultados.',
  disabled = false,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const activeIndexRef = React.useRef<number>(-1)

  const selectedOption = React.useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  )

  const filtered = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return options
    return options.filter((option) => {
      const title = option.title.toLowerCase()
      const sub = option.subtitle?.toLowerCase() ?? ''
      return title.includes(term) || sub.includes(term)
    })
  }, [options, searchTerm])

  const showAsSelected = Boolean(value && selectedOption && !open && searchTerm.length === 0)

  const currentDisplay = React.useMemo(() => {
    if (showAsSelected) return selectedOption?.title ?? ''
    return searchTerm
  }, [searchTerm, selectedOption, showAsSelected])

  React.useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current) return
      if (wrapperRef.current.contains(event.target as Node)) return
      if (!open) return
      setOpen(false)
      setSearchTerm('')
      activeIndexRef.current = -1
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  function handleFocus() {
    if (disabled) return
    setOpen(true)
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (disabled) return
    setSearchTerm(event.target.value)
    setOpen(true)
    activeIndexRef.current = -1
  }

  function pickOption(option: SearchableOption) {
    onValueChange(option.value, option)
    setSearchTerm('')
    setOpen(false)
    activeIndexRef.current = -1
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setOpen(true)
        activeIndexRef.current = 0
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        setOpen(true)
        return
      }
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      setSearchTerm('')
      activeIndexRef.current = -1
      return
    }

    if (!open || filtered.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      activeIndexRef.current = Math.min(activeIndexRef.current + 1, filtered.length - 1)
      const items = wrapperRef.current?.querySelectorAll<HTMLLIElement>('[data-role="option"]')
      items?.[activeIndexRef.current]?.scrollIntoView({ block: 'nearest' })
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      activeIndexRef.current = Math.max(activeIndexRef.current - 1, 0)
      const items = wrapperRef.current?.querySelectorAll<HTMLLIElement>('[data-role="option"]')
      items?.[activeIndexRef.current]?.scrollIntoView({ block: 'nearest' })
      return
    }

    if (event.key === 'Enter') {
      const idx = activeIndexRef.current
      if (idx >= 0 && filtered[idx]) {
        event.preventDefault()
        pickOption(filtered[idx])
      }
    }
  }

  function handleClear(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    onValueChange('', null)
    setSearchTerm('')
    activeIndexRef.current = -1
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <div ref={wrapperRef} className={cn('relative w-full', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          placeholder={showAsSelected ? '' : searchPlaceholder ?? placeholder}
          value={currentDisplay}
          onChange={handleChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          className={cn(
            'h-10 pl-9 pr-11',
            showAsSelected && 'text-foreground',
            open && 'ring-2 ring-ring ring-offset-0',
          )}
          spellCheck={false}
        />
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Limpiar selección"
            onClick={handleClear}
            disabled={disabled}
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-md text-muted-foreground opacity-80 hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {showAsSelected ? (
        <div className="pointer-events-none mt-1.5 pl-9 text-xs text-muted-foreground">
          {selectedOption?.subtitle ? (
            <div className="flex items-center gap-2">
              <span className="text-emerald-600 dark:text-emerald-400">
                {extractSubvalue(selectedOption.subtitle, 'Disponible')}
              </span>
              <span className="text-amber-600 dark:text-amber-400">
                {extractSubvalue(selectedOption.subtitle, 'Reservado')}
              </span>
              <span className="text-rose-600 dark:text-rose-400">
                {extractSubvalue(selectedOption.subtitle, 'Bloqueado')}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg outline-none animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="max-h-72 overflow-y-auto">
            {filtered.length > 0 ? (
              <ul role="listbox" className="p-1">
                {filtered.map((option, idx) => {
                  const active = option.value === value
                  return (
                    <li
                      key={option.value}
                      data-role="option"
                      role="option"
                      aria-selected={active}
                      tabIndex={-1}
                      onPointerDown={(event) => {
                        event.preventDefault()
                        pickOption(option)
                      }}
                      onPointerEnter={() => {
                        activeIndexRef.current = idx
                      }}
                      className={cn(
                        'cursor-pointer rounded-sm px-3 py-2.5 text-sm outline-none transition-colors',
                        active
                          ? 'bg-accent text-accent-foreground'
                          : activeIndexRef.current === idx
                            ? 'bg-muted/70'
                            : 'hover:bg-muted/70',
                      )}
                    >
                      <p className="truncate font-medium">{option.title}</p>
                      {option.subtitle ? (
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {extractSubvalue(option.subtitle, 'Disponible')}
                          </span>
                          <span className="text-amber-600 dark:text-amber-400">
                            {extractSubvalue(option.subtitle, 'Reservado')}
                          </span>
                          <span className="text-rose-600 dark:text-rose-400">
                            {extractSubvalue(option.subtitle, 'Bloqueado')}
                          </span>
                        </div>
                      ) : null}
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

function extractSubvalue(subtitle: string, label: string) {
  const pattern = new RegExp(`${label}\\s+([^·]+)`, 'i')
  const match = subtitle.match(pattern)
  if (match) return `${label} ${match[1].trim()}`
  return ''
}
