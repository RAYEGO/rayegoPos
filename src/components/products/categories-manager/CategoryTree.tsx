import { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { CategoryNode } from './CategoryNode'
import type { CategoryTreeNode } from './types'

export type CategoryTreeProps = {
  nodes: CategoryTreeNode[]
  expandedIds: Set<string>
  forcedExpandedIds: Set<string>
  selectedId: string | null
  matchIds: Set<string>
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  className?: string
}

export function CategoryTree({
  nodes,
  expandedIds,
  forcedExpandedIds,
  selectedId,
  matchIds,
  onToggle,
  onSelect,
  className,
}: CategoryTreeProps) {
  const flatten = useMemo(() => {
    const rows: Array<{ node: CategoryTreeNode; depth: number }> = []

    const walk = (node: CategoryTreeNode, depth: number) => {
      rows.push({ node, depth })
      const isExpanded = expandedIds.has(node.id) || forcedExpandedIds.has(node.id)
      if (node.children.length && isExpanded) {
        node.children.forEach((child) => walk(child, depth + 1))
      }
    }

    nodes.forEach((node) => walk(node, 0))
    return rows
  }, [expandedIds, forcedExpandedIds, nodes])

  return (
    <Card className={cn('rounded-xl border bg-card shadow-softSm', className)}>
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">Árbol de categorías</p>
          <p className="text-xs text-muted-foreground">{flatten.length.toLocaleString('es-PE')}</p>
        </div>
      </div>

      <div className="max-h-[540px] space-y-1 overflow-y-auto p-3">
        {flatten.map(({ node, depth }) => (
          <CategoryNode
            key={node.id}
            node={node}
            depth={depth}
            expanded={expandedIds.has(node.id)}
            forceExpand={forcedExpandedIds.has(node.id)}
            selected={selectedId === node.id}
            highlight={matchIds.has(node.id)}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
      </div>
    </Card>
  )
}

