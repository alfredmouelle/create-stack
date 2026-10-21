
export type SortDirection = 'asc' | 'desc'

export const escapeLike = (value: string): string => value.replace(/[\\%_]/gu, (char) => `\\${char}`)

export const encodeCursor = (value: string, id: string): string =>
  Buffer.from(JSON.stringify([value, id])).toString('base64url')

export const decodeCursor = (cursor: string): { value: string; id: string } | null => {
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
}): { items: T[]; nextCursor: string | null } => {
  if (rows.length <= limit) {
    return { items: [...rows], nextCursor: null }
  }

  const items = rows.slice(0, limit)
  const last = items.at(-1)
  if (last === undefined) return { items, nextCursor: null }
  return { items, nextCursor: encodeCursor(getSortValue(last), getId(last)) }
}
