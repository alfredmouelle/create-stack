// The chosen package manager drives makeStandalone: pnpm gets a workspace allowlist,
// bun gets trustedDependencies, npm/yarn need neither.

import { afterAll, describe, expect, test } from 'vitest'
import { build, cleanup, exists, readJSON } from './helpers.mjs'

afterAll(cleanup)

describe('package manager wiring', () => {
  test('pnpm → pnpm-workspace.yaml, no trustedDependencies', () => {
    const { dir } = build({ name: 'with-pnpm', framework: 'tanstack', pm: 'pnpm' })
    expect(exists(`${dir}/pnpm-workspace.yaml`)).toBe(true)
    expect(readJSON(`${dir}/package.json`).trustedDependencies).toBeUndefined()
  })

  test('bun → trustedDependencies, no pnpm-workspace.yaml', () => {
    const { dir } = build({ name: 'with-bun', framework: 'tanstack', pm: 'bun' })
    expect(exists(`${dir}/pnpm-workspace.yaml`)).toBe(false)
    expect(readJSON(`${dir}/package.json`).trustedDependencies).toContain('sharp')
  })

  test('npm → neither workspace file nor trustedDependencies', () => {
    const { dir } = build({ name: 'with-npm', framework: 'next', pm: 'npm' })
    expect(exists(`${dir}/pnpm-workspace.yaml`)).toBe(false)
    expect(readJSON(`${dir}/package.json`).trustedDependencies).toBeUndefined()
  })
})
