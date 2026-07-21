import { useMemo } from 'react'
import { Copy, Edit, MoreVertical, Power, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Card, CardContent } from '@/components/ui/card'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { MasterRecord } from './catalogs'

export type MasterTableProps = {
  rows: MasterRecord[]
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onEdit: (row: MasterRecord) => void
  onDuplicate: (row: MasterRecord) => void
  onToggleStatus: (row: MasterRecord) => void
  onDelete: (row: MasterRecord) => void
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export function MasterTable({
  rows,
  page,
  pageSize,
  onPageChange,
  onEdit,
  onDuplicate,
  onToggleStatus,
  onDelete,
}: MasterTableProps) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(Math.max(1, page), totalPages)

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return rows.slice(start, start + pageSize)
  }, [currentPage, pageSize, rows])

  return (
    <Card className="rounded-xl border bg-card shadow-softSm">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Código</TableHead>
              <TableHead className="min-w-[220px]">Nombre</TableHead>
              <TableHead className="hidden lg:table-cell">Descripción</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden md:table-cell">Productos</TableHead>
              <TableHead className="hidden xl:table-cell">Creación</TableHead>
              <TableHead className="w-[80px] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedRows.map((row) => (
              <TableRow key={row.id} className={cn(!row.active && 'opacity-70')}>
                <TableCell className="font-medium text-foreground">{row.code}</TableCell>
                <TableCell className="min-w-0">
                  <p className="font-medium text-foreground">{row.name}</p>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <p className="text-sm text-muted-foreground line-clamp-1">{row.description}</p>
                </TableCell>
                <TableCell>
                  <Badge variant={row.active ? 'success' : 'outline'}>
                    {row.active ? 'ACTIVO' : 'INACTIVO'}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {row.productCount}
                </TableCell>
                <TableCell className="hidden xl:table-cell text-muted-foreground">
                  {formatDateTime(row.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(row)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDuplicate(row)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onToggleStatus(row)}>
                        <Power className="h-4 w-4 mr-2" />
                        {row.active ? 'Desactivar' : 'Activar'}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => onDelete(row)}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {totalPages > 1 ? (
          <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Página {currentPage} de {totalPages} · {rows.length.toLocaleString('es-PE')} registros
            </p>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage <= 1}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink isActive>{currentPage}</PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage >= totalPages}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

