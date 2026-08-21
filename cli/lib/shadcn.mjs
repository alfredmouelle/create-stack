import {
  existsSync,
  lstatSync,
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

function pathExists(path) {
  try {
    lstatSync(path)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
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
  packageManagerMismatch(projectDir, pm)
  if (force) assertSafeLegacyDestinations(projectDir, config, names)

  return {
    projectDir,
    config,
    components: names,
    registryDependencies: registryDependencies(components),
    force,
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

function componentTargets(projectDir, config, name) {
  return registryComponents[name].files.map((file) => ({
    file,
    path: itemTarget(projectDir, config, file),
  }))
}

function displayPath(projectDir, path) {
  return relative(projectDir, path) || path
}

function legacyDestinationConflicts(projectDir, config, name) {
  const entry = registryComponents[name]
  const conflicts = []

  for (const { file, path: configured } of componentTargets(projectDir, config, name)) {
    const historical = resolve(projectDir, file.destination)
    if (historical !== configured && pathExists(historical)) {
      conflicts.push({ historical, configured })
    }
  }

  for (const file of entry.legacyFiles ?? []) {
    const historical = resolve(projectDir, file)
    const primitive = basename(file, '.tsx')
    const configured = officialTarget(projectDir, config, primitive)
    if (historical !== configured && pathExists(historical)) {
      conflicts.push({ historical, configured })
    }
  }

  return conflicts
}

function assertSafeLegacyDestinations(projectDir, config, components) {
  for (const name of components) {
    const conflict = legacyDestinationConflicts(projectDir, config, name)[0]
    if (!conflict) continue

    throw new Error(
      `Cannot safely replace legacy Create Stack file at ${displayPath(projectDir, conflict.historical)}: components.json resolves it to ${displayPath(projectDir, conflict.configured)}. The CLI will not move legacy files or rewrite imports.`,
    )
  }
}

function registryItemPath(name) {
  const candidates = [
    join(STACK_ROOT, 'registry', `${name}.json`),
    join(STACK_ROOT, 'cli', '_stack', 'registry', `${name}.json`),
    join(MODULE_ROOT, '_stack', 'registry', `${name}.json`),
  ]
  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

function prepareItem(projectDir, config, name, { force = false } = {}) {
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
  item.files = (item.files ?? []).filter(
    (file) => force || !pathExists(itemTarget(projectDir, config, file)),
  )
  item.registryDependencies = (item.registryDependencies ?? []).filter(
    (dependency) => !pathExists(officialTarget(projectDir, config, dependency)),
  )

  const outputRoot = temporaryRoot ?? mkdtempSync(join(tmpdir(), 'create-stack-registry-'))
  const outputPath = join(outputRoot, `${name}.json`)
  writeFileSync(outputPath, `${JSON.stringify(item, null, 2)}\n`)

  return {
    path: outputPath,
    cleanup: () => rmSync(outputRoot, { recursive: true, force: true }),
  }
}

function componentResult(projectDir, config, name, before, force) {
  const owned = componentTargets(projectDir, config, name).map(({ path }) => path)
  const copied = owned
    .filter((path) => (force || !before.has(path)) && pathExists(path))
    .map((path) => relative(projectDir, path))
  const skipped = force
    ? []
    : owned.filter((path) => before.has(path)).map((path) => relative(projectDir, path))
  return { copied, skipped, addDeps: {}, mounted: null, rootName: null }
}

function stageExistingFiles(projectDir, config, components) {
  const paths = new Set()
  for (const name of components) {
    for (const { path } of componentTargets(projectDir, config, name)) paths.add(path)
  }

  const root = mkdtempSync(join(tmpdir(), 'create-stack-shadcn-preserve-'))
  const staged = []
  try {
    for (const [index, path] of [...paths].filter(pathExists).entries()) {
      const backup = join(root, `${index}-${basename(path)}`)
      renameSync(path, backup)
      staged.push({ path, backup })
    }
  } catch (error) {
    restoreStagedFiles(root, staged)
    throw error
  }

  return {
    restore: () => restoreStagedFiles(root, staged),
    discard: () => rmSync(root, { recursive: true, force: true }),
  }
}

function restoreStagedFiles(root, staged) {
  for (const { path, backup } of staged) {
    if (pathExists(path)) rmSync(path, { recursive: true, force: true })
    mkdirSync(dirname(path), { recursive: true })
    if (pathExists(backup)) renameSync(backup, path)
  }
  rmSync(root, { recursive: true, force: true })
}

export function installRegistryComponents({ projectDir, config, components, force = false }) {
  const before = new Map(
    components.map((name) => [
      name,
      new Set(
        componentTargets(projectDir, config, name)
          .map(({ path }) => path)
          .filter(pathExists),
      ),
    ]),
  )
  const preserved = force ? stageExistingFiles(projectDir, config, components) : null
  const items = []
  let succeeded = false

  try {
    for (const name of components) {
      items.push({
        name,
        before: before.get(name),
        ...prepareItem(projectDir, config, name, { force }),
      })
    }

    const success = run(
      process.execPath,
      [SHADCN_ENTRY, 'add', '--yes', '--cwd', projectDir, ...items.map(({ path }) => path)],
      { cwd: projectDir },
    )
    if (!success) {
      throw new Error(
        `shadcn failed while adding ${components.join(', ')}; no fallback files were copied. Shadcn may already have changed project package metadata or a lockfile; the CLI does not promise full transactionality.`,
      )
    }

    succeeded = true
    return new Map(
      items.map(({ name, before }) => [
        name,
        componentResult(projectDir, config, name, before, force),
      ]),
    )
  } finally {
    if (preserved) {
      if (succeeded) preserved.discard()
      else preserved.restore()
    }
    for (const item of items) item.cleanup()
  }
}
