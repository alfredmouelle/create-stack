import { afterAll, beforeEach } from 'vitest'
import { db } from '~/server/db'

beforeEach(async () => {
  const rows = await db.$queryRaw<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public'
  `
  if (rows.length === 0) return
  const tables = rows.map(({ tablename }) => `"${tablename}"`).join(', ')
  await db.$executeRawUnsafe(`truncate table ${tables} restart identity cascade`)
})

afterAll(async () => {
  await db.$disconnect()
})
