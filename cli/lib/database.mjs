import { chmodSync } from 'node:fs'
import { packageName } from './identity.mjs'
import { TEMPLATES } from './paths.mjs'
import { copy, editFile, exists, join, read, readJSON, write, writeJSON } from './util.mjs'

export const DATABASES = ['drizzle', 'prisma', 'convex']
export const DEFAULT_DATABASE = 'drizzle'

export function resolveDatabase(value) {
  if (value === 'none') return 'none'
  if (value === true || value == null || value === '') return DEFAULT_DATABASE
  if (!DATABASES.includes(value)) {
    throw new Error(`Unknown database: ${value} (have ${DATABASES.join(', ')}, none)`)
  }
  return value
}

export const PRISMA_VERSION = '7.10.0'

export const CONVEX_VERSION = '1.46.0'

export const isSqlDatabase = (database) => database === 'drizzle' || database === 'prisma'

export const localDatabaseUrl = (projectName) =>
  `postgres://postgres:postgres@localhost:5432/${packageName(projectName)}`

export const localTestDatabaseUrl = (projectName) =>
  `postgres://postgres:postgres@localhost:5433/${packageName(projectName)}_test`

export function writeDatabaseScript({ projectDir, envPath = '.env' }) {
  const scriptPath = join(projectDir, 'start-database.sh')
  copy(join(TEMPLATES, 'start-database.sh'), scriptPath)
  editFile(scriptPath, (content) => content.replace('__ENV_FILE__', envPath))
  chmodSync(scriptPath, 0o755)
}

function gitignoreGenerated(projectDir) {
  const path = join(projectDir, '.gitignore')
  if (!exists(path)) return
  const cur = read(path)
  if (cur.includes('/src/generated')) return
  write(path, `${cur.replace(/\n*$/, '')}\n\n# prisma generated client\n/src/generated\n`)
}

const PRISMA_BUILD_DEPS = ['prisma', '@prisma/engines', '@prisma/client']

function allowPrismaBuilds(projectDir) {
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
  const pkg = readJSON(pkgPath)
  if (Array.isArray(pkg.trustedDependencies)) {
    for (const d of PRISMA_BUILD_DEPS) {
      if (!pkg.trustedDependencies.includes(d)) pkg.trustedDependencies.push(d)
    }
    writeJSON(pkgPath, pkg)
  }
}

export function configurePrismaRuntime(projectDir) {
  gitignoreGenerated(projectDir)
  allowPrismaBuilds(projectDir)
}
