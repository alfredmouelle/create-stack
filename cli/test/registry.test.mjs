import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { registryItemSchema, registrySchema } from 'shadcn/schema'
import { afterAll, describe, expect, test } from 'vitest'
import { COMPONENT_CATALOG, generateRegistry } from '../lib/registry.mjs'

const REPO_ROOT = resolve(import.meta.dirname, '../..')
const tempRoots = []

afterAll(() => {
  for (const root of tempRoots) rmSync(root, { recursive: true, force: true })
})

function outputDir() {
  const root = mkdtempSync(join(tmpdir(), 'create-stack-registry-'))
  tempRoots.push(root)
  return root
}

function readJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

describe('component registry generation', () => {
  test('generates a schema-valid date-picker item from the catalog', () => {
    const destination = outputDir()
    const result = generateRegistry({ rootDir: REPO_ROOT, outputDir: destination })
    const item = readJSON(join(destination, 'date-picker.json'))

    expect(result.names).toEqual(['date-picker', 'data-table'])
    expect(registryItemSchema.safeParse(item).success).toBe(true)
    expect(item.name).toBe('date-picker')
    expect(item.registryDependencies).toEqual(['calendar', 'popover', 'button'])
    expect(item.dependencies).toEqual(['react-day-picker', 'date-fns', 'lucide-react'])
    expect(item.files.map((file) => file.path)).toEqual([
      'ui/date-picker.tsx',
      'ui/date-range-picker.tsx',
      'lib/date.ts',
    ])
    expect(item.files.find((file) => file.path === 'ui/date-picker.tsx').content).toContain(
      "import { Button } from '@/components/ui/button'",
    )

    const index = readJSON(join(destination, 'index.json'))
    expect(registrySchema.safeParse(index).success).toBe(true)
    expect(index.items.map((entry) => entry.name)).toEqual(['date-picker', 'data-table'])
  })

  test('generates the complete data-table item with its direct and official dependencies', () => {
    const destination = outputDir()
    const result = generateRegistry({ rootDir: REPO_ROOT, outputDir: destination })
    const item = readJSON(join(destination, 'data-table.json'))

    expect(registryItemSchema.safeParse(item).success).toBe(true)
    expect(item.registryDependencies).toEqual(['table', 'skeleton', 'button'])
    expect(item.dependencies).toEqual(['@tanstack/react-table@^8.21.3', 'lucide-react'])
    expect(item.files.map((file) => file.path)).toEqual([
      'components/data-table.tsx',
      'components/infinite-data-table.tsx',
      'components/sortable-header.tsx',
      'hooks/use-data-table.tsx',
    ])
    expect(item.files.slice(0, 3).map((file) => file.type)).toEqual([
      'registry:component',
      'registry:component',
      'registry:component',
    ])
    expect(item.files[3].type).toBe('registry:hook')
    expect(result.metadata['data-table'].destinations).toEqual([
      'src/components/data-table.tsx',
      'src/components/infinite-data-table.tsx',
      'src/components/sortable-header.tsx',
      'src/hooks/use-data-table.tsx',
    ])
  })

  test('rejects invalid catalog data, missing sources, and unresolved package dependencies', () => {
    const datePicker = COMPONENT_CATALOG['date-picker']

    expect(() =>
      generateRegistry({
        rootDir: REPO_ROOT,
        outputDir: outputDir(),
        catalog: {
          broken: { ...datePicker, name: 'broken', type: 'not-a-registry-type' },
        },
      }),
    ).toThrow(/invalid registry item/i)

    expect(() =>
      generateRegistry({
        rootDir: REPO_ROOT,
        outputDir: outputDir(),
        catalog: {
          '../escaped': { ...datePicker, name: '../escaped' },
        },
      }),
    ).toThrow(/safe.*filename/i)

    expect(() =>
      generateRegistry({
        rootDir: REPO_ROOT,
        outputDir: outputDir(),
        catalog: {
          index: { ...datePicker, name: 'index' },
        },
      }),
    ).toThrow(/non-reserved filename/i)

    expect(() =>
      generateRegistry({
        rootDir: REPO_ROOT,
        outputDir: outputDir(),
        catalog: {
          broken: {
            ...datePicker,
            name: 'broken',
            files: [{ ...datePicker.files[0], source: 'components/ui/missing.tsx' }],
          },
        },
      }),
    ).toThrow(/missing source/i)

    expect(() =>
      generateRegistry({
        rootDir: REPO_ROOT,
        outputDir: outputDir(),
        catalog: {
          broken: {
            ...datePicker,
            name: 'broken',
            dependencies: ['package-that-is-not-installed'],
          },
        },
      }),
    ).toThrow(/unresolved declared dependency/i)
  })

  test('catalog entries retain destinations and optional callable root metadata', () => {
    expect(COMPONENT_CATALOG['date-picker'].files[0].destination).toBe(
      'src/components/ui/date-picker.tsx',
    )
    expect(COMPONENT_CATALOG['date-picker'].legacyFiles).toEqual([
      'src/components/ui/calendar.tsx',
      'src/components/ui/popover.tsx',
    ])

    const callable = {
      ...COMPONENT_CATALOG['date-picker'],
      name: 'example',
      root: { name: 'Example', module: 'components/example' },
    }
    const result = generateRegistry({
      rootDir: REPO_ROOT,
      outputDir: outputDir(),
      catalog: { example: callable },
    })
    expect(result.metadata.example.root).toEqual({
      name: 'Example',
      module: 'components/example',
    })
  })
})
