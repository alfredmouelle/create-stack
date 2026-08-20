import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveInteractiveStack } from '../lib/args.mjs'
import { resolvePackageManager } from '../lib/package-manager.mjs'

const here = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(here, '..', '..')

process.env.CREATE_STACK_STACK_ROOT = REPO_ROOT

const { buildProject } = await import('../lib/build.mjs')
export const { addCapability } = await import('../lib/add.mjs')
export const { vendorComponent } = await import('../lib/component.mjs')

const PM = resolvePackageManager('pnpm')

const tmpRoots = []

export function build(cfg) {
  const dir = mkdtempSync(join(tmpdir(), 'create-stack-test-'))
  tmpRoots.push(dir)
  const projectDir = join(dir, cfg.name ?? 'app')
  const { trpc, database, auth, mailerProvider } = resolveInteractiveStack(
    cfg.trpc ?? true,
    cfg.database,
    cfg.auth,
    cfg.mailer,
  )
  const result = buildProject({
    projectDir,
    projectName: cfg.name ?? 'app',
    framework: cfg.framework,
    trpc,
    database,
    auth,
    mailerProvider,
    capabilities: cfg.capabilities ?? {},
    alias: cfg.alias,
    monorepo: cfg.monorepo ?? false,
    pm: cfg.pm ? resolvePackageManager(cfg.pm) : PM,
  })
  return { dir: projectDir, result }
}

export function cleanup() {
  for (const d of tmpRoots.splice(0)) rmSync(d, { recursive: true, force: true })
}

export const exists = (p) => {
  try {
    statSync(p)
    return true
  } catch {
    return false
  }
}

export const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'))
export const read = (p) => readFileSync(p, 'utf8')

export function walk(dir, base = dir, out = []) {
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

export function srcFiles(projectDir) {
  const srcDir = join(projectDir, 'src')
  if (!exists(srcDir)) return []
  return walk(srcDir, projectDir).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
}

export function filesImporting(projectDir, specifiers) {
  const hits = []
  for (const rel of srcFiles(projectDir)) {
    const body = read(join(projectDir, rel))
    if (specifiers.some((s) => body.includes(s))) hits.push(rel)
  }
  return hits
}
