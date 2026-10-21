import {
  AUTHS,
  type Auth,
  CAPABILITY_CATALOG,
  type CapabilityName,
  DATABASES,
  type Database,
  DEFAULT_IMPORT_ALIAS,
  FORMATTERS,
  type Formatter,
  FRAMEWORK_SUPPORT,
  FRAMEWORKS,
  type Framework,
  type FrameworkSupportCatalog,
  frameworkTitle,
  isValidImportAlias,
  LINTERS,
  type Linter,
  MAILERS,
  type Mailer,
  MONOREPO_ORCHESTRATORS,
  type MonorepoOrchestrator,
  normalizeImportAlias,
  PACKAGE_MANAGERS,
  type PackageManagerName,
  resolveStackConfiguration,
  type StackConfigurationInput,
  type StackConfigurationResult,
} from '@alfredmouelle/stack-config'

export const BUILD_SCHEMA_VERSION = '1'

export const CAPABILITY_LABELS: Readonly<Record<CapabilityName, string>> = {
  storage: 'Object storage',
  cache: 'Cache',
  logger: 'Structured logging',
  analytics: 'Analytics',
  jobs: 'Background jobs',
  'error-tracking': 'Error tracking',
}

export const MONOREPO_LABELS: Readonly<Record<MonorepoOrchestrator, string>> = {
  turbo: 'Turborepo',
  nx: 'Nx',
}

export type CapabilitySelection = Partial<Record<CapabilityName, string>>

export interface BuildState {
  projectName: string
  packageManager: PackageManagerName
  framework?: Framework
  database?: Database
  auth?: Auth
  trpc?: boolean
  mailer?: Mailer
  formatter?: Formatter
  linter?: Linter
  alias?: string
  monorepo?: MonorepoOrchestrator
  capabilities: CapabilitySelection
}

export type BuildStateResult = StackConfigurationResult & {
  command: string | null
}

export type ParsedBuildState =
  | { kind: 'current'; state: BuildState }
  | { kind: 'unsupported'; version: string }
  | { kind: 'invalid'; message: string }

const EXECUTORS: Record<PackageManagerName, string> = {
  pnpm: 'pnpm dlx',
  npm: 'npx',
  yarn: 'yarn dlx',
  bun: 'bunx',
}

const STACK_PACKAGE = '@alfredmouelle/create-stack@latest'

type StackChoice = keyof Pick<
  StackConfigurationInput,
  'framework' | 'database' | 'auth' | 'mailer' | 'formatter' | 'linter'
>

export function defaultBuildState(): BuildState {
  return {
    projectName: 'my-app',
    packageManager: 'pnpm',
    capabilities: {},
  }
}

function stackInput(state: BuildState): StackConfigurationInput {
  return {
    framework: state.framework,
    database: state.database,
    auth: state.auth,
    trpc: state.trpc,
    mailer: state.mailer,
    formatter: state.formatter,
    linter: state.linter,
  }
}

function capabilityDefinition(name: string): (typeof CAPABILITY_CATALOG)[number] | undefined {
  return CAPABILITY_CATALOG.find((capability) => capability.name === name)
}

function shellQuote(value: string): string {
  if (/^[a-zA-Z0-9_./@-]+$/.test(value)) return value
  return `'${value.replaceAll("'", "'\\''")}'`
}

function commandFor(state: BuildState, stackArgs: readonly string[]): string | null {
  if (!state.projectName.trim()) return null
  if (state.alias !== undefined && !isValidImportAlias(state.alias)) return null

  const args = [...stackArgs]
  const alias = state.alias === undefined ? DEFAULT_IMPORT_ALIAS : normalizeImportAlias(state.alias)
  if (alias !== DEFAULT_IMPORT_ALIAS) args.push('--alias', alias)
  if (state.monorepo) args.push('--monorepo', state.monorepo)

  for (const capability of CAPABILITY_CATALOG) {
    const provider = state.capabilities[capability.name]
    if (provider === undefined) continue
    args.push(`--${capability.flags[0]}`, provider)
  }

  return [...EXECUTORS[state.packageManager].split(' '), STACK_PACKAGE, state.projectName, ...args]
    .map(shellQuote)
    .join(' ')
}

export function resolveBuildState(
  state: BuildState,
  frameworkSupport: FrameworkSupportCatalog = FRAMEWORK_SUPPORT,
): BuildStateResult {
  const result = resolveStackConfiguration(stackInput(state), frameworkSupport)
  return {
    ...result,
    command: result.conflicts.length === 0 ? commandFor(state, result.cliArgs) : null,
  }
}

export function buildCommand(state: BuildState): string | null {
  return resolveBuildState(state).command
}

function setChoice<Axis extends StackChoice>(
  state: BuildState,
  params: URLSearchParams,
  key: Axis,
  choices: readonly NonNullable<BuildState[Axis]>[],
): void {
  const value = params.get(key)
  if (value === null) return
  const choice = choices.find((choice) => choice === value)
  if (choice === undefined) {
    throw new Error(`Invalid ${key} value "${value}"`)
  }
  state[key] = choice
}

