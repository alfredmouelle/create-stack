import {
  AUTHS,
  type Auth,
  CAPABILITY_CATALOG,
  DATABASES,
  type Database,
  FORMATTERS,
  FRAMEWORK_SUPPORT,
  type Framework,
  frameworkTitle,
  LINTERS,
  MAILERS,
  type Mailer,
  optionSpelling,
  PACKAGE_MANAGERS,
  parseStackChoice,
  QUALITY_TOOL_LABELS,
  RECOMMENDED_FRAMEWORK,
  SCAFFOLD_FLAGS,
  type ScaffoldFlag,
  type StackConfigurationInput,
  scaffoldFlagSpellings,
  scaffoldFlagSwitches,
} from '@alfredmouelle/stack-config'
import * as p from '@clack/prompts'
import { isValidAlias, normalizeAlias, type ParsedArgs, resolveMonorepo } from '#lib/args.ts'
import { resolveAuth } from '#lib/auth.ts'
import {
  CAPABILITIES,
  capabilityChoices,
  creationProviderChoices,
  resolveCreationProvider,
} from '#lib/capabilities.ts'
import { resolveDatabase } from '#lib/database.ts'
import { detectPackageManager, resolvePackageManager } from '#lib/package-manager.ts'
import {
  type CreationConfiguration,
  resolveCreationConfiguration,
} from '../creation-configuration.ts'
import { type CreationRequest, createProject } from '../engine.ts'
import type { CapabilitySelection, Monorepo, PackageManager } from '../framework-module.ts'
import { frameworkModules } from '../framework-registry.ts'
import {
  cancelled,
  flagChoices,
  helpLine,
  MODULE_CAPABILITIES,
  PORT_CAPABILITIES,
} from './shared.ts'

type Flags = ParsedArgs['flags']

const FRAMEWORK_IDS = frameworkModules.map(({ id }) => id)

const PREVIEW_FRAMEWORKS = frameworkModules
  .filter(({ maturity }) => maturity === 'preview')
  .map(({ id }) => id)

const disjunction = new Intl.ListFormat('en', { type: 'disjunction' })

const CAPABILITY_HELP = [
  [PORT_CAPABILITIES.map(({ flag }) => `--${flag}`).join('  '), 'swappable behind a port'],
  [
    MODULE_CAPABILITIES.map(({ flag, providers }) => `--${flag} [${providers.join('|')}]`).join(
      '  ',
    ),
    'single provider',
  ],
  ...CAPABILITY_CATALOG.flatMap(({ flag, aliases, providers }) =>
    aliases.map((alias) => [`--${alias} [${providers.join('|')}]`, `readable alias for --${flag}`]),
  ),
]
  .map(([usage, description]) => `  ${usage}`.padEnd(47) + description)
  .join('\n')

