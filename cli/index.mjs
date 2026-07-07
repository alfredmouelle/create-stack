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
} from './lib/args.mjs'
import { resolveAuth } from './lib/auth.mjs'
import { buildProject } from './lib/build.mjs'
import {
  adapterChoices,
  CAPABILITIES,
  capabilityChoices,
  resolveAdapter,
} from './lib/capabilities.mjs'
import { COMPONENT_NAMES, componentChoices, vendorComponent } from './lib/component.mjs'
import { resolveDatabase } from './lib/database.mjs'
import { detectPackageManager, PM_NAMES, resolvePackageManager } from './lib/package-manager.mjs'
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
  --framework <tanstack|next>      Base app to fork (default tanstack)
  --pm <pnpm|npm|yarn|bun>         Package manager (default: auto-detected)
  --alias <prefix>                 Import alias prefix, e.g. @ or # (default ~)
  --database <drizzle|prisma|none> ORM the app ships (default drizzle)
  --auth <better-auth|clerk|none>  Auth provider (default better-auth)
  --foundations <csv>              trpc (default all)
  --mailer <resend|brevo|ses|none> Mailer provider (default resend)
  --no-install                     Skip install + verification
  -y, --yes                        Non-interactive with all defaults
  -h, --help                       Show this help
  -v, --version                    Print version

Capability flags (omit to skip; pass with no value for the default adapter):
  --storage  --cache  --jobs  --logger  --analytics  --error-tracking
  Adapters are listed in the interactive picker, or run \`add --help\`.`

const ADD_HELP = `create-stack add — vendor/swap capabilities into the current project.

Usage:
  create-stack add [capability] [adapter] [flags]

Run with no capability for a multi-select picker; pass a capability name (and
optional adapter) for non-interactive mode. Re-adding a multi-adapter capability
swaps its adapter; --keep retains the previous one(s).

Capabilities: storage, cache, jobs, logger, analytics, error-tracking,
mailer, email-kit, http.

Flags:
  --keep                           Keep existing adapter(s) when swapping
  --no-install                     Skip install + verification
  -h, --help                       Show this help`

const COMPONENT_HELP = `create-stack component — vendor a standalone UI component into the current project.

Usage:
  create-stack component [name] [flags]

Opt-in UI kept out of the base bundle. Run with no name for a multi-select
picker; pass a name for non-interactive mode. Vendored files are never
overwritten, so local edits survive a re-run — pass --force to overwrite them.

Components: ${COMPONENT_NAMES.join(', ')}.

Flags:
  --force                          Overwrite vendored files (default: keep edits)
  --no-install                     Skip install + verification
  -h, --help                       Show this help`

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

function collectFromFlags(args) {
  const argDir = args._[0]
  if (!argDir) throw new Error('Project name is required (positional) in non-interactive mode')
  const framework = args.flags.framework === 'next' ? 'next' : 'tanstack'
  // bare `--alias` (boolean) → keep the default rather than the literal string 'true'
  const alias = normalizeAlias(typeof args.flags.alias === 'string' ? args.flags.alias : undefined)
  const pmFlag = args.flags.pm ?? args.flags['package-manager']
  const pm = typeof pmFlag === 'string' ? resolvePackageManager(pmFlag) : detectedPm
  const picked = args.flags.foundations ? csv(args.flags.foundations) : [...ALL_FOUNDATIONS]
  // soft-map legacy `--foundations drizzle|prisma|better-auth` onto their axes
  const legacyDb = ['drizzle', 'prisma'].find((d) => picked.includes(d))
  const dbFlag = typeof args.flags.database === 'string' ? args.flags.database : legacyDb
  const authFlag =
    typeof args.flags.auth === 'string'
      ? args.flags.auth
      : picked.includes('better-auth')
        ? 'better-auth'
        : undefined
  const { kept, database, auth, mailerProvider } = normalize(
    picked,
    resolveDatabase(dbFlag),
    resolveAuth(authFlag),
    args.flags.mailer,
  )
  const capabilities = collectCapabilityFlags(args.flags)
  const doInstall = !args.flags['no-install']
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
    capabilities,
    doInstall,
  }
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
        { value: 'none', label: 'None', hint: 'no database (vitrine)' },
      ],
    }),
  )

  // better-auth needs a database; with `none` only offer the db-less providers.
  const betterAuthOpt = {
    value: 'better-auth',
    label: 'better-auth',
    hint: 'email+password, needs a mailer',
  }
  const authOptions = [
    ...(database === 'none' ? [] : [betterAuthOpt]),
    { value: 'clerk', label: 'Clerk', hint: 'hosted, no db/mailer needed' },
    { value: 'none', label: 'None', hint: 'no auth' },
  ]
  const auth = cancelled(
    await p.select({
      message: 'Auth',
      initialValue: database === 'none' ? 'clerk' : 'better-auth',
      options: authOptions,
    }),
  )

  // trpc needs a database, so only offer it when one is chosen.
  const wantsTrpc =
    database === 'none'
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
      message: 'Capabilities (space to toggle, swappable behind a port)',
      required: false,
      initialValues: [],
      options: capabilityChoices(),
    }),
  )

  const capabilities = {}
  for (const cap of capPicked) {
    const { defaultAdapter, options } = adapterChoices(cap)
    capabilities[cap] = cancelled(
      await p.select({
        message: `${cap} adapter`,
        options,
        initialValue: defaultAdapter,
      }),
    )
  }

  const doInstall = cancelled(
    await p.confirm({ message: 'Install dependencies and verify now?', initialValue: true }),
  )

  const {
    kept,
    database: db,
    auth: authProvider,
    mailerProvider,
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
    capabilities,
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

  const s = p.spinner()
  s.start('Forking + stripping the base app')
  buildProject({ ...a, projectDir, pm })
  s.stop('Project scaffolded')

  if (a.doInstall) installAndVerify(projectDir, pm)

  initGitRepo(projectDir)

  p.note(summaryLines(a, pm).join('\n'), 'Done')
  p.outro(`Created ${a.projectName}`)
}

