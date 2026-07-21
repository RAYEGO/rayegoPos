import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CategoryTreeNode } from './types'

export type CategoryNodeProps = {
  node: CategoryTreeNode
  depth: number
  expanded: boolean
  selected: boolean
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  highlight: boolean
  forceExpand: boolean
}

export function CategoryNode({
  node,
  depth,
  expanded,
  selected,
  onToggle,
  onSelect,
  highlight,
  forceExpand,
}: CategoryNodeProps) {
  const hasChildren = node.children.length > 0
  const isExpanded = expanded || forceExpand

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-2 py-1.5',
        selected ? 'bg-muted/60' : 'hover:bg-muted/40',
      )}
      style={{ paddingLeft: `${Math.max(8, 8 + depth * 14)}px` }}
    >
      {hasChildren ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={() => onToggle(node.id)}
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      ) : (
        <div className="h-7 w-7" />
      )}

      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={() => onSelect(node.id)}
      >
        {isExpanded ? (
          <FolderOpen className={cn('h-4 w-4', selected ? 'text-primary' : 'text-muted-foreground')} />
        ) : (
          <Folder className={cn('h-4 w-4', selected ? 'text-primary' : 'text-muted-foreground')} />
        )}

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate text-sm',
              highlight ? 'font-semibold text-foreground' : 'text-foreground',
              !node.record.active && 'text-muted-foreground',
            )}
          >
            {node.record.name}
          </p>
        </div>
      </button>

      <div className="flex items-center gap-1">
        {hasChildren ? (
          <Badge variant="outline" className="hidden text-[10px] md:inline-flex">
            {node.children.length}
          </Badge>
        ) : null}
        <Badge variant="outline" className="text-[10px]">
          {node.record.productCount}
        </Badge>
      </div>
    </div>
  )
}
