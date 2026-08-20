'use client'

import {
  type ColumnDef,
  type ColumnFiltersState,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  type TableOptions,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table'
import { useEffect, useState } from 'react'

interface UseDataTableProps<TData> {
  data: TData[]
  // biome-ignore lint/suspicious/noExplicitAny: tanstack ColumnDef value type varies per column
  columns: ColumnDef<TData, any>[]
  storage?: { key: string; defaultVisibility?: VisibilityState }
  options?: Omit<Partial<TableOptions<TData>>, 'data' | 'columns'>
}

const storageKey = (key: string) => `data-table-visibility-${key}`

function readVisibility(key: string): VisibilityState | null {
  try {
    const raw = localStorage.getItem(storageKey(key))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as VisibilityState) : null
  } catch {
    return null
  }
}

export function useDataTable<TData>({ data, columns, storage, options }: UseDataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    storage?.defaultVisibility ?? {},
  )

  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient || !storage?.key) return
    const stored = readVisibility(storage.key)
    if (stored) setColumnVisibility((prev) => ({ ...prev, ...stored }))
  }, [isClient, storage?.key])

  useEffect(() => {
    if (!isClient || !storage?.key) return
    try {
      localStorage.setItem(storageKey(storage.key), JSON.stringify(columnVisibility))
    } catch {}
  }, [columnVisibility, storage?.key, isClient])

  const table = useReactTable({
    ...options,
    data,
    columns,
    state: { ...options?.state, sorting, columnFilters, columnVisibility },
    getCoreRowModel: options?.getCoreRowModel ?? getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
  })

  return {
    table,
    sorting,
    setSorting,
    columnFilters,
    setColumnFilters,
    columnVisibility,
    setColumnVisibility,
  }
}
