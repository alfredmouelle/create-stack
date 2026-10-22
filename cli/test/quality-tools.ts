import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import type { Formatter, Linter } from '@alfredmouelle/stack-config'
import { afterAll, expect, test } from 'vitest'
import { createProject } from '../src/engine.ts'
import type { Monorepo } from '../src/framework-module.ts'
import { frameworkModules } from '../src/framework-registry.ts'

const roots: string[] = []
export const repositoryRoot = resolve(import.meta.dirname, '../..')

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

export async function generate(
  formatter: Formatter,
  linter: Linter,
  framework: (typeof frameworkModules)[number]['id'] = 'next',
  monorepo: Monorepo = false,
  alias = '~',
): Promise<string> {
  const cwd = mkdtempSync(join(tmpdir(), 'create-stack-tools-'))
  roots.push(cwd)
  const projectDir = join(cwd, 'storefront')
  await createProject({
    cwd,
    target: 'storefront',
    name: 'storefront',
    framework,
    database: 'drizzle',
    auth: 'better-auth',
    trpc: true,
    mailer: 'resend',
    formatter,
    linter,
    selectionReasons: {},
    capabilities: {},
    monorepo,
    alias,
    packageManager: {
      name: 'pnpm',
      exec: 'pnpm',
      installArgs: ['install'],
      runArgs: (script) => ['run', script],
      devCmd: 'pnpm dev',
    },
    install: false,
    git: false,
  })
  return projectDir
}

export const combinations = [
  { formatter: 'biome', linter: 'biome' },
  { formatter: 'biome', linter: 'oxlint' },
  { formatter: 'prettier', linter: 'biome' },
  { formatter: 'prettier', linter: 'oxlint' },
] as const

export const shapes: readonly Monorepo[] = [false, 'turborepo', 'nx']

export function linkDependencies(destination: string, source: string): void {
  mkdirSync(destination, { recursive: true })
  if (existsSync(join(source, '.bin')))
    linkDependencies(join(destination, '.bin'), join(source, '.bin'))
  for (const name of readdirSync(source).filter((name) => !name.startsWith('.'))) {
    if (basename(source) === '.bin') {
      const executable = join(source, name).replaceAll("'", "'\\''")
      writeFileSync(join(destination, name), `#!/bin/sh\nexec '${executable}' "$@"\n`, {
        mode: 0o755,
      })
    } else if (name.startsWith('@')) linkDependencies(join(destination, name), join(source, name))
    else if (!existsSync(join(destination, name)))
      symlinkSync(join(source, name), join(destination, name))
  }
}

export function testQualityToolsConformance(monorepo: Monorepo): void {
  test.each(
    frameworkModules.flatMap((framework) =>
      combinations.map((tools) => ({ framework, monorepo, ...tools })),
    ),
  )(
    '$framework.id reference application passes $formatter/$linter conformance, monorepo=$monorepo',
    async ({ framework, monorepo, formatter, linter }) => {
      const reference = framework.referenceApplication
      if (!reference) throw new Error('Missing reference application')
      const cwd = await generate(formatter, linter, framework.id, monorepo)
      const applicationDir = monorepo ? join(cwd, 'apps/web') : cwd
      linkDependencies(join(cwd, 'node_modules'), join(repositoryRoot, 'node_modules'))
      linkDependencies(join(applicationDir, 'node_modules'), join(reference.root, 'node_modules'))
      const run = (tool: string, args: string[]) => {
        const result = spawnSync(join(repositoryRoot, 'node_modules/.bin', tool), args, {
          cwd,
          encoding: 'utf8',
          timeout: 30_000,
          maxBuffer: 4 * 1024 * 1024,
        })
        expect(result.status, result.stdout + result.stderr).toBe(0)
      }

      const typechecked = spawnSync('npm', ['run', 'typecheck'], {
        cwd: applicationDir,
        encoding: 'utf8',
        timeout: 30_000,
      })
      expect(typechecked.status, typechecked.stdout + typechecked.stderr).toBe(0)
      if (formatter === 'prettier') run('prettier', ['--write', '.'])
      else run('biome', ['check', '--write', '--linter-enabled=false', '.'])
      if (formatter === 'prettier') run('prettier', ['--check', '.'])
      if (formatter === 'biome' || linter === 'biome') run('biome', ['check', '.'])
      if (linter === 'oxlint') run('oxlint', ['--type-aware', '.'])
      const ignored = join(applicationDir, 'src/generated/invoice.json')
      mkdirSync(join(applicationDir, 'src/generated'), { recursive: true })
      const invoice = '{"invoiceNumber":"INV-2026-0108"}'
      writeFileSync(ignored, invoice)
      for (const script of ['check:write', 'check']) {
        const result = spawnSync('npm', ['run', script], {
          cwd: applicationDir,
          encoding: 'utf8',
          timeout: 30_000,
          maxBuffer: 4 * 1024 * 1024,
        })
        expect(result.status, result.stdout + result.stderr).toBe(0)
      }
      expect(readFileSync(ignored, 'utf8')).toBe(invoice)
    },
    60_000,
  )
}
