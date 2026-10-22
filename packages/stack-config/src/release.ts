import {
  AUTHS,
  CAPABILITY_CATALOG,
  type CapabilityFacts,
  type CapabilityName,
  COMPONENTS,
  type ComponentName,
  DATABASES,
  FORMATTERS,
  FRAMEWORK_SUPPORT,
  FRAMEWORKS,
  type Framework,
  type FrameworkSupport,
  LINTERS,
  MAILERS,
  MINIMUM_NODE_VERSION,
  MONOREPO_ORCHESTRATORS,
  PACKAGE_MANAGERS,
  RECOMMENDED_FRAMEWORK,
  SCAFFOLD_FLAGS,
  type ScaffoldFlag,
} from '@alfredmouelle/stack-config'

export type CliRelease = {
  schemaVersion: 1
  packageName: '@alfredmouelle/create-stack'
  version: string
  minimumNodeVersion: string
  recommendedFramework: Framework
  frameworks: Partial<Record<Framework, FrameworkSupport>>
  capabilities: readonly CapabilityFacts<CapabilityName, 'port' | 'module'>[]
  flags: readonly ScaffoldFlag[]
  components: readonly ComponentName[]
  packageManagers: readonly (typeof PACKAGE_MANAGERS)[number][]
  monorepoOrchestrators: readonly (typeof MONOREPO_ORCHESTRATORS)[number][]
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function object(value: unknown): Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error('Invalid CLI release object')
  }
  return value
}

function string(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error('Invalid CLI release string')
  return value
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Invalid CLI release list')
  return value
}

function strings(value: unknown): string[] {
  return array(value).map(string)
}

function choice<Value extends string | boolean>(value: unknown, choices: readonly Value[]): Value {
  const found = choices.find((candidate) => candidate === value)
  if (found === undefined) throw new Error(`Unsupported CLI release value: ${String(value)}`)
  return found
}

function choices<Value extends string | boolean>(
  value: unknown,
  allowed: readonly Value[],
): Value[] {
  const values = array(value).map((entry) => choice(entry, allowed))
  if (values.length === 0) throw new Error('Empty CLI release choices')
  return values
}

function version(value: unknown): string {
  const result = string(value)
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(result)) {
    throw new Error(`Invalid CLI release version: ${result}`)
  }
  return result
}

function frameworkSupport(value: unknown): FrameworkSupport {
  const source = object(value)
  const supported = object(source.supports)
  const recommended = object(source.recommendations)
  const supports = {
    database: choices(supported.database, DATABASES),
    auth: choices(supported.auth, AUTHS),
    trpc: choices(supported.trpc, [true, false]),
    mailer: choices(supported.mailer, MAILERS),
    formatter: choices(supported.formatter, FORMATTERS),
    linter: choices(supported.linter, LINTERS),
  }
  return {
    label: string(source.label),
    maturity: choice(source.maturity, ['stable', 'preview']),
    monorepoOutputs: strings(source.monorepoOutputs),
    supports,
    recommendations: {
      database: choices(recommended.database, supports.database),
      auth: choices(recommended.auth, supports.auth),
      trpc: choice(recommended.trpc, supports.trpc),
      mailer: choices(recommended.mailer, supports.mailer),
      formatter: choice(recommended.formatter, supports.formatter),
      linter: choice(recommended.linter, supports.linter),
    },
  }
}

function flag(value: unknown): ScaffoldFlag {
  const source = object(value)
  const flagValue = object(source.value)
  const kind = choice(flagValue.kind, ['none', 'choice', 'text'])
  return {
    name: string(source.name),
    aliases: strings(source.aliases),
    ...(source.negation === undefined ? {} : { negation: string(source.negation) }),
    section: choice(source.section, ['stack', 'capability', 'project']),
    value:
      kind === 'none'
        ? { kind }
        : kind === 'choice'
          ? { kind, choices: strings(flagValue.choices) }
          : { kind, placeholder: string(flagValue.placeholder) },
  }
}

function capability(value: unknown): CliRelease['capabilities'][number] {
  const source = object(value)
  const providers = strings(source.providers)
  return {
    name: choice(
      source.name,
      CAPABILITY_CATALOG.map(({ name }) => name),
    ),
    kind: choice(source.kind, ['port', 'module']),
    flag: string(source.flag),
    aliases: strings(source.aliases),
    providers,
    recommendedProvider: choice(source.recommendedProvider, providers),
  }
}

export function parseCliRelease(value: unknown): CliRelease {
  const source = object(value)
  if (source.schemaVersion !== 1 || source.packageName !== '@alfredmouelle/create-stack') {
    throw new Error('Unsupported CLI release manifest')
  }
  const frameworks: CliRelease['frameworks'] = {}
  for (const [id, support] of Object.entries(object(source.frameworks))) {
    frameworks[choice(id, FRAMEWORKS)] = frameworkSupport(support)
  }
  const recommendedFramework = choice(source.recommendedFramework, FRAMEWORKS)
  if (frameworks[recommendedFramework] === undefined) {
    throw new Error('The recommended framework is missing from the CLI release')
  }
  const flags = array(source.flags).map(flag)
  const frameworkFlag = flags.find(({ name }) => name === 'framework')
  if (
    frameworkFlag?.value.kind !== 'choice' ||
    frameworkFlag.value.choices.length !== Object.keys(frameworks).length ||
    !Object.keys(frameworks).every(
      (id) => frameworkFlag.value.kind === 'choice' && frameworkFlag.value.choices.includes(id),
    )
  ) {
    throw new Error('CLI release framework choices do not match its manifest')
  }
  return {
    schemaVersion: 1,
    packageName: '@alfredmouelle/create-stack',
    version: version(source.version),
    minimumNodeVersion: version(source.minimumNodeVersion),
    recommendedFramework,
    frameworks,
    capabilities: array(source.capabilities).map(capability),
    flags,
    components: choices(source.components, COMPONENTS),
    packageManagers: choices(source.packageManagers, PACKAGE_MANAGERS),
    monorepoOrchestrators: choices(source.monorepoOrchestrators, MONOREPO_ORCHESTRATORS),
  }
}

export function createCliRelease(releaseVersion: string): CliRelease {
  return parseCliRelease({
    schemaVersion: 1,
    packageName: '@alfredmouelle/create-stack',
    version: releaseVersion,
    minimumNodeVersion: MINIMUM_NODE_VERSION,
    recommendedFramework: RECOMMENDED_FRAMEWORK,
    frameworks: FRAMEWORK_SUPPORT,
    capabilities: CAPABILITY_CATALOG,
    flags: SCAFFOLD_FLAGS,
    components: COMPONENTS,
    packageManagers: PACKAGE_MANAGERS,
    monorepoOrchestrators: MONOREPO_ORCHESTRATORS,
  })
}
