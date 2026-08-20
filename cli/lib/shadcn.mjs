import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rawConfigSchema } from 'shadcn/schema'
import { detectEffectivePackageManager } from './package-manager.mjs'
import { STACK_ROOT } from './paths.mjs'
import { COMPONENT_CATALOG, generateRegistry } from './registry.mjs'
import { exists, readJSON, run } from './util.mjs'

export const SHADCN_VERSION = '4.17.0'

const require = createRequire(import.meta.url)
const SHADCN_ENTRY = require.resolve('shadcn')
const MODULE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const INIT_COMMANDS = {
  pnpm: 'pnpm dlx',
  npm: 'npx',
  yarn: 'yarn dlx',
  bun: 'bunx',
}

const registryComponents = Object.fromEntries(
  Object.entries(COMPONENT_CATALOG).map(([name, entry]) => [name, entry]),
)

const errorText = (error) =>
  error?.issues?.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ') ??
  String(error)

const initCommand = (pm) => `${INIT_COMMANDS[pm.name] ?? 'npx'} shadcn@${SHADCN_VERSION} init`

function configPath(projectDir) {
  return join(projectDir, 'components.json')
}

function readComponentsConfig(projectDir, pm) {
  const path = configPath(projectDir)
  const command = initCommand(pm)
  if (!exists(path)) {
    throw new Error(
      `A valid components.json is required for registry-backed additions. Run ${command} in ${projectDir}.`,
    )
  }

  let raw
  try {
    raw = readJSON(path)
  } catch {
    throw new Error(
      `Invalid components.json at ${projectDir}. Run ${command} before adding components.`,
    )
  }

  const parsed = rawConfigSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(
      `Invalid components.json at ${projectDir}: ${errorText(parsed.error)}. Run ${command} before adding components.`,
    )
  }
  return parsed.data
}

function packageManagerMismatch(projectDir, pm) {
  const effective = detectEffectivePackageManager(projectDir)
  const effectiveName = effective?.name ?? 'npm'
  if (effectiveName === pm.name) return

  const metadata = effective?.source
    ? `metadata ${relative(projectDir, effective.source) || effective.source}`
    : 'no lockfile or packageManager field'
  throw new Error(
    `Package manager mismatch: Create Stack selected ${pm.name}, but shadcn will use ${effectiveName} from ${metadata}.`,
  )
}

function registryComponentNames(components) {
  return components.map(({ name }) => name).filter((name) => registryComponents[name])
}

function registryDependencies(components) {
  return [
    ...new Set(
      registryComponentNames(components).flatMap(
        (name) => registryComponents[name].registryDependencies ?? [],
      ),
    ),
  ]
}

export function preflightRegistryComponents({ projectDir, pm, components, noInstall, force }) {
  const names = registryComponentNames(components)
  if (names.length === 0) return null

  const config = readComponentsConfig(projectDir, pm)
  if (noInstall) {
    throw new Error(
      'Cannot add shadcn-backed additions with --no-install; shadcn-backed additions install dependencies immediately.',
    )
  }
  if (force) {
    throw new Error(
      `--force is not supported for registry-backed component ${names[0]} until safe replacement is available.`,
    )
  }
  packageManagerMismatch(projectDir, pm)

  return {
    projectDir,
    config,
    components: names,
    registryDependencies: registryDependencies(components),
  }
}

function readTsconfig(projectDir) {
  const path = join(projectDir, 'tsconfig.json')
  if (!exists(path)) return null
  try {
    return readJSON(path)
  } catch {
    return null
  }
}

