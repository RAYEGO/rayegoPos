import type { PaymentMethodCode } from '@/types/cashier'

export type PaymentCategory = 'CASH' | 'DIGITAL' | 'CARD'

export type DigitalSubmethod = 'YAPE' | 'PLIN' | 'BANK_TRANSFER'

export type ClassifiedPaymentMethod = {
  category: PaymentCategory
  digitalSubmethod: DigitalSubmethod | null
}

export type PaymentMethodOption = {
  id: string
  code: PaymentMethodCode
  name: string
  category: PaymentCategory
  digitalSubmethod: DigitalSubmethod | null
  requiresReference?: boolean
  allowsChange?: boolean
}

const CATEGORY_LABEL: Record<PaymentCategory, string> = {
  CASH: 'Efectivo',
  DIGITAL: 'Digital',
  CARD: 'Tarjeta',
}

const CATEGORY_ORDER: PaymentCategory[] = ['CASH', 'DIGITAL', 'CARD']

const DIGITAL_SUBMETHOD_ORDER: Array<{ code: PaymentMethodCode; label: string }> = [
  { code: 'YAPE', label: 'Yape' },
  { code: 'PLIN', label: 'Plin' },
  { code: 'TRANSFERENCIA', label: 'Transferencia bancaria' },
]

const METHOD_TO_CATEGORY: Record<string, ClassifiedPaymentMethod> = {
  EFECTIVO: { category: 'CASH', digitalSubmethod: null },
  TARJETA: { category: 'CARD', digitalSubmethod: null },
  YAPE: { category: 'DIGITAL', digitalSubmethod: 'YAPE' },
  PLIN: { category: 'DIGITAL', digitalSubmethod: 'PLIN' },
  TRANSFERENCIA: { category: 'DIGITAL', digitalSubmethod: 'BANK_TRANSFER' },
  OTRO: { category: 'CASH', digitalSubmethod: null },
}

export function classifyPaymentMethod(code: string | null | undefined): ClassifiedPaymentMethod {
  if (!code) return { category: 'CASH', digitalSubmethod: null }
  return METHOD_TO_CATEGORY[code] ?? { category: 'CASH', digitalSubmethod: null }
}

export function getCategoryLabel(category: PaymentCategory): string {
  return CATEGORY_LABEL[category]
}

export function labelForCategory(category: PaymentCategory): string {
  return CATEGORY_LABEL[category]
}

export function getCategoryOrder(): PaymentCategory[] {
  return [...CATEGORY_ORDER]
}

export function getDigitalSubmethodOrder(): Array<{ code: PaymentMethodCode; label: string }> {
  return [...DIGITAL_SUBMETHOD_ORDER]
}

export function labelForMethodCode(code: string | null | undefined): string {
  if (!code) return '—'
  const meta = DIGITAL_SUBMETHOD_ORDER.find((d) => d.code === code)
  if (meta) return meta.label
  switch (code) {
    case 'EFECTIVO':
      return 'Efectivo'
    case 'TARJETA':
      return 'Tarjeta'
    case 'OTRO':
      return 'Otro'
    default:
      return code
  }
}

export function fullLabelForMethod(
  classification: ClassifiedPaymentMethod,
  methodName: string,
): string {
  if (classification.category === 'DIGITAL') {
    return `Digital · ${methodName}`
  }
  return methodName
}

export function buildPaymentCategoryGroups<T extends PaymentMethodOption>(
  methods: T[],
): {
  order: PaymentCategory[]
  groups: Record<PaymentCategory, T[]>
}

export function buildPaymentCategoryGroups<T extends object>(
  items: T[],
  classifyFn: (item: T) => ClassifiedPaymentMethod,
): {
  order: PaymentCategory[]
  groups: Record<PaymentCategory, T[]>
}

export function buildPaymentCategoryGroups<T extends object>(
  items: T[],
  classifyFn?: (item: T) => ClassifiedPaymentMethod,
): {
  order: PaymentCategory[]
  groups: Record<PaymentCategory, T[]>
} {
  const groups: Record<string, T[]> = {
    CASH: [],
    DIGITAL: [],
    CARD: [],
  }
  for (const item of items) {
    const classification = classifyFn
      ? classifyFn(item)
      : (item as unknown as PaymentMethodOption).category
        ? { category: (item as unknown as PaymentMethodOption).category }
        : { category: 'CASH' as PaymentCategory }
    const category = classification.category
    if (!groups[category]) groups[category] = []
    groups[category].push(item)
  }
  const order = CATEGORY_ORDER.filter((c) => (groups[c]?.length ?? 0) > 0)
  return { order, groups: groups as Record<PaymentCategory, T[]> }
}

export function enrichPaymentMethods<T extends { id: string; code: string; name: string }>(
  methods: T[],
): Array<T & { category: PaymentCategory; digitalSubmethod: DigitalSubmethod | null }> {
  return methods.map((method) => {
    const classification = classifyPaymentMethod(method.code)
    return {
      ...method,
      category: classification.category,
      digitalSubmethod: classification.digitalSubmethod,
    }
  })
}

export function findMethodById<T extends { id: string }>(
  methods: T[] | undefined | null,
  id: string | undefined | null,
): T | null {
  if (!methods || !id) return null
  return methods.find((m) => m.id === id) ?? null
}

export function isCashMethod(code: string | null | undefined): boolean {
  return classifyPaymentMethod(code).category === 'CASH'
}

export function isCardMethod(code: string | null | undefined): boolean {
  return classifyPaymentMethod(code).category === 'CARD'
}

export function isDigitalMethod(code: string | null | undefined): boolean {
  return classifyPaymentMethod(code).category === 'DIGITAL'
}

export function getMethodVariant(
  code: string | null | undefined,
): 'default' | 'info' | 'success' | 'warning' | 'destructive' | 'outline' {
  const c = classifyPaymentMethod(code)
  switch (c.category) {
    case 'CASH':
      return 'success'
    case 'CARD':
      return 'info'
    case 'DIGITAL':
      return 'warning'
    default:
      return 'outline'
  }
}
