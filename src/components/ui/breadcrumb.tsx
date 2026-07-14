import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export function Breadcrumb({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <nav aria-label="Breadcrumb" className={cn('min-w-0', className)} {...props} />
}

export function BreadcrumbList({ className, ...props }: React.OlHTMLAttributes<HTMLOListElement>) {
  return <ol className={cn('flex flex-wrap items-center gap-1 text-sm text-muted-foreground', className)} {...props} />
}

export function BreadcrumbItem({ className, ...props }: React.LiHTMLAttributes<HTMLLIElement>) {
  return <li className={cn('inline-flex items-center gap-1', className)} {...props} />
}

export function BreadcrumbLink({
  className,
  to,
  children,
}: {
  className?: string
  to: string
  children: React.ReactNode
}) {
  return (
    <Link className={cn('truncate hover:text-foreground', className)} to={to}>
      {children}
    </Link>
  )
}

export function BreadcrumbPage({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('truncate text-foreground', className)} {...props} />
}

export function BreadcrumbSeparator({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn('text-muted-foreground', className)} aria-hidden="true" {...props}>
      <ChevronRight className="h-4 w-4" />
    </span>
  )
}

