import { writeFileSync } from 'node:fs'
import { afterAll, describe, expect, test } from 'vitest'
import { COMPONENT_CATALOG } from '../lib/registry.mjs'
import { build, cleanup, exists, read, readJSON, vendorComponent } from './helpers.mjs'

afterAll(cleanup)

const deps = (dir) => readJSON(`${dir}/package.json`).dependencies

describe('component', () => {
  test('date-picker declares its shadcn item and primitive dependencies', () => {
    const entry = COMPONENT_CATALOG['date-picker']
    expect(entry.registryDependencies).toEqual(['calendar', 'popover', 'button'])
    expect(entry.files.map((file) => file.path)).toEqual([
      'ui/date-picker.tsx',
      'ui/date-range-picker.tsx',
      'lib/date.ts',
    ])
  })

  test('callables declare separate local items with shared official primitives', () => {
    expect(COMPONENT_CATALOG.confirm.registryDependencies).toEqual(['alert-dialog'])
    expect(COMPONENT_CATALOG.alert.registryDependencies).toEqual(['alert-dialog'])
    expect(COMPONENT_CATALOG.confirm.dependencies).toEqual(['react-call'])
    expect(COMPONENT_CATALOG.alert.dependencies).toEqual(['react-call'])
    expect(COMPONENT_CATALOG.confirm.files.map((file) => file.path)).toEqual(['ui/confirm.tsx'])
    expect(COMPONENT_CATALOG.alert.files.map((file) => file.path)).toEqual(['ui/alert.tsx'])
  })

  test('data-table vendors its files + hook + react-table (next)', () => {
    const { dir } = build({ framework: 'next', trpc: false, mailer: 'none' })
    const res = vendorComponent({ projectDir: dir, name: 'data-table' })
    expect(res.framework).toBe('next')
    for (const f of ['data-table', 'infinite-data-table', 'sortable-header'])
      expect(exists(`${dir}/src/components/${f}.tsx`), `${f} vendored`).toBe(true)
    expect(exists(`${dir}/src/hooks/use-data-table.tsx`), 'useDataTable vendored').toBe(true)
    expect('@tanstack/react-table' in deps(dir)).toBe(true)
  })

  test('re-vendor never clobbers existing files (idempotent)', () => {
    const { dir } = build({ framework: 'tanstack', trpc: false, mailer: 'none' })
    const first = vendorComponent({ projectDir: dir, name: 'data-table' })
    expect(first.copied.length).toBeGreaterThan(0)

    const second = vendorComponent({ projectDir: dir, name: 'data-table' })
    expect(second.copied).toEqual([])
    expect(second.skipped.length).toBe(first.copied.length)
  })

  test('--force overwrites a locally edited file', () => {
    const { dir } = build({ framework: 'tanstack', trpc: false, mailer: 'none' })
    vendorComponent({ projectDir: dir, name: 'data-table' })
    const file = `${dir}/src/components/data-table.tsx`
    writeFileSync(file, '// local edit\n')

    const res = vendorComponent({ projectDir: dir, name: 'data-table', force: true })
    expect(res.skipped).toEqual([])
    expect(res.copied.length).toBeGreaterThan(0)
    expect(read(file)).not.toBe('// local edit\n')
  })

  test('aligns vendored imports to a non-default alias', () => {
    const { dir } = build({
      framework: 'tanstack',
      trpc: false,
      mailer: 'none',
      alias: '@',
    })
    vendorComponent({ projectDir: dir, name: 'data-table' })
    const src = read(`${dir}/src/components/data-table.tsx`)
    expect(src).toContain("'@/components/ui/table'")
    expect(src).not.toContain("'~/")
  })

  test('rejects an unknown component', () => {
    const { dir } = build({ framework: 'tanstack', trpc: false, mailer: 'none' })
    expect(() => vendorComponent({ projectDir: dir, name: 'nope' })).toThrow()
  })
})
