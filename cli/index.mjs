#!/usr/bin/env node
// create-stack — fork a base app, strip to selection, stamp identity, verify.
// Interactive by default; non-interactive when any selection flag (or --yes) is passed:
//   create-stack my-app --framework next --foundations drizzle,trpc --mailer ses --no-install

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as p from '@clack/prompts'
import {
  ADDABLE,
  adapterChoicesFor,
  addableChoices,
  addCapability,
  currentTargetAdapter,
  resolveAdditionKind,
  resolveTargetAdapter,
  targetDir,
} from './lib/add.mjs'
import {
  ALL_FOUNDATIONS,
  csv,
  isValidAlias,
  normalize,
  normalizeAlias,
  parseArgs,
  resolveMonorepo,
} from './lib/args.mjs'
import { resolveAuth } from './lib/auth.mjs'
import { buildProject } from './lib/build.mjs'
import {
  adapterChoices,
  CAPABILITIES,
  capabilityChoices,
  resolveAdapter,
} from './lib/capabilities.mjs'
import { COMPONENT_NAMES, vendorComponent } from './lib/component.mjs'
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
  create-stack add <kind> [provider]       Add a capability or component

Run a command with no args for an interactive picker; pass a selection flag
(or --yes), or an addition name, for non-interactive mode.
See \`add --help\` for its options.

Scaffold flags:
  -f, --framework [tanstack|next]   Base app to fork (bare/default = tanstack)
  --mono, --monorepo [turbo|nx]    Scaffold into a monorepo, app in apps/web (bare = turbo)
  --pm <pnpm|npm|yarn|bun>         Package manager (default: auto-detected)
  --alias <prefix>                 Import alias prefix, e.g. @ or # (default ~)
  --db, --database [drizzle|prisma|convex|none] ORM the app ships (bare/default = drizzle)
  --auth <better-auth|clerk|none>  Auth provider (default better-auth)
  --foundations <csv>              trpc (default all)
  --mail, --mailer [resend|brevo|ses|none] Mail provider (bare/default = resend)
  --no-install                     Skip install + verification
  -y, --yes                        Non-interactive with all defaults
  -h, --help                       Show this help
  -v, --version                    Print version

Capability flags (omit to skip; pass with no value for the default adapter):
  --storage  --cache  --logger  --analytics    swappable behind a port
  --jobs  --error-tracking                     single provider, no adapter to pick
  Adapters are listed in the interactive picker, or run \`add --help\`.`

const ADD_HELP = `create-stack add — enrich an existing application.

Usage:
  create-stack add <capability> [provider] [flags]
  create-stack add component <name> [flags]

Run with no addition for an interactive picker. An explicit addition prints its
resolved plan and runs without confirmation. Provider changes remove former
provider files by default; --keep-files retains them.

Swappable behind a port: storage, cache, logger, analytics, mail.
Single provider: jobs (inngest), errors (sentry).
No provider at all: email-ui, http.
Components: ${COMPONENT_NAMES.join(', ')}.

Flags:
  --keep-files                     Keep former provider files when changing provider
  --force                          Replace existing files for a selected component
  --app <relative-path>            Application target (required when ambiguous)
  --pm <pnpm|npm|yarn|bun>         Override package manager detected from lockfile
  --package-manager <name>         Alias for --pm
  --no-install                     Skip install + verification
  -h, --help                       Show this help`

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
  // Kept temporarily for the later migration slice, which will replace it with
  // a targeted removal diagnostic.
  'foundations',
  ...CAPABILITIES,
]

