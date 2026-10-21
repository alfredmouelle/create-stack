import { sql } from 'drizzle-orm'
import { afterAll, beforeEach } from 'vitest'
import { db } from '~/server/db'

beforeEach(async () => {
  const { rows } = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  )
  if (rows.length === 0) return
  const tables = rows.map(({ tablename }) => `"${tablename}"`).join(', ')
  await db.execute(sql.raw(`truncate table ${tables} restart identity cascade`))
})

afterAll(async () => {
  await db.$client.end()
})
