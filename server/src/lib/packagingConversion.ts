export type ConversionEdge = {
  fromPresentationId: string
  toPresentationId: string
  quantity: number
}

export function resolveConversionFactor(
  fromPresentationId: string,
  toPresentationId: string,
  edges: ConversionEdge[],
) {
  if (fromPresentationId === toPresentationId) {
    return 1
  }

  const adjacency = new Map<string, ConversionEdge[]>()
  for (const edge of edges) {
    if (!adjacency.has(edge.fromPresentationId)) {
      adjacency.set(edge.fromPresentationId, [])
    }
    adjacency.get(edge.fromPresentationId)!.push(edge)
  }

  for (const list of adjacency.values()) {
    list.sort((left, right) => {
      if (left.toPresentationId !== right.toPresentationId) {
        return left.toPresentationId.localeCompare(right.toPresentationId)
      }
      return left.quantity - right.quantity
    })
  }

  const visited = new Set<string>([fromPresentationId])
  const queue: Array<{ id: string; factor: number }> = [{ id: fromPresentationId, factor: 1 }]

  while (queue.length > 0) {
    const current = queue.shift()!
    const outgoing = adjacency.get(current.id) ?? []

    for (const edge of outgoing) {
      if (visited.has(edge.toPresentationId)) {
        continue
      }

      const nextFactor = current.factor * edge.quantity
      if (edge.toPresentationId === toPresentationId) {
        return nextFactor
      }

      visited.add(edge.toPresentationId)
      queue.push({ id: edge.toPresentationId, factor: nextFactor })
    }
  }

  return null
}

