import { CodigoFormaPago, Prisma } from '@prisma/client'

export type PaymentCategory = 'CASH' | 'DIGITAL' | 'CARD'
export type DigitalSubmethod = 'YAPE' | 'PLIN' | 'BANK_TRANSFER'

export type ClassifiedPaymentMethod = {
  category: PaymentCategory
  digitalSubmethod: DigitalSubmethod | null
}

const METHOD_TO_CATEGORY: Record<string, ClassifiedPaymentMethod> = {
  [CodigoFormaPago.EFECTIVO]: { category: 'CASH', digitalSubmethod: null },
  [CodigoFormaPago.TARJETA]: { category: 'CARD', digitalSubmethod: null },
  [CodigoFormaPago.YAPE]: { category: 'DIGITAL', digitalSubmethod: 'YAPE' },
  [CodigoFormaPago.PLIN]: { category: 'DIGITAL', digitalSubmethod: 'PLIN' },
  [CodigoFormaPago.TRANSFERENCIA]: { category: 'DIGITAL', digitalSubmethod: 'BANK_TRANSFER' },
  [CodigoFormaPago.OTRO]: { category: 'CASH', digitalSubmethod: null },
}

export function classifyPaymentMethod(code: string | null | undefined): ClassifiedPaymentMethod {
  if (!code) return { category: 'CASH', digitalSubmethod: null }
  return METHOD_TO_CATEGORY[code] ?? { category: 'CASH', digitalSubmethod: null }
}

export type DefaultPaymentMethodSeed = {
  codigo: CodigoFormaPago
  nombre: string
  orden: number
  requiereReferencia: boolean
  permiteVuelto: boolean
  activo: boolean
}

export const DEFAULT_PAYMENT_METHODS: DefaultPaymentMethodSeed[] = [
  {
    codigo: CodigoFormaPago.EFECTIVO,
    nombre: 'Efectivo',
    orden: 1,
    requiereReferencia: false,
    permiteVuelto: true,
    activo: true,
  },
  {
    codigo: CodigoFormaPago.TARJETA,
    nombre: 'Tarjeta',
    orden: 2,
    requiereReferencia: true,
    permiteVuelto: false,
    activo: true,
  },
  {
    codigo: CodigoFormaPago.YAPE,
    nombre: 'Yape',
    orden: 3,
    requiereReferencia: true,
    permiteVuelto: false,
    activo: true,
  },
  {
    codigo: CodigoFormaPago.PLIN,
    nombre: 'Plin',
    orden: 4,
    requiereReferencia: true,
    permiteVuelto: false,
    activo: true,
  },
  {
    codigo: CodigoFormaPago.TRANSFERENCIA,
    nombre: 'Transferencia bancaria',
    orden: 5,
    requiereReferencia: true,
    permiteVuelto: false,
    activo: true,
  },
  {
    codigo: CodigoFormaPago.OTRO,
    nombre: 'Otro',
    orden: 6,
    requiereReferencia: false,
    permiteVuelto: false,
    activo: false,
  },
]

export function buildEnsureDefaultPaymentMethodsUpsert(userId?: string): Prisma.FormaPagoUpsertArgs[] {
  return DEFAULT_PAYMENT_METHODS.map((method) => ({
    where: { codigo: method.codigo },
    create: {
      codigo: method.codigo,
      nombre: method.nombre,
      orden: method.orden,
      requiereReferencia: method.requiereReferencia,
      permiteVuelto: method.permiteVuelto,
      activo: method.activo,
      ...(userId ? { createdById: userId, updatedById: userId } : {}),
    },
    update: {
      nombre: method.nombre,
      orden: method.orden,
      requiereReferencia: method.requiereReferencia,
      permiteVuelto: method.permiteVuelto,
      activo: method.activo,
      ...(userId ? { updatedById: userId } : {}),
    },
  }))
}

export function enrichPaymentMethodWithClassification<T extends { codigo: string }>(
  method: T,
): T & { category: PaymentCategory; digitalSubmethod: DigitalSubmethod | null } {
  const classification = classifyPaymentMethod(method.codigo)
  return {
    ...method,
    category: classification.category,
    digitalSubmethod: classification.digitalSubmethod,
  }
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
