import type { SVGProps } from 'react'
import { cn } from '@/lib/utils'

type IllustrationProps = SVGProps<SVGSVGElement> & {
  className?: string
}

export function HeroIllustration({ className, ...props }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 640 440"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-full w-full', className)}
      {...props}
    >
      <defs>
        <linearGradient id="rayego-hero-a" x1="88" y1="60" x2="552" y2="390" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(var(--primary))" stopOpacity="0.18" />
          <stop offset="1" stopColor="hsl(var(--secondary))" stopOpacity="0.14" />
        </linearGradient>
        <linearGradient id="rayego-hero-b" x1="160" y1="110" x2="470" y2="350" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(var(--primary))" stopOpacity="0.14" />
          <stop offset="1" stopColor="hsl(var(--secondary))" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      <rect x="48" y="44" width="544" height="352" rx="28" fill="url(#rayego-hero-a)" />
      <rect x="84" y="78" width="472" height="284" rx="22" fill="hsl(var(--card))" stroke="hsl(var(--border))" />

      <rect x="116" y="112" width="220" height="40" rx="14" fill="hsl(var(--muted))" />
      <rect x="116" y="166" width="300" height="18" rx="9" fill="hsl(var(--muted))" />
      <rect x="116" y="192" width="260" height="18" rx="9" fill="hsl(var(--muted))" />
      <rect x="116" y="218" width="240" height="18" rx="9" fill="hsl(var(--muted))" />

      <rect x="116" y="264" width="152" height="44" rx="14" fill="hsl(var(--primary))" />
      <rect x="276" y="264" width="140" height="44" rx="14" fill="hsl(var(--background))" stroke="hsl(var(--border))" />

      <rect x="430" y="120" width="96" height="168" rx="18" fill="url(#rayego-hero-b)" stroke="hsl(var(--border))" />

      <path
        d="M478 150c0-10 8-18 18-18h2c10 0 18 8 18 18v14c0 10-8 18-18 18h-2c-10 0-18-8-18-18v-14z"
        fill="hsl(var(--primary))"
        opacity="0.9"
      />
      <path
        d="M456 214c0-10 8-18 18-18h24c10 0 18 8 18 18v6c0 10-8 18-18 18h-24c-10 0-18-8-18-18v-6z"
        fill="hsl(var(--secondary))"
        opacity="0.9"
      />
      <path
        d="M456 250c0-10 8-18 18-18h24c10 0 18 8 18 18v6c0 10-8 18-18 18h-24c-10 0-18-8-18-18v-6z"
        fill="hsl(var(--muted))"
      />

      <path
        d="M206 332h224"
        stroke="hsl(var(--border))"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="206" cy="332" r="10" fill="hsl(var(--secondary))" />
      <circle cx="430" cy="332" r="10" fill="hsl(var(--primary))" />
    </svg>
  )
}

export function IllustrationBlister({ className, ...props }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-12 w-12', className)}
      {...props}
    >
      <rect x="8" y="10" width="40" height="36" rx="12" fill="hsl(var(--muted))" />
      <rect x="14" y="16" width="28" height="24" rx="10" fill="hsl(var(--background))" stroke="hsl(var(--border))" />
      <circle cx="22" cy="24" r="4" fill="hsl(var(--primary))" opacity="0.9" />
      <circle cx="34" cy="24" r="4" fill="hsl(var(--secondary))" opacity="0.9" />
      <circle cx="22" cy="34" r="4" fill="hsl(var(--secondary))" opacity="0.75" />
      <circle cx="34" cy="34" r="4" fill="hsl(var(--primary))" opacity="0.75" />
    </svg>
  )
}

export function IllustrationBottle({ className, ...props }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-12 w-12', className)}
      {...props}
    >
      <rect x="20" y="8" width="16" height="10" rx="5" fill="hsl(var(--primary))" opacity="0.9" />
      <rect x="16" y="16" width="24" height="32" rx="12" fill="hsl(var(--muted))" stroke="hsl(var(--border))" />
      <rect x="20" y="24" width="16" height="8" rx="4" fill="hsl(var(--secondary))" opacity="0.9" />
      <path d="M28 26v4" stroke="hsl(var(--secondary-foreground))" strokeWidth="2" strokeLinecap="round" />
      <path d="M26 28h4" stroke="hsl(var(--secondary-foreground))" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function IllustrationCloud({ className, ...props }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-12 w-12', className)}
      {...props}
    >
      <path
        d="M20 40h19c6 0 11-4 11-10 0-5-4-9-9-9-1 0-2 0-3 .4C36 16 32 13 27 13c-7 0-12 6-12 13v1c-5 1-9 5-9 10 0 6 5 9 14 9z"
        fill="hsl(var(--muted))"
        stroke="hsl(var(--border))"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M23 32l5 5 5-5"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M28 37V24"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IllustrationChart({ className, ...props }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-12 w-12', className)}
      {...props}
    >
      <rect x="10" y="12" width="36" height="32" rx="12" fill="hsl(var(--muted))" stroke="hsl(var(--border))" />
      <path
        d="M18 34l6-8 6 5 8-11"
        stroke="hsl(var(--primary))"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="18" cy="34" r="2.5" fill="hsl(var(--secondary))" />
      <circle cx="24" cy="26" r="2.5" fill="hsl(var(--secondary))" />
      <circle cx="30" cy="31" r="2.5" fill="hsl(var(--secondary))" />
      <circle cx="38" cy="20" r="2.5" fill="hsl(var(--secondary))" />
    </svg>
  )
}

export function IllustrationLightning({ className, ...props }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-12 w-12', className)}
      {...props}
    >
      <rect x="10" y="10" width="36" height="36" rx="14" fill="hsl(var(--muted))" stroke="hsl(var(--border))" />
      <path
        d="M30 14l-12 18h10l-2 10 12-18H28l2-10z"
        fill="hsl(var(--primary))"
        opacity="0.95"
      />
    </svg>
  )
}

