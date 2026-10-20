import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pushSchema } from 'drizzle-kit/api'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { TestProject } from 'vitest/node'
import * as schema from '../server/db/schemas'

function findDatabaseScript(directory: string): string {
  const script = join(directory, 'start-database.sh')
  if (existsSync(script)) return script
  const parent = dirname(directory)
  if (parent === directory) throw new Error('start-database.sh not found')
  return findDatabaseScript(parent)
}

export default async function setup(project: TestProject): Promise<void> {
  const envFile = existsSync('.env.test.local') ? '.env.test.local' : '.env.test'
  execFileSync(findDatabaseScript(process.cwd()), [resolve(envFile)], { stdio: 'inherit' })

  const url = project.config.env.DATABASE_URL
  if (url === undefined || url === '') throw new Error('DATABASE_URL is missing from .env.test')

  const db = drizzle(url)
  await db.execute(sql`drop schema if exists public cascade`)
  await db.execute(sql`create schema public`)
  const { apply } = await pushSchema(schema, db)
  await apply()
  await db.$client.end()
}