const orNone = (v) => (v && v !== 'none' ? v : '(none)')

/** The "Done" note: selection recap + next steps. */
function summaryLines(a, pm) {
  const capEntries = Object.entries(a.capabilities ?? {})
  const lines = [
    `Framework: ${a.framework === 'next' ? 'Next.js' : 'TanStack Start'}`,
    `Package manager: ${pm.name}`,
    `Import alias: ${a.alias ?? '~'}/`,
    `Database: ${orNone(a.database)}`,
    `Auth: ${orNone(a.auth)}`,
    `Foundations: ${[...a.kept].sort().join(', ') || '(none)'}`,
    `Mailer: ${orNone(a.mailerProvider)}`,
    `Capabilities: ${capEntries.map(([c, ad]) => `${c} (${ad})`).join(', ') || '(none)'}`,
    '',
    'Add more tools later: create-stack add <capability>.',
    '',
    'Next:',
    `  cd ${a.argDir ?? a.projectName}`,
  ]
  if (!a.doInstall) lines.push(`  ${pm.name} install`)
  lines.push('  # edit .env (already generated with placeholders)', `  ${pm.devCmd}`)
  return lines
}

/** Which {cap, adapter} pairs to add: positional args (non-interactive), else a picker. */
async function resolveAddSelections(args) {
  if (args._[1]) {
    const cap = args._[1]
    if (!ADDABLE.includes(cap)) {
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
  const projectDir = resolve(process.cwd())
  if (!exists(join(projectDir, 'package.json'))) {
    p.cancel('No package.json here — run this from the root of a create-stack project.')
    process.exit(1)
  }

  p.intro('create-stack add')
  const keep = !!args.flags.keep
  const selections = await resolveAddSelections(args)
  const added = selections.map((sel) => ({
    ...sel,
    ...addCapability({ projectDir, ...sel, keep }),
  }))
  if (!args.flags['no-install']) installAndVerify(projectDir, detectedPm)

  p.note(added.map(addedLine).join('\n'), keep ? 'Added (kept existing adapters)' : 'Added')
  p.outro(`Added ${added.map((a) => a.cap).join(', ')}`)
}

/** Which components to install: a positional name (non-interactive), else a picker. */
async function resolveComponentSelections(args) {
  if (args._[1]) {
    const name = args._[1]
    if (!COMPONENT_NAMES.includes(name)) {
      p.cancel(`Unknown component: ${name} — pick one of ${COMPONENT_NAMES.join(', ')}`)
      process.exit(1)
    }
    return [name]
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

  const nonInteractive =
    args.flags.yes ||
    args.flags.y ||
    ['framework', 'database', 'auth', 'foundations', 'mailer', 'no-install', ...CAPABILITIES].some(
      (k) => k in args.flags,
    )

  const answers = nonInteractive ? collectFromFlags(args) : await collectFromPrompts(args._[0])

  execute(answers)
}

main().catch((err) => {
  p.log.error(String(err?.stack || err))
  process.exit(1)
})
