import { afterAll, describe, expect, test } from 'vitest'
import { COMPONENTS } from '../lib/component.mjs'
import { COMPONENT_CATALOG } from '../lib/registry.mjs'
import { build, cleanup, vendorComponent } from './helpers.mjs'

afterAll(cleanup)

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

  test('data-table metadata remains available for base stripping without legacy vendoring', () => {
    expect(COMPONENTS['data-table'].files).toEqual(
      COMPONENT_CATALOG['data-table'].files.map(({ destination }) => destination),
    )
    const { dir } = build({ framework: 'tanstack', trpc: false, mailer: 'none' })
    expect(() => vendorComponent({ projectDir: dir, name: 'data-table' })).toThrow(
      /registry-backed.*shadcn/i,
    )
  })

  test('rejects an unknown component', () => {
    const { dir } = build({ framework: 'tanstack', trpc: false, mailer: 'none' })
    expect(() => vendorComponent({ projectDir: dir, name: 'nope' })).toThrow()
  })
})