const BOOLEAN_CREATION_OPTIONS = new Set(['y', 'yes', 'minimal', 'no-install'])

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
  Database: ['db', 'database'],
  Auth: ['auth'],
  Mail: ['mail', 'mailer'],
  Monorepo: ['mono', 'monorepo'],
  'Package manager': ['pm', 'package-manager'],
  'Import alias': ['alias'],
  'Recommended stack acceptance': ['y', 'yes'],
  ...Object.fromEntries(
    CAPABILITIES.map((capability) => [
      capability
        .split('-')
        .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
        .join(' '),
      [capability],
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
    'foundations',
    ...CAPABILITIES,
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
    if (cap in flags) out[cap] = resolveAdapter(cap, flags[cap])
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
  const picked = args.flags.foundations ? csv(args.flags.foundations) : [...ALL_FOUNDATIONS]
  // soft-map legacy `--foundations drizzle|prisma|better-auth` onto their axes
  const { kept, database, auth, mailerProvider, adjustments } = normalize(
    picked,
    resolveDatabaseFlag(args.flags, picked),
    resolveAuthFlag(args.flags, picked),
    resolveMailer(args.flags.mail ?? args.flags.mailer),
  )
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
    capabilities,
    monorepo,
    doInstall,
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
    const choices = adapterChoices(cap)
    out[cap] = choices
      ? cancelled(
          await p.select({
            message: `${cap} adapter`,
            options: choices.options,
            initialValue: choices.defaultAdapter,
          }),
        )
      : null
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

function creationPlanLines(a, pm) {
  const monoLabel = a.monorepo === 'nx' ? 'Nx' : a.monorepo === 'turborepo' ? 'Turborepo' : null
  const capabilities = Object.entries(a.capabilities ?? {}).map(([capability, provider]) =>
    provider ? `${capability} (${provider})` : capability,
  )
  return [
    `Target: ${a.argDir ?? a.projectName}`,
    `Framework: ${a.framework === 'next' ? 'Next.js' : 'TanStack Start'}`,
    `Monorepo: ${monoLabel ?? '(none)'}`,
    `Package manager: ${pm.name}`,
    `Import alias: ${a.alias ?? '~'}/`,
    `Database: ${orNone(a.database)}`,
    `Auth: ${orNone(a.auth)}`,
    `tRPC: ${a.kept.has('trpc') ? 'yes' : 'no'}`,
    `Mailer: ${orNone(a.mailerProvider)}`,
    `Capabilities: ${capabilities.join(', ') || '(none)'}`,
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
    // a module has no adapter, so it shows bare rather than as `cap (null)`
    `Capabilities: ${capEntries.map(([c, ad]) => (ad ? `${c} (${ad})` : c)).join(', ') || '(none)'}`,
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

function resolveExplicitAddition(args) {
  const requestedKind = args._[1]
  if (requestedKind === 'component') {
    const name = args._[2]
    if (!name) throw new Error('component requires a name')
    if (args._[3]) throw new Error(`Unexpected positional argument: ${args._[3]}`)
    if (!COMPONENT_NAMES.includes(name)) {
      throw new Error(`Unknown component: ${name} — pick one of ${COMPONENT_NAMES.join(', ')}`)
    }
    return { type: 'component', name }
  }

  const resolved = resolveAdditionKind(requestedKind)
  if (!resolved) {
    const formerEmailUiName = ['email', 'kit'].join('-')
    if (requestedKind === formerEmailUiName) {
      throw new Error(
        `'${formerEmailUiName}' was renamed to 'email-ui'; run create-stack add email-ui`,
      )
    }
    throw new Error(
      `Unknown addition: ${requestedKind} — pick one of ${ADDABLE.join(', ')}, component`,
    )
  }
  if (args._[3]) throw new Error(`Unexpected positional argument: ${args._[3]}`)
  return {
    type: 'capability',
    ...resolved,
    adapter: resolveTargetAdapter(resolved.cap, args._[2]),
  }
}

/** Which additions to apply: one positional selection, otherwise the capability picker. */
async function resolveAddSelections(args) {
  if (args._[1]) return [resolveExplicitAddition(args)]

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
  }
}

/** `create-stack add <kind> [provider]` — enrich the resolved application target. */
async function runAdd(args) {
  validateAdditionInvocation(args)
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

  const selections = await resolveAddSelections(args)
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
  ]
  p.note(plan.join('\n'), 'Addition plan')

  const added = selections.map((selection) =>
    selection.type === 'component'
      ? { ...selection, ...vendorComponent({ projectDir, name: selection.name, force }) }
      : {
          ...selection,
          ...addCapability({
            projectDir,
            cap: selection.cap,
            adapter: selection.adapter,
            keep: keepFiles,
          }),
        },
  )
  if (!args.flags['no-install']) installAndVerify(projectDir, pm)

  p.note(
    added
      .map((addition) =>
        addition.type === 'component' ? componentLine(addition) : addedLine(addition),
      )
      .join('\n'),
    'Added',
  )

  // Wiring that means editing files the project owns, so the user applies it.
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
      'db',
      'database',
      'auth',
      'mail',
      'foundations',
      'mailer',
      'mono',
      'monorepo',
      'pm',
      'package-manager',
      'alias',
      'no-install',
      ...CAPABILITIES,
    ].some((k) => k in args.flags)

  const answers = nonInteractive ? collectFromFlags(args) : await collectFromPrompts(args._[0])

  execute(answers)
}

main().catch((err) => {
  p.log.error(String(err?.message || err))
  process.exit(1)
})
