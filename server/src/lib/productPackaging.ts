import { Prisma } from '@prisma/client'

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

export type PackagingPresentationDefinition = {
  id: string
  name: string
}

export type PackagingPathStep = {
  presentationId: string
  presentationName: string
  quantityToNext: number | null
  nextPresentationId: string | null
  nextPresentationName: string | null
}

export type PackagingSummaryEntry = {
  presentationId: string
  presentationName: string
  factorToBase: number
  path: PackagingPathStep[]
  expression: string
}

export type PackagingBreakdownEntry = {
  presentationId: string
  presentationName: string
  factorToBase: number
  quantity: number
}

export type PackagingAnalysisIssue = {
  code:
    | 'BASE_PRESENTATION_REQUIRED'
    | 'BASE_PRESENTATION_INVALID'
    | 'INVALID_CONVERSION_REFERENCE'
    | 'INVALID_CONVERSION_QUANTITY'
    | 'BASE_PRESENTATION_CANNOT_HAVE_OUTGOING'
    | 'PRESENTATION_REQUIRES_SINGLE_OUTGOING'
    | 'PRESENTATION_HAS_MULTIPLE_OUTGOING'
    | 'CONVERSION_CYCLE'
    | 'CHAIN_DOES_NOT_REACH_BASE'
  message: string
  presentationId?: string
}

export type PackagingAnalysisResult = {
  ok: boolean
  issues: PackagingAnalysisIssue[]
  factorsToBase: Map<string, number | null>
  directConversions: Map<string, PackagingEdge | null>
  summaries: PackagingSummaryEntry[]
}

export type PackagingSnapshotPresentation = {
  id: string
  name: string
  isBase: boolean
  allowsPurchase: boolean
  allowsSale: boolean
  salePrice: number | null
  factorToBase: number | null
}

export type PackagingSnapshot = {
  basePresentationId: string | null
  purchasePresentationId: string | null
  presentations: PackagingSnapshotPresentation[]
}

export type PackagingResolutionResult =
  | {
      ok: true
      basePresentation: ProductPackagingPresentation
      selectedPresentation: ProductPackagingPresentation
      factorToBase: number
      basePresentationId: string
      edges: PackagingEdge[]
    }
  | {
      ok: false
      error: string
    }

export function buildPackagingEdges(conversions: ProductPackagingConversion[]) {
  return conversions.map((entry) => ({
    fromPresentationId: entry.desdePresentacionId,
    toPresentationId: entry.haciaPresentacionId,
    quantity: entry.cantidad,
  }))
}

function formatPackagingExpression(path: PackagingPathStep[]) {
  if (!path.length) {
    return ''
  }

  const segments: string[] = [`1 ${path[0].presentationName}`]
  let accumulatedFactor = 1

  for (const step of path) {
    if (step.quantityToNext === null || !step.nextPresentationName) {
      break
    }

    accumulatedFactor *= step.quantityToNext
    segments.push(`${accumulatedFactor} ${step.nextPresentationName}`)
  }

  return segments.join(' = ')
}

