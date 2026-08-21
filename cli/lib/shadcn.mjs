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
import { detectFramework } from './add.mjs'
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
const ROOT_FILES = {
  next: 'src/app/layout.tsx',
  tanstack: 'src/routes/__root.tsx',
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

function applyRscDirective(item, config) {
  if (config.rsc) return item

  return {
    ...item,
    files: item.files?.map((file) => ({
      ...file,
      content:
        typeof file.content === 'string'
          ? file.content.replace(/^(['"])use client\1;?\s*/, '')
          : file.content,
    })),
  }
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

  const item = applyRscDirective(JSON.parse(readFileSync(sourcePath, 'utf8')), config)
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

function rootModuleSpecifier(config, module) {
  const aliases = config.aliases ?? {}
  const uiAlias = aliases.ui
  const componentAlias = aliases.components
  if (module.startsWith('components/ui/') && (uiAlias || componentAlias)) {
    const prefix = uiAlias ? '' : 'ui/'
    const alias = (uiAlias ?? componentAlias).replace(/\/$/, '')
    return `${alias}/${prefix}${module.slice('components/ui/'.length)}`
  }
  if (module.startsWith('components/') && componentAlias) {
    return `${componentAlias.replace(/\/$/, '')}/${module.slice('components/'.length)}`
  }
  return module
}

function manualRootSteps(root, importStatement) {
  return [importStatement, `<${root.name} />`]
}

function mountRoot(projectDir, config, name) {
  const root = registryComponents[name].root
  if (!root) return { mounted: null, rootName: null, manualSteps: [] }

  const pkg = readJSON(join(projectDir, 'package.json'))
  const framework = detectFramework(pkg)
  const rootPath = join(projectDir, ROOT_FILES[framework])
  const importStatement = `import { ${root.name} } from '${rootModuleSpecifier(config, root.module)}'`
  const jsx = `<${root.name} />`

  if (!pathExists(rootPath)) {
    return {
      mounted: false,
      rootName: root.name,
      manualSteps: manualRootSteps(root, importStatement),
    }
  }

  const lines = readFileSync(rootPath, 'utf8').split('\n')
  if (lines.some((line) => line.includes(jsx))) {
    return { mounted: true, rootName: root.name, manualSteps: [] }
  }

  const bodyClose = lines.findIndex((line) => line.includes('</body>'))
  let lastImport = -1
  for (let index = 0; index < lines.length; index++) {
    if (/^import\b/.test(lines[index])) lastImport = index
  }
  if (bodyClose === -1 || lastImport === -1) {
    return {
      mounted: false,
      rootName: root.name,
      manualSteps: manualRootSteps(root, importStatement),
    }
  }

  lines.splice(bodyClose, 0, `        ${jsx}`)
  lines.splice(lastImport + 1, 0, importStatement)
  writeFileSync(rootPath, lines.join('\n'))
  return { mounted: true, rootName: root.name, manualSteps: [] }
}

function componentResult(projectDir, config, name, before, force) {
  const owned = componentTargets(projectDir, config, name).map(({ path }) => path)
  const copied = owned
    .filter((path) => (force || !before.has(path)) && pathExists(path))
    .map((path) => relative(projectDir, path))
  const skipped = force
    ? []
    : owned.filter((path) => before.has(path)).map((path) => relative(projectDir, path))
  return { copied, skipped, addDeps: {}, ...mountRoot(projectDir, config, name) }
}

function stageExistingFiles(projectDir, config, components, force) {
  const paths = new Map()
  for (const name of components) {
    if (force) {
      for (const { path } of componentTargets(projectDir, config, name)) paths.set(path, 'owned')
    }
    for (const dependency of registryComponents[name].registryDependencies ?? []) {
      const path = officialTarget(projectDir, config, dependency)
      if (!paths.has(path)) paths.set(path, 'official')
    }
  }

  const root = mkdtempSync(join(tmpdir(), 'create-stack-shadcn-preserve-'))
  const staged = []
  try {
    for (const [index, [path, kind]] of [...paths].filter(([path]) => pathExists(path)).entries()) {
      const backup = join(root, `${index}-${basename(path)}`)
      renameSync(path, backup)
      staged.push({ path, backup, kind })
    }
  } catch (error) {
    restoreStagedFiles(root, staged)
    throw error
  }

  return {
    restore: () => restoreStagedFiles(root, staged),
    complete() {
      restoreStagedEntries(staged.filter(({ kind }) => kind === 'official'))
      for (const { backup } of staged.filter(({ kind }) => kind === 'owned')) {
        if (pathExists(backup)) rmSync(backup, { recursive: true, force: true })
      }
      rmSync(root, { recursive: true, force: true })
    },
  }
}

function restoreStagedFiles(root, staged) {
  restoreStagedEntries(staged)
  rmSync(root, { recursive: true, force: true })
}

function restoreStagedEntries(staged) {
  for (const { path, backup } of staged) {
    if (pathExists(path)) rmSync(path, { recursive: true, force: true })
    mkdirSync(dirname(path), { recursive: true })
    if (pathExists(backup)) renameSync(backup, path)
  }
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
  const preserved = stageExistingFiles(projectDir, config, components, force)
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
    if (succeeded) preserved.complete()
    else preserved.restore()
    for (const item of items) item.cleanup()
  }
}
