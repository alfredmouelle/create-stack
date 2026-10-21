#!/usr/bin/env node

import { resolve } from 'node:path'
import * as p from '@clack/prompts'
import {
  ADDABLE,
  AUTHS,
  adapterChoicesFor,
  addableChoices,
  addCapability,
  CAPABILITIES,
  CAPABILITY_CATALOG,
  CLI_VERSION,
  COMPONENT_CATALOG,
  COMPONENT_NAMES,
  capabilityChoices,
  createProject,
  creationProviderChoices,
  currentTargetAdapter,
  DATABASES,
  detectPackageManager,
  detectProjectPackageManager,
  FRAMEWORK_SUPPORT,
  findCompatibleApplications,
  frameworkModules,
  frameworkTitle,
  installRegistryComponents,
  isValidAlias,
  MAILERS,
  normalizeAlias,
  optionSpelling,
  PACKAGE_MANAGERS,
  parseArgs,
  preflightRegistryComponents,
  QUALITY_TOOL_LABELS,
  RECOMMENDED_FRAMEWORK,
  relativeApplicationPath,
  requireFrameworkModule,
  resolveAdditionKind,
  resolveApplicationPath,
  resolveAuth,
  resolveCreationConfiguration,
  resolveCreationProvider,
  resolveDatabase,
  resolveExplicitPackageManager,
  resolveMonorepo,
  resolvePackageManager,
  resolveTargetAdapter,
  runVerificationGate,
  SCAFFOLD_FLAGS,
  scaffoldFlag,
  scaffoldFlagSpellings,
  scaffoldFlagSwitches,
  targetDir,
  validateAdditions,
} from './engine.mjs'

const detectedPm = detectPackageManager()

const VERSION = CLI_VERSION

const FRAMEWORK_IDS = frameworkModules.map(({ id }) => id)

const PREVIEW_FRAMEWORKS = frameworkModules
  .filter(({ maturity }) => maturity === 'preview')
  .map(({ id }) => id)

const disjunction = new Intl.ListFormat('en', { type: 'disjunction' })

const flagChoices = (name) => {
  const { value } = scaffoldFlag(name)
  return value.kind === 'choice' ? value.choices.join('|') : ''
}

const helpLine = (usage, description) => `${usage.padEnd(34)} ${description}`

const PORT_CAPABILITIES = CAPABILITY_CATALOG.filter(({ kind }) => kind === 'port')
const MODULE_CAPABILITIES = CAPABILITY_CATALOG.filter(({ kind }) => kind === 'module')

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

const HELP = `create-stack: assemble your selected stack from a tested reference application.

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

const ADD_HELP = `create-stack add: enrich an existing application.

Usage:
  create-stack add <capability> [provider] [flags]
  create-stack add component <name> [flags]
  create-stack add --with <kind>[=<provider>] [--with ...] [flags]

Run with no addition for an interactive picker. An explicit addition prints its
resolved plan and runs without confirmation. Provider changes remove former
provider files by default; --keep-files retains them.

Swappable behind a port: ${[...PORT_CAPABILITIES.map(({ flag }) => flag), 'mail'].join(', ')}.
Single provider: ${MODULE_CAPABILITIES.map(({ flag, providers }) => `${flag} (${providers.join(', ')})`).join(', ')}.
No provider at all: email-ui, http.
Components: ${COMPONENT_NAMES.join(', ')}.

Flags:
  --with <kind>[=<provider>]        Add one item to a validated addition batch (repeatable)
  --keep-files                     Keep former provider files when changing provider
  --force                          Replace existing files for a selected component
  --app <relative-path>            Application target (required when ambiguous)
