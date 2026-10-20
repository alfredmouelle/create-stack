#!/usr/bin/env node

import { resolve } from 'node:path'
import * as p from '@clack/prompts'
import {
  ADDABLE,
  adapterChoicesFor,
  addableChoices,
  addCapability,
  currentTargetAdapter,
  requireFrameworkModule,
  resolveAdditionKind,
  resolveTargetAdapter,
  targetDir,
} from './lib/add.mjs'
import { isValidAlias, normalizeAlias, parseArgs, resolveMonorepo } from './lib/args.mjs'
import { resolveAuth } from './lib/auth.mjs'
import {
  CAPABILITIES,
  canonicalCapabilityName,
  capabilityChoices,
  creationProviderChoices,
  resolveCreationProvider,
} from './lib/capabilities.mjs'
import { resolveDatabase } from './lib/database.mjs'
import { createProject, runVerificationGate, validateAdditions } from './lib/engine.mjs'
import {
  detectPackageManager,
  detectProjectPackageManager,
  PM_NAMES,
  resolveExplicitPackageManager,
  resolvePackageManager,
} from './lib/package-manager.mjs'
import {
  findCompatibleApplications,
  relativeApplicationPath,
  resolveApplicationPath,
} from './lib/project-target.mjs'
import { COMPONENT_CATALOG, COMPONENT_NAMES } from './lib/registry.mjs'
import { installRegistryComponents, preflightRegistryComponents } from './lib/shadcn.mjs'
import {
  FRAMEWORK_SUPPORT,
  FRAMEWORKS,
  RECOMMENDED_FRAMEWORK,
  resolveCreationConfiguration,
} from './lib/stack-config.mjs'
import { CLI_VERSION } from './lib/version.mjs'

const detectedPm = detectPackageManager()

const VERSION = CLI_VERSION

const HELP = `create-stack: fork a base app, strip it to your selection.

Usage:
  create-stack [project] [flags]          Scaffold a new project
  create-stack add <kind> [provider]      Add one capability or component
  create-stack add --with <item> [...]    Add a validated batch

Run a command with no args for an interactive picker; pass a selection flag
(or --yes), or an addition name, for non-interactive mode.
See \`add --help\` for its options.

Scaffold flags:
  -f, --framework [${FRAMEWORKS.join('|')}]   Framework (bare/default = ${RECOMMENDED_FRAMEWORK})
  --mono, --monorepo [turbo|nx]    Scaffold into a monorepo, app in apps/web (bare = turbo)
  --pm <pnpm|npm|yarn|bun>         Package manager (default: auto-detected)
  --alias <prefix>                 Import alias prefix, e.g. @ or # (default ~)
  --db, --database [drizzle|prisma|convex|none] ORM the app ships (bare/default = drizzle)
  --auth <better-auth|clerk|none>  Auth provider (default better-auth)
  --mail, --mailer [resend|brevo|ses|none] Mail provider (bare/default = resend)
  --minimal                        Start with a frontend-only project
  --trpc / --no-trpc               Include or explicitly exclude tRPC
  --no-db / --no-auth / --no-mail  Explicitly exclude a stack part
  --no-install                     Skip install + verification
  --no-git                         Do not initialize a Git repository
  -y, --yes                        Non-interactive with all defaults
  -h, --help                       Show this help
  -v, --version                    Print version

Capability flags (omit to skip; pass with no value for the default adapter):
  --storage  --cache  --logger  --analytics    swappable behind a port
  --jobs [inngest]  --errors [sentry]           single provider
  --error-tracking [sentry]                     readable alias for --errors
  Adapters are listed in the interactive picker, or run \`add --help\`.`

const ADD_HELP = `create-stack add: enrich an existing application.

Usage:
  create-stack add <capability> [provider] [flags]
  create-stack add component <name> [flags]
  create-stack add --with <kind>[=<provider>] [--with ...] [flags]

Run with no addition for an interactive picker. An explicit addition prints its
resolved plan and runs without confirmation. Provider changes remove former
provider files by default; --keep-files retains them.

Swappable behind a port: storage, cache, logger, analytics, mail.
Single provider: jobs (inngest), errors (sentry).
No provider at all: email-ui, http.
Components: ${COMPONENT_NAMES.join(', ')}.

Flags:
  --with <kind>[=<provider>]        Add one item to a validated addition batch (repeatable)
  --keep-files                     Keep former provider files when changing provider
  --force                          Replace existing files for a selected component
  --app <relative-path>            Application target (required when ambiguous)
  --pm <pnpm|npm|yarn|bun>         Override package manager detected from lockfile
  --package-manager <name>         Alias for --pm
  --no-install                     Skip install + verification
  -h, --help                       Show this help`

