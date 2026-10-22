import { on } from 'remix/component'
import type { Handle } from 'remix/component'
import { createDataTable } from './data-table.tsx'
import type { DataTableProps } from './data-table.tsx'

export function createInfiniteDataTable<Row>() {
  const DataTable = createDataTable<Row>()
  return function InfiniteDataTable(handle: Handle<DataTableProps<Row> & { hasNextPage: boolean; fetchNextPage: () => Promise<unknown> }>) {
  let pending = false
  let error = ''
  return () => <div class="grid gap-4"><DataTable {...handle.props} />{error ? <p role="alert">{error}</p> : null}{handle.props.hasNextPage ? <button type="button" class="cursor-pointer rounded-lg border border-border px-4 py-2 disabled:opacity-50" disabled={pending} mix={on('click', async () => {
    pending = true
    error = ''
    void handle.update()
    try { await handle.props.fetchNextPage() } catch { error = 'Unable to load more results. Try again.' } finally { pending = false; void handle.update() }
  })}>{pending ? 'Loading…' : 'Load more'}</button> : null}</div>
}
}
