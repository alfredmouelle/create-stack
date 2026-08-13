#!/usr/bin/env node
// create-stack — fork a base app, strip to selection, stamp identity, verify.
// Interactive by default; non-interactive when any selection flag (or --yes) is passed:
//   create-stack my-app --framework next --db drizzle --trpc --mail ses --no-install

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as p from '@clack/prompts'
import {
  ADDABLE,
  adapterChoicesFor,
  addableChoices,
  addCapability,
  resolveTargetAdapter,
  targetDir,
} from './lib/add.mjs'
import { isValidAlias, normalize, normalizeAlias, parseArgs, resolveMonorepo } from './lib/args.mjs'
import { resolveAuth } from './lib/auth.mjs'
import { buildProject } from './lib/build.mjs'
import {
  CAPABILITIES,
  canonicalCapabilityName,
  capabilityChoices,
  creationProviderChoices,
  resolveCreationProvider,
} from './lib/capabilities.mjs'
import { COMPONENT_NAMES, componentChoices, vendorComponent } from './lib/component.mjs'
import { resolveDatabase } from './lib/database.mjs'
import { packageName } from './lib/identity.mjs'
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
import { exists, isDirEmpty, join, run } from './lib/util.mjs'

// PM that launched us; the wizard pre-selects it and `add`/non-interactive fall back to it.
const detectedPm = detectPackageManager()

const VERSION = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
).version

const HELP = `create-stack — fork a base app, strip it to your selection.

Usage:
  create-stack [project] [flags]          Scaffold a new project
  create-stack add [capability] [adapter] Add capabilities to the current project
  create-stack component [name]           Install a standalone UI component

Run a command with no args for an interactive picker; pass a selection flag
(or --yes), or a capability/component name, for non-interactive mode.
See \`add --help\` and \`component --help\` for their options.

Scaffold flags:
  -f, --framework [tanstack|next]   Base app to fork (bare/default = tanstack)
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
  -y, --yes                        Non-interactive with all defaults
  -h, --help                       Show this help
  -v, --version                    Print version

Capability flags (omit to skip; pass with no value for the default adapter):
  --storage  --cache  --logger  --analytics    swappable behind a port
  --jobs [inngest]  --errors [sentry]           single provider
  --error-tracking [sentry]                     readable alias for --errors
  Adapters are listed in the interactive picker, or run \`add --help\`.`

const ADD_HELP = `create-stack add — vendor/swap capabilities into the current project.

Usage:
  create-stack add [capability] [adapter] [flags]

Run with no capability for a multi-select picker; pass a capability name (and
optional adapter) for non-interactive mode. Re-adding a multi-adapter capability
swaps its adapter; --keep retains the previous one(s).

Swappable behind a port: storage, cache, logger, analytics, mailer.
Single provider (no adapter): jobs (inngest), error-tracking (sentry).
No provider at all: email-ui, http.

Flags:
  --keep                           Keep existing adapter(s) when swapping
  --app <relative-path>            Application target (required when ambiguous)
  --pm <pnpm|npm|yarn|bun>         Override package manager detected from lockfile
  --package-manager <name>         Alias for --pm
  --no-install                     Skip install + verification
  -h, --help                       Show this help`