const CREATION_CAPABILITY_OPTIONS = Object.fromEntries([
  ...CAPABILITIES.map((capability) => [canonicalCapabilityName(capability), capability]),
  ['error-tracking', 'error-tracking'],
])

const CREATION_OPTIONS = [
  'f',
  'framework',
  'db',
  'database',
  'auth',
  'mail',
  'mailer',
  'mono',
  'monorepo',
  'pm',
  'package-manager',
  'alias',
  'no-install',
  'no-git',
  'y',
  'yes',
  'minimal',
  'trpc',
  'no-trpc',
  'no-db',
  'no-auth',
  'no-mail',
  ...Object.keys(CREATION_CAPABILITY_OPTIONS),
]

const BOOLEAN_CREATION_OPTIONS = new Set([
  'y',
  'yes',
  'minimal',
  'trpc',
  'no-trpc',
  'no-db',
  'no-auth',
  'no-mail',
  'no-install',
  'no-git',
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
    const hint = editDistance(name, suggestion) <= 3 ? ` Did you mean --${suggestion}?` : ''
    throw new Error(`Unknown option: --${name}.${hint}`)
  }
}

const CREATION_AXES = {
  Framework: ['f', 'framework'],
  Database: ['db', 'database', 'no-db'],
  Auth: ['auth', 'no-auth'],
  Mail: ['mail', 'mailer', 'no-mail'],
  tRPC: ['trpc', 'no-trpc'],
  Monorepo: ['mono', 'monorepo'],
  'Package manager': ['pm', 'package-manager'],
  'Import alias': ['alias'],
  'Recommended stack acceptance': ['y', 'yes'],
  'Minimal project': ['minimal'],
  ...Object.fromEntries(
    CAPABILITIES.map((capability) => [
      canonicalCapabilityName(capability)
        .split('-')
        .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
        .join(' '),
      Object.entries(CREATION_CAPABILITY_OPTIONS)
        .filter(([, internalName]) => internalName === capability)
        .map(([option]) => option),
    ]),
  ),
}

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

  const yes = args.flags.y || args.flags.yes
  if (!yes) return
  if ('minimal' in args.flags) throw new Error('--yes cannot be combined with --minimal')
  const stackOptions = new Set([
    'f',
    'framework',
    'db',
    'database',
    'auth',
    'mail',
    'mailer',
    'mono',
    'monorepo',
    'trpc',
    'no-trpc',
    'no-db',
    'no-auth',
    'no-mail',
    ...Object.keys(CREATION_CAPABILITY_OPTIONS),
  ])
  const conflict = args.options.find(({ name }) => stackOptions.has(name))
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
  if (FRAMEWORKS.includes(value)) return value
  const expected = new Intl.ListFormat('en', { type: 'disjunction' }).format(FRAMEWORKS)
  throw new Error(`Invalid framework: ${JSON.stringify(value)} (expected ${expected})`)
}

function resolvePackageManagerFlag(flags) {
  const value = flags.pm ?? flags['package-manager']
  if (value == null) return detectedPm
  if (typeof value === 'string' && PM_NAMES.includes(value)) return resolvePackageManager(value)
  throw new Error(
    `Invalid package manager: ${JSON.stringify(value)} (expected ${PM_NAMES.join(', ')})`,
  )
}

function resolveDatabaseFlag(flags) {
  const value = flags.db ?? flags.database
  return resolveDatabase(value === true ? undefined : value)
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
    selectionReasons: stack.selectionReasons,
    capabilities,
    monorepo,
    doInstall,
    doGit,
  }
}

const has = (flags, name) => Object.hasOwn(flags, name)

function explicitDatabaseChoice(flags) {
  if (has(flags, 'no-db')) return 'none'
  if (has(flags, 'db') || has(flags, 'database')) return resolveDatabaseFlag(flags)
}