export const CREATION_HELP = `create-stack: assemble your selected stack from a tested reference application.

Usage:
  create-stack [project] [flags]          Scaffold a new project
  create-stack add <kind> [provider]      Add one capability or component
  create-stack add --with <item> [...]    Add a validated batch

Run a command with no args for an interactive picker; pass a selection flag
(or --yes), or an addition name, for non-interactive mode.
See \`add --help\` for its options.

Scaffold flags:
${`  -f, --framework [${FRAMEWORK_IDS.join('|')}]`.padEnd(34)} Framework (bare/default = ${RECOMMENDED_FRAMEWORK}${PREVIEW_FRAMEWORKS.length ? `; preview: ${PREVIEW_FRAMEWORKS.join(', ')}` : ''})
${helpLine(`  --mono, --monorepo [${flagChoices('monorepo')}]`, 'Scaffold into a monorepo, app in apps/web (bare = turbo)')}
${helpLine(`  --pm <${flagChoices('pm')}>`, 'Package manager (default: auto-detected)')}
  --package-manager <name>         Alias for --pm
  --alias <prefix>                 Import alias prefix, e.g. @ or # (default ~)
  --db, --database [${DATABASES.join('|')}] ORM the app ships (bare/default = framework recommendation)
  --auth <${AUTHS.join('|')}>  Auth provider (default = framework recommendation)
  --mail, --mailer [${MAILERS.join('|')}] Mail provider (bare/default = framework recommendation)
${helpLine(`  --formatter [${flagChoices('formatter')}]`, 'Formatter (bare/default = framework recommendation; cannot be excluded)')}
${helpLine(`  --linter [${flagChoices('linter')}]`, 'Linter (bare/default = framework recommendation; cannot be excluded)')}
  --minimal                        Start with the framework's smallest runnable project
  --trpc / --no-trpc               Include or explicitly exclude tRPC
  --no-db / --no-auth / --no-mail  Explicitly exclude a stack part
  --no-install                     Skip install + verification
  --no-git                         Do not initialize a Git repository
  -y, --yes                        Non-interactive with all defaults
  -h, --help                       Show this help
  -v, --version                    Print version

Capability flags (omit to skip; pass with no value for the default adapter):
${CAPABILITY_HELP}
  Adapters are listed in the interactive picker, or run \`add --help\`.

A choice the selected framework does not support is reported as a conflict
before any file is written. Every project gets the strict quality profile
(strict TypeScript, Git hooks, editor settings); the first commit is created
only after install, format, typecheck, and lint pass.`

const CREATION_CAPABILITY_OPTIONS: Readonly<Record<string, string>> = Object.fromEntries(
  CAPABILITY_CATALOG.flatMap(({ name, flag, aliases }) =>
    [flag, ...aliases].map((option) => [option, name]),
  ),
)

const UNSUPPORTED_EXCLUSIONS: Readonly<Record<string, string>> = {
  formatter: 'no-formatter',
  linter: 'no-linter',
}

const CREATION_OPTIONS = [
  ...SCAFFOLD_FLAGS.flatMap(scaffoldFlagSpellings),
  ...Object.values(UNSUPPORTED_EXCLUSIONS),
]

const BOOLEAN_CREATION_OPTIONS = new Set([
  ...SCAFFOLD_FLAGS.flatMap(scaffoldFlagSwitches),
  ...Object.values(UNSUPPORTED_EXCLUSIONS),
])

const has = (flags: Flags, name: string): boolean => Object.hasOwn(flags, name)

function editDistance(left: string, right: string): number {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i++) {
    let diagonal = row[0] ?? 0
    row[0] = i
    for (let j = 1; j <= right.length; j++) {
      const above = row[j] ?? 0
      row[j] = Math.min(
        above + 1,
        (row[j - 1] ?? 0) + 1,
        diagonal + (left[i - 1] === right[j - 1] ? 0 : 1),
      )
      diagonal = above
    }
  }
  return row[right.length] ?? 0
}

function validateCreationOptionNames(flags: Flags): void {
  if (has(flags, 'foundations')) {
    throw new Error('--foundations was removed; use --trpc or --no-trpc')
  }
  const known = new Set([...CREATION_OPTIONS, 'h', 'help', 'v', 'version'])
  for (const name of Object.keys(flags)) {
    if (known.has(name)) continue
    const suggestion = CREATION_OPTIONS.reduce((best, candidate) =>
      editDistance(name, candidate) < editDistance(name, best) ? candidate : best,
    )
    const hint =
      editDistance(name, suggestion) <= 3 ? ` Did you mean ${optionSpelling(suggestion)}?` : ''
    throw new Error(`Unknown option: --${name}.${hint}`)
  }
}

const AXIS_LABELS: Readonly<Record<string, string>> = {
  framework: 'Framework',
  database: 'Database',
  auth: 'Auth',
  mailer: 'Mail',
  formatter: 'Formatter',
  linter: 'Linter',
  trpc: 'tRPC',
  monorepo: 'Monorepo',
  pm: 'Package manager',
  alias: 'Import alias',
  yes: 'Recommended stack acceptance',
  minimal: 'Minimal project',
}

const axisLabel = ({ name, section }: ScaffoldFlag): string | undefined =>
  section === 'capability'
    ? name
        .split('-')
        .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
        .join(' ')
    : AXIS_LABELS[name]

