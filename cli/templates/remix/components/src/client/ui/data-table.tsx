import { on } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'

export type Column<Row> = {
  readonly id: string
  readonly label: string
  readonly value: (row: Row) => string | number
  readonly render?: (row: Row) => RemixNode
  readonly sortable?: boolean
}

export type DataTableProps<Row> = {
  readonly rows: readonly Row[]
  readonly columns: readonly Column<Row>[]
  readonly getRowId: (row: Row) => string
  readonly emptyLabel?: string
  readonly isLoading?: boolean
}

function ColumnVisibility(handle: Handle<{
  readonly columns: readonly { readonly id: string; readonly label: string }[]
  readonly hidden: ReadonlySet<string>
  readonly toggle: (id: string, visible: boolean) => void
}>) {
  return () => <details><summary class="cursor-pointer text-sm">Columns</summary><div class="flex flex-wrap gap-3 p-2">{handle.props.columns.map((entry) => <label key={entry.id} class="flex items-center gap-2 text-sm"><input type="checkbox" checked={!handle.props.hidden.has(entry.id)} disabled={!handle.props.hidden.has(entry.id) && handle.props.columns.length - handle.props.hidden.size === 1} mix={on('change', (event) => { handle.props.toggle(entry.id, event.currentTarget.checked) })} />{entry.label}</label>)}</div></details>
}

function sortRows<Row>(rows: readonly Row[], column: Column<Row> | undefined, direction: 'ascending' | 'descending' | undefined): Row[] {
  const sorted = [...rows]
  if (column && direction) sorted.sort((left, right) => {
    const a = column.value(left)
    const b = column.value(right)
    const order = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))
    return direction === 'ascending' ? order : -order
  })
  return sorted
}

function sortIndicator(direction: 'ascending' | 'descending' | undefined): string {
  if (direction === 'ascending') return ' ↑'
  return direction === 'descending' ? ' ↓' : ''
}

export function createDataTable<Row>() {
  return function DataTable(handle: Handle<DataTableProps<Row>>) {
    let sort: { id: string; direction: 'ascending' | 'descending' } | undefined
    const hidden = new Set<string>()
    return () => {
      const columns = handle.props.columns.filter((column) => !hidden.has(column.id))
      const sorted = sortRows(handle.props.rows, handle.props.columns.find((entry) => entry.id === sort?.id), sort?.direction)
      return <div class="grid gap-3"><ColumnVisibility columns={handle.props.columns} hidden={hidden} toggle={(id, visible) => { if (visible) hidden.delete(id); else hidden.add(id); void handle.update() }} /><div class="overflow-auto rounded-lg border border-border"><table class="w-full text-left text-sm"><thead class="border-b border-border bg-muted/50"><tr>{columns.map((entry) => <th key={entry.id} class="px-4 py-3 font-medium" aria-sort={sort?.id === entry.id ? sort.direction : 'none'}>{entry.sortable === false ? entry.label : <button type="button" class="cursor-pointer hover:underline" mix={on('click', () => { sort = { id: entry.id, direction: sort?.id === entry.id && sort.direction === 'ascending' ? 'descending' : 'ascending' }; void handle.update() })}>{entry.label}{sortIndicator(sort?.id === entry.id ? sort.direction : undefined)}</button>}</th>)}</tr></thead><tbody>{handle.props.isLoading === true ? <tr><td class="h-24 text-center text-muted-foreground" colSpan={columns.length}><output>Loading…</output></td></tr> : sorted.length === 0 ? <tr><td class="h-24 text-center text-muted-foreground" colSpan={columns.length}>{handle.props.emptyLabel ?? 'No results.'}</td></tr> : sorted.map((row) => <tr key={handle.props.getRowId(row)} class="border-b border-border last:border-0 hover:bg-muted/50">{columns.map((entry) => <td key={entry.id} class="px-4 py-3">{entry.render ? entry.render(row) : entry.value(row)}</td>)}</tr>)}</tbody></table></div></div>
    }
  }
}