export function serializeBuildState(state: BuildState): string {
  const params = new URLSearchParams()
  params.set('v', BUILD_SCHEMA_VERSION)
  params.set('name', state.projectName)
  params.set('pm', state.packageManager)
  if (state.framework) params.set('framework', state.framework)
  if (state.database) params.set('database', state.database)
  if (state.auth) params.set('auth', state.auth)
  if (state.trpc !== undefined) params.set('trpc', state.trpc ? '1' : '0')
  if (state.mailer) params.set('mailer', state.mailer)
  if (state.formatter) params.set('formatter', state.formatter)
  if (state.linter) params.set('linter', state.linter)
  if (state.alias !== undefined && state.alias !== DEFAULT_IMPORT_ALIAS) {
    params.set('alias', state.alias)
  }
  if (state.monorepo) params.set('mono', state.monorepo)

  for (const capability of CAPABILITY_CATALOG) {
    const provider = state.capabilities[capability.name]
    if (provider !== undefined) params.append('cap', `${capability.name}=${provider}`)
  }

  return `?${params.toString()}`
}

function parseCapabilities(params: URLSearchParams, state: BuildState): void {
  for (const selection of params.getAll('cap')) {
    const separator = selection.indexOf('=')
    const name = separator === -1 ? selection : selection.slice(0, separator)
    const provider = separator === -1 ? '' : selection.slice(separator + 1)
    const capability = capabilityDefinition(name)
    if (!capability?.providers.includes(provider)) {
      throw new Error(`Invalid capability selection "${selection}"`)
    }
    state.capabilities[capability.name] = provider
  }
}

function parsePackageManager(params: URLSearchParams, state: BuildState): void {
  const value = params.get('pm')
  if (value === null) return
  const packageManager = PACKAGE_MANAGERS.find((name) => name === value)
  if (packageManager === undefined) {
    throw new Error(`Invalid package manager value "${value}"`)
  }
  state.packageManager = packageManager
}

function parseTrpc(params: URLSearchParams, state: BuildState): void {
  const trpc = params.get('trpc')
  if (trpc === null) return
  if (trpc !== '0' && trpc !== '1') throw new Error(`Invalid trpc value "${trpc}"`)
  state.trpc = trpc === '1'
}

function parseAlias(params: URLSearchParams, state: BuildState): void {
  const alias = params.get('alias')
  if (alias === null) return
  if (!isValidImportAlias(alias)) {
    throw new Error(`Invalid import alias value "${alias}"`)
  }
  state.alias = alias
}

function parseMonorepo(params: URLSearchParams, state: BuildState): void {
  const value = params.get('mono')
  if (value === null) return
  const monorepo = MONOREPO_ORCHESTRATORS.find((orchestrator) => orchestrator === value)
  if (monorepo === undefined) {
    throw new Error(`Invalid monorepo value "${value}"`)
  }
  state.monorepo = monorepo
}

function parseStateValues(params: URLSearchParams, state: BuildState): string | undefined {
  try {
    parsePackageManager(params, state)
    setChoice(state, params, 'framework', FRAMEWORKS)
    setChoice(state, params, 'database', DATABASES)
    setChoice(state, params, 'auth', AUTHS)
    setChoice(state, params, 'mailer', MAILERS)
    setChoice(state, params, 'formatter', FORMATTERS)
    setChoice(state, params, 'linter', LINTERS)
    parseTrpc(params, state)
    parseAlias(params, state)
    parseMonorepo(params, state)
    parseCapabilities(params, state)
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid build URL'
  }
}

export function parseBuildState(search: string): ParsedBuildState {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const version = params.get('v')
  if (version !== null && version !== BUILD_SCHEMA_VERSION) {
    return { kind: 'unsupported', version }
  }

  const state = defaultBuildState()
  state.projectName = params.get('name') ?? state.projectName
  const error = parseStateValues(params, state)
  if (error) return { kind: 'invalid', message: error }

  return { kind: 'current', state }
}

const orNone = (value: string): string => (value && value !== 'none' ? value : '(none)')

export function creationPlanLines(state: BuildState, result: BuildStateResult): string[] {
  const { configuration } = result
  const reason = (axis: string) => {
    const message = result.reasons.find((candidate) => candidate.axis === axis)?.message
    return message ? `, ${message}` : ''
  }
  const capabilities = CAPABILITY_CATALOG.flatMap((capability) => {
    const provider = state.capabilities[capability.name]
    return provider === undefined ? [] : [`${capability.name} (${provider})`]
  })
  const alias = state.alias === undefined ? DEFAULT_IMPORT_ALIAS : normalizeImportAlias(state.alias)

  return [
    `Target: ${state.projectName.trim()}`,
    `Framework: ${frameworkTitle(configuration.framework)}`,
    `Monorepo: ${state.monorepo ? MONOREPO_LABELS[state.monorepo] : '(none)'}`,
    `Package manager: ${state.packageManager}`,
    `Import alias: ${alias}/`,
    `Database: ${orNone(configuration.database)}${reason('database')}`,
    `Auth: ${orNone(configuration.auth)}${reason('auth')}`,
    `tRPC: ${configuration.trpc ? 'yes' : 'no'}${reason('trpc')}`,
    `Mailer: ${orNone(configuration.mailer)}${reason('mailer')}`,
    `Formatter: ${configuration.formatter}${reason('formatter')}`,
    `Linter: ${configuration.linter}${reason('linter')}`,
    `Capabilities: ${capabilities.join(', ') || '(none)'}${capabilities.length ? ', requested' : ''}`,
    'Install and verify: yes',
    'Initialize Git: yes (outside an existing repository)',
  ]
}
