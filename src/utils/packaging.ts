export type PackagingChainRow = {
  presentacionId: string | null
  cantidadEquivalencia: number | null | undefined
}

export type BuildPackagingSummaryResult = {
  hasEnoughData: boolean
  equivalenceText: string
  totalText: string
  perUnitText: string
  baseUnits: number | null
  relationTexts: string[]
}

export function buildCumulativePackagingLabels(
  rows: Array<{
    presentacionId?: string | null | undefined
    cantidadEquivalencia?: number | null | undefined
  }>,
  getPresentationLabel: (presentationId?: string | null) => string,
) {
  let cumulativeFactor = 1

  return rows.map((row, index) => {
    if (index > 0) {
      const previousFactor = rows[index - 1]?.cantidadEquivalencia
      cumulativeFactor =
        typeof previousFactor === 'number' && Number.isFinite(previousFactor)
          ? cumulativeFactor * previousFactor
          : Number.NaN
    }

    return {
      key: `${row.presentacionId || 'row'}-${index}`,
      label: getPresentationLabel(row.presentacionId),
      quantityLabel:
        index === 0 || !Number.isFinite(cumulativeFactor)
          ? null
          : cumulativeFactor.toLocaleString('es-PE'),
    }
  })
}

export function buildPackagingSummary(
  rows: Array<{
    presentacionId?: string | null | undefined
    cantidadEquivalencia?: number | null | undefined
  }>,
  getPresentationLabel: (presentationId?: string | null) => string,
): BuildPackagingSummaryResult {
  if (rows.length === 0) {
    return {
      hasEnoughData: false,
      equivalenceText: 'Agrega presentaciones para ver la equivalencia.',
      totalText: '',
      perUnitText: '',
      baseUnits: null,
      relationTexts: [],
    }
  }

  const labels = rows.map((entry) => getPresentationLabel(entry.presentacionId))
  const quantities = rows.slice(0, -1).map((entry) => entry.cantidadEquivalencia)

  if (labels.some((value) => !value) || quantities.some((value) => typeof value !== 'number')) {
    return {
      hasEnoughData: false,
      equivalenceText: 'Completa las presentaciones y cantidades para ver la equivalencia.',
      totalText: '',
      perUnitText: '',
      baseUnits: null,
      relationTexts: [],
    }
  }

  let cumulativeFactor = 1
  const segments = [`1 ${labels[0]}`]
  const relationTexts: string[] = []

  for (let index = 0; index < quantities.length; index += 1) {
    const quantity = quantities[index] as number
    const currentLabel = labels[index]
    const nextLabel = labels[index + 1]
    cumulativeFactor *= quantity
    segments.push(`${cumulativeFactor.toLocaleString('es-PE')} ${nextLabel}`)
    relationTexts.push(`1 ${currentLabel} contiene ${quantity.toLocaleString('es-PE')} ${nextLabel}`)
  }

  const equivalenceText = segments.join(' = ')
  const baseLabel = labels[labels.length - 1]
  const firstLabel = labels[0]
  const totalText = `1 ${firstLabel} contiene ${cumulativeFactor.toLocaleString(
    'es-PE',
  )} ${baseLabel} en total.`
  const perUnitText = cumulativeFactor > 1 ? `Cada ${baseLabel} es 1/${cumulativeFactor.toLocaleString('es-PE')} de 1 ${firstLabel}.` : ''

  return {
    hasEnoughData: true,
    equivalenceText,
    totalText,
    perUnitText,
    baseUnits: cumulativeFactor,
    relationTexts,
  }
}

export type PurchasePresentationOption = {
  id: string
  name: string
  isBase: boolean
  allowsPurchase: boolean
  factorToBase: number | null
}

export function buildPurchasePresentationChain(
  presentations: PurchasePresentationOption[] | undefined | null,
  selectedPurchasePresentationId: string | null | undefined,
): PackagingChainRow[] {
  if (!presentations || presentations.length === 0) return []

  const sorted = [...presentations].sort((a, b) => {
    const aFactor = a.factorToBase ?? 1
    const bFactor = b.factorToBase ?? 1
    if (a.isBase && !b.isBase) return 1
    if (!a.isBase && b.isBase) return -1
    return bFactor - aFactor
  })

  const ordered: PurchasePresentationOption[] = []
  const startId =
    selectedPurchasePresentationId && presentations.some((p) => p.id === selectedPurchasePresentationId)
      ? selectedPurchasePresentationId
      : sorted[0]?.id

  if (!startId) return []

  const visited = new Set<string>()
  let currentId: string | null = startId
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    const cur = presentations.find((p) => p.id === currentId)
    if (cur) {
      ordered.unshift(cur)
      if (cur.isBase) break
      const nextFactor = cur.factorToBase ?? 1
      const candidates = presentations.filter((p) => {
        if (visited.has(p.id)) return false
        if (!cur.factorToBase || cur.factorToBase === 1) return p.isBase
        const ratio = cur.factorToBase / (p.factorToBase || 1)
        return Number.isInteger(ratio) && ratio > 1
      })
      const next = candidates.sort((a, b) => (b.factorToBase || 1) - (a.factorToBase || 1))[0]
      currentId = next?.id ?? null
      if (!next && ordered.length > 0 && !ordered[0].isBase) {
        const base = presentations.find((p) => p.isBase)
        if (base && !visited.has(base.id)) {
          ordered.unshift(base)
        }
        break
      }
      void nextFactor
    } else {
      break
    }
  }

  const chain: PackagingChainRow[] = ordered.map((entry, idx) => ({
    presentacionId: entry.id,
    cantidadEquivalencia: idx === 0 ? null : 0,
  }))

  for (let idx = 1; idx < ordered.length; idx += 1) {
    const upper = ordered[idx - 1]
    const lower = ordered[idx]
    const upperFactor = upper.factorToBase ?? 1
    const lowerFactor = lower.factorToBase ?? 1
    const quantity = lower.isBase ? upperFactor : upperFactor / lowerFactor
    chain[idx - 1 < 0 ? 0 : idx] = {
      ...chain[idx],
      presentacionId: chain[idx]?.presentacionId ?? ordered[idx - 1].id,
      cantidadEquivalencia: Number.isFinite(quantity) && quantity > 0 ? Math.round(quantity) : null,
    }
  }

  for (let idx = chain.length - 1; idx >= 1; idx -= 1) {
    const upper = ordered[idx - 1]
    const lower = ordered[idx]
    const upperFactor = upper.factorToBase ?? 1
    const lowerFactor = lower.factorToBase ?? 1
    const quantity = lowerFactor === 1 ? upperFactor : upperFactor / lowerFactor
    chain[idx - 1] = {
      presentacionId: upper.id,
      cantidadEquivalencia: Number.isFinite(quantity) && quantity > 0 ? Math.round(quantity) : null,
    }
  }

  if (chain.length > 0) {
    const last = ordered[ordered.length - 1]
    chain[chain.length - 1] = {
      presentacionId: last.id,
      cantidadEquivalencia: chain[chain.length - 1].cantidadEquivalencia ?? null,
    }
  }

  return chain
}

export function resolveLabelForPresentationId(
  presentations: PurchasePresentationOption[] | undefined | null,
  presentationId: string | null | undefined,
): string {
  if (!presentationId || !presentations?.length) return ''
  return presentations.find((p) => p.id === presentationId)?.name ?? ''
}