export function analyzePackagingStructure({
  basePresentationId,
  presentations,
  edges,
}: {
  basePresentationId: string
  presentations: PackagingPresentationDefinition[]
  edges: PackagingEdge[]
}): PackagingAnalysisResult {
  const issues: PackagingAnalysisIssue[] = []
  const issueKeys = new Set<string>()

  const addIssue = (issue: PackagingAnalysisIssue) => {
    const key = `${issue.code}:${issue.presentationId ?? ''}:${issue.message}`
    if (issueKeys.has(key)) {
      return
    }

    issueKeys.add(key)
    issues.push(issue)
  }

  const presentationMap = new Map(presentations.map((entry) => [entry.id, entry]))
  const presentationIds = presentations.map((entry) => entry.id)
  const outgoingEdges = new Map<string, PackagingEdge[]>()

  for (const entry of presentations) {
    outgoingEdges.set(entry.id, [])
  }

  if (!basePresentationId) {
    addIssue({
      code: 'BASE_PRESENTATION_REQUIRED',
      message: 'La unidad base es obligatoria para configurar el empaque del producto.',
    })
  } else if (!presentationMap.has(basePresentationId)) {
    addIssue({
      code: 'BASE_PRESENTATION_INVALID',
      message: 'La unidad base debe pertenecer a las presentaciones configuradas del producto.',
      presentationId: basePresentationId,
    })
  }

  for (const edge of edges) {
    if (!presentationMap.has(edge.fromPresentationId)) {
      addIssue({
        code: 'INVALID_CONVERSION_REFERENCE',
        message: 'La conversión usa una presentación origen que no pertenece al producto.',
        presentationId: edge.fromPresentationId,
      })
      continue
    }

    if (!presentationMap.has(edge.toPresentationId)) {
      addIssue({
        code: 'INVALID_CONVERSION_REFERENCE',
        message: 'La conversión usa una presentación destino que no pertenece al producto.',
        presentationId: edge.toPresentationId,
      })
      continue
    }

    if (!Number.isFinite(edge.quantity) || !Number.isInteger(edge.quantity) || edge.quantity <= 0) {
      addIssue({
        code: 'INVALID_CONVERSION_QUANTITY',
        message: 'Las equivalencias deben usar enteros positivos mayores que cero.',
        presentationId: edge.fromPresentationId,
      })
      continue
    }

    outgoingEdges.get(edge.fromPresentationId)?.push(edge)
  }

  for (const id of presentationIds) {
    const outgoing = outgoingEdges.get(id) ?? []

    if (id === basePresentationId) {
      if (outgoing.length > 0) {
        addIssue({
          code: 'BASE_PRESENTATION_CANNOT_HAVE_OUTGOING',
          message: 'La unidad base no puede equivaler a otra presentación.',
          presentationId: id,
        })
      }
      continue
    }

    if (outgoing.length === 0) {
      addIssue({
        code: 'PRESENTATION_REQUIRES_SINGLE_OUTGOING',
        message: 'Cada presentación distinta a la base debe equivaler directamente a otra presentación.',
        presentationId: id,
      })
      continue
    }

    if (outgoing.length > 1) {
      addIssue({
        code: 'PRESENTATION_HAS_MULTIPLE_OUTGOING',
        message: 'Cada presentación solo puede tener una presentación destino para evitar conversiones ambiguas.',
        presentationId: id,
      })
    }
  }

  const factorsToBase = new Map<string, number | null>()
  const pathByPresentationId = new Map<string, PackagingPathStep[] | null>()
  const directConversions = new Map<string, PackagingEdge | null>()

  for (const id of presentationIds) {
    const direct = (outgoingEdges.get(id) ?? [])[0] ?? null
    directConversions.set(id, direct)
  }

  const resolvePath = (
    currentPresentationId: string,
    stack: string[],
  ): PackagingPathStep[] | null => {
    if (pathByPresentationId.has(currentPresentationId)) {
      return pathByPresentationId.get(currentPresentationId) ?? null
    }

    const currentPresentation = presentationMap.get(currentPresentationId)
    if (!currentPresentation) {
      return null
    }

    if (stack.includes(currentPresentationId)) {
      for (const id of [...stack, currentPresentationId]) {
        addIssue({
          code: 'CONVERSION_CYCLE',
          message: 'No se permiten ciclos en la cadena de conversiones del producto.',
          presentationId: id,
        })
      }
      pathByPresentationId.set(currentPresentationId, null)
      factorsToBase.set(currentPresentationId, null)
      return null
    }

    if (currentPresentationId === basePresentationId) {
      const path = [
        {
          presentationId: currentPresentation.id,
          presentationName: currentPresentation.name,
          quantityToNext: null,
          nextPresentationId: null,
          nextPresentationName: null,
        },
      ]
      pathByPresentationId.set(currentPresentationId, path)
      factorsToBase.set(currentPresentationId, 1)
      return path
    }

    const outgoing = outgoingEdges.get(currentPresentationId) ?? []
    if (outgoing.length !== 1) {
      pathByPresentationId.set(currentPresentationId, null)
      factorsToBase.set(currentPresentationId, null)
      return null
    }

    const [edge] = outgoing
    const nextPath = resolvePath(edge.toPresentationId, [...stack, currentPresentationId])

    if (!nextPath) {
      addIssue({
        code: 'CHAIN_DOES_NOT_REACH_BASE',
        message: 'Todas las presentaciones deben resolver una cadena completa hasta la unidad base.',
        presentationId: currentPresentationId,
      })
      pathByPresentationId.set(currentPresentationId, null)
      factorsToBase.set(currentPresentationId, null)
      return null
    }

    const nextFactor = factorsToBase.get(edge.toPresentationId)
    if (
      nextFactor === null ||
      nextFactor === undefined ||
      !Number.isFinite(nextFactor) ||
      !Number.isInteger(nextFactor) ||
      nextFactor <= 0
    ) {
      addIssue({
        code: 'CHAIN_DOES_NOT_REACH_BASE',
        message: 'Todas las presentaciones deben resolver una cadena completa hasta la unidad base.',
        presentationId: currentPresentationId,
      })
      pathByPresentationId.set(currentPresentationId, null)
      factorsToBase.set(currentPresentationId, null)
      return null
    }

    const path: PackagingPathStep[] = [
      {
        presentationId: currentPresentation.id,
        presentationName: currentPresentation.name,
        quantityToNext: edge.quantity,
        nextPresentationId: edge.toPresentationId,
        nextPresentationName: presentationMap.get(edge.toPresentationId)?.name ?? null,
      },
      ...nextPath,
    ]

    pathByPresentationId.set(currentPresentationId, path)
    factorsToBase.set(currentPresentationId, edge.quantity * nextFactor)
    return path
  }

  for (const presentation of presentations) {
    if (!factorsToBase.has(presentation.id)) {
      resolvePath(presentation.id, [])
    }
  }

  const summaries = presentations
    .map((presentation) => {
      const factorToBase = factorsToBase.get(presentation.id)
      const path = pathByPresentationId.get(presentation.id)

      if (
        factorToBase === null ||
        factorToBase === undefined ||
        !path ||
        !Number.isFinite(factorToBase) ||
        !Number.isInteger(factorToBase) ||
        factorToBase <= 0
      ) {
        return null
      }

      return {
        presentationId: presentation.id,
        presentationName: presentation.name,
        factorToBase,
        path,
        expression: formatPackagingExpression(path),
      }
    })
    .filter((entry): entry is PackagingSummaryEntry => entry !== null)
    .sort((left, right) => right.factorToBase - left.factorToBase)

  for (const presentation of presentations) {
    if (!factorsToBase.has(presentation.id)) {
      factorsToBase.set(presentation.id, null)
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    factorsToBase,
    directConversions,
    summaries,
  }
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
  const factor = analyzePackagingStructure({
    basePresentationId,
    presentations: Array.from(
      new Set([basePresentationId, presentationId, ...edges.map((entry) => entry.fromPresentationId), ...edges.map((entry) => entry.toPresentationId)]),
    ).map((id) => ({
      id,
      name: id,
    })),
    edges,
  }).factorsToBase.get(presentationId)

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
  const analysis = analyzePackagingStructure({
    basePresentationId,
    presentations: presentationIds.map((id) => ({
      id,
      name: id,
    })),
    edges,
  })

  for (const id of presentationIds) {
    factors.set(id, analysis.factorsToBase.get(id) ?? null)
  }
  return factors
}

export function buildPackagingSnapshot({
  presentations,
  conversions,
  purchasePresentationId,
}: {
  presentations: ProductPackagingPresentation[]
  conversions: ProductPackagingConversion[]
  purchasePresentationId?: string | null
}): PackagingSnapshot | null {
  const basePresentation = resolveBasePresentation(presentations)
  const basePresentationId = basePresentation?.presentacion.id ?? null

  if (!basePresentationId) {
    return null
  }

  const edges = buildPackagingEdges(conversions)
  const factors = resolvePresentationFactors({
    basePresentationId,
    presentationIds: presentations.map((entry) => entry.presentacion.id),
    edges,
  })

  return {
    basePresentationId,
    purchasePresentationId: purchasePresentationId ?? basePresentationId,
    presentations: presentations.map((entry) => ({
      id: entry.presentacion.id,
      name: entry.presentacion.nombre,
      isBase: entry.esBase,
      allowsPurchase: entry.permiteCompra,
      allowsSale: entry.permiteVenta,
      salePrice:
        entry.precioVenta === null || entry.precioVenta === undefined
          ? null
          : Number(entry.precioVenta),
      factorToBase: factors.get(entry.presentacion.id) ?? null,
    })),
  }
}

export function resolvePackagingOperationContext({
  operation,
  presentationId,
  presentations,
  conversions,
  missingBaseMessage = 'El producto no tiene una presentación base configurada.',
  unresolvedFactorMessage = 'No fue posible resolver la conversión hacia la presentación base del producto.',
}: {
  operation: PackagingOperation
  presentationId: string
  presentations: ProductPackagingPresentation[]
  conversions: ProductPackagingConversion[]
  missingBaseMessage?: string
  unresolvedFactorMessage?: string
}): PackagingResolutionResult {
  const basePresentation = resolveBasePresentation(presentations)
  if (!basePresentation) {
    return {
      ok: false,
      error: missingBaseMessage,
    }
  }

  const selectedPresentation = resolvePresentationEntry({
    operation,
    presentationId,
    presentations,
  })

  if (!selectedPresentation.ok) {
    return selectedPresentation
  }

  const edges = buildPackagingEdges(conversions)
  const factorToBase = resolveFactorToBase({
    presentationId,
    basePresentationId: basePresentation.presentacion.id,
    edges,
  })

  if (!factorToBase) {
    return {
      ok: false,
      error: unresolvedFactorMessage,
    }
  }

  return {
    ok: true,
    basePresentation,
    selectedPresentation: selectedPresentation.entry,
    factorToBase,
    basePresentationId: basePresentation.presentacion.id,
    edges,
  }
}

export function convertQuantityToBaseUnits({
  quantity,
  factorToBase,
}: {
  quantity: number
  factorToBase: number
}) {
  const converted = quantity * factorToBase
  if (!Number.isFinite(converted) || converted <= 0) {
    return null
  }
  return converted
}

export function convertAmountToBaseUnit({
  amount,
  factorToBase,
}: {
  amount: number
  factorToBase: number
}) {
  const converted = amount / factorToBase
  if (!Number.isFinite(converted) || converted < 0) {
    return null
  }
  return converted
}

export function buildPackagingSummaries({
  basePresentationId,
  presentations,
  edges,
}: {
  basePresentationId: string
  presentations: PackagingPresentationDefinition[]
  edges: PackagingEdge[]
}) {
  return analyzePackagingStructure({
    basePresentationId,
    presentations,
    edges,
  }).summaries
}

export function decomposeStockInBaseUnits({
  stockInBaseUnits,
  basePresentationId,
  presentations,
  edges,
}: {
  stockInBaseUnits: number
  basePresentationId: string
  presentations: PackagingPresentationDefinition[]
  edges: PackagingEdge[]
}) {
  if (!Number.isFinite(stockInBaseUnits) || stockInBaseUnits < 0) {
    return []
  }

  const analysis = analyzePackagingStructure({
    basePresentationId,
    presentations,
    edges,
  })

  if (!analysis.ok) {
    return []
  }

  let remainingUnits = Math.trunc(stockInBaseUnits)

  return [...analysis.summaries]
    .sort((left, right) => right.factorToBase - left.factorToBase)
    .map((summary) => {
      const quantity = Math.floor(remainingUnits / summary.factorToBase)
      remainingUnits -= quantity * summary.factorToBase

      return {
        presentationId: summary.presentationId,
        presentationName: summary.presentationName,
        factorToBase: summary.factorToBase,
        quantity,
      }
    })
    .filter((entry) => entry.quantity > 0)
}
