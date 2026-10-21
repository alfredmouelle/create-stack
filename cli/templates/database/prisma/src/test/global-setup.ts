import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { Client } from 'pg'
import type { TestProject } from 'vitest/node'

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

  const schema = execFileSync(
    'npx',
    ['--no-install', 'prisma', 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema', '--script'],
    { encoding: 'utf8' },
  )
  const client = new Client({ connectionString: url })
  await client.connect()
  await client.query(`drop schema if exists public cascade; create schema public; ${schema}`)
  await client.end()
}
