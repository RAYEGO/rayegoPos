import { Prisma } from '@prisma/client'
import { resolveConversionFactor } from './packagingConversion.js'

export type PackagingOperation =
  | 'SALE'
  | 'PURCHASE'
  | 'INVENTORY'
  | 'INVENTORY_IN'
  | 'INVENTORY_OUT'

export type PackagingEdge = {
  fromPresentationId: string
  toPresentationId: string
  quantity: number
}

export type ProductPackagingPresentation = {
  esBase: boolean
  permiteCompra: boolean
  permiteVenta: boolean
  precioVenta: Prisma.Decimal | null
  presentacion: {
    id: string
    nombre: string
  }
}

export type ProductPackagingConversion = {
  desdePresentacionId: string
  haciaPresentacionId: string
  cantidad: number
}

export function buildPackagingEdges(conversions: ProductPackagingConversion[]) {
  return conversions.map((entry) => ({
    fromPresentationId: entry.desdePresentacionId,
    toPresentationId: entry.haciaPresentacionId,
    quantity: entry.cantidad,
  }))
}

export function resolveBasePresentation(
  presentations: ProductPackagingPresentation[],
) {
  return presentations.find((entry) => entry.esBase) ?? null
}

export function resolvePresentationEntry(
  {
    operation,
    presentationId,
    presentations,
  }: {
    operation: PackagingOperation
    presentationId: string
    presentations: ProductPackagingPresentation[]
  },
) {
  const selected = presentations.find((entry) => entry.presentacion.id === presentationId) ?? null
  if (!selected) {
    return {
      ok: false as const,
      error: 'La presentación seleccionada no está configurada para este producto.',
    }
  }

  if (operation === 'SALE' || operation === 'INVENTORY_OUT') {
    if (!selected.permiteVenta) {
      return {
        ok: false as const,
        error: 'La presentación seleccionada no está habilitada para venta.',
      }
    }
  }

  if (operation === 'PURCHASE' || operation === 'INVENTORY_IN') {
    if (!selected.permiteCompra) {
      return {
        ok: false as const,
        error: 'La presentación seleccionada no está habilitada para compra.',
      }
    }
  }

  return { ok: true as const, entry: selected }
}

export function resolveFactorToBase({
  presentationId,
  basePresentationId,
  edges,
}: {
  presentationId: string
  basePresentationId: string
  edges: PackagingEdge[]
}) {
  const factor = resolveConversionFactor(presentationId, basePresentationId, edges)
  if (!factor || !Number.isFinite(factor) || !Number.isInteger(factor) || factor <= 0) {
    return null
  }
  return factor
}

export function resolvePresentationFactors({
  basePresentationId,
  presentationIds,
  edges,
}: {
  basePresentationId: string
  presentationIds: string[]
  edges: PackagingEdge[]
}) {
  const factors = new Map<string, number | null>()
  for (const id of presentationIds) {
    if (id === basePresentationId) {
      factors.set(id, 1)
      continue
    }
    factors.set(
      id,
      resolveFactorToBase({ presentationId: id, basePresentationId, edges }),
    )
  }
  return factors
}
