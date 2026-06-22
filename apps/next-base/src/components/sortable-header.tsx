import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Button } from '~/components/ui/button'

export interface SortState<Field extends string> {
  field: Field
  direction: 'asc' | 'desc'
}

interface SortableHeaderProps<Field extends string> {
  label: string
  field: Field
  sort: SortState<Field>
  onSort: (field: Field) => void
}

export function SortableHeader<Field extends string>({
  label,
  field,
  sort,
  onSort,
}: SortableHeaderProps<Field>) {
  const active = sort.field === field
  const Icon = active ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown

  return (
    <Button
      className="-ml-2 h-8 cursor-pointer text-muted-foreground data-[active=true]:text-foreground"
      data-active={active}
      onClick={() => onSort(field)}
      size="sm"
      variant="ghost"
    >
      {label}
      <Icon className="size-3.5" />
    </Button>
  )
}
