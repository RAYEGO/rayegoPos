import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, currency = 'PEN') {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)
}

export function formatPercentage(value: number, fractionDigits = 2) {
  return `${(Number.isFinite(value) ? value : 0).toFixed(fractionDigits)}%`
}

export function formatQuantity(value: number, fractionDigits = 4) {
  if (!Number.isFinite(value)) return '0'
  if (Number.isInteger(value)) return value.toLocaleString('es-PE')
  return value.toLocaleString('es-PE', { maximumFractionDigits: fractionDigits })
}

