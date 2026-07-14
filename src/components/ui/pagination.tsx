import * as React from 'react'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export function Pagination({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <nav className={cn('flex items-center justify-center', className)} {...props} />
}

export function PaginationContent({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn('flex items-center gap-1', className)} {...props} />
}

export function PaginationItem({ className, ...props }: React.HTMLAttributes<HTMLLIElement>) {
  return <li className={cn('', className)} {...props} />
}

export type PaginationLinkProps = React.ComponentProps<typeof Button> & {
  isActive?: boolean
}

export function PaginationLink({ className, variant, size, isActive, ...props }: PaginationLinkProps) {
  return (
    <Button
      variant={isActive ? 'outline' : variant ?? 'ghost'}
      size={size ?? 'icon'}
      className={cn(isActive && 'bg-background', className)}
      {...props}
    />
  )
}

export function PaginationPrevious(props: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink aria-label="Anterior" {...props}>
      <ChevronLeft />
    </PaginationLink>
  )
}

export function PaginationNext(props: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink aria-label="Siguiente" {...props}>
      <ChevronRight />
    </PaginationLink>
  )
}

export function PaginationEllipsis({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('flex h-10 w-10 items-center justify-center text-muted-foreground', className)}
      {...props}
    >
      <MoreHorizontal className="h-4 w-4" />
    </span>
  )
}