const COMPONENT_HELP = `create-stack component — vendor a standalone UI component into the current project.

Usage:
  create-stack component [name...] [flags]

Opt-in UI kept out of the base bundle. Run with no name for a multi-select
picker; pass one or more names for non-interactive mode. Vendored files are
never overwritten, so local edits survive a re-run — pass --force to overwrite
them. Callable components (confirm, alert, prompt…) also mount their Root in
your root layout automatically.

Components: ${COMPONENT_NAMES.join(', ')}.

Flags:
  --force                          Overwrite vendored files (default: keep edits)
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

/** Read --<capability> flags into { capability: adapter } (default adapter if bare). */
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
  if (value === true || value == null) return 'tanstack'
  if (['tanstack', 'next'].includes(value)) return value
  throw new Error(`Invalid framework: ${JSON.stringify(value)} (expected tanstack or next)`)
}

function resolvePackageManagerFlag(flags) {
  const value = flags.pm ?? flags['package-manager']
  if (value == null) return detectedPm
  if (typeof value === 'string' && PM_NAMES.includes(value)) return resolvePackageManager(value)
  throw new Error(
    `Invalid package manager: ${JSON.stringify(value)} (expected ${PM_NAMES.join(', ')})`,
  )
}

function resolveDatabaseFlag(flags, picked) {
  const legacyValue = ['drizzle', 'prisma'].find((database) => picked.includes(database))
  const value = flags.db ?? flags.database
  return resolveDatabase(value === true ? undefined : (value ?? legacyValue))
}

function resolveAuthFlag(flags, picked) {
  const value =
    typeof flags.auth === 'string'
      ? flags.auth
      : picked.includes('better-auth')
        ? 'better-auth'
        : undefined
  return resolveAuth(value)
}

function collectFromFlags(args) {
  const argDir = args._[0]
  if (!argDir) throw new Error('Project name is required (positional) in non-interactive mode')
  const framework = resolveFrameworkFlag(args.flags)
  const alias = normalizeAlias(typeof args.flags.alias === 'string' ? args.flags.alias : undefined)
  const pm = resolvePackageManagerFlag(args.flags)
  const { kept, database, auth, mailerProvider, adjustments, selectionReasons } =
    resolveCreationStack(args.flags)
  const capabilities = collectCapabilityFlags(args.flags)
  const doInstall = !args.flags['no-install']
  const monorepo = resolveMonorepo(args.flags.mono ?? args.flags.monorepo)
  return {
    argDir,
    projectName: argDir,
    framework,
    alias,
    pm,
    kept,
    database,
    auth,
    mailerProvider,
    adjustments,
    selectionReasons,
    capabilities,
    monorepo,
    doInstall,
  }
}

const has = (flags, name) => Object.hasOwn(flags, name)

function explicitDatabaseChoice(flags) {
  if (has(flags, 'no-db')) return 'none'
  if (has(flags, 'db') || has(flags, 'database')) return resolveDatabaseFlag(flags, [])
}

function explicitAuthChoice(flags) {
  if (has(flags, 'no-auth')) return 'none'
  if (has(flags, 'auth')) return resolveAuthFlag(flags, [])
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
  database: explicitDatabaseChoice(flags),
  auth: explicitAuthChoice(flags),
  mailer: explicitMailerChoice(flags),
  trpc: explicitTrpcChoice(flags),
})

function validateExplicitChoices(explicit) {
  if (explicit.database === 'convex' && explicit.auth === 'better-auth') {
    throw new Error('Better Auth cannot be used with Convex')
  }
  if (explicit.database === 'convex' && explicit.trpc === true) {
    throw new Error('Convex cannot be combined with tRPC')
  }
  if (explicit.auth === 'better-auth' && explicit.database === 'none') {
    throw new Error('Better Auth requires a database; remove --no-db or choose another auth')
  }
  if (explicit.auth === 'better-auth' && explicit.mailer === 'none') {
    throw new Error('Better Auth requires mail; remove --no-mail or choose another auth')
  }
}

function selectionReasons(explicit) {
  const reasons = {}
  for (const [axis, value] of Object.entries(explicit)) {
    if (value !== undefined) {
      reasons[axis] = value === 'none' || value === false ? 'requested exclusion' : 'requested'
    }
  }
  return reasons
}

function applyStartingConfiguration(resolved, reasons, minimal, acceptsRecommendedStack) {
  if (minimal) {
    resolved.database ??= 'none'
    resolved.auth ??= 'none'
    resolved.trpc ??= false
    resolved.mailer ??= 'none'
    for (const axis of ['database', 'auth', 'trpc', 'mailer']) reasons[axis] ??= 'minimal exclusion'
    return
  }

  resolved.database ??= 'drizzle'
  resolved.auth ??=
    resolved.database === 'convex' || resolved.database === 'none' || resolved.mailer === 'none'
      ? 'clerk'
      : 'better-auth'
  resolved.trpc ??= resolved.database !== 'convex'
  resolved.mailer ??= resolved.auth === 'better-auth' ? 'resend' : 'none'
  const reason = acceptsRecommendedStack ? 'recommended stack' : 'applicable recommendation'
  for (const axis of ['database', 'auth', 'trpc', 'mailer']) reasons[axis] ??= reason
}

function completeBetterAuthDependencies(resolved, explicit, reasons) {
  if (resolved.auth !== 'better-auth') return
  if (resolved.database === 'none') resolved.database = 'drizzle'
  if (resolved.mailer === 'none') resolved.mailer = 'resend'
  if (explicit.auth === 'better-auth') {
    if (explicit.database === undefined) reasons.database = 'dependency completion for Better Auth'
    if (explicit.mailer === undefined) reasons.mailer = 'dependency completion for Better Auth'
  }
}

function resolveCreationStack(flags) {
  const explicit = explicitCreationChoices(flags)
  validateExplicitChoices(explicit)
  const resolved = { ...explicit }
  const reasons = selectionReasons(explicit)
  applyStartingConfiguration(
    resolved,
    reasons,
    has(flags, 'minimal'),
    has(flags, 'y') || has(flags, 'yes'),
  )
  completeBetterAuthDependencies(resolved, explicit, reasons)

  return {
    kept: new Set(resolved.trpc ? ['trpc'] : []),
    database: resolved.database,
    auth: resolved.auth,
    mailerProvider: resolved.mailer,
    adjustments: [],
    selectionReasons: reasons,
  }
}

function resolveMailer(value) {
  if (value === true || value == null || value === '') return 'resend'
  if (value === 'none' || ['resend', 'brevo', 'ses'].includes(value)) return value
  throw new Error(
    `Invalid mail provider: ${JSON.stringify(value)} (expected resend, brevo, ses, or none)`,
  )
}

/** Ask which adapter to use for each picked capability; a module has nothing to pick. */
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
  p.intro('create-stack — fork a base app, strip it to your selection')

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
      options: [
        { value: 'tanstack', label: 'TanStack Start' },
        { value: 'next', label: 'Next.js (App Router)' },
      ],
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
        { value: 'none', label: 'None', hint: 'no database (vitrine)' },
      ],
    }),
  )

  // Convex replaces tRPC and can't back the Postgres-coupled better-auth (Clerk/none only).
  const convex = database === 'convex'

  // better-auth needs a Postgres database; with `none`/`convex` only offer db-less providers.
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

  // trpc needs a database and is subsumed by Convex, so only offer it for SQL ORMs.
  const wantsTrpc =
    database === 'none' || convex
      ? false
      : cancelled(await p.confirm({ message: 'Include tRPC?', initialValue: true }))
  const picked = wantsTrpc ? ['trpc'] : []

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

  const {
    kept,
    database: db,
    auth: authProvider,
    mailerProvider,
    adjustments,
  } = normalize(picked, database, auth, mailer)
  return {
    argDir,
    projectName,
    framework,
    alias,
    pm,
    database: db,
    auth: authProvider,
    kept,
    mailerProvider,
    adjustments,
    capabilities,
    monorepo,
    doInstall,
  }
}

const pmRun = (pm, script, projectDir, opts = {}) =>
  run(pm.exec, pm.runArgs(script), { cwd: projectDir, ...opts })

/** Install deps, normalize formatting, then report typecheck + biome status. */
function installAndVerify(projectDir, pm) {
  p.log.step(`${pm.name} install`)
  run(pm.exec, ['install'], { cwd: projectDir })
  // re-format under the fork's own Biome so the initial commit is lint-clean for any selection
  pmRun(pm, 'check:write', projectDir, { stdio: 'ignore' })
  p.log.step('Verifying (typecheck + biome)')
  const tc = pmRun(pm, 'typecheck', projectDir)
  const lint = pmRun(pm, 'check', projectDir)
  p.log[tc && lint ? 'success' : 'warn'](
    tc && lint ? 'typecheck + biome clean' : 'verify reported issues (see output above)',
  )
}

/**
 * Fresh repo + best-effort initial commit (also satisfies Biome vcs.useIgnoreFile).
 * Wires git hooks first so they're live from the first install; --no-verify keeps our
 * own commit from tripping them. Commit is skipped (tree left staged) if git identity unset.
 */
function initGitRepo(projectDir) {
  if (!run('git', ['-C', projectDir, 'init', '-q'])) return
  if (exists(join(projectDir, '.githooks'))) {
    run('git', ['-C', projectDir, 'config', 'core.hooksPath', '.githooks'])
  }
  run('git', ['-C', projectDir, 'add', '-A'])
  const msg = 'chore: initial commit from create-stack'
  const committed = run('git', ['-C', projectDir, 'commit', '--no-verify', '-q', '-m', msg], {
    stdio: 'ignore',
  })
  p.log.step(
    committed
      ? 'git repository initialized (initial commit created)'
      : 'git repository initialized — set git user.name/email, then commit',
  )
}

function execute(a) {
  const projectDir = resolve(process.cwd(), a.argDir ?? a.projectName)
  if (!isDirEmpty(projectDir)) {
    p.cancel(`Target directory is not empty: ${projectDir}`)
    process.exit(1)
  }
  const pm = a.pm ?? detectedPm

  p.note(creationPlanLines(a, pm).join('\n'), 'Creation plan')

  for (const adjustment of a.adjustments ?? []) p.log.warn(adjustment)

  const s = p.spinner()
  s.start('Forking + stripping the base app')
  const built = buildProject({ ...a, projectDir, projectName: packageName(projectDir), pm })
  s.stop('Project scaffolded')

  if (a.doInstall) installAndVerify(projectDir, pm)

  initGitRepo(projectDir)

  p.note(summaryLines(a, pm).join('\n'), 'Done')
  if (built.manualSteps?.length) p.note(built.manualSteps.join('\n'), 'Finish by hand')
  p.outro(`Created ${a.projectName}`)
}

const orNone = (v) => (v && v !== 'none' ? v : '(none)')

const formatCapability = ([capability, provider]) =>
  provider
    ? `${canonicalCapabilityName(capability)} (${provider})`
    : canonicalCapabilityName(capability)

function creationPlanLines(a, pm) {
  const monoLabel = a.monorepo === 'nx' ? 'Nx' : a.monorepo === 'turborepo' ? 'Turborepo' : null
  const capabilities = Object.entries(a.capabilities ?? {}).map(formatCapability)
  const reason = (axis) => (a.selectionReasons?.[axis] ? ` — ${a.selectionReasons[axis]}` : '')
  return [
    `Target: ${a.argDir ?? a.projectName}`,
    `Framework: ${a.framework === 'next' ? 'Next.js' : 'TanStack Start'}`,
    `Monorepo: ${monoLabel ?? '(none)'}`,
    `Package manager: ${pm.name}`,
    `Import alias: ${a.alias ?? '~'}/`,
    `Database: ${orNone(a.database)}${reason('database')}`,
    `Auth: ${orNone(a.auth)}${reason('auth')}`,
    `tRPC: ${a.kept.has('trpc') ? 'yes' : 'no'}${reason('trpc')}`,
    `Mailer: ${orNone(a.mailerProvider)}${reason('mailer')}`,
    `Capabilities: ${capabilities.join(', ') || '(none)'}${capabilities.length ? ' — requested' : ''}`,
    `Install and verify: ${a.doInstall ? 'yes' : 'no'}`,
  ]
}

/** The "Done" note: selection recap + next steps. */
function summaryLines(a, pm) {
  const capEntries = Object.entries(a.capabilities ?? {})
  const appRel = a.monorepo ? 'apps/web/' : ''
  const monoLabel = a.monorepo === 'nx' ? 'Nx' : a.monorepo === 'turborepo' ? 'Turborepo' : null
  const lines = [
    `Framework: ${a.framework === 'next' ? 'Next.js' : 'TanStack Start'}`,
    `Monorepo: ${monoLabel ? `${monoLabel} (app in apps/web)` : '(none)'}`,
    `Package manager: ${pm.name}`,
    `Import alias: ${a.alias ?? '~'}/`,
    `Database: ${orNone(a.database)}`,
    `Auth: ${orNone(a.auth)}`,
    `Foundations: ${[...a.kept].sort().join(', ') || '(none)'}`,
    `Mailer: ${orNone(a.mailerProvider)}`,
    `Capabilities: ${capEntries.map(formatCapability).join(', ') || '(none)'}`,
    '',
    'Add more tools later: create-stack add <capability>.',
    '',
    'Next:',
    `  cd ${a.argDir ?? a.projectName}`,
  ]
  if (!a.doInstall) lines.push(`  ${pm.name} install`)
  if (a.database === 'convex') {
    const prefix = a.monorepo ? 'cd apps/web && ' : ''
    lines.push(`  ${prefix}${pm.name} run convex  # provisions a deployment + sets CONVEX_URL`)
  }
  lines.push(`  # edit ${appRel}.env (already generated with placeholders)`, `  ${pm.devCmd}`)
  return lines
}

