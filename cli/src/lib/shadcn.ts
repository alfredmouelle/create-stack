import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import type { PackageManagerName } from '@alfredmouelle/stack-config'
import { type RegistryItem, rawConfigSchema, registryItemSchema } from 'shadcn/schema'
import type { PackageManager } from '../framework-module.ts'
import { requireFrameworkModule } from '../framework-registry.ts'
import { isJsonObject, type JsonObject, readJsonObject } from '../javascript/json.ts'
import { detectEffectivePackageManager, isPackageManagerName } from './package-manager.ts'
import { CLI_ROOT, STACK_ROOT } from './paths.ts'
import {
  asErrorText,
  type CatalogEntry,
  type CatalogFile,
  COMPONENT_CATALOG,
  generateRegistry,
} from './registry.ts'
import { exists, readJSON, run } from './util.ts'

const require = createRequire(import.meta.url)
const SHADCN_ENTRY = require.resolve('shadcn')

export type ComponentsConfig = ReturnType<typeof rawConfigSchema.parse>

export type RegistryPreflight = {
  readonly projectDir: string
  readonly config: ComponentsConfig
  readonly components: string[]
  readonly registryDependencies: string[]
  readonly force: boolean
}

export type RegistryInstallRequest = {
  readonly projectDir: string
  readonly config: ComponentsConfig
  readonly components: readonly string[]
  readonly force?: boolean
}

export type ComponentResult = import('../framework-module.ts').ComponentAdditionResult

type RootMount = Pick<ComponentResult, 'mounted' | 'rootName' | 'manualSteps'>

type ItemFile = { readonly type: string; readonly path: string }

type StagedFile = {
  readonly path: string
  readonly backup: string
  readonly kind: 'owned' | 'official'
}

type PreparedItem = {
  readonly name: string
  readonly before: ReadonlySet<string>
  readonly path: string
  readonly cleanup: () => void
}

const declaredShadcnVersion = (() => {
  const dependencies = readJsonObject(join(CLI_ROOT, 'package.json')).dependencies
  return isJsonObject(dependencies) ? dependencies.shadcn : undefined
})()

if (typeof declaredShadcnVersion !== 'string') {
  throw new Error('The CLI package.json declares no shadcn dependency')
}

export const SHADCN_VERSION = declaredShadcnVersion
const INIT_COMMANDS: Record<PackageManagerName, string> = {
  pnpm: 'pnpm dlx',
  npm: 'npx',
  yarn: 'yarn dlx',
  bun: 'bunx',
}

const registryComponents: Readonly<Record<string, CatalogEntry>> = Object.fromEntries(
  Object.entries(COMPONENT_CATALOG).map(([name, entry]) => [name, entry]),
)

function catalogEntry(name: string): CatalogEntry {
  const entry = registryComponents[name]
  if (!entry) throw new Error(`Unknown registry component: ${name}`)
  return entry
}

const initCommand = (pm: PackageManager): string =>
  `${isPackageManagerName(pm.name) ? INIT_COMMANDS[pm.name] : 'npx'} shadcn@${SHADCN_VERSION} init`

function configPath(projectDir: string): string {
  return join(projectDir, 'components.json')
}

function pathExists(path: string): boolean {
  try {
    lstatSync(path)
    return true
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return false
    }
    throw error
  }
}

function readComponentsConfig(projectDir: string, pm: PackageManager): ComponentsConfig {
  const path = configPath(projectDir)
  const command = initCommand(pm)
  if (!exists(path)) {
    throw new Error(
      `A valid components.json is required for registry-backed additions. Run ${command} in ${projectDir}.`,
    )
  }

  let raw: unknown
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
      `Invalid components.json at ${projectDir}: ${asErrorText(parsed.error)}. Run ${command} before adding components.`,
    )
  }
  return parsed.data
}

