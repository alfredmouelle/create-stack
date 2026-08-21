import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import { registryItemSchema, registrySchema } from 'shadcn/schema'

const REGISTRY_ITEM_SCHEMA_URL = 'https://ui.shadcn.com/schema/registry-item.json'
const REGISTRY_SCHEMA_URL = 'https://ui.shadcn.com/schema/registry.json'

const COMPONENT_SOURCE_ROOT = 'apps/next-base/src'
const COMPONENT_PACKAGE_ROOT = 'apps/next-base'
const CALLABLE_SOURCE_ROOT = 'cli/registry'
const CALLABLE_PACKAGE_ROOT = 'cli/registry'

const callableEntry = ({ name, title, description, rootName, registryDependencies }) => ({
  name,
  type: 'registry:component',
  title,
  description,
  sourceRoot: CALLABLE_SOURCE_ROOT,
  packageRoot: CALLABLE_PACKAGE_ROOT,
  registryDependencies,
  dependencies: ['react-call'],
  files: [
    {
      source: `components/ui/${name}.tsx`,
      path: `ui/${name}.tsx`,
      destination: `src/components/ui/${name}.tsx`,
      type: 'registry:ui',
    },
  ],
  root: { name: rootName, module: `components/ui/${name}` },
})

export const COMPONENT_CATALOG = {
  'date-picker': {
    name: 'date-picker',
    type: 'registry:component',
    title: 'Date Picker',
    description: 'Single-date and date-range pickers with a calendar popover.',
    sourceRoot: COMPONENT_SOURCE_ROOT,
    packageRoot: COMPONENT_PACKAGE_ROOT,
    registryDependencies: ['calendar', 'popover', 'button'],
    dependencies: ['react-day-picker', 'date-fns', 'lucide-react'],
    legacyDependencies: ['react-day-picker', 'date-fns'],
    legacyFiles: ['src/components/ui/calendar.tsx', 'src/components/ui/popover.tsx'],
    files: [
      {
        source: 'components/ui/date-picker.tsx',
        path: 'ui/date-picker.tsx',
        destination: 'src/components/ui/date-picker.tsx',
        type: 'registry:ui',
      },
      {
        source: 'components/ui/date-range-picker.tsx',
        path: 'ui/date-range-picker.tsx',
        destination: 'src/components/ui/date-range-picker.tsx',
        type: 'registry:ui',
      },
      {
        source: 'lib/date.ts',
        path: 'lib/date.ts',
        destination: 'src/lib/date.ts',
        type: 'registry:lib',
      },
    ],
  },
  prompt: callableEntry({
    name: 'prompt',
    title: 'Prompt',
    description: 'A callable dialog that waits for text input.',
    rootName: 'Prompt',
    registryDependencies: ['dialog', 'button', 'input', 'label'],
  }),
  choice: callableEntry({
    name: 'choice',
    title: 'Choice',
    description: 'A callable dialog that waits for a selection.',
    rootName: 'Choice',
    registryDependencies: ['dialog', 'button'],
  }),
  'confirm-passphrase': callableEntry({
    name: 'confirm-passphrase',
    title: 'Confirm Passphrase',
    description: 'A callable dialog that checks an exact phrase.',
    rootName: 'ConfirmPassphrase',
    registryDependencies: ['dialog', 'button', 'input', 'label'],
  }),
  'confirm-otp': callableEntry({
    name: 'confirm-otp',
    title: 'Confirm OTP',
    description: 'A callable dialog that checks a one-time password.',
    rootName: 'ConfirmOtp',
    registryDependencies: ['dialog', 'button', 'input-otp'],
  }),
}

export const COMPONENT_NAMES = Object.keys(COMPONENT_CATALOG)

const asErrorText = (error) =>
  error?.issues?.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ') ??
  String(error)

function assertRelativePath(value, label) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    isAbsolute(value) ||
    value.split('/').includes('..') ||
    value.includes('\\')
  ) {
    throw new Error(`Invalid ${label}: expected a safe relative path`)
  }
}

function resolveInside(rootDir, path, label) {
  assertRelativePath(path, label)
  const root = resolve(rootDir)
  const absolute = resolve(root, path)
  const escaped = relative(root, absolute).startsWith(`..`)
  if (escaped) throw new Error(`Invalid ${label}: path escapes the repository root`)
  return absolute
}

function readPackageDependencies(rootDir, packageRoot) {
  const packagePath = resolveInside(rootDir, join(packageRoot, 'package.json'), 'package root')
  if (!existsSync(packagePath)) throw new Error(`Missing package manifest: ${packagePath}`)
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
  return new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
    ...Object.keys(packageJson.optionalDependencies ?? {}),
  ])
}

