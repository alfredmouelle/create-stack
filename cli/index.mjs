#!/usr/bin/env node
// create-stack — fork a base app, strip to selection, stamp identity, verify.
// Interactive by default; non-interactive when any selection flag (or --yes) is passed:
//   create-stack my-app --framework next --foundations drizzle,trpc --mailer ses --no-install

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as p from '@clack/prompts'
import { addCapability, capabilityDir } from './lib/add.mjs'
import { ALL_FOUNDATIONS, csv, normalize, parseArgs } from './lib/args.mjs'
import { buildProject } from './lib/build.mjs'
import {
  adapterChoices,
  CAPABILITIES,
  capabilityChoices,
  resolveAdapter,
} from './lib/capabilities.mjs'
import { detectPackageManager } from './lib/package-manager.mjs'
import { exists, isDirEmpty, join, remove, run } from './lib/util.mjs'

// the PM that launched us (npx/pnpm dlx/yarn create/bun create); drives install + run.
const pm = detectPackageManager()

const VERSION = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
).version

const HELP = `create-stack — fork a base app, strip it to your selection.

Usage:
  create-stack [project] [flags]          Scaffold a new project
  create-stack add [capability] [adapter] Add capabilities to the current project

Run either command with no args for an interactive picker; pass a selection flag
(or --yes), or a capability name, for non-interactive mode.

Capabilities (for \`add\`): storage, cache, jobs, logger, analytics, error-tracking.
\`add\` with no capability opens a multi-select; --force overwrites existing ones.

Flags:
  --framework <tanstack|next>      Base app to fork (default tanstack)
  --foundations <csv>              drizzle,trpc,better-auth,data-table (default all)
  --mailer <resend|brevo|ses|none> Mailer provider (default resend)
  --storage [s3|r2|gcs|local]      Object storage capability (omit to skip)
  --cache [redis|upstash|memory]   Key/value cache capability (omit to skip)
  --jobs [inngest|trigger|memory]  Background jobs capability (omit to skip)
  --logger [pino|console]          Structured logging capability (omit to skip)
  --analytics [posthog|plausible|noop]  Analytics capability (omit to skip)
  --error-tracking [sentry|console]     Error reporting capability (omit to skip)
  --no-install                     Skip install + verification
  -y, --yes                        Non-interactive with all defaults
  -h, --help                       Show this help
  -v, --version                    Print version`

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
  const picked = args.flags.foundations ? csv(args.flags.foundations) : [...ALL_FOUNDATIONS]
  const { kept, mailerProvider } = normalize(picked, args.flags.mailer)
  const capabilities = collectCapabilityFlags(args.flags)
  const doInstall = !args.flags['no-install']
  return { argDir, projectName: argDir, framework, kept, mailerProvider, capabilities, doInstall }
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

  const picked = cancelled(
    await p.multiselect({
      message: 'Foundations (space to toggle)',
      required: false,
      initialValues: [...ALL_FOUNDATIONS],
      options: [
        { value: 'drizzle', label: 'Drizzle ORM', hint: 'Postgres + seed' },
        { value: 'trpc', label: 'tRPC', hint: 'needs Drizzle' },
        { value: 'better-auth', label: 'better-auth', hint: 'needs Drizzle + mailer' },
        { value: 'data-table', label: 'Data tables', hint: 'TanStack Table' },
      ],
    }),
  )
  const authKept = new Set(picked).has('better-auth')

  const mailerOpts = [
    { value: 'resend', label: 'Resend' },
    { value: 'brevo', label: 'Brevo' },
    { value: 'ses', label: 'Amazon SES' },
  ]
  if (!authKept) mailerOpts.push({ value: 'none', label: 'None' })
  const mailer = cancelled(
    await p.select({
      message: authKept ? 'Mailer provider (required by better-auth)' : 'Mailer provider',
      options: mailerOpts,
      initialValue: 'resend',
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

  const { kept, mailerProvider } = normalize(picked, mailer)
  return { argDir, projectName, framework, kept, mailerProvider, capabilities, doInstall }
}

const pmRun = (script, projectDir, opts = {}) =>
  run(pm.exec, pm.runArgs(script), { cwd: projectDir, ...opts })

/** Install deps, normalize vendored imports, then report typecheck + biome status. */
function installAndVerify(projectDir, capabilities) {
  p.log.step(`${pm.name} install`)
  run(pm.exec, ['install'], { cwd: projectDir })
  // vendored capabilities rewrite cross-package imports (~/lib/http); let biome
  // re-sort/normalize them so the initial commit is lint-clean.
  if (Object.keys(capabilities ?? {}).length) {
    pmRun('check:write', projectDir, { stdio: 'ignore' })
  }
  p.log.step('Verifying (typecheck + biome)')
  const tc = pmRun('typecheck', projectDir)
  const lint = pmRun('check', projectDir)
  p.log[tc && lint ? 'success' : 'warn'](
    tc && lint ? 'typecheck + biome clean' : 'verify reported issues (see output above)',
  )
}

function execute(a) {
  const projectDir = resolve(process.cwd(), a.argDir ?? a.projectName)
  if (!isDirEmpty(projectDir)) {
    p.cancel(`Target directory is not empty: ${projectDir}`)
    process.exit(1)
  }

  const s = p.spinner()
  s.start('Forking + stripping the base app')
  buildProject({ ...a, projectDir, pm })
  s.stop('Project scaffolded')

  if (a.doInstall) installAndVerify(projectDir, a.capabilities)

  // fresh repo + initial commit (also satisfies Biome vcs.useIgnoreFile).
  // commit is best-effort: skipped if git identity unset, staged tree left in place.
  if (run('git', ['-C', projectDir, 'init', '-q'])) {
    run('git', ['-C', projectDir, 'add', '-A'])
    const committed = run(
      'git',
      ['-C', projectDir, 'commit', '-q', '-m', 'chore: initial commit from create-stack'],
      { stdio: 'ignore' },
    )
    p.log.step(
      committed
        ? 'git repository initialized (initial commit created)'
        : 'git repository initialized — set git user.name/email, then commit',
    )
  }

  const keptMailer = a.mailerProvider !== 'none'
  const capEntries = Object.entries(a.capabilities ?? {})
  const lines = [
    `Framework: ${a.framework === 'next' ? 'Next.js' : 'TanStack Start'}`,
    `Foundations: ${[...a.kept].sort().join(', ') || '(none)'}`,
    `Mailer: ${keptMailer ? a.mailerProvider : '(none)'}`,
    `Capabilities: ${capEntries.map(([c, ad]) => `${c} (${ad})`).join(', ') || '(none)'}`,
    '',
    'Add more tools later: create-stack add <capability>.',
    '',
    'Next:',
    `  cd ${a.argDir ?? a.projectName}`,
  ]
  if (!a.doInstall) lines.push(`  ${pm.name} install`)
  lines.push('  cp .env.example .env   # fill in the values', `  ${pm.devCmd}`)
  p.note(lines.join('\n'), 'Done')
  p.outro(`Created ${a.projectName}`)
}

/** Which {cap, adapter} pairs to add: positional args (non-interactive), else a picker. */
async function resolveAddSelections(args) {
  if (args._[1]) {
    const cap = args._[1]
    if (!CAPABILITIES.includes(cap)) {
      p.cancel(`Unknown capability: ${cap} — pick one of ${CAPABILITIES.join(', ')}`)
      process.exit(1)
    }
    return [{ cap, adapter: resolveAdapter(cap, args._[2]) }] // resolveAdapter throws on a bad value
  }
  const caps = cancelled(
    await p.multiselect({
      message: 'Capabilities to add (space to toggle)',
      required: true,
      options: capabilityChoices(),
    }),
  )
  const selections = []
  for (const cap of caps) {
    const { defaultAdapter, options } = adapterChoices(cap)
    selections.push({
      cap,
      adapter: cancelled(
        await p.select({ message: `${cap} adapter`, options, initialValue: defaultAdapter }),
      ),
    })
  }
  return selections
}

/** Drop selections whose dir already exists unless overwritten (--force or a prompt). */
async function filterCollisions(projectDir, selections, force) {
  const todo = []
  for (const sel of selections) {
    const dest = join(projectDir, capabilityDir(sel.cap))
    if (exists(dest)) {
      const overwrite =
        force ||
        cancelled(
          await p.confirm({
            message: `${sel.cap} already exists — overwrite?`,
            initialValue: false,
          }),
        )
      if (!overwrite) continue
      remove(dest)
    }
    todo.push(sel)
  }
  return todo
}

/** `create-stack add [capability] [adapter]` — vendor capabilities into the cwd project. */
async function runAdd(args) {
  const projectDir = resolve(process.cwd())
  if (!exists(join(projectDir, 'package.json'))) {
    p.cancel('No package.json here — run this from the root of a create-stack project.')
    process.exit(1)
  }

  p.intro('create-stack add')
  const selections = await resolveAddSelections(args)
  const todo = await filterCollisions(projectDir, selections, args.flags.force)
  if (!todo.length) {
    p.cancel('Nothing to add.')
    process.exit(1)
  }

  const added = todo.map((sel) => ({ ...sel, ...addCapability({ projectDir, ...sel }) }))
  if (!args.flags['no-install']) {
    installAndVerify(projectDir, Object.fromEntries(added.map((a) => [a.cap, a.adapter])))
  }

  p.note(
    added
      .map(
        (a) =>
          `${a.cap} (${a.adapter}) → ${capabilityDir(a.cap)}/  env: ${a.envKeys.join(', ') || '(none)'}`,
      )
      .join('\n'),
    'Added — fill the env keys in .env',
  )
  p.outro(`Added ${added.map((a) => a.cap).join(', ')}`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.flags.help || args.flags.h) {
    process.stdout.write(`${HELP}\n`)
    return
  }
  if (args.flags.version || args.flags.v) {
    process.stdout.write(`${VERSION}\n`)
    return
  }

  if (args._[0] === 'add') {
    await runAdd(args)
    return
  }

  const nonInteractive =
    args.flags.yes ||
    args.flags.y ||
    ['framework', 'foundations', 'mailer', 'no-install', ...CAPABILITIES].some(
      (k) => k in args.flags,
    )

  const answers = nonInteractive ? collectFromFlags(args) : await collectFromPrompts(args._[0])

  execute(answers)
}

main().catch((err) => {
  p.log.error(String(err?.stack || err))
  process.exit(1)
})