const CREATION_AXES = SCAFFOLD_FLAGS.flatMap((flag) => {
  const label = axisLabel(flag)
  if (label === undefined) return []
  const exclusion = UNSUPPORTED_EXCLUSIONS[flag.name]
  return [[label, [...scaffoldFlagSpellings(flag), ...(exclusion ? [exclusion] : [])]] as const]
})

const STACK_OPTIONS = new Set(
  SCAFFOLD_FLAGS.filter(
    ({ name, section }) => (section !== 'project' && name !== 'minimal') || name === 'monorepo',
  ).flatMap(scaffoldFlagSpellings),
)

function validateBooleanCreationOptions(options: ParsedArgs['options']): void {
  const invalid = options.find(
    ({ name, value }) => BOOLEAN_CREATION_OPTIONS.has(name) && value !== true,
  )
  if (invalid) throw new Error(`--${invalid.name} does not accept a value`)
}

function validateCreationInvocation(args: ParsedArgs): void {
  if (args._.length > 1) throw new Error(`Unexpected positional argument: ${args._[1]}`)
  validateBooleanCreationOptions(args.options)

  for (const name of ['alias', 'pm', 'package-manager']) {
    if (args.flags[name] === true || args.flags[name] === '') {
      throw new Error(`--${name} requires a value`)
    }
  }

  for (const [axis, names] of CREATION_AXES) {
    const count = args.options.filter(({ name }) => names.includes(name)).length
    if (count > 1) throw new Error(`${axis} was specified more than once`)
  }

  if (has(args.flags, 'no-formatter')) {
    throw new Error('Formatter cannot be excluded; choose biome or prettier')
  }
  if (has(args.flags, 'no-linter')) {
    throw new Error('Linter cannot be excluded; choose biome or oxlint')
  }

  const yes = args.flags.y || args.flags.yes
  if (!yes) return
  if ('minimal' in args.flags) throw new Error('--yes cannot be combined with --minimal')
  const conflict = args.options.find(({ name }) => STACK_OPTIONS.has(name))
  if (conflict) {
    throw new Error(`--yes cannot be combined with stack options (received --${conflict.name})`)
  }
}

function collectCapabilityFlags(flags: Flags): CapabilitySelection {
  const out: Record<string, string | null> = {}
  for (const cap of CAPABILITIES) {
    const selected = Object.entries(CREATION_CAPABILITY_OPTIONS).find(
      ([option, internalName]) => internalName === cap && option in flags,
    )
    if (selected) out[cap] = resolveCreationProvider(cap, flags[selected[0]])
  }
  return out
}

function resolveFrameworkFlag(flags: Flags): Framework {
  const value = flags.f ?? flags.framework
  if (value === true || value == null) return RECOMMENDED_FRAMEWORK
  const framework = FRAMEWORK_IDS.find((id) => id === value)
  if (framework) return framework
  throw new Error(
    `Invalid framework: ${JSON.stringify(value)} (expected ${disjunction.format(FRAMEWORK_IDS)})`,
  )
}

function resolvePackageManagerFlag(flags: Flags, detected: PackageManager): PackageManager {
  const value = flags.pm ?? flags['package-manager']
  if (value == null) return detected
  if (typeof value === 'string' && PACKAGE_MANAGERS.some((name) => name === value))
    return resolvePackageManager(value)
  throw new Error(
    `Invalid package manager: ${JSON.stringify(value)} (expected ${PACKAGE_MANAGERS.join(', ')})`,
  )
}

function recommendedChoice<Value extends string>(
  framework: Framework,
  axis: 'database' | 'mailer',
  recommendations: readonly Value[],
): Value {
  const value = recommendations.find((candidate) => candidate !== 'none')
  if (!value)
    throw new Error(
      `${FRAMEWORK_SUPPORT[framework].label} has no recommended ${axis}; pass a value`,
    )
  return value
}

