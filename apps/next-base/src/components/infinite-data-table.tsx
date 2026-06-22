import { flexRender, type Table as ReactTable } from '@tanstack/react-table'
import { Skeleton } from '~/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { cn } from '~/lib/utils'

interface InfiniteDataTableProps<TData> {
  table: ReactTable<TData>
  columnCount: number
  isLoading: boolean
  isRefetching: boolean
  isFetchingNextPage: boolean
  hasFilters: boolean
  emptyLabel: string
  emptyFilteredLabel: string
  sentinelRef: (node: HTMLDivElement | null) => void
}

export function InfiniteDataTable<TData>({
  table,
  columnCount,
  isLoading,
  isRefetching,
  isFetchingNextPage,
  hasFilters,
  emptyLabel,
  emptyFilteredLabel,
  sentinelRef,
}: InfiniteDataTableProps<TData>) {
  const dataRows = table.getRowModel().rows

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border transition-opacity',
        isRefetching && 'opacity-60',
      )}
    >
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? <SkeletonRows columns={columnCount} /> : null}

          {!isLoading && dataRows.length === 0 ? (
            <TableRow>
              <TableCell className="h-24 text-center text-muted-foreground" colSpan={columnCount}>
                {hasFilters ? emptyFilteredLabel : emptyLabel}
              </TableCell>
            </TableRow>
          ) : null}

          {dataRows.map((row) => (
            <TableRow className="group" key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}

          {isFetchingNextPage ? <SkeletonRows columns={columnCount} /> : null}
        </TableBody>
      </Table>
      <div ref={sentinelRef} />
    </div>
  )
}

function SkeletonRows({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 5 }, (_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columns }, (_, cellIndex) => (
            <TableCell key={cellIndex}>
              <Skeleton className="h-6 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}
