import { and, type Column, eq, gt, lt, or, type SQL } from 'drizzle-orm'

export type SortDirection = 'asc' | 'desc'

export const escapeLike = (value: string): string =>
  value.replaceAll(/[\\%_]/gu, (char) => `\\${char}`)

export const encodeCursor = (value: string, id: string): string =>
  Buffer.from(JSON.stringify([value, id])).toString('base64url')

export const decodeCursor = (
  cursor: string,
): { readonly value: string; readonly id: string } | null => {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString())
    if (!Array.isArray(parsed)) return null
    const [value, id] = parsed
    if (typeof value !== 'string' || typeof id !== 'string') return null
    return { value, id }
  } catch {
    return null
  }
}

export const keysetCondition = ({
  sortColumn,
  idColumn,
  direction,
  cursor,
  toComparable,
}: {
  readonly sortColumn: Column
  readonly idColumn: Column
  readonly direction: SortDirection
  readonly cursor: string
  readonly toComparable: (value: string) => unknown
}): SQL | undefined => {
  const decoded = decodeCursor(cursor)
  if (!decoded) return undefined

  const comparable = toComparable(decoded.value)
  const compare = direction === 'asc' ? gt : lt

  return or(
    compare(sortColumn, comparable),
    and(eq(sortColumn, comparable), compare(idColumn, decoded.id)),
  )
}

export const takePage = <T>({
  rows,
  limit,
  getSortValue,
  getId,
}: {
  readonly rows: readonly T[]
  readonly limit: number
  readonly getSortValue: (row: T) => string
  readonly getId: (row: T) => string
}): { readonly items: T[]; readonly nextCursor: string | null } => {
  if (rows.length <= limit) {
    return { items: [...rows], nextCursor: null }
  }

  const items = rows.slice(0, limit)
  const last = items.at(-1)
  if (last === undefined) return { items, nextCursor: null }
  return { items, nextCursor: encodeCursor(getSortValue(last), getId(last)) }
}
