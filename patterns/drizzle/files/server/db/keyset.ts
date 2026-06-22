import { and, type Column, eq, gt, lt, or, type SQL } from 'drizzle-orm';

export type SortDirection = 'asc' | 'desc';

export const escapeLike = (value: string): string =>
  value.replace(/[\\%_]/g, (char) => `\\${char}`);

export const encodeCursor = (value: string, id: string): string =>
  Buffer.from(JSON.stringify([value, id])).toString('base64url');

export const decodeCursor = (
  cursor: string,
): { value: string; id: string } | null => {
  try {
    const [value, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    if (typeof value !== 'string' || typeof id !== 'string') return null;
    return { value, id };
  } catch {
    return null;
  }
};

export const keysetCondition = ({
  sortColumn,
  idColumn,
  direction,
  cursor,
  toComparable,
}: {
  sortColumn: Column;
  idColumn: Column;
  direction: SortDirection;
  cursor: string;
  toComparable: (value: string) => unknown;
}): SQL | undefined => {
  const decoded = decodeCursor(cursor);
  if (!decoded) return undefined;

  const comparable = toComparable(decoded.value);
  const compare = direction === 'asc' ? gt : lt;

  return or(
    compare(sortColumn, comparable),
    and(eq(sortColumn, comparable), compare(idColumn, decoded.id)),
  );
};

export const takePage = <T>({
  rows,
  limit,
  getSortValue,
  getId,
}: {
  rows: T[];
  limit: number;
  getSortValue: (row: T) => string;
  getId: (row: T) => string;
}): { items: T[]; nextCursor: string | null } => {
  if (rows.length <= limit) {
    return { items: rows, nextCursor: null };
  }

  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return { items, nextCursor: encodeCursor(getSortValue(last), getId(last)) };
};