function explicitAuthChoice(flags) {
  if (has(flags, 'no-auth')) return 'none'
  if (has(flags, 'auth')) return resolveAuthFlag(flags)
}

function explicitMailerChoice(flags) {
  if (has(flags, 'no-mail')) return 'none'
  if (has(flags, 'mail') || has(flags, 'mailer')) return resolveMailer(flags.mail ?? flags.mailer)
}

function explicitTrpcChoice(flags) {
  if (has(flags, 'trpc')) return true
  if (has(flags, 'no-trpc')) return false
}

const explicitCreationChoices = (flags) => ({
  framework: has(flags, 'f') || has(flags, 'framework') ? resolveFrameworkFlag(flags) : undefined,
  database: explicitDatabaseChoice(flags),
  auth: explicitAuthChoice(flags),
  mailer: explicitMailerChoice(flags),
  trpc: explicitTrpcChoice(flags),
})

function creationConfigurationInput(flags) {
  return {
    ...explicitCreationChoices(flags),
    minimal: has(flags, 'minimal'),
  }
}

function resolveMailer(value) {
  if (value === true || value == null || value === '') return 'resend'
  if (value === 'none' || ['resend', 'brevo', 'ses'].includes(value)) return value
  throw new Error(
    `Invalid mail provider: ${JSON.stringify(value)} (expected resend, brevo, ses, or none)`,
  )
}

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
  p.intro('create-stack: fork a base app, strip it to your selection')

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
      options: FRAMEWORKS.map((id) => ({ value: id, label: FRAMEWORK_SUPPORT[id].label })),
    }),
  )

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
        options: PM_NAMES.map((n) => ({
          value: n,
          label: n === detectedPm.name ? `${n} (detected)` : n,
        })),
      }),
    ),
  )

  const database = cancelled(
    await p.select({
      message: 'Database',
      initialValue: 'drizzle',
      options: [
        { value: 'drizzle', label: 'Drizzle ORM', hint: 'Postgres + seed (default)' },
        { value: 'prisma', label: 'Prisma ORM', hint: 'Prisma 7 + Postgres' },
        { value: 'convex', label: 'Convex', hint: 'realtime db + API (replaces tRPC)' },
        { value: 'none', label: 'None', hint: 'no database' },
      ],
    }),
  )

  const convex = database === 'convex'

  const betterAuthOpt = {
    value: 'better-auth',
    label: 'better-auth',
    hint: 'email+password, needs a mailer',
  }
  const authOptions = [
    ...(database === 'none' || convex ? [] : [betterAuthOpt]),
    { value: 'clerk', label: 'Clerk', hint: 'hosted, no db/mailer needed' },
    { value: 'none', label: 'None', hint: 'no auth' },
  ]
  const auth = cancelled(
    await p.select({
      message: 'Auth',
      initialValue: database === 'none' || convex ? 'clerk' : 'better-auth',
      options: authOptions,
    }),
  )

  const wantsTrpc = convex
    ? false
    : cancelled(await p.confirm({ message: 'Include tRPC?', initialValue: true }))
  const mailerForced = auth === 'better-auth'
  const mailerOpts = [
    { value: 'resend', label: 'Resend' },
    { value: 'brevo', label: 'Brevo' },
    { value: 'ses', label: 'Amazon SES' },
  ]
  if (!mailerForced) mailerOpts.push({ value: 'none', label: 'None' })
  const mailer = cancelled(
    await p.select({
      message: mailerForced ? 'Mailer provider (required by better-auth)' : 'Mailer provider',
      options: mailerOpts,
      initialValue: mailerForced ? 'resend' : 'none',
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
    args.flags.yes ||
    args.flags.y ||
    [
      'framework',
      'f',
      'minimal',
      'db',
      'database',
      'auth',
      'mail',
      'trpc',
      'no-trpc',
      'no-db',
      'no-auth',
      'no-mail',
      'mailer',
      'mono',
      'monorepo',
      'pm',
      'package-manager',
      'alias',
      'no-install',
      'no-git',
      ...Object.keys(CREATION_CAPABILITY_OPTIONS),
    ].some((k) => k in args.flags)

  const answers = nonInteractive ? collectFromFlags(args) : await collectFromPrompts(args._[0])

  await execute(answers)
}

main().catch((err) => {
  p.log.error(String(err?.message || err))
  process.exit(1)
})