function packageManagerMismatch(projectDir: string, pm: PackageManager): void {
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

function registryComponentNames(components: readonly { readonly name: string }[]): string[] {
  return components.map(({ name }) => name).filter((name) => registryComponents[name])
}

function registryDependencies(components: readonly { readonly name: string }[]): string[] {
  return [
    ...new Set(
      registryComponentNames(components).flatMap((name) => catalogEntry(name).registryDependencies),
    ),
  ]
}

export function preflightRegistryComponents({
  projectDir,
  pm,
  components,
  noInstall,
  force,
}: {
  readonly projectDir: string
  readonly pm: PackageManager
  readonly components: readonly { readonly name: string }[]
  readonly noInstall: boolean
  readonly force: boolean
}): RegistryPreflight | null {
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

function readTsconfig(projectDir: string): JsonObject | null {
  const path = join(projectDir, 'tsconfig.json')
  if (!exists(path)) return null
  try {
    return readJsonObject(path)
  } catch {
    return null
  }
}

const jsonObjectOrEmpty = (value: unknown): JsonObject => (isJsonObject(value) ? value : {})

function resolveAliasTarget(projectDir: string, alias: string): string {
  const compilerOptions = jsonObjectOrEmpty(readTsconfig(projectDir)?.compilerOptions)
  const paths = jsonObjectOrEmpty(compilerOptions.paths)
  const baseUrl = typeof compilerOptions.baseUrl === 'string' ? compilerOptions.baseUrl : '.'

  for (const [pattern, targets] of Object.entries(paths)) {
    const firstTarget = Array.isArray(targets) ? targets[0] : undefined
    if (typeof firstTarget !== 'string') continue
    const prefix = pattern.endsWith('/*') ? pattern.slice(0, -2) : pattern
    if (alias !== prefix && !alias.startsWith(`${prefix}/`)) continue
    const suffix = alias.slice(prefix.length).replace(/^\//, '')
    const target = firstTarget.replace(/\*$/, suffix)
    return resolve(projectDir, baseUrl, target)
  }

  if (alias.startsWith('./') || alias.startsWith('../')) return resolve(projectDir, alias)
  const suffix = alias.replace(/^[^/]+\/?/, '')
  return resolve(projectDir, 'src', suffix)
}

function itemTarget(projectDir: string, config: ComponentsConfig, file: ItemFile): string {
  const aliasName =
    file.type === 'registry:lib'
      ? 'lib'
      : file.type === 'registry:hook'
        ? 'hooks'
        : file.type === 'registry:component'
          ? 'components'
          : 'ui'
  const alias = config.aliases[aliasName] ?? config.aliases.components
  const itemPrefix = `${aliasName}/`
  const itemPath = file.path.startsWith(itemPrefix) ? file.path.slice(itemPrefix.length) : file.path
  return join(resolveAliasTarget(projectDir, alias), itemPath)
}

function officialTarget(projectDir: string, config: ComponentsConfig, name: string): string {
  const alias = config.aliases.ui ?? config.aliases.components
  return join(resolveAliasTarget(projectDir, alias), `${name}.tsx`)
}

const CALENDAR_DAY_BUTTON_LOCALE = '<CalendarDayButton locale={locale} {...props} />'
const CALENDAR_DAY_BUTTON_OPTIONAL_LOCALE =
  '<CalendarDayButton {...(locale && { locale })} {...props} />'

function passOptionalCalendarLocale(projectDir: string, config: ComponentsConfig): void {
  const path = officialTarget(projectDir, config, 'calendar')
  if (!pathExists(path)) return
  const source = readFileSync(path, 'utf8')
  if (!source.includes(CALENDAR_DAY_BUTTON_LOCALE)) return
  writeFileSync(
    path,
    source.replaceAll(CALENDAR_DAY_BUTTON_LOCALE, CALENDAR_DAY_BUTTON_OPTIONAL_LOCALE),
  )
}

function applyRscDirective(item: RegistryItem, config: ComponentsConfig): RegistryItem {
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

function componentTargets(
  projectDir: string,
  config: ComponentsConfig,
  name: string,
): { file: CatalogFile; path: string }[] {
  return catalogEntry(name).files.map((file) => ({
    file,
    path: itemTarget(projectDir, config, file),
  }))
}

function displayPath(projectDir: string, path: string): string {
  return relative(projectDir, path) || path
}

function legacyDestinationConflicts(
  projectDir: string,
  config: ComponentsConfig,
  name: string,
): { historical: string; configured: string }[] {
  const entry = catalogEntry(name)
  const conflicts: { historical: string; configured: string }[] = []

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

function assertSafeLegacyDestinations(
  projectDir: string,
  config: ComponentsConfig,
  components: readonly string[],
): void {
  for (const name of components) {
    const conflict = legacyDestinationConflicts(projectDir, config, name)[0]
    if (!conflict) continue

    throw new Error(
      `Cannot safely replace legacy Create Stack file at ${displayPath(projectDir, conflict.historical)}: components.json resolves it to ${displayPath(projectDir, conflict.configured)}. The CLI will not move legacy files or rewrite imports.`,
    )
  }
}

function registryItemPath(name: string): string | null {
  const candidates = [
    join(STACK_ROOT, 'registry', `${name}.json`),
    join(STACK_ROOT, 'cli', '_stack', 'registry', `${name}.json`),
    join(CLI_ROOT, '_stack', 'registry', `${name}.json`),
  ]
  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

function prepareItem(
  projectDir: string,
  config: ComponentsConfig,
  name: string,
  { force = false }: { readonly force?: boolean } = {},
): { path: string; cleanup: () => void } {
  const packagedPath = registryItemPath(name)
  let temporaryRoot: string | null = null
  let sourcePath = packagedPath

  if (!sourcePath) {
    temporaryRoot = mkdtempSync(join(tmpdir(), 'create-stack-registry-'))
    const sourceRoot = resolve(CLI_ROOT, '..')
    generateRegistry({ rootDir: sourceRoot, outputDir: temporaryRoot })
    sourcePath = join(temporaryRoot, `${name}.json`)
  }

  const item = applyRscDirective(
    registryItemSchema.parse(JSON.parse(readFileSync(sourcePath, 'utf8'))),
    config,
  )
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

function rootModuleSpecifier(config: ComponentsConfig, module: string): string {
  const uiAlias = config.aliases.ui
  const componentAlias = config.aliases.components
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

function manualRootSteps(root: { readonly name: string }, importStatement: string): string[] {
  return [importStatement, `<${root.name} />`]
}

function mountRoot(projectDir: string, config: ComponentsConfig, name: string): RootMount {
  const root = catalogEntry(name).root
  if (!root) return { mounted: null, rootName: null, manualSteps: [] }

  const componentRoot = requireFrameworkModule(projectDir).additions.componentRoot
  if (componentRoot === null) throw new Error('This framework does not support component additions')
  const rootPath = join(projectDir, componentRoot)
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

  const bodyClose = lines.findIndex((line) => /<\/(?:body|Body)>/.test(line))
  let lastImport = -1
  for (let index = 0; index < lines.length; index++) {
    if (/^import\b/.test(lines[index] ?? '')) lastImport = index
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

function componentResult(
  projectDir: string,
  config: ComponentsConfig,
  name: string,
  before: ReadonlySet<string>,
  force: boolean,
): ComponentResult {
  const owned = componentTargets(projectDir, config, name).map(({ path }) => path)
  const copied = owned
    .filter((path) => (force || !before.has(path)) && pathExists(path))
    .map((path) => relative(projectDir, path))
  const skipped = force
    ? []
    : owned.filter((path) => before.has(path)).map((path) => relative(projectDir, path))
  return { copied, skipped, addDeps: {}, ...mountRoot(projectDir, config, name) }
}

function existingUiFiles(projectDir: string, config: ComponentsConfig): string[] {
  const root = resolveAliasTarget(projectDir, config.aliases.ui ?? config.aliases.components)
  if (!pathExists(root)) return []

  const files: string[] = []
  const visit = (path: string): void => {
    if (lstatSync(path).isDirectory()) {
      for (const entry of readdirSync(path)) visit(join(path, entry))
      return
    }
    files.push(path)
  }

  visit(root)
  return files
}

type StagedPaths = Map<string, StagedFile['kind']>

function addComponentFiles(
  paths: StagedPaths,
  projectDir: string,
  config: ComponentsConfig,
  name: string,
  force: boolean,
): void {
  if (force) {
    for (const { path } of componentTargets(projectDir, config, name)) paths.set(path, 'owned')
  }
  for (const dependency of catalogEntry(name).registryDependencies) {
    const path = officialTarget(projectDir, config, dependency)
    if (!paths.has(path)) paths.set(path, 'official')
  }
}

function addExistingUiFiles(
  paths: StagedPaths,
  projectDir: string,
  config: ComponentsConfig,
): void {
  for (const path of existingUiFiles(projectDir, config)) {
    if (!paths.has(path)) paths.set(path, 'official')
  }
}

function stageExistingFiles(
  projectDir: string,
  config: ComponentsConfig,
  components: readonly string[],
  force: boolean,
) {
  const paths: StagedPaths = new Map()
  for (const name of components) addComponentFiles(paths, projectDir, config, name, force)
  addExistingUiFiles(paths, projectDir, config)

  const root = mkdtempSync(join(tmpdir(), 'create-stack-shadcn-preserve-'))
  const staged: StagedFile[] = []
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

function restoreStagedFiles(root: string, staged: readonly StagedFile[]): void {
  restoreStagedEntries(staged)
  rmSync(root, { recursive: true, force: true })
}

function restoreStagedEntries(staged: readonly StagedFile[]): void {
  for (const { path, backup } of staged) {
    if (pathExists(path)) rmSync(path, { recursive: true, force: true })
    mkdirSync(dirname(path), { recursive: true })
    if (pathExists(backup)) renameSync(backup, path)
  }
}

export function installRegistryComponents({
  projectDir,
  config,
  components,
  force = false,
}: RegistryInstallRequest): Map<string, ComponentResult> {
  const initial = components.map((name) => ({
    name,
    before: new Set(
      componentTargets(projectDir, config, name)
        .map(({ path }) => path)
        .filter(pathExists),
    ),
  }))
  const preserved = stageExistingFiles(projectDir, config, components, force)
  const items: PreparedItem[] = []
  let succeeded = false

  try {
    for (const { name, before } of initial) {
      items.push({ name, before, ...prepareItem(projectDir, config, name, { force }) })
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

    passOptionalCalendarLocale(projectDir, config)
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
