import { Search, SlidersHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

export type MasterStatusFilter = 'TODOS' | 'ACTIVOS' | 'INACTIVOS'

export type MasterToolbarProps = {
  query: string
  onQueryChange: (value: string) => void
  placeholder: string
  status: MasterStatusFilter
  onStatusChange: (value: MasterStatusFilter) => void
}

export function MasterToolbar({
  query,
  onQueryChange,
  placeholder,
  status,
  onStatusChange,
}: MasterToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-softSm md:flex-row md:items-center md:justify-between">
      <div className="relative w-full md:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={status} onValueChange={(value) => onStatusChange(value as MasterStatusFilter)}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos</SelectItem>
            <SelectItem value="ACTIVOS">Activos</SelectItem>
            <SelectItem value="INACTIVOS">Inactivos</SelectItem>
          </SelectContent>
        </Select>

        <Button type="button" variant="outline" className="w-full sm:w-auto" disabled>
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
        </Button>
      </div>
    </div>
  )
}

