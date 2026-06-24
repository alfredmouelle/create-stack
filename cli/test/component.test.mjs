// component engine: vendor an opt-in UI component (stripped from every scaffold) back into
// an existing project from the matching base app, merging its deps. Idempotent re-runs and
// alias alignment are covered here; the typecheck proof lives in smoke.test.mjs.

import { writeFileSync } from 'node:fs'
import { afterAll, describe, expect, test } from 'vitest'
import { build, cleanup, exists, read, readJSON, vendorComponent } from './helpers.mjs'

afterAll(cleanup)

const deps = (dir) => readJSON(`${dir}/package.json`).dependencies

describe('component', () => {
  test('date-picker vendors its files + primitives + deps', () => {
    const { dir } = build({ framework: 'tanstack', foundations: ['drizzle'], mailer: 'none' })
    expect(exists(`${dir}/src/components/ui/date-picker.tsx`), 'stripped by default').toBe(false)

    const res = vendorComponent({ projectDir: dir, name: 'date-picker' })
    expect(res.framework).toBe('tanstack')
    for (const f of ['date-picker', 'date-range-picker', 'calendar', 'popover'])
      expect(exists(`${dir}/src/components/ui/${f}.tsx`), `${f} vendored`).toBe(true)
    expect(exists(`${dir}/src/lib/date.ts`)).toBe(true)
    expect('react-day-picker' in deps(dir)).toBe(true)
    expect('date-fns' in deps(dir)).toBe(true)
  })

  test('datatable vendors its files + hook + react-table (next)', () => {
    const { dir } = build({ framework: 'next', foundations: ['drizzle'], mailer: 'none' })
    const res = vendorComponent({ projectDir: dir, name: 'datatable' })
    expect(res.framework).toBe('next')
    for (const f of ['data-table', 'infinite-data-table', 'sortable-header'])
      expect(exists(`${dir}/src/components/${f}.tsx`), `${f} vendored`).toBe(true)
    expect(exists(`${dir}/src/hooks/use-data-table.tsx`), 'useDataTable vendored').toBe(true)
    expect('@tanstack/react-table' in deps(dir)).toBe(true)
  })

  test('re-vendor never clobbers existing files (idempotent)', () => {
    const { dir } = build({ framework: 'tanstack', foundations: ['drizzle'], mailer: 'none' })
    const first = vendorComponent({ projectDir: dir, name: 'datatable' })
    expect(first.copied.length).toBeGreaterThan(0)

    const second = vendorComponent({ projectDir: dir, name: 'datatable' })
    expect(second.copied).toEqual([])
    expect(second.skipped.length).toBe(first.copied.length)
  })

  test('--force overwrites a locally edited file', () => {
    const { dir } = build({ framework: 'tanstack', foundations: ['drizzle'], mailer: 'none' })
    vendorComponent({ projectDir: dir, name: 'datatable' })
    const file = `${dir}/src/components/data-table.tsx`
    writeFileSync(file, '// local edit\n')

    const res = vendorComponent({ projectDir: dir, name: 'datatable', force: true })
    expect(res.skipped).toEqual([])
    expect(res.copied.length).toBeGreaterThan(0)
    expect(read(file)).not.toBe('// local edit\n') // restored from the base app
  })

  test('aligns vendored imports to a non-default alias', () => {
    const { dir } = build({
      framework: 'tanstack',
      foundations: ['drizzle'],
      mailer: 'none',
      alias: '@',
    })
    vendorComponent({ projectDir: dir, name: 'date-picker' })
    const src = read(`${dir}/src/components/ui/date-picker.tsx`)
    expect(src).toContain("'@/components/ui/button'")
    expect(src).not.toContain("'~/")
  })

  test('rejects an unknown component', () => {
    const { dir } = build({ framework: 'tanstack', foundations: ['drizzle'], mailer: 'none' })
    expect(() => vendorComponent({ projectDir: dir, name: 'nope' })).toThrow()
  })
})
