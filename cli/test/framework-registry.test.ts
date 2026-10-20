import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, test } from 'vitest'
import { FRAMEWORKS } from '../../packages/stack-config/src/index.ts'
import {
  detectFrameworkModule,
  frameworkModules,
  getFrameworkModule,
} from '../src/framework-registry.ts'

const roots: string[] = []

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

function application(manifest?: string): string {
  const root = mkdtempSync(join(tmpdir(), 'create-stack-registry-'))
  roots.push(root)
  if (manifest !== undefined) writeFileSync(join(root, 'package.json'), manifest)
  return root
}

const manifest = (fields: Record<string, unknown>) =>
  JSON.stringify({ name: 'storefront', ...fields })

describe('framework registry', () => {
  test('registers exactly one module per framework declared in stack-config', () => {
    expect(frameworkModules.map((module) => module.id).sort()).toEqual([...FRAMEWORKS].sort())
  })

  test('identifies each registered framework', () => {
    expect(frameworkModules.map(({ id, label, maturity }) => ({ id, label, maturity }))).toEqual([
      { id: 'tanstack', label: 'TanStack Start', maturity: 'stable' },
      { id: 'next', label: 'Next.js', maturity: 'stable' },
    ])
  })

  test('looks a module up by framework id', () => {
    expect(getFrameworkModule('next').label).toBe('Next.js')
    expect(() => getFrameworkModule('remix')).toThrow('Unknown framework: remix')
  })

  test.each([
    ['next', { dependencies: { next: '16.2.0', react: '19.2.0' } }],
    ['tanstack', { dependencies: { '@tanstack/react-start': '1.140.0' } }],
    ['tanstack', { devDependencies: { '@tanstack/react-router': '1.140.0' } }],
  ])('detects a %s application from its manifest', (id, fields) => {
    expect(detectFrameworkModule(application(manifest(fields)))?.id).toBe(id)
  })

  test.each([
    ['an unrecognized application', manifest({ dependencies: { express: '5.1.0' } })],
    ['an invalid manifest', '{ "name": '],
    ['a manifest that is not an object', '["next"]'],
    ['malformed dependency fields', manifest({ dependencies: ['next'] })],
  ])('rejects %s', (_case, contents) => {
    expect(detectFrameworkModule(application(contents))).toBeUndefined()
  })

  test('rejects a directory without a manifest', () => {
    expect(detectFrameworkModule(application())).toBeUndefined()
  })
})

describe('framework modules', () => {
  test.each(frameworkModules.map((module) => [module.id, module] as const))(
    '%s supplies the verification gate commands for the package manager',
    (_id, module) => {
      const packageManager = {
        name: 'pnpm',
        exec: 'pnpm',
        installArgs: ['install', '--no-frozen-lockfile'],
        runArgs: (script: string) => ['run', script],
        devCmd: 'pnpm dev',
      }
      expect(module.gate(packageManager)).toEqual({
        install: { command: 'pnpm', args: ['install', '--no-frozen-lockfile'] },
        format: { command: 'pnpm', args: ['run', 'check:write'] },
        typecheck: { command: 'pnpm', args: ['run', 'typecheck'] },
        lint: { command: 'pnpm', args: ['run', 'check'] },
      })
    },
  )

  test('declare their monorepo outputs and component roots', () => {
    expect(getFrameworkModule('next').monorepoOutputs).toEqual(['.next/**', '!.next/cache/**'])
    expect(getFrameworkModule('tanstack').monorepoOutputs).toEqual([
      '.output/**',
      '.nitro/**',
      'dist/**',
    ])
    expect(getFrameworkModule('next').additions.componentRoot).toBe('src/app/layout.tsx')
    expect(getFrameworkModule('tanstack').additions.componentRoot).toBe('src/routes/__root.tsx')
  })
})