function resolveAliasTarget(projectDir, alias) {
  const tsconfig = readTsconfig(projectDir)
  const compilerOptions = tsconfig?.compilerOptions ?? {}
  const paths = compilerOptions.paths ?? {}

  for (const [pattern, targets] of Object.entries(paths)) {
    if (!Array.isArray(targets) || targets.length === 0) continue
    const prefix = pattern.endsWith('/*') ? pattern.slice(0, -2) : pattern
    if (alias !== prefix && !alias.startsWith(`${prefix}/`)) continue
    const suffix = alias.slice(prefix.length).replace(/^\//, '')
    const target = targets[0].replace(/\*$/, suffix)
    return resolve(projectDir, compilerOptions.baseUrl ?? '.', target)
  }

  if (alias.startsWith('./') || alias.startsWith('../')) return resolve(projectDir, alias)
  const suffix = alias.replace(/^[^/]+\/?/, '')
  return resolve(projectDir, 'src', suffix)
}

function itemTarget(projectDir, config, file) {
  const aliasName =
    file.type === 'registry:lib' ? 'lib' : file.type === 'registry:hook' ? 'hooks' : 'ui'
  const alias = config.aliases[aliasName] ?? config.aliases.components
  const itemPrefix = `${aliasName}/`
  const itemPath = file.path.startsWith(itemPrefix) ? file.path.slice(itemPrefix.length) : file.path
  return join(resolveAliasTarget(projectDir, alias), itemPath)
}

function officialTarget(projectDir, config, name) {
  const alias = config.aliases.ui ?? config.aliases.components
  return join(resolveAliasTarget(projectDir, alias), `${name}.tsx`)
}

function registryItemPath(name) {
  const candidates = [
    join(STACK_ROOT, 'registry', `${name}.json`),
    join(STACK_ROOT, 'cli', '_stack', 'registry', `${name}.json`),
    join(MODULE_ROOT, '_stack', 'registry', `${name}.json`),
  ]
  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

function prepareItem(projectDir, config, name) {
  const packagedPath = registryItemPath(name)
  let temporaryRoot = null
  let sourcePath = packagedPath

  if (!sourcePath) {
    temporaryRoot = mkdtempSync(join(tmpdir(), 'create-stack-registry-'))
    const sourceRoot = resolve(MODULE_ROOT, '..')
    generateRegistry({ rootDir: sourceRoot, outputDir: temporaryRoot })
    sourcePath = join(temporaryRoot, `${name}.json`)
  }

  const item = JSON.parse(readFileSync(sourcePath, 'utf8'))
  item.files = (item.files ?? []).filter((file) => !exists(itemTarget(projectDir, config, file)))
  item.registryDependencies = (item.registryDependencies ?? []).filter(
    (dependency) => !exists(officialTarget(projectDir, config, dependency)),
  )

  const outputRoot = temporaryRoot ?? mkdtempSync(join(tmpdir(), 'create-stack-registry-'))
  const outputPath = join(outputRoot, `${name}.json`)
  writeFileSync(outputPath, `${JSON.stringify(item, null, 2)}\n`)

  return {
    path: outputPath,
    cleanup: () => rmSync(outputRoot, { recursive: true, force: true }),
  }
}

function componentResult(projectDir, config, name, before) {
  const entry = registryComponents[name]
  const owned = entry.files.map((file) => itemTarget(projectDir, config, file))
  const copied = owned
    .filter((path) => !before.has(path) && exists(path))
    .map((path) => relative(projectDir, path))
  const skipped = owned.filter((path) => before.has(path)).map((path) => relative(projectDir, path))
  return { copied, skipped, addDeps: {}, mounted: null, rootName: null }
}

function stageExistingFiles(projectDir, config, components) {
  const paths = new Set()
  for (const name of components) {
    const entry = registryComponents[name]
    for (const file of entry.files) paths.add(itemTarget(projectDir, config, file))
    for (const dependency of entry.registryDependencies ?? []) {
      paths.add(officialTarget(projectDir, config, dependency))
    }
  }

  const root = mkdtempSync(join(tmpdir(), 'create-stack-shadcn-preserve-'))
  const staged = []
  for (const [index, path] of [...paths].filter(exists).entries()) {
    const backup = join(root, `${index}-${basename(path)}`)
    renameSync(path, backup)
    staged.push({ path, backup })
  }

  return {
    restore() {
      for (const { path, backup } of staged) {
        if (exists(path)) rmSync(path, { recursive: true, force: true })
        mkdirSync(dirname(path), { recursive: true })
        renameSync(backup, path)
      }
      rmSync(root, { recursive: true, force: true })
    },
  }
}

export function installRegistryComponents({ projectDir, config, components }) {
  const items = components.map((name) => {
    const entry = registryComponents[name]
    const before = new Set(
      entry.files.map((file) => itemTarget(projectDir, config, file)).filter(exists),
    )
    return { name, before, ...prepareItem(projectDir, config, name) }
  })
  const preserved = stageExistingFiles(projectDir, config, components)

  try {
    const success = run(
      process.execPath,
      [SHADCN_ENTRY, 'add', '--yes', '--cwd', projectDir, ...items.map(({ path }) => path)],
      { cwd: projectDir },
    )
    if (!success) {
      throw new Error(
        `shadcn failed while adding ${components.join(', ')}; no fallback files were copied. The project may have package metadata or lockfile changes.`,
      )
    }

    return new Map(
      items.map(({ name, before }) => [name, componentResult(projectDir, config, name, before)]),
    )
  } finally {
    preserved.restore()
    for (const item of items) item.cleanup()
  }
}
