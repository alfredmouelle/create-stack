// Test harness shared by build.test.mjs (fast, structural) and smoke.test.mjs (heavy,
// install + verify). Forks the LIVE monorepo source via CREATE_STACK_STACK_ROOT, so a
// stale cli/_stack snapshot never masks a broken base app or strip seam.

import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(here, '..', '..')

// Must be set before lib/paths.mjs is evaluated → dynamic-import buildProject below.
process.env.CREATE_STACK_STACK_ROOT = REPO_ROOT

const { buildProject } = await import('../lib/build.mjs')

const ALL_FOUNDATIONS = ['drizzle', 'trpc', 'better-auth', 'data-table']

/** Pre-resolve hard deps the way index.mjs's normalize() does, so configs stay terse. */
function normalize(picked, mailer) {
  const kept = new Set(picked.filter((f) => ALL_FOUNDATIONS.includes(f)))
  if (kept.has('trpc') || kept.has('better-auth')) kept.add('drizzle')
  let mailerProvider = mailer ?? 'resend'
  if (kept.has('better-auth') && mailerProvider === 'none') mailerProvider = 'resend'
  return { kept, mailerProvider }
}

const PM = {
  name: 'pnpm',
  exec: 'pnpm',
  runArgs: (s) => ['--config.verify-deps-before-run=false', 'run', s],
  devCmd: 'pnpm dev',
}

const tmpRoots = []

/**
 * Build a project from a terse config into a throwaway dir.
 * @param {{ name?: string, framework: 'next'|'tanstack', foundations?: string[],
 *   mailer?: string, capabilities?: Record<string,string> }} cfg
 * @returns {{ dir: string, result: object }}
 */
export function build(cfg) {
  const dir = mkdtempSync(join(tmpdir(), 'create-stack-test-'))
  tmpRoots.push(dir)
  const projectDir = join(dir, cfg.name ?? 'app')
  const { kept, mailerProvider } = normalize(cfg.foundations ?? ALL_FOUNDATIONS, cfg.mailer)
  const result = buildProject({
    projectDir,
    projectName: cfg.name ?? 'app',
    framework: cfg.framework,
    kept,
    mailerProvider,
    capabilities: cfg.capabilities ?? {},
    pm: PM,
  })
  return { dir: projectDir, result }
}

/** Remove every temp dir this run created. */
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

/** All files under a dir (recursive), as paths relative to it. */
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

/** TS/TSX source files (relative paths) under projectDir/src. */
export function srcFiles(projectDir) {
  const srcDir = join(projectDir, 'src')
  if (!exists(srcDir)) return []
  return walk(srcDir, projectDir).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
}

/** Source files that contain any of the given import specifiers — should be empty. */
export function filesImporting(projectDir, specifiers) {
  const hits = []
  for (const rel of srcFiles(projectDir)) {
    const body = read(join(projectDir, rel))
    if (specifiers.some((s) => body.includes(s))) hits.push(rel)
  }
  return hits
}