function resolveDatabaseFlag(flags: Flags, framework: Framework): Database {
  const value = flags.db ?? flags.database
  return value === true
    ? recommendedChoice(
        framework,
        'database',
        FRAMEWORK_SUPPORT[framework].recommendations.database,
      )
    : resolveDatabase(value)
}

function resolveMailer(value: string | true | undefined, framework: Framework): Mailer {
  if (value === true || value == null || value === '')
    return recommendedChoice(
      framework,
      'mailer',
      FRAMEWORK_SUPPORT[framework].recommendations.mailer,
    )
  const mailer = MAILERS.find((candidate) => candidate === value)
  if (mailer) return mailer
  throw new Error(
    `Invalid mail provider: ${JSON.stringify(value)} (expected ${disjunction.format(MAILERS)})`,
  )
}

function explicitDatabaseChoice(flags: Flags, framework: Framework): Database | undefined {
  if (has(flags, 'no-db')) return 'none'
  if (has(flags, 'db') || has(flags, 'database')) return resolveDatabaseFlag(flags, framework)
  return undefined
}

function explicitAuthChoice(flags: Flags): Auth | undefined {
  if (has(flags, 'no-auth')) return 'none'
  if (has(flags, 'auth'))
    return resolveAuth(typeof flags.auth === 'string' ? flags.auth : undefined)
  return undefined
}

function explicitMailerChoice(flags: Flags, framework: Framework): Mailer | undefined {
  if (has(flags, 'no-mail')) return 'none'
  if (has(flags, 'mail') || has(flags, 'mailer'))
    return resolveMailer(flags.mail ?? flags.mailer, framework)
  return undefined
}

function explicitTrpcChoice(flags: Flags): boolean | undefined {
  if (has(flags, 'trpc')) return true
  if (has(flags, 'no-trpc')) return false
  return undefined
}

function creationConfigurationInput(flags: Flags): StackConfigurationInput {
  const framework =
    has(flags, 'f') || has(flags, 'framework') ? resolveFrameworkFlag(flags) : undefined
  const selected = framework ?? RECOMMENDED_FRAMEWORK
  const { recommendations } = FRAMEWORK_SUPPORT[selected]
  const database = explicitDatabaseChoice(flags, selected)
  const auth = explicitAuthChoice(flags)
  const mailer = explicitMailerChoice(flags, selected)
  const trpc = explicitTrpcChoice(flags)
  const formatter =
    flags.formatter === true
      ? recommendations.formatter
      : parseStackChoice(flags.formatter, 'formatter', FORMATTERS)
  const linter =
    flags.linter === true
      ? recommendations.linter
      : parseStackChoice(flags.linter, 'linter', LINTERS)
  const input: StackConfigurationInput = { minimal: has(flags, 'minimal') }
  if (framework !== undefined) input.framework = framework
  if (database !== undefined) input.database = database
  if (auth !== undefined) input.auth = auth
  if (mailer !== undefined) input.mailer = mailer
  if (trpc !== undefined) input.trpc = trpc
  if (formatter !== undefined) input.formatter = formatter
  if (linter !== undefined) input.linter = linter
  return input
}

const stackRequest = (stack: CreationConfiguration) => ({
  framework: stack.framework,
  database: stack.database,
  auth: stack.auth,
  trpc: stack.trpc,
  mailer: stack.mailerProvider,
  formatter: stack.formatter,
  linter: stack.linter,
  selectionReasons: stack.selectionReasons,
})

function collectFromFlags(args: ParsedArgs, detected: PackageManager): CreationRequest {
  const argDir = args._[0]
  if (!argDir) throw new Error('Project name is required (positional) in non-interactive mode')
  const alias = normalizeAlias(typeof args.flags.alias === 'string' ? args.flags.alias : undefined)
  const packageManager = resolvePackageManagerFlag(args.flags, detected)
  const stack = resolveCreationConfiguration(creationConfigurationInput(args.flags))
  const capabilities = collectCapabilityFlags(args.flags)
  return {
    cwd: process.cwd(),
    target: argDir,
    name: argDir,
    ...stackRequest(stack),
    capabilities,
    monorepo: resolveMonorepo(args.flags.mono ?? args.flags.monorepo),
    alias,
    packageManager,
    install: !args.flags['no-install'],
    git: !args.flags['no-git'],
  }
}