${helpLine(`  --pm <${flagChoices('pm')}>`, 'Override package manager detected from lockfile')}
  --package-manager <name>         Alias for --pm
  --no-install                     Skip install + verification
  -h, --help                       Show this help`

const CREATION_CAPABILITY_OPTIONS = Object.fromEntries(
  CAPABILITY_CATALOG.flatMap(({ name, flag, aliases }) =>
    [flag, ...aliases].map((option) => [option, name]),
  ),
)

const UNSUPPORTED_EXCLUSIONS = { formatter: 'no-formatter', linter: 'no-linter' }

const CREATION_OPTIONS = [
  ...SCAFFOLD_FLAGS.flatMap(scaffoldFlagSpellings),
  ...Object.values(UNSUPPORTED_EXCLUSIONS),
]

const BOOLEAN_CREATION_OPTIONS = new Set([
  ...SCAFFOLD_FLAGS.flatMap(scaffoldFlagSwitches),
  ...Object.values(UNSUPPORTED_EXCLUSIONS),
])

function editDistance(left, right) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i++) {
    let diagonal = row[0]
    row[0] = i
    for (let j = 1; j <= right.length; j++) {
      const above = row[j]
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        diagonal + (left[i - 1] === right[j - 1] ? 0 : 1),
      )
      diagonal = above
    }
  }
  return row[right.length]
}

function validateCreationOptionNames(flags) {
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

const AXIS_LABELS = {
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

const axisLabel = ({ name, section }) =>
  section === 'capability'
    ? name
        .split('-')
        .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
        .join(' ')
    : AXIS_LABELS[name]

const CREATION_AXES = Object.fromEntries(
  SCAFFOLD_FLAGS.filter((flag) => axisLabel(flag) !== undefined).map((flag) => [
    axisLabel(flag),
    [
      ...scaffoldFlagSpellings(flag),
      ...(UNSUPPORTED_EXCLUSIONS[flag.name] ? [UNSUPPORTED_EXCLUSIONS[flag.name]] : []),
    ],
  ]),
)

const STACK_OPTIONS = new Set(
  SCAFFOLD_FLAGS.filter(
    ({ name, section }) => (section !== 'project' && name !== 'minimal') || name === 'monorepo',
  ).flatMap(scaffoldFlagSpellings),
)

function validateBooleanCreationOptions(options) {
  const invalid = options.find(
    ({ name, value }) => BOOLEAN_CREATION_OPTIONS.has(name) && value !== true,
  )
  if (invalid) throw new Error(`--${invalid.name} does not accept a value`)
}

function validateCreationInvocation(args) {
  if (args._.length > 1) throw new Error(`Unexpected positional argument: ${args._[1]}`)
  validateBooleanCreationOptions(args.options)

  for (const name of ['alias', 'pm', 'package-manager']) {
    if (args.flags[name] === true || args.flags[name] === '') {
      throw new Error(`--${name} requires a value`)
    }
  }

  for (const [axis, names] of Object.entries(CREATION_AXES)) {
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

const cancelled = (v) => {
  if (p.isCancel(v)) {
    p.cancel('Aborted.')
    process.exit(0)
  }
  return v
}

function collectCapabilityFlags(flags) {
  const out = {}
  for (const cap of CAPABILITIES) {
    const selected = Object.entries(CREATION_CAPABILITY_OPTIONS).find(
      ([option, internalName]) => internalName === cap && option in flags,
    )
    if (selected) out[cap] = resolveCreationProvider(cap, flags[selected[0]])
  }
  return out
}

function resolveFrameworkFlag(flags) {
  const value = flags.f ?? flags.framework
  if (value === true || value == null) return RECOMMENDED_FRAMEWORK
  if (FRAMEWORK_IDS.includes(value)) return value
  throw new Error(
    `Invalid framework: ${JSON.stringify(value)} (expected ${disjunction.format(FRAMEWORK_IDS)})`,
  )
}

function resolvePackageManagerFlag(flags) {
  const value = flags.pm ?? flags['package-manager']
  if (value == null) return detectedPm
  if (typeof value === 'string' && PACKAGE_MANAGERS.includes(value))
    return resolvePackageManager(value)
  throw new Error(
    `Invalid package manager: ${JSON.stringify(value)} (expected ${PACKAGE_MANAGERS.join(', ')})`,
  )
}

function recommendedChoice(framework, axis) {
  const { label, recommendations } = FRAMEWORK_SUPPORT[framework]
  const value = recommendations[axis].find((candidate) => candidate !== 'none')
  if (!value) throw new Error(`${label} has no recommended ${axis}; pass a value`)
  return value
}

function resolveDatabaseFlag(flags, framework) {
  const value = flags.db ?? flags.database
  return value === true ? recommendedChoice(framework, 'database') : resolveDatabase(value)
}

function resolveAuthFlag(flags) {
  const value = typeof flags.auth === 'string' ? flags.auth : undefined
  return resolveAuth(value)
}

function collectFromFlags(args) {
  const argDir = args._[0]
  if (!argDir) throw new Error('Project name is required (positional) in non-interactive mode')
  const alias = normalizeAlias(typeof args.flags.alias === 'string' ? args.flags.alias : undefined)
  const pm = resolvePackageManagerFlag(args.flags)
  const stack = resolveCreationConfiguration(creationConfigurationInput(args.flags))
  const capabilities = collectCapabilityFlags(args.flags)
  const doInstall = !args.flags['no-install']
  const doGit = !args.flags['no-git']
  const monorepo = resolveMonorepo(args.flags.mono ?? args.flags.monorepo)
  return {
    argDir,
    projectName: argDir,
    framework: stack.framework,
    alias,
    pm,
    trpc: stack.trpc,
    database: stack.database,
    auth: stack.auth,
    mailerProvider: stack.mailerProvider,
    formatter: stack.formatter,
    linter: stack.linter,
    selectionReasons: stack.selectionReasons,
    capabilities,
    monorepo,
    doInstall,
    doGit,
  }
}

const has = (flags, name) => Object.hasOwn(flags, name)

function explicitDatabaseChoice(flags, framework) {
  if (has(flags, 'no-db')) return 'none'
  if (has(flags, 'db') || has(flags, 'database')) return resolveDatabaseFlag(flags, framework)
}

function explicitAuthChoice(flags) {
  if (has(flags, 'no-auth')) return 'none'
  if (has(flags, 'auth')) return resolveAuthFlag(flags)
}

function explicitMailerChoice(flags, framework) {
  if (has(flags, 'no-mail')) return 'none'
  if (has(flags, 'mail') || has(flags, 'mailer'))
    return resolveMailer(flags.mail ?? flags.mailer, framework)
}

function explicitTrpcChoice(flags) {
  if (has(flags, 'trpc')) return true
  if (has(flags, 'no-trpc')) return false
}

function explicitCreationChoices(flags) {
  const framework =
    has(flags, 'f') || has(flags, 'framework') ? resolveFrameworkFlag(flags) : undefined
  const selected = framework ?? RECOMMENDED_FRAMEWORK
  const { recommendations } = FRAMEWORK_SUPPORT[selected]
  return {
    framework,
    database: explicitDatabaseChoice(flags, selected),
    auth: explicitAuthChoice(flags),
    mailer: explicitMailerChoice(flags, selected),
    trpc: explicitTrpcChoice(flags),
    formatter: flags.formatter === true ? recommendations.formatter : flags.formatter,
    linter: flags.linter === true ? recommendations.linter : flags.linter,
  }
}

function creationConfigurationInput(flags) {
  return {
    ...explicitCreationChoices(flags),
    minimal: has(flags, 'minimal'),
  }
}

function resolveMailer(value, framework) {
  if (value === true || value == null || value === '') return recommendedChoice(framework, 'mailer')
  if (MAILERS.includes(value)) return value
  throw new Error(
    `Invalid mail provider: ${JSON.stringify(value)} (expected ${disjunction.format(MAILERS)})`,
  )
}

const DATABASE_CHOICES = {
  drizzle: { label: 'Drizzle ORM', hint: 'Postgres + seed' },
  prisma: { label: 'Prisma ORM', hint: 'Prisma 7 + Postgres' },
  convex: { label: 'Convex', hint: 'realtime db + API (replaces tRPC)' },
  none: { label: 'None', hint: 'no database' },
}

const AUTH_CHOICES = {
  'better-auth': { label: 'better-auth', hint: 'email+password, needs a mailer' },
  clerk: { label: 'Clerk', hint: 'hosted, no db/mailer needed' },
  none: { label: 'None', hint: 'no auth' },
}

const MAILER_LABELS = { resend: 'Resend', brevo: 'Brevo', ses: 'Amazon SES', none: 'None' }

const recommendedHint = (hint, recommended) =>
  recommended ? (hint ? `${hint}, recommended` : 'recommended') : hint

async function pickAdapters(caps) {
  const out = {}
  for (const cap of caps) {
    const choices = creationProviderChoices(cap)
    out[cap] = choices
      ? cancelled(
          await p.select({
            message: `${cap} adapter`,
            options: choices.options,
            initialValue: choices.defaultAdapter,
          }),
        )
      : resolveCreationProvider(cap, true)
  }
  return out
}

async function collectFromPrompts(argDir) {
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
    await p.select({
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

  const pm = resolvePackageManager(
    cancelled(
      await p.select({
        message: 'Package manager',
        initialValue: detectedPm.name,
        options: PACKAGE_MANAGERS.map((n) => ({
          value: n,
          label: n === detectedPm.name ? `${n} (detected)` : n,
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
  const wantsTrpc =
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
      initialValue: recommendedMailer,
    }),
  )

  const formatter = cancelled(
    await p.select({
      message: 'Formatter',
      initialValue: recommendations.formatter,
      options: supports.formatter.map((value) => ({
        value,
        label: QUALITY_TOOL_LABELS[value],
        hint: value === recommendations.formatter ? 'recommended' : undefined,
      })),
    }),
  )
  const linter = cancelled(
    await p.select({
      message: 'Linter',
      initialValue: recommendations.linter,
      options: supports.linter.map((value) => ({
        value,
        label: QUALITY_TOOL_LABELS[value],
        hint: value === recommendations.linter ? 'recommended' : undefined,
      })),
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

  const doInstall = cancelled(
    await p.confirm({ message: 'Install dependencies and verify now?', initialValue: true }),
  )

  const stack = resolveCreationConfiguration({
    framework,
    database,
    auth,
    trpc: wantsTrpc,
    mailer,
    formatter,
    linter,
  })
  return {
    argDir,
    projectName,
    framework: stack.framework,
    alias,
    pm,
    database: stack.database,
    auth: stack.auth,
    trpc: stack.trpc,
    mailerProvider: stack.mailerProvider,
    formatter: stack.formatter,
    linter: stack.linter,
    selectionReasons: stack.selectionReasons,
    capabilities,
    monorepo,
    doInstall,
    doGit: true,
  }
}

async function execute(a) {
  await createProject({
    cwd: process.cwd(),
    target: a.argDir ?? a.projectName,
    name: a.projectName,
    framework: a.framework,
    database: a.database,
    auth: a.auth,
    trpc: a.trpc,
    mailer: a.mailerProvider,
    formatter: a.formatter,
    linter: a.linter,
    selectionReasons: a.selectionReasons,
    capabilities: a.capabilities,
    monorepo: a.monorepo,
    alias: a.alias,
    packageManager: a.pm,
    install: a.doInstall,
    git: a.doGit,
  })
}

function resolveComponentAddition(name) {
  if (name === 'datatable') {
    throw new Error(
      "'datatable' was renamed to 'data-table'; run create-stack add component data-table",
    )
  }
  if (!COMPONENT_NAMES.includes(name)) {
    throw new Error(`Unknown component: ${name}. Pick one of ${COMPONENT_NAMES.join(', ')}`)
  }
  return { type: 'component', name }
}

function resolveCapabilityAddition(requestedKind, requestedProvider) {
  const resolved = resolveAdditionKind(requestedKind)
  if (!resolved) {
    const formerEmailUiName = ['email', 'kit'].join('-')
    if (requestedKind === formerEmailUiName) {
      throw new Error(
        `'${formerEmailUiName}' was renamed to 'email-ui'; run create-stack add email-ui`,
      )
    }
    throw new Error(
      `Unknown addition: ${requestedKind}. Pick one of ${ADDABLE.join(', ')}, component`,
    )
  }
  return {
    type: 'capability',
    ...resolved,
    adapter: resolveTargetAdapter(resolved.cap, requestedProvider),
  }
}

function resolveExplicitAddition(args) {
  const requestedKind = args._[1]
  if (requestedKind === 'component') {
    const name = args._[2]
    if (!name) throw new Error('component requires a name')
    if (args._[3]) throw new Error(`Unexpected positional argument: ${args._[3]}`)
    return resolveComponentAddition(name)
  }

  if (args._[3]) throw new Error(`Unexpected positional argument: ${args._[3]}`)
  return resolveCapabilityAddition(requestedKind, args._[2])
}

function resolveBatchAddition(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('--with requires <kind>[=<provider>]')
  }
  const separator = value.indexOf('=')
  const requestedKind = separator === -1 ? value : value.slice(0, separator)
  const requestedProvider = separator === -1 ? undefined : value.slice(separator + 1)
  if (!requestedKind || requestedProvider === '') {
    throw new Error(`Invalid --with addition: ${value}`)
  }
  if (requestedKind === 'component') {
    if (!requestedProvider) throw new Error('--with component requires a component name')
    return resolveComponentAddition(requestedProvider)
  }
  return resolveCapabilityAddition(requestedKind, requestedProvider)
}

function resolveAdditionBatch(args) {
  const values = args.options.filter(({ name }) => name === 'with').map(({ value }) => value)
  if (values.length === 0) return null
  if (args._[1]) throw new Error('Positional additions cannot be mixed with --with additions')
  const selections = values.map(resolveBatchAddition)
  const seen = new Set()
  for (const selection of selections) {
    const key = `${selection.type}:${selection.name}`
    if (seen.has(key)) throw new Error(`Duplicate addition: ${selection.name}`)
    seen.add(key)
  }
  return selections
}

async function resolveAddSelections(args) {
  const batch = resolveAdditionBatch(args)
  if (batch) return batch
  if (args._[1]) return [resolveExplicitAddition(args)]

  const additions = cancelled(
    await p.groupMultiselect({
      message: 'Additions to add (space to toggle)',
      required: true,
      selectableGroups: false,
      options: {
        Capabilities: addableChoices(),
        Components: COMPONENT_NAMES.map((name) => ({
          value: `component=${name}`,
          label: COMPONENT_CATALOG[name].label,
          hint: COMPONENT_CATALOG[name].hint,
        })),
      },
    }),
  )
  const selections = []
  for (const addition of additions) {
    if (addition.startsWith('component=')) {
      selections.push({ type: 'component', name: addition.slice('component='.length) })
      continue
    }
    const cap = addition
    const choices = adapterChoicesFor(cap)
    const adapter = choices
      ? cancelled(
          await p.select({
            message: `${cap} adapter`,
            options: choices.options,
            initialValue: choices.defaultAdapter,
          }),
        )
      : null
    const resolved = resolveAdditionKind(cap)
    selections.push({ type: 'capability', ...resolved, adapter })
  }
  return selections
}

const addedLine = (a) => {
  const parts = [a.adapter ? `${a.cap} (${a.adapter})` : a.cap]
  if (a.swappedFrom) parts.push(`[swapped from ${a.swappedFrom}]`)
  parts.push(`→ ${targetDir(a.cap)}/`)
  if (a.envKeys.length) parts.push(`env: ${a.envKeys.join(', ')}`)
  return parts.join('  ')
}

function validateAdditionInvocation(args) {
  const known = new Set([
    'with',
    'app',
    'pm',
    'package-manager',
    'keep-files',
    'force',
    'no-install',
    'help',
    'h',
  ])
  for (const { name, value } of args.options) {
    if (!known.has(name)) throw new Error(`Unknown option for add: --${name}`)
    if (['keep-files', 'force', 'no-install'].includes(name) && value !== true) {
      throw new Error(`--${name} does not accept a value`)
    }
    if (['app', 'pm', 'package-manager'].includes(name) && value === true) {
      throw new Error(`--${name} requires a value`)
    }
    if (name === 'with' && value === true) throw new Error('--with requires a value')
  }
}

function addSelection({ selection, projectDir, keepFiles, registryResults }) {
  if (selection.type === 'component') {
    const result = registryResults.get(selection.name)
    if (!result) throw new Error(`Missing registry result for component: ${selection.name}`)
    return { ...selection, ...result }
  }

  return {
    ...selection,
    ...addCapability({
      projectDir,
      cap: selection.cap,
      adapter: selection.adapter,
      keep: keepFiles,
    }),
  }
}

function registryPlanLines(preflight) {
  return preflight ? [`shadcn: ${preflight.registryDependencies.join(', ')}`] : []
}

function installRegistryResults(preflight) {
  return preflight ? installRegistryComponents(preflight) : new Map()
}

async function runAdd(args) {
  validateAdditionInvocation(args)
  const projectRoot = resolve(process.cwd())
  const applications = findCompatibleApplications(projectRoot)
  if (applications.length === 0) {
    p.cancel('No compatible application found in this project.')
    process.exit(1)
  }
  const requestedApplication = args.flags.app
  const explicitAddition = !!args._[1] || args.options.some(({ name }) => name === 'with')
  if (!requestedApplication && explicitAddition && applications.length > 1) {
    p.cancel(
      `Multiple compatible applications found: ${applications
        .map((application) => relativeApplicationPath(projectRoot, application))
        .join(', ')}. Pass --app <relative-path>.`,
    )
    process.exit(1)
  }
  const projectDir = requestedApplication
    ? resolveApplicationPath(projectRoot, requestedApplication)
    : applications.length === 1
      ? applications[0]
      : cancelled(
          await p.select({
            message: 'Application to enrich',
            options: applications.map((application) => {
              const path = relativeApplicationPath(projectRoot, application)
              return { value: application, label: path }
            }),
          }),
        )
  const applicationPath = relativeApplicationPath(projectRoot, projectDir)
  const packageManagerFlags = args.options
    .filter(({ name }) => name === 'pm' || name === 'package-manager')
    .map(({ value }) => value)
  if (packageManagerFlags.length > 1) {
    throw new Error(
      'Ambiguous package manager overrides: pass only one of --pm or --package-manager',
    )
  }
  const packageManagerFlag = packageManagerFlags[0]
  const pm = packageManagerFlag
    ? resolveExplicitPackageManager(packageManagerFlag)
    : detectProjectPackageManager(projectRoot, detectedPm)

  const selections = await resolveAddSelections(args)
  const module = requireFrameworkModule(projectDir)
  validateAdditions(module, selections)
  const keepFiles = !!args.flags['keep-files']
  const force = !!args.flags.force
  const components = selections.filter((selection) => selection.type === 'component')
  const capabilities = selections.filter((selection) => selection.type === 'capability')
  const providerChanges = capabilities
    .map((selection) => ({
      ...selection,
      from: currentTargetAdapter(projectDir, selection.cap),
    }))
    .filter(({ from, adapter }) => from && from !== adapter)
  if (force && components.length === 0) throw new Error('--force only applies to components')
  if (keepFiles && providerChanges.length === 0) {
    throw new Error('--keep-files only applies to provider changes')
  }

  const registryPreflight = preflightRegistryComponents({
    projectDir,
    pm,
    components,
    noInstall: !!args.flags['no-install'],
    force,
  })

  p.intro('create-stack add')
  const plan = [
    `Application: ${applicationPath}`,
    `Package manager: ${pm.name}`,
    ...selections.map((selection) =>
      selection.type === 'component'
        ? `Addition: component ${selection.name}`
        : `Addition: ${selection.name}${selection.adapter ? ` (${selection.adapter})` : ''}`,
    ),
    ...providerChanges.map(
      ({ name, from, adapter }) =>
        `Provider change: ${name} (${from} → ${adapter}${keepFiles ? ', keeping files' : ''})`,
    ),
    ...registryPlanLines(registryPreflight),
  ]
  p.note(plan.join('\n'), 'Addition plan')

  const registryResults = installRegistryResults(registryPreflight)
  const added = selections.map((selection) =>
    addSelection({ selection, projectDir, keepFiles, registryResults }),
  )
  if (!args.flags['no-install']) {
    runVerificationGate(module.gate(pm), {
      cwd: projectDir,
      packageManager: pm,
      requireSuccess: false,
    })
  }

  p.note(
    added
      .map((addition) =>
        addition.type === 'component' ? componentLine(addition) : addedLine(addition),
      )
      .join('\n'),
    'Added',
  )

  const steps = added.flatMap((a) => (a.manualSteps ?? []).map((s) => `${a.name}: ${s}`))
  if (steps.length) p.note(steps.join('\n'), 'Finish by hand')

  p.outro(
    `Added ${added.map((a) => (a.type === 'component' ? `component ${a.name}` : a.name)).join(', ')}`,
  )
}

const componentLine = (c) => {
  const parts = [c.name]
  if (c.copied.length) parts.push(`+${c.copied.length} file${c.copied.length > 1 ? 's' : ''}`)
  if (c.skipped.length) parts.push(`(${c.skipped.length} kept)`)
  const deps = Object.keys(c.addDeps)
  if (deps.length) parts.push(`deps: ${deps.join(', ')}`)
  if (c.mounted) parts.push(`mounted <${c.rootName} />`)
  else if (c.rootName) parts.push(`add <${c.rootName} /> to your root layout`)
  return parts.join('  ')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const help = args.flags.help || args.flags.h

  if (args.flags.version || args.flags.v) {
    process.stdout.write(`${VERSION}\n`)
    return
  }

  if (args._[0] === 'add') {
    if (help) return void process.stdout.write(`${ADD_HELP}\n`)
    await runAdd(args)
    return
  }

  if (args._[0] === 'component') {
    throw new Error('The component command was removed; run create-stack add component <name>')
  }

  if (help) {
    process.stdout.write(`${HELP}\n`)
    return
  }

  validateCreationOptionNames(args.flags)
  validateCreationInvocation(args)

  const nonInteractive =
    args.flags.yes || args.flags.y || CREATION_OPTIONS.some((k) => k in args.flags)

  const answers = nonInteractive ? collectFromFlags(args) : await collectFromPrompts(args._[0])

  await execute(answers)
}

main().catch((err) => {
  p.log.error(String(err?.message || err))
  process.exit(1)
})
