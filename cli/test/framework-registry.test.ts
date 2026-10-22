import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FRAMEWORKS } from '@alfredmouelle/stack-config'
import { afterAll, describe, expect, test } from 'vitest'
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
  test('supplies the CI smoke matrix as JSON from the registry', () => {
    const result = spawnSync(process.execPath, ['scripts/list-frameworks.ts'], {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
    })
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual(frameworkModules.map(({ id }) => id))
  })
  test('registers exactly one module per framework declared in stack-config', () => {
    expect(frameworkModules.map((module) => module.id).sort()).toEqual([...FRAMEWORKS].sort())
  })

  test('looks a module up by framework id', () => {
    expect(getFrameworkModule('next').id).toBe('next')
    expect(getFrameworkModule('remix').id).toBe('remix')
    expect(() => getFrameworkModule('unknown')).toThrow('Unknown framework: unknown')
  })

  test.each([
    ['remix', { dependencies: { remix: '3.0.0' } }],
    ['remix', { dependencies: { remix: '3.0.0', '@remix-run/component': '1.0.0' } }],
    ['next', { dependencies: { next: '16.2.0', react: '19.2.0' } }],
    ['tanstack', { dependencies: { '@tanstack/react-start': '1.140.0' } }],
    ['tanstack', { devDependencies: { '@tanstack/react-router': '1.140.0' } }],
  ])('detects a %s application from its manifest', (id, fields) => {
    expect(detectFrameworkModule(application(manifest(fields)))?.id).toBe(id)
  })

  test.each([
    ['legacy Remix', manifest({ dependencies: { '@remix-run/react': '2.17.0' } })],
    [
      'legacy Remix compiler',
      manifest({
        dependencies: { remix: '3.0.0' },
        devDependencies: { '@remix-run/dev': '2.17.0' },
      }),
    ],
    [
      'legacy Remix server tooling',
      manifest({ dependencies: { remix: '3.0.0', '@remix-run/serve': '2.17.0' } }),
    ],
    ['an obsolete Remix package', manifest({ dependencies: { remix: '2.17.0' } })],
    ['React Router', manifest({ dependencies: { 'react-router': '8.3.0' } })],
    [
      'mixed Remix and React Router',
      manifest({ dependencies: { remix: '3.0.0', 'react-router': '8.3.0' } }),
    ],
    [
      'mixed Remix and React Router DOM',
      manifest({ dependencies: { remix: '3.0.0', 'react-router-dom': '8.3.0' } }),
    ],
    [
      'mixed Remix and React Router tooling',
      manifest({
        dependencies: { remix: '3.0.0' },
        devDependencies: { '@react-router/node': '8.3.0' },
      }),
    ],
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