function canonicalizeImports(content) {
  return content.replace(/(['"`])~\//g, '$1@/')
}

function validateEntryName(name, entry) {
  if (
    typeof name !== 'string' ||
    name.length === 0 ||
    name !== basename(name) ||
    name === '.' ||
    name === '..' ||
    name === 'index' ||
    name.includes('\\') ||
    name.includes('\0')
  ) {
    throw new Error(`Invalid registry item name: expected a safe, non-reserved filename`)
  }
  if (!entry || typeof entry !== 'object') throw new Error(`Invalid registry item "${name}"`)
  if (entry.name !== name) {
    throw new Error(`Invalid registry item "${name}": name must match its catalog key`)
  }
  if (!Array.isArray(entry.files) || entry.files.length === 0) {
    throw new Error(`Invalid registry item "${name}": files are required`)
  }
  if (
    !Array.isArray(entry.dependencies) ||
    !entry.dependencies.every((dep) => typeof dep === 'string')
  ) {
    throw new Error(`Invalid registry item "${name}": dependencies must be string names`)
  }
  if (
    !Array.isArray(entry.registryDependencies) ||
    !entry.registryDependencies.every((dep) => typeof dep === 'string' && dep.length > 0)
  ) {
    throw new Error(`Invalid registry item "${name}": registryDependencies must be non-empty names`)
  }
  if (entry.root !== undefined) {
    if (
      !entry.root ||
      typeof entry.root.name !== 'string' ||
      typeof entry.root.module !== 'string'
    ) {
      throw new Error(`Invalid registry item "${name}": root must declare name and module`)
    }
  }
}

function buildItem({ rootDir, name, entry }) {
  validateEntryName(name, entry)
  assertRelativePath(entry.sourceRoot, `${name} source root`)
  assertRelativePath(entry.packageRoot, `${name} package root`)

  const sourceRoot = resolveInside(rootDir, entry.sourceRoot, `${name} source root`)
  const packageDependencies = readPackageDependencies(rootDir, entry.packageRoot)
  for (const dependency of entry.dependencies) {
    if (!packageDependencies.has(dependency)) {
      throw new Error(`Unresolved declared dependency "${dependency}" in registry item "${name}"`)
    }
  }

  const destinations = new Set()
  const files = entry.files.map((file) => {
    if (!file || typeof file !== 'object')
      throw new Error(`Invalid registry item "${name}": file entry`)
    assertRelativePath(file.source, `${name} source`)
    assertRelativePath(file.path, `${name} registry path`)
    assertRelativePath(file.destination, `${name} destination`)
    if (destinations.has(file.destination)) {
      throw new Error(
        `Invalid registry item "${name}": duplicate destination "${file.destination}"`,
      )
    }
    destinations.add(file.destination)

    const sourcePath = resolve(sourceRoot, file.source)
    if (!existsSync(sourcePath)) {
      throw new Error(`Missing source for registry item "${name}": ${file.source}`)
    }

    return {
      path: file.path,
      type: file.type,
      content: canonicalizeImports(readFileSync(sourcePath, 'utf8')),
    }
  })

  const item = {
    $schema: REGISTRY_ITEM_SCHEMA_URL,
    name: entry.name,
    type: entry.type,
    title: entry.title,
    description: entry.description,
    dependencies: [...entry.dependencies],
    registryDependencies: [...entry.registryDependencies],
    files,
  }
  const parsed = registryItemSchema.safeParse(item)
  if (!parsed.success) {
    throw new Error(`Invalid registry item "${name}": ${asErrorText(parsed.error)}`)
  }
  return { item: parsed.data, destinations: [...destinations], root: entry.root ?? null }
}

export function generateRegistry({ rootDir, outputDir, catalog = COMPONENT_CATALOG }) {
  if (typeof rootDir !== 'string' || typeof outputDir !== 'string') {
    throw new Error('Registry generation requires rootDir and outputDir')
  }

  mkdirSync(outputDir, { recursive: true })
  const generated = Object.entries(catalog).map(([name, entry]) =>
    buildItem({ rootDir, name, entry }),
  )
  const items = generated.map(({ item }) => item)
  for (const { item } of generated) {
    writeFileSync(join(outputDir, `${item.name}.json`), `${JSON.stringify(item, null, 2)}\n`)
  }

  const index = {
    $schema: REGISTRY_SCHEMA_URL,
    name: 'create-stack',
    homepage: 'https://create-stack.alfredmouelle.com',
    items,
  }
  const parsedIndex = registrySchema.safeParse(index)
  if (!parsedIndex.success) {
    throw new Error(`Invalid generated registry: ${asErrorText(parsedIndex.error)}`)
  }
  writeFileSync(join(outputDir, 'index.json'), `${JSON.stringify(parsedIndex.data, null, 2)}\n`)

  return {
    names: generated.map(({ item }) => item.name),
    items,
    metadata: Object.fromEntries(
      generated.map(({ item, destinations, root }) => [item.name, { destinations, root }]),
    ),
  }
}