const DATABASE_CHOICES: Readonly<Record<Database, { label: string; hint: string }>> = {
  drizzle: { label: 'Drizzle ORM', hint: 'Postgres + seed' },
  prisma: { label: 'Prisma ORM', hint: 'Prisma 7 + Postgres' },
  convex: { label: 'Convex', hint: 'realtime db + API (replaces tRPC)' },
  none: { label: 'None', hint: 'no database' },
}

const AUTH_CHOICES: Readonly<Record<Auth, { label: string; hint: string }>> = {
  'better-auth': { label: 'better-auth', hint: 'email+password, needs a mailer' },
  clerk: { label: 'Clerk', hint: 'hosted, no db/mailer needed' },
  none: { label: 'None', hint: 'no auth' },
}

const MAILER_LABELS: Readonly<Record<Mailer, string>> = {
  resend: 'Resend',
  brevo: 'Brevo',
  ses: 'Amazon SES',
  none: 'None',
}

const recommendedHint = (hint: string, recommended: boolean): string =>
  recommended ? (hint ? `${hint}, recommended` : 'recommended') : hint

const recommendedOption = <Value extends keyof typeof QUALITY_TOOL_LABELS>(
  value: Value,
  recommended: Value,
) => ({
  value,
  label: QUALITY_TOOL_LABELS[value],
  ...(value === recommended && { hint: 'recommended' }),
})

async function pickAdapters(caps: readonly string[]): Promise<CapabilitySelection> {
  const out: Record<string, string | null> = {}
  for (const cap of caps) {
    const choices = creationProviderChoices(cap)
    out[cap] = choices
      ? cancelled(
          await p.select({
            message: `${cap} adapter`,
            options: [...choices.options],
            initialValue: choices.defaultAdapter,
          }),
        )
      : resolveCreationProvider(cap, true)
  }
  return out
}

