import type { CategoryRecord, CategoryStatsSnapshot, CategoryTreeNode } from './types'

export function buildCategoryTree(records: CategoryRecord[]) {
  const nodeMap = new Map<string, CategoryTreeNode>()
  const roots: CategoryTreeNode[] = []

  for (const record of records) {
    nodeMap.set(record.id, { id: record.id, record, children: [] })
  }

  for (const record of records) {
    const node = nodeMap.get(record.id)
    if (!node) continue

    if (!record.parentId) {
      roots.push(node)
      continue
    }

    const parent = nodeMap.get(record.parentId)
    if (!parent) {
      roots.push(node)
      continue
    }
    parent.children.push(node)
  }

  const sort = (nodes: CategoryTreeNode[]) => {
    nodes.sort((a, b) => {
      const orderDiff = (a.record.order ?? 0) - (b.record.order ?? 0)
      if (orderDiff !== 0) return orderDiff
      return a.record.name.localeCompare(b.record.name, 'es')
    })
    nodes.forEach((node) => sort(node.children))
  }
  sort(roots)

  return { roots, nodeMap }
}

export function getCategoryStats(records: CategoryRecord[]): CategoryStatsSnapshot {
  const rootCount = records.filter((record) => !record.parentId).length
  const subcategoryCount = records.filter((record) => !!record.parentId).length
  const totalCount = records.length
  const productCount = records.reduce((sum, record) => sum + record.productCount, 0)

  return {
    rootCount,
    subcategoryCount,
    totalCount,
    productCount,
  }
}

export function findCategoryAncestors(categoryId: string, records: CategoryRecord[]) {
  const byId = new Map(records.map((record) => [record.id, record]))
  const chain: CategoryRecord[] = []
  let current = byId.get(categoryId) ?? null

  while (current) {
    chain.unshift(current)
    current = current.parentId ? byId.get(current.parentId) ?? null : null
  }

  return chain
}

export function formatCategoryPath(categoryId: string, records: CategoryRecord[]) {
  const chain = findCategoryAncestors(categoryId, records)
  return chain.map((item) => item.name).join(' > ')
}

export function flattenCategoriesForSelect(records: CategoryRecord[]) {
  return records
    .map((record) => ({
      id: record.id,
      label: formatCategoryPath(record.id, records),
      parentId: record.parentId,
      active: record.active,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}

export function filterCategoryTree(
  nodes: CategoryTreeNode[],
  query: string,
): { nodes: CategoryTreeNode[]; matchIds: Set<string>; ancestorIds: Set<string> } {
  const search = normalize(query)
  const matchIds = new Set<string>()
  const ancestorIds = new Set<string>()

  if (!search) {
    return { nodes, matchIds, ancestorIds }
  }

  const walk = (node: CategoryTreeNode): CategoryTreeNode | null => {
    const label = normalize(node.record.name)
    const matches = label.includes(search)

    const nextChildren = node.children
      .map((child) => walk(child))
      .filter((child): child is CategoryTreeNode => Boolean(child))

    if (!matches && nextChildren.length === 0) {
      return null
    }

    if (matches) {
      matchIds.add(node.id)
    }

    if (nextChildren.length > 0) {
      for (const child of nextChildren) {
        ancestorIds.add(node.id)
        if (matchIds.has(child.id) || ancestorIds.has(child.id)) {
          ancestorIds.add(node.id)
        }
      }
    }

    return { ...node, children: nextChildren }
  }

  const filtered = nodes
    .map((node) => walk(node))
    .filter((node): node is CategoryTreeNode => Boolean(node))

  const collectAncestors = (node: CategoryTreeNode, path: string[]) => {
    const nextPath = [...path, node.id]
    if (matchIds.has(node.id)) {
      nextPath.slice(0, -1).forEach((id) => ancestorIds.add(id))
    }
    node.children.forEach((child) => collectAncestors(child, nextPath))
  }
  filtered.forEach((node) => collectAncestors(node, []))

  return { nodes: filtered, matchIds, ancestorIds }
}