/** Which {cap, adapter} pairs to add: positional args (non-interactive), else a picker. */
async function resolveAddSelections(args) {
  if (args._[1]) {
    const cap = args._[1]
    if (!ADDABLE.includes(cap)) {
      const formerEmailUiName = ['email', 'kit'].join('-')
      if (cap === formerEmailUiName) {
        p.cancel(`'${formerEmailUiName}' was renamed to 'email-ui'; run create-stack add email-ui`)
        process.exit(1)
      }
      p.cancel(`Unknown capability: ${cap} — pick one of ${ADDABLE.join(', ')}`)
      process.exit(1)
    }
    return [{ cap, adapter: resolveTargetAdapter(cap, args._[2]) }] // throws on a bad adapter
  }
  const caps = cancelled(
    await p.multiselect({
      message: 'Capabilities to add (space to toggle)',
      required: true,
      options: addableChoices(),
    }),
  )
  const selections = []
  for (const cap of caps) {
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
    selections.push({ cap, adapter })
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

/** `create-stack add [capability] [adapter] [--keep]` — vendor/swap capabilities in the cwd project. */
async function runAdd(args) {
  const projectRoot = resolve(process.cwd())
  const applications = findCompatibleApplications(projectRoot)
  if (applications.length === 0) {
    p.cancel('No compatible application found in this project.')
    process.exit(1)
  }
  const requestedApplication = args.flags.app
  const explicitAddition = !!args._[1]
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

  p.intro('create-stack add')
  p.log.info(`Application: ${applicationPath}`)
  p.log.info(`Package manager: ${pm.name}`)
  const keep = !!args.flags.keep
  const selections = await resolveAddSelections(args)
  const added = selections.map((sel) => ({
    ...sel,
    ...addCapability({ projectDir, ...sel, keep }),
  }))
  if (!args.flags['no-install']) installAndVerify(projectDir, pm)

  p.note(added.map(addedLine).join('\n'), keep ? 'Added (kept existing adapters)' : 'Added')

  // Wiring that means editing files the project owns, so the user applies it.
  const steps = added.flatMap((a) => (a.manualSteps ?? []).map((s) => `${a.cap}: ${s}`))
  if (steps.length) p.note(steps.join('\n'), 'Finish by hand')

  p.outro(`Added ${added.map((a) => a.cap).join(', ')}`)
}

/** Which components to install: positional names (non-interactive), else a picker. */
async function resolveComponentSelections(args) {
  const names = args._.slice(1)
  if (names.length) {
    for (const name of names) {
      if (!COMPONENT_NAMES.includes(name)) {
        p.cancel(`Unknown component: ${name} — pick one of ${COMPONENT_NAMES.join(', ')}`)
        process.exit(1)
      }
    }
    return names
  }
  return cancelled(
    await p.multiselect({
      message: 'Components to install (space to toggle)',
      required: true,
      options: componentChoices(),
    }),
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

/** `create-stack component [name]` — vendor a standalone UI component into the cwd project. */
async function runComponent(args) {
  const projectDir = resolve(process.cwd())
  if (!exists(join(projectDir, 'package.json'))) {
    p.cancel('No package.json here — run this from the root of a create-stack project.')
    process.exit(1)
  }

  p.intro('create-stack component')
  const force = !!args.flags.force
  const names = await resolveComponentSelections(args)
  const installed = names.map((name) => ({ name, ...vendorComponent({ projectDir, name, force }) }))
  if (!args.flags['no-install']) installAndVerify(projectDir, detectedPm)

  p.note(installed.map(componentLine).join('\n'), 'Installed')
  p.outro(`Installed ${installed.map((c) => c.name).join(', ')}`)
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
    if (help) return void process.stdout.write(`${COMPONENT_HELP}\n`)
    await runComponent(args)
    return
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
      ...Object.keys(CREATION_CAPABILITY_OPTIONS),
    ].some((k) => k in args.flags)

  const answers = nonInteractive ? collectFromFlags(args) : await collectFromPrompts(args._[0])

  execute(answers)
}

main().catch((err) => {
  p.log.error(String(err?.message || err))
  process.exit(1)
})
