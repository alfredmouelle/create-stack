import { chmodSync } from 'node:fs'
import type { Database } from '@alfredmouelle/stack-config'
import { readJsonObject, writeJsonObject } from '../javascript/json.ts'
import { packageName } from './identity.ts'
import { TEMPLATES } from './paths.ts'
import { copy, editFile, exists, join, read, write } from './util.ts'

export const DATABASES = ['drizzle', 'prisma', 'convex'] as const satisfies readonly Database[]
export const DEFAULT_DATABASE = 'drizzle' satisfies Database

export function resolveDatabase(value: unknown): Database {
  if (value === 'none') return 'none'
  if (value === true || value == null || value === '') return DEFAULT_DATABASE
  const database = DATABASES.find((candidate) => candidate === value)
  if (!database) {
    throw new Error(`Unknown database: ${value} (have ${DATABASES.join(', ')}, none)`)
  }
  return database
}

export const PRISMA_VERSION = '7.10.0'

export const CONVEX_VERSION = '1.46.0'

export const isSqlDatabase = (database: Database): boolean =>
  database === 'drizzle' || database === 'prisma'

export const localDatabaseUrl = (projectName: string): string =>
  `postgres://postgres:postgres@localhost:5432/${packageName(projectName)}`

export const localTestDatabaseUrl = (projectName: string): string =>
  `postgres://postgres:postgres@localhost:5433/${packageName(projectName)}_test`

export function writeDatabaseScript({
  projectDir,
  envPath = '.env',
}: {
  readonly projectDir: string
  readonly envPath?: string
}): void {
  const scriptPath = join(projectDir, 'start-database.sh')
  copy(join(TEMPLATES, 'start-database.sh'), scriptPath)
  editFile(scriptPath, (content) => content.replace('__ENV_FILE__', envPath))
  chmodSync(scriptPath, 0o755)
}

function gitignoreGenerated(projectDir: string): void {
  const path = join(projectDir, '.gitignore')
  if (!exists(path)) return
  const cur = read(path)
  if (cur.includes('/src/generated')) return
  write(path, `${cur.replace(/\n*$/, '')}\n\n# prisma generated client\n/src/generated\n`)
}

const PRISMA_BUILD_DEPS = ['prisma', '@prisma/engines', '@prisma/client']

function allowPrismaBuilds(projectDir: string): void {
  const wsPath = join(projectDir, 'pnpm-workspace.yaml')
  if (exists(wsPath)) {
    const cur = read(wsPath)
    const add = PRISMA_BUILD_DEPS.filter((d) => !cur.includes(d))
    if (add.length) {
      const lines = add.map((d) => `  ${d.includes('/') ? `'${d}'` : d}: true`).join('\n')
      write(wsPath, `${cur.replace(/\n*$/, '')}\n${lines}\n`)
    }
  }

  const pkgPath = join(projectDir, 'package.json')
  const pkg = readJsonObject(pkgPath)
  const trusted = pkg.trustedDependencies
  if (Array.isArray(trusted)) {
    for (const d of PRISMA_BUILD_DEPS) {
      if (!trusted.includes(d)) trusted.push(d)
    }
    writeJsonObject(pkgPath, pkg)
  }
}

export function configurePrismaRuntime(projectDir: string): void {
  gitignoreGenerated(projectDir)
  allowPrismaBuilds(projectDir)
}
