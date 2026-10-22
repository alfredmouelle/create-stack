import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, test } from 'vitest'
import { verifyRemixProduction } from './remix-runtime.ts'

const roots: string[] = []
const cli = resolve(import.meta.dirname, '../index.mjs')
const cases = [
  { pm: 'pnpm', shape: 'standalone', options: [] },
  { pm: 'npm', shape: 'standalone', options: ['--no-git'] },
  { pm: 'yarn', shape: 'turborepo', options: ['--monorepo', 'turbo', '--no-git'] },
  {
    pm: 'bun',
    shape: 'nx',
    options: ['--monorepo', 'nx', '--formatter', 'prettier', '--linter', 'oxlint', '--no-git'],
  },
]

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

describe.skipIf(process.env.RUN_SMOKE !== '1')('native Remix package managers', () => {
  test.each(cases)(
    '$pm installs, verifies and serves $shape projects',
    async ({ pm, shape, options }) => {
      const root = mkdtempSync(join(tmpdir(), 'create-stack-remix-package-manager-'))
      roots.push(root)
      const result = spawnSync(
        process.execPath,
        [
          cli,
          'customer-portal',
          '--framework',
          'remix',
          '--minimal',
          '--alias',
          '@',
          '--pm',
          pm,
          ...options,
        ],
        { cwd: root, encoding: 'utf8', timeout: 10 * 60 * 1000, maxBuffer: 4 * 1024 * 1024 },
      )
      expect(result.status, result.stdout + result.stderr).toBe(0)
      const project = join(root, 'customer-portal')
      const application = shape === 'standalone' ? project : join(project, 'apps/web')
      expect(readFileSync(join(application, 'tsconfig.json'), 'utf8')).toContain('@/*')
      const lock = {
        pnpm: 'pnpm-lock.yaml',
        npm: 'package-lock.json',
        yarn: 'yarn.lock',
        bun: 'bun.lock',
      }[pm]
      if (lock === undefined) throw new Error('Missing lockfile expectation')
      expect(existsSync(join(project, lock))).toBe(true)
      if (pm === 'pnpm') {
        const committed = spawnSync('git', ['log', '-1', '--format=%B'], {
          cwd: project,
          encoding: 'utf8',
        })
        expect(committed.status).toBe(0)
        expect(committed.stdout).not.toContain('Co-Authored-By')
        expect(existsSync(join(project, '.githooks/pre-commit'))).toBe(true)
      }
      await verifyRemixProduction(application, pm)
    },
    15 * 60 * 1000,
  )
})
