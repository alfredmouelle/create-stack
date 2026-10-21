import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Auth, Database, Framework, Mailer } from '../../packages/stack-config/src/index.ts'
import type { CapabilitySelection, Monorepo } from '../src/framework-module.ts'
import { resolvePackageManager } from '../src/lib/package-manager.ts'
import { readJson } from './json.ts'

const here = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(here, '..', '..')

process.env.CREATE_STACK_STACK_ROOT = REPO_ROOT

const { getFrameworkModule, resolveCreationConfiguration } = await import('../src/index.ts')
export const { addCapability } = await import('../src/index.ts')

const PM = resolvePackageManager('pnpm')

const tmpRoots: string[] = []

export type BuildConfig = {
  readonly name?: string
  readonly framework: Framework
  readonly trpc?: boolean
  readonly database?: Database
  readonly auth?: Auth
  readonly mailer?: Mailer
  readonly capabilities?: CapabilitySelection
  readonly alias?: string
  readonly monorepo?: Monorepo
  readonly pm?: string
}

export async function build(cfg: BuildConfig) {
  const dir = mkdtempSync(join(tmpdir(), 'create-stack-test-'))
  tmpRoots.push(dir)
  const projectDir = join(dir, cfg.name ?? 'app')
  const { trpc, database, auth, mailerProvider } = resolveCreationConfiguration({
    ...(cfg.trpc !== undefined && { trpc: cfg.trpc }),
    ...(cfg.database !== undefined && { database: cfg.database }),
    ...(cfg.auth !== undefined && { auth: cfg.auth }),
    ...(cfg.mailer !== undefined && { mailer: cfg.mailer }),
  })
  const module = getFrameworkModule(cfg.framework)
  const monorepo = cfg.monorepo ?? false
  await module.assemble({
    projectDir,
    trpc,
    database,
    auth,
    mailer: mailerProvider,
    capabilities: cfg.capabilities ?? {},
    alias: cfg.alias ?? '~',
    monorepo,
    packageManager: cfg.pm ? resolvePackageManager(cfg.pm) : PM,
  })
  const result = {
    trpc,
    database,
    auth,
    mailerProvider,
    keptMailer: mailerProvider !== 'none',
    monorepo,
  }
  return { dir: projectDir, result }
}

export function cleanup(): void {
  for (const d of tmpRoots.splice(0)) rmSync(d, { recursive: true, force: true })
}

export const exists = (p: string): boolean => {
  try {
    statSync(p)
    return true
  } catch {
    return false
  }
}

export const readJSON = (p: string): Record<string, unknown> => readJson(p)
export const read = (p: string): string => readFileSync(p, 'utf8')

export function walk(dir: string, base: string = dir, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      walk(abs, base, out)
    } else {
      out.push(abs.slice(base.length + 1))
    }
  }
  return out
}

export function srcFiles(projectDir: string): string[] {
  const srcDir = join(projectDir, 'src')
  if (!exists(srcDir)) return []
  return walk(srcDir, projectDir).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
}

export function filesImporting(projectDir: string, specifiers: readonly string[]): string[] {
  const hits: string[] = []
  for (const rel of srcFiles(projectDir)) {
    const body = read(join(projectDir, rel))
    if (specifiers.some((s) => body.includes(s))) hits.push(rel)
  }
  return hits
}