async function collectFromPrompts(
  argDir: string | undefined,
  detected: PackageManager,
): Promise<CreationRequest> {
  p.intro('create-stack: assemble your selected stack')

  const name = cancelled(
    await p.text({
      message: 'Project name',
      placeholder: 'my-app',
      initialValue: argDir ?? '',
      validate: (v) => (v?.trim() ? undefined : 'Required'),
    }),
  )
  const projectName = name.trim()

  const framework = cancelled(
    await p.select({
      message: 'Framework',
      initialValue: RECOMMENDED_FRAMEWORK,
      options: FRAMEWORK_IDS.map((id) => ({ value: id, label: frameworkTitle(id) })),
    }),
  )
  const { supports, recommendations } = FRAMEWORK_SUPPORT[framework]

  const monorepoPick = cancelled(
    await p.select<'none' | Exclude<Monorepo, false>>({
      message: 'Monorepo',
      initialValue: 'none',
      options: [
        { value: 'none', label: 'Single app', hint: 'standalone project (default)' },
        { value: 'turborepo', label: 'Turborepo', hint: 'app in apps/web, orchestrated by turbo' },
        { value: 'nx', label: 'Nx', hint: 'app in apps/web, orchestrated by nx' },
      ],
    }),
  )
  const monorepo = monorepoPick === 'none' ? false : monorepoPick

  const aliasPick = cancelled(
    await p.select({
      message: 'Import alias',
      initialValue: '~',
      options: [
        { value: '~', label: '~ (default)', hint: '~/components/...' },
        { value: '@', label: '@', hint: '@/components/...' },
        { value: '#', label: '#', hint: '#/components/...' },
        { value: '__custom__', label: 'Custom…' },
      ],
    }),
  )
  const alias =
    aliasPick === '__custom__'
      ? normalizeAlias(
          cancelled(
            await p.text({
              message: 'Custom import alias prefix',
              placeholder: '@app',
              validate: (v) =>
                isValidAlias(v)
                  ? undefined
                  : 'Letters, digits, - or _, optionally prefixed by @ ~ #',
            }),
          ),
        )
      : aliasPick

  const packageManager = resolvePackageManager(
    cancelled(
      await p.select({
        message: 'Package manager',
        initialValue: detected.name,
        options: PACKAGE_MANAGERS.map((n) => ({
          value: n,
          label: n === detected.name ? `${n} (detected)` : n,
        })),
      }),
    ),
  )

  const recommendedDatabase = recommendations.database[0] ?? 'none'
  const database = cancelled(
    await p.select({
      message: 'Database',
      initialValue: recommendedDatabase,
      options: supports.database.map((value) => ({
        value,
        label: DATABASE_CHOICES[value].label,
        hint: recommendedHint(DATABASE_CHOICES[value].hint, value === recommendedDatabase),
      })),
    }),
  )

  const convex = database === 'convex'

  const authValues = supports.auth.filter(
    (value) => value !== 'better-auth' || (database !== 'none' && !convex),
  )
  const recommendedAuth = recommendations.auth.find((value) => authValues.includes(value)) ?? 'none'
  const auth = cancelled(
    await p.select({
      message: 'Auth',
      initialValue: recommendedAuth,
      options: authValues.map((value) => ({
        value,
        label: AUTH_CHOICES[value].label,
        hint: recommendedHint(AUTH_CHOICES[value].hint, value === recommendedAuth),
      })),
    }),
  )

  const trpcValues = supports.trpc.filter((value) => !(convex && value))
  const trpc =
    trpcValues.length > 1
      ? cancelled(await p.confirm({ message: 'Include tRPC?', initialValue: recommendations.trpc }))
      : (trpcValues[0] ?? false)
  const mailerForced = auth === 'better-auth'
  const mailerValues = supports.mailer.filter((value) => !(mailerForced && value === 'none'))
  const recommendedMailer = mailerForced
    ? (recommendations.mailer.find((value) => mailerValues.includes(value)) ?? mailerValues[0])
    : mailerValues.includes('none')
      ? 'none'
      : mailerValues[0]
  const mailer = cancelled(
    await p.select({
      message: mailerForced ? 'Mailer provider (required by better-auth)' : 'Mailer provider',
      options: mailerValues.map((value) => ({ value, label: MAILER_LABELS[value] })),
      ...(recommendedMailer !== undefined && { initialValue: recommendedMailer }),
    }),
  )

  const formatter = cancelled(
    await p.select({
      message: 'Formatter',
      initialValue: recommendations.formatter,
      options: supports.formatter.map((value) =>
        recommendedOption(value, recommendations.formatter),
      ),
    }),
  )
  const linter = cancelled(
    await p.select({
      message: 'Linter',
      initialValue: recommendations.linter,
      options: supports.linter.map((value) => recommendedOption(value, recommendations.linter)),
    }),
  )

  const capPicked = cancelled(
    await p.multiselect({
      message: 'Capabilities (space to toggle)',
      required: false,
      initialValues: [],
      options: capabilityChoices(),
    }),
  )

  const capabilities = await pickAdapters(capPicked)

  const install = cancelled(
    await p.confirm({ message: 'Install dependencies and verify now?', initialValue: true }),
  )

  const stack = resolveCreationConfiguration({
    framework,
    database,
    auth,
    trpc,
    mailer,
    formatter,
    linter,
  })
  return {
    cwd: process.cwd(),
    target: argDir ?? projectName,
    name: projectName,
    ...stackRequest(stack),
    capabilities,
    monorepo,
    alias,
    packageManager,
    install,
    git: true,
  }
}

export async function runCreation(args: ParsedArgs): Promise<void> {
  validateCreationOptionNames(args.flags)
  validateCreationInvocation(args)

  const detected = detectPackageManager()
  const nonInteractive =
    args.flags.yes || args.flags.y || CREATION_OPTIONS.some((k) => k in args.flags)

  await createProject(
    nonInteractive
      ? collectFromFlags(args, detected)
      : await collectFromPrompts(args._[0], detected),
  )
}
