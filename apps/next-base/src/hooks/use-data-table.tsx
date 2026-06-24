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
  // persist column visibility under `data-table-visibility-<key>`; omit to disable
  storage?: { key: string; defaultVisibility?: VisibilityState }
  // extra useReactTable options (pagination, row selection, …); the sorting/filter/
  // visibility wiring below always wins so the hook stays in control of its own state.
  options?: Omit<Partial<TableOptions<TData>>, 'data' | 'columns'>
}

const storageKey = (key: string) => `data-table-visibility-${key}`

// Read persisted visibility, tolerating absent/corrupt storage (SSR, private mode, bad JSON).
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

/**
 * Build a client-side TanStack table (sorting + filtering + column visibility) ready to hand
 * to <DataTable />. Column visibility is persisted to localStorage when `storage.key` is set.
 * Server-driven / infinite data is <InfiniteDataTable />'s job, not this hook's.
 */
export function useDataTable<TData>({ data, columns, storage, options }: UseDataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    storage?.defaultVisibility ?? {},
  )

  // localStorage is client-only; hydrate after mount so SSR markup stays stable.
  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    setIsClient(true)
  }, [])

  // load once the client is up: merge over defaults so columns added later keep their default.
  useEffect(() => {
    if (!isClient || !storage?.key) return
    const stored = readVisibility(storage.key)
    if (stored) setColumnVisibility((prev) => ({ ...prev, ...stored }))
  }, [isClient, storage?.key])

  // persist on change (best-effort — quota/serialization failures are swallowed).
  useEffect(() => {
    if (!isClient || !storage?.key) return
    try {
      localStorage.setItem(storageKey(storage.key), JSON.stringify(columnVisibility))
    } catch {
      // best-effort persistence
    }
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
